import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import api from '../../config/api';
import '../Mawhba/Mawhba.css';

// Star input — reused for trainer.performanceRating and per-assignment rating.
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
  educationalDegree: '', skills: '', performanceRating: 0, notes: ''
});
const emptyAssignment = () => ({ chanceName: '', destination: '', chanceDate: '', rating: 0, notes: '' });

const contactLink = (kind, value) => {
  if (!value) return null;
  const clean = String(value).replace(/[^0-9+]/g, '');
  if (kind === 'call') return `tel:${clean}`;
  if (kind === 'whatsapp') return `https://wa.me/${clean.replace(/^\+/, '')}`;
  if (kind === 'email') return `mailto:${value}`;
  return null;
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

  const [showAssignmentsFor, setShowAssignmentsFor] = useState(null); // trainer object
  const [assignmentForm, setAssignmentForm] = useState(emptyAssignment());
  const [editingAssignmentId, setEditingAssignmentId] = useState(null);

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

  const openCreateTrainer = () => {
    setEditingTrainerId(null);
    setTrainerForm(emptyTrainer());
    setShowTrainerModal(true);
  };
  const openEditTrainer = (t) => {
    setEditingTrainerId(t.trainerId);
    setTrainerForm({
      name: t.name || '', phone: t.phone || '', nationalId: t.nationalId || '',
      email: t.email || '', age: t.age || '', educationalDegree: t.educationalDegree || '',
      skills: t.skills || '', performanceRating: Number(t.performanceRating) || 0, notes: t.notes || ''
    });
    setShowTrainerModal(true);
  };
  const closeTrainerModal = () => { setShowTrainerModal(false); setEditingTrainerId(null); setTrainerForm(emptyTrainer()); };

  const saveTrainer = async () => {
    if (!trainerForm.name.trim()) {
      toast.error(isRTL ? 'الاسم مطلوب' : 'Name is required');
      return;
    }
    const payload = { ...trainerForm };
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

  const openAssignments = (t) => {
    setShowAssignmentsFor(t);
    setAssignmentForm(emptyAssignment());
    setEditingAssignmentId(null);
  };
  const closeAssignments = () => { setShowAssignmentsFor(null); setEditingAssignmentId(null); setAssignmentForm(emptyAssignment()); };

  const saveAssignment = async () => {
    if (!showAssignmentsFor) return;
    if (!assignmentForm.chanceName.trim()) {
      toast.error(isRTL ? 'اسم الفرصة مطلوب' : 'Chance name required');
      return;
    }
    try {
      const payload = { ...assignmentForm };
      if (payload.chanceDate === '') payload.chanceDate = null;
      if (payload.rating === 0 || payload.rating === '') payload.rating = null;
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
      chanceDate: (a.chanceDate || '').slice(0, 10),
      rating: Number(a.rating) || 0,
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

  const fmtDate = (d) => {
    if (!d) return '';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d).slice(0, 10);
      return dt.toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { calendar: 'gregory', day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return String(d).slice(0, 10); }
  };

  const filtered = trainers.filter(t => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return [t.name, t.phone, t.email, t.nationalId, t.skills, t.educationalDegree]
      .some(f => String(f || '').toLowerCase().includes(q));
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
                  {t.skills && <div style={{ marginTop: 6, background: '#faf5ff', padding: '6px 10px', borderRadius: 8, color: '#5b21b6', fontSize: 12, fontWeight: 600, lineHeight: 1.5 }}>🛠 {t.skills}</div>}
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
                    <a href={contactLink('email', t.email)} title="Email" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #bfdbfe', background: '#dbeafe', color: '#1e40af', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>✉️</a>
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
              style={{ maxWidth: 720 }}
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
                  <div className="form-group modern-input" style={{ marginTop: 10 }}>
                    <label>{isRTL ? 'المهارات' : 'Skills'}</label>
                    <textarea className="modern-input-field" rows={2} placeholder={isRTL ? 'مثال: البرمجة، أنظمة CNC، إلكترونيات...' : 'e.g. Programming, CNC systems, electronics...'} value={trainerForm.skills} onChange={e => setTrainerForm({ ...trainerForm, skills: e.target.value })} />
                  </div>
                  <div className="form-group modern-input" style={{ marginTop: 10 }}>
                    <label>{isRTL ? 'ملاحظات' : 'Notes'}</label>
                    <textarea className="modern-input-field" rows={2} value={trainerForm.notes} onChange={e => setTrainerForm({ ...trainerForm, notes: e.target.value })} />
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
              style={{ maxWidth: 820 }}
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
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'اسم الفرصة *' : 'Chance name *'}</label>
                      <input className="modern-input-field" value={assignmentForm.chanceName} onChange={e => setAssignmentForm({ ...assignmentForm, chanceName: e.target.value })} />
                    </div>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'المكان' : 'Destination'}</label>
                      <input className="modern-input-field" value={assignmentForm.destination} onChange={e => setAssignmentForm({ ...assignmentForm, destination: e.target.value })} />
                    </div>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'التاريخ' : 'Date'}</label>
                      <input className="modern-input-field" type="date" value={assignmentForm.chanceDate} onChange={e => setAssignmentForm({ ...assignmentForm, chanceDate: e.target.value })} />
                    </div>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'التقييم' : 'Rating'}</label>
                      <div style={{ padding: '4px 0' }}>
                        <Stars value={assignmentForm.rating} onChange={v => setAssignmentForm({ ...assignmentForm, rating: v })} />
                      </div>
                    </div>
                  </div>
                  <div className="form-group modern-input" style={{ marginTop: 10 }}>
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
                      {showAssignmentsFor.assignments.map(a => (
                        <div key={a.assignmentId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#faf8ff', border: '1px solid #e9d5ff', borderRadius: 10, flexWrap: 'wrap' }}>
                          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 14 }}>{a.chanceName}</div>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                              {a.destination ? `📍 ${a.destination}` : ''}
                              {a.destination && a.chanceDate ? ' • ' : ''}
                              {a.chanceDate ? `📅 ${fmtDate(a.chanceDate)}` : ''}
                            </div>
                            {a.notes && <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{a.notes}</div>}
                          </div>
                          <Stars value={a.rating} onChange={null} size={16} />
                          <button onClick={() => editAssignment(a)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>✏️</button>
                          <button onClick={() => deleteAssignment(a)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fee2e2', color: '#991b1b', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>🗑</button>
                        </div>
                      ))}
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
    </div>
  );
};

export default TrainerAssistantManagement;
