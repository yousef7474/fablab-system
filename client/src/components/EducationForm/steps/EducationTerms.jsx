import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

const terms = [
  {
    ar: 'المعلم مسؤول عن نظافة القاعة أثناء وبعد كل جلسة تعليمية.',
    en: 'Teacher is responsible for keeping the room clean during and after each session.'
  },
  {
    ar: 'جميع الأجهزة والمعدات يجب أن تبقى في أماكنها المخصصة بعد الاستخدام.',
    en: 'All devices and equipment must remain in their designated places after use.'
  },
  {
    ar: 'استخدام المواد والأدوات بعناية وفقاً لإرشادات فاب لاب.',
    en: 'Materials and tools must be used carefully per FABLAB guidelines.'
  },
  {
    ar: 'المعلم مسؤول عن أي تلف أو فقدان ناتج عن الطلاب.',
    en: 'Teacher is responsible for any damage or loss caused by students.'
  },
  {
    ar: 'يجب تنظيف وترتيب المنطقة بالكامل قبل المغادرة.',
    en: 'The area must be fully cleaned and organized before leaving.'
  },
  {
    ar: 'يحتفظ فاب لاب بالحق في إنهاء الفترة التعليمية في حال عدم الالتزام.',
    en: 'FABLAB reserves the right to terminate the education period if terms are not followed.'
  },
  {
    ar: 'سيتم إجراء تقييمات يومية لحالة القاعة، والتقييمات المنخفضة قد تؤدي لإنهاء الفترة.',
    en: 'Daily room ratings will be conducted; low ratings may result in period termination.'
  },
  {
    ar: 'بالتوقيع أدناه، يقر المعلم بالموافقة على جميع الشروط المذكورة أعلاه.',
    en: 'By signing below, the teacher acknowledges and agrees to all terms above.'
  }
];

const EducationTerms = ({ formData, onChange, onBack, onSubmit, loading }) => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const canSubmit = formData.termsAccepted && formData.signature && formData.signature.trim().length >= 3;

  return (
    <div>
      <h2 className="step-title">
        {isRTL ? 'الشروط والأحكام' : 'Terms & Agreement'}
      </h2>
      <p className="step-description">
        {isRTL ? 'يرجى قراءة الشروط والأحكام والموافقة عليها' : 'Please read and agree to the terms and conditions'}
      </p>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Terms List */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '20px',
          maxHeight: '350px',
          overflowY: 'auto',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#1e293b', fontSize: '16px' }}>
            {isRTL ? 'شروط وأحكام الفترة التعليمية' : 'Education Period Terms & Conditions'}
          </h3>
          {terms.map((term, index) => (
            <div key={index} style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'flex-start' }}>
              <span style={{
                background: '#4f46e5',
                color: 'white',
                borderRadius: '50%',
                minWidth: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: '700',
                marginTop: '2px'
              }}>
                {index + 1}
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, color: '#334155', lineHeight: 1.6, fontSize: '14px' }}>{term.ar}</p>
                <p style={{ margin: '4px 0 0 0', color: '#64748b', lineHeight: 1.6, fontSize: '13px' }}>{term.en}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Terms Acceptance Checkbox */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px',
          background: formData.termsAccepted ? '#f0fdf4' : '#fff',
          border: `2px solid ${formData.termsAccepted ? '#22c55e' : '#e2e8f0'}`,
          borderRadius: '12px',
          cursor: 'pointer',
          marginBottom: '20px',
          transition: 'all 0.3s ease'
        }}
          onClick={() => onChange({ termsAccepted: !formData.termsAccepted })}
        >
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            border: `2px solid ${formData.termsAccepted ? '#22c55e' : '#cbd5e1'}`,
            background: formData.termsAccepted ? '#22c55e' : 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            flexShrink: 0
          }}>
            {formData.termsAccepted && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </div>
          <span style={{ fontWeight: '600', color: formData.termsAccepted ? '#155724' : '#334155' }}>
            {isRTL ? 'أوافق على جميع الشروط والأحكام المذكورة أعلاه' : 'I agree to all the terms and conditions listed above'}
          </span>
        </div>

        {/* Signature */}
        <div className="form-group">
          <label className="form-label" style={{ fontSize: '16px', fontWeight: '600' }}>
            {isRTL ? 'التوقيع (الاسم الكامل) *' : 'Signature (Full Name) *'}
          </label>
          <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#64748b' }}>
            {isRTL ? 'أدخل اسمك الكامل كتوقيع رقمي' : 'Enter your full name as a digital signature'}
          </p>
          <input
            type="text"
            className="form-input"
            placeholder={isRTL ? 'الاسم الكامل' : 'Full Name'}
            value={formData.signature}
            onChange={(e) => onChange({ signature: e.target.value })}
            style={{
              textAlign: 'center',
              fontSize: '18px',
              fontStyle: 'italic',
              fontFamily: "'Brush Script MT', 'Segoe Script', cursive, serif",
              padding: '14px',
              borderBottom: '2px solid #4f46e5'
            }}
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
          onClick={onSubmit}
          disabled={!canSubmit || loading}
          style={{ background: canSubmit && !loading ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : undefined, minWidth: '160px' }}
        >
          {loading ? (
            <span className="loading-spinner" />
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              {isRTL ? 'إرسال الطلب' : 'Submit Request'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default EducationTerms;
