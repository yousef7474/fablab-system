import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../../config/api';

// Approvers dropdown — same roster as the manual overtime flow so
// the printed سند matches accounting's allowed set.
const APPROVERS = [
  'م. نوف البوعبيد',
  'أ. زكي اللويم',
  'أ. عبدالله الصفي',
  'أ. عبدالمحسن السلطان'
];

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

  // Per-row draft state so admin can type reason / pick approvedBy
  // and Save only when they mean it (Enter or on blur).
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState({});

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

  const draftOf = (row) => {
    const key = row.attendanceId;
    if (drafts[key]) return drafts[key];
    return { reason: row.reason || '', approvedBy: row.approvedBy || '' };
  };
  const setDraft = (attId, patch) => {
    setDrafts(prev => ({ ...prev, [attId]: { ...draftOf({ attendanceId: attId, reason: '', approvedBy: '' }), ...(prev[attId] || {}), ...patch } }));
  };

  const saveAnnotation = async (row) => {
    const d = draftOf(row);
    setSaving(prev => ({ ...prev, [row.attendanceId]: true }));
    try {
      await api.patch(`/fablab-staff/attendance/${row.attendanceId}/annotate`, {
        reason: d.reason,
        approvedBy: d.approvedBy
      });
      setRows(prev => prev.map(r =>
        r.attendanceId === row.attendanceId
          ? { ...r, reason: d.reason || null, approvedBy: d.approvedBy || null }
          : r
      ));
      setDrafts(prev => { const n = { ...prev }; delete n[row.attendanceId]; return n; });
      toast.success(isRTL ? 'تم الحفظ' : 'Saved');
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'فشل الحفظ' : 'Save failed');
    } finally {
      setSaving(prev => ({ ...prev, [row.attendanceId]: false }));
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
              <th style={{ padding: 10, textAlign: 'right', color: '#5b21b6', fontWeight: 700, minWidth: 180 }}>{isRTL ? 'السبب' : 'Reason'}</th>
              <th style={{ padding: 10, textAlign: 'right', color: '#5b21b6', fontWeight: 700, minWidth: 160 }}>{isRTL ? 'معتمد من' : 'Approved by'}</th>
              <th style={{ padding: 10 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>{isRTL ? 'جارٍ التحميل...' : 'Loading...'}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan="8" style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>{isRTL ? 'لا توجد ساعات إضافية في هذه الفترة' : 'No overtime in this period'}</td></tr>
            ) : rows.map(r => {
              const d = draftOf(r);
              const dirty = (d.reason || '') !== (r.reason || '') || (d.approvedBy || '') !== (r.approvedBy || '');
              const isSaving = !!saving[r.attendanceId];
              return (
                <tr key={r.attendanceId} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 10, fontWeight: 600 }}>{r.staff?.name || '—'}</td>
                  <td style={{ padding: 10, fontFamily: 'JetBrains Mono, monospace' }}>{r.date}</td>
                  <td style={{ padding: 10, fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }} dir="ltr">{fmtTime(r.checkInAt)}</td>
                  <td style={{ padding: 10, fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }} dir="ltr">{fmtTime(r.checkOutAt)}</td>
                  <td style={{ padding: 10, fontFamily: 'JetBrains Mono, monospace', color: '#b91c1c', fontWeight: 700, textAlign: 'center' }} dir="ltr">
                    {fmtHM(r.overtimeMinutes)}
                  </td>
                  <td style={{ padding: 6 }}>
                    <input
                      type="text"
                      value={d.reason}
                      placeholder={isRTL ? 'السبب (اختياري)' : 'Reason (optional)'}
                      onChange={(e) => setDraft(r.attendanceId, { reason: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveAnnotation(r); }}
                      style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: `1px solid ${dirty ? '#7c3aed' : '#e2e8f0'}`, fontFamily: 'inherit', fontSize: 12 }}
                    />
                  </td>
                  <td style={{ padding: 6 }}>
                    <select
                      value={d.approvedBy}
                      onChange={(e) => setDraft(r.attendanceId, { approvedBy: e.target.value })}
                      style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: `1px solid ${dirty ? '#7c3aed' : '#e2e8f0'}`, fontFamily: 'inherit', fontSize: 12, background: '#fff' }}
                    >
                      <option value="">— {isRTL ? 'اختر' : 'Pick'} —</option>
                      {APPROVERS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: 6, textAlign: 'center' }}>
                    <button
                      onClick={() => saveAnnotation(r)}
                      disabled={!dirty || isSaving}
                      style={{
                        padding: '4px 10px', borderRadius: 6, border: 'none',
                        background: dirty ? '#7c3aed' : '#e2e8f0',
                        color: dirty ? '#fff' : '#94a3b8',
                        cursor: dirty ? 'pointer' : 'not-allowed',
                        fontWeight: 700, fontSize: 12, fontFamily: 'inherit'
                      }}
                    >{isSaving ? '…' : (isRTL ? 'حفظ' : 'Save')}</button>
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
