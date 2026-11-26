import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

const ReturnDate = ({ formData, onChange, onNext, onBack }) => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const today = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // minimum is tomorrow
    return d.toISOString().split('T')[0];
  }, []);

  const maxDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  }, []);

  const borrowDate = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  // Auto-set borrowDate to today if not set
  React.useEffect(() => {
    if (!formData.borrowDate) {
      onChange({ borrowDate });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getDaysDiff = () => {
    if (!formData.expectedReturnDate || !formData.borrowDate) return 0;
    const bDate = new Date(formData.borrowDate);
    const rDate = new Date(formData.expectedReturnDate);
    return Math.ceil((rDate - bDate) / (1000 * 60 * 60 * 24));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', calendar: 'gregory' });
    } catch { return dateStr; }
  };

  const days = getDaysDiff();

  return (
    <div>
      <h2 className="step-title">
        {isRTL ? 'تاريخ الإرجاع' : 'Return Date'}
      </h2>
      <p className="step-description">
        {isRTL ? 'اختر تاريخ إرجاع المكونات (الحد الأقصى 30 يومًا)' : 'Select the component return date (maximum 30 days)'}
      </p>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        {/* Borrow Date Display */}
        <div className="bfx-borrowed">
          <span>{isRTL ? 'تاريخ الاستعارة' : 'Borrow date'}</span>
          <b>{formatDate(formData.borrowDate || borrowDate)}</b>
        </div>

        {/* Return Date Picker */}
        <div className="form-group">
          <label className="form-label" htmlFor="bfx-return">
            {isRTL ? 'تاريخ الإرجاع المتوقع' : 'Expected Return Date'} <span className="required">*</span>
          </label>
          <input
            id="bfx-return"
            type="date"
            className="form-input"
            value={formData.expectedReturnDate}
            min={today}
            max={maxDate}
            onChange={(e) => onChange({ expectedReturnDate: e.target.value })}
          />
        </div>

        {/* Period Summary */}
        {formData.expectedReturnDate && (
          <motion.div
            className={`bfx-period ${days <= 7 ? 'is-short' : days <= 20 ? 'is-mid' : 'is-long'}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="bfx-period-n">
              <b>{days}</b>
              <span>{isRTL ? 'يوم' : days === 1 ? 'day' : 'days'}</span>
            </div>
            <div className="bfx-period-range">
              <span>{isRTL ? 'من' : 'From'} <b>{formatDate(formData.borrowDate || borrowDate)}</b></span>
              <span>{isRTL ? 'إلى' : 'To'} <b>{formatDate(formData.expectedReturnDate)}</b></span>
            </div>
          </motion.div>
        )}

        <div className="info-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <span>{isRTL ? 'الحد الأقصى لفترة الاستعارة 30 يومًا. للفترات الأطول، يجب تقديم طلب جديد.' : 'Maximum borrowing period is 30 days. For longer periods, a new request must be submitted.'}</span>
        </div>
      </motion.div>

      <div className="form-navigation">
        <button className="btn btn-secondary" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }} aria-hidden="true">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          {isRTL ? 'السابق' : 'Previous'}
        </button>
        <button className="btn btn-primary" onClick={onNext} disabled={!formData.expectedReturnDate}>
          {isRTL ? 'التالي' : 'Next'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }} aria-hidden="true">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ReturnDate;
