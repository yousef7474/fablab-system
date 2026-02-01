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
import ServiceType from './steps/ServiceType';
import Commitment from './steps/Commitment';
import SuccessPage from './SuccessPage';
import FabyBot from './FabyBot';
import './RegistrationForm.css';

const STORAGE_KEY = 'fablab_registration_form';

const getInitialFormData = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.formData || null;
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

const RegistrationForm = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

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
  const [loading, setLoading] = useState(false);

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
  }, [searchParams]);

  // Save form state to localStorage whenever it changes
  useEffect(() => {
    if (!registrationResult) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          formData,
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
    { key: 'section7', label: t('section7') },
    { key: 'section8', label: t('section8') }
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

  const handleUserFound = (userData) => {
    // Auto-fill all user fields from existing user data
    // User can still change application type, but personal info is pre-filled
    setFormData({
      ...formData,
      existingUserId: userData.userId,
      applicationType: userData.applicationType || '',
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
      // Show bilingual error message based on current language
      const errorData = error.response?.data;
      let errorMessage;

      if (errorData) {
        // Use Arabic or English message based on current language
        errorMessage = isRTL ? (errorData.messageAr || errorData.message) : errorData.message;
      }

      // Fallback to translation key if no specific message
      toast.error(errorMessage || t('registrationError'));
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = (step) => {
    const stepProps = {
      formData,
      onChange: handleFormDataChange,
      onNext: handleNext,
      onBack: handleBack
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
        return <ServiceType {...stepProps} />;
      case 7:
        return <Commitment {...stepProps} onSubmit={handleSubmit} loading={loading} />;
      default:
        return null;
    }
  };

  if (registrationResult) {
    return (
      <div className="registration-page" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="registration-container">
          <div className="form-card">
            <SuccessPage registration={registrationResult} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="registration-page" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Animated Background Elements */}
      <div className="floating-orbs">
        <div className="floating-orb"></div>
        <div className="floating-orb"></div>
        <div className="floating-orb"></div>
        <div className="floating-orb"></div>
        <div className="floating-orb"></div>
        <div className="floating-orb"></div>
      </div>
      <div className="wave-container">
        <div className="wave"></div>
        <div className="wave"></div>
        <div className="wave"></div>
      </div>

      <div className="registration-container">
        <div style={{ width: '100%', maxWidth: '900px' }}>
          {/* Header */}
          <motion.div
            className="registration-header"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="registration-logo">
              <img src="/logo.png" alt="FABLAB Logo" style={{ width: '70px', height: '70px', objectFit: 'contain' }} />
            </div>
            <h1 className="registration-title">FABLAB Al-Ahsa</h1>
            <p className="registration-subtitle">
              {isRTL ? 'نظام التسجيل وحجز المواعيد' : 'Registration & Appointment System'}
            </p>
          </motion.div>

          {/* Form Card */}
          <motion.div
            className="form-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {activeStep === -1 ? (
              <UserLookup
                onUserFound={handleUserFound}
                onNewUser={() => setActiveStep(0)}
              />
            ) : (
              <>
                {/* Home Button */}
                <div className="home-button-container">
                  <button
                    className="home-button"
                    onClick={() => {
                      setActiveStep(-1);
                      setFormData(defaultFormData);
                      clearSavedForm();
                    }}
                    title={isRTL ? 'العودة للرئيسية' : 'Back to Home'}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                      <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    <span>{isRTL ? 'الرئيسية' : 'Home'}</span>
                  </button>
                </div>

                {/* Stepper */}
                <div className="stepper-container">
                  <div className="stepper-wrapper">
                    {steps.map((step, index) => (
                      <div
                        key={step.key}
                        className={`step-item ${index === activeStep ? 'active' : ''} ${index < activeStep ? 'completed' : ''}`}
                      >
                        <div className="step-circle">
                          {index < activeStep ? '✓' : index + 1}
                        </div>
                        <span className="step-label">{step.label}</span>
                        {index < steps.length - 1 && <div className="step-connector" />}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Form Content */}
                <div className="form-content">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeStep}
                      initial={{ opacity: 0, x: isRTL ? -30 : 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: isRTL ? 30 : -30 }}
                      transition={{ duration: 0.3 }}
                    >
                      {renderStepContent(activeStep)}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </div>

      {/* FABY - AI Assistant Bot */}
      <FabyBot currentStep={activeStep} formData={formData} />
    </div>
  );
};

export default RegistrationForm;
