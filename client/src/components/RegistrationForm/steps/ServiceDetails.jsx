import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

const ServiceDetails = ({ formData, onChange, onNext, onBack }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const canProceed = formData.serviceDetails.trim() !== '';

  return (
    <div>
      <h2 className="step-title">
        {isRTL ? 'تفاصيل الخدمة' : 'Service Details'}
      </h2>
      <p className="step-description">
        {isRTL ? 'يرجى وصف ما تحتاجه بالتفصيل' : 'Please describe what you need in detail'}
      </p>

      <motion.div
        className="form-group"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <label className="form-label">
          {isRTL ? 'تفاصيل الخدمة المطلوبة' : 'Service Details'} <span className="required">*</span>
        </label>
        <textarea
          className="form-textarea"
          value={formData.serviceDetails}
          onChange={(e) => onChange({ serviceDetails: e.target.value })}
          placeholder={isRTL
            ? 'يرجى وصف ما تحتاجه بالتفصيل، بما في ذلك أي متطلبات خاصة أو مواصفات للمشروع...'
            : 'Please describe what you need in detail, including any special requirements or project specifications...'}
          rows={8}
        />
      </motion.div>

      <motion.div
        className="info-banner"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{ marginTop: '1rem' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
        </svg>
        <span>
          {isRTL
            ? 'كلما كانت التفاصيل أكثر، كان بإمكاننا مساعدتك بشكل أفضل'
            : 'The more details you provide, the better we can assist you'}
        </span>
      </motion.div>

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

export default ServiceDetails;
