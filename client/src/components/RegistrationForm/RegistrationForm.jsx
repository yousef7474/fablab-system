import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';
import UserLookup from './steps/UserLookup';
import ApplicationType from './steps/ApplicationType';
import ApplicationData from './steps/ApplicationData';
import FablabSection from './steps/FablabSection';
import RequiredService from './steps/RequiredService';
import DateTimeSelection from './steps/DateTimeSelection';
import ServiceDetails from './steps/ServiceDetails';
import Commitment from './steps/Commitment';
import SuccessPage from './SuccessPage';
import FabyBot from './FabyBot';
import './RegistrationForm.css';

const STORAGE_KEY = 'fablab_registration_form';
const THEME_KEY = 'fablab_registration_theme';

const getInitialFormData = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved).formData || null;
  } catch (e) { console.error(e); }
  return null;
};

const getInitialStep = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return typeof parsed.activeStep === 'number' ? parsed.activeStep : -1;
    }
  } catch (e) { console.error(e); }
  return -1;
};

const defaultFormData = {
  existingUserId: null,
  applicationType: '',
  firstName: '', lastName: '', sex: '', nationality: '', nationalId: '',
  phoneNumber: '', email: '', currentJob: '', nationalAddress: '',
  entityName: '', visitingEntity: '', personInCharge: '', name: '',
  profilePicture: '',
  fablabSection: '',
  requiredServices: [], otherServiceDetails: '',
  appointmentDate: '', appointmentTime: '', appointmentDuration: 60,
  startDate: '', endDate: '', startTime: '', endTime: '',
  visitDate: '', visitStartTime: '', visitEndTime: '',
  volunteerSection: '', volunteerSkills: '',
  serviceDetails: '', serviceType: '', commitmentName: ''
};

