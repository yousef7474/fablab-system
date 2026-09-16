import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import axios from 'axios';
import './WorkshopRegistration.css';

const API_URL = process.env.NODE_ENV === 'production' ? '/api' : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');
const api = axios.create({ baseURL: API_URL });

const WorkshopRegistration = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [step, setStep] = useState(0); // 0=personal info, 1=select workshop, 2=invoice, 3=done
  const [workshops, setWorkshops] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const [lookupMode, setLookupMode] = useState(true);
  const [lookupValue, setLookupValue] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);

  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', email: '',
    nationalId: '', gender: '', age: '', city: '',
    workshopId: '',
    paymentMethod: 'bank_transfer' // 'bank_transfer' | 'mada'
  });

  // Payment settings (bank / mada) for the currently selected paid
  // workshop — fetched when the customer lands on step 2.
  const [payment, setPayment] = useState({ bank: null, mada: null });
  const [proofFile, setProofFile] = useState(null); // { fileName, fileType, fileSize, fileData }
  const [copiedField, setCopiedField] = useState(null);

  useEffect(() => {
    api.get('/workshops/active').then(res => setWorkshops(res.data || [])).catch(() => {});
  }, []);

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canProceedStep0 = form.firstName && form.lastName && form.phone && form.email && isValidEmail(form.email) && form.nationalId && form.gender && form.age && form.city;
  const canProceedStep1 = form.workshopId;

  const selectedWorkshopEarly = workshops.find(w => w.workshopId === form.workshopId);
  const workshopIsPaid = selectedWorkshopEarly && Number(selectedWorkshopEarly.price) > 0;
  const canProceedStep2 = !workshopIsPaid
    || (form.paymentMethod === 'mada')
    || (form.paymentMethod === 'bank_transfer' && !!proofFile);

  // Fetch bank + mada settings on entering step 2 for a paid workshop.
  useEffect(() => {
    if (step === 2 && workshopIsPaid && form.workshopId && !payment.bank && !payment.mada) {
      api.get(`/workshops/public/${form.workshopId}/payment-settings`)
        .then(res => setPayment({ bank: res.data.bank || null, mada: res.data.mada || null }))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form.workshopId]);

  // Read a File into { fileName, fileType, fileSize, fileData (base64) }.
  const readAsFilePayload = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const raw = String(e.target.result || '');
      const b64 = raw.includes(',') ? raw.split(',').pop() : raw;
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      resolve({ fileName: file.name, fileType: ext, fileSize: file.size, fileData: b64 });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleProofUpload = async (fileList) => {
    const file = fileList?.[0];
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'webp', 'pdf'].includes(ext)) {
      toast.error(isRTL ? 'الصيغة غير مدعومة — اختر صورة أو PDF' : 'Unsupported format — pick an image or PDF');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(isRTL ? 'حجم الملف أكبر من 10 ميجابايت' : 'File is larger than 10 MB');
      return;
    }
    try {
      const payload = await readAsFilePayload(file);
      setProofFile(payload);
    } catch {
      toast.error(isRTL ? 'تعذّر قراءة الملف' : 'Failed to read the file');
    }
  };

  const copyToClipboard = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for older browsers without the async clipboard API.
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta);
      ta.select(); try { document.execCommand('copy'); } catch {}
      ta.remove();
    }
    setCopiedField(key);
    setTimeout(() => setCopiedField(prev => prev === key ? null : prev), 1600);
  };

  const handleStep1Next = async () => {
    if (!form.workshopId) return;
    // Check age range on frontend
    const sw = workshops.find(w => w.workshopId === form.workshopId);
    if (sw && form.age) {
      const studentAge = parseInt(form.age);
      if (!isNaN(studentAge)) {
        if (sw.minAge && studentAge < sw.minAge) {
          window.alert(isRTL ? `العمر يجب أن يكون بين ${sw.minAge} و ${sw.maxAge || '∞'} سنة. عمرك: ${studentAge}` : `Age must be ${sw.minAge}-${sw.maxAge || '∞'}. Your age: ${studentAge}`);
          return;
        }
        if (sw.maxAge && studentAge > sw.maxAge) {
          window.alert(isRTL ? `العمر يجب أن يكون بين ${sw.minAge || 0} و ${sw.maxAge} سنة. عمرك: ${studentAge}` : `Age must be ${sw.minAge || 0}-${sw.maxAge}. Your age: ${studentAge}`);
          return;
        }
      }
    }
    try {
      if (form.nationalId) {
        const params = new URLSearchParams({ workshopId: form.workshopId, nationalId: form.nationalId });
        const res = await api.get(`/workshops/check-duplicate?${params}`);
        if (res.data.duplicate) {
          window.alert(isRTL
            ? 'هذا الطالب مسجل بالفعل في هذه الورشة بنفس رقم الهوية.'
            : 'This student is already registered for this workshop with the same National ID.');
          return;
        }
      }
    } catch (e) {}
    setStep(2);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const paid = workshopIsPaid;
      const payload = {
        ...form,
        paymentMethod: paid ? form.paymentMethod : 'free',
        paymentProof: paid && form.paymentMethod === 'bank_transfer' ? proofFile : null
      };
      const res = await api.post('/workshops/register', payload);
      setResult(res.data);
      setStep(3);
      toast.success(isRTL ? 'تم التسجيل بنجاح!' : 'Registration successful!');
    } catch (error) {
      const msg = error.response?.data?.messageAr || error.response?.data?.message || (isRTL ? 'خطأ في التسجيل' : 'Registration error');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedWorkshop = workshops.find(w => w.workshopId === form.workshopId);

  const handleLookup = async () => {
    if (!lookupValue.trim()) return;
    setLookupLoading(true);
    try {
      const res = await api.get(`/workshops/lookup-student?identifier=${encodeURIComponent(lookupValue.trim())}`);
      if (res.data.found) {
        const s = res.data.student;
        setForm(prev => ({ ...prev, firstName: s.firstName || '', lastName: s.lastName || '', phone: s.phone || '', email: s.email || '', nationalId: s.nationalId || '', gender: s.gender || '', age: s.age || '', city: s.city || '' }));
        toast.success(isRTL ? 'مرحباً بعودتك! تم تعبئة بياناتك' : 'Welcome back! Your info has been filled');
        setStep(1);
      } else {
        toast.info(isRTL ? 'لم يتم العثور على تسجيل سابق — يرجى إدخال بياناتك' : 'No previous registration found — please enter your info');
        setLookupMode(false);
      }
    } catch (error) {
      setLookupMode(false);
    } finally {
      setLookupLoading(false);
    }
  };

  const toggleLanguage = () => i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar');

  return (
    <div className="workshop-reg-page" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="workshop-reg-container">
        <motion.div className="workshop-reg-card" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="workshop-reg-header">
            <div className="workshop-reg-logos">
              <img src="/fablab.png" alt="FabLab" style={{ height: 50 }} />
              <img src="/found.png" alt="Foundation" style={{ height: 50 }} />
            </div>
            <h1>{isRTL ? 'تسجيل في الورش التدريبية' : 'Workshop Registration'}</h1>
            <p>FABLAB Al-Ahsa</p>
          </div>

          {/* Stepper */}
          <div className="workshop-stepper">
            {[
              isRTL ? 'البيانات الشخصية' : 'Personal Info',
              isRTL ? 'اختيار الورشة' : 'Select Workshop',
              isRTL ? 'الدفع والتأكيد' : 'Payment & Confirm',
            ].map((label, i) => (
              <div key={i} className={`workshop-step ${step > i ? 'completed' : step === i ? 'active' : ''}`}>
                <div className="workshop-step-circle">{step > i ? '✓' : i + 1}</div>
                <span className="workshop-step-label">{label}</span>
                {i < 2 && <div className="workshop-step-line" />}
              </div>
            ))}
          </div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="step0" className="workshop-step-content" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                {lookupMode ? (
                  <>
                    <h3>{isRTL ? 'هل سبق لك التسجيل؟' : 'Already registered before?'}</h3>
                    <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '1.5rem' }}>{isRTL ? 'أدخل رقم الهاتف أو رقم الهوية للمتابعة بسرعة' : 'Enter your phone or national ID to continue quickly'}</p>
                    <div className="workshop-field" style={{ maxWidth: 400, margin: '0 auto' }}>
                      <input
                        dir="ltr"
                        value={lookupValue}
                        onChange={e => setLookupValue(e.target.value)}
                        placeholder={isRTL ? 'رقم الهاتف أو رقم الهوية' : 'Phone number or National ID'}
                        style={{ textAlign: 'center', fontSize: '1.1rem' }}
                        onKeyDown={e => e.key === 'Enter' && handleLookup()}
                      />
                    </div>
                    <div className="workshop-actions" style={{ justifyContent: 'center', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                      <button className="workshop-btn-next" disabled={!lookupValue.trim() || lookupLoading} onClick={handleLookup}>
                        {lookupLoading ? (isRTL ? 'جاري البحث...' : 'Searching...') : (isRTL ? 'بحث' : 'Search')}
                      </button>
                      <button onClick={() => setLookupMode(false)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '0.88rem', fontFamily: 'inherit' }}>
                        {isRTL ? 'تسجيل جديد' : 'Register as new'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3>{isRTL ? 'البيانات الشخصية' : 'Personal Information'}</h3>
                    <div className="workshop-form-grid">
                      <div className="workshop-field">
                        <label>{isRTL ? 'الاسم الأول' : 'First Name'} *</label>
                        <input value={form.firstName} onChange={e => handleChange('firstName', e.target.value)} />
                      </div>
                      <div className="workshop-field">
                        <label>{isRTL ? 'الاسم الأخير' : 'Last Name'} *</label>
                        <input value={form.lastName} onChange={e => handleChange('lastName', e.target.value)} />
                      </div>
                      <div className="workshop-field">
                        <label>{isRTL ? 'رقم الهاتف' : 'Phone'} *</label>
                        <input type="tel" dir="ltr" value={form.phone} onChange={e => handleChange('phone', e.target.value)} />
                      </div>
                      <div className="workshop-field">
                        <label>{isRTL ? 'البريد الإلكتروني' : 'Email'} *</label>
                        <input type="email" dir="ltr" value={form.email} onChange={e => handleChange('email', e.target.value)} />
                        {form.email && !isValidEmail(form.email) && (
                          <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 4, display: 'block' }}>
                            {isRTL ? 'البريد الإلكتروني غير صحيح' : 'Invalid email address'}
                          </span>
                        )}
                      </div>
                      <div className="workshop-field">
                        <label>{isRTL ? 'رقم هوية الطالب' : "Student's National ID"} *</label>
                        <input dir="ltr" value={form.nationalId} onChange={e => handleChange('nationalId', e.target.value)} />
                      </div>
                      <div className="workshop-field">
                        <label>{isRTL ? 'الجنس' : 'Gender'} *</label>
                        <select value={form.gender} onChange={e => handleChange('gender', e.target.value)}>
                          <option value="">{isRTL ? 'اختر' : 'Select'}</option>
                          <option value="male">{isRTL ? 'ذكر' : 'Male'}</option>
                          <option value="female">{isRTL ? 'أنثى' : 'Female'}</option>
                        </select>
                      </div>
                      <div className="workshop-field">
                        <label>{isRTL ? 'العمر' : 'Age'} *</label>
                        <input type="number" value={form.age} onChange={e => handleChange('age', e.target.value)} />
                      </div>
                      <div className="workshop-field">
                        <label>{isRTL ? 'المدينة' : 'City'} *</label>
                        <input value={form.city} onChange={e => handleChange('city', e.target.value)} />
                      </div>
                    </div>
                    <div className="workshop-actions">
                      <button className="workshop-btn-back" onClick={() => setLookupMode(true)}>{isRTL ? 'رجوع' : 'Back'}</button>
                      <button className="workshop-btn-next" disabled={!canProceedStep0} onClick={() => setStep(1)}>{isRTL ? 'التالي' : 'Next'}</button>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="step1" className="workshop-step-content" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h3>{isRTL ? 'اختر الورشة التدريبية' : 'Select a Workshop'}</h3>
                {workshops.length === 0 ? (
                  <div className="workshop-empty">{isRTL ? 'لا توجد ورش متاحة حالياً' : 'No workshops available'}</div>
                ) : (
                  <div className="workshop-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem', maxHeight: 'none', overflow: 'visible' }}>
                    {workshops.map(w => (
                      <div key={w.workshopId} className={`workshop-card ${form.workshopId === w.workshopId ? 'selected' : ''} ${w.spotsRemaining <= 0 ? 'full' : ''}`}
                        style={{ cursor: w.spotsRemaining > 0 ? 'pointer' : 'not-allowed', borderRadius: 16 }}
                        onClick={() => w.spotsRemaining > 0 && handleChange('workshopId', w.workshopId)}>
                        {w.photo && <div className="workshop-card-img" style={{ height: 200, backgroundImage: `url(${w.photo})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
                        <div className="workshop-card-body" style={{ padding: '1.25rem' }}>
                          <h4 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>{w.title}</h4>
                          {w.presenter && <div className="workshop-card-presenter" style={{ marginBottom: '0.5rem' }}>{isRTL ? 'المقدم:' : 'Presenter:'} {w.presenter}</div>}
                          <div className="workshop-card-meta" style={{ marginBottom: '0.6rem', gap: '1rem' }}>
                            {w.startDate && <span>📅 {w.startDate}{w.endDate && w.endDate !== w.startDate ? ` → ${w.endDate}` : ''}</span>}
                            {w.startTime && <span>🕐 {w.startTime}{w.endTime ? ` - ${w.endTime}` : ''}</span>}
                            {w.totalHours && (() => {
                              let days = 1;
                              if (w.startDate && w.endDate && w.endDate !== w.startDate) {
                                days = Math.max(1, Math.ceil((new Date(w.endDate) - new Date(w.startDate)) / (1000*60*60*24)) + 1);
                              }
                              const perDay = days > 1 ? (w.totalHours / days).toFixed(1) : null;
                              return (
                                <span>⏱ {w.totalHours} {isRTL ? 'ساعة إجمالية' : 'total hours'}
                                  {perDay && <span style={{ color: '#3b82f6', fontWeight: 600 }}> ({perDay} {isRTL ? `ساعة/يوم × ${days} أيام` : `hrs/day × ${days} days`})</span>}
                                </span>
                              );
                            })()}
                          </div>
                          {w.content && <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, marginBottom: '0.5rem' }}>{w.content}</p>}
                          {w.objectives && <p style={{ fontSize: '0.82rem', color: '#3b82f6', lineHeight: 1.5, marginBottom: '0.5rem', fontWeight: 500 }}>{isRTL ? 'الأهداف: ' : 'Objectives: '}{w.objectives}</p>}
                          {(w.minAge || w.maxAge) && <p style={{ fontSize: '0.82rem', color: '#92400e', fontWeight: 600, marginBottom: '0.75rem' }}>👤 {isRTL ? 'الأعمار:' : 'Ages:'} {w.minAge || '?'} - {w.maxAge || '?'} {isRTL ? 'سنة' : 'years'}</p>}
                          <div className="workshop-card-footer" style={{ paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            {w.price ? <span className="workshop-price" style={{ fontSize: '1.2rem' }}>{w.price} {isRTL ? 'ر.س' : 'SAR'}</span> : <span className="workshop-price free" style={{ fontSize: '1.2rem' }}>{isRTL ? 'مجاني' : 'Free'}</span>}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <span className={`workshop-spots ${w.spotsRemaining <= 3 ? 'low' : ''}`}>
                                {w.spotsRemaining > 0 ? `${w.spotsRemaining} ${isRTL ? 'مقعد متبقي' : 'spots left'}` : (isRTL ? 'مكتمل' : 'Full')}
                              </span>
                              {w.spotsRemaining > 0 && form.workshopId === w.workshopId && (
                                <span style={{ background: '#1a56db', color: 'white', padding: '4px 12px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700 }}>
                                  {isRTL ? '✓ محدد' : '✓ Selected'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {form.workshopId === w.workshopId && <div className="workshop-card-check">✓</div>}
                      </div>
                    ))}
                  </div>
                )}
                <div className="workshop-actions">
                  <button className="workshop-btn-back" onClick={() => setStep(0)}>{isRTL ? 'السابق' : 'Back'}</button>
                  <button className="workshop-btn-next" disabled={!canProceedStep1} onClick={handleStep1Next}>{isRTL ? 'التالي' : 'Next'}</button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" className="workshop-step-content" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                {selectedWorkshop && (
                  <div className="workshop-summary" style={{ marginBottom: 22 }}>
                    <strong style={{ fontSize: '1.05rem' }}>{selectedWorkshop.title}</strong>
                    <span>{selectedWorkshop.startDate}{selectedWorkshop.totalHours ? ` • ${selectedWorkshop.totalHours}h` : ''}</span>
                    <span style={{ fontWeight: 800, color: workshopIsPaid ? '#EE2329' : '#16a34a' }}>
                      {workshopIsPaid ? `${selectedWorkshop.price} ${isRTL ? 'ر.س' : 'SAR'}` : (isRTL ? 'مجاناً' : 'Free')}
                    </span>
                  </div>
                )}

                {!workshopIsPaid && (
                  <div style={{ padding: 24, background: '#ecfdf5', border: '1px solid #86efac', borderRadius: 12, textAlign: 'center', color: '#065f46', marginBottom: 20 }}>
                    <div style={{ fontSize: 44, marginBottom: 8 }}>🎉</div>
                    <h3 style={{ margin: 0, color: '#065f46' }}>{isRTL ? 'هذه الورشة مجانية' : 'This workshop is free'}</h3>
                    <p style={{ margin: '8px 0 0', fontSize: 14 }}>
                      {isRTL ? 'اضغط "تأكيد التسجيل" لإتمام العملية' : 'Click "Confirm Registration" to finish'}
                    </p>
                  </div>
                )}

                {workshopIsPaid && (
                  <>
                    <h3 style={{ marginTop: 0 }}>{isRTL ? 'اختر طريقة الدفع' : 'Choose Payment Method'}</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 22 }}>
                      {[
                        { key: 'bank_transfer', icon: '🏦', ar: 'تحويل بنكي', en: 'Bank Transfer', hint_ar: 'ارفع صورة الإشعار للمراجعة', hint_en: 'Upload transfer proof for review' },
                        { key: 'mada',          icon: '💳', ar: 'مدى في مقر فاب لاب', en: 'Mada at FabLab', hint_ar: 'ادفع نقداً بمدى داخل المقر', hint_en: 'Pay in-person at the FabLab store' }
                      ].map(pm => {
                        const active = form.paymentMethod === pm.key;
                        return (
                          <button
                            key={pm.key}
                            type="button"
                            onClick={() => handleChange('paymentMethod', pm.key)}
                            style={{
                              padding: 16, borderRadius: 12, cursor: 'pointer', textAlign: 'start',
                              border: active ? '2px solid #EE2329' : '1px solid #cbd5e1',
                              background: active ? 'linear-gradient(135deg, #fef2f2, #ffffff)' : '#fff',
                              boxShadow: active ? '0 8px 24px -12px rgba(238,35,41,0.35)' : 'none',
                              fontFamily: 'inherit'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 24 }}>{pm.icon}</span>
                              <div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{isRTL ? pm.ar : pm.en}</div>
                                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{isRTL ? pm.hint_ar : pm.hint_en}</div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {form.paymentMethod === 'bank_transfer' && (
                      <>
                        <div style={{ background: 'linear-gradient(135deg, #f8fafc, #ffffff)', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, marginBottom: 20 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.4, color: '#EE2329', textTransform: 'uppercase' }}>
                              {isRTL ? 'تفاصيل التحويل البنكي' : 'Bank Transfer Details'}
                            </div>
                            {payment.bank && (
                              <button
                                type="button"
                                onClick={() => copyToClipboard(
                                  `${payment.bank.bankName || ''}\n${payment.bank.accountHolder || ''}\nIBAN: ${payment.bank.iban || ''}`,
                                  'all'
                                )}
                                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                              >
                                {copiedField === 'all' ? (isRTL ? '✓ نُسخ الكل' : '✓ Copied all') : (isRTL ? '📋 نسخ الكل' : '📋 Copy all')}
                              </button>
                            )}
                          </div>
                          {payment.bank ? (
                            <>
                              {[
                                { key: 'bank',   label_ar: 'البنك',            label_en: 'Bank',            value: payment.bank.bankName, ltr: false },
                                { key: 'holder', label_ar: 'اسم صاحب الحساب',  label_en: 'Account Holder',  value: payment.bank.accountHolder, ltr: false },
                                { key: 'iban',   label_ar: 'رقم الآيبان (IBAN)', label_en: 'IBAN',           value: payment.bank.iban, ltr: true, big: true }
                              ].map(row => (
                                <div key={row.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px dotted #e2e8f0' }}>
                                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, minWidth: 140 }}>{isRTL ? row.label_ar : row.label_en}</div>
                                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                                    <span
                                      dir={row.ltr ? 'ltr' : undefined}
                                      style={{
                                        fontFamily: row.ltr ? "'JetBrains Mono', monospace" : 'inherit',
                                        fontWeight: row.big ? 800 : 700,
                                        fontSize: row.big ? '1.05rem' : '0.95rem',
                                        color: '#0f172a',
                                        userSelect: 'all',
                                        wordBreak: 'break-all',
                                        textAlign: row.ltr ? 'end' : 'inherit'
                                      }}
                                    >
                                      {row.value || '—'}
                                    </span>
                                    {row.value && (
                                      <button
                                        type="button"
                                        onClick={() => copyToClipboard(row.value, row.key)}
                                        title={isRTL ? 'نسخ' : 'Copy'}
                                        style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#334155', minWidth: 60 }}
                                      >
                                        {copiedField === row.key ? '✓' : '📋'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {payment.bank.additionalInfo && (
                                <div style={{ marginTop: 12, padding: 10, background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12.5, color: '#78350f', lineHeight: 1.7 }}>
                                  💡 {payment.bank.additionalInfo}
                                </div>
                              )}
                            </>
                          ) : (
                            <div style={{ padding: 14, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                              {isRTL ? 'جاري تحميل تفاصيل الحساب...' : 'Loading account details...'}
                            </div>
                          )}
                        </div>

                        <div style={{ marginBottom: 12 }}>
                          <label style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, color: '#EE2329', textTransform: 'uppercase' }}>
                            {isRTL ? '📤 ارفع صورة إشعار التحويل *' : '📤 Upload transfer proof *'}
                          </label>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                            onChange={(e) => handleProofUpload(e.target.files)}
                            style={{ marginTop: 8, display: 'block', fontFamily: 'inherit', width: '100%' }}
                          />
                          {proofFile && (
                            <div style={{ marginTop: 8, padding: '10px 14px', background: '#ecfdf5', border: '1px solid #86efac', borderRadius: 8, fontSize: 13, color: '#065f46', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>✓ {isRTL ? 'تم رفع' : 'Uploaded'}: <b>{proofFile.fileName}</b> ({(proofFile.fileSize / 1024).toFixed(0)} KB)</span>
                              <button type="button" onClick={() => setProofFile(null)} style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>✕</button>
                            </div>
                          )}
                          <p style={{ marginTop: 6, fontSize: 11.5, color: '#64748b' }}>
                            {isRTL
                              ? 'صيغ مقبولة: PNG, JPG, WebP, PDF · الحد الأقصى 10 ميجابايت'
                              : 'Accepted: PNG, JPG, WebP, PDF · max 10 MB'}
                          </p>
                        </div>
                      </>
                    )}

                    {form.paymentMethod === 'mada' && payment.mada && (
                      <div style={{ padding: 20, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, marginBottom: 20, color: '#1e3a8a' }}>
                        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>💳 {payment.mada.title || (isRTL ? 'الدفع بمدى' : 'Mada Payment')}</div>
                        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.75 }}>{payment.mada.instructions}</p>
                        {payment.mada.address && (
                          <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#1d4ed8' }}>
                            📍 {payment.mada.address}
                          </p>
                        )}
                        <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#334155' }}>
                          {isRTL
                            ? 'سيتم تفعيل تسجيلك بعد الدفع في المقر.'
                            : 'Your registration will be activated after in-store payment.'}
                        </p>
                      </div>
                    )}
                  </>
                )}

                <div className="workshop-actions">
                  <button className="workshop-btn-back" onClick={() => setStep(1)}>{isRTL ? 'السابق' : 'Back'}</button>
                  <button className="workshop-btn-submit" disabled={!canProceedStep2 || submitting} onClick={handleSubmit}>
                    {submitting ? (isRTL ? 'جاري التسجيل...' : 'Submitting...') : (isRTL ? '✓ تأكيد التسجيل' : '✓ Confirm Registration')}
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && result && (
              <motion.div
                key="step3"
                className="workshop-step-content workshop-success"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 220, damping: 20 }}
              >
                <motion.div
                  className="workshop-success-icon"
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.15 }}
                  style={{ background: 'linear-gradient(135deg, #16a34a, #065f46)', boxShadow: '0 0 60px rgba(22,163,74,0.55)' }}
                >✓</motion.div>
                <motion.h3
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  style={{ color: '#16a34a', margin: '20px 0 6px' }}
                >
                  {result.paymentMethod === 'free'
                    ? (isRTL ? 'تم التسجيل بنجاح!' : 'Registration Successful!')
                    : (isRTL ? 'تم استلام طلبك — بانتظار مراجعة الدفع' : 'Received — Awaiting Payment Review')}
                </motion.h3>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.42 }}
                  style={{
                    display: 'inline-block',
                    padding: '10px 24px',
                    borderRadius: 999,
                    background: '#fef2f2',
                    border: '2px dashed #EE2329',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '1.15rem',
                    fontWeight: 800,
                    color: '#EE2329',
                    letterSpacing: 2,
                    margin: '10px 0 18px'
                  }}
                >
                  {result.invoiceNumber}
                </motion.div>

                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.55 }}
                  style={{ fontSize: 14, color: '#475569', lineHeight: 1.75, maxWidth: 520, margin: '0 auto' }}
                >
                  {result.paymentMethod === 'free' && (isRTL
                    ? 'تسجيلك مفعّل وسيصلك بريد التأكيد مع بطاقة الحضور.'
                    : 'Your seat is confirmed. Check your inbox for the workshop email + attendance ID.')}
                  {result.paymentMethod === 'bank_transfer' && (isRTL
                    ? 'استلمنا صورة إشعار التحويل. سيقوم فريق الإدارة بالتحقق منها وسيصلك بريد التأكيد النهائي مع الفاتورة قريباً.'
                    : 'We received your transfer proof. Our team will verify and email you the final confirmation + invoice shortly.')}
                  {result.paymentMethod === 'mada' && (isRTL
                    ? 'يرجى الحضور إلى مقر فاب لاب الأحساء لإتمام الدفع بمدى. سيقوم فريقنا بتفعيل تسجيلك فور الدفع.'
                    : 'Please visit the FabLab Al-Ahsa store to complete payment by mada. Our team will activate your seat immediately after payment.')}
                </motion.p>

                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="workshop-summary"
                  style={{ margin: '22px auto 0', maxWidth: 480 }}
                >
                  <strong>{result.workshop?.title || selectedWorkshop?.title}</strong>
                  {result.paymentAmount > 0 && (
                    <span>{isRTL ? 'قيمة الورشة:' : 'Amount:'} <b style={{ color: '#EE2329' }}>{Number(result.paymentAmount).toFixed(2)} {isRTL ? 'ر.س' : 'SAR'}</b></span>
                  )}
                  <span>{isRTL ? 'الحالة:' : 'Status:'} {
                    result.paymentStatus === 'verified'
                      ? (isRTL ? '✓ مؤكد' : '✓ Confirmed')
                      : (isRTL ? '⏳ بانتظار المراجعة' : '⏳ Pending review')
                  }</span>
                </motion.div>

                <div style={{ marginTop: 24 }}>
                  <button className="workshop-btn-next" onClick={() => navigate('/')}>{isRTL ? 'العودة للرئيسية' : 'Back to Home'}</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
          <div className="workshop-reg-footer">
            <button className="workshop-lang-btn" onClick={toggleLanguage}>
              {i18n.language === 'ar' ? 'English' : 'العربية'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default WorkshopRegistration;
