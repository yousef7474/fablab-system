import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../../config/api';
import AttendanceLog from '../shared/AttendanceLog';
import UnifiedAttendancePage from '../shared/UnifiedAttendancePage';
import './SummerFablab.css';

// ID-card constants + helpers shared between single + bulk print flows.
// The card is designed to fit at 72×102 mm so 4 fit on one A4 portrait
// page (2×2 grid) — same physical size Mawhba uses so the ID cards
// look consistent across programs.
const CARD_PRINT_CSS = `
  @page { size: A4 portrait; margin: 14mm 12mm; }
  html, body { margin: 0; padding: 0; background: #f1f5f9; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
  body { padding: 18mm 0; }

  .sf-print-page {
    width: 186mm;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 72mm 72mm;
    grid-template-rows: 102mm 102mm;
    column-gap: 18mm;
    row-gap: 14mm;
    justify-content: center;
    page-break-after: always;
  }
  .sf-print-page:last-child { page-break-after: auto; }

  .sf-card {
    width: 72mm; height: 102mm;
    background: white;
    box-sizing: border-box;
    overflow: hidden;
    color: #0f172a;
    position: relative;
    border: 0.45mm dashed #475569;
  }
  .sf-card::after {
    content: '';
    position: absolute; left: 0; right: 0; bottom: 0;
    height: 1.5mm;
    background: var(--sc, #f97316);
  }
  .sf-card-top {
    background: linear-gradient(135deg, var(--sc, #f97316) 0%, var(--scd, #7c2d12) 100%);
    padding: 2.5mm 3.5mm;
    display: flex; justify-content: space-between; align-items: center;
    color: white; height: 13mm;
    box-sizing: border-box;
  }
  .sf-card-brand { display: flex; align-items: center; gap: 2mm; }
  .sf-card-logo {
    width: 8mm; height: 8mm;
    background: white; border-radius: 1.5mm;
    padding: 0.6mm; object-fit: contain;
    box-sizing: border-box;
  }
  .sf-card-fablab { font-size: 7pt; font-weight: 800; line-height: 1.1; color: white; }
  .sf-card-fablab-en { font-size: 5pt; letter-spacing: 0.8px; color: rgba(255,255,255,0.78); margin-top: 0.3mm; }
  .sf-card-program-title { text-align: end; }
  .sf-card-program-ar { font-size: 10pt; font-weight: 800; color: white; line-height: 1; }
  .sf-card-program-en { font-size: 4.5pt; letter-spacing: 1.5px; color: rgba(255,255,255,0.75); margin-top: 0.6mm; }

  .sf-card-body { padding: 3mm 4mm 0; }
  .sf-card-name {
    font-size: 11pt; font-weight: 800; text-align: center;
    padding-bottom: 2mm;
    border-bottom: 0.4mm solid var(--sc, #f97316);
    margin-bottom: 3mm;
    line-height: 1.2; color: #0f172a;
    overflow: hidden; text-overflow: ellipsis;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  }
  .sf-card-field {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: 1.8mm; gap: 2mm;
  }
  .sf-card-field-label {
    font-size: 6pt; color: var(--sc, #f97316);
    font-weight: 800; letter-spacing: 0.4px; white-space: nowrap;
  }
  .sf-card-field-value {
    font-size: 8.5pt; font-weight: 700; color: #0f172a;
    text-align: end; word-break: break-word;
  }
  .sf-card-field-value.mono {
    font-family: 'Consolas', 'Courier New', monospace;
    letter-spacing: 0.3px;
  }
  .sf-card-course {
    background: var(--sc, #f97316); color: white;
    text-align: center;
    padding: 1.8mm 2mm;
    margin: 3mm 4mm 3mm;
    border-radius: 1.5mm;
  }
  .sf-card-course-name { font-size: 9pt; font-weight: 800; color: white; line-height: 1.15; }

  .sf-card-bottom { text-align: center; padding: 0 2mm 3mm; }
  .sf-card-qr {
    width: 40mm; height: 40mm; display: block; margin: 0 auto;
    background: white; padding: 1mm;
    border: 0.3mm solid #cbd5e1;
    border-radius: 1.5mm;
    box-sizing: border-box;
  }
  .sf-card-qr-label {
    margin-top: 1.8mm;
    font-size: 7pt; letter-spacing: 1.5px;
    color: var(--scd, #0f172a);
    font-weight: 800;
  }

  .sf-print-note {
    max-width: 186mm; margin: 0 auto 8mm;
    padding: 8px 14px; background: white; border-radius: 8px;
    font-size: 12px; color: #475569;
    text-align: center; border: 1px dashed #cbd5e1;
  }
  @media print {
    body { background: white; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sf-print-page { margin: 0 auto; }
    .sf-print-note { display: none; }
    .sf-card { box-shadow: none; break-inside: avoid; }
  }
`;

