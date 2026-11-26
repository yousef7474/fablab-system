import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { NavArrow } from './TeacherInfo';

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

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <div className="edu-panels">
          {/* Date Range */}
          <div className="edu-panel">
            <p className="edu-kicker">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {isRTL ? 'فترة التعليم' : 'Education Period'}
            </p>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">{isRTL ? 'تاريخ البدء' : 'Start Date'} <span className="required">*</span></label>
                <input
                  type="date"
                  className="form-input"
                  min={today}
                  value={formData.periodStartDate}
                  onChange={(e) => onChange({ periodStartDate: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{isRTL ? 'تاريخ الانتهاء' : 'End Date'} <span className="required">*</span></label>
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
          <div className="edu-panel">
            <p className="edu-kicker">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {isRTL ? 'أوقات الحصص اليومية' : 'Daily Class Times'}
            </p>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">{isRTL ? 'وقت البدء' : 'Start Time'} <span className="required">*</span></label>
                <input
                  type="time"
                  className="form-input"
                  value={formData.periodStartTime}
                  onChange={(e) => onChange({ periodStartTime: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{isRTL ? 'وقت الانتهاء' : 'End Time'} <span className="required">*</span></label>
                <input
                  type="time"
                  className="form-input"
                  value={formData.periodEndTime}
                  onChange={(e) => onChange({ periodEndTime: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        {canProceed && (
          <motion.div className="info-banner success" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            <span>
              {isRTL ? 'الفترة: من ' : 'Period: '}<bdi>{formData.periodStartDate}</bdi>{isRTL ? ' إلى ' : ' to '}<bdi>{formData.periodEndDate}</bdi>
              {' · '}
              {isRTL ? 'الوقت: ' : 'Time: '}<bdi dir="ltr">{formData.periodStartTime} – {formData.periodEndTime}</bdi>
            </span>
          </motion.div>
        )}
      </motion.div>

      <div className="form-navigation">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          <NavArrow dir="back" isRTL={isRTL} />
          {isRTL ? 'السابق' : 'Previous'}
        </button>
        <button type="button" className="btn btn-primary" onClick={onNext} disabled={!canProceed}>
          {isRTL ? 'التالي' : 'Next'}
          <NavArrow dir="next" isRTL={isRTL} />
        </button>
      </div>
    </div>
  );
};

export default ScheduleSelection;
