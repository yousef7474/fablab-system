import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { NavArrow } from './TeacherInfo';

const sections = [
  { value: 'Electronics and Programming', labelAr: 'الإلكترونيات والبرمجة', labelEn: 'Electronics and Programming', icon: '💻' },
  { value: 'CNC Laser', labelAr: 'القطع بالليزر', labelEn: 'CNC Laser', icon: '🔦' },
  { value: 'CNC Wood', labelAr: 'القطع الخشبي', labelEn: 'CNC Wood', icon: '🪵' },
  { value: 'CNC Metal', labelAr: 'قطع المعادن', labelEn: 'CNC Metal', icon: '🔩' },
  { value: '3D', labelAr: 'الطباعة ثلاثية الأبعاد', labelEn: '3D Printing', icon: '🖨️' },
  { value: 'Robotic and AI', labelAr: 'الروبوتات والذكاء الاصطناعي', labelEn: 'Robotic and AI', icon: '🤖' },
  { value: "Kid's Club", labelAr: 'نادي الأطفال', labelEn: "Kid's Club", icon: '👧' },
  { value: 'Vinyl Cutting', labelAr: 'قص الفينيل', labelEn: 'Vinyl Cutting', icon: '✂️' },
  { value: 'UV Printing and Sticker Making', labelAr: 'طباعة UV والملصقات', labelEn: 'UV Printing & Stickers', icon: '🎨' },
  { value: 'Other', labelAr: 'أخرى', labelEn: 'Other', icon: '📋' }
];

const SectionSelection = ({ formData, onChange, onNext, onBack }) => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const canProceed = formData.section && formData.numberOfStudents > 0 && (formData.section !== 'Other' || formData.otherSectionDescription);

  return (
    <div>
      <h2 className="step-title">
        {isRTL ? 'اختيار القسم' : 'Section Selection'}
      </h2>
      <p className="step-description">
        {isRTL ? 'اختر قسم فاب لاب وعدد الطلاب' : 'Select the FABLAB section and number of students'}
      </p>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <div className="selection-grid edu-sections" role="radiogroup">
          {sections.map((section, index) => (
            <motion.button
              type="button"
              key={section.value}
              className={`selection-card${formData.section === section.value ? ' selected' : ''}`}
              role="radio"
              aria-checked={formData.section === section.value}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.035 }}
              onClick={() => onChange({ section: section.value })}
            >
              <span className="selection-card-icon" aria-hidden="true">{section.icon}</span>
              <span className="selection-card-title">{isRTL ? section.labelAr : section.labelEn}</span>
            </motion.button>
          ))}
        </div>

        {/* Other section description */}
        {formData.section === 'Other' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">{isRTL ? 'وصف القسم الآخر' : 'Describe the other section'} <span className="required">*</span></label>
            <input
              type="text"
              className="form-input"
              placeholder={isRTL ? 'اكتب وصف القسم' : 'Describe the section'}
              value={formData.otherSectionDescription || ''}
              onChange={(e) => onChange({ otherSectionDescription: e.target.value })}
            />
          </motion.div>
        )}

        {/* Number of Students */}
        <div className="form-group edu-count">
          <label className="form-label">{isRTL ? 'عدد الطلاب' : 'Number of Students'} <span className="required">*</span></label>
          <input
            type="number"
            className="form-input"
            min="1"
            max="100"
            placeholder={isRTL ? 'أدخل عدد الطلاب' : 'Enter number of students'}
            value={formData.numberOfStudents || ''}
            onChange={(e) => onChange({ numberOfStudents: parseInt(e.target.value) || '' })}
          />
        </div>
      </motion.div>

      <div className="form-navigation">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          <NavArrow dir="back" isRTL={isRTL} />
          {isRTL ? 'السابق' : 'Previous'}
        </button>
        <button type="button" className="btn btn-primary" onClick={onNext} disabled={!canProceed}>
          {isRTL ? 'التالي' : 'Next'}
          <NavArrow dir="next" isRTL={isRTL} />
        </button>
      </div>
    </div>
  );
};

export default SectionSelection;