const renderSummerCardHtml = ({ student, qrDataUrl, color, colorDark, programName }) => {
  const logoSrc = `${window.location.origin}/fablab.png`;
  const safe = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  return `
    <div class="sf-card" dir="rtl" style="--sc:${color}; --scd:${colorDark};">
      <div class="sf-card-top">
        <div class="sf-card-brand">
          <img src="${logoSrc}" alt="FabLab" class="sf-card-logo" />
          <div>
            <div class="sf-card-fablab">فاب لاب الأحساء</div>
            <div class="sf-card-fablab-en">FABLAB</div>
          </div>
        </div>
        <div class="sf-card-program-title">
          <div class="sf-card-program-ar">صيف فاب لاب</div>
          <div class="sf-card-program-en">SUMMER</div>
        </div>
      </div>
      <div class="sf-card-body">
        <div class="sf-card-name">${safe(student.name || '')}</div>
        <div class="sf-card-field">
          <span class="sf-card-field-label">الهوية</span>
          <span class="sf-card-field-value mono">${safe(student.nationalId || '—')}</span>
        </div>
        ${student.age ? `<div class="sf-card-field">
          <span class="sf-card-field-label">العمر</span>
          <span class="sf-card-field-value">${safe(student.age)}</span>
        </div>` : ''}
        ${student.phone ? `<div class="sf-card-field">
          <span class="sf-card-field-label">الجوال</span>
          <span class="sf-card-field-value mono">${safe(student.phone)}</span>
        </div>` : ''}
      </div>
      <div class="sf-card-course">
        <div class="sf-card-course-name">${safe(programName || '—')}</div>
      </div>
      <div class="sf-card-bottom">
        <img src="${qrDataUrl}" alt="QR" class="sf-card-qr" />
        <div class="sf-card-qr-label">رمز الحضور</div>
      </div>
    </div>`;
};

