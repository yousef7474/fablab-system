import React, { useState } from 'react';
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
import './RegistrationForm.css';

const RegistrationForm = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [activeStep, setActiveStep] = useState(-1);
  const [formData, setFormData] = useState({
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
    serviceDetails: '',
    serviceType: '',
    commitmentName: ''
  });

  const [registrationResult, setRegistrationResult] = useState(null);
  const [loading, setLoading] = useState(false);

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
    setFormData({
      ...formData,
      existingUserId: userData.userId,
      applicationType: userData.applicationType,
      firstName: userData.firstName,
      lastName: userData.lastName,
      name: userData.name,
      email: userData.email,
      phoneNumber: userData.phoneNumber
    });
    setActiveStep(2);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await api.post('/registration/create', formData);
      setRegistrationResult(response.data.registration);
      toast.success(t('registrationSuccess'));
    } catch (error) {
      console.error('Registration error:', error);
      toast.error(error.response?.data?.message || t('registrationError'));
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
    </div>
  );
};

export default RegistrationForm;
