import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../../config/api';
import './Mawhba.css';

const EMPTY_STUDENT = {
  nameAr: '', nameEn: '', nationalId: '', nationality: '', schoolGrade: '',
  administrativeRegion: '', educationalAdministration: '', schoolName: '',
  sex: '', residenceCity: '', executingEntity: '', courseName: '', courseNumber: '',
  courseAmount: '', registrationDate: '', studentPhone: '', email: '', guardianPhone: ''
};

const EMPTY_EMAIL = { subject: '', message: '' };

const Mawhba = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sexFilter, setSexFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [courses, setCourses] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [printing, setPrinting] = useState(false);
  const [emailingCard, setEmailingCard] = useState(null);

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
      const { data } = await api.get(`/mawhba/students?${params.toString()}`);
      setStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'تعذر تحميل قائمة الطلاب' : 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [sexFilter, courseFilter, search, isRTL]);

  const fetchCourses = useCallback(async () => {
    try {
      const { data } = await api.get('/mawhba/courses');
      setCourses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);
  useEffect(() => { fetchCourses(); }, [fetchCourses]);

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

  const sendEmail = async (e) => {
    e?.preventDefault?.();
    if (!emailForm.subject.trim()) { toast.error(isRTL ? 'الموضوع مطلوب' : 'Subject required'); return; }
    if (!emailForm.message.trim()) { toast.error(isRTL ? 'الرسالة مطلوبة' : 'Message required'); return; }
    setSending(true);
    try {
      const { data } = await api.post('/mawhba/send-email', {
        studentIds: emailTargets,
        subject: emailForm.subject.trim(),
        message: emailForm.message.trim()
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

  const renderCardHtml = (student, qrDataUrl) => {
    const name = student.nameAr || student.nameEn || '';
    const nid = student.nationalId || '';
    const guardian = student.guardianPhone || student.studentPhone || '';
    const course = student.courseName || '';
    const grade = student.schoolGrade || '';
    const logoSrc = `${window.location.origin}/fablab.png`;
    return `
      <div class="mawhba-card" dir="rtl">
        <div class="mawhba-card-top">
          <div class="mawhba-card-brand">
            <img src="${logoSrc}" alt="FabLab" class="mawhba-card-logo" />
            <div>
              <div class="mawhba-card-fablab">فاب لاب الأحساء</div>
              <div class="mawhba-card-fablab-en">FABLAB AL-AHSA</div>
            </div>
          </div>
          <div class="mawhba-card-program">
            <div class="mawhba-card-program-ar">برنامج موهبة</div>
            <div class="mawhba-card-program-en">MAWHBA</div>
          </div>
        </div>
        <div class="mawhba-card-body">
          <div class="mawhba-card-name-label">اسم الطالب / STUDENT NAME</div>
          <div class="mawhba-card-name">${name}</div>
          <div class="mawhba-card-row">
            <div class="mawhba-card-field">
              <div class="mawhba-card-field-label">رقم الهوية</div>
              <div class="mawhba-card-field-value mono">${nid}</div>
            </div>
            <div class="mawhba-card-field">
              <div class="mawhba-card-field-label">رقم ولي الأمر</div>
              <div class="mawhba-card-field-value mono">${guardian || '—'}</div>
            </div>
          </div>
          <div class="mawhba-card-row">
            <div class="mawhba-card-field wide">
              <div class="mawhba-card-field-label">اسم الدورة</div>
              <div class="mawhba-card-field-value">${course || '—'}</div>
            </div>
            ${grade ? `<div class="mawhba-card-field">
              <div class="mawhba-card-field-label">الصف</div>
              <div class="mawhba-card-field-value">${grade}</div>
            </div>` : ''}
          </div>
        </div>
        <div class="mawhba-card-bottom">
          <div class="mawhba-card-qr-wrap">
            <img src="${qrDataUrl}" alt="QR" class="mawhba-card-qr" />
            <div class="mawhba-card-qr-label">رمز الحضور · ATTENDANCE</div>
          </div>
          <div class="mawhba-card-footer-text">
            <div>هذه البطاقة ملك لفاب لاب الأحساء — يرجى إعادتها عند الفقدان</div>
            <div class="mono">ID · ${nid}</div>
          </div>
        </div>
      </div>`;
  };

  const CARD_PRINT_CSS = `
    body { margin: 0; background: #f1f5f9; padding: 24px; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
    .mawhba-cards-wrap { display: flex; flex-wrap: wrap; gap: 24px; justify-content: center; }
    .mawhba-card { width: 340px; min-height: 540px; background: white; border-radius: 18px;
      box-shadow: 0 20px 40px -20px rgba(15,23,42,0.4); overflow: hidden; position: relative;
      color: #0f172a; border: 1px solid #e2e8f0; }
    .mawhba-card::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 6px;
      background: linear-gradient(90deg,#f59e0b 0%,#ef4444 35%,#ec4899 65%,#8b5cf6 100%); }
    .mawhba-card-top { background: linear-gradient(135deg,#0f172a 0%,#1e1b4b 60%,#4c1d95 100%);
      padding: 16px 18px; display: flex; justify-content: space-between; align-items: center; color: white; }
    .mawhba-card-brand { display: flex; align-items: center; gap: 10px; }
    .mawhba-card-logo { width: 38px; height: 38px; background: white; border-radius: 8px; padding: 4px; object-fit: contain; }
    .mawhba-card-fablab { font-size: 13px; font-weight: 800; line-height: 1.2; }
    .mawhba-card-fablab-en { font-size: 9px; letter-spacing: 1.4px; color: rgba(255,255,255,0.7); margin-top: 2px; }
    .mawhba-card-program { text-align: end; }
    .mawhba-card-program-ar { font-size: 18px; font-weight: 800; background: linear-gradient(135deg,#fde68a,#fbbf24);
      -webkit-background-clip: text; background-clip: text; color: transparent; }
    .mawhba-card-program-en { font-size: 9px; letter-spacing: 2.5px; color: rgba(255,255,255,0.65); margin-top: 2px; }
    .mawhba-card-body { padding: 18px 18px 8px; }
    .mawhba-card-name-label { font-size: 9px; letter-spacing: 1.4px; color: #94a3b8; font-weight: 700; margin-bottom: 4px; }
    .mawhba-card-name { font-size: 19px; font-weight: 800; color: #0f172a; line-height: 1.35;
      padding-bottom: 12px; border-bottom: 1px dashed #e2e8f0; margin-bottom: 12px; }
    .mawhba-card-row { display: flex; gap: 10px; margin-bottom: 12px; }
    .mawhba-card-field { flex: 1; min-width: 0; }
    .mawhba-card-field.wide { flex: 2; }
    .mawhba-card-field-label { font-size: 9px; letter-spacing: 1.3px; color: #8b5cf6; font-weight: 700; margin-bottom: 3px; }
    .mawhba-card-field-value { font-size: 13px; font-weight: 700; color: #0f172a; word-break: break-word; }
    .mawhba-card-field-value.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; letter-spacing: 0.5px; }
    .mawhba-card-bottom { padding: 6px 18px 22px; text-align: center; }
    .mawhba-card-qr-wrap { background: linear-gradient(135deg,#faf5ff 0%,#fef3c7 100%); border: 1px solid #e9d5ff;
      border-radius: 12px; padding: 10px; display: inline-flex; flex-direction: column; align-items: center; gap: 4px; }
    .mawhba-card-qr { width: 130px; height: 130px; display: block; }
    .mawhba-card-qr-label { font-size: 9px; letter-spacing: 1.6px; color: #6d28d9; font-weight: 800; }
    .mawhba-card-footer-text { margin-top: 10px; font-size: 9px; color: #64748b; line-height: 1.5; }
    .mawhba-card-footer-text .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      margin-top: 2px; color: #334155; letter-spacing: 1px; }
    @media print {
      body { background: white; padding: 0; }
      .mawhba-cards-wrap { gap: 12px; padding: 8px; }
      .mawhba-card { box-shadow: none; break-inside: avoid; }
    }
  `;

  const openPrintWindow = (cardsHtml) => {
    const win = window.open('', '_blank', 'width=820,height=900');
    if (!win) {
      toast.error(isRTL ? 'تم منع النوافذ المنبثقة' : 'Pop-up blocked — allow pop-ups for this site');
      return;
    }
    win.document.open();
    win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${isRTL ? 'بطاقات موهبة' : 'Mawhba Cards'}</title><style>${CARD_PRINT_CSS}</style></head><body><div class="mawhba-cards-wrap">${cardsHtml}</div><script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></body></html>`);
    win.document.close();
  };

  const printOne = async (s) => {
    setPrinting(true);
    try {
      const { data } = await api.get(`/mawhba/students/${s.studentId}/card`);
      openPrintWindow(renderCardHtml(data.student, data.qrDataUrl));
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
      const html = (data || []).map(d => renderCardHtml(d.student, d.qrDataUrl)).join('');
      if (!html) { toast.error(isRTL ? 'لا توجد بطاقات' : 'No cards'); return; }
      openPrintWindow(html);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'تعذر تحضير البطاقات' : 'Failed to prepare cards');
    } finally {
      setPrinting(false);
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

  return (
    <div className="mawhba-tab" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mawhba-header">
        <div>
          <h2 className="mawhba-title">{isRTL ? 'موهبة' : 'Mawhba'}</h2>
          <p className="mawhba-sub">{isRTL ? 'إدارة الطلاب الموهوبين والتواصل معهم' : 'Manage talented students and communicate with them'}</p>
        </div>
        <button className="mawhba-btn-primary" onClick={openAdd}>
          + {isRTL ? 'إضافة طالب' : 'Add Student'}
        </button>
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
                  rows={8}
                  value={emailForm.message}
                  onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })}
                  placeholder={isRTL ? 'اكتب رسالتك هنا. سيتم تنسيقها تلقائيًا.' : 'Write your message here. It will be formatted automatically.'}
                />
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
