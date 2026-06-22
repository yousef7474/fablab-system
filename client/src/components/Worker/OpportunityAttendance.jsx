import React, { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../config/api';

// Per-day attendance log for one worker opportunity. Renders a row for
// every date from startDate to endDate (inclusive) with an attendance
// checkbox and an hours input. Cost per row = hours × WORKER_HOURLY_RATE.
// Save persists the array to WorkerOpportunity.attendanceDays.

export const WORKER_HOURLY_RATE = 15; // SAR per hour

const fmt = (d) => {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d).slice(0, 10);
  return date.toISOString().slice(0, 10);
};

// Build the array of dates from start..end inclusive.
const buildDateRange = (start, end) => {
  const out = [];
  if (!start || !end) return out;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return out;
  // Cap absurdly long ranges so we don't render thousands of rows.
  for (let d = new Date(s); d <= e && out.length < 366; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
};

const OpportunityAttendance = ({ opportunity, isRTL, onSaved }) => {
  const dates = useMemo(
    () => buildDateRange(opportunity.startDate, opportunity.endDate),
    [opportunity.startDate, opportunity.endDate]
  );

  // Seed local state from the saved array, filling in defaults for any
  // dates that don't have a record yet.
  const seed = useMemo(() => {
    const saved = Array.isArray(opportunity.attendanceDays) ? opportunity.attendanceDays : [];
    const byDate = Object.fromEntries(saved.map(d => [fmt(d.date), d]));
    return dates.map(date => ({
      date,
      attended: !!byDate[date]?.attended,
      hours: byDate[date]?.hours != null ? Number(byDate[date].hours) : 0
    }));
  }, [dates, opportunity.attendanceDays]);

  const [rows, setRows] = useState(seed);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // If a sibling re-render shipped a fresh `opportunity` prop (e.g.
  // after fetchWorkers), reseed unless the admin is mid-edit.
  React.useEffect(() => {
    if (!dirty) setRows(seed);
  }, [seed, dirty]);

  const updateRow = (i, patch) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
    setDirty(true);
  };

  const totalCost = rows.reduce(
    (sum, r) => sum + (r.attended ? (Number(r.hours) || 0) * WORKER_HOURLY_RATE : 0),
    0
  );
  const totalHours = rows.reduce(
    (sum, r) => sum + (r.attended ? (Number(r.hours) || 0) : 0),
    0
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/workers/opportunities/${opportunity.opportunityId}`, {
        attendanceDays: rows
      });
      toast.success(isRTL ? 'تم حفظ الحضور' : 'Attendance saved');
      setDirty(false);
      if (typeof onSaved === 'function') onSaved();
    } catch (err) {
      console.error('Error saving attendance:', err);
      toast.error(isRTL ? 'خطأ في الحفظ' : 'Error saving');
    } finally {
      setSaving(false);
    }
  };

  if (dates.length === 0) {
    return (
      <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.5rem 0' }}>
        {isRTL ? 'لا توجد فترة محددة لهذه الفرصة' : 'No date range set for this opportunity'}
      </p>
    );
  }

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: '0.5rem'
      }}>
        <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>
          {isRTL ? 'سجل الحضور اليومي' : 'Daily Attendance Log'}
        </strong>
        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
          {WORKER_HOURLY_RATE} {isRTL ? 'ريال/ساعة' : 'SAR/hour'}
        </span>
      </div>

      <div style={{
        border: '1px solid #e2e8f0', borderRadius: 10,
        overflow: 'hidden', background: 'white'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead style={{ background: '#f1f5f9' }}>
            <tr>
              <th style={{ padding: '6px 10px', textAlign: isRTL ? 'right' : 'left', fontWeight: 700, color: '#0f172a' }}>
                {isRTL ? 'التاريخ' : 'Date'}
              </th>
              <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700, color: '#0f172a', width: '15%' }}>
                {isRTL ? 'حضر' : 'Attended'}
              </th>
              <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700, color: '#0f172a', width: '20%' }}>
                {isRTL ? 'الساعات' : 'Hours'}
              </th>
              <th style={{ padding: '6px 10px', textAlign: isRTL ? 'left' : 'right', fontWeight: 700, color: '#0f172a', width: '20%' }}>
                {isRTL ? 'التكلفة' : 'Cost'}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const cost = r.attended ? (Number(r.hours) || 0) * WORKER_HOURLY_RATE : 0;
              return (
                <tr key={r.date} style={{ borderTop: '1px solid #f1f5f9', background: r.attended ? '#f0fdf4' : 'transparent' }}>
                  <td style={{ padding: '6px 10px' }}>
                    {new Date(r.date).toLocaleDateString(isRTL ? 'ar-SA-u-nu-latn' : 'en-US', { weekday: 'short', day: '2-digit', month: 'short' })}
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={r.attended}
                      onChange={(e) => updateRow(i, { attended: e.target.checked, hours: e.target.checked ? r.hours : 0 })}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <input
                      type="number"
                      min="0"
                      max="24"
                      step="0.5"
                      value={r.attended ? r.hours : ''}
                      onChange={(e) => updateRow(i, { hours: parseFloat(e.target.value) || 0 })}
                      disabled={!r.attended}
                      style={{
                        width: 72, padding: '4px 6px', borderRadius: 6, border: '1px solid #cbd5e1',
                        textAlign: 'center', background: r.attended ? 'white' : '#f1f5f9',
                        cursor: r.attended ? 'text' : 'not-allowed', fontFamily: 'inherit'
                      }}
                    />
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: isRTL ? 'left' : 'right', fontWeight: 600, color: r.attended ? '#16a34a' : '#94a3b8' }}>
                    {cost.toFixed(2)} {isRTL ? 'ر.س' : 'SAR'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f8fafc', borderTop: '2px solid #475569' }}>
              <td style={{ padding: '8px 10px', fontWeight: 700, color: '#0f172a' }}>
                {isRTL ? 'الإجمالي' : 'Total'}
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: '0.78rem', color: '#64748b' }}>
                {rows.filter(r => r.attended).length} {isRTL ? 'يوم' : 'days'}
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>
                {totalHours} {isRTL ? 'س' : 'h'}
              </td>
              <td style={{ padding: '8px 10px', textAlign: isRTL ? 'left' : 'right', fontWeight: 800, color: '#16a34a', fontSize: '0.95rem' }}>
                {totalCost.toFixed(2)} {isRTL ? 'ر.س' : 'SAR'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem', gap: '0.5rem' }}>
        {dirty && (
          <span style={{ alignSelf: 'center', fontSize: '0.75rem', color: '#b45309', marginInlineEnd: 'auto' }}>
            {isRTL ? 'لم يتم الحفظ بعد' : 'Unsaved changes'}
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          style={{
            padding: '0.5rem 1.2rem', borderRadius: 8, border: 'none',
            background: dirty ? '#a78bfa' : '#cbd5e1', color: 'white',
            cursor: saving || !dirty ? 'not-allowed' : 'pointer',
            fontWeight: 700, fontSize: '0.85rem', fontFamily: 'inherit',
            opacity: saving ? 0.7 : 1
          }}
        >
          {saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ الحضور' : 'Save Attendance')}
        </button>
      </div>
    </div>
  );
};

export default OpportunityAttendance;
