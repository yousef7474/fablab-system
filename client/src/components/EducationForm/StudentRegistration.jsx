import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';
import StudioShell, { Icon, useStudioTheme } from '../RegistrationForm/StudioShell';
import { EDU_ICONS, EDU_INTRO, EduVerify, EduInfo } from './EduParts';
import './EducationForm.css';

const EMPTY_FORM = { fullName: '', nationalId: '', phoneNumber: '', email: '', schoolName: '', educationLevel: '', parentPhoneNumber: '', personalPhoto: '' };

// Stored values stay Arabic; only the shown label changes with the language.
const LEVELS = [
  { value: 'ابتدائي', en: 'Primary' },
  { value: 'متوسط', en: 'Intermediate' },
  { value: 'ثانوي', en: 'Secondary' },
  { value: 'جامعي', en: 'University' },
  { value: 'أخرى', en: 'Other' }
];

const StudentRegistration = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const tx = (ar, en) => (isRTL ? ar : en);
  const [theme, toggleTheme] = useStudioTheme();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [educationId, setEducationId] = useState('');
  const [educationInfo, setEducationInfo] = useState(null);
  const [students, setStudents] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const handleVerify = async () => {
    if (!educationId.trim()) {
      toast.error(tx('الرجاء إدخال رقم التعليم', 'Please enter the education ID'));
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/education/verify/${encodeURIComponent(educationId.trim())}`);
      setEducationInfo(res.data);
      setStep(2);
      toast.success(tx('تم التحقق بنجاح', 'Verified successfully'));
    } catch (error) {
      toast.error((isRTL ? error.response?.data?.messageAr : error.response?.data?.message) || tx('رقم التعليم غير صحيح', 'Invalid education ID'));
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(tx('حجم الصورة يجب أن لا يتجاوز 5 ميجابايت', 'Image must not exceed 5MB'));
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setForm(prev => ({ ...prev, personalPhoto: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleAddToList = () => {
    const required = ['fullName', 'nationalId', 'phoneNumber', 'schoolName', 'educationLevel', 'parentPhoneNumber', 'personalPhoto'];
    for (const field of required) {
      if (!form[field]) {
        toast.error(tx('جميع الحقول مطلوبة', 'All fields are required'));
        return;
      }
    }
    setStudents(prev => [...prev, { ...form, _tempId: Date.now() }]);
    setForm(EMPTY_FORM);
    toast.success(tx('تم إضافة الطالب إلى القائمة', 'Student added to the list'));
  };

  const handleRemoveFromList = (tempId) => {
    setStudents(prev => prev.filter(s => s._tempId !== tempId));
  };

  const handleSubmit = async () => {
    if (students.length === 0) {
      toast.error(tx('أضف طالباً واحداً على الأقل', 'Add at least one student'));
      return;
    }
    setLoading(true);
    try {
      const payload = students.map(({ _tempId, ...rest }) => rest);
      await api.post(`/education/${encodeURIComponent(educationId)}/students`, { students: payload });
      setSubmitted(true);
      setStep(3);
      toast.success(tx('تم تسجيل الطلاب بنجاح', 'Students registered successfully'));
    } catch (error) {
      toast.error((isRTL ? error.response?.data?.messageAr : error.response?.data?.message) || tx('حدث خطأ أثناء التسجيل', 'Error while registering'));
    } finally {
      setLoading(false);
    }
  };

  const startOver = () => { setStep(1); setStudents([]); setEducationId(''); setEducationInfo(null); setSubmitted(false); };
  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));
  const levelLabel = (v) => (isRTL ? v : (LEVELS.find(l => l.value === v)?.en || v));

  const steps = [
    { key: 'verify', label: tx('رقم التعليم', 'Education ID'), icon: EDU_ICONS.key },
    { key: 'students', label: tx('بيانات الطلاب', 'Students'), icon: EDU_ICONS.students }
  ];

  const shell = {
    isRTL,
    theme,
    onToggleTheme: toggleTheme,
    intro: EDU_INTRO(isRTL),
    subtitle: tx('التعليم · تسجيل الطلاب', 'Education · student registration'),
    servicesHref: '/register'
  };

  // Step 3: Success
  if (step === 3 && submitted) {
    return (
      <StudioShell {...shell}>
        <motion.section
          className="rgx-card edu-done"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <motion.span className="edu-done-ico" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.15 }}>
            <Icon d={EDU_ICONS.done} />
          </motion.span>
          <h2>{tx('تم التسجيل بنجاح!', 'Registered successfully!')}</h2>
          <p>{tx(`تم تسجيل ${students.length} طالب بنجاح`, `${students.length} student(s) registered`)}</p>
          <div className="edu-idbox">
            <small>{tx('رقم التعليم', 'Education ID')}</small>
            <b>{educationId}</b>
          </div>
          <div className="edu-done-actions">
            <button type="button" className="btn btn-primary" onClick={startOver}>
              <Icon d={EDU_ICONS.plus} />
              {tx('تسجيل مجموعة جديدة', 'Register a new group')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>
              <Icon d={EDU_ICONS.home} />
              {tx('الصفحة الرئيسية', 'Home page')}
            </button>
          </div>
        </motion.section>
      </StudioShell>
    );
  }

  return (
    <StudioShell
      {...shell}
      steps={steps}
      activeStep={step - 1}
      onJump={(i) => setStep(i + 1)}
      onHome={startOver}
    >
      <motion.section
        className="rgx-card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className="rgx-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: isRTL ? -24 : 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? 24 : -24 }}
              transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <p className="rgx-step-eyebrow">
                <span>{String(step).padStart(2, '0')}</span>
                {steps[step - 1]?.label}
              </p>

              {/* Step 1: Verify Education ID */}
              {step === 1 && (
                <EduVerify isRTL={isRTL} value={educationId} onChange={setEducationId} onVerify={handleVerify} loading={loading} />
              )}

              {/* Step 2: Add Students */}
              {step === 2 && !submitted && (
                <>
                  <h2 className="step-title">{tx('تسجيل الطلاب', 'Student Registration')}</h2>
                  <p className="step-description">{tx('أضف الطلاب واحدًا تلو الآخر إلى القائمة، ثم سجّلهم دفعة واحدة.', 'Add students to the list one by one, then register them all at once.')}</p>

                  {educationInfo && <EduInfo isRTL={isRTL} info={educationInfo} withSchedule />}

                  <p className="edu-kicker">
                    <Icon d={EDU_ICONS.teacher} />
                    {tx('بيانات الطالب', 'Student details')}
                  </p>

                  <div className="form-grid edu-student-grid">
                    <div className="form-group">
                      <label className="form-label">{tx('الاسم الكامل', 'Full name')} <span className="required">*</span></label>
                      <input type="text" className="form-input" value={form.fullName} onChange={set('fullName')} placeholder={tx('اسم الطالب الكامل', "Student's full name")} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{tx('رقم الهوية', 'National ID')} <span className="required">*</span></label>
                      <input type="text" className="form-input" value={form.nationalId} onChange={set('nationalId')} placeholder={tx('رقم الهوية الوطنية', 'National ID number')} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{tx('رقم الهاتف', 'Phone number')} <span className="required">*</span></label>
                      <input type="tel" className="form-input" value={form.phoneNumber} onChange={set('phoneNumber')} placeholder="05XXXXXXXX" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{tx('البريد الإلكتروني (اختياري)', 'Email (optional)')}</label>
                      <input type="email" className="form-input" value={form.email} onChange={set('email')} placeholder="student@example.com" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{tx('اسم المدرسة', 'School name')} <span className="required">*</span></label>
                      <input type="text" className="form-input" value={form.schoolName} onChange={set('schoolName')} placeholder={tx('اسم المدرسة', 'School name')} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{tx('المرحلة التعليمية', 'Education level')} <span className="required">*</span></label>
                      <select className="form-select" value={form.educationLevel} onChange={set('educationLevel')}>
                        <option value="">{tx('اختر المرحلة', 'Choose a level')}</option>
                        {LEVELS.map(l => <option key={l.value} value={l.value}>{isRTL ? l.value : l.en}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">{tx('رقم هاتف ولي الأمر', "Parent's phone number")} <span className="required">*</span></label>
                      <input type="tel" className="form-input" value={form.parentPhoneNumber} onChange={set('parentPhoneNumber')} placeholder="05XXXXXXXX" />
                    </div>

                    {/* Photo Upload */}
                    <div className="form-group">
                      <label className="form-label">{tx('الصورة الشخصية', 'Personal photo')} <span className="required">*</span></label>
                      <label className={`edu-drop edu-drop-inline${form.personalPhoto ? ' is-done' : ''}`}>
                        {form.personalPhoto ? (
                          <>
                            <img className="edu-avatar" src={form.personalPhoto} alt="" />
                            <b>{tx('تم رفع الصورة — اضغط للتغيير', 'Photo added — tap to change')}</b>
                          </>
                        ) : (
                          <>
                            <Icon d={EDU_ICONS.photo} />
                            <b>{tx('اضغط لرفع الصورة', 'Tap to upload a photo')}</b>
                          </>
                        )}
                        <input type="file" accept="image/*" onChange={handlePhotoUpload} hidden />
                      </label>
                    </div>
                  </div>

                  <div className="edu-add-actions">
                    <button type="button" className="btn" onClick={handleAddToList}>
                      <Icon d={EDU_ICONS.plus} />
                      {tx('إضافة إلى القائمة', 'Add to list')}
                    </button>
                  </div>

                  {/* Students list */}
                  <div className="edu-list-head">
                    <h3>{tx('قائمة الطلاب', 'Student list')}</h3>
                    <span className="edu-pill">{students.length}</span>
                  </div>
                  {students.length > 0 ? (
                    <div className="edu-list">
                      {students.map(s => (
                        <div className="edu-row" key={s._tempId}>
                          <img src={s.personalPhoto} alt="" />
                          <div className="edu-row-main">
                            <b>{s.fullName}</b>
                            <small>
                              <bdi>{s.nationalId}</bdi> · {s.schoolName} · {levelLabel(s.educationLevel)}
                              <br />
                              {tx('الهاتف', 'Phone')} <bdi>{s.phoneNumber}</bdi> · {tx('ولي الأمر', 'Parent')} <bdi>{s.parentPhoneNumber}</bdi>
                              {s.email && <> · <bdi>{s.email}</bdi></>}
                            </small>
                          </div>
                          <button type="button" className="edu-row-del" onClick={() => handleRemoveFromList(s._tempId)}>
                            {tx('حذف', 'Remove')}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="edu-empty">{tx('لم تتم إضافة أي طالب بعد', 'No students added yet')}</div>
                  )}

                  {students.length > 0 && (
                    <div className="form-navigation">
                      <button type="button" className="btn btn-primary btn-submit" onClick={handleSubmit} disabled={loading}>
                        {loading ? <span className="loading-spinner" /> : (
                          <>
                            <Icon d={EDU_ICONS.done} />
                            {tx(`تسجيل الطلاب (${students.length})`, `Register students (${students.length})`)}
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.section>
    </StudioShell>
  );
};

export default StudentRegistration;
