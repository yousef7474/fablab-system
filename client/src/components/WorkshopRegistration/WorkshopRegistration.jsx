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
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const [lookupMode, setLookupMode] = useState(true);
  const [lookupValue, setLookupValue] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);

  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', email: '',
    nationalId: '', gender: '', age: '', city: '',
    workshopId: '', invoiceNumber: ''
  });

  useEffect(() => {
    api.get('/workshops/active').then(res => setWorkshops(res.data || [])).catch(() => {});
  }, []);

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const canProceedStep0 = form.firstName && form.phone;
  const canProceedStep1 = form.workshopId;
  const canProceedStep2 = form.invoiceNumber;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await api.post('/workshops/register', form);
      setResult(res.data);
      setStep(3);
      toast.success(isRTL ? 'تم التسجيل بنجاح!' : 'Registration successful!');
    } catch (error) {
      const msg = error.response?.data?.message || (isRTL ? 'خطأ في التسجيل' : 'Registration error');
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
              isRTL ? 'رقم الفاتورة' : 'Invoice Number',
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
                        <label>{isRTL ? 'الاسم الأخير' : 'Last Name'}</label>
                        <input value={form.lastName} onChange={e => handleChange('lastName', e.target.value)} />
                      </div>
                      <div className="workshop-field">
                        <label>{isRTL ? 'رقم الهاتف' : 'Phone'} *</label>
                        <input type="tel" dir="ltr" value={form.phone} onChange={e => handleChange('phone', e.target.value)} />
                      </div>
                      <div className="workshop-field">
                        <label>{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
                        <input type="email" dir="ltr" value={form.email} onChange={e => handleChange('email', e.target.value)} />
                      </div>
                      <div className="workshop-field">
                        <label>{isRTL ? 'رقم الهوية' : 'National ID'}</label>
                        <input dir="ltr" value={form.nationalId} onChange={e => handleChange('nationalId', e.target.value)} />
                      </div>
                      <div className="workshop-field">
                        <label>{isRTL ? 'الجنس' : 'Gender'}</label>
                        <select value={form.gender} onChange={e => handleChange('gender', e.target.value)}>
                          <option value="">{isRTL ? 'اختر' : 'Select'}</option>
                          <option value="male">{isRTL ? 'ذكر' : 'Male'}</option>
                          <option value="female">{isRTL ? 'أنثى' : 'Female'}</option>
                        </select>
                      </div>
                      <div className="workshop-field">
                        <label>{isRTL ? 'العمر' : 'Age'}</label>
                        <input type="number" value={form.age} onChange={e => handleChange('age', e.target.value)} />
                      </div>
                      <div className="workshop-field">
                        <label>{isRTL ? 'المدينة' : 'City'}</label>
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
                            {w.totalHours && <span>⏱ {w.totalHours} {isRTL ? 'ساعة' : 'hours'}</span>}
                          </div>
                          {w.content && <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, marginBottom: '0.5rem' }}>{w.content}</p>}
                          {w.objectives && <p style={{ fontSize: '0.82rem', color: '#3b82f6', lineHeight: 1.5, marginBottom: '0.75rem', fontWeight: 500 }}>{isRTL ? 'الأهداف: ' : 'Objectives: '}{w.objectives}</p>}
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
                  <button className="workshop-btn-next" disabled={!canProceedStep1} onClick={() => setStep(2)}>{isRTL ? 'التالي' : 'Next'}</button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" className="workshop-step-content" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h3>{isRTL ? 'رقم الفاتورة' : 'Invoice Number'}</h3>
                <p className="workshop-invoice-note">{isRTL ? 'أدخل رقم الفاتورة من منصة سلة كإثبات للشراء' : 'Enter your invoice number from Salla platform as proof of purchase'}</p>

                {selectedWorkshop && (
                  <div className="workshop-summary">
                    <strong>{selectedWorkshop.title}</strong>
                    <span>{selectedWorkshop.startDate}{selectedWorkshop.totalHours ? ` • ${selectedWorkshop.totalHours}h` : ''}</span>
                    {selectedWorkshop.price && <span>{selectedWorkshop.price} {isRTL ? 'ر.س' : 'SAR'}</span>}
                  </div>
                )}

                <div className="workshop-field invoice-field">
                  <label>{isRTL ? 'رقم الفاتورة من منصة سلة' : 'Invoice Number from Salla'} *</label>
                  <input
                    dir="ltr"
                    value={form.invoiceNumber}
                    onChange={e => handleChange('invoiceNumber', e.target.value)}
                    placeholder={isRTL ? 'مثال: #12345' : 'e.g. #12345'}
                    style={{ fontSize: '1.1rem', textAlign: 'center', letterSpacing: 2 }}
                  />
                </div>

                <div className="workshop-actions">
                  <button className="workshop-btn-back" onClick={() => setStep(1)}>{isRTL ? 'السابق' : 'Back'}</button>
                  <button className="workshop-btn-submit" disabled={!canProceedStep2 || submitting} onClick={handleSubmit}>
                    {submitting ? (isRTL ? 'جاري التسجيل...' : 'Submitting...') : (isRTL ? 'تأكيد التسجيل' : 'Confirm Registration')}
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && result && (
              <motion.div key="step3" className="workshop-step-content workshop-success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                <div className="workshop-success-icon">✓</div>
                <h3>{isRTL ? 'تم التسجيل بنجاح!' : 'Registration Successful!'}</h3>
                <p>{isRTL ? 'تم تسجيلك في الورشة التدريبية بنجاح. سيتم مراجعة الفاتورة والتواصل معك.' : 'You have been registered for the workshop. Your invoice will be reviewed and you will be contacted.'}</p>
                <div className="workshop-summary" style={{ margin: '1.5rem 0' }}>
                  <strong>{result.workshop?.title || selectedWorkshop?.title}</strong>
                  <span>{isRTL ? 'رقم الفاتورة:' : 'Invoice:'} {form.invoiceNumber}</span>
                  <span>{isRTL ? 'الحالة:' : 'Status:'} {isRTL ? 'قيد المراجعة' : 'Pending Review'}</span>
                </div>
                <button className="workshop-btn-next" onClick={() => navigate('/')}>{isRTL ? 'العودة للرئيسية' : 'Back to Home'}</button>
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
