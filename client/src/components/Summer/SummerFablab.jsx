import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../../config/api';
import AttendanceLog from '../shared/AttendanceLog';
import UnifiedAttendancePage from '../shared/UnifiedAttendancePage';
import VolunteerShareControls from '../shared/VolunteerShareControls';
import MasterShareBar from '../shared/MasterShareBar';
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
  name: '', teacherName: '', teacherIds: [], studentCount: '',
  startDate: '', endDate: '', startTime: '', endTime: '',
  fablabSection: '', sectionVolunteers: [], extraVolunteers: '', notes: '',
  color: ''
};

// Preset colors offered in the program form. Kept small and distinct so
// programs are visually easy to tell apart on cards and printed ID cards.
const PROGRAM_COLOR_PALETTE = [
  '#EE2329', // fablab red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#64748b'  // slate
];

// FabLab section → theme color fallback, mirrors the palette used in
// the admin panel + summerStudentController. Only used when a program
// doesn't have its own explicit `color` set yet.
const SECTION_COLORS = {
  'Electronics and Programming': '#6366f1',
  'CNC Laser':                   '#22c55e',
  'CNC Wood':                    '#f59e0b',
  '3D':                          '#ef4444',
  'Robotic and AI':              '#8b5cf6',
  "Kid's Club":                  '#06b6d4',
  'Vinyl Cutting':               '#ec4899'
};
const DEFAULT_PROGRAM_COLOR = '#f97316'; // Summer FabLab orange

// Palette used for the auto-color fallback. Same 12 vibrant hues the
// admin can pick from in the color picker.
const AUTO_COLOR_POOL = [
  '#EE2329', '#f97316', '#f59e0b', '#eab308',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
  '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899'
];

