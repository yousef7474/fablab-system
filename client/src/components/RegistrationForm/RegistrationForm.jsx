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
// The studio look (shell, rail, steps) — loaded last so it sits on top.
import './RegisterStudio.css';

const STORAGE_KEY = 'fablab_registration_form';

// Volunteering is no longer offered on this form — a saved draft or a
// returning volunteer starts with no type / without that service.
const dropVolunteer = (type) => (type === 'Volunteer' ? '' : type);
const CONSULTATIONS = ['In-person consultation', 'Online consultation'];
const cleanServices = (list) => {
  const out = (Array.isArray(list) ? list : []).filter(s => s !== 'Volunteering');
  // In-person and online consultation are one or the other — keep the first.
  const firstConsultation = out.find(s => CONSULTATIONS.includes(s));
  return out.filter(s => !CONSULTATIONS.includes(s) || s === firstConsultation);
};

const getInitialFormData = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.formData) return null;
      // The Entity (كيان) unlock is per visit — never restored.
      const { entityAccessToken, ...rest } = parsed.formData;
      return { ...rest, applicationType: dropVolunteer(rest.applicationType || ''), requiredServices: cleanServices(rest.requiredServices) };
    }
  } catch (e) {
    console.error('Error loading saved form data:', e);
  }
  return null;
};

const getInitialStep = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return typeof parsed.activeStep === 'number' ? parsed.activeStep : -1;
    }
  } catch (e) {
    console.error('Error loading saved step:', e);
  }
  return -1;
};

const defaultFormData = {
  existingUserId: null,
  applicationType: '',
  firstName: '',
  lastName: '',
  sex: '',
  nationality: '',
  nationalId: '',
  phoneNumber: '',
  email: '',
  currentJob: '',
  nationalAddress: '',
  entityName: '',
  visitingEntity: '',
  personInCharge: '',
  name: '',
  profilePicture: '',
  fablabSection: '',
  requiredServices: [],
  otherServiceDetails: '',
  appointmentDate: '',
  appointmentTime: '',
  appointmentDuration: 60,
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  visitDate: '',
  visitStartTime: '',
  visitEndTime: '',
  volunteerSection: '',
  volunteerSkills: '',
  serviceDetails: '',
  serviceType: '',
  commitmentName: ''
};

const THEME_KEY = 'fablab_registration_theme';

// One stroke icon (24-unit grid) per step, for the rail stepper.
const STEP_ICONS = [
  ['M9 11l3 3L22 4', 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'],
  ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
  ['M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z'],
  ['M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M16 2v4', 'M8 2v4', 'M3 10h18'],
  ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8'],
  ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z']
];
const RAIL_FEATURES = [
  { ar: 'استشارات تقنية مع مهندسي الأقسام', en: 'Technical consultations with section engineers', d: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', 'M8 9h8', 'M8 13h5'] },
  { ar: 'حجز الأجهزة والمعدات لتنفيذ مشروعك', en: 'Book machines and tools for your project', d: ['M2 6h20v12H2z', 'M6 10v4', 'M10 10v4', 'M14 10v4', 'M18 10v4'] },
  { ar: 'ورش وبرامج ومساحات عمل للمبتكرين', en: 'Workshops, programs and workspaces', d: ['M22 10L12 5 2 10l10 5 10-5z', 'M6 12v5c3 2 9 2 12 0v-5'] }
];

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d.map(p => <path key={p} d={p} />)}
  </svg>
);
const CHECK = ['M20 6 9 17l-5-5'];

