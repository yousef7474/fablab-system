import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../../config/api';
import AttendanceLog from '../shared/AttendanceLog';
import './SummerFablab.css';

// Standard FabLab sections (matches Registration / SectionAvailability).
// Teachers can additionally type a custom section via the "Other" option.
const STANDARD_SECTIONS = [
  { value: 'Electronics and Programming', labelAr: 'الإلكترونيات والبرمجة', labelEn: 'Electronics & Programming' },
  { value: 'CNC Laser',                   labelAr: 'الليزر CNC',            labelEn: 'CNC Laser' },
  { value: 'CNC Wood',                    labelAr: 'الخشب CNC',             labelEn: 'CNC Wood' },
  { value: '3D',                          labelAr: 'الطباعة ثلاثية الأبعاد', labelEn: '3D Printing' },
  { value: 'Robotic and AI',              labelAr: 'الروبوتات والذكاء',     labelEn: 'Robotics & AI' },
  { value: "Kid's Club",                  labelAr: 'نادي الأطفال',          labelEn: "Kid's Club" },
  { value: 'Vinyl Cutting',               labelAr: 'قص الفينيل',             labelEn: 'Vinyl Cutting' }
];

const SUB_TABS = [
  { id: 'programs',   ar: 'البرامج',     en: 'Programs' },
  { id: 'teachers',   ar: 'المعلمون',    en: 'Teachers' },
  { id: 'volunteers', ar: 'المتطوعون',   en: 'Volunteers' },
  { id: 'students',   ar: 'الطلاب',      en: 'Students' }
];

const emptyProgramForm = {
  name: '', teacherName: '', teacherId: '', studentCount: '',
  startDate: '', endDate: '', startTime: '', endTime: '',
  fablabSection: '', sectionVolunteers: '', notes: ''
};
const emptyTeacherForm = {
  source: 'manual', // 'manual' | 'employee' — see Teacher modal
  employeeId: '',
  name: '', nationalId: '', phone: '', email: '',
  fablabSection: '', sectionMode: 'standard', customSection: '',
  bio: ''
};
const emptySummerVolunteerForm = {
  name: '', nationalId: '', phone: '', email: '',
  summerProgramId: ''
};
const emptyRatingForm = {
  type: 'award', points: 1, criteria: '', notes: '',
  ratingDate: new Date().toISOString().slice(0, 10), programId: ''
};
const emptyStudentForm = {
  name: '', nationalId: '', phone: '', email: '',
  age: '', gender: '', notes: '', programId: ''
};

const sectionLabel = (value, isRTL) => {
  if (!value) return '—';
  const s = STANDARD_SECTIONS.find(s => s.value === value);
  if (!s) return value; // custom user-typed section
  return isRTL ? s.labelAr : s.labelEn;
};

