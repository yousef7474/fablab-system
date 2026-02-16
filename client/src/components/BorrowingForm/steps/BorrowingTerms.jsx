import React, { useState } from 'react';
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
  const [showAllTerms, setShowAllTerms] = useState(true);

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
            {isRTL ? 'شروط وأحكام استعارة المكونات' : 'Component Borrowing Terms & Conditions'}
          </h3>
          {terms.map((term, index) => (
            <div key={index} style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'flex-start' }}>
              <span style={{
                background: '#2563eb',
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
          background: formData.termsAccepted ? '#d4edda' : '#fff',
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
              borderBottom: '2px solid #2563eb'
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
          style={{ background: canSubmit && !loading ? 'linear-gradient(135deg, #1a56db, #2563eb)' : undefined, minWidth: '160px' }}
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

export default BorrowingTerms;