const RegistrationForm = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { return 'light'; }
  });

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      return next;
    });
  }, []);

  const getStepFromUrl = () => {
    const stepParam = searchParams.get('step');
    if (stepParam !== null) {
      const step = parseInt(stepParam, 10);
      if (!isNaN(step) && step >= -1 && step <= 8) return step;
    }
    return null;
  };

  const [activeStep, setActiveStep] = useState(() => {
    const urlStep = getStepFromUrl();
    return urlStep !== null ? urlStep : getInitialStep();
  });
  const [formData, setFormData] = useState(() => getInitialFormData() || defaultFormData);
  const [registrationResult, setRegistrationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [registrationDisabled, setRegistrationDisabled] = useState(false);
  const [disabledReason, setDisabledReason] = useState('');

  useEffect(() => {
    api.get('/settings/registration-status')
      .then(r => { setRegistrationDisabled(r.data.disabled); setDisabledReason(r.data.reason || ''); })
      .catch(e => console.error(e));
  }, []);

  useEffect(() => {
    if (!registrationResult) {
      const currentStep = searchParams.get('step');
      const stepStr = activeStep.toString();
      if (currentStep !== stepStr) {
        if (activeStep === -1) searchParams.delete('step');
        else searchParams.set('step', stepStr);
        setSearchParams(searchParams, { replace: false });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, registrationResult]);

  useEffect(() => {
    const stepParam = searchParams.get('step');
    if (stepParam !== null) {
      const step = parseInt(stepParam, 10);
      if (!isNaN(step) && step >= -1 && step <= 8 && step !== activeStep) {
        setActiveStep(step);
      }
    } else if (activeStep !== -1 && !registrationResult) {
      setActiveStep(-1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!registrationResult) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ formData, activeStep, savedAt: new Date().toISOString() }));
      } catch (e) { console.error(e); }
    }
  }, [formData, activeStep, registrationResult]);

  const clearSavedForm = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { console.error(e); }
  };

  const steps = [
    { key: 'section1', label: t('section1') },
    { key: 'section2', label: t('section2') },
    { key: 'section3', label: t('section3') },
    { key: 'section4', label: t('section4') },
    { key: 'section5', label: t('section5') },
    { key: 'section6', label: t('section6') },
    { key: 'section7', label: t('section7') }
  ];

  const handleNext = () => setActiveStep(s => s + 1);
  const handleBack = () => setActiveStep(s => s - 1);
  const handleFormDataChange = (data) => setFormData({ ...formData, ...data });

  const handleUserFound = (userData) => {
    setFormData({
      ...formData,
      existingUserId: userData.userId,
      applicationType: userData.applicationType || '',
      firstName: userData.firstName || '', lastName: userData.lastName || '',
      name: userData.name || '', sex: userData.sex || '',
      nationality: userData.nationality || '', nationalId: userData.nationalId || '',
      phoneNumber: userData.phoneNumber || '', email: userData.email || '',
      currentJob: userData.currentJob || '', nationalAddress: userData.nationalAddress || '',
      entityName: userData.entityName || '', visitingEntity: userData.visitingEntity || '',
      personInCharge: userData.personInCharge || '', profilePicture: userData.profilePicture || ''
    });
    setActiveStep(0);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await api.post('/registration/create', formData);
      setRegistrationResult(response.data.registration);
      clearSavedForm();
      searchParams.delete('step');
      setSearchParams(searchParams, { replace: true });
      toast.success(t('registrationSuccess'));
    } catch (error) {
      const errorData = error.response?.data;
      let msg = errorData
        ? (isRTL ? (errorData.messageAr || errorData.message || errorData.error) : (errorData.message || errorData.error))
        : null;
      if (!msg && error.response?.status) {
        const statusMessages = {
          400: isRTL ? 'بيانات غير مكتملة أو غير صحيحة' : 'Incomplete or invalid data',
          404: isRTL ? 'الخدمة غير متوفرة' : 'Service not found',
          409: isRTL ? 'يوجد تعارض - الموعد قد يكون محجوز' : 'Conflict - time slot may be taken',
          413: isRTL ? 'حجم الملف كبير جداً' : 'File too large',
          500: isRTL ? 'خطأ في الخادم - يرجى المحاولة لاحقاً' : 'Server error - please try again later'
        };
        msg = statusMessages[error.response.status];
      }
      toast.error(msg || (isRTL ? 'حدث خطأ - يرجى المحاولة مرة أخرى' : 'An error occurred - please try again'));
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = (step) => {
    const stepProps = { formData, onChange: handleFormDataChange, onNext: handleNext, onBack: handleBack };
    switch (step) {
      case 0: return <ApplicationType {...stepProps} />;
      case 1: return <ApplicationData {...stepProps} />;
      case 2: return <FablabSection {...stepProps} />;
      case 3: return <RequiredService {...stepProps} />;
      case 4: return <DateTimeSelection {...stepProps} />;
      case 5: return <ServiceDetails {...stepProps} />;
      case 6: return <Commitment {...stepProps} onSubmit={handleSubmit} loading={loading} />;
      default: return null;
    }
  };

  const progressPct = activeStep >= 0
    ? Math.min(100, Math.round(((activeStep + 1) / steps.length) * 100))
    : 0;

  // ---------- Registration disabled state ----------
  if (registrationDisabled) {
    return (
      <div className="rp" data-theme={theme} dir={isRTL ? 'rtl' : 'ltr'}>
        <RegistrationTopBar
          isRTL={isRTL} theme={theme} onToggleTheme={toggleTheme}
          activeStep={-1} totalSteps={steps.length} progressPct={0}
        />
        <main className="rp-main">
          <motion.div
            className="rp-card rp-card--empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="rp-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
            <h2 className="rp-empty-title">{isRTL ? 'التسجيل غير متاح حالياً' : 'Registration Unavailable'}</h2>
            {disabledReason && <p className="rp-empty-reason">{disabledReason}</p>}
            <p className="rp-empty-body">
              {isRTL
                ? 'يرجى المحاولة لاحقاً أو التواصل مع إدارة فاب لاب.'
                : 'Please try again later or contact FABLAB administration.'}
            </p>
            <div className="rp-empty-actions">
              <button className="rp-btn rp-btn--primary" onClick={() => navigate('/borrow')}>
                {isRTL ? 'استعارة مكونات' : 'Borrow Components'}
              </button>
              <button className="rp-btn rp-btn--ghost" onClick={() => window.location.reload()}>
                {isRTL ? 'إعادة المحاولة' : 'Try Again'}
              </button>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  // ---------- Success state ----------
  if (registrationResult) {
    return (
      <div className="rp" data-theme={theme} dir={isRTL ? 'rtl' : 'ltr'}>
        <RegistrationTopBar
          isRTL={isRTL} theme={theme} onToggleTheme={toggleTheme}
          activeStep={activeStep} totalSteps={steps.length} progressPct={100}
        />
        <main className="rp-main">
          <div className="rp-card">
            <SuccessPage registration={registrationResult} />
          </div>
        </main>
      </div>
    );
  }

  // ---------- Normal flow ----------
  return (
    <div className="rp" data-theme={theme} dir={isRTL ? 'rtl' : 'ltr'}>
      <RegistrationTopBar
        isRTL={isRTL} theme={theme} onToggleTheme={toggleTheme}
        activeStep={activeStep} totalSteps={steps.length} progressPct={progressPct}
      />

      <main className="rp-main">
        {activeStep === -1 && (
          <motion.header
            className="rp-hero"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.2, 0.9, 0.2, 1] }}
          >
            <span className="rp-hero-eyebrow">
              {isRTL ? 'مختبر التصنيع الرقمي' : 'DIGITAL FABRICATION LAB'}
            </span>
            <h1 className="rp-hero-title">
              {isRTL ? (<>فاب لاب <span className="rp-hero-accent">الأحساء</span></>) : (<>FabLab <span className="rp-hero-accent">Al-Ahsa</span></>)}
            </h1>
            <p className="rp-hero-subtitle">
              {isRTL ? 'نظام التسجيل وحجز المواعيد' : 'Registration & Appointment System'}
            </p>
          </motion.header>
        )}

        <motion.div
          className="rp-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: activeStep === -1 ? 0.12 : 0, ease: [0.2, 0.9, 0.2, 1] }}
        >
          {activeStep === -1 ? (
            <UserLookup onUserFound={handleUserFound} onNewUser={() => setActiveStep(0)} />
          ) : (
            <>
              <div className="rp-card-header">
                <button
                  className="rp-home-btn"
                  onClick={() => { setActiveStep(-1); setFormData(defaultFormData); clearSavedForm(); }}
                  title={isRTL ? 'العودة للرئيسية' : 'Back to Home'}
                  aria-label={isRTL ? 'العودة للرئيسية' : 'Back to Home'}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  <span>{isRTL ? 'الرئيسية' : 'Home'}</span>
                </button>
                <div className="rp-step-tag">
                  <span className="rp-step-num">{String(activeStep + 1).padStart(2, '0')}</span>
                  <span className="rp-step-sep">/</span>
                  <span className="rp-step-total">{String(steps.length).padStart(2, '0')}</span>
                  <span className="rp-step-name">{steps[activeStep]?.label}</span>
                </div>
              </div>

              <div className="rp-progress-track" aria-hidden="true">
                <div className="rp-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>

              <div className="rp-form-content">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStep}
                    initial={{ opacity: 0, x: isRTL ? -12 : 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: isRTL ? 12 : -12 }}
                    transition={{ duration: 0.22, ease: [0.2, 0.9, 0.2, 1] }}
                  >
                    {renderStepContent(activeStep)}
                  </motion.div>
                </AnimatePresence>
              </div>
            </>
          )}
        </motion.div>
      </main>

      <FabyBot currentStep={activeStep} formData={formData} />
    </div>
  );
};

