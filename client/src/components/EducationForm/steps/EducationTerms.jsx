import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { NavArrow } from './TeacherInfo';

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
    ar: 'يجب ترتيب المنطقة بالكامل قبل المغادرة والمحافظة على أماكن القطع.',
    en: 'The area must be fully organized before leaving and parts must remain in their places.'
  },
  {
    ar: 'سيقوم الفاب لاب بتنبيه المسؤول في حال عدم الالتزام وأخذ إجراء رسمي في حال تكرار المشكلة.',
    en: 'FABLAB will notify the responsible person in case of non-compliance and take official action if the issue recurs.'
  },
  {
    ar: 'سيتم إجراء تقييمات يومية لحالة القاعة، والتقييمات المنخفضة سيتم التنبيه عليها بشكل دوري.',
    en: 'Daily room ratings will be conducted; low ratings will be flagged periodically.'
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

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        {/* Terms List — Arabic first, English beneath (bilingual by design) */}
        <div className="edu-terms">
          <p className="edu-kicker">
            {isRTL ? 'شروط وأحكام الفترة التعليمية' : 'Education Period Terms & Conditions'}
          </p>
          <ol>
            {terms.map((term, index) => (
              <li key={index}>
                <span>{index + 1}</span>
                <div>
                  <p lang="ar"><bdi>{term.ar}</bdi></p>
                  <p lang="en"><bdi>{term.en}</bdi></p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Terms Acceptance */}
        <label className={`rgx-ack edu-ack${formData.termsAccepted ? ' is-on' : ''}`}>
          <input
            type="checkbox"
            checked={!!formData.termsAccepted}
            onChange={() => onChange({ termsAccepted: !formData.termsAccepted })}
          />
          <span>
            {isRTL ? 'أوافق على جميع الشروط والأحكام المذكورة أعلاه' : 'I agree to all the terms and conditions listed above'}
          </span>
        </label>

        {/* Signature */}
        <div className="form-group">
          <label className="form-label">
            {isRTL ? 'التوقيع (الاسم الكامل)' : 'Signature (Full Name)'} <span className="required">*</span>
          </label>
          <p className="edu-sub" style={{ marginBottom: 8 }}>
            {isRTL ? 'أدخل اسمك الكامل كتوقيع رقمي' : 'Enter your full name as a digital signature'}
          </p>
          <input
            type="text"
            className="form-input signature-input"
            placeholder={isRTL ? 'الاسم الكامل' : 'Full Name'}
            value={formData.signature}
            onChange={(e) => onChange({ signature: e.target.value })}
          />
        </div>
      </motion.div>

      <div className="form-navigation">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          <NavArrow dir="back" isRTL={isRTL} />
          {isRTL ? 'السابق' : 'Previous'}
        </button>
        <button type="button" className="btn btn-primary btn-submit" onClick={onSubmit} disabled={!canSubmit || loading}>
          {loading ? (
            <span className="loading-spinner" />
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
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
