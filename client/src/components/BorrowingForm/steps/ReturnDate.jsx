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
      return date.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
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

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Borrow Date Display */}
        <div style={{
          background: '#f0f7ff',
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '20px',
          border: '1px solid #bfdbfe'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '600', color: '#1e40af' }}>
              {isRTL ? 'تاريخ الاستعارة:' : 'Borrow Date:'}
            </span>
            <span style={{ color: '#1e40af' }}>
              {formatDate(formData.borrowDate || borrowDate)}
            </span>
          </div>
        </div>

        {/* Return Date Picker */}
        <div className="form-group">
          <label className="form-label" style={{ fontSize: '16px', fontWeight: '600' }}>
            {isRTL ? 'تاريخ الإرجاع المتوقع *' : 'Expected Return Date *'}
          </label>
          <input
            type="date"
            className="form-input"
            value={formData.expectedReturnDate}
            min={today}
            max={maxDate}
            onChange={(e) => onChange({ expectedReturnDate: e.target.value })}
            style={{ fontSize: '16px', padding: '14px' }}
          />
        </div>

        {/* Period Summary */}
        {formData.expectedReturnDate && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: days <= 7 ? '#d4edda' : days <= 20 ? '#fff3cd' : '#f8d7da',
              padding: '20px',
              borderRadius: '12px',
              marginTop: '20px',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '36px', fontWeight: '700', color: days <= 7 ? '#155724' : days <= 20 ? '#856404' : '#721c24' }}>
              {days}
            </div>
            <div style={{ fontSize: '16px', color: days <= 7 ? '#155724' : days <= 20 ? '#856404' : '#721c24', fontWeight: '600' }}>
              {isRTL ? 'يوم' : days === 1 ? 'day' : 'days'}
            </div>
            <div style={{ marginTop: '12px', fontSize: '14px', color: '#666' }}>
              <span>{isRTL ? 'من' : 'From'} {formatDate(formData.borrowDate || borrowDate)}</span>
              <br />
              <span>{isRTL ? 'إلى' : 'To'} {formatDate(formData.expectedReturnDate)}</span>
            </div>
          </motion.div>
        )}

        <div style={{
          background: '#f8fafc',
          padding: '12px 16px',
          borderRadius: '8px',
          marginTop: '16px',
          fontSize: '13px',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          {isRTL ? 'الحد الأقصى لفترة الاستعارة 30 يومًا. للفترات الأطول، يجب تقديم طلب جديد.' : 'Maximum borrowing period is 30 days. For longer periods, a new request must be submitted.'}
        </div>
      </motion.div>

      <div className="form-navigation" style={{ marginTop: '24px' }}>
        <button className="btn btn-secondary" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }}>
            <path d="m15 18-6-6 6-6"/>
          </svg>
          {isRTL ? 'السابق' : 'Previous'}
        </button>
        <button className="btn btn-primary" onClick={onNext} disabled={!formData.expectedReturnDate}>
          {isRTL ? 'التالي' : 'Next'}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }}>
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ReturnDate;
