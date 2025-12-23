import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

const ServiceType = ({ formData, onChange, onNext, onBack }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const serviceTypes = [
    {
      value: 'From official partners',
      labelEn: 'From Official Partners',
      labelAr: 'من الشركاء الرسميين',
      descriptionEn: 'Services provided through our official partner organizations',
      descriptionAr: 'خدمات مقدمة من خلال المنظمات الشريكة الرسمية',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="m9 12 2 2 4-4"/>
        </svg>
      )
    },
    {
      value: 'Free',
      labelEn: 'Free Service',
      labelAr: 'خدمة مجانية',
      descriptionEn: 'No cost service available for eligible users',
      descriptionAr: 'خدمة بدون تكلفة متاحة للمستخدمين المؤهلين',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
          <line x1="7" y1="7" x2="7.01" y2="7"/>
        </svg>
      )
    },
    {
      value: 'Partial Financial compensation',
      labelEn: 'Partial Financial Compensation',
      labelAr: 'تعويض مالي جزئي',
      descriptionEn: 'Subsidized pricing with partial cost coverage',
      descriptionAr: 'تسعير مدعوم مع تغطية جزئية للتكاليف',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/>
          <path d="M12 18V6"/>
        </svg>
      )
    },
    {
      value: 'Full Financial compensation',
      labelEn: 'Full Financial Compensation',
      labelAr: 'تعويض مالي كامل',
      descriptionEn: 'Full market rate pricing for the service',
      descriptionAr: 'التسعير بالسعر الكامل للسوق للخدمة',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
          <line x1="1" y1="10" x2="23" y2="10"/>
        </svg>
      )
    }
  ];

  const canProceed = formData.serviceType !== '';

  return (
    <div>
      <h2 className="step-title">
        {isRTL ? 'نوع الخدمة' : 'Service Type'}
      </h2>
      <p className="step-description">
        {isRTL ? 'اختر نوع الخدمة المناسب لك' : 'Select the service type that suits you'}
      </p>

      <div className="radio-list">
        {serviceTypes.map((type, index) => (
          <motion.div
            key={type.value}
            initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`radio-card ${formData.serviceType === type.value ? 'selected' : ''}`}
            onClick={() => onChange({ serviceType: type.value })}
          >
            <div className="radio-card-radio">
              <div className="radio-outer">
                {formData.serviceType === type.value && <div className="radio-inner" />}
              </div>
            </div>
            <div className="radio-card-icon">
              {type.icon}
            </div>
            <div className="radio-card-content">
              <div className="radio-card-title">
                {isRTL ? type.labelAr : type.labelEn}
              </div>
              <div className="radio-card-description">
                {isRTL ? type.descriptionAr : type.descriptionEn}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="form-navigation">
        <button className="btn btn-secondary" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }}>
            <path d="m15 18-6-6 6-6"/>
          </svg>
          {t('previous')}
        </button>
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

export default ServiceType;
