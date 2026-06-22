import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../../config/api';
import './SummerFablab.css';

// Shared FabLab section enum (matches Registration / SectionAvailability).
const FABLAB_SECTIONS = [
  { value: 'Electronics and Programming', labelAr: 'الإلكترونيات والبرمجة', labelEn: 'Electronics & Programming' },
  { value: 'CNC Laser',                   labelAr: 'الليزر CNC',            labelEn: 'CNC Laser' },
  { value: 'CNC Wood',                    labelAr: 'الخشب CNC',             labelEn: 'CNC Wood' },
  { value: '3D',                          labelAr: 'الطباعة ثلاثية الأبعاد', labelEn: '3D Printing' },
  { value: 'Robotic and AI',              labelAr: 'الروبوتات والذكاء',     labelEn: 'Robotics & AI' },
  { value: "Kid's Club",                  labelAr: 'نادي الأطفال',          labelEn: "Kid's Club" },
  { value: 'Vinyl Cutting',               labelAr: 'قص الفينيل',             labelEn: 'Vinyl Cutting' }
];

const emptyProgramForm = {
  name: '',
  teacherName: '',
  studentCount: '',
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  fablabSection: '',
  sectionVolunteers: '',
  notes: ''
};

const SUB_TABS = [
  { id: 'programs',  ar: 'البرامج',     en: 'Programs' },
  { id: 'teachers',  ar: 'المعلمون',    en: 'Teachers' },
  { id: 'volunteers', ar: 'المتطوعون', en: 'Volunteers' },
  { id: 'students',  ar: 'الطلاب',      en: 'Students' }
];

