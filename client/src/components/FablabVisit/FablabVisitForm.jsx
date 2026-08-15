import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import axios from 'axios';
import './FablabVisitForm.css';

// This form posts publicly to /api/public/fablab-visit/submit — no auth.
const API_URL = process.env.NODE_ENV === 'production'
  ? '/api'
  : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');

const initialForm = {
  entityName: '',
  personInCharge: '',
  nationalId: '',
  phone: '',
  email: '',
  visitorsCount: 1,
  visitDate: '',
  visitStartTime: '',
  visitEndTime: '',
  purpose: '',
  notes: ''
};

const FablabVisitForm = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  const setField = (name, value) => {
    setForm(f => ({ ...f, [name]: value }));
    if (errors[name]) setErrors(e => ({ ...e, [name]: null }));
  };

  const validate = () => {
    const err = {};
    if (!form.entityName.trim())     err.entityName = isRTL ? 'مطلوب' : 'Required';
    if (!form.personInCharge.trim()) err.personInCharge = isRTL ? 'مطلوب' : 'Required';
    if (!form.phone.trim())          err.phone = isRTL ? 'مطلوب' : 'Required';
    if (!form.email.trim())          err.email = isRTL ? 'مطلوب' : 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      err.email = isRTL ? 'بريد غير صالح' : 'Invalid email';
    if (!form.visitDate)             err.visitDate = isRTL ? 'مطلوب' : 'Required';
    if (!form.visitStartTime)        err.visitStartTime = isRTL ? 'مطلوب' : 'Required';
    if (!form.visitEndTime)          err.visitEndTime = isRTL ? 'مطلوب' : 'Required';
    if (form.visitStartTime && form.visitEndTime && form.visitStartTime >= form.visitEndTime) {
      err.visitEndTime = isRTL ? 'يجب أن يكون بعد وقت البداية' : 'Must be after start time';
    }
    if (!form.purpose.trim())        err.purpose = isRTL ? 'مطلوب' : 'Required';
    if (!(Number(form.visitorsCount) > 0)) err.visitorsCount = isRTL ? 'قيمة غير صحيحة' : 'Invalid';
    return err;
  };

  const submit = async (e) => {
    e.preventDefault();
    const err = validate();
    setErrors(err);
    if (Object.keys(err).length) {
      toast.error(isRTL ? 'يوجد حقول ناقصة' : 'Please fill in required fields');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/public/fablab-visit/submit`, {
        ...form,
        visitorsCount: Number(form.visitorsCount) || 1
      });
      setSubmitted(true);
      toast.success(isRTL ? 'تم إرسال طلبك' : 'Request submitted');
    } catch (er) {
      toast.error(er?.response?.data?.messageAr || er?.response?.data?.message || (isRTL ? 'حدث خطأ' : 'Error'));
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="fv" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Slim topbar */}
      <header className="fv-topbar">
        <div className="fv-topbar-inner">
          <button className="fv-topbar-brand" onClick={() => navigate('/register')} type="button">
            <img src="/logo.png" alt="" className="fv-topbar-logo" />
            <div className="fv-topbar-titles">
              <span className="fv-topbar-title">{isRTL ? 'فاب لاب الأحساء' : 'FabLab Al-Ahsa'}</span>
              <span className="fv-topbar-sub">{isRTL ? 'طلب زيارة' : 'Visit Request'}</span>
            </div>
          </button>
          <button
            className="fv-topbar-back"
            type="button"
            onClick={() => navigate('/register')}
            title={isRTL ? 'العودة' : 'Back'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span>{isRTL ? 'الرئيسية' : 'Home'}</span>
          </button>
        </div>
      </header>

      <main className="fv-main">
        <AnimatePresence mode="wait">
          {!submitted ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35, ease: [0.2, 0.9, 0.2, 1] }}
            >
              <header className="fv-hero">
                <span className="fv-hero-eyebrow">{isRTL ? 'زيارات فاب لاب' : 'FABLAB VISITS'}</span>
                <h1 className="fv-hero-title">
                  {isRTL ? 'طلب زيارة لفاب لاب الأحساء' : 'Request a Visit to FabLab Al-Ahsa'}
                </h1>
                <p className="fv-hero-sub">
                  {isRTL
                    ? 'يمكن للجهات والمدارس والوفود تقديم طلب زيارة تعريفية أو استكشافية. سيتم مراجعة الطلب من قِبل الإدارة والرد عليكم عبر البريد الإلكتروني.'
                    : 'Entities, schools, and groups can request an introductory or exploratory tour. The administration will review your request and reply by email.'}
                </p>
              </header>

              <form className="fv-card" onSubmit={submit} noValidate>
                <div className="fv-section">
                  <div className="fv-section-title">{isRTL ? 'معلومات الجهة' : 'Entity Information'}</div>
                  <div className="fv-grid">
                    <div className="fv-field fv-field--full">
                      <label>{isRTL ? 'اسم الجهة / المدرسة *' : 'Entity / School Name *'}</label>
                      <input
                        type="text"
                        value={form.entityName}
                        onChange={(e) => setField('entityName', e.target.value)}
                        className={errors.entityName ? 'has-error' : ''}
                        placeholder={isRTL ? 'مثال: مدرسة الأحساء الأهلية' : 'e.g. Al-Ahsa National School'}
                      />
                      {errors.entityName && <span className="fv-err">{errors.entityName}</span>}
                    </div>

                    <div className="fv-field">
                      <label>{isRTL ? 'الشخص المسؤول *' : 'Person in Charge *'}</label>
                      <input
                        type="text"
                        value={form.personInCharge}
                        onChange={(e) => setField('personInCharge', e.target.value)}
                        className={errors.personInCharge ? 'has-error' : ''}
                        placeholder={isRTL ? 'الاسم الكامل' : 'Full name'}
                      />
                      {errors.personInCharge && <span className="fv-err">{errors.personInCharge}</span>}
                    </div>

                    <div className="fv-field">
                      <label>{isRTL ? 'رقم الهوية (اختياري)' : 'National ID (optional)'}</label>
                      <input
                        type="text"
                        value={form.nationalId}
                        onChange={(e) => setField('nationalId', e.target.value)}
                        inputMode="numeric"
                        dir="ltr"
                      />
                    </div>

                    <div className="fv-field">
                      <label>{isRTL ? 'رقم الجوال *' : 'Phone *'}</label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setField('phone', e.target.value)}
                        className={errors.phone ? 'has-error' : ''}
                        dir="ltr"
                        placeholder="05XXXXXXXX"
                      />
                      {errors.phone && <span className="fv-err">{errors.phone}</span>}
                    </div>

                    <div className="fv-field">
                      <label>{isRTL ? 'البريد الإلكتروني *' : 'Email *'}</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setField('email', e.target.value)}
                        className={errors.email ? 'has-error' : ''}
                        dir="ltr"
                        placeholder="name@example.com"
                      />
                      {errors.email && <span className="fv-err">{errors.email}</span>}
                    </div>
                  </div>
                </div>

                <div className="fv-section">
                  <div className="fv-section-title">{isRTL ? 'تفاصيل الزيارة' : 'Visit Details'}</div>
                  <div className="fv-grid">
                    <div className="fv-field">
                      <label>{isRTL ? 'عدد الزوار *' : 'Number of Visitors *'}</label>
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={form.visitorsCount}
                        onChange={(e) => setField('visitorsCount', e.target.value)}
                        className={errors.visitorsCount ? 'has-error' : ''}
                        dir="ltr"
                      />
                      {errors.visitorsCount && <span className="fv-err">{errors.visitorsCount}</span>}
                    </div>

                    <div className="fv-field">
                      <label>{isRTL ? 'تاريخ الزيارة *' : 'Visit Date *'}</label>
                      <input
                        type="date"
                        min={today}
                        value={form.visitDate}
                        onChange={(e) => setField('visitDate', e.target.value)}
                        className={errors.visitDate ? 'has-error' : ''}
                        dir="ltr"
                      />
                      {errors.visitDate && <span className="fv-err">{errors.visitDate}</span>}
                    </div>

                    <div className="fv-field">
                      <label>{isRTL ? 'من الساعة *' : 'Start Time *'}</label>
                      <input
                        type="time"
                        value={form.visitStartTime}
                        onChange={(e) => setField('visitStartTime', e.target.value)}
                        className={errors.visitStartTime ? 'has-error' : ''}
                        dir="ltr"
                      />
                      {errors.visitStartTime && <span className="fv-err">{errors.visitStartTime}</span>}
                    </div>

                    <div className="fv-field">
                      <label>{isRTL ? 'إلى الساعة *' : 'End Time *'}</label>
                      <input
                        type="time"
                        value={form.visitEndTime}
                        onChange={(e) => setField('visitEndTime', e.target.value)}
                        className={errors.visitEndTime ? 'has-error' : ''}
                        dir="ltr"
                      />
                      {errors.visitEndTime && <span className="fv-err">{errors.visitEndTime}</span>}
                    </div>

                    <div className="fv-field fv-field--full">
                      <label>{isRTL ? 'الغرض من الزيارة *' : 'Purpose of Visit *'}</label>
                      <textarea
                        rows={4}
                        value={form.purpose}
                        onChange={(e) => setField('purpose', e.target.value)}
                        className={errors.purpose ? 'has-error' : ''}
                        placeholder={isRTL
                          ? 'اشرح باختصار الغرض من الزيارة، الفئة المستفيدة، والاهتمامات...'
                          : 'Briefly describe the purpose, audience, and topics of interest...'}
                      />
                      {errors.purpose && <span className="fv-err">{errors.purpose}</span>}
                    </div>

                    <div className="fv-field fv-field--full">
                      <label>{isRTL ? 'ملاحظات إضافية (اختياري)' : 'Additional Notes (optional)'}</label>
                      <textarea
                        rows={3}
                        value={form.notes}
                        onChange={(e) => setField('notes', e.target.value)}
                        placeholder={isRTL
                          ? 'احتياجات خاصة، لغة التعريف، وسيلة الوصول...'
                          : 'Special requirements, language preference, transport...'}
                      />
                    </div>
                  </div>
                </div>

                <div className="fv-actions">
                  <button
                    type="button"
                    className="fv-btn fv-btn--ghost"
                    onClick={() => setForm(initialForm)}
                    disabled={submitting}
                  >
                    {isRTL ? 'مسح' : 'Reset'}
                  </button>
                  <button
                    type="submit"
                    className="fv-btn fv-btn--primary"
                    disabled={submitting}
                  >
                    {submitting
                      ? (isRTL ? 'جارٍ الإرسال...' : 'Submitting...')
                      : (isRTL ? 'إرسال الطلب' : 'Submit Request')}
                  </button>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="thanks"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.2, 0.9, 0.2, 1] }}
              className="fv-card fv-thanks"
            >
              <div className="fv-thanks-check">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h2 className="fv-thanks-title">
                {isRTL ? 'تم استلام طلبك' : 'Request Received'}
              </h2>
              <p className="fv-thanks-body">
                {isRTL
                  ? 'سيتم مراجعة طلب الزيارة من قِبل الإدارة، والرد عليكم على البريد الإلكتروني المسجّل خلال أيام العمل التالية.'
                  : 'The administration will review your request and reply to your registered email within the next business days.'}
              </p>
              <div className="fv-thanks-summary">
                <div><span>{isRTL ? 'الجهة' : 'Entity'}</span><b>{form.entityName}</b></div>
                <div><span>{isRTL ? 'التاريخ' : 'Date'}</span><b dir="ltr">{form.visitDate}</b></div>
                <div><span>{isRTL ? 'الوقت' : 'Time'}</span><b dir="ltr">{form.visitStartTime} → {form.visitEndTime}</b></div>
                <div><span>{isRTL ? 'الزوار' : 'Visitors'}</span><b>{form.visitorsCount}</b></div>
              </div>
              <div className="fv-actions" style={{ justifyContent: 'center', marginTop: 24 }}>
                <button className="fv-btn fv-btn--ghost" onClick={() => { setForm(initialForm); setSubmitted(false); }}>
                  {isRTL ? 'تقديم طلب آخر' : 'Submit Another'}
                </button>
                <button className="fv-btn fv-btn--primary" onClick={() => navigate('/register')}>
                  {isRTL ? 'العودة للرئيسية' : 'Back to Home'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default FablabVisitForm;
