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
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>{isRTL ? 'جارٍ التحميل...' : 'Loading...'}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan="5" style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>{isRTL ? 'لا توجد ساعات إضافية في هذه الفترة' : 'No overtime in this period'}</td></tr>
            ) : rows.map(r => (
              <tr key={r.attendanceId} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: 10, fontWeight: 600 }}>{r.staff?.name || '—'}</td>
                <td style={{ padding: 10, fontFamily: 'JetBrains Mono, monospace' }}>{r.date}</td>
                <td style={{ padding: 10, fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }} dir="ltr">{fmtTime(r.checkInAt)}</td>
                <td style={{ padding: 10, fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }} dir="ltr">{fmtTime(r.checkOutAt)}</td>
                <td style={{ padding: 10, fontFamily: 'JetBrains Mono, monospace', color: '#b91c1c', fontWeight: 700, textAlign: 'center' }} dir="ltr">
                  {fmtHM(r.overtimeMinutes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AutoStaffOvertime;
