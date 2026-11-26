import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';
import StudioShell, { Icon, useStudioTheme } from '../RegistrationForm/StudioShell';
import TeacherInfo from './steps/TeacherInfo';
import SectionSelection from './steps/SectionSelection';
import ScheduleSelection from './steps/ScheduleSelection';
import RoomPhoto from './steps/RoomPhoto';
import EducationTerms from './steps/EducationTerms';
import { EDU_ICONS, EDU_INTRO } from './EduParts';
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
  roomPhotosBefore: [],
  signature: '',
  termsAccepted: false
};

const EducationForm = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();
  const [theme, toggleTheme] = useStudioTheme();

  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState(defaultFormData);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const steps = [
    { key: 'teacher', label: isRTL ? 'المعلم' : 'Teacher', icon: EDU_ICONS.teacher },
    { key: 'section', label: isRTL ? 'القسم' : 'Section', icon: EDU_ICONS.section },
    { key: 'schedule', label: isRTL ? 'الجدول' : 'Schedule', icon: EDU_ICONS.schedule },
    { key: 'photo', label: isRTL ? 'صور القاعة' : 'Room photos', icon: EDU_ICONS.photo },
    { key: 'terms', label: isRTL ? 'الشروط والتوقيع' : 'Terms & signature', icon: EDU_ICONS.terms }
  ];

  const handleNext = () => setActiveStep((prev) => prev + 1);
  const handleBack = () => setActiveStep((prev) => prev - 1);
  const handleFormDataChange = (data) => setFormData({ ...formData, ...data });
  const startOver = () => { setResult(null); setFormData(defaultFormData); setActiveStep(0); };

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

  const shell = {
    isRTL,
    theme,
    onToggleTheme: toggleTheme,
    intro: EDU_INTRO(isRTL),
    subtitle: isRTL ? 'التعليم · تسجيل المعلم' : 'Education · teacher registration',
    servicesHref: '/register'
  };

  if (result) {
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
          <h2>{isRTL ? 'تم إرسال طلب التعليم بنجاح!' : 'Education Request Submitted Successfully!'}</h2>
          <div className="edu-idbox">
            <small>{isRTL ? 'رقم الطلب (رقم التعليم)' : 'Education ID'}</small>
            <b>{result.educationId}</b>
          </div>
          <p>{isRTL ? 'سيتم مراجعة طلبك من قبل الإدارة. سيتم التواصل معك بالنتيجة.' : 'Your request will be reviewed by the administration. You will be contacted with the result.'}</p>
          <div className="edu-done-actions">
            <button className="btn btn-primary" onClick={startOver}>
              <Icon d={EDU_ICONS.plus} />
              {isRTL ? 'طلب تعليم جديد' : 'New Education Request'}
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/register')}>
              <Icon d={EDU_ICONS.section} />
              {isRTL ? 'كل الخدمات' : 'All services'}
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
      activeStep={activeStep}
      onJump={(i) => setActiveStep(i)}
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
              key={activeStep}
              initial={{ opacity: 0, x: isRTL ? -24 : 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? 24 : -24 }}
              transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <p className="rgx-step-eyebrow">
                <span>{String(activeStep + 1).padStart(2, '0')}</span>
                {steps[activeStep]?.label}
              </p>
              {renderStepContent(activeStep)}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.section>
    </StudioShell>
  );
};

export default EducationForm;
