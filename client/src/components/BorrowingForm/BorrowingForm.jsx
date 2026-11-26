import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';
import UserStep from './steps/UserStep';
import BorrowingDetails from './steps/BorrowingDetails';
import ReturnDate from './steps/ReturnDate';
import BorrowingTerms from './steps/BorrowingTerms';
// The registration "studio" frame (rail stepper, top bar, shared form
// controls) — the borrowing steps reuse its classes.
import StudioShell, { Icon, useStudioTheme } from '../RegistrationForm/StudioShell';
import './BorrowingForm.css';

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
  purpose: '',
  componentDescription: '',
  componentPhotoBefore: '',
  borrowDate: '',
  expectedReturnDate: '',
  signature: '',
  termsAccepted: false
};

const BOX = ['M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z', 'M3.27 6.96 12 12.01l8.73-5.05', 'M12 22.08V12'];
const STEP_ICONS = {
  user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  details: BOX,
  date: ['M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M16 2v4', 'M8 2v4', 'M3 10h18'],
  terms: ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z']
};
const FEATURES = [
  { ar: 'مكونات إلكترونية وأدوات لمشروعك', en: 'Electronic parts and tools for your project', d: BOX },
  { ar: 'استعارة حتى 30 يومًا', en: 'Borrow for up to 30 days', d: STEP_ICONS.date },
  { ar: 'مراجعة الطلب وإشعار بالبريد', en: 'Reviewed and answered by email', d: ['M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z', 'M22 6l-10 7L2 6'] }
];

const BorrowingForm = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();
  const [theme, toggleTheme] = useStudioTheme();

  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState(defaultFormData);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const steps = [
    { key: 'user', label: isRTL ? 'المستخدم' : 'User Info', icon: STEP_ICONS.user },
    { key: 'details', label: isRTL ? 'التفاصيل' : 'Details', icon: STEP_ICONS.details },
    { key: 'date', label: isRTL ? 'تاريخ الإرجاع' : 'Return Date', icon: STEP_ICONS.date },
    { key: 'terms', label: isRTL ? 'الشروط' : 'Terms', icon: STEP_ICONS.terms }
  ];

  const handleNext = () => setActiveStep((prev) => prev + 1);
  const handleBack = () => setActiveStep((prev) => prev - 1);
  const handleFormDataChange = (data) => setFormData({ ...formData, ...data });

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await api.post('/borrowing/create', formData);
      setResult(response.data.borrowing);
      toast.success(isRTL ? 'تم إنشاء طلب الاستعارة بنجاح' : 'Borrowing request created successfully');
    } catch (error) {
      console.error('Borrowing error:', error);
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
      case 0: return <UserStep {...stepProps} />;
      case 1: return <BorrowingDetails {...stepProps} />;
      case 2: return <ReturnDate {...stepProps} />;
      case 3: return <BorrowingTerms {...stepProps} onSubmit={handleSubmit} loading={loading} />;
      default: return null;
    }
  };

  const shellProps = {
    isRTL,
    theme,
    onToggleTheme: toggleTheme,
    servicesHref: '/register',
    subtitle: isRTL ? 'استعارة المكونات' : 'Component borrowing',
    intro: {
      portal: isRTL ? 'استعارة المكونات' : 'Component borrowing',
      title: isRTL ? <>استعِر ما تحتاجه<br /><em>وأعِده في موعده</em></> : <>Borrow what you need<br /><em>and return it on time</em></>,
      features: FEATURES
    }
  };

  if (result) {
    return (
      <StudioShell {...shellProps}>
        <motion.section
          className="rgx-card bfx-done"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <motion.span className="bfx-done-ico" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.15 }}>
            <Icon d={['M20 6 9 17l-5-5']} />
          </motion.span>
          <h2>{isRTL ? 'تم إرسال طلب الاستعارة بنجاح' : 'Borrowing request submitted'}</h2>
          <div className="bfx-done-id">
            <small>{isRTL ? 'رقم الاستعارة' : 'Borrowing ID'}</small>
            <b dir="ltr">{result.borrowingId}</b>
          </div>
          <p>{isRTL ? 'سيتم مراجعة طلبك من قبل الإدارة، وتصلك النتيجة عبر البريد الإلكتروني.' : 'The administration will review your request and email you the result.'}</p>
          <div className="bfx-done-actions">
            <button className="btn btn-primary" onClick={() => { setResult(null); setFormData(defaultFormData); setActiveStep(0); }}>
              <Icon d={['M12 5v14', 'M5 12h14']} />
              {isRTL ? 'طلب استعارة جديد' : 'New borrowing request'}
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/register')}>
              <Icon d={['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z']} />
              {isRTL ? 'كل الخدمات' : 'All services'}
            </button>
          </div>
        </motion.section>
      </StudioShell>
    );
  }

  return (
    <StudioShell {...shellProps} steps={steps} activeStep={activeStep} onJump={(i) => setActiveStep(i)}>
      {activeStep === 0 && (
        <motion.div
          className="rgx-hero bfx-hero"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <p className="rgx-eyebrow"><i aria-hidden="true" />{isRTL ? 'خدمات فاب لاب الأحساء' : 'FabLab Al-Ahsa services'}</p>
          <h1>{isRTL ? <>استعارة <em>المكونات</em></> : <>Component <em>borrowing</em></>}</h1>
        </motion.div>
      )}
      <motion.section
        className="rgx-card bfx"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.05, ease: [0.2, 0.8, 0.2, 1] }}
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

export default BorrowingForm;
