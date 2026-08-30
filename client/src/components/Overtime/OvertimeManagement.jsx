import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import api from '../../config/api';
import '../Mawhba/Mawhba.css';
import AutoStaffOvertime from './AutoStaffOvertime';

// Overtime (ساعات إضافية) — track admin-submitted overtime requests
// for FabLab employees, archive them, and print each one on the same
// letterhead the volunteer "سند" receipt uses (so accounting sees one
// consistent document style).

// Fixed roster of admins who can approve an overtime request. Shown
// as "معتمد من" on the printed سند; hard-coded here rather than
// pulled from Admin table so accounting sees an exact allowed set.
const APPROVERS = [
  'م. نوف البوعبيد',
  'أ. زكي اللويم',
  'أ. عبدالله الصفي',
  'أ. عبدالمحسن السلطان'
];

// Preset manager emails for the send-for-approval flow. Only the
// entries with an email set appear in the dropdown; empty entries
// are placeholders — fill in when the address is known. Admin can
// always type a custom email via the "بريد آخر" option.
const APPROVER_EMAILS = [
  { name: 'أ. زكي اللويم',        email: 'zakiallwoaim@gmail.com' },
  { name: 'م. نوف البوعبيد',      email: '' },
  { name: 'أ. عبدالله الصفي',     email: '' },
  { name: 'أ. عبدالمحسن السلطان', email: '' }
];

const emptyForm = () => ({
  employeeName: '',
  nationalId: '',
  phone: '',
  email: '',
  position: '',
  periodStart: '',
  periodEnd: '',
  approvedBy: '',
  note: '',
  sanadDetails: '',
  days: [{ date: '', startTime: '', endTime: '', hours: '', task: '' }]
});

// Compute the number of hours between two HH:MM strings. Handles the
// after-midnight case by adding 24h when the end is earlier than the
// start. Returns an empty string when either input is missing so we
// don't overwrite a manually typed value.
const computeHoursFromTimes = (startTime, endTime) => {
  if (!startTime || !endTime) return '';
  const [sh, sm] = String(startTime).split(':').map(Number);
  const [eh, em] = String(endTime).split(':').map(Number);
  if ([sh, sm, eh, em].some(v => Number.isNaN(v))) return '';
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  if (mins <= 0) return '';
  return String(Math.round((mins / 60) * 100) / 100);
};

