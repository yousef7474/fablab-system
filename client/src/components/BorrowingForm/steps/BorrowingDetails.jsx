import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';

const sections = [
  { value: 'Electronics and Programming', labelEn: 'Electronics & Programming', labelAr: 'الإلكترونيات والبرمجة',
    icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg> },
  { value: 'CNC Laser', labelEn: 'CNC Laser', labelAr: 'الليزر CNC',
    icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg> },
  { value: 'CNC Wood', labelEn: 'CNC Wood', labelAr: 'الخشب CNC',
    icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22c4-4 8-7 8-12a8 8 0 1 0-16 0c0 5 4 8 8 12z"/><circle cx="12" cy="10" r="3"/></svg> },
  { value: '3D', labelEn: '3D Printing', labelAr: 'الطباعة ثلاثية الأبعاد',
    icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> },
  { value: 'Robotic and AI', labelEn: 'Robotics & AI', labelAr: 'الروبوتات والذكاء الاصطناعي',
    icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><circle cx="12" cy="5" r="3"/><line x1="12" y1="8" x2="12" y2="11"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg> },
  { value: "Kid's Club", labelEn: "Kid's Club", labelAr: 'نادي الأطفال',
    icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg> },
  { value: 'Vinyl Cutting', labelEn: 'Vinyl Cutting', labelAr: 'قص الفينيل',
    icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg> }
];

const BorrowingDetails = ({ formData, onChange, onNext, onBack }) => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const fileInputRef = useRef(null);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(isRTL ? 'يرجى اختيار صورة صالحة' : 'Please select a valid image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(isRTL ? 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت' : 'Image size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      onChange({ componentPhotoBefore: event.target.result });
    };
    reader.readAsDataURL(file);
  };

  const canProceed = formData.section && formData.purpose && formData.componentDescription && formData.componentPhotoBefore;

  return (
    <div>
      <h2 className="step-title">
        {isRTL ? 'تفاصيل الاستعارة' : 'Borrowing Details'}
      </h2>
      <p className="step-description">
        {isRTL ? 'اختر القسم وأدخل تفاصيل المكونات المطلوبة' : 'Select the section and enter component details'}
      </p>

      {/* Section Selection */}
      <div className="selection-grid">
        {sections.map((section, index) => (
          <motion.div
            key={section.value}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`selection-card ${formData.section === section.value ? 'selected' : ''}`}
            onClick={() => onChange({ section: section.value })}
          >
            <div className="selection-card-icon">{section.icon}</div>
            <div className="selection-card-title">{isRTL ? section.labelAr : section.labelEn}</div>
          </motion.div>
        ))}
      </div>

      {/* Purpose */}
      <div className="form-group" style={{ marginTop: '24px' }}>
        <label className="form-label">{isRTL ? 'الغرض من الاستعارة *' : 'Purpose of Borrowing *'}</label>
        <textarea
          className="form-input"
          rows="3"
          placeholder={isRTL ? 'اشرح سبب حاجتك للمكونات' : 'Explain why you need the components'}
          value={formData.purpose}
          onChange={(e) => onChange({ purpose: e.target.value })}
          style={{ textAlign: isRTL ? 'right' : 'left', resize: 'vertical' }}
        />
      </div>

      {/* Component Description */}
      <div className="form-group">
        <label className="form-label">{isRTL ? 'وصف المكونات *' : 'Component Description *'}</label>
        <textarea
          className="form-input"
          rows="3"
          placeholder={isRTL ? 'قم بوصف المكونات التي تريد استعارتها (النوع، الكمية، إلخ)' : 'Describe the components you want to borrow (type, quantity, etc.)'}
          value={formData.componentDescription}
          onChange={(e) => onChange({ componentDescription: e.target.value })}
          style={{ textAlign: isRTL ? 'right' : 'left', resize: 'vertical' }}
        />
      </div>

      {/* Photo Upload */}
      <div className="form-group">
        <label className="form-label">{isRTL ? 'صورة المكونات *' : 'Component Photo *'}</label>
        <div
          style={{
            border: '2px dashed #cbd5e1',
            borderRadius: '12px',
            padding: '24px',
            textAlign: 'center',
            cursor: 'pointer',
            background: formData.componentPhotoBefore ? '#f0f7ff' : '#f8fafc',
            transition: 'all 0.3s ease'
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          {formData.componentPhotoBefore ? (
            <div>
              <img
                src={formData.componentPhotoBefore}
                alt="Component"
                style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '8px', objectFit: 'cover' }}
              />
              <p style={{ marginTop: '8px', color: '#22c55e', fontWeight: '600' }}>
                {isRTL ? 'تم رفع الصورة - اضغط لتغييرها' : 'Photo uploaded - click to change'}
              </p>
            </div>
          ) : (
            <div>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ margin: '0 auto' }}>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <p style={{ marginTop: '12px', color: '#64748b' }}>
                {isRTL ? 'اضغط لرفع صورة المكونات' : 'Click to upload component photo'}
              </p>
              <p style={{ fontSize: '12px', color: '#94a3b8' }}>
                {isRTL ? 'الحد الأقصى: 5 ميجابايت' : 'Max size: 5MB'}
              </p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      <div className="form-navigation">
        <button className="btn btn-secondary" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }}>
            <path d="m15 18-6-6 6-6"/>
          </svg>
          {isRTL ? 'السابق' : 'Previous'}
        </button>
        <button className="btn btn-primary" onClick={onNext} disabled={!canProceed}>
          {isRTL ? 'التالي' : 'Next'}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }}>
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default BorrowingDetails;
