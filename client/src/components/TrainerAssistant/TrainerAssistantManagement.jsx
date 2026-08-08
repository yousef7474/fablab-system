import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import api from '../../config/api';
import '../Mawhba/Mawhba.css';

// Predefined FabLab sections used as the skills picker. Admin can
// still add "other" skills freely via a custom-tag input.
const FABLAB_SECTIONS = [
  'Electronics and Programming',
  'CNC Laser',
  'CNC Wood',
  '3D',
  'Robotic and AI',
  "Kid's Club",
  'Vinyl Cutting'
];

// Post-chance evaluation criteria, each rated 0–5. `rating` on the
// server is the average of the filled criteria. Keep keys in sync
// with server/controllers/trainerAssistantController.js.
const CRITERIA = [
  { key: 'punctuality', labelAr: 'الالتزام بالمواعيد', labelEn: 'Punctuality' },
  { key: 'technical',   labelAr: 'الكفاءة التقنية',    labelEn: 'Technical proficiency' },
  { key: 'delivery',    labelAr: 'جودة الشرح والتوصيل', labelEn: 'Explanation & delivery' },
  { key: 'engagement',  labelAr: 'تفاعل المتدربين',    labelEn: 'Trainee engagement' },
  { key: 'preparation', labelAr: 'التحضير والتنظيم',   labelEn: 'Preparation & organization' }
];

// Skills are stored on the server as TEXT for flexibility. On modern
// rows it's a JSON-stringified array; legacy rows may hold plain
// text, in which case we treat the whole thing as one skill.
const parseSkills = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch { /* legacy plain-text */ }
  return String(raw).split(',').map(s => s.trim()).filter(Boolean);
};

const Stars = ({ value, onChange, size = 22 }) => {
  const v = Number(value) || 0;
  return (
    <div style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onClick={() => onChange && onChange(i === v ? 0 : i)}
          style={{ background: 'none', border: 'none', cursor: onChange ? 'pointer' : 'default', padding: 0, fontSize: size, lineHeight: 1, color: i <= v ? '#f59e0b' : '#d1d5db' }}
          title={`${i}/5`}
        >
          ★
        </button>
      ))}
    </div>
  );
};

const emptyTrainer = () => ({
  name: '', phone: '', nationalId: '', email: '', age: '',
  educationalDegree: '', skills: [], performanceRating: 0, notes: ''
});
const emptyAssignment = () => ({
  chanceName: '', destination: '',
  startAt: '', endAt: '',
  criteria: {}, notes: ''
});
const emptyEmail = () => ({ subject: '', message: '' });

const contactLink = (kind, value) => {
  if (!value) return null;
  const clean = String(value).replace(/[^0-9+]/g, '');
  if (kind === 'call') return `tel:${clean}`;
  if (kind === 'whatsapp') return `https://wa.me/${clean.replace(/^\+/, '')}`;
  return null;
};

const avgOfCriteria = (criteria) => {
  const vals = Object.values(criteria || {}).map(v => Number(v)).filter(v => v > 0);
  if (!vals.length) return 0;
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
};

// datetime-local expects "YYYY-MM-DDTHH:mm". Server returns full ISO
// strings; we slice to that format.
const toDtLocal = (v) => {
  if (!v) return '';
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ''; }
};