const SummerFablab = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [subTab, setSubTab] = useState('programs');

  // Shared data — every panel may need any of these (teachers used by
  // the program form, programs used by the student form etc.)
  const [programs, setPrograms] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [allVolunteers, setAllVolunteers] = useState([]);

  const [loading, setLoading] = useState({ programs: false, teachers: false, students: false, volunteers: false });
  const setLoadingKey = (k, v) => setLoading(prev => ({ ...prev, [k]: v }));

  const fetchPrograms = useCallback(async () => {
    setLoadingKey('programs', true);
    try {
      const res = await api.get('/summer/programs');
      setPrograms(Array.isArray(res.data) ? res.data : []);
    } catch (err) { console.error(err); toast.error(isRTL ? 'خطأ في تحميل البرامج' : 'Error loading programs'); }
    finally { setLoadingKey('programs', false); }
  }, [isRTL]);

  const fetchTeachers = useCallback(async () => {
    setLoadingKey('teachers', true);
    try {
      const res = await api.get('/summer/teachers');
      setTeachers(Array.isArray(res.data) ? res.data : []);
    } catch (err) { console.error(err); toast.error(isRTL ? 'خطأ في تحميل المعلمين' : 'Error loading teachers'); }
    finally { setLoadingKey('teachers', false); }
  }, [isRTL]);

  const fetchStudents = useCallback(async () => {
    setLoadingKey('students', true);
    try {
      const res = await api.get('/summer/students');
      setStudents(Array.isArray(res.data) ? res.data : []);
    } catch (err) { console.error(err); toast.error(isRTL ? 'خطأ في تحميل الطلاب' : 'Error loading students'); }
    finally { setLoadingKey('students', false); }
  }, [isRTL]);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get('/admin/employees');
      setEmployees(Array.isArray(res.data) ? res.data : (res.data?.employees || []));
    } catch (err) { console.warn('employees fetch failed:', err.message); }
  }, []);

  const fetchVolunteers = useCallback(async () => {
    setLoadingKey('volunteers', true);
    try {
      const res = await api.get('/volunteers');
      setAllVolunteers(Array.isArray(res.data) ? res.data : []);
    } catch (err) { console.error(err); toast.error(isRTL ? 'خطأ في تحميل المتطوعين' : 'Error loading volunteers'); }
    finally { setLoadingKey('volunteers', false); }
  }, [isRTL]);

  useEffect(() => {
    // Always need programs (form pickers reference them in multiple
    // tabs). Teachers are referenced by the program form too.
    fetchPrograms();
    fetchTeachers();
    fetchEmployees(); // for the teacher form "from employee" picker
  }, [fetchPrograms, fetchTeachers, fetchEmployees]);

  useEffect(() => {
    if (subTab === 'students') fetchStudents();
    if (subTab === 'volunteers') fetchVolunteers();
  }, [subTab, fetchStudents, fetchVolunteers]);

  // ---------- Programs ----------
  const [showProgramForm, setShowProgramForm] = useState(false);
  const [editingProgramId, setEditingProgramId] = useState(null);
  const [programForm, setProgramForm] = useState(emptyProgramForm);
  const [savingProgram, setSavingProgram] = useState(false);

  const openCreateProgram = () => {
    setEditingProgramId(null);
    setProgramForm(emptyProgramForm);
    setShowProgramForm(true);
  };
  const openEditProgram = (p) => {
    setEditingProgramId(p.programId);
    setProgramForm({
      name: p.name || '',
      teacherName: p.teacherName || '',
      teacherId: p.teacherId || '',
      studentCount: p.studentCount != null ? String(p.studentCount) : '',
      startDate: (p.startDate || '').slice(0, 10),
      endDate: (p.endDate || '').slice(0, 10),
      startTime: (p.startTime || '').slice(0, 5),
      endTime: (p.endTime || '').slice(0, 5),
      fablabSection: p.fablabSection || '',
      sectionVolunteers: Array.isArray(p.sectionVolunteers) ? p.sectionVolunteers.join(', ') : '',
      notes: p.notes || ''
    });
    setShowProgramForm(true);
  };
  const saveProgram = async () => {
    if (!programForm.name.trim() || !programForm.startDate || !programForm.endDate) {
      return toast.error(isRTL ? 'الاسم وتاريخا البداية والنهاية مطلوبة' : 'Name and dates are required');
    }
    if (programForm.startDate > programForm.endDate) {
      return toast.error(isRTL ? 'تاريخ النهاية يجب أن يكون بعد البداية' : 'End date must be on/after start');
    }
    const payload = {
      ...programForm,
      teacherId: programForm.teacherId || null,
      studentCount: programForm.studentCount === '' ? 0 : Number(programForm.studentCount),
      sectionVolunteers: programForm.sectionVolunteers.split(',').map(s => s.trim()).filter(Boolean)
    };
    setSavingProgram(true);
    try {
      if (editingProgramId) {
        await api.put(`/summer/programs/${editingProgramId}`, payload);
        toast.success(isRTL ? 'تم تحديث البرنامج' : 'Program updated');
      } else {
        await api.post('/summer/programs', payload);
        toast.success(isRTL ? 'تم إضافة البرنامج' : 'Program added');
      }
      setShowProgramForm(false);
      setProgramForm(emptyProgramForm);
      setEditingProgramId(null);
      fetchPrograms();
    } catch (err) { console.error(err); toast.error(isRTL ? 'خطأ في الحفظ' : 'Error saving'); }
    finally { setSavingProgram(false); }
  };
  const deleteProgram = async (id) => {
    if (!window.confirm(isRTL ? 'حذف البرنامج؟' : 'Delete this program?')) return;
    try { await api.delete(`/summer/programs/${id}`); toast.success(isRTL ? 'تم الحذف' : 'Deleted'); fetchPrograms(); }
    catch (err) { console.error(err); toast.error(isRTL ? 'خطأ' : 'Error'); }
  };

  // ---------- Teachers ----------
  const [showTeacherForm, setShowTeacherForm] = useState(false);
  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [teacherForm, setTeacherForm] = useState(emptyTeacherForm);
  const [savingTeacher, setSavingTeacher] = useState(false);
  const [ratingTarget, setRatingTarget] = useState(null);
  const [ratingForm, setRatingForm] = useState(emptyRatingForm);
  const [savingRating, setSavingRating] = useState(false);

  const openCreateTeacher = () => {
    setEditingTeacherId(null);
    setTeacherForm(emptyTeacherForm);
    setShowTeacherForm(true);
  };

  // When the admin picks an existing employee, prefill the teacher
  // form with their name + section + contact. Fields stay editable.
  const fillFromEmployee = (employeeId) => {
    const emp = employees.find(e => (e.employeeId || e.id) === employeeId);
    if (!emp) {
      setTeacherForm(prev => ({ ...prev, employeeId: '' }));
      return;
    }
    const empSection = emp.section || emp.fablabSection || '';
    const isStandard = STANDARD_SECTIONS.some(s => s.value === empSection);
    setTeacherForm(prev => ({
      ...prev,
      employeeId,
      name: emp.fullName || emp.name || prev.name,
      email: emp.email || prev.email,
      phone: emp.phone || prev.phone,
      nationalId: emp.nationalId || prev.nationalId,
      fablabSection: isStandard ? empSection : '',
      customSection: !isStandard && empSection ? empSection : prev.customSection,
      sectionMode: isStandard ? 'standard' : (empSection ? 'custom' : prev.sectionMode),
      bio: emp.bio || prev.bio
    }));
  };
  const openEditTeacher = (t) => {
    setEditingTeacherId(t.teacherId);
    const isStandard = STANDARD_SECTIONS.some(s => s.value === t.fablabSection);
    setTeacherForm({
      name: t.name || '',
      nationalId: t.nationalId || '',
      phone: t.phone || '',
      email: t.email || '',
      fablabSection: t.fablabSection || '',
      sectionMode: t.fablabSection && !isStandard ? 'custom' : 'standard',
      customSection: t.fablabSection && !isStandard ? t.fablabSection : '',
      bio: t.bio || ''
    });
    setShowTeacherForm(true);
  };
  const saveTeacher = async () => {
    if (!teacherForm.name.trim()) return toast.error(isRTL ? 'الاسم مطلوب' : 'Name is required');
    const finalSection = teacherForm.sectionMode === 'custom'
      ? (teacherForm.customSection.trim() || null)
      : (teacherForm.fablabSection || null);
    const payload = {
      name: teacherForm.name,
      nationalId: teacherForm.nationalId || null,
      phone: teacherForm.phone || null,
      email: teacherForm.email || null,
      fablabSection: finalSection,
      bio: teacherForm.bio || null
    };
    setSavingTeacher(true);
    try {
      if (editingTeacherId) {
        await api.put(`/summer/teachers/${editingTeacherId}`, payload);
        toast.success(isRTL ? 'تم تحديث المعلم' : 'Teacher updated');
      } else {
        await api.post('/summer/teachers', payload);
        toast.success(isRTL ? 'تم إضافة المعلم' : 'Teacher added');
      }
      setShowTeacherForm(false);
      setEditingTeacherId(null);
      fetchTeachers();
    } catch (err) { console.error(err); toast.error(isRTL ? 'خطأ في الحفظ' : 'Error saving'); }
    finally { setSavingTeacher(false); }
  };
  const deleteTeacher = async (id) => {
    if (!window.confirm(isRTL ? 'حذف المعلم؟' : 'Delete this teacher?')) return;
    try { await api.delete(`/summer/teachers/${id}`); toast.success(isRTL ? 'تم الحذف' : 'Deleted'); fetchTeachers(); }
    catch (err) { console.error(err); toast.error(isRTL ? 'خطأ' : 'Error'); }
  };
  const openRateTeacher = (t) => {
    setRatingTarget(t);
    setRatingForm(emptyRatingForm);
  };
  const submitRating = async () => {
    if (!ratingTarget) return;
    setSavingRating(true);
    try {
      await api.post('/summer/teacher-ratings', {
        teacherId: ratingTarget.teacherId,
        programId: ratingForm.programId || null,
        type: ratingForm.type,
        points: ratingForm.points,
        criteria: ratingForm.criteria || null,
        notes: ratingForm.notes || null,
        ratingDate: ratingForm.ratingDate
      });
      toast.success(isRTL ? 'تم إضافة التقييم' : 'Rating added');
      setRatingTarget(null);
      fetchTeachers();
    } catch (err) { console.error(err); toast.error(isRTL ? 'خطأ' : 'Error'); }
    finally { setSavingRating(false); }
  };
  const deleteRating = async (id) => {
    if (!window.confirm(isRTL ? 'حذف التقييم؟' : 'Delete this rating?')) return;
    try { await api.delete(`/summer/teacher-ratings/${id}`); toast.success(isRTL ? 'تم الحذف' : 'Deleted'); fetchTeachers(); }
    catch (err) { console.error(err); toast.error(isRTL ? 'خطأ' : 'Error'); }
  };

  // ---------- Summer Volunteers ----------
  // Same backing store as the main Volunteers tab — these are just
  // Volunteer records with summerProgramId set. So they automatically
  // show up in the main admin Volunteers tab too.
  const [showSummerVolunteerForm, setShowSummerVolunteerForm] = useState(false);
  const [editingSummerVolunteerId, setEditingSummerVolunteerId] = useState(null);
  const [summerVolunteerForm, setSummerVolunteerForm] = useState(emptySummerVolunteerForm);
  const [savingSummerVolunteer, setSavingSummerVolunteer] = useState(false);
  const [summerVolunteerRatingTarget, setSummerVolunteerRatingTarget] = useState(null);
  const [summerVolunteerRatingForm, setSummerVolunteerRatingForm] = useState(emptyRatingForm);

  const summerVolunteers = allVolunteers.filter(v => v.summerProgramId);

  const openCreateSummerVolunteer = () => {
    setEditingSummerVolunteerId(null);
    setSummerVolunteerForm(emptySummerVolunteerForm);
    setShowSummerVolunteerForm(true);
  };
  const openEditSummerVolunteer = (v) => {
    setEditingSummerVolunteerId(v.volunteerId);
    setSummerVolunteerForm({
      name: v.name || '',
      nationalId: v.nationalId || '',
      phone: v.phone || '',
      email: v.email || '',
      summerProgramId: v.summerProgramId || ''
    });
    setShowSummerVolunteerForm(true);
  };
  const saveSummerVolunteer = async () => {
    if (!summerVolunteerForm.name.trim() || !summerVolunteerForm.nationalId.trim() || !summerVolunteerForm.phone.trim()) {
      return toast.error(isRTL ? 'الاسم ورقم الهوية والجوال مطلوبة' : 'Name, national ID and phone are required');
    }
    if (!summerVolunteerForm.summerProgramId) {
      return toast.error(isRTL ? 'يرجى اختيار البرنامج' : 'Please select a program');
    }
    setSavingSummerVolunteer(true);
    try {
      if (editingSummerVolunteerId) {
        await api.put(`/volunteers/${editingSummerVolunteerId}`, summerVolunteerForm);
        toast.success(isRTL ? 'تم تحديث المتطوع' : 'Volunteer updated');
      } else {
        await api.post('/volunteers', summerVolunteerForm);
        toast.success(isRTL ? 'تم إضافة المتطوع' : 'Volunteer added');
      }
      setShowSummerVolunteerForm(false);
      setEditingSummerVolunteerId(null);
      fetchVolunteers();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.messageAr || err.response?.data?.message || (isRTL ? 'خطأ في الحفظ' : 'Error saving');
      toast.error(msg);
    } finally { setSavingSummerVolunteer(false); }
  };
  const deleteSummerVolunteer = async (id) => {
    if (!window.confirm(isRTL ? 'حذف المتطوع؟ سيُحذف من قائمة المتطوعين الرئيسية أيضاً.' : 'Delete this volunteer? Will also remove from the main Volunteers list.')) return;
    try {
      await api.delete(`/volunteers/${id}?force=true`);
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
      fetchVolunteers();
    } catch (err) { console.error(err); toast.error(isRTL ? 'خطأ' : 'Error'); }
  };
  const openRateSummerVolunteer = (v) => {
    setSummerVolunteerRatingTarget(v);
    setSummerVolunteerRatingForm(emptyRatingForm);
  };
  const submitSummerVolunteerRating = async () => {
    if (!summerVolunteerRatingTarget) return;
    try {
      await api.post('/volunteers/ratings', {
        volunteerId: summerVolunteerRatingTarget.volunteerId,
        type: summerVolunteerRatingForm.type,
        points: summerVolunteerRatingForm.points,
        criteria: summerVolunteerRatingForm.criteria || null,
        notes: summerVolunteerRatingForm.notes || null,
        ratingDate: summerVolunteerRatingForm.ratingDate
      });
      toast.success(isRTL ? 'تم إضافة التقييم' : 'Rating added');
      setSummerVolunteerRatingTarget(null);
      fetchVolunteers();
    } catch (err) { console.error(err); toast.error(isRTL ? 'خطأ' : 'Error'); }
  };

  // ---------- Students ----------
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [studentForm, setStudentForm] = useState(emptyStudentForm);
  const [savingStudent, setSavingStudent] = useState(false);
  const [studentProgramFilter, setStudentProgramFilter] = useState('');
  const [openStudentId, setOpenStudentId] = useState(null);

  const openCreateStudent = (programId = '') => {
    setEditingStudentId(null);
    setStudentForm({ ...emptyStudentForm, programId: programId || studentProgramFilter || '' });
    setShowStudentForm(true);
  };
  const openEditStudent = (s) => {
    setEditingStudentId(s.studentId);
    setStudentForm({
      name: s.name || '',
      nationalId: s.nationalId || '',
      phone: s.phone || '',
      email: s.email || '',
      age: s.age != null ? String(s.age) : '',
      gender: s.gender || '',
      notes: s.notes || '',
      programId: s.programId || ''
    });
    setShowStudentForm(true);
  };
  const saveStudent = async () => {
    if (!studentForm.name.trim() || !studentForm.programId) {
      return toast.error(isRTL ? 'الاسم والبرنامج مطلوبان' : 'Name and program are required');
    }
    setSavingStudent(true);
    try {
      const payload = {
        ...studentForm,
        age: studentForm.age === '' ? null : Number(studentForm.age)
      };
      if (editingStudentId) {
        await api.put(`/summer/students/${editingStudentId}`, payload);
        toast.success(isRTL ? 'تم تحديث الطالب' : 'Student updated');
      } else {
        await api.post('/summer/students', payload);
        toast.success(isRTL ? 'تم إضافة الطالب' : 'Student added');
      }
      setShowStudentForm(false);
      setEditingStudentId(null);
      fetchStudents();
    } catch (err) { console.error(err); toast.error(isRTL ? 'خطأ في الحفظ' : 'Error saving'); }
    finally { setSavingStudent(false); }
  };
  const deleteStudent = async (id) => {
    if (!window.confirm(isRTL ? 'حذف الطالب؟' : 'Delete this student?')) return;
    try { await api.delete(`/summer/students/${id}`); toast.success(isRTL ? 'تم الحذف' : 'Deleted'); fetchStudents(); }
    catch (err) { console.error(err); toast.error(isRTL ? 'خطأ' : 'Error'); }
  };

  // ---------- Render helpers ----------
  const teacherById = (id) => teachers.find(t => t.teacherId === id);
  const programById = (id) => programs.find(p => p.programId === id);

  const filteredStudents = studentProgramFilter
    ? students.filter(s => s.programId === studentProgramFilter)
    : students;

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

      {/* ============= PROGRAMS ============= */}
      {subTab === 'programs' && (
        <div className="summer-panel">
          <div className="summer-panel-header">
            <h3>{isRTL ? 'البرامج' : 'Programs'}</h3>
            <button className="summer-btn-primary" onClick={openCreateProgram}>
              + {isRTL ? 'إضافة برنامج' : 'Add Program'}
            </button>
          </div>

          {loading.programs ? (
            <p style={{ color: '#64748b' }}>{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
          ) : programs.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
              {isRTL ? 'لا توجد برامج. ابدأ بإضافة أول برنامج.' : 'No programs yet. Start by adding one.'}
            </p>
          ) : (
            <div className="summer-grid">
              {programs.map(p => {
                const t = p.teacher || (p.teacherId ? teacherById(p.teacherId) : null);
                const studentNumActual = Array.isArray(p.students) ? p.students.length : 0;
                return (
                  <div key={p.programId} className="summer-card">
                    <div className="summer-card-head">
                      <strong className="summer-card-name">{p.name}</strong>
                      <span className="summer-card-section">{sectionLabel(p.fablabSection, isRTL)}</span>
                    </div>
                    <div className="summer-card-meta">
                      <div><span>{isRTL ? 'المعلم:' : 'Teacher:'}</span> {t ? t.name : (p.teacherName || '—')}</div>
                      <div>
                        <span>{isRTL ? 'الفترة:' : 'Dates:'}</span> {(p.startDate || '').slice(0,10)} → {(p.endDate || '').slice(0,10)}
                      </div>
                      {(p.startTime || p.endTime) && (
                        <div><span>{isRTL ? 'الوقت:' : 'Time:'}</span> {(p.startTime || '').slice(0,5)} → {(p.endTime || '').slice(0,5)}</div>
                      )}
                      <div><span>{isRTL ? 'الطلاب:' : 'Students:'}</span> {studentNumActual}{p.studentCount ? ` / ${p.studentCount}` : ''}</div>
                      {Array.isArray(p.sectionVolunteers) && p.sectionVolunteers.length > 0 && (
                        <div className="summer-card-volunteers">
                          <span>{isRTL ? 'المتطوعون:' : 'Volunteers:'}</span>{' '}
                          {p.sectionVolunteers.map((v, i) => (
                            <span key={i} className="summer-volunteer-chip">{v}</span>
                          ))}
                        </div>
                      )}
                      {p.notes && <div className="summer-card-notes">{p.notes}</div>}
                    </div>
                    <div className="summer-card-actions">
                      <button className="summer-btn-secondary" onClick={() => openEditProgram(p)}>{isRTL ? 'تعديل' : 'Edit'}</button>
                      <button className="summer-btn-danger" onClick={() => deleteProgram(p.programId)}>{isRTL ? 'حذف' : 'Delete'}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============= TEACHERS ============= */}
      {subTab === 'teachers' && (
        <div className="summer-panel">
          <div className="summer-panel-header">
            <h3>{isRTL ? 'المعلمون' : 'Teachers'}</h3>
            <button className="summer-btn-primary" onClick={openCreateTeacher}>
              + {isRTL ? 'إضافة معلم' : 'Add Teacher'}
            </button>
          </div>

          {loading.teachers ? (
            <p style={{ color: '#64748b' }}>{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
          ) : teachers.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
              {isRTL ? 'لا يوجد معلمون.' : 'No teachers yet.'}
            </p>
          ) : (
            <div className="summer-grid">
              {teachers.map(t => (
                <div key={t.teacherId} className="summer-card teacher-card">
                  <div className="summer-card-head">
                    <strong className="summer-card-name">{t.name}</strong>
                    <span className="summer-card-section">{sectionLabel(t.fablabSection, isRTL)}</span>
                  </div>
                  <div className="summer-card-meta">
                    {t.phone && <div><span>{isRTL ? 'الجوال:' : 'Phone:'}</span> <span dir="ltr">{t.phone}</span></div>}
                    {t.email && <div><span>{isRTL ? 'البريد:' : 'Email:'}</span> <span dir="ltr">{t.email}</span></div>}
                    {t.nationalId && <div><span>{isRTL ? 'الهوية:' : 'National ID:'}</span> <span dir="ltr">{t.nationalId}</span></div>}
                    {Array.isArray(t.programs) && t.programs.length > 0 && (
                      <div className="summer-card-volunteers">
                        <span>{isRTL ? 'البرامج:' : 'Programs:'}</span>{' '}
                        {t.programs.map(p => (
                          <span key={p.programId} className="summer-volunteer-chip">{p.name}</span>
                        ))}
                      </div>
                    )}
                    <div className="teacher-score">
                      <span className="teacher-score-pill awards">
                        +{t.totalAwards || 0}
                      </span>
                      <span className="teacher-score-pill deductions">
                        −{t.totalDeductions || 0}
                      </span>
                      <span className={`teacher-score-pill net ${(t.netPoints || 0) >= 0 ? 'positive' : 'negative'}`}>
                        {isRTL ? 'صافي' : 'Net'}: {t.netPoints || 0}
                      </span>
                    </div>
                    {Array.isArray(t.ratings) && t.ratings.length > 0 && (
                      <details style={{ marginTop: 6 }}>
                        <summary style={{ cursor: 'pointer', fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>
                          {isRTL ? `سجل التقييمات (${t.ratings.length})` : `Ratings (${t.ratings.length})`}
                        </summary>
                        <div className="teacher-ratings-list">
                          {t.ratings.map(r => (
                            <div key={r.ratingId} className={`teacher-rating-row ${r.type}`}>
                              <div>
                                <strong>{r.type === 'award' ? `+${r.points}` : `−${r.points}`}</strong>
                                {r.criteria ? ` • ${r.criteria}` : ''}
                                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{(r.ratingDate || '').slice(0,10)}</div>
                              </div>
                              <button className="summer-btn-danger" onClick={() => deleteRating(r.ratingId)} style={{ padding: '2px 8px', fontSize: '0.72rem' }}>×</button>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                  <div className="summer-card-actions">
                    <button className="summer-btn-secondary" onClick={() => openEditTeacher(t)}>{isRTL ? 'تعديل' : 'Edit'}</button>
                    <button className="summer-btn-rate" onClick={() => openRateTeacher(t)}>★ {isRTL ? 'تقييم' : 'Rate'}</button>
                    <button className="summer-btn-danger" onClick={() => deleteTeacher(t.teacherId)}>{isRTL ? 'حذف' : 'Delete'}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============= SUMMER VOLUNTEERS ============= */}
      {subTab === 'volunteers' && (
        <div className="summer-panel">
          <div className="summer-panel-header">
            <h3>{isRTL ? 'متطوعو الصيف' : 'Summer Volunteers'}</h3>
            <button className="summer-btn-primary" onClick={openCreateSummerVolunteer}>
              + {isRTL ? 'إضافة متطوع' : 'Add Volunteer'}
            </button>
          </div>

          <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 0.75rem 0' }}>
            {isRTL ? 'هؤلاء المتطوعون يظهرون أيضاً في تبويب المتطوعين الرئيسي مع نفس سجل التقييمات والفرص.' : 'These volunteers also appear in the main Volunteers tab with the same ratings and opportunity history.'}
          </p>

          {loading.volunteers ? (
            <p style={{ color: '#64748b' }}>{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
          ) : summerVolunteers.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
              {isRTL ? 'لا يوجد متطوعون مرتبطون ببرامج صيفية.' : 'No volunteers linked to a summer program yet.'}
            </p>
          ) : (
            <div className="summer-grid">
              {summerVolunteers.map(v => {
                const prog = v.summerProgram || programById(v.summerProgramId);
                const awards = (v.ratings || []).filter(r => r.type === 'award').reduce((s, r) => s + (r.points || 0), 0);
                const deductions = (v.ratings || []).filter(r => r.type === 'deduction').reduce((s, r) => s + (r.points || 0), 0);
                const net = awards - deductions;
                return (
                  <div key={v.volunteerId} className="summer-card teacher-card">
                    <div className="summer-card-head">
                      <strong className="summer-card-name">{v.name}</strong>
                      {prog && <span className="summer-card-section">{prog.name}</span>}
                    </div>
                    <div className="summer-card-meta">
                      {v.phone && <div><span>{isRTL ? 'الجوال:' : 'Phone:'}</span> <span dir="ltr">{v.phone}</span></div>}
                      {v.email && <div><span>{isRTL ? 'البريد:' : 'Email:'}</span> <span dir="ltr">{v.email}</span></div>}
                      {v.nationalId && <div><span>{isRTL ? 'الهوية:' : 'National ID:'}</span> <span dir="ltr">{v.nationalId}</span></div>}
                      <div className="teacher-score">
                        <span className="teacher-score-pill awards">+{awards}</span>
                        <span className="teacher-score-pill deductions">−{deductions}</span>
                        <span className={`teacher-score-pill net ${net >= 0 ? 'positive' : 'negative'}`}>
                          {isRTL ? 'صافي' : 'Net'}: {net}
                        </span>
                      </div>
                    </div>
                    <div className="summer-card-actions">
                      <button className="summer-btn-secondary" onClick={() => openEditSummerVolunteer(v)}>{isRTL ? 'تعديل' : 'Edit'}</button>
                      <button className="summer-btn-rate" onClick={() => openRateSummerVolunteer(v)}>★ {isRTL ? 'تقييم' : 'Rate'}</button>
                      <button className="summer-btn-danger" onClick={() => deleteSummerVolunteer(v.volunteerId)}>{isRTL ? 'حذف' : 'Delete'}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============= STUDENTS ============= */}
      {subTab === 'students' && (
        <div className="summer-panel">
          <div className="summer-panel-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3>{isRTL ? 'الطلاب' : 'Students'}</h3>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={studentProgramFilter}
                onChange={(e) => setStudentProgramFilter(e.target.value)}
                style={{ padding: '0.45rem 0.7rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }}
              >
                <option value="">{isRTL ? 'كل البرامج' : 'All programs'}</option>
                {programs.map(p => (
                  <option key={p.programId} value={p.programId}>{p.name}</option>
                ))}
              </select>
              <button className="summer-btn-primary" onClick={() => openCreateStudent()}>
                + {isRTL ? 'إضافة طالب' : 'Add Student'}
              </button>
            </div>
          </div>

          {loading.students ? (
            <p style={{ color: '#64748b' }}>{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
          ) : filteredStudents.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
              {isRTL ? 'لا يوجد طلاب.' : 'No students yet.'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {filteredStudents.map(s => {
                const prog = s.program || programById(s.programId);
                const expanded = openStudentId === s.studentId;
                return (
                  <div key={s.studentId} className="summer-student-row">
                    <div className="summer-student-row-head">
                      <div className="summer-student-row-name">
                        <strong>{s.name}</strong>
                        {s.age && <span style={{ marginInlineStart: 8, color: '#64748b', fontSize: '0.82rem' }}>{s.age} {isRTL ? 'سنة' : 'yrs'}</span>}
                      </div>
                      <div className="summer-student-row-meta">
                        {prog && <span className="summer-volunteer-chip">{prog.name}</span>}
                        {s.phone && <span dir="ltr" style={{ fontSize: '0.78rem', color: '#475569' }}>{s.phone}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          className="summer-btn-secondary"
                          onClick={() => setOpenStudentId(expanded ? null : s.studentId)}
                        >
                          {expanded ? (isRTL ? 'إخفاء الحضور' : 'Hide Attendance') : (isRTL ? 'الحضور' : 'Attendance')}
                        </button>
                        <button className="summer-btn-secondary" onClick={() => openEditStudent(s)}>{isRTL ? 'تعديل' : 'Edit'}</button>
                        <button className="summer-btn-danger" onClick={() => deleteStudent(s.studentId)}>{isRTL ? 'حذف' : 'Delete'}</button>
                      </div>
                    </div>
                    {expanded && (
                      <div style={{ padding: '0 1rem 1rem 1rem' }}>
                        {prog ? (
                          <AttendanceLog
                            opportunity={{
                              opportunityId: s.studentId,
                              startDate: prog.startDate,
                              endDate: prog.endDate,
                              attendanceDays: s.attendanceDays
                            }}
                            isRTL={isRTL}
                            onSaved={fetchStudents}
                            apiPath="/summer/students"
                            hideHours={true}
                          />
                        ) : (
                          <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
                            {isRTL ? 'الطالب غير مرتبط ببرنامج له فترة محددة.' : 'Student is not linked to a program with a date range.'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============= Program form modal ============= */}
      {showProgramForm && (
        <div className="summer-modal-overlay" onClick={() => !savingProgram && setShowProgramForm(false)}>
          <div className="summer-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingProgramId ? (isRTL ? 'تعديل برنامج' : 'Edit Program') : (isRTL ? 'إضافة برنامج' : 'Add Program')}</h3>
            <div className="summer-form-grid">
              <div className="summer-field full">
                <label>{isRTL ? 'اسم البرنامج' : 'Program Name'} *</label>
                <input value={programForm.name} onChange={(e) => setProgramForm({ ...programForm, name: e.target.value })} />
              </div>
              <div className="summer-field full">
                <label>{isRTL ? 'المعلم المسؤول' : 'Assigned Teacher'}</label>
                <select
                  value={programForm.teacherId}
                  onChange={(e) => {
                    const t = teacherById(e.target.value);
                    setProgramForm({
                      ...programForm,
                      teacherId: e.target.value,
                      teacherName: t ? t.name : programForm.teacherName
                    });
                  }}
                >
                  <option value="">— {isRTL ? 'بدون أو اكتب الاسم بالأسفل' : 'None or type name below'} —</option>
                  {teachers.map(t => (
                    <option key={t.teacherId} value={t.teacherId}>{t.name}{t.fablabSection ? ` — ${sectionLabel(t.fablabSection, isRTL)}` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="summer-field full">
                <label>{isRTL ? 'أو اسم المعلم (نص حر)' : 'Or Teacher Name (free text)'}</label>
                <input value={programForm.teacherName} onChange={(e) => setProgramForm({ ...programForm, teacherName: e.target.value })} />
              </div>
              <div className="summer-field">
                <label>{isRTL ? 'عدد الطلاب' : 'Number of Students'}</label>
                <input type="number" min="0" value={programForm.studentCount} onChange={(e) => setProgramForm({ ...programForm, studentCount: e.target.value })} />
              </div>
              <div className="summer-field">
                <label>{isRTL ? 'القسم في فاب لاب' : 'FabLab Section'}</label>
                <select value={programForm.fablabSection} onChange={(e) => setProgramForm({ ...programForm, fablabSection: e.target.value })}>
                  <option value="">—</option>
                  {STANDARD_SECTIONS.map(s => (
                    <option key={s.value} value={s.value}>{isRTL ? s.labelAr : s.labelEn}</option>
                  ))}
                </select>
              </div>
              <div className="summer-field">
                <label>{isRTL ? 'تاريخ البداية' : 'Start Date'} *</label>
                <input type="date" value={programForm.startDate} onChange={(e) => setProgramForm({ ...programForm, startDate: e.target.value })} />
              </div>
              <div className="summer-field">
                <label>{isRTL ? 'تاريخ النهاية' : 'End Date'} *</label>
                <input type="date" value={programForm.endDate} onChange={(e) => setProgramForm({ ...programForm, endDate: e.target.value })} />
              </div>
              <div className="summer-field">
                <label>{isRTL ? 'وقت البداية' : 'Start Time'}</label>
                <input type="time" value={programForm.startTime} onChange={(e) => setProgramForm({ ...programForm, startTime: e.target.value })} />
              </div>
              <div className="summer-field">
                <label>{isRTL ? 'وقت النهاية' : 'End Time'}</label>
                <input type="time" value={programForm.endTime} onChange={(e) => setProgramForm({ ...programForm, endTime: e.target.value })} />
              </div>
              <div className="summer-field full">
                <label>{isRTL ? 'متطوعو القسم (أسماء مفصولة بفواصل)' : 'Section Volunteers (comma-separated)'}</label>
                <input value={programForm.sectionVolunteers} onChange={(e) => setProgramForm({ ...programForm, sectionVolunteers: e.target.value })} />
              </div>
              <div className="summer-field full">
                <label>{isRTL ? 'ملاحظات' : 'Notes'}</label>
                <textarea rows={2} value={programForm.notes} onChange={(e) => setProgramForm({ ...programForm, notes: e.target.value })} />
              </div>
            </div>
            <div className="summer-modal-actions">
              <button className="summer-btn-secondary" disabled={savingProgram} onClick={() => setShowProgramForm(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
              <button className="summer-btn-primary" disabled={savingProgram} onClick={saveProgram}>
                {savingProgram ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (editingProgramId ? (isRTL ? 'حفظ التعديل' : 'Save Changes') : (isRTL ? 'إضافة' : 'Add'))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============= Teacher form modal ============= */}
      {showTeacherForm && (
        <div className="summer-modal-overlay" onClick={() => !savingTeacher && setShowTeacherForm(false)}>
          <div className="summer-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingTeacherId ? (isRTL ? 'تعديل معلم' : 'Edit Teacher') : (isRTL ? 'إضافة معلم' : 'Add Teacher')}</h3>

            {!editingTeacherId && (
              <div style={{
                background: '#eef2ff', border: '1.5px solid #c7d2fe',
                padding: '0.75rem 1rem', borderRadius: 10, marginBottom: '0.75rem'
              }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: 6 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, color: '#3730a3' }}>
                    <input
                      type="radio"
                      name="teacherSource"
                      checked={teacherForm.source === 'manual'}
                      onChange={() => setTeacherForm({ ...teacherForm, source: 'manual', employeeId: '' })}
                    />
                    {isRTL ? 'إدخال يدوي (معلم جديد)' : 'Manual entry (new teacher)'}
                  </label>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, color: '#3730a3' }}>
                    <input
                      type="radio"
                      name="teacherSource"
                      checked={teacherForm.source === 'employee'}
                      onChange={() => setTeacherForm({ ...teacherForm, source: 'employee' })}
                    />
                    {isRTL ? 'اختيار من موظفي فاب لاب' : 'Pick from FabLab employees'}
                  </label>
                </div>
                {teacherForm.source === 'employee' && (
                  <select
                    value={teacherForm.employeeId}
                    onChange={(e) => fillFromEmployee(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #c7d2fe', fontFamily: 'inherit', background: 'white' }}
                  >
                    <option value="">— {isRTL ? 'اختر الموظف' : 'Select an employee'} —</option>
                    {employees.map(e => {
                      const id = e.employeeId || e.id;
                      const sec = e.section || e.fablabSection || '';
                      const label = `${e.fullName || e.name}${sec ? ` — ${sec}` : ''}`;
                      return <option key={id} value={id}>{label}</option>;
                    })}
                  </select>
                )}
                {teacherForm.source === 'employee' && (
                  <p style={{ fontSize: '0.75rem', color: '#475569', margin: '6px 0 0 0' }}>
                    {isRTL ? 'يمكنك تعديل الحقول أدناه قبل الحفظ.' : 'You can edit the fields below before saving.'}
                  </p>
                )}
              </div>
            )}

            <div className="summer-form-grid">
              <div className="summer-field full">
                <label>{isRTL ? 'الاسم' : 'Name'} *</label>
                <input value={teacherForm.name} onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })} />
              </div>
              <div className="summer-field">
                <label>{isRTL ? 'رقم الهوية' : 'National ID'}</label>
                <input dir="ltr" value={teacherForm.nationalId} onChange={(e) => setTeacherForm({ ...teacherForm, nationalId: e.target.value })} />
              </div>
              <div className="summer-field">
                <label>{isRTL ? 'الجوال' : 'Phone'}</label>
                <input dir="ltr" value={teacherForm.phone} onChange={(e) => setTeacherForm({ ...teacherForm, phone: e.target.value })} />
              </div>
              <div className="summer-field full">
                <label>{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
                <input type="email" dir="ltr" value={teacherForm.email} onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })} />
              </div>

              <div className="summer-field full">
                <label>{isRTL ? 'القسم في فاب لاب' : 'FabLab Section'}</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="radio"
                      name="sectionMode"
                      checked={teacherForm.sectionMode === 'standard'}
                      onChange={() => setTeacherForm({ ...teacherForm, sectionMode: 'standard' })}
                    />
                    {isRTL ? 'من القائمة' : 'From list'}
                  </label>
                  <label style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="radio"
                      name="sectionMode"
                      checked={teacherForm.sectionMode === 'custom'}
                      onChange={() => setTeacherForm({ ...teacherForm, sectionMode: 'custom' })}
                    />
                    {isRTL ? 'قسم جديد (نص حر)' : 'Custom section'}
                  </label>
                </div>
                {teacherForm.sectionMode === 'standard' ? (
                  <select
                    value={teacherForm.fablabSection}
                    onChange={(e) => setTeacherForm({ ...teacherForm, fablabSection: e.target.value })}
                    style={{ marginTop: 6 }}
                  >
                    <option value="">—</option>
                    {STANDARD_SECTIONS.map(s => (
                      <option key={s.value} value={s.value}>{isRTL ? s.labelAr : s.labelEn}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    placeholder={isRTL ? 'اكتب اسم القسم الجديد' : 'Type the new section name'}
                    value={teacherForm.customSection}
                    onChange={(e) => setTeacherForm({ ...teacherForm, customSection: e.target.value })}
                    style={{ marginTop: 6 }}
                  />
                )}
              </div>

              <div className="summer-field full">
                <label>{isRTL ? 'نبذة / تخصص' : 'Bio / Specialty'}</label>
                <textarea rows={2} value={teacherForm.bio} onChange={(e) => setTeacherForm({ ...teacherForm, bio: e.target.value })} />
              </div>
            </div>
            <div className="summer-modal-actions">
              <button className="summer-btn-secondary" disabled={savingTeacher} onClick={() => setShowTeacherForm(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
              <button className="summer-btn-primary" disabled={savingTeacher} onClick={saveTeacher}>
                {savingTeacher ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (editingTeacherId ? (isRTL ? 'حفظ التعديل' : 'Save Changes') : (isRTL ? 'إضافة' : 'Add'))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============= Rating modal ============= */}
      {ratingTarget && (
        <div className="summer-modal-overlay" onClick={() => !savingRating && setRatingTarget(null)}>
          <div className="summer-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3>{isRTL ? `تقييم: ${ratingTarget.name}` : `Rate: ${ratingTarget.name}`}</h3>
            <div className="summer-form-grid">
              <div className="summer-field">
                <label>{isRTL ? 'النوع' : 'Type'}</label>
                <select value={ratingForm.type} onChange={(e) => setRatingForm({ ...ratingForm, type: e.target.value })}>
                  <option value="award">{isRTL ? 'مكافأة (+)' : 'Award (+)'}</option>
                  <option value="deduction">{isRTL ? 'خصم (−)' : 'Deduction (−)'}</option>
                </select>
              </div>
              <div className="summer-field">
                <label>{isRTL ? 'النقاط (1-5)' : 'Points (1-5)'}</label>
                <input type="number" min="1" max="5" value={ratingForm.points}
                  onChange={(e) => setRatingForm({ ...ratingForm, points: Math.max(1, Math.min(5, Number(e.target.value) || 1)) })} />
              </div>
              <div className="summer-field full">
                <label>{isRTL ? 'البرنامج المرتبط (اختياري)' : 'Related Program (optional)'}</label>
                <select value={ratingForm.programId} onChange={(e) => setRatingForm({ ...ratingForm, programId: e.target.value })}>
                  <option value="">—</option>
                  {programs.map(p => (
                    <option key={p.programId} value={p.programId}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="summer-field full">
                <label>{isRTL ? 'المعيار' : 'Criteria'}</label>
                <input value={ratingForm.criteria} onChange={(e) => setRatingForm({ ...ratingForm, criteria: e.target.value })}
                  placeholder={isRTL ? 'مثال: التزام بالحضور، جودة الشرح' : 'e.g. Punctuality, Quality of teaching'} />
              </div>
              <div className="summer-field full">
                <label>{isRTL ? 'ملاحظات' : 'Notes'}</label>
                <textarea rows={2} value={ratingForm.notes} onChange={(e) => setRatingForm({ ...ratingForm, notes: e.target.value })} />
              </div>
              <div className="summer-field">
                <label>{isRTL ? 'التاريخ' : 'Date'}</label>
                <input type="date" value={ratingForm.ratingDate} onChange={(e) => setRatingForm({ ...ratingForm, ratingDate: e.target.value })} />
              </div>
            </div>
            <div className="summer-modal-actions">
              <button className="summer-btn-secondary" disabled={savingRating} onClick={() => setRatingTarget(null)}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
              <button className="summer-btn-primary" disabled={savingRating} onClick={submitRating}>
                {savingRating ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ التقييم' : 'Save Rating')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============= Summer Volunteer form modal ============= */}
      {showSummerVolunteerForm && (
        <div className="summer-modal-overlay" onClick={() => !savingSummerVolunteer && setShowSummerVolunteerForm(false)}>
          <div className="summer-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingSummerVolunteerId ? (isRTL ? 'تعديل متطوع' : 'Edit Volunteer') : (isRTL ? 'إضافة متطوع' : 'Add Volunteer')}</h3>
            <div className="summer-form-grid">
              <div className="summer-field full">
                <label>{isRTL ? 'البرنامج' : 'Program'} *</label>
                <select value={summerVolunteerForm.summerProgramId}
                  onChange={(e) => setSummerVolunteerForm({ ...summerVolunteerForm, summerProgramId: e.target.value })}>
                  <option value="">— {isRTL ? 'اختر البرنامج' : 'Select a program'} —</option>
                  {programs.map(p => (
                    <option key={p.programId} value={p.programId}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="summer-field full">
                <label>{isRTL ? 'الاسم الكامل' : 'Full Name'} *</label>
                <input value={summerVolunteerForm.name}
                  onChange={(e) => setSummerVolunteerForm({ ...summerVolunteerForm, name: e.target.value })} />
              </div>
              <div className="summer-field">
                <label>{isRTL ? 'رقم الهوية' : 'National ID'} *</label>
                <input dir="ltr" value={summerVolunteerForm.nationalId}
                  onChange={(e) => setSummerVolunteerForm({ ...summerVolunteerForm, nationalId: e.target.value })} />
              </div>
              <div className="summer-field">
                <label>{isRTL ? 'الجوال' : 'Phone'} *</label>
                <input dir="ltr" value={summerVolunteerForm.phone}
                  onChange={(e) => setSummerVolunteerForm({ ...summerVolunteerForm, phone: e.target.value })} />
              </div>
              <div className="summer-field full">
                <label>{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
                <input type="email" dir="ltr" value={summerVolunteerForm.email}
                  onChange={(e) => setSummerVolunteerForm({ ...summerVolunteerForm, email: e.target.value })} />
              </div>
            </div>
            <div className="summer-modal-actions">
              <button className="summer-btn-secondary" disabled={savingSummerVolunteer} onClick={() => setShowSummerVolunteerForm(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
              <button className="summer-btn-primary" disabled={savingSummerVolunteer} onClick={saveSummerVolunteer}>
                {savingSummerVolunteer ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (editingSummerVolunteerId ? (isRTL ? 'حفظ التعديل' : 'Save Changes') : (isRTL ? 'إضافة' : 'Add'))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============= Summer Volunteer Rating modal ============= */}
      {summerVolunteerRatingTarget && (
        <div className="summer-modal-overlay" onClick={() => setSummerVolunteerRatingTarget(null)}>
          <div className="summer-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3>{isRTL ? `تقييم: ${summerVolunteerRatingTarget.name}` : `Rate: ${summerVolunteerRatingTarget.name}`}</h3>
            <div className="summer-form-grid">
              <div className="summer-field">
                <label>{isRTL ? 'النوع' : 'Type'}</label>
                <select value={summerVolunteerRatingForm.type}
                  onChange={(e) => setSummerVolunteerRatingForm({ ...summerVolunteerRatingForm, type: e.target.value })}>
                  <option value="award">{isRTL ? 'مكافأة (+)' : 'Award (+)'}</option>
                  <option value="deduction">{isRTL ? 'خصم (−)' : 'Deduction (−)'}</option>
                </select>
              </div>
              <div className="summer-field">
                <label>{isRTL ? 'النقاط (1-5)' : 'Points (1-5)'}</label>
                <input type="number" min="1" max="5" value={summerVolunteerRatingForm.points}
                  onChange={(e) => setSummerVolunteerRatingForm({ ...summerVolunteerRatingForm, points: Math.max(1, Math.min(5, Number(e.target.value) || 1)) })} />
              </div>
              <div className="summer-field full">
                <label>{isRTL ? 'المعيار' : 'Criteria'}</label>
                <input value={summerVolunteerRatingForm.criteria}
                  onChange={(e) => setSummerVolunteerRatingForm({ ...summerVolunteerRatingForm, criteria: e.target.value })} />
              </div>
              <div className="summer-field full">
                <label>{isRTL ? 'ملاحظات' : 'Notes'}</label>
                <textarea rows={2} value={summerVolunteerRatingForm.notes}
                  onChange={(e) => setSummerVolunteerRatingForm({ ...summerVolunteerRatingForm, notes: e.target.value })} />
              </div>
              <div className="summer-field">
                <label>{isRTL ? 'التاريخ' : 'Date'}</label>
                <input type="date" value={summerVolunteerRatingForm.ratingDate}
                  onChange={(e) => setSummerVolunteerRatingForm({ ...summerVolunteerRatingForm, ratingDate: e.target.value })} />
              </div>
            </div>
            <div className="summer-modal-actions">
              <button className="summer-btn-secondary" onClick={() => setSummerVolunteerRatingTarget(null)}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
              <button className="summer-btn-primary" onClick={submitSummerVolunteerRating}>{isRTL ? 'حفظ التقييم' : 'Save Rating'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ============= Student form modal ============= */}
      {showStudentForm && (
        <div className="summer-modal-overlay" onClick={() => !savingStudent && setShowStudentForm(false)}>
          <div className="summer-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingStudentId ? (isRTL ? 'تعديل طالب' : 'Edit Student') : (isRTL ? 'إضافة طالب' : 'Add Student')}</h3>
            <div className="summer-form-grid">
              <div className="summer-field full">
                <label>{isRTL ? 'البرنامج' : 'Program'} *</label>
                <select value={studentForm.programId} onChange={(e) => setStudentForm({ ...studentForm, programId: e.target.value })}>
                  <option value="">— {isRTL ? 'اختر البرنامج' : 'Select program'} —</option>
                  {programs.map(p => (
                    <option key={p.programId} value={p.programId}>
                      {p.name} ({(p.startDate || '').slice(0,10)} → {(p.endDate || '').slice(0,10)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="summer-field full">
                <label>{isRTL ? 'الاسم الكامل' : 'Full Name'} *</label>
                <input value={studentForm.name} onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })} />
              </div>
              <div className="summer-field">
                <label>{isRTL ? 'رقم الهوية' : 'National ID'}</label>
                <input dir="ltr" value={studentForm.nationalId} onChange={(e) => setStudentForm({ ...studentForm, nationalId: e.target.value })} />
              </div>
              <div className="summer-field">
                <label>{isRTL ? 'الجوال' : 'Phone'}</label>
                <input dir="ltr" value={studentForm.phone} onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })} />
              </div>
              <div className="summer-field">
                <label>{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
                <input type="email" dir="ltr" value={studentForm.email} onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })} />
              </div>
              <div className="summer-field">
                <label>{isRTL ? 'العمر' : 'Age'}</label>
                <input type="number" min="0" value={studentForm.age} onChange={(e) => setStudentForm({ ...studentForm, age: e.target.value })} />
              </div>
              <div className="summer-field">
                <label>{isRTL ? 'الجنس' : 'Gender'}</label>
                <select value={studentForm.gender} onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value })}>
                  <option value="">—</option>
                  <option value="Male">{isRTL ? 'ذكر' : 'Male'}</option>
                  <option value="Female">{isRTL ? 'أنثى' : 'Female'}</option>
                </select>
              </div>
              <div className="summer-field full">
                <label>{isRTL ? 'ملاحظات' : 'Notes'}</label>
                <textarea rows={2} value={studentForm.notes} onChange={(e) => setStudentForm({ ...studentForm, notes: e.target.value })} />
              </div>
            </div>
            <div className="summer-modal-actions">
              <button className="summer-btn-secondary" disabled={savingStudent} onClick={() => setShowStudentForm(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
              <button className="summer-btn-primary" disabled={savingStudent} onClick={saveStudent}>
                {savingStudent ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (editingStudentId ? (isRTL ? 'حفظ التعديل' : 'Save Changes') : (isRTL ? 'إضافة' : 'Add'))}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SummerFablab;
