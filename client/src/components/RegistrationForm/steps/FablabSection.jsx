import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

const FablabSection = ({ formData, onChange, onNext, onBack }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  // All sections are always available for selection
  // Deactivation periods only block specific dates in the calendar (DateTimeSelection step)

  const sections = [
    {
      value: 'Electronics and Programming',
      labelEn: 'Electronics & Programming',
      labelAr: 'الإلكترونيات والبرمجة',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
          <rect x="9" y="9" width="6" height="6"/>
          <line x1="9" y1="1" x2="9" y2="4"/>
          <line x1="15" y1="1" x2="15" y2="4"/>
          <line x1="9" y1="20" x2="9" y2="23"/>
          <line x1="15" y1="20" x2="15" y2="23"/>
          <line x1="20" y1="9" x2="23" y2="9"/>
          <line x1="20" y1="14" x2="23" y2="14"/>
          <line x1="1" y1="9" x2="4" y2="9"/>
          <line x1="1" y1="14" x2="4" y2="14"/>
        </svg>
      )
    },
    {
      value: 'CNC Laser',
      labelEn: 'CNC Laser',
      labelAr: 'الليزر CNC',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/>
          <line x1="12" y1="2" x2="12" y2="6"/>
          <line x1="12" y1="18" x2="12" y2="22"/>
          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
          <line x1="2" y1="12" x2="6" y2="12"/>
          <line x1="18" y1="12" x2="22" y2="12"/>
          <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
          <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
        </svg>
      )
    },
    {
      value: 'CNC Wood',
      labelEn: 'CNC Wood',
      labelAr: 'الخشب CNC',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22c4-4 8-7 8-12a8 8 0 1 0-16 0c0 5 4 8 8 12z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      )
    },
    {
      value: '3D',
      labelEn: '3D Printing',
      labelAr: 'الطباعة ثلاثية الأبعاد',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
          <line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
      )
    },
    {
      value: 'Robotic and AI',
      labelEn: 'Robotics & AI',
      labelAr: 'الروبوتات والذكاء الاصطناعي',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <circle cx="12" cy="5" r="3"/>
          <line x1="12" y1="8" x2="12" y2="11"/>
          <line x1="8" y1="16" x2="8" y2="16"/>
          <line x1="16" y1="16" x2="16" y2="16"/>
        </svg>
      )
    },
    {
      value: "Kid's Club",
      labelEn: "Kid's Club",
      labelAr: 'نادي الأطفال',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
          <line x1="9" y1="9" x2="9.01" y2="9"/>
          <line x1="15" y1="9" x2="15.01" y2="9"/>
        </svg>
      )
    },
    {
      value: 'Vinyl Cutting',
      labelEn: 'Vinyl Cutting',
      labelAr: 'قص الفينيل',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="6" cy="6" r="3"/>
          <circle cx="6" cy="18" r="3"/>
          <line x1="20" y1="4" x2="8.12" y2="15.88"/>
          <line x1="14.47" y1="14.48" x2="20" y2="20"/>
          <line x1="8.12" y1="8.12" x2="12" y2="12"/>
        </svg>
      )
    }
  ];

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

      <div className="selection-grid">
        {sections.map((section, index) => (
          <motion.div
            key={section.value}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            className={`selection-card ${formData.fablabSection === section.value ? 'selected' : ''}`}
            onClick={() => handleSelect(section.value)}
          >
            <div className="selection-card-icon">
              {section.icon}
            </div>
            <div className="selection-card-title">
              {isRTL ? section.labelAr : section.labelEn}
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

export default FablabSection;
