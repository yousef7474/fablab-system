import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../../config/api';
import QRScanner from '../QRScanner/QRScanner';
import UnifiedAttendancePage from '../shared/UnifiedAttendancePage';
import './Mawhba.css';

const EMPTY_STUDENT = {
  nameAr: '', nameEn: '', nationalId: '', nationality: '', schoolGrade: '',
  administrativeRegion: '', educationalAdministration: '', schoolName: '',
  sex: '', residenceCity: '', executingEntity: '', courseName: '', courseNumber: '',
  courseAmount: '', registrationDate: '', studentPhone: '', email: '', guardianPhone: ''
};

const EMPTY_EMAIL = { subject: '', message: '', photo: null, photoName: '' };
const MAX_PHOTO_BYTES = 6 * 1024 * 1024; // 6 MB before base64 inflation (~8 MB after)

const Mawhba = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sexFilter, setSexFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  // Seasons — yearly cohorts. `activeSeasonId` is what we actually
  // filter by; when it's empty the server falls back to the DB-active
  // season on its own.
  const [seasons, setSeasons] = useState([]);
  const [activeSeasonId, setActiveSeasonId] = useState('');
  const [showNewSeasonModal, setShowNewSeasonModal] = useState(false);
  const [newSeasonForm, setNewSeasonForm] = useState({ name: '', year: new Date().getFullYear() + 1 });
  const [courses, setCourses] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [printing, setPrinting] = useState(false);
  const [emailingCard, setEmailingCard] = useState(null);

  const [showColorsModal, setShowColorsModal] = useState(false);
  const [colorMap, setColorMap] = useState({});
  const [colorDraft, setColorDraft] = useState({});
  const [savingColor, setSavingColor] = useState(null);

  const [showScanner, setShowScanner] = useState(false);

  // Hardware (USB HID) barcode-reader listener — only active while the
  // dedicated Attendance Mode page is open, so it never fights with
  // normal typing on the regular Mawhba list view.
  const [attendanceMode, setAttendanceMode] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [scanPopup, setScanPopup] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [sessionStats, setSessionStats] = useState({ checkins: 0, checkouts: 0, errors: 0 });
  // eslint-disable-next-line no-unused-vars
  const [recentScans, setRecentScans] = useState([]); // last 5 scans, newest first
  // eslint-disable-next-line no-unused-vars
  const [attendanceGroups, setAttendanceGroups] = useState([]); // students grouped by course
  const [showLogModal, setShowLogModal] = useState(false);
  const [logStudent, setLogStudent] = useState(null);
  const [logRecords, setLogRecords] = useState([]);
  const [logLoading, setLogLoading] = useState(false);

  const [showExportModal, setShowExportModal] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const aMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [exportFrom, setExportFrom] = useState(aMonthAgo);
  const [exportTo, setExportTo] = useState(today);
  const [exporting, setExporting] = useState(false);

  const [showStudentModal, setShowStudentModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [studentForm, setStudentForm] = useState(EMPTY_STUDENT);
  const [saving, setSaving] = useState(false);

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTargets, setEmailTargets] = useState([]);
  const [emailForm, setEmailForm] = useState(EMPTY_EMAIL);
  const [sending, setSending] = useState(false);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sexFilter) params.set('sex', sexFilter);
      if (courseFilter) params.set('course', courseFilter);
      if (search.trim()) params.set('search', search.trim());
      if (activeSeasonId) params.set('season', activeSeasonId);
      const { data } = await api.get(`/mawhba/students?${params.toString()}`);
      setStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'تعذر تحميل قائمة الطلاب' : 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [sexFilter, courseFilter, search, activeSeasonId, isRTL]);

  const fetchSeasons = useCallback(async () => {
    try {
      const { data } = await api.get('/mawhba/seasons');
      const list = Array.isArray(data) ? data : [];
      setSeasons(list);
      // Auto-select the active season on first load if the picker is empty.
      if (!activeSeasonId) {
        const active = list.find(s => s.isActive);
        if (active) setActiveSeasonId(active.seasonId);
      }
    } catch (err) {
      console.error(err);
    }
  }, [activeSeasonId]);

  const handleCreateSeason = async () => {
    const name = (newSeasonForm.name || '').trim();
    if (!name) {
      toast.error(isRTL ? 'يرجى إدخال اسم الموسم' : 'Season name is required');
      return;
    }
    try {
      const { data } = await api.post('/mawhba/seasons', {
        name,
        year: Number(newSeasonForm.year) || null,
        activate: true
      });
      toast.success(isRTL ? 'تم إنشاء الموسم وتفعيله' : 'Season created and activated');
      setShowNewSeasonModal(false);
      setNewSeasonForm({ name: '', year: new Date().getFullYear() + 1 });
      await fetchSeasons();
      setActiveSeasonId(data.seasonId);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'خطأ في إنشاء الموسم' : 'Failed to create season');
    }
  };

  const handleActivateSeason = async (id) => {
    try {
      await api.patch(`/mawhba/seasons/${id}/activate`);
      toast.success(isRTL ? 'تم تفعيل الموسم' : 'Season activated');
      await fetchSeasons();
      setActiveSeasonId(id);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'خطأ في تفعيل الموسم' : 'Failed to activate');
    }
  };

  const fetchCourses = useCallback(async () => {
    try {
      const { data } = await api.get('/mawhba/courses');
      setCourses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchColorMap = useCallback(async () => {
    try {
      const { data } = await api.get('/mawhba/course-colors');
      const map = {};
      (data || []).forEach(r => { map[r.courseName] = r.color; });
      setColorMap(map);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);
  useEffect(() => { fetchCourses(); }, [fetchCourses]);
  useEffect(() => { fetchColorMap(); }, [fetchColorMap]);
  useEffect(() => { fetchSeasons(); }, [fetchSeasons]);

  // Hardware scanner listening is now owned by the shared
  // UnifiedAttendancePage component mounted below. This local
  // effect is intentionally a no-op — kept as a placeholder so
  // future refactors can restore per-tab behavior if needed.

  const hydrateAttendance = useCallback(async () => {
    try {
      const { data } = await api.get('/mawhba/attendance/today');
      const events = data?.events || [];
      const fmt = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        const pad = (n) => String(n).padStart(2, '0');
        return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      };
      const fmtDate = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      };
      setRecentScans(events.slice(0, 12).map(e => ({
        kind: e.kind,
        name: e.name,
        course: e.course,
        color: e.color,
        time: fmt(e.at),
        date: fmtDate(e.at)
      })));
      setSessionStats(prev => ({
        checkins: data?.stats?.checkins || 0,
        checkouts: data?.stats?.checkouts || 0,
        errors: prev.errors // errors aren't stored on the server; keep session counter
      }));
      setAttendanceGroups(Array.isArray(data?.groups) ? data.groups : []);
    } catch (err) {
      console.error('hydrateAttendance failed', err);
    }
  }, []);

  const openAttendanceMode = async () => {
    setAttendanceMode(true);
    setSessionStats(p => ({ checkins: 0, checkouts: 0, errors: 0 }));
    setRecentScans([]);
    setAttendanceGroups([]);
    await hydrateAttendance();
  };
  const openAdd = () => {
    setEditingId(null);
    setStudentForm(EMPTY_STUDENT);
    setShowStudentModal(true);
  };

  const openEdit = (s) => {
    setEditingId(s.studentId);
    setStudentForm({
      nameAr: s.nameAr || '',
      nameEn: s.nameEn || '',
      nationalId: s.nationalId || '',
      nationality: s.nationality || '',
      schoolGrade: s.schoolGrade || '',
      administrativeRegion: s.administrativeRegion || '',
      educationalAdministration: s.educationalAdministration || '',
      schoolName: s.schoolName || '',
      sex: s.sex || '',
      residenceCity: s.residenceCity || '',
      executingEntity: s.executingEntity || '',
      courseName: s.courseName || '',
      courseNumber: s.courseNumber || '',
      courseAmount: s.courseAmount || '',
      registrationDate: s.registrationDate ? String(s.registrationDate).slice(0, 10) : '',
      studentPhone: s.studentPhone || '',
      email: s.email || '',
      guardianPhone: s.guardianPhone || ''
    });
    setShowStudentModal(true);
  };

  const saveStudent = async (e) => {
    e?.preventDefault?.();
    if (!studentForm.nameAr.trim()) { toast.error(isRTL ? 'اسم الطالب بالعربي مطلوب' : 'Arabic name required'); return; }
    if (!studentForm.nationalId.trim()) { toast.error(isRTL ? 'رقم الهوية مطلوب' : 'National ID required'); return; }
    setSaving(true);
    try {
      const payload = { ...studentForm };
      if (payload.courseAmount === '') delete payload.courseAmount;
      if (payload.registrationDate === '') delete payload.registrationDate;
      if (editingId) {
        await api.put(`/mawhba/students/${editingId}`, payload);
        toast.success(isRTL ? 'تم تحديث الطالب' : 'Student updated');
      } else {
        await api.post('/mawhba/students', payload);
        toast.success(isRTL ? 'تمت إضافة الطالب' : 'Student added');
      }
      setShowStudentModal(false);
      fetchStudents();
      fetchCourses();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || (isRTL ? 'حدث خطأ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const deleteStudent = async (s) => {
    if (!window.confirm(isRTL ? `حذف الطالب "${s.nameAr}"؟` : `Delete student "${s.nameAr}"?`)) return;
    try {
      await api.delete(`/mawhba/students/${s.studentId}`);
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
      setSelected(prev => { const n = new Set(prev); n.delete(s.studentId); return n; });
      fetchStudents();
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'فشل الحذف' : 'Delete failed');
    }
  };

  const toggleOne = (id) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    setSelected(prev => {
      if (prev.size === students.length) return new Set();
      return new Set(students.map(s => s.studentId));
    });
  };

  const openEmailSingle = (s) => {
    if (!s.email) { toast.warning(isRTL ? 'هذا الطالب لا يوجد لديه بريد إلكتروني' : 'No email on file for this student'); return; }
    setEmailTargets([s.studentId]);
    setEmailForm(EMPTY_EMAIL);
    setShowEmailModal(true);
  };
  const openEmailBulk = () => {
    if (selected.size === 0) { toast.warning(isRTL ? 'اختر طالباً واحداً على الأقل' : 'Select at least one student'); return; }
    setEmailTargets([...selected]);
    setEmailForm(EMPTY_EMAIL);
    setShowEmailModal(true);
  };

  const onPickPhoto = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(isRTL ? 'يرجى اختيار صورة' : 'Please select an image');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error(isRTL ? 'الصورة كبيرة جداً (الحد الأقصى 6 ميجابايت)' : 'Image too large (max 6 MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setEmailForm(prev => ({ ...prev, photo: reader.result, photoName: file.name }));
    };
    reader.onerror = () => toast.error(isRTL ? 'تعذر قراءة الصورة' : 'Failed to read image');
    reader.readAsDataURL(file);
  };

  const clearPhoto = () => setEmailForm(prev => ({ ...prev, photo: null, photoName: '' }));

  const sendEmail = async (e) => {
    e?.preventDefault?.();
    if (!emailForm.subject.trim()) { toast.error(isRTL ? 'الموضوع مطلوب' : 'Subject required'); return; }
    if (!emailForm.message.trim()) { toast.error(isRTL ? 'الرسالة مطلوبة' : 'Message required'); return; }
    setSending(true);
    try {
      const { data } = await api.post('/mawhba/send-email', {
        studentIds: emailTargets,
        subject: emailForm.subject.trim(),
        message: emailForm.message.trim(),
        photo: emailForm.photo || undefined
      });
      const skipped = (data?.skippedNoEmail || []).length;
      toast.success(
        isRTL
          ? `تم الإرسال: ${data.successCount} | فشل: ${data.failCount}${skipped ? ` | بدون بريد: ${skipped}` : ''}`
          : `Sent: ${data.successCount} | Failed: ${data.failCount}${skipped ? ` | No email: ${skipped}` : ''}`
      );
      setShowEmailModal(false);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || (isRTL ? 'فشل الإرسال' : 'Send failed'));
    } finally {
      setSending(false);
    }
  };

  const selectedWithEmail = useMemo(
    () => students.filter(s => selected.has(s.studentId) && s.email).length,
    [students, selected]
  );

  const darkenHex = (hex, amount = 0.55) => {
    const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || '');
    if (!m) return '#0f172a';
    const n = parseInt(m[1], 16);
    const r = Math.max(0, Math.round(((n >> 16) & 0xff) * (1 - amount)));
    const g = Math.max(0, Math.round(((n >> 8) & 0xff) * (1 - amount)));
    const b = Math.max(0, Math.round((n & 0xff) * (1 - amount)));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  };

  const renderCardHtml = (student, qrDataUrl, color) => {
    const name = student.nameAr || student.nameEn || '';
    const nid = student.nationalId || '';
    const guardian = student.guardianPhone || student.studentPhone || '';
    const course = student.courseName || '';
    const grade = student.schoolGrade || '';
    const c = color || colorMap[student.courseName] || '#8b5cf6';
    const cDark = darkenHex(c, 0.55);
    const logoSrc = `${window.location.origin}/fablab.png`;
    return `
      <div class="mawhba-card" dir="rtl" style="--course-color:${c}; --course-color-dark:${cDark};">
        <div class="mawhba-card-top">
          <div class="mawhba-card-brand">
            <img src="${logoSrc}" alt="FabLab" class="mawhba-card-logo" />
            <div>
              <div class="mawhba-card-fablab">فاب لاب الأحساء</div>
              <div class="mawhba-card-fablab-en">FABLAB</div>
            </div>
          </div>
          <div class="mawhba-card-program">
            <div class="mawhba-card-program-ar">برنامج موهبة</div>
            <div class="mawhba-card-program-en">MAWHBA</div>
          </div>
        </div>
        <div class="mawhba-card-body">
          <div class="mawhba-card-name">${name}</div>
          <div class="mawhba-card-field">
            <span class="mawhba-card-field-label">الهوية</span>
            <span class="mawhba-card-field-value mono">${nid}</span>
          </div>
          <div class="mawhba-card-field">
            <span class="mawhba-card-field-label">ولي الأمر</span>
            <span class="mawhba-card-field-value mono">${guardian || '—'}</span>
          </div>
          ${grade ? `<div class="mawhba-card-field">
            <span class="mawhba-card-field-label">الصف</span>
            <span class="mawhba-card-field-value">${grade}</span>
          </div>` : ''}
        </div>
        <div class="mawhba-card-course">
          <div class="mawhba-card-course-name">${course || '—'}</div>
        </div>
        <div class="mawhba-card-bottom">
          <img src="${qrDataUrl}" alt="QR" class="mawhba-card-qr" />
          <div class="mawhba-card-qr-label">رمز الحضور</div>
        </div>
      </div>`;
  };

  // Print layout: A4 portrait, 2×2 grid of 72×102mm cards (= 4 per page),
  // with a dashed cut guide around each card.
  const CARD_PRINT_CSS = `
    @page { size: A4 portrait; margin: 14mm 12mm; }
    html, body { margin: 0; padding: 0; background: #f1f5f9; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
    body { padding: 18mm 0; }

    .mawhba-print-page {
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
    .mawhba-print-page:last-child { page-break-after: auto; }

    .mawhba-card {
      width: 72mm;
      height: 102mm;
      background: white;
      box-sizing: border-box;
      overflow: hidden;
      color: #0f172a;
      position: relative;
      border: 0.45mm dashed #475569; /* cut guide */
    }
    .mawhba-card::after {
      content: '';
      position: absolute;
      left: 0; right: 0; bottom: 0;
      height: 1.5mm;
      background: var(--course-color, #8b5cf6);
    }

    .mawhba-card-top {
      background: var(--course-color, #8b5cf6);
      background-image: linear-gradient(135deg, var(--course-color, #8b5cf6) 0%, var(--course-color-dark, #0f172a) 100%);
      padding: 2.5mm 3.5mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: white;
      height: 13mm;
      box-sizing: border-box;
    }
    .mawhba-card-brand { display: flex; align-items: center; gap: 2mm; }
    .mawhba-card-logo {
      width: 8mm; height: 8mm;
      background: white;
      border-radius: 1.5mm;
      padding: 0.6mm;
      object-fit: contain;
      box-sizing: border-box;
    }
    .mawhba-card-fablab { font-size: 7pt; font-weight: 800; line-height: 1.1; color: white; }
    .mawhba-card-fablab-en { font-size: 5pt; letter-spacing: 0.8px; color: rgba(255,255,255,0.78); margin-top: 0.3mm; }
    .mawhba-card-program { text-align: end; }
    .mawhba-card-program-ar { font-size: 10pt; font-weight: 800; color: white; line-height: 1; }
    .mawhba-card-program-en { font-size: 4.5pt; letter-spacing: 1.5px; color: rgba(255,255,255,0.75); margin-top: 0.6mm; }

    .mawhba-card-body {
      padding: 3mm 4mm 0;
    }
    .mawhba-card-name {
      font-size: 11pt;
      font-weight: 800;
      text-align: center;
      padding-bottom: 2mm;
      border-bottom: 0.4mm solid var(--course-color, #8b5cf6);
      margin-bottom: 3mm;
      line-height: 1.2;
      color: #0f172a;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .mawhba-card-field {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 1.8mm;
      gap: 2mm;
    }
    .mawhba-card-field-label {
      font-size: 6pt;
      color: var(--course-color, #8b5cf6);
      font-weight: 800;
      letter-spacing: 0.4px;
      white-space: nowrap;
    }
    .mawhba-card-field-value {
      font-size: 8.5pt;
      font-weight: 700;
      color: #0f172a;
      text-align: end;
      word-break: break-word;
    }
    .mawhba-card-field-value.mono {
      font-family: 'Consolas', 'Courier New', monospace;
      letter-spacing: 0.3px;
    }

    .mawhba-card-course {
      background: var(--course-color, #8b5cf6);
      color: white;
      text-align: center;
      padding: 1.8mm 2mm;
      margin: 3mm 4mm 3mm;
      border-radius: 1.5mm;
    }
    .mawhba-card-course-name { font-size: 9pt; font-weight: 800; color: white; line-height: 1.15; }

    .mawhba-card-bottom {
      text-align: center;
      padding: 0 2mm 3mm;
    }
    .mawhba-card-qr {
      width: 40mm;
      height: 40mm;
      display: block;
      margin: 0 auto;
      background: white;
      padding: 1mm;
      border: 0.3mm solid #cbd5e1;
      border-radius: 1.5mm;
      box-sizing: border-box;
    }
    .mawhba-card-qr-label {
      margin-top: 1.8mm;
      font-size: 7pt;
      letter-spacing: 1.5px;
      color: var(--course-color-dark, #0f172a);
      font-weight: 800;
    }

    /* Page preview (non-print) */
    .mawhba-print-page-screen-note {
      max-width: 186mm;
      margin: 0 auto 8mm;
      padding: 8px 14px;
      background: white;
      border-radius: 8px;
      font-size: 12px;
      color: #475569;
      text-align: center;
      border: 1px dashed #cbd5e1;
    }

    @media print {
      body { background: white; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .mawhba-print-page { margin: 0 auto; }
      .mawhba-print-page-screen-note { display: none; }
      .mawhba-card { box-shadow: none; break-inside: avoid; }
    }
  `;

  // cardsHtmlArray: string[] — each item is one card's HTML.
  // We chunk into pages of 4 (2×2 grid, A4 portrait, 72×102mm each).
  const openPrintWindow = (cardsHtmlArray) => {
    const cards = Array.isArray(cardsHtmlArray) ? cardsHtmlArray : [cardsHtmlArray];
    if (cards.length === 0) {
      toast.error(isRTL ? 'لا توجد بطاقات للطباعة' : 'No cards to print');
      return;
    }
    const win = window.open('', '_blank', 'width=900,height=1100');
    if (!win) {
      toast.error(isRTL ? 'تم منع النوافذ المنبثقة' : 'Pop-up blocked — allow pop-ups for this site');
      return;
    }
    const pages = [];
    for (let i = 0; i < cards.length; i += 4) {
      pages.push(`<div class="mawhba-print-page">${cards.slice(i, i + 4).join('')}</div>`);
    }
    const note = isRTL
      ? `${cards.length} بطاقة · ${pages.length} صفحة · حجم البطاقة: 72×102 ملم · اقطع حسب الخط المتقطع`
      : `${cards.length} card(s) · ${pages.length} page(s) · Card size: 72×102 mm · Cut along the dashed line`;
    win.document.open();
    win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${isRTL ? 'بطاقات موهبة' : 'Mawhba Cards'}</title><style>${CARD_PRINT_CSS}</style></head><body><div class="mawhba-print-page-screen-note">${note}</div>${pages.join('')}<script>window.onload=function(){setTimeout(function(){window.print()},500)}</script></body></html>`);
    win.document.close();
  };

  const printOne = async (s) => {
    setPrinting(true);
    try {
      const { data } = await api.get(`/mawhba/students/${s.studentId}/card`);
      openPrintWindow([renderCardHtml(data.student, data.qrDataUrl, data.color)]);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'تعذر تحضير البطاقة' : 'Failed to prepare card');
    } finally {
      setPrinting(false);
    }
  };

  const printSelected = async () => {
    if (selected.size === 0) { toast.warning(isRTL ? 'اختر طالباً واحداً على الأقل' : 'Select at least one student'); return; }
    setPrinting(true);
    try {
      const { data } = await api.post('/mawhba/cards', { studentIds: [...selected] });
      const cards = (data || []).map(d => renderCardHtml(d.student, d.qrDataUrl, d.color));
      if (!cards.length) { toast.error(isRTL ? 'لا توجد بطاقات' : 'No cards'); return; }
      openPrintWindow(cards);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'تعذر تحضير البطاقات' : 'Failed to prepare cards');
    } finally {
      setPrinting(false);
    }
  };

  const openColorsModal = () => {
    const draft = {};
    courses.forEach(c => { draft[c] = colorMap[c] || '#8b5cf6'; });
    setColorDraft(draft);
    setShowColorsModal(true);
  };

  const openAttendanceLog = async (s) => {
    setLogStudent(s);
    setShowLogModal(true);
    setLogLoading(true);
    setLogRecords([]);
    try {
      const { data } = await api.get(`/mawhba/students/${s.studentId}/attendance`);
      setLogRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'تعذر تحميل سجل الحضور' : 'Failed to load attendance log');
    } finally {
      setLogLoading(false);
    }
  };

  const deleteAttendanceRecord = async (rec) => {
    if (!window.confirm(isRTL ? `حذف سجل ${rec.date}؟` : `Delete record for ${rec.date}?`)) return;
    try {
      await api.delete(`/mawhba/attendance/${rec.attendanceId}`);
      setLogRecords(prev => prev.filter(r => r.attendanceId !== rec.attendanceId));
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'فشل الحذف' : 'Delete failed');
    }
  };

  const clearCheckoutRecord = async (rec) => {
    if (!window.confirm(
      isRTL
        ? `حذف تسجيل الخروج لتاريخ ${rec.date}؟ سيبقى تسجيل الدخول محفوظاً.`
        : `Clear check-out for ${rec.date}? Check-in will remain.`
    )) return;
    try {
      await api.patch(`/mawhba/attendance/${rec.attendanceId}/checkout`);
      setLogRecords(prev => prev.map(r => r.attendanceId === rec.attendanceId ? { ...r, checkOutAt: null } : r));
      toast.success(isRTL ? 'تم حذف تسجيل الخروج' : 'Check-out cleared');
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || (isRTL ? 'فشل الحذف' : 'Clear failed'));
    }
  };

  const downloadAttendance = async () => {
    if (selected.size === 0) {
      toast.warning(isRTL ? 'اختر طالباً واحداً على الأقل' : 'Select at least one student');
      return;
    }
    if (!exportFrom || !exportTo) {
      toast.error(isRTL ? 'حدد نطاق التواريخ' : 'Pick a date range');
      return;
    }
    setExporting(true);
    try {
      const res = await api.post(
        '/mawhba/attendance/export',
        { studentIds: [...selected], from: exportFrom, to: exportTo },
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mawhba-attendance-${exportFrom}_to_${exportTo}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(isRTL ? 'تم تنزيل الملف' : 'File downloaded');
      setShowExportModal(false);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'فشل التصدير' : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const fmtTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  const durationMin = (rec) => {
    if (!rec.checkInAt || !rec.checkOutAt) return null;
    const m = Math.max(0, Math.round((new Date(rec.checkOutAt) - new Date(rec.checkInAt)) / 60000));
    return m;
  };
  const logSummary = useMemo(() => {
    const completed = logRecords.filter(r => r.checkInAt && r.checkOutAt);
    const totalMin = completed.reduce((acc, r) => acc + durationMin(r), 0);
    return {
      total: logRecords.length,
      completed: completed.length,
      stillIn: logRecords.filter(r => r.checkInAt && !r.checkOutAt).length,
      hours: Math.floor(totalMin / 60),
      minutes: totalMin % 60
    };
  }, [logRecords]);

  const saveCourseColor = async (courseName, color) => {
    setSavingColor(courseName);
    try {
      await api.post('/mawhba/course-colors', { courseName, color });
      setColorMap(prev => ({ ...prev, [courseName]: color }));
      toast.success(isRTL ? `تم حفظ لون "${courseName}"` : `Saved color for "${courseName}"`);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || (isRTL ? 'فشل الحفظ' : 'Save failed'));
    } finally {
      setSavingColor(null);
    }
  };

  const emailCard = async (s) => {
    if (!s.email) { toast.warning(isRTL ? 'هذا الطالب لا يوجد لديه بريد إلكتروني' : 'No email on file'); return; }
    setEmailingCard(s.studentId);
    try {
      await api.post(`/mawhba/students/${s.studentId}/email-card`);
      toast.success(isRTL ? `تم إرسال البطاقة إلى ${s.email}` : `Card sent to ${s.email}`);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || (isRTL ? 'فشل الإرسال' : 'Send failed'));
    } finally {
      setEmailingCard(null);
    }
  };

  const [sendingCards, setSendingCards] = useState(false);
  const emailCardsBulk = async () => {
    if (selected.size === 0) { toast.warning(isRTL ? 'اختر طالباً واحداً على الأقل' : 'Select at least one student'); return; }
    const list = students.filter(s => selected.has(s.studentId));
    const withEmail = list.filter(s => s.email).length;
    const noEmail = list.length - withEmail;
    const confirmMsg = isRTL
      ? `سيتم إرسال البطاقة لـ ${withEmail} طالب${noEmail ? ` (سيتم تخطي ${noEmail} بدون بريد)` : ''}.\n\nهل تريد المتابعة؟`
      : `Will send cards to ${withEmail} student(s)${noEmail ? ` (skipping ${noEmail} with no email)` : ''}.\n\nProceed?`;
    if (!window.confirm(confirmMsg)) return;
    setSendingCards(true);
    try {
      const { data } = await api.post('/mawhba/email-cards-bulk', { studentIds: [...selected] });
      const skipped = (data?.skippedNoEmail || []).length;
      toast.success(
        isRTL
          ? `تم إرسال البطاقات: ${data.successCount} | فشل: ${data.failCount}${skipped ? ` | بدون بريد: ${skipped}` : ''}`
          : `Cards sent: ${data.successCount} | Failed: ${data.failCount}${skipped ? ` | No email: ${skipped}` : ''}`
      );
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || (isRTL ? 'فشل الإرسال' : 'Send failed'));
    } finally {
      setSendingCards(false);
    }
  };

  return (
    <div className="mawhba-tab" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mawhba-header">
        <div>
          <h2 className="mawhba-title">{isRTL ? 'موهبة' : 'Mawhba'}</h2>
          <p className="mawhba-sub">{isRTL ? 'إدارة الطلاب الموهوبين والتواصل معهم' : 'Manage talented students and communicate with them'}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Season picker + new-season action. Every list operation
              scopes to the picked season, so switching to موهبة 2026 shows
              only that year's roster and switching to a brand-new season
              gives an empty roster to start filling in. */}
          <select
            className="mawhba-select"
            value={activeSeasonId}
            onChange={(e) => setActiveSeasonId(e.target.value)}
            style={{ minWidth: 180, fontWeight: 700 }}
            title={isRTL ? 'موسم موهبة' : 'Mawhba season'}
          >
            {seasons.length === 0 && (
              <option value="">{isRTL ? 'لا توجد مواسم' : 'No seasons'}</option>
            )}
            {seasons.map(s => (
              <option key={s.seasonId} value={s.seasonId}>
                {s.name}{s.isActive ? (isRTL ? ' • نشط' : ' • active') : ''}
                {typeof s.studentCount === 'number' ? ` (${s.studentCount})` : ''}
              </option>
            ))}
          </select>
          {activeSeasonId && !seasons.find(s => s.seasonId === activeSeasonId)?.isActive && (
            <button
              className="mawhba-btn-primary"
              onClick={() => handleActivateSeason(activeSeasonId)}
              style={{ background: '#0ea5e9' }}
              title={isRTL ? 'اجعل هذا الموسم نشطاً' : 'Make this the active season'}
            >
              {isRTL ? 'تفعيل' : 'Activate'}
            </button>
          )}
          <button
            className="mawhba-btn-primary"
            onClick={() => setShowNewSeasonModal(true)}
            style={{ background: '#16a34a' }}
            title={isRTL ? 'إنشاء موسم جديد' : 'Create a new season'}
          >
            + {isRTL ? 'موسم جديد' : 'New Season'}
          </button>
          <button className="mawhba-btn-primary" onClick={openAdd}>
            + {isRTL ? 'إضافة طالب' : 'Add Student'}
          </button>
        </div>
      </div>

      <div className="mawhba-toolbar">
        <input
          className="mawhba-search"
          placeholder={isRTL ? 'بحث بالاسم أو الهوية أو الدورة...' : 'Search by name, ID, course...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="mawhba-select"
          value={sexFilter}
          onChange={(e) => setSexFilter(e.target.value)}
        >
          <option value="">{isRTL ? 'كل الجنسين' : 'All sexes'}</option>
          <option value="male">{isRTL ? 'ذكر' : 'Male'}</option>
          <option value="female">{isRTL ? 'أنثى' : 'Female'}</option>
        </select>
        <select
          className="mawhba-select"
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
        >
          <option value="">{isRTL ? 'كل الدورات' : 'All courses'}</option>
          {courses.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button
          className="mawhba-btn-email"
          onClick={openEmailBulk}
          disabled={selected.size === 0}
        >
          ✉ {isRTL ? `إرسال بريد (${selected.size})` : `Send Email (${selected.size})`}
        </button>
        <button
          className="mawhba-btn-print"
          onClick={printSelected}
          disabled={selected.size === 0 || printing}
          title={isRTL ? 'طباعة بطاقات المحددين' : 'Print cards for selected'}
        >
          🖨 {isRTL ? `طباعة (${selected.size})` : `Print (${selected.size})`}
        </button>
        <button
          className="mawhba-btn-cards-bulk"
          onClick={emailCardsBulk}
          disabled={selected.size === 0 || sendingCards}
          title={isRTL ? 'إرسال بطاقة كل طالب لبريده' : 'Send each student their card'}
        >
          🎫 {sendingCards
            ? (isRTL ? 'جارٍ الإرسال...' : 'Sending...')
            : (isRTL ? `إرسال البطاقات (${selected.size})` : `Send Cards (${selected.size})`)}
        </button>
        <button
          className="mawhba-btn-colors"
          onClick={openColorsModal}
          title={isRTL ? 'تخصيص لون كل دورة' : 'Customize course colors'}
        >
          🎨 {isRTL ? 'ألوان الدورات' : 'Course Colors'}
        </button>
        <button
          className="mawhba-btn-scanner"
          onClick={() => setShowScanner(true)}
          title={isRTL ? 'فتح ماسح رمز الحضور' : 'Open attendance scanner'}
        >
          📷 {isRTL ? 'مسح الحضور' : 'Scan Attendance'}
        </button>
        <button
          className="mawhba-btn-export"
          onClick={() => setShowExportModal(true)}
          disabled={selected.size === 0}
          title={isRTL ? 'تصدير سجل حضور المحددين' : 'Export attendance for selected'}
        >
          📥 {isRTL ? `تصدير حضور (${selected.size})` : `Export Attendance (${selected.size})`}
        </button>
        <button
          className="mawhba-btn-attendance-mode"
          onClick={openAttendanceMode}
          title={isRTL ? 'فتح صفحة الحضور المخصصة (USB scanner)' : 'Open dedicated attendance page'}
        >
          🎯 {isRTL ? 'فتح صفحة الحضور' : 'Open Attendance Page'}
        </button>
      </div>

      <div className="mawhba-summary">
        <span>{isRTL ? 'الإجمالي' : 'Total'}: <b>{students.length}</b></span>
        <span>{isRTL ? 'المحدد' : 'Selected'}: <b>{selected.size}</b></span>
        <span>{isRTL ? 'لديهم بريد' : 'With email'}: <b>{selectedWithEmail}</b></span>
      </div>

      <div className="mawhba-table-wrap">
        {loading ? (
          <div className="mawhba-empty">{isRTL ? 'جارٍ التحميل...' : 'Loading...'}</div>
        ) : students.length === 0 ? (
          <div className="mawhba-empty">{isRTL ? 'لا يوجد طلاب بعد' : 'No students yet'}</div>
        ) : (
          <table className="mawhba-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={selected.size > 0 && selected.size === students.length}
                    onChange={toggleAll}
                    aria-label="select all"
                  />
                </th>
                <th>{isRTL ? 'الاسم' : 'Name'}</th>
                <th>{isRTL ? 'الهوية' : 'National ID'}</th>
                <th>{isRTL ? 'الجنس' : 'Sex'}</th>
                <th>{isRTL ? 'الصف' : 'Grade'}</th>
                <th>{isRTL ? 'المدرسة' : 'School'}</th>
                <th>{isRTL ? 'الدورة' : 'Course'}</th>
                <th>{isRTL ? 'البريد' : 'Email'}</th>
                <th>{isRTL ? 'الجوال' : 'Phone'}</th>
                <th style={{ width: 160 }}>{isRTL ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.studentId} className={selected.has(s.studentId) ? 'is-selected' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(s.studentId)}
                      onChange={() => toggleOne(s.studentId)}
                    />
                  </td>
                  <td>
                    <div className="mawhba-name-ar">{s.nameAr}</div>
                    {s.nameEn && <div className="mawhba-name-en">{s.nameEn}</div>}
                  </td>
                  <td className="mono">{s.nationalId}</td>
                  <td>{s.sex === 'male' ? (isRTL ? 'ذكر' : 'Male') : s.sex === 'female' ? (isRTL ? 'أنثى' : 'Female') : '—'}</td>
                  <td>{s.schoolGrade || '—'}</td>
                  <td className="ellipsis" title={s.schoolName}>{s.schoolName || '—'}</td>
                  <td className="ellipsis" title={s.courseName}>{s.courseName || '—'}</td>
                  <td className="ellipsis" title={s.email}>{s.email || <span className="muted">—</span>}</td>
                  <td className="mono">{s.studentPhone || '—'}</td>
                  <td>
                    <div className="mawhba-actions">
                      <button className="mawhba-btn-small mawhba-btn-log" onClick={() => openAttendanceLog(s)} title={isRTL ? 'سجل الحضور' : 'Attendance log'}>📅</button>
                      <button className="mawhba-btn-small mawhba-btn-print-row" onClick={() => printOne(s)} disabled={printing} title={isRTL ? 'طباعة البطاقة' : 'Print card'}>🖨</button>
                      <button className="mawhba-btn-small mawhba-btn-card" onClick={() => emailCard(s)} disabled={emailingCard === s.studentId} title={isRTL ? 'إرسال البطاقة عبر البريد' : 'Email card to student'}>{emailingCard === s.studentId ? '…' : '🎫'}</button>
                      <button className="mawhba-btn-small mawhba-btn-mail" onClick={() => openEmailSingle(s)} title={isRTL ? 'إرسال بريد' : 'Send email'}>✉</button>
                      <button className="mawhba-btn-small" onClick={() => openEdit(s)} title={isRTL ? 'تعديل' : 'Edit'}>✎</button>
                      <button className="mawhba-btn-small mawhba-btn-del" onClick={() => deleteStudent(s)} title={isRTL ? 'حذف' : 'Delete'}>×</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showStudentModal && (
        <div className="mawhba-modal-overlay" onClick={() => setShowStudentModal(false)}>
          <div className="mawhba-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingId ? (isRTL ? 'تعديل طالب' : 'Edit Student') : (isRTL ? 'إضافة طالب' : 'Add Student')}</h3>
            <form onSubmit={saveStudent} className="mawhba-form-grid">
              <Field label={isRTL ? 'اسم الطالب (عربي) *' : 'Name (Arabic) *'}>
                <input required value={studentForm.nameAr} onChange={(e) => setStudentForm({ ...studentForm, nameAr: e.target.value })} />
              </Field>
              <Field label={isRTL ? 'اسم الطالب (إنجليزي)' : 'Name (English)'}>
                <input value={studentForm.nameEn} onChange={(e) => setStudentForm({ ...studentForm, nameEn: e.target.value })} />
              </Field>
              <Field label={isRTL ? 'رقم الهوية الوطنية *' : 'National ID *'}>
                <input required value={studentForm.nationalId} onChange={(e) => setStudentForm({ ...studentForm, nationalId: e.target.value })} />
              </Field>
              <Field label={isRTL ? 'الجنسية' : 'Nationality'}>
                <input value={studentForm.nationality} onChange={(e) => setStudentForm({ ...studentForm, nationality: e.target.value })} />
              </Field>
              <Field label={isRTL ? 'الصف الدراسي' : 'School Grade'}>
                <input value={studentForm.schoolGrade} onChange={(e) => setStudentForm({ ...studentForm, schoolGrade: e.target.value })} />
              </Field>
              <Field label={isRTL ? 'الجنس' : 'Sex'}>
                <select value={studentForm.sex} onChange={(e) => setStudentForm({ ...studentForm, sex: e.target.value })}>
                  <option value="">—</option>
                  <option value="male">{isRTL ? 'ذكر' : 'Male'}</option>
                  <option value="female">{isRTL ? 'أنثى' : 'Female'}</option>
                </select>
              </Field>
              <Field label={isRTL ? 'المنطقة الإدارية' : 'Administrative Region'}>
                <input value={studentForm.administrativeRegion} onChange={(e) => setStudentForm({ ...studentForm, administrativeRegion: e.target.value })} />
              </Field>
              <Field label={isRTL ? 'الإدارة التعليمية' : 'Educational Administration'}>
                <input value={studentForm.educationalAdministration} onChange={(e) => setStudentForm({ ...studentForm, educationalAdministration: e.target.value })} />
              </Field>
              <Field label={isRTL ? 'اسم المدرسة' : 'School Name'}>
                <input value={studentForm.schoolName} onChange={(e) => setStudentForm({ ...studentForm, schoolName: e.target.value })} />
              </Field>
              <Field label={isRTL ? 'مدينة سكن الطالب' : 'Residence City'}>
                <input value={studentForm.residenceCity} onChange={(e) => setStudentForm({ ...studentForm, residenceCity: e.target.value })} />
              </Field>
              <Field label={isRTL ? 'الجهة المنفذة' : 'Executing Entity'}>
                <input value={studentForm.executingEntity} onChange={(e) => setStudentForm({ ...studentForm, executingEntity: e.target.value })} />
              </Field>
              <Field label={isRTL ? 'اسم الدورة' : 'Course Name'}>
                <input value={studentForm.courseName} onChange={(e) => setStudentForm({ ...studentForm, courseName: e.target.value })} />
              </Field>
              <Field label={isRTL ? 'رقم البرنامج/الدورة' : 'Course Number'}>
                <input value={studentForm.courseNumber} onChange={(e) => setStudentForm({ ...studentForm, courseNumber: e.target.value })} />
              </Field>
              <Field label={isRTL ? 'مبلغ البرنامج/الدورة' : 'Course Amount'}>
                <input type="number" step="0.01" min="0" value={studentForm.courseAmount} onChange={(e) => setStudentForm({ ...studentForm, courseAmount: e.target.value })} />
              </Field>
              <Field label={isRTL ? 'تاريخ التسجيل' : 'Registration Date'}>
                <input type="date" value={studentForm.registrationDate} onChange={(e) => setStudentForm({ ...studentForm, registrationDate: e.target.value })} />
              </Field>
              <Field label={isRTL ? 'رقم جوال الطالب' : 'Student Phone'}>
                <input value={studentForm.studentPhone} onChange={(e) => setStudentForm({ ...studentForm, studentPhone: e.target.value })} />
              </Field>
              <Field label={isRTL ? 'البريد الإلكتروني' : 'Email'}>
                <input type="email" value={studentForm.email} onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })} />
              </Field>
              <Field label={isRTL ? 'رقم جوال ولي الأمر' : 'Guardian Phone'}>
                <input value={studentForm.guardianPhone} onChange={(e) => setStudentForm({ ...studentForm, guardianPhone: e.target.value })} />
              </Field>

              <div className="mawhba-modal-actions full">
                <button type="button" className="mawhba-btn-secondary" onClick={() => setShowStudentModal(false)} disabled={saving}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="submit" className="mawhba-btn-primary" disabled={saving}>
                  {saving ? (isRTL ? 'جارٍ الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showScanner && (
        <QRScanner onClose={() => setShowScanner(false)} />
      )}

      <UnifiedAttendancePage
        open={attendanceMode}
        onClose={() => setAttendanceMode(false)}
        isRTL={isRTL}
      />

      {showLogModal && logStudent && (
        <div className="mawhba-modal-overlay" onClick={() => setShowLogModal(false)}>
          <div className="mawhba-modal mawhba-log-modal" onClick={(e) => e.stopPropagation()}>
            <h3>📅 {isRTL ? `سجل الحضور — ${logStudent.nameAr}` : `Attendance Log — ${logStudent.nameAr}`}</h3>

            <div className="mawhba-log-summary">
              <div><span>{isRTL ? 'إجمالي الأيام' : 'Total days'}</span><b>{logSummary.total}</b></div>
              <div><span>{isRTL ? 'مكتملة' : 'Completed'}</span><b>{logSummary.completed}</b></div>
              <div><span>{isRTL ? 'لم يخرج بعد' : 'Still in'}</span><b>{logSummary.stillIn}</b></div>
              <div><span>{isRTL ? 'إجمالي الوقت' : 'Total time'}</span><b>{logSummary.hours}h {logSummary.minutes}m</b></div>
            </div>

            <div className="mawhba-log-table-wrap">
              {logLoading ? (
                <div className="mawhba-empty">{isRTL ? 'جارٍ التحميل...' : 'Loading...'}</div>
              ) : logRecords.length === 0 ? (
                <div className="mawhba-empty">{isRTL ? 'لا يوجد سجل حضور بعد' : 'No attendance records yet'}</div>
              ) : (
                <table className="mawhba-log-table">
                  <thead>
                    <tr>
                      <th>{isRTL ? 'التاريخ' : 'Date'}</th>
                      <th>{isRTL ? 'الدخول' : 'Check In'}</th>
                      <th>{isRTL ? 'الخروج' : 'Check Out'}</th>
                      <th>{isRTL ? 'المدة' : 'Duration'}</th>
                      <th>{isRTL ? 'الحالة' : 'Status'}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {logRecords.map(r => {
                      const dur = durationMin(r);
                      const completed = r.checkInAt && r.checkOutAt;
                      return (
                        <tr key={r.attendanceId} className={completed ? 'is-completed' : 'is-partial'}>
                          <td className="mono">{r.date}</td>
                          <td className="mono">{fmtTime(r.checkInAt)}</td>
                          <td className="mono">{fmtTime(r.checkOutAt)}</td>
                          <td className="mono">{dur != null ? `${Math.floor(dur / 60)}h ${dur % 60}m` : '—'}</td>
                          <td>
                            <span className={`mawhba-log-pill ${completed ? 'ok' : 'partial'}`}>
                              {completed ? (isRTL ? '✓ مكتمل' : '✓ Complete') : (isRTL ? '⏳ داخل الآن' : '⏳ Still in')}
                            </span>
                          </td>
                          <td>
                            <div className="mawhba-log-row-actions">
                              {r.checkOutAt && (
                                <button
                                  className="mawhba-btn-small mawhba-btn-warn"
                                  onClick={() => clearCheckoutRecord(r)}
                                  title={isRTL ? 'حذف تسجيل الخروج فقط' : 'Clear check-out only'}
                                >↩</button>
                              )}
                              <button
                                className="mawhba-btn-small mawhba-btn-del"
                                onClick={() => deleteAttendanceRecord(r)}
                                title={isRTL ? 'حذف السجل بالكامل' : 'Delete entire record'}
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

            <div className="mawhba-modal-actions">
              <button className="mawhba-btn-secondary" onClick={() => setShowLogModal(false)}>
                {isRTL ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showExportModal && (
        <div className="mawhba-modal-overlay" onClick={() => !exporting && setShowExportModal(false)}>
          <div className="mawhba-modal mawhba-email-modal" onClick={(e) => e.stopPropagation()}>
            <h3>📥 {isRTL ? 'تصدير سجل الحضور' : 'Export Attendance'}</h3>
            <p className="mawhba-email-targets">
              {isRTL ? `سيتم تصدير سجل ${selected.size} طالب` : `Will export ${selected.size} student(s)`}
            </p>
            <div className="mawhba-form-grid">
              <Field label={isRTL ? 'من تاريخ' : 'From'}>
                <input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} />
              </Field>
              <Field label={isRTL ? 'إلى تاريخ' : 'To'}>
                <input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} />
              </Field>
            </div>
            <p className="mawhba-email-hint" style={{ marginTop: 8 }}>
              {isRTL
                ? 'سيتم تنزيل ملف CSV متوافق مع Excel (مع دعم اللغة العربية).'
                : 'Downloads a UTF-16 CSV that opens cleanly in Excel.'}
            </p>
            <div className="mawhba-modal-actions">
              <button className="mawhba-btn-secondary" onClick={() => setShowExportModal(false)} disabled={exporting}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button className="mawhba-btn-primary" onClick={downloadAttendance} disabled={exporting}>
                {exporting ? (isRTL ? 'جارٍ التصدير...' : 'Exporting...') : (isRTL ? 'تنزيل' : 'Download')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showColorsModal && (
        <div className="mawhba-modal-overlay" onClick={() => setShowColorsModal(false)}>
          <div className="mawhba-modal mawhba-colors-modal" onClick={(e) => e.stopPropagation()}>
            <h3>🎨 {isRTL ? 'ألوان الدورات' : 'Course Colors'}</h3>
            <p className="mawhba-email-hint" style={{ marginBottom: 14 }}>
              {isRTL
                ? 'اختر لوناً مميزاً لكل دورة — سيظهر على بطاقات طلابها (الترويسة + إطار الكود + شريط الدورة).'
                : 'Pick a distinctive color per course — applied to the card header, QR border, and course banner.'}
            </p>
            {courses.length === 0 ? (
              <div className="mawhba-empty">{isRTL ? 'لا توجد دورات بعد' : 'No courses yet'}</div>
            ) : (
              <div className="mawhba-colors-list">
                {courses.map((c) => {
                  const current = colorDraft[c] || colorMap[c] || '#8b5cf6';
                  const saved = colorMap[c];
                  const dirty = saved !== current;
                  return (
                    <div key={c} className="mawhba-color-row">
                      <div className="mawhba-color-swatch" style={{ background: current }} />
                      <div className="mawhba-color-name">{c}</div>
                      <input
                        type="color"
                        className="mawhba-color-input"
                        value={current}
                        onChange={(e) => setColorDraft(prev => ({ ...prev, [c]: e.target.value }))}
                      />
                      <input
                        type="text"
                        className="mawhba-color-hex"
                        value={current}
                        onChange={(e) => {
                          const v = e.target.value.trim();
                          setColorDraft(prev => ({ ...prev, [c]: v }));
                        }}
                        placeholder="#8b5cf6"
                      />
                      <button
                        className="mawhba-btn-secondary"
                        disabled={!dirty || savingColor === c || !/^#[0-9a-fA-F]{6}$/.test(current)}
                        onClick={() => saveCourseColor(c, current)}
                      >
                        {savingColor === c ? (isRTL ? '...' : '...') : (isRTL ? 'حفظ' : 'Save')}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mawhba-modal-actions">
              <button className="mawhba-btn-secondary" onClick={() => setShowColorsModal(false)}>
                {isRTL ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEmailModal && (
        <div className="mawhba-modal-overlay" onClick={() => setShowEmailModal(false)}>
          <div className="mawhba-modal mawhba-email-modal" onClick={(e) => e.stopPropagation()}>
            <h3>✉ {isRTL ? 'إرسال بريد إلكتروني' : 'Send Email'}</h3>
            <p className="mawhba-email-targets">
              {isRTL ? `سيتم الإرسال إلى ${emailTargets.length} طالب` : `Sending to ${emailTargets.length} student(s)`}
            </p>
            <form onSubmit={sendEmail}>
              <Field label={isRTL ? 'الموضوع' : 'Subject'} full>
                <input
                  required
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                  placeholder={isRTL ? 'موضوع الرسالة' : 'Email subject'}
                />
              </Field>
              <Field label={isRTL ? 'نص الرسالة' : 'Message Body'} full>
                <textarea
                  required
                  rows={7}
                  value={emailForm.message}
                  onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })}
                  placeholder={isRTL ? 'اكتب رسالتك هنا. سيتم تنسيقها تلقائيًا.' : 'Write your message here. It will be formatted automatically.'}
                />
              </Field>

              <Field label={isRTL ? 'صورة مرفقة (اختياري)' : 'Photo Attachment (optional)'} full>
                {emailForm.photo ? (
                  <div className="mawhba-photo-preview">
                    <img src={emailForm.photo} alt="preview" />
                    <div className="mawhba-photo-meta">
                      <div className="mawhba-photo-name" title={emailForm.photoName}>{emailForm.photoName || 'image'}</div>
                      <button type="button" className="mawhba-btn-secondary" onClick={clearPhoto}>
                        {isRTL ? '× إزالة' : '× Remove'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="mawhba-photo-picker">
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => onPickPhoto(e.target.files?.[0])}
                    />
                    <span className="mawhba-photo-picker-icon">🖼️</span>
                    <span className="mawhba-photo-picker-label">
                      {isRTL ? 'اختر صورة لإرفاقها (سيتم تضمينها داخل البريد)' : 'Pick an image to attach (will be embedded inline)'}
                    </span>
                    <span className="mawhba-photo-picker-hint">{isRTL ? 'الحد الأقصى 6 ميجابايت' : 'Max 6 MB'}</span>
                  </label>
                )}
              </Field>

              <p className="mawhba-email-hint">
                {isRTL
                  ? 'سيتم تضمين الرسالة في قالب رسمي يحمل شعار فاب لاب وعنوان برنامج موهبة.'
                  : 'Your message will be wrapped in a branded Mawhba template.'}
              </p>
              <div className="mawhba-modal-actions">
                <button type="button" className="mawhba-btn-secondary" onClick={() => setShowEmailModal(false)} disabled={sending}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="submit" className="mawhba-btn-primary" disabled={sending}>
                  {sending ? (isRTL ? 'جارٍ الإرسال...' : 'Sending...') : (isRTL ? 'إرسال' : 'Send')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showNewSeasonModal && (
        <div className="mawhba-modal-overlay" onClick={() => setShowNewSeasonModal(false)}>
          <div
            className="mawhba-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 460 }}
          >
            <h3>{isRTL ? 'موسم موهبة جديد' : 'New Mawhba Season'}</h3>
            <p style={{ color: '#64748b', fontSize: 13.5, margin: '4px 0 16px' }}>
              {isRTL
                ? 'سيبدأ الموسم الجديد بقائمة طلاب فارغة. طلاب المواسم السابقة تبقى محفوظة ويمكن الرجوع لها بتبديل الموسم.'
                : 'The new season starts with an empty roster. Previous seasons stay intact — switch the season picker to view them.'}
            </p>
            <div className="mawhba-form-grid">
              <Field label={isRTL ? 'اسم الموسم' : 'Season name'} full>
                <input
                  type="text"
                  placeholder={isRTL ? 'مثال: موهبة 2027' : 'e.g. Mawhba 2027'}
                  value={newSeasonForm.name}
                  onChange={(e) => setNewSeasonForm(f => ({ ...f, name: e.target.value }))}
                />
              </Field>
              <Field label={isRTL ? 'السنة' : 'Year'}>
                <input
                  type="number"
                  min="2020"
                  max="2100"
                  value={newSeasonForm.year}
                  onChange={(e) => setNewSeasonForm(f => ({ ...f, year: e.target.value }))}
                />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                onClick={() => setShowNewSeasonModal(false)}
                style={{
                  padding: '9px 18px', borderRadius: 6, border: '1.5px solid #cbd5e1',
                  background: '#fff', color: '#334155', fontWeight: 700, cursor: 'pointer'
                }}
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleCreateSeason}
                style={{
                  padding: '9px 22px', borderRadius: 6, border: 'none',
                  background: 'linear-gradient(90deg, #16a34a, #22c55e)',
                  color: '#fff', fontWeight: 800, cursor: 'pointer', letterSpacing: 0.5
                }}
              >
                {isRTL ? 'إنشاء وتفعيل' : 'Create & Activate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Field = ({ label, children, full }) => (
  <div className={`mawhba-field${full ? ' full' : ''}`}>
    <label>{label}</label>
    {children}
  </div>
);

export default Mawhba;
