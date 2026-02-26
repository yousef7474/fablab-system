import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

const ScheduleSelection = ({ formData, onChange, onNext, onBack }) => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const canProceed = formData.periodStartDate && formData.periodEndDate && formData.periodStartTime && formData.periodEndTime;

  // Get today's date for min attribute
  const today = new Date().toISOString().split('T')[0];

  return (
    <div>
      <h2 className="step-title">
        {isRTL ? 'تحديد الجدول الزمني' : 'Schedule Selection'}
      </h2>
      <p className="step-description">
        {isRTL ? 'حدد فترة التعليم والأوقات المطلوبة' : 'Set the education period and required times'}
      </p>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Date Range */}
        <div style={{
          background: '#e8f6fb',
          border: '1px solid #b3dff0',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: '0 0 16px', color: '#2596be', fontSize: '16px', fontWeight: '700' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginLeft: isRTL ? '8px' : '0', marginRight: isRTL ? '0' : '8px' }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {isRTL ? 'فترة التعليم' : 'Education Period'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">{isRTL ? 'تاريخ البدء *' : 'Start Date *'}</label>
              <input
                type="date"
                className="form-input"
                min={today}
                value={formData.periodStartDate}
                onChange={(e) => onChange({ periodStartDate: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{isRTL ? 'تاريخ الانتهاء *' : 'End Date *'}</label>
              <input
                type="date"
                className="form-input"
                min={formData.periodStartDate || today}
                value={formData.periodEndDate}
                onChange={(e) => onChange({ periodEndDate: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Time Range */}
        <div style={{
          background: '#e8f6fb',
          border: '1px solid #b3dff0',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h3 style={{ margin: '0 0 16px', color: '#2596be', fontSize: '16px', fontWeight: '700' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginLeft: isRTL ? '8px' : '0', marginRight: isRTL ? '0' : '8px' }}>
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            {isRTL ? 'أوقات الحصص اليومية' : 'Daily Class Times'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">{isRTL ? 'وقت البدء *' : 'Start Time *'}</label>
              <input
                type="time"
                className="form-input"
                value={formData.periodStartTime}
                onChange={(e) => onChange({ periodStartTime: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{isRTL ? 'وقت الانتهاء *' : 'End Time *'}</label>
              <input
                type="time"
                className="form-input"
                value={formData.periodEndTime}
                onChange={(e) => onChange({ periodEndTime: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Summary */}
        {canProceed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: '12px',
              padding: '16px',
              marginTop: '16px',
              textAlign: 'center'
            }}
          >
            <span style={{ color: '#065f46', fontSize: '14px', fontWeight: '600' }}>
              {isRTL ? `الفترة: من ${formData.periodStartDate} إلى ${formData.periodEndDate}` : `Period: ${formData.periodStartDate} to ${formData.periodEndDate}`}
              {' | '}
              {isRTL ? `الوقت: ${formData.periodStartTime} - ${formData.periodEndTime}` : `Time: ${formData.periodStartTime} - ${formData.periodEndTime}`}
            </span>
          </motion.div>
        )}
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
          style={{ background: canProceed ? 'linear-gradient(135deg, #2596be, #2ba8cc)' : undefined }}
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

export default ScheduleSelection;
