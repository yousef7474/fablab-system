import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

const Commitment = ({ formData, onChange, onBack, onSubmit, loading }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const commitmentTextEn = `I, the undersigned, confirm that all information provided is accurate and complete. I agree to:

1. Follow all FABLAB safety rules and guidelines
2. Respect the equipment and facilities
3. Complete my project within the allocated time
4. Report any issues or damages immediately
5. Maintain a clean and organized workspace

I understand that failure to comply may result in suspension of privileges.`;

  const commitmentTextAr = `أنا الموقع أدناه، أؤكد أن جميع المعلومات المقدمة صحيحة وكاملة. أوافق على:

1. اتباع جميع قواعد وإرشادات السلامة في فاب لاب
2. احترام المعدات والمرافق
3. إكمال مشروعي خلال الوقت المخصص
4. الإبلاغ عن أي مشاكل أو أضرار فوراً
5. الحفاظ على مساحة عمل نظيفة ومنظمة

أفهم أن عدم الامتثال قد يؤدي إلى تعليق الامتيازات.`;

  const canProceed = formData.commitmentName.trim() !== '';

  return (
    <div>
      <h2 className="step-title">
        {isRTL ? 'التعهد والالتزام' : 'Commitment Agreement'}
      </h2>
      <p className="step-description">
        {isRTL ? 'يرجى قراءة التعهد والموافقة عليه' : 'Please read and agree to the commitment'}
      </p>

      <motion.div
        className="commitment-box"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="commitment-header">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          <span>{isRTL ? 'نص التعهد' : 'Commitment Text'}</span>
        </div>
        <div className="commitment-text">
          {isRTL ? commitmentTextAr : commitmentTextEn}
        </div>
      </motion.div>

      <motion.div
        className="form-group"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{ marginTop: '1.5rem' }}
      >
        <label className="form-label">
          {isRTL ? 'الاسم الكامل (للتوقيع)' : 'Full Name (as signature)'} <span className="required">*</span>
        </label>
        <input
          type="text"
          className="form-input signature-input"
          value={formData.commitmentName}
          onChange={(e) => onChange({ commitmentName: e.target.value })}
          placeholder={isRTL ? 'أدخل اسمك الكامل للتأكيد على موافقتك' : 'Enter your full name to confirm your agreement'}
        />
      </motion.div>

      <motion.div
        className="info-banner success"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{ marginTop: '1.5rem' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <span>
          {isRTL
            ? 'بإدخال اسمك، فإنك توافق على جميع الشروط المذكورة أعلاه'
            : 'By entering your name, you agree to all terms mentioned above'}
        </span>
      </motion.div>

      <div className="form-navigation">
        <button className="btn btn-secondary" onClick={onBack} disabled={loading}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }}>
            <path d="m15 18-6-6 6-6"/>
          </svg>
          {t('previous')}
        </button>
        <button
          className="btn btn-primary btn-submit"
          onClick={onSubmit}
          disabled={!canProceed || loading}
        >
          {loading ? (
            <>
              <span className="loading-spinner" />
              {isRTL ? 'جاري الإرسال...' : 'Submitting...'}
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13"/>
                <path d="M22 2l-7 20-4-9-9-4 20-7z"/>
              </svg>
              {t('submit')}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Commitment;
