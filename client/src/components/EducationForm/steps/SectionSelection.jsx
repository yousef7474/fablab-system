import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

const sections = [
  { value: 'Electronics and Programming', labelAr: 'الإلكترونيات والبرمجة', labelEn: 'Electronics and Programming', icon: '💻' },
  { value: 'CNC Laser', labelAr: 'القطع بالليزر', labelEn: 'CNC Laser', icon: '🔦' },
  { value: 'CNC Wood', labelAr: 'القطع الخشبي', labelEn: 'CNC Wood', icon: '🪵' },
  { value: '3D', labelAr: 'الطباعة ثلاثية الأبعاد', labelEn: '3D Printing', icon: '🖨️' },
  { value: 'Robotic and AI', labelAr: 'الروبوتات والذكاء الاصطناعي', labelEn: 'Robotic and AI', icon: '🤖' },
  { value: "Kid's Club", labelAr: 'نادي الأطفال', labelEn: "Kid's Club", icon: '👧' },
  { value: 'Vinyl Cutting', labelAr: 'قص الفينيل', labelEn: 'Vinyl Cutting', icon: '✂️' },
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

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Section Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          {sections.map((section, index) => (
            <motion.div
              key={section.value}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onChange({ section: section.value })}
              style={{
                background: formData.section === section.value ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'white',
                color: formData.section === section.value ? 'white' : '#334155',
                border: `2px solid ${formData.section === section.value ? '#4f46e5' : '#e2e8f0'}`,
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: formData.section === section.value ? '0 4px 15px rgba(79, 70, 229, 0.3)' : 'none'
              }}
            >
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>{section.icon}</div>
              <div style={{ fontWeight: '600', fontSize: '13px' }}>
                {isRTL ? section.labelAr : section.labelEn}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Other section description */}
        {formData.section === 'Other' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="form-group">
            <label className="form-label">{isRTL ? 'وصف القسم الآخر *' : 'Describe the other section *'}</label>
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
        <div className="form-group">
          <label className="form-label">{isRTL ? 'عدد الطلاب *' : 'Number of Students *'}</label>
          <input
            type="number"
            className="form-input"
            min="1"
            max="100"
            placeholder={isRTL ? 'أدخل عدد الطلاب' : 'Enter number of students'}
            value={formData.numberOfStudents || ''}
            onChange={(e) => onChange({ numberOfStudents: parseInt(e.target.value) || '' })}
            style={{ textAlign: 'center', fontSize: '18px', fontWeight: '700' }}
          />
        </div>
      </motion.div>

      <div className="form-navigation" style={{ marginTop: '24px' }}>
        <button className="btn btn-secondary" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }}>
            <path d="m15 18-6-6 6-6"/>
          </svg>
          {isRTL ? 'السابق' : 'Previous'}
        </button>
        <button
          className="btn btn-primary"
          onClick={onNext}
          disabled={!canProceed}
          style={{ background: canProceed ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : undefined }}
        >
          {isRTL ? 'التالي' : 'Next'}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }}>
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default SectionSelection;