const OvertimeManagement = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  // Preserve the full row being edited so we know its approvalStatus
  // (approved → offer "Save & Reprint" so admin can regenerate the
  // sanad after fixing typos).
  const [editingRow, setEditingRow] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [search, setSearch] = useState('');
  // Existing FabLab staff — pulled on first modal open so admin can
  // pick a known employee instead of retyping their info. If the
  // person isn't in the list, admin leaves picker on "new" and types
  // the fields manually.
  const [staffList, setStaffList] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  // Auto-overtime rows for the currently-picked staff, so admin can
  // import them into the days grid instead of retyping.
  const [autoOvertime, setAutoOvertime] = useState([]);
  const [autoLoading, setAutoLoading] = useState(false);
  const [pickedAutoIds, setPickedAutoIds] = useState(new Set());

  // Send-for-approval modal state
  const [sendTarget, setSendTarget] = useState(null);
  const [sendEmail, setSendEmail] = useState('');
  const [sending, setSending] = useState(false);

  const openSendModal = (row) => {
    setSendTarget(row);
    // Pre-fill with the last-used manager email if this row was already sent
    setSendEmail(row.managerEmail || localStorage.getItem('overtime-last-manager-email') || '');
  };
  const closeSendModal = () => { setSendTarget(null); setSendEmail(''); setSending(false); };

  const submitSend = async () => {
    if (!sendTarget) return;
    const email = sendEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return toast.error(isRTL ? 'بريد إلكتروني غير صحيح' : 'Invalid email');
    }
    setSending(true);
    try {
      const { data } = await api.post(`/overtime/${sendTarget.overtimeId}/send-for-approval`, { managerEmail: email });
      localStorage.setItem('overtime-last-manager-email', email);
      if (data?.emailFailed) {
        toast.warning(isRTL ? 'تم التحديد قيد الاعتماد لكن فشل إرسال البريد' : 'Marked pending but email failed');
      } else {
        toast.success(isRTL ? 'تم الإرسال للمدير' : 'Sent to manager');
      }
      closeSendModal();
      load();
    } catch (err) {
      const msg = err?.response?.data?.messageAr || err?.response?.data?.message;
      toast.error(msg || (isRTL ? 'فشل الإرسال' : 'Send failed'));
    } finally {
      setSending(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/overtime');
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'تعذر تحميل الطلبات' : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [isRTL]);

  useEffect(() => { load(); }, [load]);

  // Lazy-fetch the staff roster the first time the create modal opens.
  useEffect(() => {
    if (!showModal || staffList.length > 0) return;
    api.get('/fablab-staff')
      .then(res => setStaffList(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, [showModal, staffList.length]);

  const pickStaff = (id) => {
    setSelectedStaffId(id);
    setPickedAutoIds(new Set());
    setAutoOvertime([]);
    if (!id) {
      // "New employee" — clear identity fields, keep period/days/notes.
      setForm(prev => ({
        ...prev,
        employeeName: '', nationalId: '', phone: '', email: '', position: ''
      }));
      return;
    }
    const s = staffList.find(x => x.staffId === id);
    if (!s) return;
    setForm(prev => ({
      ...prev,
      employeeName: s.name || '',
      nationalId: s.nationalId || '',
      phone: s.phone || '',
      email: s.email || '',
      position: s.position || ''
    }));
    // Fetch this employee's recorded overtime so admin can import.
    setAutoLoading(true);
    api.get(`/fablab-staff/${id}/overtime`)
      .then(res => setAutoOvertime(Array.isArray(res.data?.rows) ? res.data.rows : []))
      .catch(() => setAutoOvertime([]))
      .finally(() => setAutoLoading(false));
  };

  // Merge selected auto-overtime rows into the manual days grid.
  // Skips rows already present (matched by date). Fills date +
  // startTime + endTime + auto-computed hours; task is left blank
  // for the admin to describe.
  const importAutoPicked = () => {
    if (pickedAutoIds.size === 0) return;
    const picked = autoOvertime.filter(r => pickedAutoIds.has(r.attendanceId));
    const iso = (v) => v ? String(v).slice(0, 10) : '';
    const fmtHMLocal = (iso2) => {
      if (!iso2) return '';
      const d = new Date(iso2);
      if (isNaN(d.getTime())) return '';
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setForm(prev => {
      const existing = prev.days || [];
      const existingDates = new Set(existing.map(d => iso(d.date)));
      const additions = picked
        .filter(r => !existingDates.has(iso(r.date)))
        .map(r => ({
          date: iso(r.date),
          startTime: fmtHMLocal(r.checkInAt),
          endTime: fmtHMLocal(r.checkOutAt),
          hours: (r.overtimeMinutes / 60).toFixed(2),
          task: r.reason || ''
        }));
      // If the only existing day is the seed-empty row, drop it
      const filteredExisting = existing.filter(d => d.date || d.hours || d.task || d.startTime || d.endTime);
      const nextDays = [...filteredExisting, ...additions];
      // Also auto-fill period start/end if empty
      const dates = nextDays.map(d => d.date).filter(Boolean).sort();
      return {
        ...prev,
        days: nextDays.length ? nextDays : [{ date: '', hours: '', task: '' }],
        periodStart: prev.periodStart || (dates[0] || ''),
        periodEnd: prev.periodEnd || (dates[dates.length - 1] || '')
      };
    });
    toast.success(isRTL
      ? `تم استيراد ${picked.length} يوم`
      : `Imported ${picked.length} day(s)`);
    setPickedAutoIds(new Set());
  };

  const toggleAutoPick = (attId) => {
    setPickedAutoIds(prev => {
      const next = new Set(prev);
      if (next.has(attId)) next.delete(attId); else next.add(attId);
      return next;
    });
  };
  const pickAllAuto = () => setPickedAutoIds(new Set(autoOvertime.map(r => r.attendanceId)));
  const clearAutoPick = () => setPickedAutoIds(new Set());

  const totalHoursFromForm = () =>
    (form.days || []).reduce((s, d) => s + (Number(d.hours) || 0), 0);

  const openCreate = () => {
    setEditingId(null);
    setEditingRow(null);
    setForm(emptyForm());
    setSelectedStaffId('');
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditingId(row.overtimeId);
    setEditingRow(row);
    setSelectedStaffId('');
    setForm({
      employeeName: row.employeeName || '',
      nationalId: row.nationalId || '',
      phone: row.phone || '',
      email: row.email || '',
      position: row.position || '',
      periodStart: (row.periodStart || '').slice(0, 10),
      periodEnd: (row.periodEnd || '').slice(0, 10),
      approvedBy: row.approvedBy || '',
      note: row.note || '',
      sanadDetails: row.sanadDetails || '',
      days: Array.isArray(row.days) && row.days.length ? row.days : [{ date: '', hours: '', task: '' }]
    });
    setShowModal(true);
  };

  // Duplicate an existing overtime as a new draft — carries over
  // days + approver + notes but clears the identity fields so the
  // admin picks (or types) the new employee. Save creates a fresh
  // row; the source is untouched.
  const openDuplicate = (row) => {
    setEditingId(null);
    setEditingRow(null);
    setSelectedStaffId('');
    setForm({
      // Identity — blank so admin picks a new employee from the
      // staff dropdown at the top of the modal (or types manually).
      employeeName: '', nationalId: '', phone: '', email: '', position: '',
      // Everything else copied from the source
      periodStart: (row.periodStart || '').slice(0, 10),
      periodEnd: (row.periodEnd || '').slice(0, 10),
      approvedBy: row.approvedBy || '',
      note: row.note || '',
      sanadDetails: row.sanadDetails || '',
      days: Array.isArray(row.days) && row.days.length
        ? row.days.map(d => ({
            date: d.date || '',
            startTime: d.startTime || '',
            endTime: d.endTime || '',
            hours: d.hours || '',
            task: d.task || ''
          }))
        : [{ date: '', startTime: '', endTime: '', hours: '', task: '' }]
    });
    setShowModal(true);
    toast.info(isRTL
      ? 'اختر موظفاً جديداً من القائمة أو أدخل بياناته يدوياً'
      : 'Pick a new employee from the dropdown or enter details manually');
  };

  const closeModal = () => { setShowModal(false); setEditingId(null); setForm(emptyForm()); setSelectedStaffId(''); };

  const setDay = (i, field, value) => {
    setForm(prev => {
      const days = [...(prev.days || [])];
      days[i] = { ...days[i], [field]: value };
      if (field === 'startTime' || field === 'endTime') {
        const auto = computeHoursFromTimes(days[i].startTime, days[i].endTime);
        if (auto !== '') days[i].hours = auto;
      }
      return { ...prev, days };
    });
  };
  const addDay = () => setForm(prev => ({ ...prev, days: [...(prev.days || []), { date: '', startTime: '', endTime: '', hours: '', task: '' }] }));
  const removeDay = (i) => setForm(prev => ({ ...prev, days: (prev.days || []).filter((_, idx) => idx !== i) }));

  const save = async ({ thenPrint = false } = {}) => {
    if (!form.employeeName.trim()) {
      toast.error(isRTL ? 'اسم الموظف مطلوب' : 'Employee name is required');
      return;
    }
    const cleanDays = (form.days || [])
      .filter(d => d.date || Number(d.hours) > 0 || (d.task || '').trim() || d.startTime || d.endTime)
      .map(d => ({
        date: d.date || null,
        startTime: d.startTime || '',
        endTime: d.endTime || '',
        hours: Number(d.hours) || 0,
        task: d.task || ''
      }));
    const payload = {
      ...form,
      days: cleanDays,
      totalHours: cleanDays.reduce((s, d) => s + d.hours, 0)
    };
    try {
      let savedRow = null;
      if (editingId) {
        const res = await api.put(`/overtime/${editingId}`, payload);
        savedRow = res.data;
        toast.success(isRTL
          ? (editingRow?.approvalStatus === 'approved'
              ? '✅ تم تحديث البيانات — يمكنك إعادة طباعة السند'
              : 'تم التحديث')
          : (editingRow?.approvalStatus === 'approved'
              ? '✅ Updated — you can reprint the sanad now'
              : 'Updated'));
      } else {
        const res = await api.post('/overtime', payload);
        savedRow = res.data;
        toast.success(isRTL ? 'تم الحفظ' : 'Saved');
      }
      // Auto-reprint the sanad when the admin explicitly clicked
      // "Save & Print" on an approved-request edit. Merge the fresh
      // form data onto the original row so the printout has the
      // preserved manager approval + the updated fields.
      if (thenPrint && editingRow?.approvalStatus === 'approved') {
        const forPrint = { ...editingRow, ...payload };
        setTimeout(() => { try { printOne(forPrint); } catch {} }, 300);
      }
      closeModal();
      load();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail
        || err.response?.data?.messageAr
        || err.response?.data?.message
        || (isRTL ? 'خطأ في الحفظ' : 'Save failed'));
    }
  };

  const remove = async (row) => {
    if (!window.confirm(isRTL ? 'حذف هذا الطلب نهائياً؟' : 'Delete this request permanently?')) return;
    try {
      await api.delete(`/overtime/${row.overtimeId}`);
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
      load();
    } catch {
      toast.error(isRTL ? 'خطأ في الحذف' : 'Delete failed');
    }
  };

  const fmtDate = (d) => {
    if (!d) return '';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d).slice(0, 10);
      return dt.toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', {
        calendar: 'gregory', day: '2-digit', month: 'long', year: 'numeric'
      });
    } catch { return String(d).slice(0, 10); }
  };

  const safe = (s) => String(s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

  // Print a saved overtime request on the same letterhead the
  // volunteer/worker "سند" uses, plus a second page listing all days
  // with their per-day task descriptions.
  const printOne = (row) => {
    const win = window.open('', '_blank', 'width=900,height=1200');
    if (!win) { alert(isRTL ? 'يرجى السماح بالنوافذ المنبثقة' : 'Please allow pop-ups'); return; }

    const dateStr = fmtDate(row.createdAt || new Date().toISOString());
    const rangeStr = row.periodStart || row.periodEnd
      ? `${fmtDate(row.periodStart)} ← ${fmtDate(row.periodEnd)}`
      : '';

    const arabicDayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const dayNameAr = (dateStr) => {
      if (!dateStr) return '';
      const dt = new Date(dateStr);
      return isNaN(dt.getTime()) ? '' : arabicDayNames[dt.getDay()];
    };

    const daysRows = (Array.isArray(row.days) ? row.days : []).map(d => {
      const timeRange = (d.startTime && d.endTime)
        ? `${safe(d.startTime)} — ${safe(d.endTime)}`
        : '—';
      return `
      <tr>
        <td>${safe(fmtDate(d.date))}</td>
        <td class="day-name">${safe(dayNameAr(d.date))}</td>
        <td class="time" dir="ltr">${timeRange}</td>
        <td class="hours">${d.hours > 0 ? Number(d.hours) + ' س' : '—'}</td>
        <td class="task">${safe(d.task || '')}</td>
      </tr>
    `;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>سند ساعات إضافية</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: 'Tajawal', 'Segoe UI', Tahoma, sans-serif; color: #1a1a1a; }
  .page { position: relative; width: 210mm; height: 297mm; overflow: hidden; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .page.receipt {
    background-image: url('${window.location.origin}/receipt-bg.png');
    background-size: 100% 100%; background-repeat: no-repeat;
  }
  /* Content band is stretched a bit — the 10-row table + 3-name
     signers row was drifting into the printed footer logos.
     Bottom margin is reduced from 12% to 14%, header from 18% to 16%. */
  .receipt-content { position: absolute; top: 16%; bottom: 14%; left: 14mm; right: 14mm; display: flex; flex-direction: column; }
  .receipt-title { text-align: center; font-size: 22pt; font-weight: 800; letter-spacing: 3px; margin: 0 0 5mm 0; color: #0f172a; }
  .receipt-table { width: 100%; border-collapse: collapse; margin-bottom: 3mm; }
  .receipt-table th, .receipt-table td { border: 1.2px solid #475569; padding: 1.9mm 4mm; font-size: 11.5pt; vertical-align: middle; }
  .receipt-table th { background: rgba(241,245,249,0.85); width: 38%; font-weight: 700; text-align: right; color: #0f172a; }
  .receipt-table td { background: rgba(255,255,255,0.7); font-weight: 600; color: #111827; }
  .signature-box { border: 1.2px solid #475569; padding: 2.8mm; margin-bottom: 3mm; background: rgba(255,255,255,0.7); }
  .signature-box h4 { margin: 0 0 2mm 0; font-size: 12pt; color: #0f172a; font-weight: 700; }
  .signature-box .sig-row { display: flex; gap: 8mm; font-size: 11pt; }
  .signature-box .sig-row > div { flex: 1; }
  .signature-box .sig-line { border-bottom: 1px solid #1f2937; height: 4.5mm; margin-top: 1mm; }
  .signers-row { margin-top: auto; display: flex; gap: 4mm; justify-content: space-between; padding-top: 3mm; border-top: 1.5px dashed #475569; }
  .signer { flex: 1; text-align: center; font-size: 10.5pt; display: flex; flex-direction: column; }
  .signer .signer-title { color: #475569; font-weight: 600; margin-bottom: 1.5mm; font-size: 10pt; }
  .signer .signature-space { height: 13mm; border-bottom: 1.5px solid #1f2937; margin: 0 4mm 1.5mm 4mm; }
  .signer .signer-name { font-weight: 700; color: #0f172a; font-size: 11pt; }
  /* Days page flows so long tables paginate instead of clipping. */
  .page.days { background: #fff; padding: 20mm 18mm; height: auto; min-height: 297mm; overflow: visible; page-break-before: always; page-break-after: auto; }
  .days-content { max-width: 174mm; margin: 0 auto; color: #0f172a; }
  .days-heading { text-align: center; margin-bottom: 12mm; }
  .days-title { font-size: 22pt; font-weight: 800; color: #6d28d9; margin-bottom: 4mm; }
  .days-sub { font-size: 13pt; font-weight: 700; color: #0f172a; }
  .days-table { width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 11pt; page-break-inside: auto; }
  .days-table thead { display: table-header-group; }
  .days-table thead th { background: #f5f3ff; color: #5b21b6; padding: 8px 10px; text-align: right; border: 1px solid #cbd5e1; font-weight: 800; }
  .days-table tbody tr { page-break-inside: avoid; page-break-after: auto; }
  .days-table tbody td { padding: 8px 10px; border: 1px solid #e2e8f0; vertical-align: top; text-align: right; }
  .days-table tbody td.time { text-align: center; color: #475569; font-weight: 700; letter-spacing: 0.5px; }
  .days-table tbody td.hours { text-align: center; color: #6d28d9; font-weight: 700; }
  .days-table tbody td.day-name { text-align: center; color: #5b21b6; font-weight: 700; }
  .days-table tbody td.task { color: #0f172a; line-height: 1.6; }
  .days-table tbody tr:nth-child(odd) td { background: #faf8ff; }
  .days-footer { display: flex; justify-content: space-between; margin-top: 8mm; font-size: 12pt; font-weight: 800; color: #5b21b6; border-top: 2px solid #6d28d9; padding-top: 4mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
  <div class="page receipt">
    <div class="receipt-content">
      <div class="receipt-title">سند ساعات إضافية</div>
      <table class="receipt-table">
        <tr><th>اسم الموظف</th><td>${safe(row.employeeName) || '&nbsp;'}</td></tr>
        <tr><th>المسمى الوظيفي</th><td>${safe(row.position) || '&nbsp;'}</td></tr>
        <tr><th>رقم الهوية</th><td dir="ltr" style="text-align:right">${safe(row.nationalId) || '&nbsp;'}</td></tr>
        <tr><th>الجوال</th><td dir="ltr" style="text-align:right">${safe(row.phone) || '&nbsp;'}</td></tr>
        <tr><th>البريد الإلكتروني</th><td dir="ltr" style="text-align:right">${safe(row.email) || '&nbsp;'}</td></tr>
        <tr><th>الفترة</th><td>${safe(rangeStr) || '&nbsp;'}</td></tr>
        <tr><th>إجمالي الساعات</th><td><strong>${Number(row.totalHours) || 0} ساعة</strong></td></tr>
        <tr><th>معتمد من</th><td>${safe(row.approvedBy) || '&nbsp;'}</td></tr>
        <tr><th>ملاحظة</th><td>${safe(row.note) || '&nbsp;'}</td></tr>
        <tr><th>تفاصيل السند</th><td style="white-space:pre-wrap;line-height:1.6">${safe(row.sanadDetails) || '&nbsp;'}</td></tr>
        <tr><th>تاريخ الإصدار</th><td>${safe(dateStr) || '&nbsp;'}</td></tr>
      </table>
      <div class="signature-box"><h4>إقرار الموظف</h4>
        <div class="sig-row"><div>الاسم<div class="sig-line"></div></div><div>التوقيع<div class="sig-line"></div></div></div>
      </div>
      <div class="signers-row">
        <div class="signer"><div class="signer-title">المسؤول التنفيذي للفاب لاب</div><div class="signature-space"></div><div class="signer-name">أ. زكي اللويم</div></div>
        <div class="signer"><div class="signer-title">الشؤون المالية والإدارية</div><div class="signature-space"></div><div class="signer-name">بيان سلطان السميح</div></div>
        <div class="signer"><div class="signer-title">&nbsp;</div><div class="signature-space"></div><div class="signer-name">إبراهيم صالح الرميح</div></div>
      </div>
    </div>
  </div>
  <div class="page days">
    <div class="days-content">
      <div class="days-heading">
        <div class="days-title">تفاصيل الساعات الإضافية</div>
        <div class="days-sub">${safe(row.employeeName)}${row.position ? ' — ' + safe(row.position) : ''}</div>
      </div>
      <table class="days-table">
        <thead><tr><th style="width:20%">التاريخ</th><th style="width:12%">اليوم</th><th style="width:16%">الوقت</th><th style="width:10%">الساعات</th><th>وصف المهمة</th></tr></thead>
        <tbody>${daysRows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8">لا توجد أيام مسجلة</td></tr>'}</tbody>
      </table>
      <div class="days-footer">
        <div>عدد الأيام: ${Array.isArray(row.days) ? row.days.length : 0}</div>
        <div>الإجمالي: ${Number(row.totalHours) || 0} ساعة</div>
      </div>
    </div>
  </div>
  <script>
    const bg = new Image();
    bg.src = '${window.location.origin}/receipt-bg.png';
    bg.onload = bg.onerror = () => { setTimeout(() => window.print(), 250); };
  </script>
</body></html>`;
    win.document.write(html);
    win.document.close();
  };

  const filtered = rows.filter(r => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return [r.employeeName, r.nationalId, r.phone, r.email, r.position]
      .some(f => String(f || '').toLowerCase().includes(q));
  });

  return (
    <div className="volunteers-content">
      {/* Auto-computed overtime from staff QR scans — sits above the
          manual overtime-request list. */}
      <AutoStaffOvertime />

      <div className="volunteers-header">
        <h2>{isRTL ? 'الساعات الإضافية اليدوية' : 'Manual Overtime Requests'}</h2>
        <div className="volunteers-actions">
          <button className="add-volunteer-btn" onClick={openCreate}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {isRTL ? 'طلب جديد' : 'New Request'}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isRTL ? 'بحث بالاسم أو الهوية أو الجوال...' : 'Search by name, ID, phone...'}
          style={{ width: '100%', maxWidth: 420, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-color, #e2e8f0)', background: 'var(--card-bg, #fff)', color: 'var(--text-primary, #0f172a)', fontFamily: 'inherit' }}
        />
      </div>

      {loading ? (
        <div className="empty-state">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
      ) : (
        <div className="volunteers-grid">
          {filtered.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              {isRTL ? 'لا توجد طلبات ساعات إضافية بعد' : 'No overtime requests yet'}
            </div>
          ) : filtered.map(row => {
            const status = row.approvalStatus || 'draft';
            const statusMeta = {
              draft:    { bg: '#f1f5f9', bd: '#cbd5e1', fg: '#475569', ar: 'مسودة',   en: 'Draft'    },
              pending:  { bg: '#fef3c7', bd: '#fde68a', fg: '#92400e', ar: 'قيد الاعتماد', en: 'Pending' },
              approved: { bg: '#dcfce7', bd: '#86efac', fg: '#166534', ar: 'معتمد',   en: 'Approved' },
              rejected: { bg: '#fee2e2', bd: '#fecaca', fg: '#991b1b', ar: 'مرفوض',   en: 'Rejected' }
            }[status] || { bg: '#f1f5f9', bd: '#cbd5e1', fg: '#475569', ar: status, en: status };
            const canPrint = status === 'approved';
            const canSend = status === 'draft' || status === 'rejected';
            return (
            <div key={row.overtimeId} className="volunteer-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 17, color: '#0f172a' }}>{row.employeeName}</div>
                  {row.position && <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{row.position}</div>}
                </div>
                <div style={{ background: 'linear-gradient(135deg, #6d28d9, #8b5cf6)', color: 'white', padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 800 }}>
                  {Number(row.totalHours) || 0} {isRTL ? 'ساعة' : 'hrs'}
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <span style={{
                  display: 'inline-block',
                  padding: '3px 10px',
                  borderRadius: 999,
                  fontSize: 11, fontWeight: 800,
                  background: statusMeta.bg,
                  border: `1px solid ${statusMeta.bd}`,
                  color: statusMeta.fg
                }}>
                  {isRTL ? statusMeta.ar : statusMeta.en}
                </span>
                {status === 'approved' && row.approvedBy && (
                  <span style={{ marginInlineStart: 8, fontSize: 11, color: '#64748b' }}>
                    · {isRTL ? 'اعتمده:' : 'by'} <b>{row.approvedBy}</b>
                  </span>
                )}
                {status === 'rejected' && row.managerNote && (
                  <span style={{ marginInlineStart: 8, fontSize: 11, color: '#991b1b' }} title={row.managerNote}>
                    · 📝 {row.managerNote.slice(0, 40)}{row.managerNote.length > 40 ? '…' : ''}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.9 }}>
                {row.nationalId && <div>🆔 <span dir="ltr">{row.nationalId}</span></div>}
                {row.phone && <div>📱 <span dir="ltr">{row.phone}</span></div>}
                {row.email && <div>✉️ <span dir="ltr">{row.email}</span></div>}
                {(row.periodStart || row.periodEnd) && (
                  <div>📅 {fmtDate(row.periodStart)} → {fmtDate(row.periodEnd)}</div>
                )}
                <div>🗂 {Array.isArray(row.days) ? row.days.length : 0} {isRTL ? 'يوم' : 'days'}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <button
                  onClick={() => canPrint ? printOne(row) : toast.info(isRTL ? 'يجب اعتماد الطلب أولاً' : 'Approval required before printing')}
                  disabled={!canPrint}
                  title={canPrint
                    ? (isRTL ? 'طباعة السند' : 'Print sanad')
                    : (isRTL ? 'يجب اعتماد الطلب أولاً' : 'Approval required before printing')}
                  style={{
                    flex: 1, minWidth: 120, padding: '8px 14px', borderRadius: 8, border: 'none',
                    background: canPrint ? 'linear-gradient(135deg, #6d28d9, #8b5cf6)' : '#e2e8f0',
                    color: canPrint ? 'white' : '#94a3b8',
                    cursor: canPrint ? 'pointer' : 'not-allowed',
                    fontWeight: 700, fontSize: 13, fontFamily: 'inherit'
                  }}
                >
                  🖨 {isRTL ? 'طباعة سند' : 'Print'}
                </button>
                {canSend && (
                  <button
                    onClick={() => openSendModal(row)}
                    title={isRTL ? 'إرسال للمدير للاعتماد' : 'Send to manager for approval'}
                    style={{
                      padding: '8px 14px', borderRadius: 8, border: '1px solid #fde68a',
                      background: '#fef3c7', color: '#92400e', cursor: 'pointer',
                      fontWeight: 800, fontSize: 13, fontFamily: 'inherit'
                    }}
                  >
                    📤 {isRTL ? 'إرسال للاعتماد' : 'Send for approval'}
                  </button>
                )}
                {status === 'pending' && (
                  <button
                    onClick={() => openSendModal(row)}
                    title={isRTL ? 'إعادة إرسال' : 'Resend email'}
                    style={{
                      padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1',
                      background: '#fff', color: '#475569', cursor: 'pointer',
                      fontWeight: 700, fontSize: 13, fontFamily: 'inherit'
                    }}
                  >
                    ↻ {isRTL ? 'إعادة إرسال' : 'Resend'}
                  </button>
                )}
                <button
                  onClick={() => openEdit(row)}
                  disabled={status === 'pending'}
                  title={status === 'pending'
                    ? (isRTL ? 'الطلب قيد اعتماد المدير — لا يمكن التعديل حالياً' : 'Awaiting manager approval — cannot edit right now')
                    : status === 'approved'
                      ? (isRTL ? 'تعديل البيانات ثم إعادة طباعة السند' : 'Edit info and reprint the sanad')
                      : (isRTL ? 'تعديل' : 'Edit')}
                  style={{
                    padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1',
                    background: '#fff', color: status === 'pending' ? '#94a3b8' : '#334155',
                    cursor: status === 'pending' ? 'not-allowed' : 'pointer',
                    fontWeight: 700, fontSize: 13, fontFamily: 'inherit'
                  }}
                >
                  ✏️ {isRTL ? 'تعديل' : 'Edit'}
                </button>
                <button
                  onClick={() => openDuplicate(row)}
                  title={isRTL ? 'تكرار الطلب لموظف آخر' : 'Duplicate request for another employee'}
                  style={{
                    padding: '8px 14px', borderRadius: 8, border: '1px solid #a7f3d0',
                    background: '#ecfdf5', color: '#065f46', cursor: 'pointer',
                    fontWeight: 700, fontSize: 13, fontFamily: 'inherit'
                  }}
                >
                  📋 {isRTL ? 'تكرار' : 'Duplicate'}
                </button>
                <button
                  onClick={() => remove(row)}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fee2e2', color: '#991b1b', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}
                >
                  🗑
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <div className="modal-overlay" onClick={closeModal}>
            <motion.div
              className="modal-content modern-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{ maxWidth: 780 }}
            >
              <div className="modern-modal-header" style={{ background: 'linear-gradient(135deg, #6d28d9 0%, #8b5cf6 100%)' }}>
                <div className="modal-header-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div className="modal-header-text">
                  <h2>{editingId ? (isRTL ? 'تعديل ساعات إضافية' : 'Edit Overtime') : (isRTL ? 'طلب ساعات إضافية' : 'Overtime Request')}</h2>
                  <p>{isRTL ? 'املأ بيانات الموظف والأيام والمهام المنجزة' : 'Fill in employee info, days, and completed tasks'}</p>
                </div>
                <button className="modal-close-modern" onClick={closeModal}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              <div className="modern-modal-body">
                {editingRow && (
                  <div style={{
                    marginBottom: 14,
                    padding: '12px 16px',
                    background: editingRow.approvalStatus === 'approved'
                      ? 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)'
                      : editingRow.approvalStatus === 'rejected'
                        ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'
                        : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    border: `1px solid ${editingRow.approvalStatus === 'approved' ? '#86efac' : editingRow.approvalStatus === 'rejected' ? '#fecaca' : '#e2e8f0'}`,
                    borderInlineStart: `4px solid ${editingRow.approvalStatus === 'approved' ? '#16a34a' : editingRow.approvalStatus === 'rejected' ? '#dc2626' : '#64748b'}`,
                    borderRadius: 10,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 700, marginBottom: 4 }}>
                        {isRTL ? '✏️ وضع التعديل:' : '✏️ Editing:'} {editingRow.employeeName}
                        {editingRow.position ? ` — ${editingRow.position}` : ''}
                      </div>
                      {editingRow.approvalStatus === 'approved' && (
                        <div style={{ fontSize: 12, color: '#166534', lineHeight: 1.6 }}>
                          📌 {isRTL
                            ? 'هذا طلب معتمد من المدير — التعديلات ستظهر عند إعادة طباعة السند، ولن يُعاد إرسال الطلب للمدير.'
                            : 'This request is already manager-approved — your edits will show on reprint, and the manager will not be re-notified.'}
                        </div>
                      )}
                      {editingRow.approvalStatus === 'rejected' && (
                        <div style={{ fontSize: 12, color: '#991b1b', lineHeight: 1.6 }}>
                          ⚠️ {isRTL
                            ? 'هذا طلب مرفوض — يمكنك تعديله ثم إعادة إرساله للمدير من قائمة الإجراءات.'
                            : 'This request was rejected — you can edit it and re-send for approval from the actions menu.'}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={closeModal}
                      style={{
                        padding: '6px 12px',
                        border: '1px solid #cbd5e1',
                        background: '#fff',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: 12,
                        fontFamily: 'inherit',
                        color: '#475569',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {isRTL ? '← إلغاء التعديل' : 'Cancel edit ×'}
                    </button>
                  </div>
                )}
                {!editingId && (
                  <div className="form-section" style={{ background: 'linear-gradient(135deg, #faf5ff 0%, #ede9fe 100%)', border: '1px solid #ddd6fe', borderRadius: 10, padding: 14 }}>
                    <div className="section-header">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      <span>{isRTL ? 'اختر من موظفي فاب لاب' : 'Pick from FabLab staff'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <select
                        value={selectedStaffId}
                        onChange={e => pickStaff(e.target.value)}
                        className="modern-input-field"
                        style={{ flex: '1 1 260px', minWidth: 220 }}
                      >
                        <option value="">— {isRTL ? 'موظف جديد (املأ الحقول يدوياً)' : 'New employee (fill fields manually)'} —</option>
                        {staffList.map(s => (
                          <option key={s.staffId} value={s.staffId}>
                            {s.name}{s.position ? ` — ${s.position}` : ''}
                          </option>
                        ))}
                      </select>
                      {selectedStaffId && (
                        <button
                          type="button"
                          onClick={() => pickStaff('')}
                          style={{ padding: '8px 14px', border: '1px solid #cbd5e1', background: '#fff', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', color: '#334155', fontSize: 13 }}
                        >
                          {isRTL ? 'مسح الاختيار' : 'Clear'}
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#6d28d9', marginTop: 8, fontWeight: 600 }}>
                      {isRTL
                        ? 'اختر موظفاً لتعبئة اسمه وهويته وجواله وبريده تلقائياً، أو اترك الحقل واملأ البيانات يدوياً.'
                        : 'Selecting a staff member auto-fills name, ID, phone, and email. Leave blank to enter a new person.'}
                    </div>
                  </div>
                )}
                <div className="form-section">
                  <div className="section-header">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <span>{isRTL ? 'بيانات الموظف' : 'Employee info'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'الاسم الكامل *' : 'Full name *'}</label>
                      <input className="modern-input-field" value={form.employeeName} onChange={e => setForm({ ...form, employeeName: e.target.value })} />
                    </div>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'المسمى الوظيفي' : 'Position'}</label>
                      <input className="modern-input-field" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
                    </div>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'رقم الهوية' : 'National ID'}</label>
                      <input className="modern-input-field" dir="ltr" value={form.nationalId} onChange={e => setForm({ ...form, nationalId: e.target.value })} />
                    </div>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'الجوال' : 'Phone'}</label>
                      <input className="modern-input-field" dir="ltr" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                    </div>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
                      <input className="modern-input-field" dir="ltr" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span>{isRTL ? 'الفترة والملاحظات' : 'Period & notes'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'من تاريخ' : 'Start date'}</label>
                      <input className="modern-input-field" type="date" value={form.periodStart} onChange={e => setForm({ ...form, periodStart: e.target.value })} />
                    </div>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'إلى تاريخ' : 'End date'}</label>
                      <input className="modern-input-field" type="date" value={form.periodEnd} onChange={e => setForm({ ...form, periodEnd: e.target.value })} />
                    </div>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'معتمد من *' : 'Approved by *'}</label>
                      <select
                        className="modern-input-field"
                        value={form.approvedBy}
                        onChange={e => setForm({ ...form, approvedBy: e.target.value })}
                      >
                        <option value="">— {isRTL ? 'اختر المعتمد' : 'Select approver'} —</option>
                        {APPROVERS.map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-group modern-input" style={{ marginTop: 10 }}>
                    <label>{isRTL ? 'ملاحظة' : 'Note'}</label>
                    <textarea className="modern-input-field" rows={2} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
                  </div>
                  <div className="form-group modern-input" style={{ marginTop: 10 }}>
                    <label>
                      {isRTL ? 'تفاصيل السند' : 'Sanad details'}
                      <span style={{ marginInlineStart: 6, fontSize: 11, color: '#8b5cf6', fontWeight: 600 }}>
                        📄 {isRTL ? 'يُطبع على السند' : 'printed on the sanad'}
                      </span>
                    </label>
                    <textarea
                      className="modern-input-field"
                      rows={3}
                      value={form.sanadDetails}
                      onChange={e => setForm({ ...form, sanadDetails: e.target.value })}
                      placeholder={isRTL
                        ? 'صف الغرض من الساعات الإضافية أو أي تفاصيل تريد أن تظهر على السند...'
                        : 'Describe the purpose of the overtime or anything else you want printed on the sanad...'}
                    />
                  </div>
                </div>

                {/* Auto-overtime importer — only shown when a staff
                    member from the FabLab roster is picked. Lets admin
                    pull the recorded overtime days straight into the
                    manual days grid instead of retyping. */}
                {selectedStaffId && (
                  <div className="form-section" style={{
                    background: 'linear-gradient(135deg, #ecfdf5 0%, #eff6ff 100%)',
                    border: '1px solid #a7f3d0',
                    borderRadius: 10, padding: 14, marginBottom: 12
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 800, color: '#065f46', fontSize: 14 }}>
                          ⏱ {isRTL ? 'الساعات الإضافية المسجّلة تلقائياً' : 'Auto-recorded overtime'}
                        </div>
                        <div style={{ fontSize: 12, color: '#047857', marginTop: 2 }}>
                          {isRTL
                            ? 'اختر الأيام لإضافتها للسند — الوقت والساعات ستُملأ تلقائياً.'
                            : 'Pick days to add to the sanad — time and hours are filled in automatically.'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {autoOvertime.length > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={pickAllAuto}
                              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #a7f3d0', background: '#fff', color: '#065f46', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700 }}
                            >{isRTL ? 'تحديد الكل' : 'Select all'}</button>
                            <button
                              type="button"
                              onClick={clearAutoPick}
                              disabled={pickedAutoIds.size === 0}
                              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: pickedAutoIds.size ? '#334155' : '#94a3b8', cursor: pickedAutoIds.size ? 'pointer' : 'not-allowed', fontFamily: 'inherit', fontSize: 12, fontWeight: 700 }}
                            >{isRTL ? 'إلغاء' : 'Clear'}</button>
                            <button
                              type="button"
                              onClick={importAutoPicked}
                              disabled={pickedAutoIds.size === 0}
                              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: pickedAutoIds.size ? '#059669' : '#e2e8f0', color: pickedAutoIds.size ? '#fff' : '#94a3b8', cursor: pickedAutoIds.size ? 'pointer' : 'not-allowed', fontFamily: 'inherit', fontSize: 12, fontWeight: 800 }}
                            >
                              ⤵ {isRTL
                                ? `استيراد المحدد (${pickedAutoIds.size})`
                                : `Import selected (${pickedAutoIds.size})`}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {autoLoading ? (
                      <div style={{ padding: 12, color: '#047857', fontSize: 13 }}>{isRTL ? 'جارٍ التحميل...' : 'Loading...'}</div>
                    ) : autoOvertime.length === 0 ? (
                      <div style={{ padding: 12, color: '#64748b', fontSize: 13, textAlign: 'center' }}>
                        {isRTL ? 'لا توجد ساعات إضافية مسجّلة لهذا الموظف بعد.' : 'No recorded overtime for this employee yet.'}
                      </div>
                    ) : (
                      <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid #a7f3d0', borderRadius: 8, background: '#fff' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: '#ecfdf5' }}>
                              <th style={{ padding: 6, width: 30 }}></th>
                              <th style={{ padding: 6, textAlign: 'right', color: '#065f46' }}>{isRTL ? 'التاريخ' : 'Date'}</th>
                              <th style={{ padding: 6, textAlign: 'center', color: '#065f46' }}>{isRTL ? 'الدخول' : 'In'}</th>
                              <th style={{ padding: 6, textAlign: 'center', color: '#065f46' }}>{isRTL ? 'الخروج' : 'Out'}</th>
                              <th style={{ padding: 6, textAlign: 'center', color: '#065f46' }}>{isRTL ? 'الإضافية' : 'OT'}</th>
                              <th style={{ padding: 6, textAlign: 'right', color: '#065f46' }}>{isRTL ? 'السبب' : 'Reason'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {autoOvertime.map(r => {
                              const picked = pickedAutoIds.has(r.attendanceId);
                              const otMin = r.overtimeMinutes;
                              const fmt = (iso2) => {
                                if (!iso2) return '—';
                                const d = new Date(iso2);
                                if (isNaN(d.getTime())) return '—';
                                const pad = (n) => String(n).padStart(2, '0');
                                return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
                              };
                              return (
                                <tr
                                  key={r.attendanceId}
                                  onClick={() => toggleAutoPick(r.attendanceId)}
                                  style={{ cursor: 'pointer', background: picked ? '#dcfce7' : 'transparent' }}
                                >
                                  <td style={{ padding: 6, textAlign: 'center' }}>
                                    <input type="checkbox" checked={picked} readOnly style={{ accentColor: '#059669' }} />
                                  </td>
                                  <td style={{ padding: 6, fontFamily: 'JetBrains Mono, monospace' }}>{String(r.date).slice(0, 10)}</td>
                                  <td style={{ padding: 6, textAlign: 'center', fontFamily: 'JetBrains Mono, monospace' }} dir="ltr">{fmt(r.checkInAt)}</td>
                                  <td style={{ padding: 6, textAlign: 'center', fontFamily: 'JetBrains Mono, monospace' }} dir="ltr">{fmt(r.checkOutAt)}</td>
                                  <td style={{ padding: 6, textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', color: '#b91c1c', fontWeight: 700 }} dir="ltr">
                                    {Math.floor(otMin / 60)}:{String(otMin % 60).padStart(2, '0')}
                                  </td>
                                  <td style={{ padding: 6, fontSize: 11, color: '#64748b' }}>{r.reason || '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                <div className="form-section">
                  <div className="section-header" style={{ justifyContent: 'space-between', display: 'flex' }}>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                      {isRTL ? 'الأيام والمهام' : 'Days & tasks'}
                    </span>
                    <span style={{ fontWeight: 800, color: '#6d28d9' }}>
                      {isRTL ? 'الإجمالي' : 'Total'}: {totalHoursFromForm()} {isRTL ? 'ساعة' : 'hrs'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '150px 105px 105px 90px 1fr 40px', gap: 8, fontSize: 12, fontWeight: 700, color: '#6d28d9', padding: '0 2px' }}>
                      <span>{isRTL ? 'التاريخ' : 'Date'}</span>
                      <span>{isRTL ? 'من الساعة' : 'From'}</span>
                      <span>{isRTL ? 'إلى الساعة' : 'To'}</span>
                      <span>{isRTL ? 'الساعات' : 'Hours'}</span>
                      <span>{isRTL ? 'وصف المهمة' : 'Task description'}</span>
                      <span></span>
                    </div>
                    {(form.days || []).map((d, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '150px 105px 105px 90px 1fr 40px', gap: 8, alignItems: 'center' }}>
                        <input className="modern-input-field" type="date" value={d.date || ''} onChange={e => setDay(i, 'date', e.target.value)} />
                        <input className="modern-input-field" type="time" value={d.startTime || ''} onChange={e => setDay(i, 'startTime', e.target.value)} />
                        <input className="modern-input-field" type="time" value={d.endTime || ''} onChange={e => setDay(i, 'endTime', e.target.value)} />
                        <input className="modern-input-field" type="number" min="0" step="0.5" placeholder={isRTL ? 'ساعات' : 'hours'} value={d.hours || ''} onChange={e => setDay(i, 'hours', e.target.value)} title={isRTL ? 'تُحسب تلقائياً من "من" و"إلى"، ويمكن التعديل يدوياً' : 'Auto-filled from From/To, can be edited manually'} />
                        <input className="modern-input-field" placeholder={isRTL ? 'وصف المهمة' : 'Task description'} value={d.task || ''} onChange={e => setDay(i, 'task', e.target.value)} />
                        <button onClick={() => removeDay(i)} style={{ padding: 6, border: '1px solid #fecaca', borderRadius: 6, background: '#fee2e2', color: '#991b1b', cursor: 'pointer', fontFamily: 'inherit' }} title={isRTL ? 'حذف' : 'Remove'}>×</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={addDay} style={{ marginTop: 10, padding: '8px 14px', borderRadius: 8, border: '1.5px dashed #a78bfa', background: '#faf8ff', color: '#6d28d9', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' }}>
                    + {isRTL ? 'إضافة يوم' : 'Add day'}
                  </button>
                </div>
              </div>

              <div className="modern-modal-footer">
                <button onClick={closeModal} style={{ padding: '10px 20px', border: '1px solid #cbd5e1', background: '#fff', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', color: '#334155' }}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button onClick={() => save()} style={{ padding: '10px 24px', border: 'none', background: 'linear-gradient(135deg, #6d28d9, #8b5cf6)', color: 'white', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontFamily: 'inherit' }}>
                  {editingId ? (isRTL ? 'حفظ التعديل' : 'Save changes') : (isRTL ? 'إنشاء' : 'Create')}
                </button>
                {editingRow?.approvalStatus === 'approved' && (
                  <button
                    onClick={() => save({ thenPrint: true })}
                    style={{
                      padding: '10px 24px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
                      color: 'white',
                      borderRadius: 10,
                      cursor: 'pointer',
                      fontWeight: 800,
                      fontFamily: 'inherit',
                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
                    }}
                    title={isRTL ? 'حفظ التعديلات وإعادة طباعة السند مباشرة' : 'Save changes and reprint the sanad immediately'}
                  >
                    {isRTL ? '💾 حفظ وطباعة السند' : '💾 Save & Print sanad'}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Send-for-approval modal */}
      {sendTarget && (
        <div className="modal-overlay" onClick={closeSendModal}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 460, background: '#fff', borderRadius: 14, padding: 20 }}
          >
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#92400e', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
                {isRTL ? 'إرسال للمدير' : 'Send to Manager'}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                {sendTarget.employeeName}
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                {Number(sendTarget.totalHours || 0).toFixed(2)} {isRTL ? 'ساعة' : 'hrs'} · {(sendTarget.days || []).length} {isRTL ? 'يوم' : 'days'}
              </div>
            </div>
            {(() => {
              const presets = APPROVER_EMAILS.filter(p => p.email);
              const isPreset = presets.some(p => p.email === sendEmail);
              return (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                    {isRTL ? 'اختر المدير' : 'Pick the manager'}
                  </div>
                  <select
                    value={isPreset ? sendEmail : (sendEmail === '' ? '' : '__custom__')}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '__custom__') setSendEmail(' '); // placeholder so the input shows and user types
                      else setSendEmail(val);
                    }}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 8,
                      border: '1.5px solid #fde68a', fontFamily: 'inherit', fontSize: 14,
                      background: '#fff', direction: 'rtl'
                    }}
                  >
                    <option value="">— {isRTL ? 'اختر من القائمة' : 'Select from list'} —</option>
                    {presets.map(p => (
                      <option key={p.email} value={p.email}>
                        {p.name} — {p.email}
                      </option>
                    ))}
                    <option value="__custom__">— {isRTL ? 'بريد آخر (يدوي)' : 'Custom email'} —</option>
                  </select>

                  {/* Text input — always shown once the admin picks
                      either a preset (so they can see / tweak it) or
                      the custom option (so they can type freely). */}
                  {sendEmail !== '' && (
                    <input
                      type="email"
                      value={sendEmail.trim()}
                      onChange={(e) => setSendEmail(e.target.value)}
                      dir="ltr"
                      placeholder="manager@fablabahsa.org"
                      autoFocus={!isPreset}
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: 8,
                        border: '1.5px solid #fde68a', fontFamily: 'inherit', fontSize: 14,
                        marginTop: 8,
                        background: isPreset ? '#fefce8' : '#fff'
                      }}
                    />
                  )}

                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                    {isRTL
                      ? 'سيتم إرسال بريد يحتوي على رابط للاعتماد أو الرفض مباشرةً.'
                      : 'An email with approve/reject links will be sent.'}
                  </div>
                </div>
              );
            })()}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={closeSendModal}
                disabled={sending}
                style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={submitSend}
                disabled={sending}
                style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#92400e', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800 }}
              >
                {sending ? '…' : (isRTL ? '📤 إرسال' : '📤 Send')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OvertimeManagement;
