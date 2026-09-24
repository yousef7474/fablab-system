import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { SECTIONS } from '../sectionCatalog';
import RegistrationGuide from '../RegistrationGuide';

const FablabSection = ({ formData, onChange, onNext, onBack, theme }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [guideOpen, setGuideOpen] = useState(false);

  // All sections are always available for selection
  // Deactivation periods only block specific dates in the calendar (DateTimeSelection step)

  const handleSelect = (sectionValue) => {
    onChange({ fablabSection: sectionValue });
  };

  const canProceed = formData.fablabSection !== '';

  return (
    <div>
      <h2 className="step-title">
        {isRTL ? 'قسم فاب لاب' : 'FABLAB Section'}
      </h2>
      <p className="step-description">
        {isRTL ? 'اختر القسم الذي ترغب في الاستفادة من خدماته' : 'Select the section you want to benefit from'}
      </p>

      <button type="button" className="rg-inline-help" onClick={() => setGuideOpen(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        {isRTL ? 'لست متأكداً من القسم المناسب؟' : 'Not sure which section fits?'}
        <b>{isRTL ? 'ساعدني أختار' : 'Help me choose'}</b>
      </button>

      <div className="selection-grid selection-grid--with-desc">
        {SECTIONS.map((section, index) => (
          <motion.div
            key={section.value}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`selection-card selection-card--with-desc ${formData.fablabSection === section.value ? 'selected' : ''}`}
            onClick={() => handleSelect(section.value)}
          >
            <div className="selection-card-icon">
              {section.icon}
            </div>
            <div className="selection-card-title">
              {isRTL ? section.labelAr : section.labelEn}
            </div>
            <div className="selection-card-description">
              {isRTL ? section.descAr : section.descEn}
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

      <RegistrationGuide
        open={guideOpen}
        mode="section"
        initialSection={formData.fablabSection}
        onClose={() => setGuideOpen(false)}
        onApply={({ fablabSection }) => handleSelect(fablabSection)}
        isRTL={isRTL}
        theme={theme}
      />
    </div>
  );
};

export default FablabSection;
