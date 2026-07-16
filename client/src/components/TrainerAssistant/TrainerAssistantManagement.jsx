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
                  <button onClick={() => openEditTrainer(t)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>✏️</button>
                  <button onClick={() => deleteTrainer(t)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fee2e2', color: '#991b1b', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>🗑</button>
                </div>
              </div>
            );
          })}
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
