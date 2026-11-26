import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

const terms = [
  {
    en: 'The borrower is fully responsible for the borrowed items and must return them in the same condition.',
    ar: 'يتحمل المستعير المسؤولية الكاملة عن العناصر المستعارة ويجب إعادتها بنفس الحالة.'
  },
  {
    en: 'Items must be returned by the specified return date.',
    ar: 'يجب إعادة العناصر في تاريخ الإرجاع المحدد.'
  },
  {
    en: 'Maximum borrowing period is 30 days. For longer periods, a new request must be submitted.',
    ar: 'الحد الأقصى لفترة الاستعارة 30 يومًا. للفترات الأطول، يجب تقديم طلب جديد.'
  },
  {
    en: 'Late returns will result in warning emails. After 3 warnings, FABLAB will contact the borrower directly.',
    ar: 'سيؤدي التأخير في الإرجاع إلى رسائل تحذيرية. بعد 3 تحذيرات، سيتواصل فاب لاب مع المستعير مباشرة.'
  },
  {
    en: 'Any damage or loss of borrowed items must be reported immediately.',
    ar: 'يجب الإبلاغ فورًا عن أي ضرر أو فقدان للعناصر المستعارة.'
  },
  {
    en: 'The borrower is liable for repair or replacement costs of damaged/lost items.',
    ar: 'يتحمل المستعير تكاليف إصلاح أو استبدال العناصر التالفة أو المفقودة.'
  },
  {
    en: 'Borrowed items may not be transferred to third parties.',
    ar: 'لا يجوز نقل العناصر المستعارة إلى أطراف ثالثة.'
  },
  {
    en: 'FABLAB reserves the right to request early return of items if needed.',
    ar: 'يحتفظ فاب لاب بالحق في طلب الإرجاع المبكر للعناصر عند الحاجة.'
  },
  {
    en: 'Repeated late returns may result in suspension of borrowing privileges.',
    ar: 'قد يؤدي التأخير المتكرر في الإرجاع إلى تعليق صلاحيات الاستعارة.'
  },
  {
    en: 'By signing, the borrower acknowledges and agrees to all terms above.',
    ar: 'بالتوقيع، يقر المستعير ويوافق على جميع الشروط المذكورة أعلاه.'
  }
];

const BorrowingTerms = ({ formData, onChange, onBack, onSubmit, loading }) => {
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

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        {/* Terms List */}
        <div className="bfx-terms">
          <h3>{isRTL ? 'شروط وأحكام استعارة المكونات' : 'Component Borrowing Terms & Conditions'}</h3>
          <ol>
            {terms.map((term, index) => (
              <li key={index}>
                <span className="bfx-terms-n">{index + 1}</span>
                <div>
                  <p>{isRTL ? term.ar : term.en}</p>
                  <small><bdi>{isRTL ? term.en : term.ar}</bdi></small>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Terms Acceptance Checkbox */}
        <label className={`rgx-ack${formData.termsAccepted ? ' is-on' : ''}`}>
          <input
            type="checkbox"
            checked={!!formData.termsAccepted}
            onChange={() => onChange({ termsAccepted: !formData.termsAccepted })}
          />
          <span>{isRTL ? 'أوافق على جميع الشروط والأحكام المذكورة أعلاه' : 'I agree to all the terms and conditions listed above'}</span>
        </label>

        {/* Signature */}
        <div className="form-group bfx-sign">
          <label className="form-label" htmlFor="bfx-signature">
            {isRTL ? 'التوقيع (الاسم الكامل)' : 'Signature (Full Name)'} <span className="required">*</span>
          </label>
          <small className="bfx-sign-hint">{isRTL ? 'أدخل اسمك الكامل كتوقيع رقمي' : 'Enter your full name as a digital signature'}</small>
          <input
            id="bfx-signature"
            type="text"
            className="form-input signature-input"
            placeholder={isRTL ? 'الاسم الكامل' : 'Full Name'}
            value={formData.signature}
            onChange={(e) => onChange({ signature: e.target.value })}
          />
        </div>
      </motion.div>

      <div className="form-navigation">
        <button className="btn btn-secondary" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }} aria-hidden="true">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          {isRTL ? 'السابق' : 'Previous'}
        </button>
        <button
          className="btn btn-primary btn-submit"
          onClick={onSubmit}
          disabled={!canSubmit || loading}
        >
          {loading ? (
            <span className="loading-spinner" />
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
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

export default BorrowingTerms;
