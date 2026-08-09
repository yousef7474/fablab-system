import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

// Print an overtime archive as a "سند" for a specific employee — one
// tabular summary in a new window styled for A4 portrait.
const printSanad = ({ staff, rows, totals, from, to, isRTL }) => {
  const w = window.open('', '_blank');
  if (!w) return;
  const rowsHtml = rows.map(r => `
    <tr>
      <td>${r.date}</td>
      <td dir="ltr">${fmtTime(r.checkInAt)}</td>
      <td dir="ltr">${fmtTime(r.checkOutAt)}</td>
      <td dir="ltr">${fmtHM(r.durationMinutes)}</td>
      <td dir="ltr" style="color:#b91c1c;font-weight:700">${fmtHM(r.overtimeMinutes)}</td>
      <td>${r.reason || '—'}</td>
      <td>${r.approvedBy || '—'}</td>
    </tr>
  `).join('');

  w.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>سند ساعات إضافية - ${staff.name}</title>
<style>
  @page { size: A4 portrait; margin: 12mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #0f172a; background: #fff; margin: 0; padding: 12mm; }
  .head { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #7c3aed; padding-bottom: 12px; margin-bottom: 20px; }
  .brand { font-size: 22px; font-weight: 800; color: #7c3aed; letter-spacing: -0.02em; }
  .brand-sub { font-size: 12px; color: #64748b; margin-top: 2px; }
  .title { text-align: center; margin: 16px 0 8px; font-size: 20px; font-weight: 800; color: #0f172a; }
  .info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0 22px; }
  .info div { padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; }
  .info b { display: block; font-size: 10px; color: #64748b; font-weight: 700; letter-spacing: 0.06em; margin-bottom: 4px; text-transform: uppercase; }
  .info span { font-size: 14px; color: #0f172a; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead th { background: #ede9fe; color: #5b21b6; padding: 8px 6px; text-align: right; font-weight: 700; border-bottom: 2px solid #7c3aed; }
  tbody td { padding: 8px 6px; border-bottom: 1px solid #e2e8f0; text-align: right; }
  tbody tr:nth-child(even) { background: #faf5ff; }
  .totals { margin-top: 18px; padding: 12px 16px; background: #7c3aed; color: #fff; border-radius: 8px; display: flex; justify-content: space-between; font-weight: 700; }
  .footer { margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; font-size: 12px; color: #475569; }
  .footer .box { padding: 24px 12px 12px; border-top: 1.5px solid #cbd5e1; text-align: center; }
  .footer .box b { display: block; margin-bottom: 40px; color: #64748b; font-size: 11px; }
  .actions { text-align: center; margin-top: 20px; }
  button { padding: 10px 24px; border-radius: 8px; border: 0; background: #7c3aed; color: #fff; font-weight: 700; cursor: pointer; font-size: 14px; }
  @media print { .actions { display: none; } body { padding: 0; } }
</style></head><body>
<div class="head">
  <div>
    <div class="brand">FABLAB الأحساء</div>
    <div class="brand-sub">مؤسسة عبدالمنعم الراشد الإنسانية</div>
  </div>
  <div style="text-align:left">
    <div style="font-size:11px;color:#64748b">تاريخ الطباعة</div>
    <div style="font-weight:700" dir="ltr">${new Date().toISOString().slice(0, 10)}</div>
  </div>
</div>

<div class="title">سند ساعات إضافية</div>

<div class="info">
  <div><b>الموظف</b><span>${staff.name}</span></div>
  <div><b>الوظيفة</b><span>${staff.position || '—'}</span></div>
  <div><b>رقم الهوية</b><span dir="ltr">${staff.nationalId || '—'}</span></div>
  <div><b>الفترة من</b><span dir="ltr">${from}</span></div>
  <div><b>إلى</b><span dir="ltr">${to}</span></div>
  <div><b>عدد الأيام</b><span>${totals.count}</span></div>
</div>

<table>
  <thead>
    <tr>
      <th>التاريخ</th>
      <th>وقت الدخول</th>
      <th>وقت الخروج</th>
      <th>المدة</th>
      <th>الساعات الإضافية</th>
      <th>السبب</th>
      <th>معتمد من</th>
    </tr>
  </thead>
  <tbody>${rowsHtml || `<tr><td colspan="7" style="text-align:center;padding:20px;color:#94a3b8">لا توجد ساعات إضافية في هذه الفترة</td></tr>`}</tbody>
</table>

<div class="totals">
  <span>إجمالي الساعات الإضافية</span>
  <span dir="ltr">${fmtHM(totals.overtimeMin)}</span>
</div>

<div class="footer">
  <div class="box"><b>توقيع الموظف</b></div>
  <div class="box"><b>توقيع المعتمد</b></div>
</div>

<div class="actions"><button onclick="window.print()">طباعة السند</button></div>
</body></html>`);
  w.document.close();
};

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

  const handlePrintSanad = async (staffId) => {
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const { data } = await api.get(`/fablab-staff/${staffId}/overtime?${params.toString()}`);
      printSanad({
        staff: data.staff,
        rows: data.rows || [],
        totals: data.totals || { count: 0, overtimeMin: 0 },
        from, to, isRTL
      });
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'فشل توليد السند' : 'Failed to build sanad');
    }
  };

  // Group by staffId so the "Print سند" button appears once per person
  const byStaff = useMemo(() => {
    const map = new Map();
    rows.forEach(r => {
      const key = r.staffId;
      if (!map.has(key)) map.set(key, { staff: r.staff, count: 0, overtimeMin: 0 });
      const s = map.get(key);
      s.count += 1;
      s.overtimeMin += r.overtimeMinutes;
    });
    return Array.from(map.values());
  }, [rows]);

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
              ? 'يُحسب تلقائياً من مسح البطاقة — أي وقت أكثر من ٩ ساعات يُعدّ ساعات إضافية.'
              : 'Computed automatically from QR scans — anything above 9 hours counts as overtime.'}
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

      {/* Per-employee print bar */}
      {byStaff.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {byStaff.map(s => (
            <button
              key={s.staff.staffId}
              onClick={() => handlePrintSanad(s.staff.staffId)}
              title={isRTL ? `طباعة سند ${s.staff.name}` : `Print sanad for ${s.staff.name}`}
              style={{
                padding: '6px 12px', borderRadius: 8, border: '1px solid #c4b5fd',
                background: '#fff', color: '#5b21b6', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 12, fontWeight: 700
              }}
            >
              🖨 {s.staff.name} · <span dir="ltr" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{fmtHM(s.overtimeMin)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={{ overflow: 'auto', borderRadius: 10, border: '1px solid #ddd6fe', background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#ede9fe' }}>
              <th style={{ padding: 10, textAlign: 'right', color: '#5b21b6', fontWeight: 700 }}>{isRTL ? 'الموظف' : 'Employee'}</th>
              <th style={{ padding: 10, textAlign: 'right', color: '#5b21b6', fontWeight: 700 }}>{isRTL ? 'التاريخ' : 'Date'}</th>
              <th style={{ padding: 10, textAlign: 'right', color: '#5b21b6', fontWeight: 700 }}>{isRTL ? 'الدخول' : 'In'}</th>
              <th style={{ padding: 10, textAlign: 'right', color: '#5b21b6', fontWeight: 700 }}>{isRTL ? 'الخروج' : 'Out'}</th>
              <th style={{ padding: 10, textAlign: 'right', color: '#5b21b6', fontWeight: 700 }}>{isRTL ? 'الإضافية' : 'Overtime'}</th>
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
                  <td style={{ padding: 10, fontFamily: 'JetBrains Mono, monospace' }} dir="ltr">{fmtTime(r.checkInAt)}</td>
                  <td style={{ padding: 10, fontFamily: 'JetBrains Mono, monospace' }} dir="ltr">{fmtTime(r.checkOutAt)}</td>
                  <td style={{ padding: 10, fontFamily: 'JetBrains Mono, monospace', color: '#b91c1c', fontWeight: 700 }} dir="ltr">
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
