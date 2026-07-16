import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import api from '../../config/api';
import '../Mawhba/Mawhba.css';

// Overtime (ساعات إضافية) — track admin-submitted overtime requests
// for FabLab employees, archive them, and print each one on the same
// letterhead the volunteer "سند" receipt uses (so accounting sees one
// consistent document style).
const emptyForm = () => ({
  employeeName: '',
  nationalId: '',
  phone: '',
  email: '',
  position: '',
  periodStart: '',
  periodEnd: '',
  note: '',
  days: [{ date: '', hours: '', task: '' }]
});

const OvertimeManagement = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [search, setSearch] = useState('');
  // Existing FabLab staff — pulled on first modal open so admin can
  // pick a known employee instead of retyping their info. If the
  // person isn't in the list, admin leaves picker on "new" and types
  // the fields manually.
  const [staffList, setStaffList] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');

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
  };

  const totalHoursFromForm = () =>
    (form.days || []).reduce((s, d) => s + (Number(d.hours) || 0), 0);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setSelectedStaffId('');
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditingId(row.overtimeId);
    setSelectedStaffId('');
    setForm({
      employeeName: row.employeeName || '',
      nationalId: row.nationalId || '',
      phone: row.phone || '',
      email: row.email || '',
      position: row.position || '',
      periodStart: (row.periodStart || '').slice(0, 10),
      periodEnd: (row.periodEnd || '').slice(0, 10),
      note: row.note || '',
      days: Array.isArray(row.days) && row.days.length ? row.days : [{ date: '', hours: '', task: '' }]
    });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingId(null); setForm(emptyForm()); setSelectedStaffId(''); };

  const setDay = (i, field, value) => {
    setForm(prev => {
      const days = [...(prev.days || [])];
      days[i] = { ...days[i], [field]: value };
      return { ...prev, days };
    });
  };
  const addDay = () => setForm(prev => ({ ...prev, days: [...(prev.days || []), { date: '', hours: '', task: '' }] }));
  const removeDay = (i) => setForm(prev => ({ ...prev, days: (prev.days || []).filter((_, idx) => idx !== i) }));

  const save = async () => {
    if (!form.employeeName.trim()) {
      toast.error(isRTL ? 'اسم الموظف مطلوب' : 'Employee name is required');
      return;
    }
    const cleanDays = (form.days || [])
      .filter(d => d.date || Number(d.hours) > 0 || (d.task || '').trim())
      .map(d => ({ date: d.date || null, hours: Number(d.hours) || 0, task: d.task || '' }));
    const payload = {
      ...form,
      days: cleanDays,
      totalHours: cleanDays.reduce((s, d) => s + d.hours, 0)
    };
    try {
      if (editingId) {
        await api.put(`/overtime/${editingId}`, payload);
        toast.success(isRTL ? 'تم التحديث' : 'Updated');
      } else {
        await api.post('/overtime', payload);
        toast.success(isRTL ? 'تم الحفظ' : 'Saved');
      }
      closeModal();
      load();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || (isRTL ? 'خطأ في الحفظ' : 'Save failed'));
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
      ? `${fmtDate(row.periodStart)} → ${fmtDate(row.periodEnd)}`
      : '';

    const daysRows = (Array.isArray(row.days) ? row.days : []).map(d => `
      <tr>
        <td>${safe(fmtDate(d.date))}</td>
        <td class="hours">${d.hours > 0 ? Number(d.hours) + ' س' : '—'}</td>
        <td class="task">${safe(d.task || '')}</td>
      </tr>
    `).join('');

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
  .receipt-content { position: absolute; top: 18%; bottom: 12%; left: 14mm; right: 14mm; display: flex; flex-direction: column; }
  .receipt-title { text-align: center; font-size: 24pt; font-weight: 800; letter-spacing: 3px; margin: 0 0 8mm 0; color: #0f172a; }
  .receipt-table { width: 100%; border-collapse: collapse; margin-bottom: 4mm; }
  .receipt-table th, .receipt-table td { border: 1.5px solid #475569; padding: 2.6mm 4mm; font-size: 12.5pt; vertical-align: middle; }
  .receipt-table th { background: rgba(241,245,249,0.85); width: 38%; font-weight: 700; text-align: right; color: #0f172a; }
  .receipt-table td { background: rgba(255,255,255,0.7); font-weight: 600; color: #111827; }
  .signature-box { border: 1.5px solid #475569; padding: 3.5mm; margin-bottom: 4mm; background: rgba(255,255,255,0.7); }
  .signature-box h4 { margin: 0 0 3mm 0; font-size: 13pt; color: #0f172a; font-weight: 700; }
  .signature-box .sig-row { display: flex; gap: 8mm; font-size: 12pt; }
  .signature-box .sig-row > div { flex: 1; }
  .signature-box .sig-line { border-bottom: 1px solid #1f2937; height: 5.5mm; margin-top: 1.5mm; }
  .signers-row { margin-top: auto; display: flex; gap: 4mm; justify-content: space-between; padding-top: 4mm; border-top: 1.5px dashed #475569; }
  .signer { flex: 1; text-align: center; font-size: 11pt; display: flex; flex-direction: column; }
  .signer .signer-title { color: #475569; font-weight: 600; margin-bottom: 2mm; }
  .signer .signature-space { height: 18mm; border-bottom: 1.5px solid #1f2937; margin: 0 6mm 2mm 6mm; }
  .signer .signer-name { font-weight: 700; color: #0f172a; font-size: 12pt; }
  .page.days { background: #fff; padding: 20mm 18mm; }
  .days-content { max-width: 174mm; margin: 0 auto; color: #0f172a; }
  .days-heading { text-align: center; margin-bottom: 12mm; }
  .days-title { font-size: 22pt; font-weight: 800; color: #6d28d9; margin-bottom: 4mm; }
  .days-sub { font-size: 13pt; font-weight: 700; color: #0f172a; }
  .days-table { width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 11pt; }
  .days-table thead th { background: #f5f3ff; color: #5b21b6; padding: 8px 10px; text-align: right; border: 1px solid #cbd5e1; font-weight: 800; }
  .days-table tbody td { padding: 8px 10px; border: 1px solid #e2e8f0; vertical-align: top; text-align: right; }
  .days-table tbody td.hours { text-align: center; color: #6d28d9; font-weight: 700; }
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
        <tr><th>ملاحظة</th><td>${safe(row.note) || '&nbsp;'}</td></tr>
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
        <thead><tr><th style="width:34%">التاريخ</th><th style="width:14%">الساعات</th><th>وصف المهمة</th></tr></thead>
        <tbody>${daysRows || '<tr><td colspan="3" style="text-align:center;color:#94a3b8">لا توجد أيام مسجلة</td></tr>'}</tbody>
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
      <div className="volunteers-header">
        <h2>{isRTL ? 'الساعات الإضافية' : 'Overtime'}</h2>
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
          ) : filtered.map(row => (
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
                  onClick={() => printOne(row)}
                  style={{ flex: 1, minWidth: 120, padding: '8px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #6d28d9, #8b5cf6)', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}
                >
                  🖨 {isRTL ? 'طباعة سند' : 'Print'}
                </button>
                <button
                  onClick={() => openEdit(row)}
                  style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}
                >
                  ✏️ {isRTL ? 'تعديل' : 'Edit'}
                </button>
                <button
                  onClick={() => remove(row)}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fee2e2', color: '#991b1b', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
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
                  </div>
                  <div className="form-group modern-input" style={{ marginTop: 10 }}>
                    <label>{isRTL ? 'ملاحظة' : 'Note'}</label>
                    <textarea className="modern-input-field" rows={2} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
                  </div>
                </div>

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
                    {(form.days || []).map((d, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '160px 100px 1fr 40px', gap: 8, alignItems: 'center' }}>
                        <input className="modern-input-field" type="date" value={d.date || ''} onChange={e => setDay(i, 'date', e.target.value)} />
                        <input className="modern-input-field" type="number" min="0" step="0.5" placeholder={isRTL ? 'ساعات' : 'hours'} value={d.hours || ''} onChange={e => setDay(i, 'hours', e.target.value)} />
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
                <button onClick={save} style={{ padding: '10px 24px', border: 'none', background: 'linear-gradient(135deg, #6d28d9, #8b5cf6)', color: 'white', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontFamily: 'inherit' }}>
                  {editingId ? (isRTL ? 'حفظ التعديل' : 'Save changes') : (isRTL ? 'إنشاء' : 'Create')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OvertimeManagement;
