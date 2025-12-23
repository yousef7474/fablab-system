import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import api from '../../../config/api';

const DateTimeSelection = ({ formData, onChange, onNext, onBack }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [bookedDates, setBookedDates] = useState([]);

  const handleChange = (field, value) => {
    onChange({ [field]: value });
  };

  // Fetch available slots when date and section are selected
  const fetchAvailableSlots = useCallback(async (date) => {
    if (!date || !formData.fablabSection) return;

    setLoadingSlots(true);
    try {
      const response = await api.get('/registration/available-slots', {
        params: { section: formData.fablabSection, date }
      });
      setAvailableSlots(response.data.slots || []);
    } catch (error) {
      console.error('Error fetching slots:', error);
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [formData.fablabSection]);

  useEffect(() => {
    const date = formData.appointmentDate || formData.visitDate;
    if (date) {
      fetchAvailableSlots(date);
    }
  }, [formData.appointmentDate, formData.visitDate, fetchAvailableSlots]);

  const canProceed = () => {
    if (['Beneficiary', 'Talented', 'Visitor'].includes(formData.applicationType)) {
      return formData.appointmentDate && formData.appointmentTime && formData.appointmentDuration;
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

  // Check if a date is a working day (Sunday-Thursday)
  const isWorkingDay = (date) => {
    const day = date.getDay();
    return day !== 5 && day !== 6; // Not Friday (5) or Saturday (6)
  };

  // Generate calendar days
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    // Add empty slots for days before first day of month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    // Add actual days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }

    return days;
  };

  const formatDateForInput = (date) => {
    return date.toISOString().split('T')[0];
  };

  const isDateSelectable = (date) => {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date > today && isWorkingDay(date);
  };

  const handleDateSelect = (date) => {
    if (!isDateSelectable(date)) return;
    const dateStr = formatDateForInput(date);

    if (['Beneficiary', 'Talented', 'Visitor'].includes(formData.applicationType)) {
      handleChange('appointmentDate', dateStr);
      handleChange('appointmentTime', ''); // Reset time when date changes
    } else if (formData.applicationType === 'FABLAB Visit') {
      handleChange('visitDate', dateStr);
      handleChange('visitStartTime', '');
      handleChange('visitEndTime', '');
    }
  };

  const handleTimeSlotSelect = (time) => {
    if (['Beneficiary', 'Talented', 'Visitor'].includes(formData.applicationType)) {
      handleChange('appointmentTime', time);
    } else if (formData.applicationType === 'FABLAB Visit') {
      if (!formData.visitStartTime) {
        handleChange('visitStartTime', time);
      } else {
        handleChange('visitEndTime', time);
      }
    }
  };

  const selectedDate = formData.appointmentDate || formData.visitDate || formData.startDate;

  const weekDays = isRTL
    ? ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const monthNames = isRTL
    ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const durationOptions = [
    { value: 30, labelEn: '30 minutes', labelAr: '30 دقيقة' },
    { value: 60, labelEn: '1 hour', labelAr: 'ساعة واحدة' },
    { value: 120, labelEn: '2 hours', labelAr: 'ساعتان' }
  ];

  return (
    <div className="datetime-selection">
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
            ? 'الأيام الخضراء متاحة للحجز. اختر يوماً ثم اختر الوقت المناسب.'
            : 'Green days are available for booking. Select a day, then choose your time slot.'}
        </span>
      </motion.div>

      {/* Calendar View for appointment types */}
      {['Beneficiary', 'Talented', 'Visitor', 'FABLAB Visit'].includes(formData.applicationType) && (
        <div className="booking-calendar-container">
          {/* Calendar */}
          <motion.div
            className="booking-calendar"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="calendar-nav-header">
              <button
                type="button"
                className="calendar-nav-btn"
                onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1))}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <h3 className="calendar-month-title">
                {monthNames[selectedMonth.getMonth()]} {selectedMonth.getFullYear()}
              </h3>
              <button
                type="button"
                className="calendar-nav-btn"
                onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>

            <div className="calendar-weekdays">
              {weekDays.map((day, i) => (
                <div key={i} className={`weekday ${i === 5 || i === 6 ? 'weekend' : ''}`}>
                  {day}
                </div>
              ))}
            </div>

            <div className="calendar-days-grid">
              {getDaysInMonth(selectedMonth).map((date, i) => {
                if (!date) return <div key={`empty-${i}`} className="calendar-day empty" />;

                const isSelectable = isDateSelectable(date);
                const isSelected = selectedDate === formatDateForInput(date);
                const isToday = formatDateForInput(date) === formatDateForInput(new Date());
                const isWeekend = date.getDay() === 5 || date.getDay() === 6;

                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    className={`calendar-day
                      ${isSelectable ? 'available' : 'unavailable'}
                      ${isSelected ? 'selected' : ''}
                      ${isToday ? 'today' : ''}
                      ${isWeekend ? 'weekend' : ''}`}
                    onClick={() => handleDateSelect(date)}
                    disabled={!isSelectable}
                  >
                    <span className="day-number">{date.getDate()}</span>
                  </button>
                );
              })}
            </div>

            <div className="calendar-legend">
              <div className="legend-item">
                <span className="legend-dot available"></span>
                <span>{isRTL ? 'متاح' : 'Available'}</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot unavailable"></span>
                <span>{isRTL ? 'غير متاح' : 'Unavailable'}</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot selected"></span>
                <span>{isRTL ? 'محدد' : 'Selected'}</span>
              </div>
            </div>
          </motion.div>

          {/* Time Slots */}
          {selectedDate && (
            <motion.div
              className="time-slots-section"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className="selected-date-display">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span>
                  {isRTL ? 'التاريخ المحدد: ' : 'Selected Date: '}
                  <strong>{new Date(selectedDate).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                </span>
              </div>

              <h4 className="time-slots-title">
                {isRTL ? 'اختر الوقت المتاح' : 'Select Available Time'}
              </h4>

              {loadingSlots ? (
                <div className="slots-loading">
                  <div className="loading-spinner"></div>
                  <span>{isRTL ? 'جاري تحميل المواعيد...' : 'Loading available times...'}</span>
                </div>
              ) : availableSlots.length > 0 ? (
                <div className="time-slots-grid">
                  {availableSlots.map((slot) => {
                    const isSelected = formData.appointmentTime === slot.time ||
                      formData.visitStartTime === slot.time ||
                      formData.visitEndTime === slot.time;

                    return (
                      <button
                        key={slot.time}
                        type="button"
                        className={`time-slot ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleTimeSlotSelect(slot.time)}
                      >
                        {slot.time}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="no-slots-message">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                  <span>{isRTL ? 'لا توجد مواعيد متاحة في هذا اليوم' : 'No available slots for this day'}</span>
                </div>
              )}

              {/* Selected Time Confirmation */}
              {formData.appointmentTime && (
                <motion.div
                  className="time-selected-message success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  <span>
                    {isRTL
                      ? `تم اختيار الوقت: ${formData.appointmentTime} - هذا الوقت متاح للحجز`
                      : `Time selected: ${formData.appointmentTime} - This slot is available`}
                  </span>
                </motion.div>
              )}

              {/* Duration Selection for Beneficiary/Talented/Visitor */}
              {['Beneficiary', 'Talented', 'Visitor'].includes(formData.applicationType) && formData.appointmentTime && (
                <motion.div
                  className="duration-selection"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <h4 className="duration-title">
                    {isRTL ? 'اختر مدة الموعد' : 'Select Duration'}
                  </h4>
                  <div className="duration-options">
                    {durationOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`duration-option ${formData.appointmentDuration === option.value ? 'selected' : ''}`}
                        onClick={() => handleChange('appointmentDuration', option.value)}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        <span>{isRTL ? option.labelAr : option.labelEn}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* FABLAB Visit - show selected time range */}
              {formData.applicationType === 'FABLAB Visit' && (
                <div className="visit-time-summary">
                  <p>
                    {isRTL ? 'وقت البداية: ' : 'Start Time: '}
                    <strong>{formData.visitStartTime || (isRTL ? 'لم يتم التحديد' : 'Not selected')}</strong>
                  </p>
                  <p>
                    {isRTL ? 'وقت النهاية: ' : 'End Time: '}
                    <strong>{formData.visitEndTime || (isRTL ? 'لم يتم التحديد' : 'Not selected')}</strong>
                  </p>
                  {formData.visitStartTime && !formData.visitEndTime && (
                    <p className="hint">{isRTL ? 'اختر وقت النهاية' : 'Now select an end time'}</p>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </div>
      )}

      {/* Volunteer date range selection */}
      {formData.applicationType === 'Volunteer' && (
        <div className="form-grid">
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
        </div>
      )}

      <div className="form-navigation">
        <button className="btn btn-secondary" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }}>
            <path d="m15 18-6-6 6-6"/>
          </svg>
          {isRTL ? 'السابق' : 'Previous'}
        </button>
        <button
          className="btn btn-primary"
          onClick={onNext}
          disabled={!canProceed()}
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

export default DateTimeSelection;