const openCardsPrintWindow = (cards, isRTL) => {
  if (cards.length === 0) {
    toast.error(isRTL ? 'لا توجد بطاقات للطباعة' : 'No cards to print');
    return;
  }
  const win = window.open('', '_blank', 'width=900,height=1100');
  if (!win) {
    toast.error(isRTL ? 'تم منع النوافذ المنبثقة' : 'Pop-up blocked — allow pop-ups');
    return;
  }
  const pages = [];
  for (let i = 0; i < cards.length; i += 4) {
    pages.push(`<div class="sf-print-page">${cards.slice(i, i + 4).join('')}</div>`);
  }
  const note = isRTL
    ? `${cards.length} بطاقة · ${pages.length} صفحة · حجم البطاقة: 72×102 ملم · اقطع حسب الخط المتقطع`
    : `${cards.length} card(s) · ${pages.length} page(s) · Card size: 72×102 mm · Cut along the dashed line`;
  win.document.open();
  win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${isRTL ? 'بطاقات صيف فاب لاب' : 'Summer FabLab Cards'}</title><style>${CARD_PRINT_CSS}</style></head><body><div class="sf-print-note">${note}</div>${pages.join('')}<script>window.onload=function(){setTimeout(function(){window.print()},500)}</script></body></html>`);
  win.document.close();
};

const durationMin = (rec) => {
  if (!rec?.checkInAt || !rec?.checkOutAt) return null;
  const d = (new Date(rec.checkOutAt) - new Date(rec.checkInAt)) / 60000;
  return Math.max(0, Math.round(d));
};
const fmtLogTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

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
  fablabSection: '', sectionVolunteers: [], extraVolunteers: '', notes: ''
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
      const list = Array.isArray(res.data) ? res.data : (res.data?.employees || []);
      // Show active employees only.
      setEmployees(list.filter(e => e.isActive !== false));
    } catch (err) {
      console.error('employees fetch failed:', err);
      toast.error(isRTL ? 'تعذر تحميل قائمة الموظفين' : "Couldn't load employees list");
    }
  }, [isRTL]);

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
    // tabs). Teachers, volunteers, and employees are also referenced
    // by the program/teacher forms, so load them upfront too.
    fetchPrograms();
    fetchTeachers();
    fetchEmployees();
    fetchVolunteers();
  }, [fetchPrograms, fetchTeachers, fetchEmployees, fetchVolunteers]);

  useEffect(() => {
    if (subTab === 'students') fetchStudents();
  }, [subTab, fetchStudents]);

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
      // Split saved names: matches against existing volunteers stay in
      // sectionVolunteers, anything else falls into a free-text bucket
      // so we don't lose names of volunteers that may have been deleted.
      ...(function () {
        const saved = Array.isArray(p.sectionVolunteers) ? p.sectionVolunteers : [];
        const known = new Set(allVolunteers.map(v => v.name));
        return {
          sectionVolunteers: saved.filter(n => known.has(n)),
          extraVolunteers: saved.filter(n => !known.has(n)).join(', ')
        };
      })(),
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
    // Combine picked volunteers with the free-text extras (kept for
    // backwards compatibility — admin can still type names of people
    // who aren't yet in the volunteers list).
    const extras = (programForm.extraVolunteers || '')
      .split(',').map(s => s.trim()).filter(Boolean);
    const allNames = [...(programForm.sectionVolunteers || []), ...extras];
    const payload = {
      ...programForm,
      teacherId: programForm.teacherId || null,
      studentCount: programForm.studentCount === '' ? 0 : Number(programForm.studentCount),
      sectionVolunteers: allNames
    };
    delete payload.extraVolunteers;
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

  // ---------- ID cards, selection, attendance ----------
  const [selectedStudentIds, setSelectedStudentIds] = useState(() => new Set());
  const [printingCards, setPrintingCards] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);

  // Per-student attendance log modal
  const [logStudent, setLogStudent] = useState(null);
  const [logRecords, setLogRecords] = useState([]);
  const [logLoading, setLogLoading] = useState(false);

  const toggleSelectStudent = (id) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAllFiltered = () => {
    setSelectedStudentIds(prev => {
      const allIds = filteredStudents.map(s => s.studentId);
      const allSelected = allIds.every(id => prev.has(id));
      const next = new Set(prev);
      if (allSelected) allIds.forEach(id => next.delete(id));
      else             allIds.forEach(id => next.add(id));
      return next;
    });
  };

  const printOneStudentCard = async (s) => {
    if (!s.nationalId) {
      return toast.error(isRTL
        ? 'رقم الهوية مطلوب لطباعة البطاقة'
        : 'National ID is required to print an ID card');
    }
    setPrintingCards(true);
    try {
      const { data } = await api.get(`/summer/students/${s.studentId}/card`);
      openCardsPrintWindow([renderSummerCardHtml(data)], isRTL);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.messageAr || err.response?.data?.message
        || (isRTL ? 'تعذر تحضير البطاقة' : 'Failed to prepare card'));
    } finally {
      setPrintingCards(false);
    }
  };

  const printSelectedStudentCards = async () => {
    const ids = [...selectedStudentIds];
    if (ids.length === 0) {
      return toast.warning(isRTL ? 'اختر طالباً واحداً على الأقل' : 'Select at least one student');
    }
    setPrintingCards(true);
    try {
      const { data } = await api.post('/summer/students/cards', { studentIds: ids });
      const cards = (data.cards || []).map(renderSummerCardHtml);
      if (data.skipped?.length) {
        toast.warning(isRTL
          ? `${data.skipped.length} طالب بدون رقم هوية تم تخطيه`
          : `${data.skipped.length} student(s) skipped (no national ID)`);
      }
      openCardsPrintWindow(cards, isRTL);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'تعذر تحضير البطاقات' : 'Failed to prepare cards');
    } finally {
      setPrintingCards(false);
    }
  };

  const printAllStudentCards = async () => {
    const ids = filteredStudents.filter(s => s.nationalId).map(s => s.studentId);
    if (ids.length === 0) {
      return toast.warning(isRTL
        ? 'لا يوجد طلاب بأرقام هوية لطباعتهم'
        : 'No students with national IDs to print');
    }
    setPrintingCards(true);
    try {
      const { data } = await api.post('/summer/students/cards', { studentIds: ids });
      const cards = (data.cards || []).map(renderSummerCardHtml);
      openCardsPrintWindow(cards, isRTL);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'تعذر تحضير البطاقات' : 'Failed to prepare cards');
    } finally {
      setPrintingCards(false);
    }
  };

  const openAttendanceLog = async (s) => {
    setLogStudent(s);
    setLogRecords([]);
    setLogLoading(true);
    try {
      const { data } = await api.get(`/summer/students/${s.studentId}/attendance`);
      setLogRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'تعذر تحميل سجل الحضور' : 'Failed to load attendance log');
    } finally {
      setLogLoading(false);
    }
  };
  const closeAttendanceLog = () => { setLogStudent(null); setLogRecords([]); };
  const deleteLogRecord = async (rec) => {
    if (!window.confirm(isRTL ? `حذف سجل ${rec.date}؟` : `Delete record for ${rec.date}?`)) return;
    try {
      await api.delete(`/summer/attendance/${rec.attendanceId}`);
      setLogRecords(prev => prev.filter(r => r.attendanceId !== rec.attendanceId));
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'فشل الحذف' : 'Delete failed');
    }
  };
  const clearLogCheckout = async (rec) => {
    if (!window.confirm(isRTL
      ? `حذف تسجيل الخروج لتاريخ ${rec.date}؟ سيبقى تسجيل الدخول محفوظاً.`
      : `Clear check-out for ${rec.date}? Check-in will remain.`)) return;
    try {
      await api.patch(`/summer/attendance/${rec.attendanceId}/checkout`);
      setLogRecords(prev => prev.map(r => r.attendanceId === rec.attendanceId
        ? { ...r, checkOutAt: null } : r));
      toast.success(isRTL ? 'تم حذف تسجيل الخروج' : 'Check-out cleared');
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'فشل الحذف' : 'Clear failed');
    }
  };

  const logSummary = (() => {
    let total = 0, completed = 0, stillIn = 0, minutes = 0;
    for (const r of logRecords) {
      total++;
      if (r.checkInAt && r.checkOutAt) {
        completed++;
        const d = durationMin(r);
        if (d != null) minutes += d;
      } else if (r.checkInAt) {
        stillIn++;
      }
    }
    return {
      total, completed, stillIn,
      hours: Math.floor(minutes / 60),
      minutes: minutes % 60
    };
  })();

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
              <button
                className="summer-btn-secondary"
                onClick={() => setAttendanceOpen(true)}
                title={isRTL ? 'فتح صفحة الحضور المخصصة (USB scanner)' : 'Open dedicated attendance page'}
                style={{ background: '#0ea5e9', color: '#fff', borderColor: '#0ea5e9' }}
              >
                {'📷'} {isRTL ? 'صفحة الحضور' : 'Attendance Page'}
              </button>
              <button
                className="summer-btn-secondary"
                onClick={printSelectedStudentCards}
                disabled={printingCards || selectedStudentIds.size === 0}
                title={isRTL ? 'طباعة بطاقات المحددين (٤ في ورقة A4)' : 'Print selected IDs (4 per A4 page)'}
              >
                {'🖨'} {isRTL
                  ? `طباعة المحددين (${selectedStudentIds.size})`
                  : `Print selected (${selectedStudentIds.size})`}
              </button>
              <button
                className="summer-btn-secondary"
                onClick={printAllStudentCards}
                disabled={printingCards || filteredStudents.length === 0}
                title={isRTL ? 'طباعة كل بطاقات الطلاب (٤ في الورقة)' : 'Print all IDs (4 per A4 page)'}
              >
                {'🖨'} {isRTL ? 'طباعة الكل ٤ في ورقة' : 'Print all (4-up)'}
              </button>
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
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.75rem', background: '#f8fafc',
                borderRadius: 8, fontSize: '0.82rem', color: '#475569'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentIds.has(s.studentId))}
                    onChange={toggleSelectAllFiltered}
                  />
                  <span>{isRTL ? 'تحديد الكل المرئي' : 'Select all visible'}</span>
                </label>
                {selectedStudentIds.size > 0 && (
                  <button
                    onClick={() => setSelectedStudentIds(new Set())}
                    style={{
                      marginInlineStart: 'auto',
                      padding: '0.25rem 0.75rem', borderRadius: 6,
                      border: '1px solid #cbd5e1', background: '#fff',
                      cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'inherit'
                    }}
                  >
                    {isRTL ? 'إلغاء التحديد' : 'Clear selection'}
                  </button>
                )}
              </div>

              {filteredStudents.map(s => {
                const prog = s.program || programById(s.programId);
                const expanded = openStudentId === s.studentId;
                const selected = selectedStudentIds.has(s.studentId);
                return (
                  <div key={s.studentId} className="summer-student-row">
                    <div className="summer-student-row-head">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelectStudent(s.studentId)}
                        title={isRTL ? 'تحديد لطباعة البطاقة' : 'Select for card print'}
                        style={{ marginInlineEnd: '0.5rem', cursor: 'pointer' }}
                      />
                      <div className="summer-student-row-name">
                        <strong>{s.name}</strong>
                        {s.age && <span style={{ marginInlineStart: 8, color: '#64748b', fontSize: '0.82rem' }}>{s.age} {isRTL ? 'سنة' : 'yrs'}</span>}
                        {!s.nationalId && (
                          <span
                            title={isRTL ? 'رقم الهوية مطلوب للبطاقة' : 'National ID required for the ID card'}
                            style={{
                              marginInlineStart: 8, padding: '2px 8px', borderRadius: 999,
                              background: 'rgba(245,158,11,0.15)', color: '#92400e',
                              fontSize: '0.68rem', fontWeight: 700,
                              border: '1px solid rgba(245,158,11,0.35)'
                            }}
                          >
                            {isRTL ? 'بدون هوية' : 'No ID'}
                          </span>
                        )}
                      </div>
                      <div className="summer-student-row-meta">
                        {prog && <span className="summer-volunteer-chip">{prog.name}</span>}
                        {s.phone && <span dir="ltr" style={{ fontSize: '0.78rem', color: '#475569' }}>{s.phone}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          className="summer-btn-secondary"
                          onClick={() => printOneStudentCard(s)}
                          disabled={printingCards || !s.nationalId}
                          title={isRTL ? 'طباعة بطاقة QR للطالب' : 'Print QR ID card'}
                        >
                          {'📇'} {isRTL ? 'طباعة الهوية' : 'Print ID'}
                        </button>
                        <button
                          className="summer-btn-secondary"
                          onClick={() => openAttendanceLog(s)}
                          title={isRTL ? 'سجل حضور الطالب (QR)' : 'QR attendance log'}
                        >
                          {'📅'} {isRTL ? 'سجل الحضور' : 'Log'}
                        </button>
                        <button
                          className="summer-btn-secondary"
                          onClick={() => setOpenStudentId(expanded ? null : s.studentId)}
                        >
                          {expanded ? (isRTL ? 'إخفاء الأيام' : 'Hide Days') : (isRTL ? 'أيام البرنامج' : 'Program Days')}
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

      {/* Dedicated attendance page (USB HID scanner) — shared across all programs */}
      <UnifiedAttendancePage
        open={attendanceOpen}
        onClose={() => setAttendanceOpen(false)}
        isRTL={isRTL}
      />

      {/* Per-student QR attendance log modal */}
      {logStudent && (
        <div
          className="summer-modal-overlay"
          onClick={closeAttendanceLog}
          style={{ zIndex: 1200 }}
        >
          <div
            className="summer-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 720, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
          >
            <h3 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              {'📅'} {isRTL ? `سجل الحضور — ${logStudent.name}` : `Attendance Log — ${logStudent.name}`}
            </h3>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: 8, marginBottom: 12
            }}>
              {[
                { label: isRTL ? 'إجمالي الأيام' : 'Total days', value: logSummary.total },
                { label: isRTL ? 'مكتملة' : 'Completed', value: logSummary.completed },
                { label: isRTL ? 'لم يخرج بعد' : 'Still in', value: logSummary.stillIn },
                { label: isRTL ? 'إجمالي الوقت' : 'Total time', value: `${logSummary.hours}h ${logSummary.minutes}m` }
              ].map((stat, i) => (
                <div key={i} style={{
                  background: '#f8fafc', border: '1px solid #e2e8f0',
                  borderRadius: 8, padding: '10px 12px', textAlign: 'center'
                }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{stat.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 3 }}>{stat.value}</div>
                </div>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
              {logLoading ? (
                <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>
                  {isRTL ? 'جارٍ التحميل...' : 'Loading...'}
                </div>
              ) : logRecords.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>
                  {isRTL ? 'لا يوجد سجل حضور بعد' : 'No attendance records yet'}
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'start', borderBottom: '1px solid #e2e8f0' }}>{isRTL ? 'التاريخ' : 'Date'}</th>
                      <th style={{ padding: '8px 10px', textAlign: 'start', borderBottom: '1px solid #e2e8f0' }}>{isRTL ? 'الدخول' : 'Check In'}</th>
                      <th style={{ padding: '8px 10px', textAlign: 'start', borderBottom: '1px solid #e2e8f0' }}>{isRTL ? 'الخروج' : 'Check Out'}</th>
                      <th style={{ padding: '8px 10px', textAlign: 'start', borderBottom: '1px solid #e2e8f0' }}>{isRTL ? 'المدة' : 'Duration'}</th>
                      <th style={{ padding: '8px 10px', textAlign: 'start', borderBottom: '1px solid #e2e8f0' }}>{isRTL ? 'الحالة' : 'Status'}</th>
                      <th style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {logRecords.map(r => {
                      const dur = durationMin(r);
                      const completed = !!(r.checkInAt && r.checkOutAt);
                      return (
                        <tr key={r.attendanceId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 10px', fontFamily: 'Consolas, monospace' }}>{r.date}</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'Consolas, monospace' }}>{fmtLogTime(r.checkInAt)}</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'Consolas, monospace' }}>{fmtLogTime(r.checkOutAt)}</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'Consolas, monospace' }}>{dur != null ? `${Math.floor(dur / 60)}h ${dur % 60}m` : '—'}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{
                              display: 'inline-block', padding: '2px 10px', borderRadius: 999,
                              fontSize: 11, fontWeight: 700,
                              background: completed ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.15)',
                              color: completed ? '#166534' : '#92400e',
                              border: completed ? '1px solid rgba(34,197,94,0.35)' : '1px solid rgba(245,158,11,0.35)'
                            }}>
                              {completed ? (isRTL ? '✓ مكتمل' : '✓ Complete') : (isRTL ? '⏳ داخل الآن' : '⏳ Still in')}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {r.checkOutAt && (
                                <button
                                  onClick={() => clearLogCheckout(r)}
                                  title={isRTL ? 'حذف تسجيل الخروج فقط' : 'Clear check-out only'}
                                  style={{
                                    padding: '3px 8px', borderRadius: 5,
                                    border: '1px solid #f59e0b', background: '#fff',
                                    color: '#d97706', cursor: 'pointer', fontFamily: 'inherit',
                                    fontSize: 12, fontWeight: 700
                                  }}
                                >↩</button>
                              )}
                              <button
                                onClick={() => deleteLogRecord(r)}
                                title={isRTL ? 'حذف السجل بالكامل' : 'Delete entire record'}
                                style={{
                                  padding: '3px 8px', borderRadius: 5,
                                  border: '1px solid #ef4444', background: '#fff',
                                  color: '#ef4444', cursor: 'pointer', fontFamily: 'inherit',
                                  fontSize: 12, fontWeight: 700
                                }}
                              >×</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="summer-btn-secondary" onClick={closeAttendanceLog}>
                {isRTL ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
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
                <label>{isRTL ? 'متطوعو القسم' : 'Section Volunteers'}</label>
                {allVolunteers.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.25rem 0' }}>
                    {isRTL ? 'لا يوجد متطوعون. أضفهم من تبويب المتطوعين أولاً.' : 'No volunteers yet. Add some from the Volunteers tab first.'}
                  </p>
                ) : (
                  <div style={{
                    border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '0.5rem',
                    maxHeight: 180, overflowY: 'auto', background: '#fff'
                  }}>
                    {allVolunteers.map(v => {
                      const checked = (programForm.sectionVolunteers || []).includes(v.name);
                      return (
                        <label key={v.volunteerId} style={{
                          display: 'flex', alignItems: 'center', gap: '0.5rem',
                          padding: '0.25rem 0.4rem', cursor: 'pointer',
                          fontSize: '0.86rem', borderRadius: 4,
                          background: checked ? '#fef3c7' : 'transparent'
                        }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const current = programForm.sectionVolunteers || [];
                              setProgramForm({
                                ...programForm,
                                sectionVolunteers: e.target.checked
                                  ? [...current, v.name]
                                  : current.filter(n => n !== v.name)
                              });
                            }}
                          />
                          <span>{v.name}</span>
                          {v.summerProgramId && (
                            <span style={{ fontSize: '0.7rem', background: '#dbeafe', color: '#1d4ed8', padding: '1px 6px', borderRadius: 999 }}>
                              {isRTL ? 'صيفي' : 'summer'}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
                <input
                  style={{ marginTop: 6, fontSize: '0.85rem' }}
                  placeholder={isRTL ? 'أسماء إضافية مفصولة بفواصل (اختياري)' : 'Extra names, comma-separated (optional)'}
                  value={programForm.extraVolunteers}
                  onChange={(e) => setProgramForm({ ...programForm, extraVolunteers: e.target.value })}
                />
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
                  <>
                    <select
                      value={teacherForm.employeeId}
                      onChange={(e) => fillFromEmployee(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #c7d2fe', fontFamily: 'inherit', background: 'white' }}
                    >
                      <option value="">
                        — {employees.length === 0
                          ? (isRTL ? 'لا يوجد موظفون مسجلون' : 'No employees on file')
                          : (isRTL ? `اختر الموظف (${employees.length})` : `Select an employee (${employees.length})`)} —
                      </option>
                      {employees.map(e => {
                        const id = e.employeeId || e.id;
                        const sec = e.section || e.fablabSection || '';
                        const label = `${e.name || e.fullName}${sec ? ` — ${sec}` : ''}`;
                        return <option key={id} value={id}>{label}</option>;
                      })}
                    </select>
                    <p style={{ fontSize: '0.75rem', color: '#475569', margin: '6px 0 0 0' }}>
                      {employees.length === 0
                        ? (isRTL ? 'لم يتم تحميل أي موظفين. تحقق من تبويب الموظفين أو حاول إعادة فتح هذه النافذة.' : 'No employees were loaded. Check the Employees tab or reopen this dialog.')
                        : (isRTL ? 'يمكنك تعديل الحقول أدناه قبل الحفظ.' : 'You can edit the fields below before saving.')}
                    </p>
                  </>
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