// Deterministic hash → 0..pool.length-1. Same input always maps to the
// same slot, so every program keeps its auto-color stable across sessions.
const hashToIndex = (str, mod) => {
  const s = String(str || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % mod;
};

// Pick the display color for anything belonging to a program (student
// ID card, volunteer card, etc). Priority:
//   1. Explicit `program.color` chosen in the color picker
//   2. FabLab section → SECTION_COLORS map
//   3. Hash of programId → AUTO_COLOR_POOL (guarantees a distinct,
//      stable color per program even when nothing is configured)
const colorForProgram = (prog) => {
  if (!prog) return DEFAULT_PROGRAM_COLOR;
  if (typeof prog.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(prog.color)) return prog.color;
  if (prog.fablabSection && SECTION_COLORS[prog.fablabSection]) return SECTION_COLORS[prog.fablabSection];
  return AUTO_COLOR_POOL[hashToIndex(prog.programId || prog.name, AUTO_COLOR_POOL.length)];
};
const emptyTeacherForm = {
  source: 'manual', // 'manual' | 'employee' — see Teacher modal
  employeeId: '',
  name: '', nationalId: '', phone: '', email: '',
  fablabSection: '', sectionMode: 'standard', customSection: '',
  bio: ''
};
const emptySummerVolunteerForm = {
  // 'existing' = pick from the main Volunteers list (default, since most
  // summer volunteers are recurring FabLab volunteers). 'manual' = type
  // a brand-new person who isn't in the main list yet.
  mode: 'existing',
  existingVolunteerId: '',
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
    // teacherIds is the new multi-teacher shape. If a program was saved
    // under the old single-teacherId schema, seed from that so nothing
    // gets lost when reopening pre-migration records.
    const savedTeacherIds = Array.isArray(p.teacherIds) && p.teacherIds.length
      ? p.teacherIds
      : (p.teacherId ? [p.teacherId] : []);
    setProgramForm({
      name: p.name || '',
      teacherName: p.teacherName || '',
      teacherIds: savedTeacherIds,
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
      notes: p.notes || '',
      color: p.color || ''
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
      teacherIds: Array.isArray(programForm.teacherIds) ? programForm.teacherIds : [],
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
      mode: 'manual', // edit is always a plain field update, no re-pick
      existingVolunteerId: v.volunteerId,
      name: v.name || '',
      nationalId: v.nationalId || '',
      phone: v.phone || '',
      email: v.email || '',
      summerProgramId: v.summerProgramId || ''
    });
    setShowSummerVolunteerForm(true);
  };

  // Volunteers eligible to be picked from the main list: not soft-deleted
  // and not already linked to any summer program. When editing an
  // existing summer volunteer, we include them so the current selection
  // still renders in the dropdown.
  const availableVolunteersForSummer = allVolunteers.filter(v => (
    !v.summerProgramId || v.volunteerId === editingSummerVolunteerId
  ));

  const selectExistingVolunteer = (volunteerId) => {
    const v = allVolunteers.find(x => x.volunteerId === volunteerId);
    setSummerVolunteerForm(prev => ({
      ...prev,
      existingVolunteerId: volunteerId,
      name: v?.name || '',
      nationalId: v?.nationalId || '',
      phone: v?.phone || '',
      email: v?.email || ''
    }));
  };

  const saveSummerVolunteer = async () => {
    // "Pick existing" path: just assign the summerProgramId onto an
    // already-created volunteer — don't require the admin to re-type
    // fields that are already on file.
    if (!editingSummerVolunteerId && summerVolunteerForm.mode === 'existing') {
      if (!summerVolunteerForm.existingVolunteerId) {
        return toast.error(isRTL ? 'يرجى اختيار متطوع من القائمة' : 'Please select a volunteer from the list');
      }
      if (!summerVolunteerForm.summerProgramId) {
        return toast.error(isRTL ? 'يرجى اختيار البرنامج' : 'Please select a program');
      }
      setSavingSummerVolunteer(true);
      try {
        await api.put(`/volunteers/${summerVolunteerForm.existingVolunteerId}`, {
          summerProgramId: summerVolunteerForm.summerProgramId
        });
        toast.success(isRTL ? 'تم ربط المتطوع بالبرنامج' : 'Volunteer linked to program');
        setShowSummerVolunteerForm(false);
        setEditingSummerVolunteerId(null);
        fetchVolunteers();
      } catch (err) {
        console.error(err);
        const msg = err.response?.data?.messageAr || err.response?.data?.message || (isRTL ? 'خطأ في الحفظ' : 'Error saving');
        toast.error(msg);
      } finally { setSavingSummerVolunteer(false); }
      return;
    }

    // Manual create / edit path
    if (!summerVolunteerForm.name.trim() || !summerVolunteerForm.nationalId.trim() || !summerVolunteerForm.phone.trim()) {
      return toast.error(isRTL ? 'الاسم ورقم الهوية والجوال مطلوبة' : 'Name, national ID and phone are required');
    }
    if (!summerVolunteerForm.summerProgramId) {
      return toast.error(isRTL ? 'يرجى اختيار البرنامج' : 'Please select a program');
    }
    setSavingSummerVolunteer(true);
    try {
      const payload = {
        name: summerVolunteerForm.name,
        nationalId: summerVolunteerForm.nationalId,
        phone: summerVolunteerForm.phone,
        email: summerVolunteerForm.email,
        summerProgramId: summerVolunteerForm.summerProgramId
      };
      if (editingSummerVolunteerId) {
        await api.put(`/volunteers/${editingSummerVolunteerId}`, payload);
        toast.success(isRTL ? 'تم تحديث المتطوع' : 'Volunteer updated');
      } else {
        await api.post('/volunteers', payload);
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
  // Inline check-out edit + manual-add (same UX as workshop / volunteer)
  const [editingCheckoutId, setEditingCheckoutId] = useState(null);
  const [editingCheckoutValue, setEditingCheckoutValue] = useState('');
  const [savingCheckout, setSavingCheckout] = useState(false);
  const [showAddManual, setShowAddManual] = useState(false);
  const [manualForm, setManualForm] = useState({ date: '', checkInAt: '', checkOutAt: '' });
  const [savingManual, setSavingManual] = useState(false);

  const beginEditCheckout = (rec) => {
    setEditingCheckoutId(rec.attendanceId);
    if (rec.checkOutAt) {
      const d = new Date(rec.checkOutAt);
      setEditingCheckoutValue(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    } else if (rec.checkInAt) {
      const d = new Date(new Date(rec.checkInAt).getTime() + 60 * 60 * 1000);
      setEditingCheckoutValue(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    } else setEditingCheckoutValue('18:00');
  };
  const cancelEditCheckout = () => { setEditingCheckoutId(null); setEditingCheckoutValue(''); };
  const saveCheckoutTime = async (rec) => {
    if (!editingCheckoutValue) return toast.error(isRTL ? 'أدخل وقت الخروج' : 'Enter time');
    setSavingCheckout(true);
    try {
      const { data } = await api.patch(`/summer/attendance/${rec.attendanceId}/checkout`, {
        checkOutAt: editingCheckoutValue
      });
      setLogRecords(prev => prev.map(r =>
        r.attendanceId === rec.attendanceId
          ? { ...r, checkOutAt: data?.record?.checkOutAt || null }
          : r
      ));
      toast.success(isRTL ? 'تم الحفظ' : 'Saved');
      cancelEditCheckout();
    } catch (err) {
      const msg = err?.response?.data?.messageAr || err?.response?.data?.message;
      toast.error(msg || (isRTL ? 'فشل الحفظ' : 'Save failed'));
    } finally { setSavingCheckout(false); }
  };
  const submitManualAttendance = async () => {
    if (!logStudent) return;
    if (!manualForm.date) return toast.error(isRTL ? 'أدخل التاريخ' : 'Enter date');
    if (!manualForm.checkInAt && !manualForm.checkOutAt) {
      return toast.error(isRTL ? 'أدخل وقت الدخول أو الخروج على الأقل' : 'Enter at least check-in or check-out');
    }
    setSavingManual(true);
    try {
      const { data } = await api.post('/summer/attendance', {
        studentId: logStudent.studentId,
        date: manualForm.date,
        checkInAt: manualForm.checkInAt || undefined,
        checkOutAt: manualForm.checkOutAt || undefined
      });
      setLogRecords(prev => {
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
    } finally { setSavingManual(false); }
  };

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

  // Certificate print — same visual language as the workshop cert:
  // A4 landscape, foundation + FABLAB logos, gradient border,
  // stats cards. Colored per the student's summer program so
  // certificates from different programs stay distinct.
  const printSummerCertificate = async (s) => {
    const prog = s.program || programById(s.programId);
    const color = (prog && colorForProgram(prog)) || '#e02529';
    const studentName = s.name || (isRTL ? 'الطالب' : 'Student');
    const certId = 'SUM-' + (s.studentId?.substring(0, 8).toUpperCase() || Date.now());

    // Fetch attendance history from SummerStudentAttendance — same
    // source used everywhere else (log modal, unified attendance
    // page). Counting rows where the student checked in on a
    // distinct calendar day.
    let attendedDays = 0;
    try {
      const { data } = await api.get(`/summer/students/${s.studentId}/attendance`);
      const rows = Array.isArray(data) ? data : [];
      const distinct = new Set();
      for (const r of rows) {
        if (r?.date && r?.checkInAt) distinct.add(String(r.date).slice(0, 10));
      }
      attendedDays = distinct.size;
    } catch (err) {
      console.error('summer cert: failed to fetch attendance', err);
      // Fall back to the legacy JSON field on the student row so
      // the cert can still be produced if the endpoint is offline.
      attendedDays = Array.isArray(s.attendanceDates)
        ? s.attendanceDates.length
        : (Array.isArray(s.attendanceDays)
            ? s.attendanceDays.filter(d => d?.attended).length
            : 0);
    }

    // Program duration + required-days threshold (attend > 50% of days)
    const progDays = (() => {
      if (!prog?.startDate) return 1;
      const start = new Date(prog.startDate);
      const end = prog.endDate ? new Date(prog.endDate) : start;
      return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
    })();
    const reqDays = Math.ceil(progDays / 2);
    if (attendedDays < reqDays) {
      toast.error(isRTL
        ? `يجب على الطالب حضور ${reqDays} يوم على الأقل من أصل ${progDays} يوم. الحضور الحالي: ${attendedDays} يوم`
        : `Must attend ${reqDays} of ${progDays} days. Attended: ${attendedDays}`);
      return;
    }

    const startDateF = prog?.startDate ? prog.startDate.split('-').reverse().join('/') : '';
    const printWindow = window.open('', '_blank');
    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>شهادة صيف فاب لاب - ${studentName}</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 297mm; height: 210mm; overflow: hidden; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%); display: flex; align-items: center; justify-content: center; padding: 10mm; }
  .certificate { width: 277mm; height: 190mm; background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%); border-radius: 16px; position: relative; overflow: hidden; box-shadow: 0 30px 60px rgba(0,0,0,0.3); }
  .certificate::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; border: 6px solid transparent; border-image: linear-gradient(135deg, ${color}, #ff6b6b, #feca57, #48dbfb, ${color}) 1; border-radius: 16px; pointer-events: none; }
  .decor-circle { position: absolute; border-radius: 50%; opacity: 0.1; }
  .decor-circle.c1 { width: 200px; height: 200px; background: linear-gradient(135deg, ${color}, #ff6b6b); top: -50px; right: -50px; }
  .decor-circle.c2 { width: 150px; height: 150px; background: linear-gradient(135deg, #667eea, #764ba2); bottom: -30px; left: -30px; }
  .decor-circle.c3 { width: 100px; height: 100px; background: linear-gradient(135deg, #feca57, #ff9f43); top: 50%; left: 20px; transform: translateY(-50%); }
  .decor-circle.c4 { width: 80px; height: 80px; background: linear-gradient(135deg, #48dbfb, #0abde3); bottom: 60px; right: 40px; }
  .certificate-inner { padding: 20mm 25mm; height: 100%; display: flex; flex-direction: column; position: relative; z-index: 1; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12mm; }
  .logo-container { display: flex; align-items: center; gap: 15px; }
  .logo { height: 85px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.15)); }
  .header-center { text-align: center; flex: 1; padding: 0 20px; }
  .org-name { font-size: 11px; color: #64748b; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 5px; }
  .cert-title { font-size: 44px; font-weight: 800; background: linear-gradient(135deg, ${color}, #ff6b6b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 4px; }
  .cert-subtitle { font-size: 16px; color: #475569; font-weight: 500; letter-spacing: 3px; }
  .divider { height: 4px; background: linear-gradient(90deg, ${color}, #ff6b6b, #feca57, #48dbfb, #667eea, #764ba2); border-radius: 2px; margin-bottom: 10mm; }
  .main-content { text-align: center; flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .presents-text { font-size: 14px; color: #64748b; margin-bottom: 8px; }
  .student-name { font-size: 42px; font-weight: 700; color: #1e293b; margin-bottom: 8px; position: relative; display: inline-block; }
  .student-name::after { content: ''; position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%); width: 80%; height: 4px; background: linear-gradient(90deg, ${color}, #ff6b6b, #feca57); border-radius: 2px; }
  .appreciation-text { font-size: 15px; line-height: 1.8; color: #475569; max-width: 600px; margin: 15px auto; }
  .highlight { color: ${color}; font-weight: 700; font-size: 17px; }
  .stats-container { display: flex; justify-content: center; gap: 30px; margin: 12px 0; }
  .stat-card { background: linear-gradient(135deg, ${color}, #ff6b6b); color: white; padding: 12px 30px; border-radius: 12px; text-align: center; box-shadow: 0 8px 20px ${color}55; min-width: 140px; }
  .stat-card.alt { background: linear-gradient(135deg, #667eea, #764ba2); box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3); }
  .stat-card.gold { background: linear-gradient(135deg, #f59e0b, #fbbf24); box-shadow: 0 8px 20px rgba(245, 158, 11, 0.3); }
  .stat-value { font-size: 22px; font-weight: 700; }
  .stat-label { font-size: 10px; opacity: 0.9; margin-top: 2px; }
  .thank-you { font-size: 13px; color: #64748b; margin-top: 10px; font-style: italic; }
  .hadith { color: ${color}; font-weight: 600; }
  .footer-section { display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; padding-top: 10mm; }
  .cert-info { text-align: left; }
  .cert-id { font-family: 'Courier New', monospace; font-size: 10px; color: #94a3b8; background: linear-gradient(135deg, #f1f5f9, #e2e8f0); padding: 6px 14px; border-radius: 20px; display: inline-block; }
  .cert-date { font-size: 10px; color: #94a3b8; margin-top: 5px; }
  .org-footer { text-align: center; flex: 1; }
  .org-footer-text { font-size: 10px; color: #94a3b8; }
  .ribbon { position: absolute; top: 25px; left: -35px; width: 150px; height: 30px; background: linear-gradient(135deg, ${color}, #c41e24); transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: 600; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
  @media print {
    html, body { width: 297mm; height: 210mm; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    body { padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%) !important; }
    .certificate { box-shadow: none; margin: auto; }
    .cert-title { -webkit-text-fill-color: ${color}; color: ${color}; }
  }
</style>
</head>
<body>
  <div class="certificate">
    <div class="decor-circle c1"></div>
    <div class="decor-circle c2"></div>
    <div class="decor-circle c3"></div>
    <div class="decor-circle c4"></div>
    <div class="ribbon">صيف فاب لاب</div>
    <div class="certificate-inner">
      <div class="header">
        <div class="logo-container"><img src="/found.png" alt="Foundation" class="logo" /></div>
        <div class="header-center">
          <div class="org-name">مؤسسة عبدالمنعم الراشد الإنسانية</div>
          <div class="cert-title">شهادة إتمام برنامج صيفي</div>
          <div class="cert-subtitle">SUMMER FABLAB CERTIFICATE</div>
        </div>
        <div class="logo-container"><img src="/fablab.png" alt="FABLAB" class="logo" /></div>
      </div>
      <div class="divider"></div>
      <div class="main-content">
        <div class="presents-text">تشهد إدارة فاب لاب الأحساء بأن</div>
        <div class="student-name">${studentName}</div>
        <div class="appreciation-text">
          قد أتم بنجاح البرنامج الصيفي
          ${prog?.name ? `<span class="highlight">"${prog.name}"</span>` : ''}
          <br/>
          واكتسب المعارف والمهارات المطلوبة، ونثمّن التزامه وحضوره المتميز
        </div>
        <div class="stats-container">
          ${prog?.fablabSection ? `<div class="stat-card"><div class="stat-value">${prog.fablabSection}</div><div class="stat-label">القسم</div></div>` : ''}
          ${attendedDays > 0 ? `<div class="stat-card alt"><div class="stat-value">${attendedDays}</div><div class="stat-label">يوم حضور</div></div>` : ''}
          ${startDateF ? `<div class="stat-card gold"><div class="stat-value">${startDateF}</div><div class="stat-label">تاريخ البداية</div></div>` : ''}
        </div>
        <div class="thank-you">
          <span class="hadith">"ومن سلك طريقاً يلتمس فيه علماً سهّل الله له به طريقاً إلى الجنة"</span>
          <br/>
          شكراً لحضورك وتفاعلك في البرنامج الصيفي
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
        <div style="width: 140px;"></div>
      </div>
    </div>
  </div>
</body>
</html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
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
                // Resolve every assigned teacher: prefer the new
                // teacherIds array, fall back to the legacy single
                // teacherId, then to the free-text teacherName field
                // for programs that were never linked to a record.
                const assignedIds = Array.isArray(p.teacherIds) && p.teacherIds.length
                  ? p.teacherIds
                  : (p.teacherId ? [p.teacherId] : []);
                const assignedNames = assignedIds
                  .map(id => teacherById(id)?.name)
                  .filter(Boolean);
                if (assignedNames.length === 0 && p.teacherName) assignedNames.push(p.teacherName);
                const studentNumActual = Array.isArray(p.students) ? p.students.length : 0;
                const teacherLabel = isRTL
                  ? (assignedNames.length > 1 ? 'المعلمون:' : 'المعلم:')
                  : (assignedNames.length > 1 ? 'Teachers:' : 'Teacher:');
                const cardColor = /^#[0-9a-fA-F]{6}$/.test(p.color || '') ? p.color : null;
                return (
                  <div
                    key={p.programId}
                    className="summer-card"
                    style={cardColor ? {
                      borderTop: `4px solid ${cardColor}`,
                      position: 'relative'
                    } : undefined}
                  >
                    <div className="summer-card-head">
                      <strong className="summer-card-name">
                        {cardColor && (
                          <span
                            title={isRTL ? 'لون البرنامج' : 'Program color'}
                            style={{
                              display: 'inline-block', width: 10, height: 10,
                              borderRadius: '50%',
                              background: cardColor,
                              marginInlineEnd: 6,
                              verticalAlign: 'middle',
                              boxShadow: `0 0 0 2px ${cardColor}33`
                            }}
                          />
                        )}
                        {p.name}
                      </strong>
                      <span className="summer-card-section">{sectionLabel(p.fablabSection, isRTL)}</span>
                    </div>
                    <div className="summer-card-meta">
                      <div>
                        <span>{teacherLabel}</span>{' '}
                        {assignedNames.length === 0
                          ? '—'
                          : assignedNames.map((n, i) => (
                              <span key={i} className="summer-volunteer-chip" style={{ marginInlineEnd: 4 }}>{n}</span>
                            ))}
                      </div>
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

          <MasterShareBar isRTL={isRTL} />

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
                const progColor = prog ? colorForProgram(prog) : null;
                return (
                  <div
                    key={v.volunteerId}
                    className="summer-card teacher-card"
                    style={progColor ? {
                      borderTop: `4px solid ${progColor}`,
                      position: 'relative',
                      boxShadow: `0 2px 12px -6px ${progColor}66`
                    } : undefined}
                  >
                    <div className="summer-card-head">
                      <strong className="summer-card-name">
                        {progColor && (
                          <span
                            title={prog?.name}
                            style={{
                              display: 'inline-block',
                              width: 10, height: 10,
                              borderRadius: '50%',
                              background: progColor,
                              marginInlineEnd: 6,
                              verticalAlign: 'middle',
                              boxShadow: `0 0 0 2px ${progColor}33`
                            }}
                          />
                        )}
                        {v.name}
                      </strong>
                      {prog && (
                        <span
                          className="summer-card-section"
                          style={progColor ? {
                            background: progColor,
                            color: '#fff',
                            border: `1px solid ${progColor}`,
                            boxShadow: `0 1px 3px ${progColor}55`
                          } : undefined}
                        >
                          {prog.name}
                        </span>
                      )}
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
                    <VolunteerShareControls
                      volunteer={v}
                      isRTL={isRTL}
                      onUpdated={(id, patch) => setAllVolunteers(prev => prev.map(x => x.volunteerId === id ? { ...x, ...patch } : x))}
                    />
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
                          onClick={() => printSummerCertificate(s)}
                          title={isRTL ? 'طباعة الشهادة' : 'Print Certificate'}
                          style={{ background: '#fef3c7', borderColor: '#fde68a', color: '#92400e' }}
                        >
                          {'🎓'} {isRTL ? 'شهادة' : 'Cert'}
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

            {/* Manual add — for days the student didn't scan at all */}
            <div style={{ margin: '0 0 12px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {!showAddManual ? (
                <button
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10);
                    setManualForm({ date: today, checkInAt: '', checkOutAt: '' });
                    setShowAddManual(true);
                  }}
                  className="summer-btn-primary"
                  style={{ background: '#7c3aed', color: '#fff', border: 'none' }}
                >
                  + {isRTL ? 'إضافة سجل يدوي' : 'Add manual record'}
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end', padding: 10, borderRadius: 8, background: '#faf5ff', border: '1.5px solid #c4b5fd', width: '100%' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                    <span style={{ fontWeight: 700, color: '#5b21b6' }}>{isRTL ? 'التاريخ' : 'Date'}</span>
                    <input type="date" value={manualForm.date} onChange={(e) => setManualForm(f => ({ ...f, date: e.target.value }))} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #c4b5fd' }} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                    <span style={{ fontWeight: 700, color: '#5b21b6' }}>{isRTL ? 'وقت الدخول' : 'Check-in'}</span>
                    <input type="time" value={manualForm.checkInAt} onChange={(e) => setManualForm(f => ({ ...f, checkInAt: e.target.value }))} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #c4b5fd', width: 110 }} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                    <span style={{ fontWeight: 700, color: '#5b21b6' }}>{isRTL ? 'وقت الخروج' : 'Check-out'}</span>
                    <input type="time" value={manualForm.checkOutAt} onChange={(e) => setManualForm(f => ({ ...f, checkOutAt: e.target.value }))} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #c4b5fd', width: 110 }} />
                  </label>
                  <button onClick={submitManualAttendance} disabled={savingManual} className="summer-btn-primary" style={{ background: '#7c3aed', color: '#fff', border: 'none' }}>
                    {savingManual ? '…' : (isRTL ? 'حفظ' : 'Save')}
                  </button>
                  <button onClick={() => setShowAddManual(false)} disabled={savingManual} className="summer-btn-secondary">
                    {isRTL ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              )}
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
                      const isEditing = editingCheckoutId === r.attendanceId;
                      return (
                        <tr key={r.attendanceId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 10px', fontFamily: 'Consolas, monospace' }}>{r.date}</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'Consolas, monospace' }}>{fmtLogTime(r.checkInAt)}</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'Consolas, monospace' }}>
                            {isEditing ? (
                              <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                                <input
                                  type="time"
                                  value={editingCheckoutValue}
                                  onChange={(e) => setEditingCheckoutValue(e.target.value)}
                                  autoFocus
                                  onKeyDown={(e) => { if (e.key === 'Enter') saveCheckoutTime(r); if (e.key === 'Escape') cancelEditCheckout(); }}
                                  style={{ padding: 4, borderRadius: 4, border: '1.5px solid #7c3aed', width: 100 }}
                                />
                                <button onClick={() => saveCheckoutTime(r)} disabled={savingCheckout} style={{ padding: '2px 8px', borderRadius: 4, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>{savingCheckout ? '…' : '✓'}</button>
                                <button onClick={cancelEditCheckout} disabled={savingCheckout} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>×</button>
                              </span>
                            ) : fmtLogTime(r.checkOutAt)}
                          </td>
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
                              {!isEditing && r.checkInAt && (
                                <button
                                  onClick={() => beginEditCheckout(r)}
                                  title={r.checkOutAt
                                    ? (isRTL ? 'تعديل وقت الخروج' : 'Edit check-out')
                                    : (isRTL ? 'إضافة وقت الخروج يدوياً' : 'Add check-out time')}
                                  style={{
                                    padding: '3px 8px', borderRadius: 5,
                                    border: '1px solid ' + (r.checkOutAt ? '#c7d2fe' : '#86efac'),
                                    background: r.checkOutAt ? '#eef2ff' : '#dcfce7',
                                    color: r.checkOutAt ? '#4338ca' : '#166534',
                                    cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700
                                  }}
                                >✎</button>
                              )}
                              {r.checkOutAt && !isEditing && (
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
                              {!isEditing && (
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
                              )}
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
                <label>
                  {isRTL ? 'المعلمون المسؤولون' : 'Assigned Teachers'}
                  {programForm.teacherIds.length > 0 && (
                    <span style={{ marginInlineStart: 8, color: '#0ea5e9', fontWeight: 700, fontSize: '0.78rem' }}>
                      · {programForm.teacherIds.length} {isRTL ? 'محدد' : 'selected'}
                    </span>
                  )}
                </label>
                {teachers.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.25rem 0' }}>
                    {isRTL
                      ? 'لا يوجد معلمون. أضفهم من تبويب المعلمين أولاً، أو اكتب الاسم في الحقل بالأسفل.'
                      : 'No teachers yet. Add some from the Teachers tab first, or type a name in the free-text field below.'}
                  </p>
                ) : (
                  <div style={{
                    border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '0.5rem',
                    maxHeight: 200, overflowY: 'auto', background: '#fff'
                  }}>
                    {teachers.map(t => {
                      const checked = (programForm.teacherIds || []).includes(t.teacherId);
                      return (
                        <label key={t.teacherId} style={{
                          display: 'flex', alignItems: 'center', gap: '0.5rem',
                          padding: '0.3rem 0.4rem', cursor: 'pointer',
                          fontSize: '0.86rem', borderRadius: 4,
                          background: checked ? '#e0f2fe' : 'transparent'
                        }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const current = programForm.teacherIds || [];
                              setProgramForm({
                                ...programForm,
                                teacherIds: e.target.checked
                                  ? [...current, t.teacherId]
                                  : current.filter(id => id !== t.teacherId)
                              });
                            }}
                          />
                          <span style={{ flex: 1 }}>{t.name}</span>
                          {t.fablabSection && (
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              {sectionLabel(t.fablabSection, isRTL)}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="summer-field full">
                <label>{isRTL ? 'أو اسم إضافي (نص حر — لغير المسجلين)' : 'Or Extra Name (free text — for unregistered)'}</label>
                <input
                  value={programForm.teacherName}
                  onChange={(e) => setProgramForm({ ...programForm, teacherName: e.target.value })}
                  placeholder={isRTL ? 'مثال: أ. علي (مدرب مؤقت)' : 'e.g. Ali (temporary trainer)'}
                />
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
              <div className="summer-field full">
                <label>
                  {isRTL ? 'لون البرنامج' : 'Program Color'}
                  <span style={{ marginInlineStart: 8, color: '#64748b', fontWeight: 400, fontSize: '0.78rem' }}>
                    {isRTL ? '· يُطبع على بطاقات الطلاب' : '· printed on student ID cards'}
                  </span>
                </label>
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 6,
                  padding: '8px 10px',
                  background: '#fff',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: 8,
                  alignItems: 'center'
                }}>
                  {PROGRAM_COLOR_PALETTE.map(hex => {
                    const active = (programForm.color || '').toLowerCase() === hex.toLowerCase();
                    return (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setProgramForm({ ...programForm, color: hex })}
                        title={hex}
                        style={{
                          width: 28, height: 28, borderRadius: 8,
                          background: hex,
                          border: active ? '3px solid #0f172a' : '2px solid #fff',
                          boxShadow: active
                            ? `0 0 0 2px ${hex}, 0 2px 6px rgba(0,0,0,0.15)`
                            : '0 0 0 1px #e2e8f0',
                          cursor: 'pointer',
                          transition: 'transform 0.1s',
                          transform: active ? 'scale(1.1)' : 'scale(1)'
                        }}
                      />
                    );
                  })}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginInlineStart: 6, borderInlineStart: '1px solid #e2e8f0', paddingInlineStart: 10 }}>
                    <label
                      title={isRTL ? 'اختر لوناً مخصصاً' : 'Pick a custom color'}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                    >
                      <input
                        type="color"
                        value={programForm.color || '#f97316'}
                        onChange={(e) => setProgramForm({ ...programForm, color: e.target.value })}
                        style={{ width: 32, height: 30, padding: 0, border: '1.5px solid #e2e8f0', borderRadius: 6, cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                        {isRTL ? 'مخصص' : 'Custom'}
                      </span>
                    </label>
                  </div>
                  {programForm.color && (
                    <button
                      type="button"
                      onClick={() => setProgramForm({ ...programForm, color: '' })}
                      title={isRTL ? 'إزالة اللون (سيستخدم لون القسم)' : 'Clear (use section default)'}
                      style={{
                        marginInlineStart: 'auto',
                        padding: '4px 10px', borderRadius: 6,
                        border: '1px solid #e2e8f0', background: '#fff',
                        color: '#64748b', cursor: 'pointer', fontSize: '0.75rem',
                        fontWeight: 600, fontFamily: 'inherit'
                      }}
                    >
                      {isRTL ? 'إزالة' : 'Clear'}
                    </button>
                  )}
                </div>
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

            {!editingSummerVolunteerId && (
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
                marginBottom: 14, padding: 4,
                background: '#f1f5f9', borderRadius: 8
              }}>
                <button
                  type="button"
                  onClick={() => setSummerVolunteerForm(f => ({ ...f, mode: 'existing' }))}
                  style={{
                    padding: '9px 12px', borderRadius: 6, cursor: 'pointer',
                    border: 'none', fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
                    background: summerVolunteerForm.mode === 'existing' ? '#fff' : 'transparent',
                    color: summerVolunteerForm.mode === 'existing' ? '#0f172a' : '#64748b',
                    boxShadow: summerVolunteerForm.mode === 'existing' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  {isRTL ? 'اختيار من القائمة' : 'Pick from list'}
                </button>
                <button
                  type="button"
                  onClick={() => setSummerVolunteerForm(f => ({
                    ...f, mode: 'manual', existingVolunteerId: '',
                    name: '', nationalId: '', phone: '', email: ''
                  }))}
                  style={{
                    padding: '9px 12px', borderRadius: 6, cursor: 'pointer',
                    border: 'none', fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
                    background: summerVolunteerForm.mode === 'manual' ? '#fff' : 'transparent',
                    color: summerVolunteerForm.mode === 'manual' ? '#0f172a' : '#64748b',
                    boxShadow: summerVolunteerForm.mode === 'manual' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  {isRTL ? 'إضافة يدوي (متطوع جديد)' : 'Add manually (new volunteer)'}
                </button>
              </div>
            )}

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

              {!editingSummerVolunteerId && summerVolunteerForm.mode === 'existing' ? (
                <>
                  <div className="summer-field full">
                    <label>{isRTL ? 'المتطوع' : 'Volunteer'} *</label>
                    {availableVolunteersForSummer.length === 0 ? (
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
                        {isRTL
                          ? 'لا يوجد متطوعون متاحون. أضف متطوعاً من تبويب المتطوعين الرئيسي أولاً، أو استخدم "إضافة يدوي".'
                          : 'No available volunteers. Add one from the main Volunteers tab first, or use "Add manually".'}
                      </p>
                    ) : (
                      <select
                        value={summerVolunteerForm.existingVolunteerId}
                        onChange={(e) => selectExistingVolunteer(e.target.value)}
                      >
                        <option value="">— {isRTL ? 'اختر متطوعاً' : 'Select a volunteer'} —</option>
                        {availableVolunteersForSummer.map(v => (
                          <option key={v.volunteerId} value={v.volunteerId}>
                            {v.name}{v.nationalId ? ` — ${v.nationalId}` : ''}{v.phone ? ` · ${v.phone}` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  {summerVolunteerForm.existingVolunteerId && (
                    <div className="summer-field full" style={{
                      background: '#f8fafc', border: '1px solid #e2e8f0',
                      borderRadius: 8, padding: '10px 12px'
                    }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, letterSpacing: 0.5, marginBottom: 6 }}>
                        {isRTL ? 'بيانات المتطوع' : 'Volunteer info'}
                      </div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>{summerVolunteerForm.name || '—'}</div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: '0.78rem', color: '#475569', flexWrap: 'wrap' }}>
                        {summerVolunteerForm.nationalId && <span dir="ltr">🪪 {summerVolunteerForm.nationalId}</span>}
                        {summerVolunteerForm.phone && <span dir="ltr">📱 {summerVolunteerForm.phone}</span>}
                        {summerVolunteerForm.email && <span dir="ltr">✉ {summerVolunteerForm.email}</span>}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
            <div className="summer-modal-actions">
              <button className="summer-btn-secondary" disabled={savingSummerVolunteer} onClick={() => setShowSummerVolunteerForm(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
              <button className="summer-btn-primary" disabled={savingSummerVolunteer} onClick={saveSummerVolunteer}>
                {savingSummerVolunteer
                  ? (isRTL ? 'جاري الحفظ...' : 'Saving...')
                  : (editingSummerVolunteerId
                      ? (isRTL ? 'حفظ التعديل' : 'Save Changes')
                      : (summerVolunteerForm.mode === 'existing'
                          ? (isRTL ? 'ربط بالبرنامج' : 'Link to program')
                          : (isRTL ? 'إضافة' : 'Add')))}
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
