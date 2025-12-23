import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

const DateTimeSelection = ({ formData, onChange, onNext, onBack }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const handleChange = (field, value) => {
    onChange({ [field]: value });
  };

  const canProceed = () => {
    if (['Beneficiary', 'Talented', 'Visitor'].includes(formData.applicationType)) {
      return formData.appointmentDate && formData.appointmentTime;
    } else if (formData.applicationType === 'Volunteer') {
      return formData.startDate && formData.endDate && formData.startTime && formData.endTime;
    } else if (formData.applicationType === 'FABLAB Visit') {
      return formData.visitDate && formData.visitStartTime && formData.visitEndTime;
    }
    return false;
  };

  const getMinDate = () => {
    const today = new Date();
    today.setDate(today.getDate() + 1);
    return today.toISOString().split('T')[0];
  };

  return (
    <div>
      <h2 className="step-title">
        {isRTL ? 'اختيار الموعد' : 'Schedule Appointment'}
      </h2>
      <p className="step-description">
        {isRTL ? 'أوقات العمل: الأحد - الخميس، 8:00 صباحاً - 3:00 مساءً' : 'Working hours: Sunday - Thursday, 8:00 AM - 3:00 PM'}
      </p>

      <motion.div
        className="info-banner"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        <span>
          {isRTL
            ? 'يرجى اختيار موعد خلال ساعات العمل الرسمية'
            : 'Please select a time within official working hours'}
        </span>
      </motion.div>

      <div className="form-grid">
        {['Beneficiary', 'Talented', 'Visitor'].includes(formData.applicationType) && (
          <>
            <motion.div
              className="form-group"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <label className="form-label">
                {isRTL ? 'التاريخ' : 'Date'} <span className="required">*</span>
              </label>
              <input
                type="date"
                className="form-input"
                value={formData.appointmentDate || ''}
                onChange={(e) => handleChange('appointmentDate', e.target.value)}
                min={getMinDate()}
              />
            </motion.div>

            <motion.div
              className="form-group"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <label className="form-label">
                {isRTL ? 'الوقت' : 'Time'} <span className="required">*</span>
              </label>
              <input
                type="time"
                className="form-input"
                value={formData.appointmentTime || ''}
                onChange={(e) => handleChange('appointmentTime', e.target.value)}
                min="08:00"
                max="15:00"
              />
            </motion.div>

            <motion.div
              className="form-group"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <label className="form-label">
                {isRTL ? 'مدة الموعد (بالدقائق)' : 'Duration (minutes)'}
              </label>
              <select
                className="form-select"
                value={formData.appointmentDuration}
                onChange={(e) => handleChange('appointmentDuration', parseInt(e.target.value))}
              >
                <option value={30}>30 {isRTL ? 'دقيقة' : 'minutes'}</option>
                <option value={60}>60 {isRTL ? 'دقيقة' : 'minutes'}</option>
                <option value={90}>90 {isRTL ? 'دقيقة' : 'minutes'}</option>
                <option value={120}>120 {isRTL ? 'دقيقة' : 'minutes'}</option>
                <option value={180}>180 {isRTL ? 'دقيقة' : 'minutes'}</option>
                <option value={240}>240 {isRTL ? 'دقيقة' : 'minutes'}</option>
              </select>
            </motion.div>
          </>
        )}

        {formData.applicationType === 'Volunteer' && (
          <>
            <motion.div
              className="form-group"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <label className="form-label">
                {isRTL ? 'تاريخ البداية' : 'Start Date'} <span className="required">*</span>
              </label>
              <input
                type="date"
                className="form-input"
                value={formData.startDate || ''}
                onChange={(e) => handleChange('startDate', e.target.value)}
                min={getMinDate()}
              />
            </motion.div>

            <motion.div
              className="form-group"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <label className="form-label">
                {isRTL ? 'تاريخ النهاية' : 'End Date'} <span className="required">*</span>
              </label>
              <input
                type="date"
                className="form-input"
                value={formData.endDate || ''}
                onChange={(e) => handleChange('endDate', e.target.value)}
                min={formData.startDate || getMinDate()}
              />
            </motion.div>

            <motion.div
              className="form-group"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <label className="form-label">
                {isRTL ? 'وقت البداية' : 'Start Time'} <span className="required">*</span>
              </label>
              <input
                type="time"
                className="form-input"
                value={formData.startTime || ''}
                onChange={(e) => handleChange('startTime', e.target.value)}
                min="08:00"
                max="15:00"
              />
            </motion.div>

            <motion.div
              className="form-group"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <label className="form-label">
                {isRTL ? 'وقت النهاية' : 'End Time'} <span className="required">*</span>
              </label>
              <input
                type="time"
                className="form-input"
                value={formData.endTime || ''}
                onChange={(e) => handleChange('endTime', e.target.value)}
                min="08:00"
                max="15:00"
              />
            </motion.div>
          </>
        )}

        {formData.applicationType === 'FABLAB Visit' && (
          <>
            <motion.div
              className="form-group"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <label className="form-label">
                {isRTL ? 'تاريخ الزيارة' : 'Visit Date'} <span className="required">*</span>
              </label>
              <input
                type="date"
                className="form-input"
                value={formData.visitDate || ''}
                onChange={(e) => handleChange('visitDate', e.target.value)}
                min={getMinDate()}
              />
            </motion.div>

            <motion.div
              className="form-group"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <label className="form-label">
                {isRTL ? 'وقت بداية الزيارة' : 'Visit Start Time'} <span className="required">*</span>
              </label>
              <input
                type="time"
                className="form-input"
                value={formData.visitStartTime || ''}
                onChange={(e) => handleChange('visitStartTime', e.target.value)}
                min="08:00"
                max="15:00"
              />
            </motion.div>

            <motion.div
              className="form-group"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <label className="form-label">
                {isRTL ? 'وقت نهاية الزيارة' : 'Visit End Time'} <span className="required">*</span>
              </label>
              <input
                type="time"
                className="form-input"
                value={formData.visitEndTime || ''}
                onChange={(e) => handleChange('visitEndTime', e.target.value)}
                min="08:00"
                max="15:00"
              />
            </motion.div>
          </>
        )}
      </div>

      <div className="form-navigation">
        <button className="btn btn-secondary" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }}>
            <path d="m15 18-6-6 6-6"/>
          </svg>
          {t('previous')}
        </button>
        <button
          className="btn btn-primary"
          onClick={onNext}
          disabled={!canProceed()}
        >
          {t('next')}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }}>
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default DateTimeSelection;
