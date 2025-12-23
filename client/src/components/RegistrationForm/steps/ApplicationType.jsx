import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

const ApplicationType = ({ formData, onChange, onNext }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const applicationTypes = [
    {
      value: 'Beneficiary',
      label: t('beneficiary'),
      labelAr: 'مستفيد',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      )
    },
    {
      value: 'Visitor',
      label: t('visitor'),
      labelAr: 'زائر',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      )
    },
    {
      value: 'Volunteer',
      label: t('volunteer'),
      labelAr: 'متطوع',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
          <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
          <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
          <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
        </svg>
      )
    },
    {
      value: 'Talented',
      label: t('talented'),
      labelAr: 'موهوب',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      )
    },
    {
      value: 'Entity',
      label: t('entity'),
      labelAr: 'جهة',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
          <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
          <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
          <path d="M10 6h4"/>
          <path d="M10 10h4"/>
          <path d="M10 14h4"/>
          <path d="M10 18h4"/>
        </svg>
      )
    },
    {
      value: 'FABLAB Visit',
      label: t('fablabVisit'),
      labelAr: 'زيارة فاب لاب',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      )
    }
  ];

  const handleSelect = (type) => {
    onChange({ applicationType: type });
  };

  const canProceed = formData.applicationType !== '';

  return (
    <div>
      <h2 className="step-title">
        {isRTL ? 'نوع الطلب' : 'Application Type'}
      </h2>
      <p className="step-description">
        {isRTL ? 'اختر نوع التسجيل الذي يناسبك' : 'Select the registration type that suits you'}
      </p>

      <div className="selection-grid">
        {applicationTypes.map((type, index) => (
          <motion.div
            key={type.value}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`selection-card ${formData.applicationType === type.value ? 'selected' : ''}`}
            onClick={() => handleSelect(type.value)}
          >
            <div className="selection-card-icon">
              {type.icon}
            </div>
            <div className="selection-card-title">
              {isRTL ? type.labelAr : type.label}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="form-navigation">
        <div />
        <button
          className="btn btn-primary"
          onClick={onNext}
          disabled={!canProceed}
        >
          {t('next')}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }}>
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ApplicationType;