const SummerFablab = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [subTab, setSubTab] = useState('programs');

  // ---- Programs sub-tab state ----
  const [programs, setPrograms] = useState([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyProgramForm);
  const [saving, setSaving] = useState(false);

  const fetchPrograms = async () => {
    setLoadingPrograms(true);
    try {
      const res = await api.get('/summer/programs');
      setPrograms(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error loading programs:', err);
      toast.error(isRTL ? 'خطأ في تحميل البرامج' : 'Error loading programs');
    } finally {
      setLoadingPrograms(false);
    }
  };

  useEffect(() => {
    if (subTab === 'programs') fetchPrograms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyProgramForm);
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditingId(p.programId);
    setForm({
      name: p.name || '',
      teacherName: p.teacherName || '',
      studentCount: p.studentCount != null ? String(p.studentCount) : '',
      startDate: (p.startDate || '').slice(0, 10),
      endDate: (p.endDate || '').slice(0, 10),
      startTime: (p.startTime || '').slice(0, 5),
      endTime: (p.endTime || '').slice(0, 5),
      fablabSection: p.fablabSection || '',
      sectionVolunteers: Array.isArray(p.sectionVolunteers) ? p.sectionVolunteers.join(', ') : '',
      notes: p.notes || ''
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.startDate || !form.endDate) {
      toast.error(isRTL ? 'يرجى تعبئة الاسم وتاريخا البداية والنهاية' : 'Name and start/end dates are required');
      return;
    }
    if (form.startDate > form.endDate) {
      toast.error(isRTL ? 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية' : 'End date must be on or after start date');
      return;
    }
    const payload = {
      ...form,
      studentCount: form.studentCount === '' ? 0 : Number(form.studentCount),
      sectionVolunteers: form.sectionVolunteers
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    };
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/summer/programs/${editingId}`, payload);
        toast.success(isRTL ? 'تم تحديث البرنامج' : 'Program updated');
      } else {
        await api.post('/summer/programs', payload);
        toast.success(isRTL ? 'تم إضافة البرنامج' : 'Program added');
      }
      setShowForm(false);
      setForm(emptyProgramForm);
      setEditingId(null);
      fetchPrograms();
    } catch (err) {
      console.error('Error saving program:', err);
      toast.error(isRTL ? 'خطأ في الحفظ' : 'Error saving');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(isRTL ? 'حذف البرنامج؟' : 'Delete this program?')) return;
    try {
      await api.delete(`/summer/programs/${id}`);
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
      fetchPrograms();
    } catch (err) {
      console.error('Error deleting program:', err);
      toast.error(isRTL ? 'خطأ في الحذف' : 'Error deleting');
    }
  };

  const sectionLabel = (value) => {
    const s = FABLAB_SECTIONS.find(s => s.value === value);
    if (!s) return value || '—';
    return isRTL ? s.labelAr : s.labelEn;
  };

  return (
    <div className="summer-tab" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="summer-header">
        <div>
          <h2 className="summer-title">{isRTL ? 'صيف فاب لاب' : 'Summer FabLab'}</h2>
          <p className="summer-sub">
            {isRTL ? 'إدارة البرامج، المعلمين، المتطوعين والطلاب لموسم الصيف.' : 'Manage programs, teachers, volunteers and students for the summer season.'}
          </p>
        </div>
      </div>

      <div className="summer-subnav">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            className={`summer-subnav-btn ${subTab === t.id ? 'active' : ''}`}
            onClick={() => setSubTab(t.id)}
          >
            {isRTL ? t.ar : t.en}
          </button>
        ))}
      </div>

      {subTab === 'programs' && (
        <div className="summer-panel">
          <div className="summer-panel-header">
            <h3>{isRTL ? 'البرامج' : 'Programs'}</h3>
            <button className="summer-btn-primary" onClick={openCreate}>
              + {isRTL ? 'إضافة برنامج' : 'Add Program'}
            </button>
          </div>

          {loadingPrograms ? (
            <p style={{ color: '#64748b' }}>{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
          ) : programs.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
              {isRTL ? 'لا توجد برامج. ابدأ بإضافة أول برنامج.' : 'No programs yet. Start by adding one.'}
            </p>
          ) : (
            <div className="summer-grid">
              {programs.map(p => (
                <div key={p.programId} className="summer-card">
                  <div className="summer-card-head">
                    <strong className="summer-card-name">{p.name}</strong>
                    <span className="summer-card-section">{sectionLabel(p.fablabSection)}</span>
                  </div>
                  <div className="summer-card-meta">
                    {p.teacherName && (
                      <div><span>{isRTL ? 'المعلم:' : 'Teacher:'}</span> {p.teacherName}</div>
                    )}
                    <div>
                      <span>{isRTL ? 'الفترة:' : 'Dates:'}</span> {(p.startDate || '').slice(0,10)} → {(p.endDate || '').slice(0,10)}
                    </div>
                    {(p.startTime || p.endTime) && (
                      <div><span>{isRTL ? 'الوقت:' : 'Time:'}</span> {(p.startTime || '').slice(0,5)} → {(p.endTime || '').slice(0,5)}</div>
                    )}
                    <div><span>{isRTL ? 'الطلاب:' : 'Students:'}</span> {p.studentCount || 0}</div>
                    {Array.isArray(p.sectionVolunteers) && p.sectionVolunteers.length > 0 && (
                      <div className="summer-card-volunteers">
                        <span>{isRTL ? 'المتطوعون:' : 'Volunteers:'}</span>{' '}
                        {p.sectionVolunteers.map((v, i) => (
                          <span key={i} className="summer-volunteer-chip">{v}</span>
                        ))}
                      </div>
                    )}
                    {p.notes && (
                      <div className="summer-card-notes">{p.notes}</div>
                    )}
                  </div>
                  <div className="summer-card-actions">
                    <button className="summer-btn-secondary" onClick={() => openEdit(p)}>
                      {isRTL ? 'تعديل' : 'Edit'}
                    </button>
                    <button className="summer-btn-danger" onClick={() => handleDelete(p.programId)}>
                      {isRTL ? 'حذف' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab !== 'programs' && (
        <div className="summer-panel">
          <p style={{ color: '#64748b', fontSize: '0.95rem', textAlign: 'center', padding: '2rem 0' }}>
            {isRTL ? 'هذا القسم قيد الإنشاء.' : 'This section is under construction.'}
          </p>
        </div>
      )}

      {showForm && (
        <div className="summer-modal-overlay" onClick={() => !saving && setShowForm(false)}>
          <div className="summer-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingId ? (isRTL ? 'تعديل برنامج' : 'Edit Program') : (isRTL ? 'إضافة برنامج' : 'Add Program')}</h3>

            <div className="summer-form-grid">
              <div className="summer-field full">
                <label>{isRTL ? 'اسم البرنامج' : 'Program Name'} *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>

              <div className="summer-field">
                <label>{isRTL ? 'المعلم / المهندس المسؤول' : 'Teacher / Engineer'}</label>
                <input value={form.teacherName} onChange={(e) => setForm({ ...form, teacherName: e.target.value })} />
              </div>

              <div className="summer-field">
                <label>{isRTL ? 'عدد الطلاب' : 'Number of Students'}</label>
                <input
                  type="number"
                  min="0"
                  value={form.studentCount}
                  onChange={(e) => setForm({ ...form, studentCount: e.target.value })}
                />
              </div>

              <div className="summer-field">
                <label>{isRTL ? 'تاريخ البداية' : 'Start Date'} *</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="summer-field">
                <label>{isRTL ? 'تاريخ النهاية' : 'End Date'} *</label>
                <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>

              <div className="summer-field">
                <label>{isRTL ? 'وقت البداية' : 'Start Time'}</label>
                <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              </div>
              <div className="summer-field">
                <label>{isRTL ? 'وقت النهاية' : 'End Time'}</label>
                <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </div>

              <div className="summer-field full">
                <label>{isRTL ? 'القسم في فاب لاب' : 'FabLab Section'}</label>
                <select value={form.fablabSection} onChange={(e) => setForm({ ...form, fablabSection: e.target.value })}>
                  <option value="">— {isRTL ? 'اختر القسم' : 'Select section'} —</option>
                  {FABLAB_SECTIONS.map(s => (
                    <option key={s.value} value={s.value}>{isRTL ? s.labelAr : s.labelEn}</option>
                  ))}
                </select>
              </div>

              <div className="summer-field full">
                <label>{isRTL ? 'متطوعو القسم (أسماء مفصولة بفواصل)' : 'Section Volunteers (comma-separated names)'}</label>
                <input
                  value={form.sectionVolunteers}
                  onChange={(e) => setForm({ ...form, sectionVolunteers: e.target.value })}
                  placeholder={isRTL ? 'مثال: أحمد, سارة, محمد' : 'e.g. Ahmed, Sara, Mohammed'}
                />
              </div>

              <div className="summer-field full">
                <label>{isRTL ? 'ملاحظات' : 'Notes'}</label>
                <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>

            <div className="summer-modal-actions">
              <button className="summer-btn-secondary" disabled={saving} onClick={() => setShowForm(false)}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button className="summer-btn-primary" disabled={saving} onClick={handleSave}>
                {saving
                  ? (isRTL ? 'جاري الحفظ...' : 'Saving...')
                  : editingId
                    ? (isRTL ? 'حفظ التعديل' : 'Save Changes')
                    : (isRTL ? 'إضافة' : 'Add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SummerFablab;