// The page frame: the navy rail (brand, then the stepper while
// registering) beside the main column (tools + the card). Below 1100px
// the rail folds into a compact header with a segmented progress bar.
const StudioShell = ({ isRTL, theme, onToggleTheme, onHome, steps, activeStep, onJump, extra, children }) => {
  const { i18n } = useTranslation();
  const inSteps = steps && activeStep >= 0;
  const total = steps ? steps.length : 0;
  const n = Math.min(Math.max(activeStep, 0) + 1, total);
  const pct = total ? Math.round((n / total) * 100) : 0;
  const toggleLanguage = () => {
    const next = isRTL ? 'en' : 'ar';
    i18n.changeLanguage(next);
    document.dir = next === 'ar' ? 'rtl' : 'ltr';
  };

  return (
    <div className="rgx" data-theme={theme} dir={isRTL ? 'rtl' : 'ltr'}>
      <aside className="rgx-rail">
        <motion.div
          className="rgx-rail-in"
          initial={{ opacity: 0, x: isRTL ? 24 : -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="rgx-brand">
            <span className="rgx-logo"><img src="/fablab.png" alt="" /></span>
            <span className="rgx-brand-text">
              <strong>{isRTL ? 'فاب لاب الأحساء' : 'FabLab Al-Ahsa'}</strong>
              <small>{isRTL ? 'مركز تنمية الإبداع والابتكار' : 'Creativity & Innovation Center'}</small>
            </span>
          </div>

          {inSteps ? (
            <div className="rgx-rail-steps">
              <p className="rgx-rail-kicker">
                {isRTL ? `الخطوة ${n} من ${total}` : `Step ${n} of ${total}`}
                <span>{pct}%</span>
              </p>
              <div className="rgx-rail-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
              <ol className="rgx-steps">
                {steps.map((s, i) => {
                  const state = i < activeStep ? 'done' : i === activeStep ? 'now' : 'next';
                  return (
                    <li key={s.key} className={`rgx-step is-${state}`}>
                      <button
                        type="button"
                        disabled={state !== 'done'}
                        onClick={() => onJump(i)}
                        aria-current={state === 'now' ? 'step' : undefined}
                        title={state === 'done' ? (isRTL ? 'الرجوع لهذه الخطوة' : 'Go back to this step') : undefined}
                      >
                        <span className="rgx-step-tile"><Icon d={state === 'done' ? CHECK : STEP_ICONS[i]} /></span>
                        <span className="rgx-step-text">
                          <small>{isRTL ? `الخطوة ${i + 1}` : `Step ${i + 1}`}</small>
                          <b>{s.label}</b>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : (
            <div className="rgx-rail-intro">
              <span className="rgx-portal"><i aria-hidden="true" />{isRTL ? 'التسجيل وحجز المواعيد' : 'Registration & appointments'}</span>
              <h2>{isRTL ? <>من الفكرة<br /><em>إلى النموذج الأول</em></> : <>From the idea<br /><em>to the first prototype</em></>}</h2>
              <ul className="rgx-feats">
                {RAIL_FEATURES.map((f, i) => (
                  <motion.li
                    key={f.en}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 + i * 0.09, duration: 0.45 }}
                  >
                    <span className={`rgx-ftile t${i}`}><Icon d={f.d} /></span>
                    <span>{isRTL ? f.ar : f.en}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          )}

          <p className="rgx-rail-foot">{isRTL ? 'فاب لاب الأحساء — مؤسسة عبدالمنعم الراشد الإنسانية' : 'FabLab Al-Ahsa — Abdulmonem Al-Rashed Humanitarian Foundation'}</p>
        </motion.div>
      </aside>

      <main className="rgx-main">
        <header className="rgx-top">
          <a className="rgx-top-brand" href="/" aria-label={isRTL ? 'فاب لاب الأحساء' : 'FabLab Al-Ahsa'}>
            <span className="rgx-logo sm"><img src="/fablab.png" alt="" /></span>
            <span className="rgx-brand-text">
              <strong>{isRTL ? 'فاب لاب الأحساء' : 'FabLab Al-Ahsa'}</strong>
              <small>{isRTL ? 'التسجيل وحجز المواعيد' : 'Registration & appointments'}</small>
            </span>
          </a>
          <div className="rgx-tools">
            {inSteps && onHome && (
              <button type="button" className="rgx-tool" onClick={onHome} title={isRTL ? 'البدء من جديد' : 'Start over'}>
                <Icon d={['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5']} />
                <span>{isRTL ? 'من جديد' : 'Start over'}</span>
              </button>
            )}
            <a className="rgx-tool" href="/" title={isRTL ? 'الموقع الرئيسي' : 'Main website'}>
              <Icon d={['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10']} />
              <span>{isRTL ? 'الموقع' : 'Website'}</span>
            </a>
            <button type="button" className="rgx-tool" onClick={toggleLanguage} title={isRTL ? 'English' : 'العربية'}>
              <Icon d={['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M2 12h20', 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z']} />
              <span>{isRTL ? 'English' : 'العربية'}</span>
            </button>
            <button
              type="button"
              className="rgx-tool icon"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? (isRTL ? 'الوضع الفاتح' : 'Light mode') : (isRTL ? 'الوضع الداكن' : 'Dark mode')}
              title={theme === 'dark' ? (isRTL ? 'الوضع الفاتح' : 'Light mode') : (isRTL ? 'الوضع الداكن' : 'Dark mode')}
            >
              {theme === 'dark'
                ? <Icon d={['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M12 2v2', 'M12 20v2', 'M4.93 4.93l1.41 1.41', 'M17.66 17.66l1.41 1.41', 'M2 12h2', 'M20 12h2', 'M4.93 19.07l1.41-1.41', 'M17.66 6.34l1.41-1.41']} />
                : <Icon d={['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z']} />}
            </button>
          </div>
        </header>

        {inSteps && (
          <div className="rgx-mprog">
            <div className="rgx-mprog-row">
              <b>{steps[Math.max(activeStep, 0)]?.label}</b>
              <span>{isRTL ? `الخطوة ${n} من ${total}` : `Step ${n} of ${total}`}</span>
            </div>
            <div className="rgx-mprog-bar" aria-hidden="true">
              {steps.map((s, i) => <i key={s.key} className={i < activeStep ? 'done' : i === activeStep ? 'now' : ''} />)}
            </div>
          </div>
        )}

        <div className="rgx-stage">{children}</div>
      </main>
      {extra}
    </div>
  );
};

const RegistrationForm = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) || 'light';
    } catch (e) {
      return 'light';
    }
  });

  // The admin / manager boards leave their theme on <html>; the shared
  // design-system rules keyed on it would restyle this page — lift it.
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.getAttribute('data-theme');
    if (prev) root.removeAttribute('data-theme');
    return () => { if (prev && !root.hasAttribute('data-theme')) root.setAttribute('data-theme', prev); };
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      return next;
    });
  }, []);

  // Get step from URL or localStorage
  const getStepFromUrl = () => {
    const stepParam = searchParams.get('step');
    if (stepParam !== null) {
      const step = parseInt(stepParam, 10);
      if (!isNaN(step) && step >= -1 && step <= 8) {
        return step;
      }
    }
    return null;
  };

  const [activeStep, setActiveStep] = useState(() => {
    const urlStep = getStepFromUrl();
    return urlStep !== null ? urlStep : getInitialStep();
  });
  const [formData, setFormData] = useState(() => getInitialFormData() || defaultFormData);

  const [registrationResult, setRegistrationResult] = useState(null);
  // Choice made in the "help me choose" guide on the landing screen
  // ({ applicationType, fablabSection, requiredServices }). It is also
  // written into formData so the steps open pre-selected.
  const [guidedChoice, setGuidedChoice] = useState(null);
  // /register?type=Talented (etc.) — the public website's buttons open
  // the form with the application type already chosen.
  const [presetType] = useState(() => {
    const t = searchParams.get('type');
    return ['Beneficiary', 'Visitor', 'Talented', 'Entity'].includes(t) ? t : null;
  });
  useEffect(() => {
    if (!presetType) return;
    setFormData(prev => ({ ...prev, applicationType: presetType }));
    searchParams.delete('type');
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [loading, setLoading] = useState(false);
  const [registrationDisabled, setRegistrationDisabled] = useState(false);
  const [disabledReason, setDisabledReason] = useState('');

  // Check if registration is disabled
  useEffect(() => {
    const checkRegistrationStatus = async () => {
      try {
        const response = await api.get('/settings/registration-status');
        setRegistrationDisabled(response.data.disabled);
        setDisabledReason(response.data.reason || '');
      } catch (error) {
        console.error('Error checking registration status:', error);
      }
    };
    checkRegistrationStatus();
  }, []);

  // Entity (كيان) needs the access password every visit: a resumed
  // draft, a URL step jump or a returning Entity user lands back on the
  // type step, which asks for it.
  useEffect(() => {
    if (!registrationResult && activeStep >= 1 && formData.applicationType === 'Entity' && !formData.entityAccessToken) {
      setActiveStep(0);
    }
  }, [activeStep, formData.applicationType, formData.entityAccessToken, registrationResult]);

  // Sync URL with active step
  useEffect(() => {
    if (!registrationResult) {
      const currentStep = searchParams.get('step');
      const stepStr = activeStep.toString();
      if (currentStep !== stepStr) {
        if (activeStep === -1) {
          searchParams.delete('step');
        } else {
          searchParams.set('step', stepStr);
        }
        setSearchParams(searchParams, { replace: false });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, registrationResult]);

  // Listen for browser back/forward navigation
  useEffect(() => {
    const stepParam = searchParams.get('step');
    if (stepParam !== null) {
      const step = parseInt(stepParam, 10);
      if (!isNaN(step) && step >= -1 && step <= 8 && step !== activeStep) {
        setActiveStep(step);
      }
    } else if (activeStep !== -1 && !registrationResult) {
      // URL has no step param, go to initial step
      setActiveStep(-1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Save form state to localStorage whenever it changes
  useEffect(() => {
    if (!registrationResult) {
      try {
        const { entityAccessToken, ...draft } = formData;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          formData: draft,
          activeStep,
          savedAt: new Date().toISOString()
        }));
      } catch (e) {
        console.error('Error saving form data:', e);
      }
    }
  }, [formData, activeStep, registrationResult]);

  // Clear saved form data on successful registration
  const clearSavedForm = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Error clearing saved form:', e);
    }
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

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleFormDataChange = (data) => {
    setFormData({ ...formData, ...data });
  };

  const handleGuideApply = (choice) => {
    setGuidedChoice(choice);
    setFormData(prev => ({
      ...prev,
      applicationType: choice.applicationType,
      fablabSection: choice.fablabSection,
      requiredServices: choice.requiredServices
    }));
  };

  const handleGuideClear = () => {
    setGuidedChoice(null);
    setFormData(prev => ({ ...prev, applicationType: '', fablabSection: '', requiredServices: [] }));
  };

  const handleUserFound = (userData) => {
    // Auto-fill all user fields from existing user data
    // User can still change application type, but personal info is pre-filled.
    // A type picked in the guide (consultation → Beneficiary) wins over
    // whatever type the user registered with last time.
    setFormData({
      ...formData,
      existingUserId: userData.userId,
      applicationType: guidedChoice?.applicationType || presetType || dropVolunteer(userData.applicationType || ''),
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      name: userData.name || '',
      sex: userData.sex || '',
      nationality: userData.nationality || '',
      nationalId: userData.nationalId || '',
      phoneNumber: userData.phoneNumber || '',
      email: userData.email || '',
      currentJob: userData.currentJob || '',
      nationalAddress: userData.nationalAddress || '',
      entityName: userData.entityName || '',
      visitingEntity: userData.visitingEntity || '',
      personInCharge: userData.personInCharge || '',
      profilePicture: userData.profilePicture || ''
    });
    setActiveStep(0); // Go to Application Type step - user can change type but personal info is pre-filled
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await api.post('/registration/create', formData);
      setRegistrationResult(response.data.registration);
      clearSavedForm(); // Clear saved form data on successful registration
      // Clear step from URL on success
      searchParams.delete('step');
      setSearchParams(searchParams, { replace: true });
      toast.success(t('registrationSuccess'));
    } catch (error) {
      console.error('Registration error:', error);
      const errorData = error.response?.data;
      let errorMessage;

      if (errorData?.code === 'ENTITY_ACCESS_REQUIRED') {
        setFormData(prev => ({ ...prev, entityAccessToken: '' }));
        setActiveStep(0);
        toast.error(isRTL ? 'انتهت صلاحية التحقق — أدخل كلمة مرور الكيان مرة أخرى' : 'Entity access expired — please enter the password again');
        return;
      }

      if (errorData) {
        errorMessage = isRTL
          ? (errorData.messageAr || errorData.message || errorData.error)
          : (errorData.message || errorData.error);
      }

      if (!errorMessage && error.response?.status) {
        const statusMessages = {
          400: isRTL ? 'بيانات غير مكتملة أو غير صحيحة' : 'Incomplete or invalid data',
          404: isRTL ? 'الخدمة غير متوفرة' : 'Service not found',
          409: isRTL ? 'يوجد تعارض - الموعد قد يكون محجوز' : 'Conflict - time slot may be taken',
          413: isRTL ? 'حجم الملف كبير جداً' : 'File too large',
          500: isRTL ? 'خطأ في الخادم - يرجى المحاولة لاحقاً' : 'Server error - please try again later'
        };
        errorMessage = statusMessages[error.response.status];
      }

      toast.error(errorMessage || (isRTL ? 'حدث خطأ - يرجى المحاولة مرة أخرى' : 'An error occurred - please try again'));
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = (step) => {
    const stepProps = {
      formData,
      onChange: handleFormDataChange,
      onNext: handleNext,
      onBack: handleBack,
      theme
    };

    switch (step) {
      case 0:
        return <ApplicationType {...stepProps} />;
      case 1:
        return <ApplicationData {...stepProps} />;
      case 2:
        return <FablabSection {...stepProps} />;
      case 3:
        return <RequiredService {...stepProps} />;
      case 4:
        return <DateTimeSelection {...stepProps} />;
      case 5:
        return <ServiceDetails {...stepProps} />;
      case 6:
        return <Commitment {...stepProps} onSubmit={handleSubmit} loading={loading} />;
      default:
        return null;
    }
  };

  if (registrationDisabled) {
    return (
      <StudioShell isRTL={isRTL} theme={theme} onToggleTheme={toggleTheme}>
        <motion.section
          className="rgx-card rgx-closed"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <motion.span
            className="rgx-closed-ico"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.15 }}
          >
            <Icon d={['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M15 9l-6 6', 'M9 9l6 6']} />
          </motion.span>
          <h2>{isRTL ? 'التسجيل غير متاح حالياً' : 'Registration Currently Unavailable'}</h2>
          {disabledReason && (
            <div className="rgx-closed-reason">
              <b>{isRTL ? 'السبب' : 'Reason'}</b>
              <p>{disabledReason}</p>
            </div>
          )}
          <p className="rgx-closed-text">
            {isRTL
              ? 'نعتذر عن عدم إمكانية التسجيل في الوقت الحالي. يرجى المحاولة لاحقاً أو التواصل مع إدارة فاب لاب للمزيد من المعلومات.'
              : 'We apologize that registration is not available at this time. Please try again later or contact FABLAB administration for more information.'}
          </p>
          <div className="rgx-closed-actions">
            <button className="btn btn-primary" onClick={() => navigate('/borrow')}>
              <Icon d={['M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z', 'M3.27 6.96 12 12.01l8.73-5.05', 'M12 22.08V12']} />
              {isRTL ? 'استعارة مكونات' : 'Borrow Components'}
            </button>
            <button className="btn btn-secondary" onClick={() => window.location.reload()}>
              <Icon d={['M23 4v6h-6', 'M20.49 15a9 9 0 1 1-2.12-9.36L23 10']} />
              {isRTL ? 'إعادة المحاولة' : 'Try Again'}
            </button>
          </div>
        </motion.section>
      </StudioShell>
    );
  }

  if (registrationResult) {
    return (
      <StudioShell isRTL={isRTL} theme={theme} onToggleTheme={toggleTheme}>
        <section className="rgx-card rgx-success">
          <SuccessPage registration={registrationResult} />
        </section>
      </StudioShell>
    );
  }

  const startOver = () => {
    setActiveStep(-1);
    setFormData(defaultFormData);
    setGuidedChoice(null);
    clearSavedForm();
  };

  return (
      <StudioShell
        isRTL={isRTL}
        theme={theme}
        onToggleTheme={toggleTheme}
        onHome={startOver}
        steps={steps}
        activeStep={activeStep}
        onJump={(i) => setActiveStep(i)}
        extra={<FabyBot currentStep={activeStep} formData={formData} />}
      >
        {/* Welcome hero — only on the first (lookup) screen */}
        {activeStep === -1 && (
          <motion.div
            className="rgx-hero"
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <p className="rgx-eyebrow"><i aria-hidden="true" />{isRTL ? 'مرحبًا بك في فاب لاب الأحساء' : 'Welcome to FabLab Al-Ahsa'}</p>
            <h1>{isRTL ? <>التسجيل <em>وحجز المواعيد</em></> : <>Registration <em>&amp; appointments</em></>}</h1>
            <p>{isRTL
              ? 'ابحث برقم هويتك أو جوالك إن سجّلت من قبل، أو ابدأ تسجيلًا جديدًا — أو اختر إحدى خدماتنا بالأسفل.'
              : "Look yourself up by ID or phone if you've registered before, start a new registration, or pick one of our services below."}</p>
          </motion.div>
        )}

        <motion.section
          className={`rgx-card${activeStep === -1 ? ' is-landing' : ''}`}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {activeStep === -1 ? (
            <UserLookup
              onUserFound={handleUserFound}
              onNewUser={() => setActiveStep(0)}
              theme={theme}
              guidedChoice={guidedChoice}
              onGuideApply={handleGuideApply}
              onGuideClear={handleGuideClear}
            />
          ) : (
            <div className="rgx-content">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, x: isRTL ? -24 : 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: isRTL ? 24 : -24 }}
                  transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <p className="rgx-step-eyebrow">
                    <span>{String(Math.max(0, activeStep) + 1).padStart(2, '0')}</span>
                    {steps[activeStep]?.label}
                  </p>
                  {renderStepContent(activeStep)}
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </motion.section>
      </StudioShell>
  );
};

export default RegistrationForm;
