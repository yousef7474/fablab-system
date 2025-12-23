import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

const RequiredService = ({ formData, onChange, onNext, onBack }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const services = [
    {
      value: 'In-person consultation',
      labelEn: 'In-person Consultation',
      labelAr: 'استشارة حضورية',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      )
    },
    {
      value: 'Online consultation',
      labelEn: 'Online Consultation',
      labelAr: 'استشارة عن بعد',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      )
    },
    {
      value: 'Machine/Device reservation',
      labelEn: 'Machine/Device Reservation',
      labelAr: 'حجز جهاز / آلة',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="6" width="20" height="12" rx="2"/>
          <line x1="6" y1="10" x2="6" y2="14"/>
          <line x1="10" y1="10" x2="10" y2="14"/>
          <line x1="14" y1="10" x2="14" y2="14"/>
          <line x1="18" y1="10" x2="18" y2="14"/>
        </svg>
      )
    },
    {
      value: 'Personal workspace',
      labelEn: 'Personal Workspace',
      labelAr: 'مساحة عمل شخصية',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <line x1="3" y1="9" x2="21" y2="9"/>
          <line x1="9" y1="21" x2="9" y2="9"/>
        </svg>
      )
    },
    {
      value: 'Support in project implementation',
      labelEn: 'Project Implementation Support',
      labelAr: 'دعم في تنفيذ المشروع',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
      )
    },
    {
      value: 'Other',
      labelEn: 'Other',
      labelAr: 'أخرى',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="1"/>
          <circle cx="19" cy="12" r="1"/>
          <circle cx="5" cy="12" r="1"/>
        </svg>
      )
    }
  ];

  const handleServiceToggle = (service) => {
    let newServices = [...formData.requiredServices];

    if (newServices.includes(service)) {
      newServices = newServices.filter(s => s !== service);
    } else {
      if (newServices.length < 2) {
        newServices.push(service);
      }
    }

    onChange({ requiredServices: newServices });
  };

  const canProceed = formData.requiredServices.length > 0;

  return (
    <div>
      <h2 className="step-title">
        {isRTL ? 'الخدمة المطلوبة' : 'Required Service'}
      </h2>
      <p className="step-description">
        {isRTL ? 'اختر الخدمات المطلوبة (بحد أقصى خدمتين)' : 'Select required services (maximum 2)'}
      </p>

      <div className="checkbox-grid">
        {services.map((service, index) => {
          const isSelected = formData.requiredServices.includes(service.value);
          const isDisabled = formData.requiredServices.length >= 2 && !isSelected;

          return (
            <motion.div
              key={service.value}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className={`checkbox-card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
              onClick={() => !isDisabled && handleServiceToggle(service.value)}
            >
              <div className="checkbox-card-check">
                {isSelected && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </div>
              <div className="checkbox-card-icon">
                {service.icon}
              </div>
              <div className="checkbox-card-label">
                {isRTL ? service.labelAr : service.labelEn}
              </div>
            </motion.div>
          );
        })}
      </div>

      {formData.requiredServices.includes('Other') && (
        <motion.div
          className="form-group"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          style={{ marginTop: '1.5rem' }}
        >
          <label className="form-label">
            {isRTL ? 'يرجى التوضيح' : 'Please specify'}
          </label>
          <textarea
            className="form-textarea"
            value={formData.otherServiceDetails}
            onChange={(e) => onChange({ otherServiceDetails: e.target.value })}
            placeholder={isRTL ? 'اكتب تفاصيل الخدمة المطلوبة...' : 'Describe the required service...'}
            rows={3}
          />
        </motion.div>
      )}

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

export default RequiredService;
