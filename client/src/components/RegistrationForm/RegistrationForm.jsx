import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Paper,
  Typography,
  Container
} from '@mui/material';
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

  const [activeStep, setActiveStep] = useState(-1); // Start with user lookup
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
    appointmentDate: null,
    appointmentTime: '',
    appointmentDuration: 60,
    startDate: null,
    endDate: null,
    startTime: '',
    endTime: '',
    visitDate: null,
    visitStartTime: '',
    visitEndTime: '',
    serviceDetails: '',
    serviceType: '',
    commitmentName: ''
  });

  const [registrationResult, setRegistrationResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const steps = [
    t('section1'), // Application Type
    t('section2'), // Application Data
    t('section3'), // FABLAB Sections
    t('section4'), // Required Service
    t('section5'), // Select Date and Time
    t('section6'), // Details
    t('section7'), // Type of Service
    t('section8')  // Commitment
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
    setActiveStep(2); // Skip to section 3
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
    switch (step) {
      case 0:
        return (
          <ApplicationType
            formData={formData}
            onChange={handleFormDataChange}
            onNext={handleNext}
          />
        );
      case 1:
        return (
          <ApplicationData
            formData={formData}
            onChange={handleFormDataChange}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 2:
        return (
          <FablabSection
            formData={formData}
            onChange={handleFormDataChange}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 3:
        return (
          <RequiredService
            formData={formData}
            onChange={handleFormDataChange}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 4:
        return (
          <DateTimeSelection
            formData={formData}
            onChange={handleFormDataChange}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 5:
        return (
          <ServiceDetails
            formData={formData}
            onChange={handleFormDataChange}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 6:
        return (
          <ServiceType
            formData={formData}
            onChange={handleFormDataChange}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 7:
        return (
          <Commitment
            formData={formData}
            onChange={handleFormDataChange}
            onBack={handleBack}
            onSubmit={handleSubmit}
            loading={loading}
          />
        );
      default:
        return null;
    }
  };

  if (registrationResult) {
    return <SuccessPage registration={registrationResult} />;
  }

  return (
    <Container maxWidth="lg" className="registration-container">
      <Box sx={{ py: 4 }}>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
            <Typography
              variant="h3"
              align="center"
              gutterBottom
              sx={{ mb: 4, fontWeight: 700 }}
            >
              {t('register')} - FABLAB Al-Ahsa
            </Typography>

            {activeStep === -1 ? (
              <UserLookup
                onUserFound={handleUserFound}
                onNewUser={() => setActiveStep(0)}
              />
            ) : (
              <>
                <Stepper
                  activeStep={activeStep}
                  alternativeLabel
                  sx={{ mb: 4 }}
                  dir={isRTL ? 'rtl' : 'ltr'}
                >
                  {steps.map((label, index) => (
                    <Step key={index}>
                      <StepLabel>{label}</StepLabel>
                    </Step>
                  ))}
                </Stepper>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStep}
                    initial={{ opacity: 0, x: isRTL ? -50 : 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: isRTL ? 50 : -50 }}
                    transition={{ duration: 0.3 }}
                  >
                    {renderStepContent(activeStep)}
                  </motion.div>
                </AnimatePresence>
              </>
            )}
          </Paper>
        </motion.div>
      </Box>
    </Container>
  );
};

export default RegistrationForm;
