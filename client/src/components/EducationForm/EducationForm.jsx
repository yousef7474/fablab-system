import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';
import TeacherInfo from './steps/TeacherInfo';
import SectionSelection from './steps/SectionSelection';
import ScheduleSelection from './steps/ScheduleSelection';
import RoomPhoto from './steps/RoomPhoto';
import EducationTerms from './steps/EducationTerms';
import './EducationForm.css';

const defaultFormData = {
  existingUserId: null,
  firstName: '',
  lastName: '',
  sex: '',
  nationality: '',
  nationalId: '',
  phoneNumber: '',
  email: '',
  section: '',
  otherSectionDescription: '',
  numberOfStudents: '',
  periodStartDate: '',
  periodEndDate: '',
  periodStartTime: '',
  periodEndTime: '',
  roomPhotoBefore: '',
  signature: '',
  termsAccepted: false
};

const EducationForm = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();

  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState(defaultFormData);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const steps = [
    { key: 'teacher', labelEn: 'Teacher Info', labelAr: 'المعلم' },
    { key: 'section', labelEn: 'Section', labelAr: 'القسم' },
    { key: 'schedule', labelEn: 'Schedule', labelAr: 'الجدول' },
    { key: 'photo', labelEn: 'Room Photo', labelAr: 'صورة القاعة' },
    { key: 'terms', labelEn: 'Terms', labelAr: 'الشروط' }
  ];

  const handleNext = () => setActiveStep((prev) => prev + 1);
  const handleBack = () => setActiveStep((prev) => prev - 1);
  const handleFormDataChange = (data) => setFormData({ ...formData, ...data });

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await api.post('/education/create', formData);
      setResult(response.data.education);
      toast.success(isRTL ? 'تم إنشاء طلب التعليم بنجاح' : 'Education request created successfully');
    } catch (error) {
      console.error('Education error:', error);
      const errorData = error.response?.data;
      const errorMessage = isRTL ? (errorData?.messageAr || errorData?.message) : errorData?.message;
      toast.error(errorMessage || (isRTL ? 'حدث خطأ أثناء إرسال الطلب' : 'Error submitting request'));
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
      case 0: return <TeacherInfo {...stepProps} />;
      case 1: return <SectionSelection {...stepProps} />;
      case 2: return <ScheduleSelection {...stepProps} />;
      case 3: return <RoomPhoto {...stepProps} />;
      case 4: return <EducationTerms {...stepProps} onSubmit={handleSubmit} loading={loading} />;
      default: return null;
    }
  };

  if (result) {
    return (
      <div className="education-page" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="education-container">
          <motion.div className="form-card" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
              >
                <div style={{ width: '80px', height: '80px', background: '#f5f3ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6d28d9" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                </div>
              </motion.div>
              <h2 style={{ color: '#5b21b6', marginBottom: '8px' }}>
                {isRTL ? 'تم إرسال طلب التعليم بنجاح!' : 'Education Request Submitted Successfully!'}
              </h2>
              <div style={{
                background: '#f5f3ff',
                padding: '20px',
                borderRadius: '12px',
                margin: '20px 0',
                border: '1px solid #ddd6fe'
              }}>
                <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 8px' }}>
                  {isRTL ? 'رقم الطلب' : 'Education ID'}
                </p>
                <p style={{ fontSize: '28px', fontWeight: '700', color: '#6d28d9', margin: 0 }}>
                  {result.educationId}
                </p>
              </div>
              <p style={{ color: '#666', lineHeight: 1.8 }}>
                {isRTL ? 'سيتم مراجعة طلبك من قبل الإدارة. سيتم التواصل معك بالنتيجة.' : 'Your request will be reviewed by the administration. You will be contacted with the result.'}
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => { setResult(null); setFormData(defaultFormData); setActiveStep(0); }}
                  style={{ background: 'linear-gradient(135deg, #6d28d9, #7c3aed)' }}
                >
                  {isRTL ? 'طلب تعليم جديد' : 'New Education Request'}
                </button>
                <button className="btn btn-secondary" onClick={() => navigate('/')}>
                  {isRTL ? 'العودة للرئيسية' : 'Back to Home'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="education-page" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Animated Background */}
      <div className="education-bg-shapes">
        <div className="education-shape"></div>
        <div className="education-shape"></div>
        <div className="education-shape"></div>
      </div>

      <div className="education-container">
        <div style={{ width: '100%', maxWidth: '900px' }}>
          {/* Header */}
          <motion.div
            className="education-header"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="education-logo">
              <img src="/logo.png" alt="FABLAB Logo" style={{ width: '70px', height: '70px', objectFit: 'contain' }} />
            </div>
            <h1 className="education-title">FABLAB Al-Ahsa</h1>
            <p className="education-subtitle">
              {isRTL ? 'نظام تسجيل التعليم' : 'Education Registration System'}
            </p>
          </motion.div>

          {/* Form Card */}
          <motion.div
            className="form-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {/* Home Button */}
            <div className="home-button-container">
              <button
                className="home-button"
                onClick={() => navigate('/')}
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
                    <span className="step-label">{isRTL ? step.labelAr : step.labelEn}</span>
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
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default EducationForm;