// ---------- Slim, sticky top bar ----------
const RegistrationTopBar = ({ isRTL, theme, onToggleTheme, activeStep, totalSteps, progressPct }) => (
  <header className="rp-topbar">
    <div className="rp-topbar-inner">
      <a className="rp-topbar-brand" href="/" aria-label="FabLab Al-Ahsa">
        <img src="/logo.png" alt="" className="rp-topbar-logo" />
        <div className="rp-topbar-titles">
          <span className="rp-topbar-title">{isRTL ? 'فاب لاب الأحساء' : 'FabLab Al-Ahsa'}</span>
          <span className="rp-topbar-sub">{isRTL ? 'التسجيل' : 'Registration'}</span>
        </div>
      </a>

      <div className="rp-topbar-actions">
        {activeStep >= 0 && (
          <div className="rp-topbar-progress" aria-label={`${progressPct}%`}>
            <div className="rp-topbar-progress-track">
              <div className="rp-topbar-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="rp-topbar-progress-label">
              {String(activeStep + 1).padStart(2, '0')}/{String(totalSteps).padStart(2, '0')}
            </span>
          </div>
        )}

        <a
          href="https://main.fablabsahsa.com/"
          className="rp-topbar-link"
          title={isRTL ? 'الموقع الرئيسي' : 'Main site'}
          aria-label={isRTL ? 'الموقع الرئيسي' : 'Main site'}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </a>

        <button
          type="button"
          className="rp-topbar-toggle"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? (isRTL ? 'الوضع الفاتح' : 'Light mode') : (isRTL ? 'الوضع الداكن' : 'Dark mode')}
          title={theme === 'dark' ? (isRTL ? 'تفعيل الوضع الفاتح' : 'Switch to light mode') : (isRTL ? 'تفعيل الوضع الداكن' : 'Switch to dark mode')}
        >
          <svg className="rp-icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
          <svg className="rp-icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4"/>
            <line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/>
            <line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/>
            <line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
            <line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/>
          </svg>
        </button>
      </div>
    </div>
  </header>
);

export default RegistrationForm;
