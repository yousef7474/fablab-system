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
  const [selected, setSelected] = useState(new Set());

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
      if (search.trim()) params.set('search', search.trim());
      const { data } = await api.get(`/mawhba/students?${params.toString()}`);
      setStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'تعذر تحميل قائمة الطلاب' : 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [sexFilter, search, isRTL]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

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
        <button
          className="mawhba-btn-email"
          onClick={openEmailBulk}
          disabled={selected.size === 0}
        >
          ✉ {isRTL ? `إرسال بريد (${selected.size})` : `Send Email (${selected.size})`}
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
