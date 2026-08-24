import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../../config/api';

const fmtHM = (min) => {
  if (!Number.isFinite(min) || min < 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
};
const fmtTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const monthAgo = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);

const AutoStaffOvertime = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({ count: 0, overtimeMin: 0 });
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [staffFilter, setStaffFilter] = useState('');
  const [staff, setStaff] = useState([]);
  // Per-row editable "reason" (what the overtime was for). Value is
  // debounce-saved to /fablab-staff/attendance/:id/annotate on blur
  // and carried into the sanad through the manual-request import
  // (reason → task in OvertimeManagement.jsx).
  const [reasonDrafts, setReasonDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);

  const fetchStaff = useCallback(async () => {
    try {
      const { data } = await api.get('/fablab-staff');
      setStaff(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
  }, []);

  const fetchOvertime = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (staffFilter) params.set('staffId', staffFilter);
      const { data } = await api.get(`/fablab-staff/overtime?${params.toString()}`);
      setRows(data.rows || []);
      setTotals(data.totals || { count: 0, overtimeMin: 0 });
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'تعذر تحميل ساعات العمل الإضافية' : 'Failed to load overtime');
    } finally {
      setLoading(false);
    }
  }, [from, to, staffFilter, isRTL]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);
  useEffect(() => { fetchOvertime(); }, [fetchOvertime]);

  // Seed drafts from server data whenever rows change.
  useEffect(() => {
    const seed = {};
    for (const r of rows) seed[r.attendanceId] = r.reason || '';
    setReasonDrafts(seed);
  }, [rows]);

  const saveReason = async (row) => {
    const draft = (reasonDrafts[row.attendanceId] || '').trim();
    if (draft === (row.reason || '')) return; // no change
    setSavingId(row.attendanceId);
    try {
      await api.patch(`/fablab-staff/attendance/${row.attendanceId}/annotate`, { reason: draft });
      // Reflect the saved value locally so re-editing doesn't re-save.
      setRows(prev => prev.map(x => x.attendanceId === row.attendanceId ? { ...x, reason: draft || null } : x));
      setSavedId(row.attendanceId);
      setTimeout(() => setSavedId(id => id === row.attendanceId ? null : id), 1400);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'تعذّر حفظ التفاصيل' : 'Failed to save details');
    } finally {
      setSavingId(id => id === row.attendanceId ? null : id);
    }
  };

  return (
    <div style={{
      padding: 18, borderRadius: 12,
      background: 'linear-gradient(135deg, #f5f3ff 0%, #eff6ff 100%)',
      border: '1px solid #ddd6fe',
      marginBottom: 20
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 22 }}>⏱</div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#5b21b6' }}>
            {isRTL ? 'الساعات الإضافية التلقائية' : 'Auto Overtime'}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {isRTL
              ? 'يُحسب تلقائياً من مسح البطاقة — الدوام الرسمي ٩ ساعات + سماح ٣٠ دقيقة؛ أي وقت بعد ذلك يُعدّ ساعات إضافية.'
              : 'Computed from QR scans — 9-hour official day + 30-min grace; anything past that counts as overtime.'}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap', marginBottom: 14 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          <span style={{ color: '#5b21b6', fontWeight: 700 }}>{isRTL ? 'من' : 'From'}</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #c4b5fd' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          <span style={{ color: '#5b21b6', fontWeight: 700 }}>{isRTL ? 'إلى' : 'To'}</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #c4b5fd' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, flex: '1 1 220px' }}>
          <span style={{ color: '#5b21b6', fontWeight: 700 }}>{isRTL ? 'الموظف' : 'Employee'}</span>
          <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #c4b5fd', fontFamily: 'inherit' }}>
            <option value="">{isRTL ? 'الكل' : 'All'}</option>
            {staff.map(s => (
              <option key={s.staffId} value={s.staffId}>{s.name}{s.position ? ` — ${s.position}` : ''}</option>
            ))}
          </select>
        </label>
        <div style={{ display: 'flex', gap: 12, marginInlineStart: 'auto', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {isRTL ? 'إجمالي' : 'Total'}: <b style={{ color: '#5b21b6', fontFamily: 'JetBrains Mono, monospace' }}>{fmtHM(totals.overtimeMin)}</b>
            <span style={{ marginInlineStart: 8 }}>· {totals.count} {isRTL ? 'يوم' : 'days'}</span>
          </div>
        </div>
      </div>

      {/* Hint that Sanad printing lives in the manual form below */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        padding: '8px 12px', margin: '0 0 12px',
        background: '#eff6ff', border: '1px dashed #bfdbfe', borderRadius: 8,
        fontSize: 12, color: '#1e40af'
      }}>
        <span>💡</span>
        <span>
          {isRTL
            ? 'لطباعة سند: افتح "طلب جديد" في الأسفل، اختر الموظف، ثم استورد أيامه من قائمة الساعات الإضافية.'
            : 'To print Sanad: open "New Request" below, pick the employee, then import their days from the auto-overtime list.'}
        </span>
      </div>

      {/* Table */}
      <div style={{ overflow: 'auto', borderRadius: 10, border: '1px solid #ddd6fe', background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#ede9fe' }}>
              <th style={{ padding: 10, textAlign: 'right', color: '#5b21b6', fontWeight: 700 }}>{isRTL ? 'الموظف' : 'Employee'}</th>
              <th style={{ padding: 10, textAlign: 'right', color: '#5b21b6', fontWeight: 700 }}>{isRTL ? 'التاريخ' : 'Date'}</th>
              <th style={{ padding: 10, textAlign: 'center', color: '#5b21b6', fontWeight: 700 }}>{isRTL ? 'الدخول' : 'In'}</th>
              <th style={{ padding: 10, textAlign: 'center', color: '#5b21b6', fontWeight: 700 }}>{isRTL ? 'الخروج' : 'Out'}</th>
              <th style={{ padding: 10, textAlign: 'center', color: '#5b21b6', fontWeight: 700 }}>{isRTL ? 'الإضافية' : 'Overtime'}</th>
              <th style={{ padding: 10, textAlign: 'right', color: '#5b21b6', fontWeight: 700, minWidth: 220 }}>
                {isRTL ? 'التفاصيل' : 'Details'}
                <span style={{ marginInlineStart: 6, fontSize: 10, fontWeight: 500, color: '#8b5cf6' }}>
                  📄 {isRTL ? '(تُطبع على السند)' : '(prints on sanad)'}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>{isRTL ? 'جارٍ التحميل...' : 'Loading...'}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan="6" style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>{isRTL ? 'لا توجد ساعات إضافية في هذه الفترة' : 'No overtime in this period'}</td></tr>
            ) : rows.map(r => {
              const isSaving = savingId === r.attendanceId;
              const isSaved = savedId === r.attendanceId;
              return (
                <tr key={r.attendanceId} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 10, fontWeight: 600 }}>{r.staff?.name || '—'}</td>
                  <td style={{ padding: 10, fontFamily: 'JetBrains Mono, monospace' }}>{r.date}</td>
                  <td style={{ padding: 10, fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }} dir="ltr">{fmtTime(r.checkInAt)}</td>
                  <td style={{ padding: 10, fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }} dir="ltr">{fmtTime(r.checkOutAt)}</td>
                  <td style={{ padding: 10, fontFamily: 'JetBrains Mono, monospace', color: '#b91c1c', fontWeight: 700, textAlign: 'center' }} dir="ltr">
                    {fmtHM(r.overtimeMinutes)}
                  </td>
                  <td style={{ padding: 8, position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="text"
                        value={reasonDrafts[r.attendanceId] || ''}
                        onChange={(e) => setReasonDrafts(d => ({ ...d, [r.attendanceId]: e.target.value }))}
                        onBlur={() => saveReason(r)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }}
                        placeholder={isRTL ? 'اكتب سبب/تفاصيل هذا اليوم...' : 'What was this overtime for?'}
                        style={{
                          flex: 1,
                          padding: '7px 10px',
                          borderRadius: 6,
                          border: `1px solid ${isSaved ? '#16a34a' : '#e0e7ff'}`,
                          background: isSaved ? '#f0fdf4' : '#fff',
                          fontFamily: 'inherit',
                          fontSize: 12.5,
                          color: '#0f172a',
                          outline: 'none',
                          transition: 'border-color 0.15s, background 0.2s'
                        }}
                      />
                      {isSaving && (
                        <span style={{ fontSize: 11, color: '#8b5cf6', fontWeight: 700 }}>...</span>
                      )}
                      {isSaved && !isSaving && (
                        <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 800 }}>✓</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AutoStaffOvertime;