const TrainerAssistantManagement = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [showTrainerModal, setShowTrainerModal] = useState(false);
  const [editingTrainerId, setEditingTrainerId] = useState(null);
  const [trainerForm, setTrainerForm] = useState(emptyTrainer());
  const [customSkill, setCustomSkill] = useState('');

  const [showAssignmentsFor, setShowAssignmentsFor] = useState(null);
  const [assignmentForm, setAssignmentForm] = useState(emptyAssignment());
  const [editingAssignmentId, setEditingAssignmentId] = useState(null);

  const [emailTarget, setEmailTarget] = useState(null);
  const [emailForm, setEmailForm] = useState(emptyEmail());
  const [sending, setSending] = useState(false);

  // Attendance history modal — mirrors the volunteer log flow. Loads
  // TrainerAssistantAttendance rows for the picked trainer and lets
  // admin add / edit check-out / delete rows.
  const [attTrainer, setAttTrainer] = useState(null);
  const [attRecords, setAttRecords] = useState([]);
  const [attLoading, setAttLoading] = useState(false);
  const [editingCheckoutId, setEditingCheckoutId] = useState(null);
  const [editingCheckoutValue, setEditingCheckoutValue] = useState('');
  const [savingCheckout, setSavingCheckout] = useState(false);
  const [showAddManual, setShowAddManual] = useState(false);
  const [manualForm, setManualForm] = useState({ date: '', checkInAt: '', checkOutAt: '' });
  const [savingManual, setSavingManual] = useState(false);

  const openAttendance = async (t) => {
    setAttTrainer(t);
    setAttRecords([]);
    setAttLoading(true);
    setShowAddManual(false);
    try {
      const { data } = await api.get(`/trainer-assistants/${t.trainerId}/attendance`);
      setAttRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'تعذر تحميل سجل الحضور' : 'Failed to load attendance');
    } finally {
      setAttLoading(false);
    }
  };

  const fmtHms = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  const durationMin = (rec) => {
    if (!rec.checkInAt || !rec.checkOutAt) return null;
    return Math.max(0, Math.round((new Date(rec.checkOutAt) - new Date(rec.checkInAt)) / 60000));
  };

  const beginEditCheckout = (rec) => {
    setEditingCheckoutId(rec.attendanceId);
    if (rec.checkOutAt) {
      const d = new Date(rec.checkOutAt);
      setEditingCheckoutValue(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    } else if (rec.checkInAt) {
      const d = new Date(new Date(rec.checkInAt).getTime() + 60 * 60 * 1000);
      setEditingCheckoutValue(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    } else {
      setEditingCheckoutValue('18:00');
    }
  };
  const cancelEditCheckout = () => { setEditingCheckoutId(null); setEditingCheckoutValue(''); };
  const saveCheckoutTime = async (rec) => {
    if (!editingCheckoutValue) return toast.error(isRTL ? 'أدخل وقت الخروج' : 'Enter time');
    setSavingCheckout(true);
    try {
      const { data } = await api.patch(
        `/trainer-assistants/attendance/${rec.attendanceId}/checkout`,
        { checkOutAt: editingCheckoutValue }
      );
      setAttRecords(prev => prev.map(r =>
        r.attendanceId === rec.attendanceId ? { ...r, checkOutAt: data?.record?.checkOutAt || null } : r
      ));
      toast.success(isRTL ? 'تم الحفظ' : 'Saved');
      cancelEditCheckout();
    } catch (err) {
      const msg = err?.response?.data?.messageAr || err?.response?.data?.message;
      toast.error(msg || (isRTL ? 'فشل الحفظ' : 'Save failed'));
    } finally {
      setSavingCheckout(false);
    }
  };
  const clearCheckoutRow = async (rec) => {
    if (!window.confirm(isRTL ? `حذف تسجيل الخروج لتاريخ ${rec.date}؟` : `Clear check-out for ${rec.date}?`)) return;
    try {
      await api.patch(`/trainer-assistants/attendance/${rec.attendanceId}/checkout`);
      setAttRecords(prev => prev.map(r =>
        r.attendanceId === rec.attendanceId ? { ...r, checkOutAt: null } : r
      ));
      toast.success(isRTL ? 'تم حذف تسجيل الخروج' : 'Cleared');
    } catch (err) {
      const msg = err?.response?.data?.messageAr || err?.response?.data?.message;
      toast.error(msg || (isRTL ? 'فشل الحذف' : 'Clear failed'));
    }
  };
  const deleteAttendanceRow = async (rec) => {
    if (!window.confirm(isRTL ? `حذف سجل ${rec.date}؟` : `Delete record for ${rec.date}?`)) return;
    try {
      await api.delete(`/trainer-assistants/attendance/${rec.attendanceId}`);
      setAttRecords(prev => prev.filter(r => r.attendanceId !== rec.attendanceId));
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
    } catch {
      toast.error(isRTL ? 'فشل الحذف' : 'Delete failed');
    }
  };
  const submitManualAttendance = async () => {
    if (!attTrainer) return;
    if (!manualForm.date) return toast.error(isRTL ? 'أدخل التاريخ' : 'Enter date');
    if (!manualForm.checkInAt && !manualForm.checkOutAt) {
      return toast.error(isRTL ? 'أدخل وقت الدخول أو الخروج على الأقل' : 'Enter at least check-in or check-out');
    }
    setSavingManual(true);
    try {
      const { data } = await api.post('/trainer-assistants/attendance', {
        trainerId: attTrainer.trainerId,
        date: manualForm.date,
        checkInAt: manualForm.checkInAt || undefined,
        checkOutAt: manualForm.checkOutAt || undefined
      });
      setAttRecords(prev => {
        const next = [data.record, ...prev];
        next.sort((a, b) => (a.date < b.date ? 1 : -1));
        return next;
      });
      toast.success(isRTL ? 'تمت الإضافة' : 'Added');
      setManualForm({ date: '', checkInAt: '', checkOutAt: '' });
      setShowAddManual(false);
    } catch (err) {
      const msg = err?.response?.data?.messageAr || err?.response?.data?.message;
      toast.error(msg || (isRTL ? 'فشل الإضافة' : 'Add failed'));
    } finally {
      setSavingManual(false);
    }
  };

  // Volunteer-style ID card — 72×102mm, orange header/gradient, photo
  // (or initial), type badge, info rows, QR, dual-logo footer. Same
  // shape and CSS keys as VolunteerManagement.buildVolunteerCardHTML
  // so the visual identity across scannable IDs stays consistent.
  const buildTrainerCardStyles = () => `
    @page { size: A4 portrait; margin: 10mm 8mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f1f5f9; }
    body { padding: 6mm 0; }
    .print-note {
      font-size: 12px; color: #475569; background: white;
      border: 1px dashed #cbd5e1; border-radius: 8px;
      padding: 8px 14px; margin: 0 auto 8mm; text-align: center; max-width: 120mm;
    }
    .page {
      display: grid;
      grid-template-columns: 72mm 72mm;
      grid-auto-rows: 102mm;
      column-gap: 6mm; row-gap: 6mm;
      justify-content: center; align-content: start;
      width: 100%;
    }
    .page + .page { page-break-before: always; }
    .id-card {
      width: 72mm; height: 102mm;
      background: linear-gradient(180deg, #ffffff 0%, #ecfdf5 100%);
      border: 0.45mm dashed #475569;
      overflow: hidden; position: relative;
      display: flex; flex-direction: column;
      color: #1a1a2e; box-sizing: border-box;
    }
    .card-header {
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      padding: 2.5mm 3.5mm; text-align: center;
    }
    .card-title { color: white; font-size: 9pt; font-weight: 700; line-height: 1.15; }
    .card-subtitle { color: rgba(255,255,255,0.88); font-size: 6.5pt; margin-top: 0.6mm; }
    .card-body {
      flex: 1; padding: 2.5mm 3mm 0;
      display: flex; flex-direction: column; align-items: center; gap: 1.4mm;
    }
    .user-photo {
      width: 22mm; height: 26mm;
      background: linear-gradient(135deg, #a7f3d0, #6ee7b7);
      border-radius: 2mm; display: flex; align-items: center; justify-content: center;
      color: #047857; font-weight: bold;
      border: 0.6mm solid #059669;
      overflow: hidden; flex-shrink: 0;
    }
    .user-photo .initials { font-size: 18pt; font-weight: bold; color: #047857; }
    .user-name {
      font-size: 10.5pt; font-weight: 800; color: #1a1a2e;
      text-align: center; line-height: 1.15; max-height: 10mm; overflow: hidden;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }
    .user-type-badge {
      display: inline-block;
      background: linear-gradient(135deg, #059669, #047857);
      color: white; font-size: 7.5pt; padding: 0.6mm 3.5mm;
      border-radius: 999px; font-weight: 700;
    }
    .info-section { width: 100%; display: flex; flex-direction: column; gap: 0.6mm; margin-top: 1mm; }
    .info-row {
      display: flex; justify-content: space-between; align-items: center;
      font-size: 7.2pt; padding: 0.6mm 0; border-bottom: 0.2mm dotted #d4d4d8;
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { font-weight: 700; color: #555; }
    .info-value {
      color: #1a1a2e; font-weight: 600; text-align: ${isRTL ? 'left' : 'right'};
      max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .card-qr { display: flex; align-items: center; justify-content: center; margin-top: 1mm; }
    .card-qr img {
      width: 26mm; height: 26mm; background: white; padding: 0.8mm;
      border-radius: 1mm; box-shadow: 0 0 0 0.3mm #059669 inset;
    }
    .card-footer {
      background: #ffffff; padding: 1.5mm 3mm;
      display: flex; align-items: center; justify-content: space-between;
      border-top: 0.3mm solid #e0e0e0;
    }
    .card-footer .logo { height: 7mm; width: auto; flex-shrink: 0; }
    .card-footer .qr-label { font-size: 6pt; color: #047857; font-weight: 700; }
    .decorative-stripe {
      position: absolute; top: 40%; ${isRTL ? 'right' : 'left'}: 0;
      width: 1mm; height: 25%;
      background: linear-gradient(to bottom, transparent, #059669, transparent);
    }
    @media print {
      html, body { background: white; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { padding: 0; }
      .print-note { display: none; }
      .id-card { box-shadow: none; break-inside: avoid; }
    }
  `;

  const buildTrainerCardHTML = (trainer, qrDataUrl) => {
    const na = isRTL ? 'غير محدد' : 'N/A';
    const name = trainer.name || na;
    const qrImg = qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" />` : '';
    return `
      <div class="id-card">
        <div class="card-header">
          <div class="card-title">${isRTL ? 'بطاقة مدرب معاون فاب لاب الأحساء' : 'FABLAB Al-Ahsa Assistant Trainer Card'}</div>
          <div class="card-subtitle">${isRTL ? 'مؤسسة عبدالمنعم الراشد الإنسانية' : 'Abdulmonem Al-Rashed Foundation'}</div>
        </div>
        <div class="card-body">
          <div class="user-photo">
            <span class="initials">${name.charAt(0).toUpperCase()}</span>
          </div>
          <div class="user-name">${name}</div>
          <div class="user-type-badge">${isRTL ? 'مدرب معاون' : 'Assistant Trainer'}</div>
          <div class="info-section">
            <div class="info-row">
              <span class="info-label">${isRTL ? 'رقم الهوية' : 'National ID'}</span>
              <span class="info-value">${trainer.nationalId || na}</span>
            </div>
            <div class="info-row">
              <span class="info-label">${isRTL ? 'الهاتف' : 'Phone'}</span>
              <span class="info-value">${trainer.phone || na}</span>
            </div>
          </div>
          <div class="card-qr">${qrImg}</div>
        </div>
        <div class="decorative-stripe"></div>
        <div class="card-footer">
          <img src="/found.png" alt="Foundation" class="logo">
          <span class="qr-label">${isRTL ? 'رمز الحضور' : 'Attendance QR'}</span>
          <img src="/fablab.png" alt="FABLAB" class="logo">
        </div>
      </div>
    `;
  };

  const openTrainerPrintWindow = (cardsHtml) => {
    const win = window.open('', '_blank');
    if (!win) {
      toast.error(isRTL ? 'فشل فتح نافذة الطباعة' : 'Popup blocked');
      return;
    }
    const html = `
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${isRTL ? 'ar' : 'en'}">
      <head>
        <meta charset="UTF-8">
        <title>${isRTL ? 'بطاقات المدربين المعاونين' : 'Assistant Trainer ID Cards'}</title>
        <style>${buildTrainerCardStyles()}</style>
      </head>
      <body>
        <div class="print-note">
          ${isRTL ? 'حجم البطاقة 72×102 ملم — اقطع حسب الخط المتقطع' : 'Card size 72×102 mm — cut along the dashed line'}
        </div>
        ${cardsHtml}
      </body>
      </html>
    `;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  const printTrainerCard = async (t) => {
    if (!t.nationalId) {
      return toast.error(isRTL ? 'يجب إضافة رقم الهوية أولاً لتوليد QR' : 'Add national ID first');
    }
    try {
      const { data } = await api.get(`/trainer-assistants/${t.trainerId}/card`);
      const qrDataUrl = data?.qrDataUrl;
      if (!qrDataUrl) throw new Error('No QR');
      // Wrap in the same .page grid as volunteer cards so the 72×102mm
      // sizing + margins line up if user prints. A single card is fine
      // in the grid — it just sits top-left.
      const cardHtml = `<div class="page">${buildTrainerCardHTML(t, qrDataUrl)}</div>`;
      openTrainerPrintWindow(cardHtml);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'فشل توليد البطاقة' : 'Failed to generate card');
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/trainer-assistants');
      setTrainers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'تعذر تحميل المدربين' : 'Failed to load trainers');
    } finally {
      setLoading(false);
    }
  }, [isRTL]);

  useEffect(() => { load(); }, [load]);

  // ---------- Trainer CRUD ----------

  const openCreateTrainer = () => {
    setEditingTrainerId(null);
    setTrainerForm(emptyTrainer());
    setCustomSkill('');
    setShowTrainerModal(true);
  };
  const openEditTrainer = (t) => {
    setEditingTrainerId(t.trainerId);
    setTrainerForm({
      name: t.name || '', phone: t.phone || '', nationalId: t.nationalId || '',
      email: t.email || '', age: t.age || '', educationalDegree: t.educationalDegree || '',
      skills: parseSkills(t.skills),
      performanceRating: Number(t.performanceRating) || 0,
      notes: t.notes || ''
    });
    setCustomSkill('');
    setShowTrainerModal(true);
  };
  const closeTrainerModal = () => {
    setShowTrainerModal(false); setEditingTrainerId(null);
    setTrainerForm(emptyTrainer()); setCustomSkill('');
  };

  const toggleSkill = (name) => {
    setTrainerForm(prev => {
      const has = (prev.skills || []).includes(name);
      const next = has
        ? prev.skills.filter(s => s !== name)
        : [...(prev.skills || []), name];
      return { ...prev, skills: next };
    });
  };
  const addCustomSkill = () => {
    const s = customSkill.trim();
    if (!s) return;
    if ((trainerForm.skills || []).includes(s)) { setCustomSkill(''); return; }
    setTrainerForm(prev => ({ ...prev, skills: [...(prev.skills || []), s] }));
    setCustomSkill('');
  };

  const saveTrainer = async () => {
    if (!trainerForm.name.trim()) {
      toast.error(isRTL ? 'الاسم مطلوب' : 'Name is required');
      return;
    }
    const payload = {
      ...trainerForm,
      skills: JSON.stringify(trainerForm.skills || [])
    };
    if (payload.age === '') payload.age = null;
    try {
      if (editingTrainerId) {
        await api.put(`/trainer-assistants/${editingTrainerId}`, payload);
        toast.success(isRTL ? 'تم التحديث' : 'Updated');
      } else {
        await api.post('/trainer-assistants', payload);
        toast.success(isRTL ? 'تم الإضافة' : 'Added');
      }
      closeTrainerModal();
      load();
    } catch (err) {
      const messageAr = err.response?.data?.messageAr;
      const message = err.response?.data?.message || (isRTL ? 'خطأ' : 'Error');
      toast.error(isRTL && messageAr ? messageAr : message);
    }
  };

  const deleteTrainer = async (t) => {
    if (!window.confirm(isRTL ? `حذف "${t.name}" مع كل الفرص المرتبطة؟` : `Delete "${t.name}" and all linked chances?`)) return;
    try {
      await api.delete(`/trainer-assistants/${t.trainerId}`);
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
      load();
    } catch {
      toast.error(isRTL ? 'خطأ' : 'Error');
    }
  };

  // ---------- Email ----------

  const openEmail = (t) => {
    if (!t.email) {
      toast.error(isRTL ? 'لا يوجد بريد إلكتروني لهذا المدرب' : 'This trainer has no email');
      return;
    }
    setEmailTarget(t);
    setEmailForm({
      subject: (isRTL ? 'رسالة من فاب لاب' : 'Message from FABLAB'),
      message: ''
    });
  };
  const closeEmail = () => { setEmailTarget(null); setEmailForm(emptyEmail()); };

  const sendEmail = async () => {
    if (!emailTarget) return;
    if (!emailForm.message.trim()) {
      toast.error(isRTL ? 'الرسالة مطلوبة' : 'Message is required');
      return;
    }
    setSending(true);
    try {
      await api.post(`/trainer-assistants/${emailTarget.trainerId}/send-email`, emailForm);
      toast.success(isRTL ? 'تم إرسال البريد الإلكتروني' : 'Email sent');
      closeEmail();
    } catch (err) {
      const messageAr = err.response?.data?.messageAr;
      const message = err.response?.data?.message || (isRTL ? 'فشل الإرسال' : 'Send failed');
      toast.error(isRTL && messageAr ? messageAr : message);
    } finally {
      setSending(false);
    }
  };

  // ---------- Assignments (chances) ----------

  const openAssignments = (t) => {
    setShowAssignmentsFor(t);
    setAssignmentForm(emptyAssignment());
    setEditingAssignmentId(null);
  };
  const closeAssignments = () => {
    setShowAssignmentsFor(null); setEditingAssignmentId(null);
    setAssignmentForm(emptyAssignment());
  };

  const setCrit = (key, value) => setAssignmentForm(prev => ({
    ...prev,
    criteria: { ...(prev.criteria || {}), [key]: value }
  }));

  const saveAssignment = async () => {
    if (!showAssignmentsFor) return;
    if (!assignmentForm.chanceName.trim()) {
      toast.error(isRTL ? 'اسم الفرصة مطلوب' : 'Chance name required');
      return;
    }
    const payload = { ...assignmentForm };
    if (!payload.startAt) payload.startAt = null;
    if (!payload.endAt) payload.endAt = null;
    if (payload.criteria && !Object.keys(payload.criteria).length) payload.criteria = null;
    try {
      if (editingAssignmentId) {
        await api.put(`/trainer-assistants/assignments/${editingAssignmentId}`, payload);
        toast.success(isRTL ? 'تم التحديث' : 'Updated');
      } else {
        await api.post(`/trainer-assistants/${showAssignmentsFor.trainerId}/assignments`, payload);
        toast.success(isRTL ? 'تم التسجيل' : 'Recorded');
      }
      setAssignmentForm(emptyAssignment());
      setEditingAssignmentId(null);
      await load();
      const fresh = (await api.get(`/trainer-assistants/${showAssignmentsFor.trainerId}`)).data;
      setShowAssignmentsFor(fresh);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'خطأ في الحفظ' : 'Save failed');
    }
  };

  const editAssignment = (a) => {
    setEditingAssignmentId(a.assignmentId);
    setAssignmentForm({
      chanceName: a.chanceName || '',
      destination: a.destination || '',
      startAt: toDtLocal(a.startAt || (a.chanceDate ? `${a.chanceDate}T09:00` : '')),
      endAt: toDtLocal(a.endAt || ''),
      criteria: a.criteria || {},
      notes: a.notes || ''
    });
  };

  // Open a browser print window with a completion certificate for a
  // single chance. Structurally identical to the volunteer / intern
  // certificate templates (same header, decor circles, ribbon, stat
  // cards, footer) but repalletted in purple/pink to match the
  // trainer section and using chance-specific copy (name, place, dates).
  const handlePrintChanceCertificate = (trainer, assignment) => {
    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) {
      toast.error(isRTL ? 'يرجى السماح بالنوافذ المنبثقة' : 'Please allow pop-ups');
      return;
    }
    const safe = (s) => String(s || '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmtCertDate = (v) => {
      if (!v) return '';
      try {
        const d = new Date(v);
        if (isNaN(d.getTime())) return String(v).slice(0, 10);
        const pad = (n) => String(n).padStart(2, '0');
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
      } catch { return String(v).slice(0, 10); }
    };
    const startDate = fmtCertDate(assignment.startAt || assignment.chanceDate);
    const endDate   = fmtCertDate(assignment.endAt   || assignment.chanceDate);
    const certId = 'TRN-' + (assignment.assignmentId?.substring(0, 8).toUpperCase() || Date.now());

    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <title>شهادة تدريب - ${safe(trainer.name)}</title>
        <style>
          @page { size: A4 landscape; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { width: 297mm; height: 210mm; overflow: hidden; }
          body {
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            background: linear-gradient(135deg, #6d28d9 0%, #a855f7 50%, #ec4899 100%);
            display: flex; align-items: center; justify-content: center;
            padding: 10mm;
          }
          .certificate {
            width: 277mm; height: 190mm;
            background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
            border-radius: 16px;
            position: relative; overflow: hidden;
            box-shadow: 0 30px 60px rgba(0,0,0,0.3);
          }
          .certificate::before {
            content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
            border: 6px solid transparent;
            border-image: linear-gradient(135deg, #6d28d9, #a855f7, #ec4899, #f472b6, #6d28d9) 1;
            border-radius: 16px; pointer-events: none;
          }
          .decor-circle { position: absolute; border-radius: 50%; opacity: 0.1; }
          .decor-circle.c1 { width: 200px; height: 200px; background: linear-gradient(135deg, #6d28d9, #a855f7); top: -50px; right: -50px; }
          .decor-circle.c2 { width: 150px; height: 150px; background: linear-gradient(135deg, #ec4899, #f472b6); bottom: -30px; left: -30px; }
          .decor-circle.c3 { width: 100px; height: 100px; background: linear-gradient(135deg, #f59e0b, #fbbf24); top: 50%; left: 20px; transform: translateY(-50%); }
          .decor-circle.c4 { width: 80px; height: 80px; background: linear-gradient(135deg, #22d3ee, #06b6d4); bottom: 60px; right: 40px; }
          .certificate-inner {
            padding: 20mm 25mm; height: 100%;
            display: flex; flex-direction: column;
            position: relative; z-index: 1;
          }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12mm; }
          .logo-container { display: flex; align-items: center; gap: 15px; }
          .logo { height: 85px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.15)); }
          .header-center { text-align: center; flex: 1; padding: 0 20px; }
          .org-name { font-size: 11px; color: #64748b; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 5px; }
          .cert-title {
            font-size: 44px; font-weight: 800;
            background: linear-gradient(135deg, #6d28d9, #a855f7);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            background-clip: text; margin-bottom: 4px;
          }
          .cert-subtitle { font-size: 16px; color: #475569; font-weight: 500; letter-spacing: 3px; }
          .divider {
            height: 4px;
            background: linear-gradient(90deg, #6d28d9, #a855f7, #ec4899, #f472b6, #f59e0b);
            border-radius: 2px; margin-bottom: 10mm;
          }
          .main-content { text-align: center; flex: 1; display: flex; flex-direction: column; justify-content: center; }
          .presents-text { font-size: 14px; color: #64748b; margin-bottom: 8px; }
          .trainer-name {
            font-size: 42px; font-weight: 700; color: #1e293b;
            margin-bottom: 8px; position: relative; display: inline-block;
          }
          .trainer-name::after {
            content: ''; position: absolute; bottom: -4px; left: 50%;
            transform: translateX(-50%); width: 80%; height: 4px;
            background: linear-gradient(90deg, #6d28d9, #a855f7, #ec4899);
            border-radius: 2px;
          }
          .appreciation-text { font-size: 15px; line-height: 1.8; color: #475569; max-width: 620px; margin: 15px auto; }
          .highlight { color: #6d28d9; font-weight: 700; font-size: 17px; }
          .stats-container { display: flex; justify-content: center; gap: 24px; margin: 12px 0; }
          .stat-card {
            background: linear-gradient(135deg, #6d28d9, #a855f7);
            color: white; padding: 12px 26px; border-radius: 12px;
            text-align: center; box-shadow: 0 8px 20px rgba(109, 40, 217, 0.3);
            min-width: 130px;
          }
          .stat-card.alt { background: linear-gradient(135deg, #ec4899, #f472b6); box-shadow: 0 8px 20px rgba(236, 72, 153, 0.3); }
          .stat-card.gold { background: linear-gradient(135deg, #f59e0b, #fbbf24); box-shadow: 0 8px 20px rgba(245, 158, 11, 0.3); }
          .stat-value { font-size: 20px; font-weight: 700; }
          .stat-label { font-size: 10px; opacity: 0.9; margin-top: 2px; }
          .thank-you { font-size: 13px; color: #64748b; margin-top: 10px; font-style: italic; }
          .footer-section { display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; padding-top: 10mm; }
          .signature-box { text-align: center; min-width: 200px; }
          .signature-line { width: 180px; height: 2px; background: linear-gradient(90deg, #6d28d9, #a855f7); margin: 0 auto 8px; }
          .signature-name { font-size: 16px; font-weight: 700; color: #1e293b; }
          .signature-role { font-size: 11px; color: #64748b; margin-top: 3px; }
          .cert-info { text-align: left; }
          .cert-id {
            font-family: 'Courier New', monospace; font-size: 10px; color: #94a3b8;
            background: linear-gradient(135deg, #f5f3ff, #ede9fe);
            padding: 6px 14px; border-radius: 20px; display: inline-block;
          }
          .cert-date { font-size: 10px; color: #94a3b8; margin-top: 5px; }
          .org-footer { text-align: center; flex: 1; }
          .org-footer-text { font-size: 10px; color: #94a3b8; }
          .ribbon {
            position: absolute; top: 25px; left: -35px;
            width: 150px; height: 30px;
            background: linear-gradient(135deg, #ec4899, #db2777);
            transform: rotate(-45deg);
            display: flex; align-items: center; justify-content: center;
            color: white; font-size: 10px; font-weight: 600;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
          }
          @media print {
            html, body {
              width: 297mm; height: 210mm;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            body { padding: 0; background: linear-gradient(135deg, #6d28d9 0%, #a855f7 50%, #ec4899 100%) !important; }
            .certificate { box-shadow: none; margin: auto; }
            .cert-title { -webkit-text-fill-color: #6d28d9; color: #6d28d9; }
          }
        </style>
      </head>
      <body>
        <div class="certificate">
          <div class="decor-circle c1"></div>
          <div class="decor-circle c2"></div>
          <div class="decor-circle c3"></div>
          <div class="decor-circle c4"></div>
          <div class="ribbon">مدرب معاون</div>

          <div class="certificate-inner">
            <div class="header">
              <div class="logo-container">
                <img src="/found.png" alt="Foundation" class="logo" />
              </div>
              <div class="header-center">
                <div class="org-name">مؤسسة عبدالمنعم الراشد الإنسانية</div>
                <div class="cert-title">شهادة تدريب</div>
                <div class="cert-subtitle">TRAINING CERTIFICATE</div>
              </div>
              <div class="logo-container">
                <img src="/fablab.png" alt="FABLAB" class="logo" />
              </div>
            </div>

            <div class="divider"></div>

            <div class="main-content">
              <div class="presents-text">تشهد إدارة فاب لاب الأحساء بأن</div>
              <div class="trainer-name">${safe(trainer.name)}</div>

              <div class="appreciation-text">
                قد أسهم بصفته مدرباً معاوناً في تنفيذ الفرصة التدريبية
                <span class="highlight">"${safe(assignment.chanceName)}"</span>
                ${assignment.destination ? `<br/>بمقر <span class="highlight">${safe(assignment.destination)}</span>` : ''}
                <br/>
                ونثمّن جهوده وتفانيه في نقل المعرفة والمهارات إلى المتدربين
              </div>

              <div class="stats-container">
                ${assignment.destination ? `
                <div class="stat-card">
                  <div class="stat-value">${safe(assignment.destination)}</div>
                  <div class="stat-label">المكان</div>
                </div>` : ''}
                <div class="stat-card alt">
                  <div class="stat-value">${startDate || '—'}</div>
                  <div class="stat-label">تاريخ البداية</div>
                </div>
                <div class="stat-card gold">
                  <div class="stat-value">${endDate || startDate || '—'}</div>
                  <div class="stat-label">تاريخ النهاية</div>
                </div>
              </div>

              <div class="thank-you">
                شكراً لعطائك ودورك في تدريب وتأهيل شباب فاب لاب
              </div>
            </div>

            <div class="footer-section">
              <div class="cert-info">
                <div class="cert-id">${certId}</div>
                <div class="cert-date">${new Date().toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { calendar: 'gregory' })}</div>
              </div>

              <div class="org-footer">
                <div class="org-footer-text">
                  فاب لاب الأحساء - مختبر التصنيع الرقمي
                  <br/>
                  FABLAB Al-Ahsa - Digital Fabrication Laboratory
                </div>
              </div>

              <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-name">أ. زكي اللويم</div>
                <div class="signature-role">المسؤول التنفيذي لفاب لاب الأحساء</div>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  const deleteAssignment = async (a) => {
    if (!window.confirm(isRTL ? 'حذف هذه الفرصة؟' : 'Delete this chance?')) return;
    try {
      await api.delete(`/trainer-assistants/assignments/${a.assignmentId}`);
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
      await load();
      if (showAssignmentsFor) {
        const fresh = (await api.get(`/trainer-assistants/${showAssignmentsFor.trainerId}`)).data;
        setShowAssignmentsFor(fresh);
      }
    } catch {
      toast.error(isRTL ? 'خطأ' : 'Error');
    }
  };

  // ---------- Formatting ----------

  const fmtDate = (d, withTime = false) => {
    if (!d) return '';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d).slice(0, 10);
      const opts = { calendar: 'gregory', day: '2-digit', month: 'short', year: 'numeric' };
      if (withTime) { opts.hour = '2-digit'; opts.minute = '2-digit'; opts.hour12 = false; }
      return dt.toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', opts);
    } catch { return String(d).slice(0, 10); }
  };

  const fmtRange = (a) => {
    if (a.startAt || a.endAt) {
      if (a.startAt && a.endAt) return `${fmtDate(a.startAt, true)} → ${fmtDate(a.endAt, true)}`;
      return fmtDate(a.startAt || a.endAt, true);
    }
    if (a.chanceDate) return fmtDate(a.chanceDate);
    return '';
  };

  const filtered = trainers.filter(t => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const skillsStr = parseSkills(t.skills).join(' ').toLowerCase();
    return [t.name, t.phone, t.email, t.nationalId, t.educationalDegree]
      .some(f => String(f || '').toLowerCase().includes(q)) || skillsStr.includes(q);
  });

  return (
    <div className="volunteers-content">
      <div className="volunteers-header">
        <h2>{isRTL ? 'مدرب معاون' : 'Assistant Trainers'}</h2>
        <div className="volunteers-actions">
          <button className="add-volunteer-btn" onClick={openCreateTrainer}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {isRTL ? 'إضافة مدرب' : 'Add Trainer'}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isRTL ? 'بحث بالاسم أو الجوال أو المهارات...' : 'Search by name, phone, skills...'}
          style={{ width: '100%', maxWidth: 420, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-color, #e2e8f0)', background: 'var(--card-bg, #fff)', color: 'var(--text-primary, #0f172a)', fontFamily: 'inherit' }}
        />
      </div>

      {loading ? (
        <div className="empty-state">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
      ) : (
        <div className="volunteers-grid">
          {filtered.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              {isRTL ? 'لم تتم إضافة أي مدرب معاون بعد' : 'No trainers added yet'}
            </div>
          ) : filtered.map(t => {
            const skills = parseSkills(t.skills);
            const assignmentCount = Array.isArray(t.assignments) ? t.assignments.length : 0;
            return (
              <div key={t.trainerId} className="volunteer-card">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 17, color: '#0f172a' }}>{t.name}</div>
                    {t.educationalDegree && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{t.educationalDegree}</div>}
                  </div>
                  <Stars value={t.performanceRating} onChange={null} size={18} />
                </div>
                <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.9 }}>
                  {t.phone && <div>📱 <span dir="ltr">{t.phone}</span></div>}
                  {t.email && <div>✉️ <span dir="ltr">{t.email}</span></div>}
                  {t.age && <div>🎂 {t.age}</div>}
                  {skills.length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {skills.map(s => (
                        <span key={s} style={{ background: '#faf5ff', color: '#5b21b6', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, border: '1px solid #e9d5ff' }}>{s}</span>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: 6 }}>🎯 {assignmentCount} {isRTL ? 'فرصة تدريبية' : 'chances'}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => openAssignments(t)}
                    style={{ flex: 1, minWidth: 130, padding: '8px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #6d28d9, #8b5cf6)', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}
                  >
                    🎯 {isRTL ? 'الفرص' : 'Chances'}
                  </button>
                  {t.phone && (
                    <>
                      <a href={contactLink('call', t.phone)} title={isRTL ? 'اتصال' : 'Call'} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #bbf7d0', background: '#dcfce7', color: '#166534', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>📞</a>
                      <a href={contactLink('whatsapp', t.phone)} target="_blank" rel="noreferrer" title="WhatsApp" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #bbf7d0', background: '#dcfce7', color: '#166534', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>💬</a>
                    </>
                  )}
                  {t.email && (
                    <button onClick={() => openEmail(t)} title="Email" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #bfdbfe', background: '#dbeafe', color: '#1e40af', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>✉️</button>
                  )}
                  <button
                    onClick={() => openAttendance(t)}
                    title={isRTL ? 'سجل الحضور' : 'Attendance history'}
                    style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #86efac', background: '#dcfce7', color: '#166534', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}
                  >📅</button>
                  <button
                    onClick={() => printTrainerCard(t)}
                    title={isRTL ? 'طباعة بطاقة QR' : 'Print QR card'}
                    disabled={!t.nationalId}
                    style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #7dd3fc', background: t.nationalId ? '#e0f2fe' : '#f1f5f9', color: t.nationalId ? '#0369a1' : '#94a3b8', cursor: t.nationalId ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}
                  >🪪</button>
                  <button onClick={() => openEditTrainer(t)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>✏️</button>
                  <button onClick={() => deleteTrainer(t)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fee2e2', color: '#991b1b', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Attendance history modal */}
      {attTrainer && (
        <div className="modal-overlay" onClick={() => setAttTrainer(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 900, background: '#fff', borderRadius: 14, padding: 20, maxHeight: '90vh', overflow: 'auto' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 20, color: '#065f46' }}>
                📅 {isRTL ? `سجل حضور — ${attTrainer.name}` : `Attendance — ${attTrainer.name}`}
              </h2>
              <button
                onClick={() => setAttTrainer(null)}
                style={{ background: 'none', border: 'none', fontSize: 22, color: '#94a3b8', cursor: 'pointer' }}
              >×</button>
            </div>

            {/* Summary tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, margin: '10px 0 12px' }}>
              <div style={{ padding: 10, borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: 11, color: '#166534', fontWeight: 700 }}>{isRTL ? 'إجمالي الأيام' : 'Total days'}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#065f46' }}>{attRecords.length}</div>
              </div>
              <div style={{ padding: 10, borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: 11, color: '#166534', fontWeight: 700 }}>{isRTL ? 'مكتملة' : 'Completed'}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#065f46' }}>{attRecords.filter(r => r.checkInAt && r.checkOutAt).length}</div>
              </div>
              <div style={{ padding: 10, borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a' }}>
                <div style={{ fontSize: 11, color: '#92400e', fontWeight: 700 }}>{isRTL ? 'لم يخرج بعد' : 'Still in'}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#78350f' }}>{attRecords.filter(r => r.checkInAt && !r.checkOutAt).length}</div>
              </div>
              <div style={{ padding: 10, borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: 11, color: '#1e40af', fontWeight: 700 }}>{isRTL ? 'إجمالي الوقت' : 'Total time'}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1e3a8a' }}>
                  {(() => {
                    const total = attRecords.reduce((s, r) => s + (durationMin(r) || 0), 0);
                    return `${Math.floor(total / 60)}h ${total % 60}m`;
                  })()}
                </div>
              </div>
            </div>

            {/* Manual add */}
            <div style={{ margin: '0 0 12px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {!showAddManual ? (
                <button
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10);
                    setManualForm({ date: today, checkInAt: '', checkOutAt: '' });
                    setShowAddManual(true);
                  }}
                  style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
                >
                  + {isRTL ? 'إضافة سجل يدوي' : 'Add manual record'}
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end', padding: 10, borderRadius: 8, background: '#f0fdf4', border: '1.5px solid #86efac', width: '100%' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                    <span style={{ fontWeight: 700, color: '#166534' }}>{isRTL ? 'التاريخ' : 'Date'}</span>
                    <input type="date" value={manualForm.date} onChange={(e) => setManualForm(f => ({ ...f, date: e.target.value }))} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #86efac' }} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                    <span style={{ fontWeight: 700, color: '#166534' }}>{isRTL ? 'وقت الدخول' : 'Check-in'}</span>
                    <input type="time" value={manualForm.checkInAt} onChange={(e) => setManualForm(f => ({ ...f, checkInAt: e.target.value }))} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #86efac', width: 110 }} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                    <span style={{ fontWeight: 700, color: '#166534' }}>{isRTL ? 'وقت الخروج' : 'Check-out'}</span>
                    <input type="time" value={manualForm.checkOutAt} onChange={(e) => setManualForm(f => ({ ...f, checkOutAt: e.target.value }))} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #86efac', width: 110 }} />
                  </label>
                  <button onClick={submitManualAttendance} disabled={savingManual} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                    {savingManual ? '…' : (isRTL ? 'حفظ' : 'Save')}
                  </button>
                  <button onClick={() => setShowAddManual(false)} disabled={savingManual} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', cursor: 'pointer', fontWeight: 700 }}>
                    {isRTL ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              )}
            </div>

            {/* Table */}
            {attLoading ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>{isRTL ? 'جارٍ التحميل...' : 'Loading...'}</div>
            ) : attRecords.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>{isRTL ? 'لا يوجد سجل حضور بعد' : 'No records yet'}</div>
            ) : (
              <div style={{ overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: 10, textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 700 }}>{isRTL ? 'التاريخ' : 'Date'}</th>
                      <th style={{ padding: 10, textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 700 }}>{isRTL ? 'الدخول' : 'Check-in'}</th>
                      <th style={{ padding: 10, textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 700 }}>{isRTL ? 'الخروج' : 'Check-out'}</th>
                      <th style={{ padding: 10, textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 700 }}>{isRTL ? 'المدة' : 'Duration'}</th>
                      <th style={{ padding: 10, textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 700 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {attRecords.map(r => {
                      const dur = durationMin(r);
                      const completed = r.checkInAt && r.checkOutAt;
                      const isEditing = editingCheckoutId === r.attendanceId;
                      return (
                        <tr key={r.attendanceId}>
                          <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9', fontFamily: 'JetBrains Mono, monospace' }}>{r.date}</td>
                          <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9', fontFamily: 'JetBrains Mono, monospace' }}>{fmtHms(r.checkInAt)}</td>
                          <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9', fontFamily: 'JetBrains Mono, monospace' }}>
                            {isEditing ? (
                              <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                                <input
                                  type="time"
                                  value={editingCheckoutValue}
                                  onChange={(e) => setEditingCheckoutValue(e.target.value)}
                                  autoFocus
                                  onKeyDown={(e) => { if (e.key === 'Enter') saveCheckoutTime(r); if (e.key === 'Escape') cancelEditCheckout(); }}
                                  style={{ padding: 4, borderRadius: 4, border: '1.5px solid #16a34a', width: 100 }}
                                />
                                <button onClick={() => saveCheckoutTime(r)} disabled={savingCheckout} style={{ padding: '2px 8px', borderRadius: 4, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer' }}>{savingCheckout ? '…' : '✓'}</button>
                                <button onClick={cancelEditCheckout} disabled={savingCheckout} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>×</button>
                              </span>
                            ) : fmtHms(r.checkOutAt)}
                          </td>
                          <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9', fontFamily: 'JetBrains Mono, monospace' }}>
                            {dur != null ? `${Math.floor(dur / 60)}h ${dur % 60}m` : '—'}
                          </td>
                          <td style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>
                            <span style={{ display: 'inline-flex', gap: 4 }}>
                              {!isEditing && r.checkInAt && (
                                <button
                                  onClick={() => beginEditCheckout(r)}
                                  title={r.checkOutAt ? (isRTL ? 'تعديل الخروج' : 'Edit check-out') : (isRTL ? 'إضافة وقت الخروج' : 'Add check-out')}
                                  style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid ' + (r.checkOutAt ? '#c7d2fe' : '#86efac'), background: r.checkOutAt ? '#eef2ff' : '#dcfce7', color: r.checkOutAt ? '#4338ca' : '#166534', cursor: 'pointer' }}
                                >✎</button>
                              )}
                              {r.checkOutAt && !isEditing && (
                                <button onClick={() => clearCheckoutRow(r)} title={isRTL ? 'حذف تسجيل الخروج' : 'Clear check-out'} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #fde68a', background: '#fef3c7', color: '#92400e', cursor: 'pointer' }}>↩</button>
                              )}
                              {!isEditing && (
                                <button onClick={() => deleteAttendanceRow(r)} title={isRTL ? 'حذف السجل' : 'Delete'} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #fecaca', background: '#fee2e2', color: '#991b1b', cursor: 'pointer' }}>×</button>
                              )}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Trainer create/edit modal */}
      <AnimatePresence>
        {showTrainerModal && (
          <div className="modal-overlay" onClick={closeTrainerModal}>
            <motion.div
              className="modal-content modern-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{ maxWidth: 760 }}
            >
              <div className="modern-modal-header" style={{ background: 'linear-gradient(135deg, #6d28d9 0%, #a855f7 100%)' }}>
                <div className="modal-header-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div className="modal-header-text">
                  <h2>{editingTrainerId ? (isRTL ? 'تعديل مدرب' : 'Edit Trainer') : (isRTL ? 'مدرب جديد' : 'New Trainer')}</h2>
                  <p>{isRTL ? 'أدخل بيانات المدرب المعاون' : 'Enter assistant trainer info'}</p>
                </div>
                <button className="modal-close-modern" onClick={closeTrainerModal}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div className="modern-modal-body">
                <div className="form-section">
                  <div className="section-header">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>
                    <span>{isRTL ? 'البيانات الشخصية' : 'Personal info'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'الاسم *' : 'Name *'}</label>
                      <input className="modern-input-field" value={trainerForm.name} onChange={e => setTrainerForm({ ...trainerForm, name: e.target.value })} />
                    </div>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'الجوال' : 'Phone'}</label>
                      <input className="modern-input-field" dir="ltr" value={trainerForm.phone} onChange={e => setTrainerForm({ ...trainerForm, phone: e.target.value })} />
                    </div>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'رقم الهوية' : 'National ID'}</label>
                      <input className="modern-input-field" dir="ltr" value={trainerForm.nationalId} onChange={e => setTrainerForm({ ...trainerForm, nationalId: e.target.value })} />
                    </div>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
                      <input className="modern-input-field" dir="ltr" type="email" value={trainerForm.email} onChange={e => setTrainerForm({ ...trainerForm, email: e.target.value })} />
                    </div>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'العمر' : 'Age'}</label>
                      <input className="modern-input-field" type="number" min="0" value={trainerForm.age} onChange={e => setTrainerForm({ ...trainerForm, age: e.target.value })} />
                    </div>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'الشهادة العلمية' : 'Educational degree'}</label>
                      <input className="modern-input-field" value={trainerForm.educationalDegree} onChange={e => setTrainerForm({ ...trainerForm, educationalDegree: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span>{isRTL ? 'المهارات (أقسام فاب لاب)' : 'Skills (FabLab sections)'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                    {FABLAB_SECTIONS.map(sec => {
                      const active = (trainerForm.skills || []).includes(sec);
                      return (
                        <label key={sec} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${active ? '#a855f7' : '#e2e8f0'}`, background: active ? '#faf5ff' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: active ? '#5b21b6' : '#334155' }}>
                          <input type="checkbox" checked={active} onChange={() => toggleSkill(sec)} style={{ accentColor: '#6d28d9' }} />
                          {sec}
                        </label>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 700 }}>
                      {isRTL ? 'مهارة أخرى غير موجودة أعلاه' : 'Other skill not listed above'}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        value={customSkill}
                        onChange={(e) => setCustomSkill(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSkill(); } }}
                        placeholder={isRTL ? 'اسم المهارة ثم اضغط إضافة' : 'Skill name, then click Add'}
                        className="modern-input-field"
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={addCustomSkill}
                        style={{ padding: '0 18px', border: 'none', borderRadius: 8, background: 'linear-gradient(135deg, #6d28d9, #a855f7)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                      >
                        {isRTL ? '+ إضافة' : '+ Add'}
                      </button>
                    </div>
                    {(trainerForm.skills || []).filter(s => !FABLAB_SECTIONS.includes(s)).length > 0 && (
                      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {trainerForm.skills.filter(s => !FABLAB_SECTIONS.includes(s)).map(s => (
                          <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f5f3ff', color: '#5b21b6', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, border: '1px solid #ddd6fe' }}>
                            {s}
                            <button
                              type="button"
                              onClick={() => toggleSkill(s)}
                              style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', padding: 0, fontSize: 14, fontWeight: 900, lineHeight: 1 }}
                              aria-label="remove"
                            >×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    <span>{isRTL ? 'تقييم الأداء العام' : 'Overall performance'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <Stars value={trainerForm.performanceRating} onChange={v => setTrainerForm({ ...trainerForm, performanceRating: v })} size={28} />
                    <span style={{ color: '#64748b', fontSize: 13 }}>{trainerForm.performanceRating || 0} / 5</span>
                  </div>
                  <div className="form-group modern-input" style={{ marginTop: 10 }}>
                    <label>{isRTL ? 'ملاحظات' : 'Notes'}</label>
                    <textarea className="modern-input-field" rows={2} value={trainerForm.notes} onChange={e => setTrainerForm({ ...trainerForm, notes: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="modern-modal-footer">
                <button onClick={closeTrainerModal} style={{ padding: '10px 20px', border: '1px solid #cbd5e1', background: '#fff', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', color: '#334155' }}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
                <button onClick={saveTrainer} style={{ padding: '10px 24px', border: 'none', background: 'linear-gradient(135deg, #6d28d9, #a855f7)', color: 'white', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontFamily: 'inherit' }}>
                  {editingTrainerId ? (isRTL ? 'حفظ التعديل' : 'Save') : (isRTL ? 'إضافة' : 'Add')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Assignments (chances) modal */}
      <AnimatePresence>
        {showAssignmentsFor && (
          <div className="modal-overlay" onClick={closeAssignments}>
            <motion.div
              className="modal-content modern-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{ maxWidth: 860 }}
            >
              <div className="modern-modal-header" style={{ background: 'linear-gradient(135deg, #6d28d9 0%, #ec4899 100%)' }}>
                <div className="modal-header-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                </div>
                <div className="modal-header-text">
                  <h2>{isRTL ? 'الفرص التدريبية' : 'Training chances'}</h2>
                  <p>{showAssignmentsFor.name}</p>
                </div>
                <button className="modal-close-modern" onClick={closeAssignments}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div className="modern-modal-body">
                <div className="form-section">
                  <div className="section-header">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    <span>{editingAssignmentId ? (isRTL ? 'تعديل فرصة' : 'Edit chance') : (isRTL ? 'إضافة فرصة' : 'Add chance')}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'اسم الفرصة *' : 'Chance name *'}</label>
                      <input className="modern-input-field" value={assignmentForm.chanceName} onChange={e => setAssignmentForm({ ...assignmentForm, chanceName: e.target.value })} />
                    </div>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'المكان' : 'Destination'}</label>
                      <input className="modern-input-field" value={assignmentForm.destination} onChange={e => setAssignmentForm({ ...assignmentForm, destination: e.target.value })} />
                    </div>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'يبدأ في' : 'Starts at'}</label>
                      <input className="modern-input-field" type="datetime-local" value={assignmentForm.startAt} onChange={e => setAssignmentForm({ ...assignmentForm, startAt: e.target.value })} />
                    </div>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'ينتهي في' : 'Ends at'}</label>
                      <input className="modern-input-field" type="datetime-local" value={assignmentForm.endAt} onChange={e => setAssignmentForm({ ...assignmentForm, endAt: e.target.value })} />
                    </div>
                  </div>

                  <div style={{ marginTop: 14, background: 'linear-gradient(135deg, #faf5ff 0%, #fdf2f8 100%)', border: '1px solid #f5d0fe', borderRadius: 10, padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ fontWeight: 800, color: '#6d28d9', fontSize: 14 }}>
                        {isRTL ? 'تقييم أداء المدرب بعد الفرصة' : 'Post-chance performance evaluation'}
                      </div>
                      <div style={{ fontWeight: 800, color: '#6d28d9' }}>
                        {isRTL ? 'المتوسط' : 'Avg'}: {avgOfCriteria(assignmentForm.criteria)} / 5
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {CRITERIA.map(c => (
                        <div key={c.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '6px 10px', background: '#fff', borderRadius: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{isRTL ? c.labelAr : c.labelEn}</span>
                          <Stars value={assignmentForm.criteria?.[c.key]} onChange={v => setCrit(c.key, v)} size={20} />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="form-group modern-input" style={{ marginTop: 12 }}>
                    <label>{isRTL ? 'ملاحظات' : 'Notes'}</label>
                    <textarea className="modern-input-field" rows={2} value={assignmentForm.notes} onChange={e => setAssignmentForm({ ...assignmentForm, notes: e.target.value })} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={saveAssignment} style={{ padding: '9px 18px', border: 'none', background: 'linear-gradient(135deg, #6d28d9, #ec4899)', color: 'white', borderRadius: 8, cursor: 'pointer', fontWeight: 800, fontFamily: 'inherit' }}>
                      {editingAssignmentId ? (isRTL ? 'حفظ التعديل' : 'Save') : (isRTL ? 'إضافة الفرصة' : 'Add chance')}
                    </button>
                    {editingAssignmentId && (
                      <button onClick={() => { setEditingAssignmentId(null); setAssignmentForm(emptyAssignment()); }} style={{ padding: '9px 14px', border: '1px solid #cbd5e1', background: '#fff', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', color: '#334155', fontWeight: 700 }}>
                        {isRTL ? 'إلغاء' : 'Cancel'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                    <span>{isRTL ? 'سجل الفرص' : 'Chances history'} ({Array.isArray(showAssignmentsFor.assignments) ? showAssignmentsFor.assignments.length : 0})</span>
                  </div>
                  {(!showAssignmentsFor.assignments || showAssignmentsFor.assignments.length === 0) ? (
                    <div className="empty-state">{isRTL ? 'لا توجد فرص مسجلة' : 'No chances recorded'}</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {showAssignmentsFor.assignments.map(a => {
                        const critAvg = a.rating || avgOfCriteria(a.criteria);
                        return (
                          <div key={a.assignmentId} style={{ padding: '12px 14px', background: '#faf8ff', border: '1px solid #e9d5ff', borderRadius: 10 }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 14 }}>{a.chanceName}</div>
                                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                  {a.destination ? `📍 ${a.destination}` : ''}
                                  {a.destination && fmtRange(a) ? ' • ' : ''}
                                  {fmtRange(a) ? `📅 ${fmtRange(a)}` : ''}
                                </div>
                              </div>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', padding: '4px 10px', borderRadius: 999, border: '1px solid #e9d5ff' }}>
                                <Stars value={critAvg} onChange={null} size={16} />
                                <span style={{ fontSize: 12, fontWeight: 800, color: '#6d28d9' }}>{critAvg || 0}</span>
                              </div>
                              <button
                                onClick={() => handlePrintChanceCertificate(showAssignmentsFor, a)}
                                title={isRTL ? 'طباعة شهادة' : 'Print certificate'}
                                style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'linear-gradient(135deg, #6d28d9, #ec4899)', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
                                {isRTL ? 'شهادة' : 'Cert'}
                              </button>
                              <button onClick={() => editAssignment(a)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>✏️</button>
                              <button onClick={() => deleteAssignment(a)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fee2e2', color: '#991b1b', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>🗑</button>
                            </div>
                            {a.criteria && Object.keys(a.criteria).length > 0 && (
                              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 6, fontSize: 11 }}>
                                {CRITERIA.map(c => {
                                  const v = Number(a.criteria?.[c.key]) || 0;
                                  if (!v) return null;
                                  return (
                                    <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, background: '#fff', padding: '4px 8px', borderRadius: 6, color: '#475569' }}>
                                      <span style={{ fontWeight: 600 }}>{isRTL ? c.labelAr : c.labelEn}</span>
                                      <span style={{ color: '#6d28d9', fontWeight: 800 }}>{v}/5</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {a.notes && <div style={{ marginTop: 6, fontSize: 12, color: '#475569' }}>💬 {a.notes}</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="modern-modal-footer">
                <button onClick={closeAssignments} style={{ padding: '10px 20px', border: '1px solid #cbd5e1', background: '#fff', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', color: '#334155' }}>{isRTL ? 'إغلاق' : 'Close'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Email compose modal */}
      <AnimatePresence>
        {emailTarget && (
          <div className="modal-overlay" onClick={closeEmail}>
            <motion.div
              className="modal-content modern-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{ maxWidth: 640 }}
            >
              <div className="modern-modal-header" style={{ background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)' }}>
                <div className="modal-header-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </div>
                <div className="modal-header-text">
                  <h2>{isRTL ? 'إرسال بريد إلكتروني' : 'Send email'}</h2>
                  <p>{emailTarget.name} — <span dir="ltr">{emailTarget.email}</span></p>
                </div>
                <button className="modal-close-modern" onClick={closeEmail}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div className="modern-modal-body">
                <div className="form-group modern-input">
                  <label>{isRTL ? 'الموضوع' : 'Subject'}</label>
                  <input className="modern-input-field" value={emailForm.subject} onChange={e => setEmailForm({ ...emailForm, subject: e.target.value })} placeholder={isRTL ? 'موضوع البريد' : 'Email subject'} />
                </div>
                <div className="form-group modern-input" style={{ marginTop: 12 }}>
                  <label>{isRTL ? 'محتوى الرسالة *' : 'Message body *'}</label>
                  <textarea
                    className="modern-input-field"
                    rows={9}
                    value={emailForm.message}
                    onChange={e => setEmailForm({ ...emailForm, message: e.target.value })}
                    placeholder={isRTL ? 'اكتب رسالتك هنا...' : 'Write your message here...'}
                    style={{ resize: 'vertical', minHeight: 160 }}
                  />
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
                  {isRTL ? 'سيتم إرسال البريد من: ' : 'Will be sent from: '}
                  <strong>FABLAB Al-Ahsa</strong>
                </div>
              </div>
              <div className="modern-modal-footer">
                <button onClick={closeEmail} style={{ padding: '10px 20px', border: '1px solid #cbd5e1', background: '#fff', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', color: '#334155' }}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
                <button onClick={sendEmail} disabled={sending} style={{ padding: '10px 24px', border: 'none', background: sending ? '#94a3b8' : 'linear-gradient(135deg, #1e40af, #3b82f6)', color: 'white', borderRadius: 10, cursor: sending ? 'not-allowed' : 'pointer', fontWeight: 800, fontFamily: 'inherit' }}>
                  {sending ? (isRTL ? 'جاري الإرسال...' : 'Sending...') : (isRTL ? '📤 إرسال' : '📤 Send')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TrainerAssistantManagement;
