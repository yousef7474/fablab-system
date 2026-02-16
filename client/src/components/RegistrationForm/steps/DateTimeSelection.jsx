import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import api from '../../../config/api';

// Helper function to format time as AM/PM
const formatTimeAMPM = (time24) => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
};

const DateTimeSelection = ({ formData, onChange, onNext, onBack }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [bookedDates, setBookedDates] = useState([]);
  const [sectionDeactivations, setSectionDeactivations] = useState([]);
  const [workingHours, setWorkingHours] = useState({ startTime: '11:00', endTime: '19:00', workingDays: [0, 1, 2, 3, 4] });

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

  // Fetch working hours settings
  useEffect(() => {
    const fetchWorkingHours = async () => {
      try {
        const response = await api.get('/settings/working-hours');
        setWorkingHours(response.data);
      } catch (error) {
        console.error('Error fetching working hours:', error);
      }
    };
    fetchWorkingHours();
  }, []);

  // Fetch section deactivation periods
  useEffect(() => {
    const fetchSectionDeactivations = async () => {
      if (!formData.fablabSection) return;

      try {
        const response = await api.get('/sections/availability');
        const sectionData = response.data.find(s => s.section === formData.fablabSection);
        // Use deactivationPeriods array which includes all active deactivations (including future ones)
        if (sectionData && sectionData.deactivationPeriods && sectionData.deactivationPeriods.length > 0) {
          setSectionDeactivations(sectionData.deactivationPeriods);
        } else {
          setSectionDeactivations([]);
        }
      } catch (error) {
        console.error('Error fetching section deactivations:', error);
        setSectionDeactivations([]);
      }
    };

    fetchSectionDeactivations();
  }, [formData.fablabSection]);

  // Check if a date falls within a section deactivation period
  const isDateInDeactivationPeriod = (date) => {
    if (!date || sectionDeactivations.length === 0) return false;

    const dateStr = formatDateForInput(date);

    return sectionDeactivations.some(deactivation => {
      const startStr = String(deactivation.startDate).substring(0, 10);
      const endStr = String(deactivation.endDate).substring(0, 10);
      return dateStr >= startStr && dateStr <= endStr;
    });
  };

  // Get deactivation info for a date
  const getDeactivationInfo = (date) => {
    if (!date || sectionDeactivations.length === 0) return null;

    const dateStr = formatDateForInput(date);

    return sectionDeactivations.find(deactivation => {
      const startStr = String(deactivation.startDate).substring(0, 10);
      const endStr = String(deactivation.endDate).substring(0, 10);
      return dateStr >= startStr && dateStr <= endStr;
    });
  };

  const canProceed = () => {
    if (['Beneficiary', 'Talented', 'Visitor'].includes(formData.applicationType)) {
      return formData.appointmentDate && formData.appointmentTime && formData.appointmentDuration;
    } else if (formData.applicationType === 'Volunteer') {
      return formData.startDate && formData.endDate && formData.startTime && formData.endTime &&
             formData.volunteerSection && formData.volunteerSkills;
    } else if (formData.applicationType === 'FABLAB Visit') {
      return formData.visitDate && formData.visitStartTime && formData.visitEndTime;
    }
    return false;
  };

  const getMinDate = () => {
    const today = new Date();
    // Allow same-day registration
    return today.toISOString().split('T')[0];
  };

  // Check if a date is a working day (dynamic from settings)
  const isWorkingDay = (date) => {
    const day = date.getDay();
    return workingHours.workingDays.includes(day);
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
    // Use local time instead of UTC to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isSameDay = (date1, date2) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  const isDateSelectable = (date) => {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateToCheck = new Date(date);
    dateToCheck.setHours(0, 0, 0, 0);

    // Check basic conditions: today or future date and working day
    if (dateToCheck < today || !isWorkingDay(date)) return false;

    // Check if date falls within a section deactivation period
    if (isDateInDeactivationPeriod(date)) return false;

    return true;
  };

  const handleDateSelect = (date) => {
    if (!isDateSelectable(date)) return;
    const dateStr = formatDateForInput(date);

    if (['Beneficiary', 'Talented', 'Visitor'].includes(formData.applicationType)) {
      // Update both fields at once to prevent state override
      onChange({
        appointmentDate: dateStr,
        appointmentTime: '' // Reset time when date changes
      });
    } else if (formData.applicationType === 'FABLAB Visit') {
      onChange({
        visitDate: dateStr,
        visitStartTime: '',
        visitEndTime: ''
      });
    }
  };

  // Check if a time slot is available for a given duration
  const isSlotAvailableForDuration = (startTime, duration) => {
    if (!startTime || !duration || availableSlots.length === 0) return true;

    // Convert start time to minutes
    const [startHour, startMin] = startTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = startMinutes + duration;

    // Check if all 30-minute slots within the duration are available
    for (let m = startMinutes; m < endMinutes; m += 30) {
      const slotHour = Math.floor(m / 60);
      const slotMin = m % 60;
      const slotTime = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;

      const slot = availableSlots.find(s => s.time === slotTime);
      if (!slot || !slot.available) {
        return false;
      }
    }
    return true;
  };

  // Get end time for display
  const getEndTime = (startTime, duration) => {
    if (!startTime || !duration) return '';
    const [hours, mins] = startTime.split(':').map(Number);
    const totalMins = hours * 60 + mins + duration;
    const endHours = Math.floor(totalMins / 60);
    const endMins = totalMins % 60;
    return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
  };

  const handleTimeSlotSelect = (time) => {
    if (['Beneficiary', 'Talented', 'Visitor'].includes(formData.applicationType)) {
      // Clear duration when time changes, user needs to re-select
      onChange({
        appointmentTime: time,
        appointmentDuration: ''
      });
    } else if (formData.applicationType === 'FABLAB Visit') {
      if (!formData.visitStartTime) {
        handleChange('visitStartTime', time);
      } else {
        handleChange('visitEndTime', time);
      }
    }
  };

  const handleDurationSelect = (duration) => {
    // Check if the selected time + duration is available
    if (!isSlotAvailableForDuration(formData.appointmentTime, duration)) {
      // Show warning - this duration would overlap with an existing booking
      alert(isRTL
        ? 'هذه المدة غير متاحة - تتداخل مع حجز آخر. يرجى اختيار مدة أقصر أو وقت مختلف.'
        : 'This duration is not available - it overlaps with another booking. Please select a shorter duration or different time.');
      return;
    }
    handleChange('appointmentDuration', duration);
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
        {isRTL
          ? `أوقات العمل: ${(() => { const dayNamesAr = ['أحد','إثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت']; const sorted = [...workingHours.workingDays].sort(); return sorted.length > 0 ? `${dayNamesAr[sorted[0]]} - ${dayNamesAr[sorted[sorted.length-1]]}` : ''; })()}، ${formatTimeAMPM(workingHours.startTime)} - ${formatTimeAMPM(workingHours.endTime)}`
          : `Working hours: ${(() => { const dayNamesEn = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']; const sorted = [...workingHours.workingDays].sort(); return sorted.length > 0 ? `${dayNamesEn[sorted[0]]} - ${dayNamesEn[sorted[sorted.length-1]]}` : ''; })()}, ${formatTimeAMPM(workingHours.startTime)} - ${formatTimeAMPM(workingHours.endTime)}`}
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
                <div key={i} className={`weekday ${!workingHours.workingDays.includes(i) ? 'weekend' : ''}`}>
                  {day}
                </div>
              ))}
            </div>

            <div className="calendar-days-grid">
              {getDaysInMonth(selectedMonth).map((date, i) => {
                if (!date) return <div key={`empty-${i}`} className="calendar-day empty" />;

                const isSelectable = isDateSelectable(date);
                const isSelected = selectedDate === formatDateForInput(date);
                const isToday = isSameDay(date, new Date());
                const isWeekend = !workingHours.workingDays.includes(date.getDay());
                const isDeactivated = isDateInDeactivationPeriod(date);
                const deactivationInfo = isDeactivated ? getDeactivationInfo(date) : null;

                return (
                  <button
                    key={formatDateForInput(date)}
                    type="button"
                    className={`calendar-day
                      ${isSelectable ? 'available' : 'unavailable'}
                      ${isSelected ? 'selected' : ''}
                      ${isToday ? 'today' : ''}
                      ${isWeekend ? 'weekend' : ''}
                      ${isDeactivated ? 'section-deactivated' : ''}`}
                    onClick={() => handleDateSelect(date)}
                    disabled={!isSelectable}
                    title={isDeactivated ? (isRTL ? deactivationInfo?.reasonAr || deactivationInfo?.reasonEn : deactivationInfo?.reasonEn) : ''}
                  >
                    <span className="day-number">{date.getDate()}</span>
                    {isDeactivated && <span className="deactivated-indicator">!</span>}
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
              {sectionDeactivations.length > 0 && (
                <div className="legend-item">
                  <span className="legend-dot section-closed"></span>
                  <span>{isRTL ? 'القسم مغلق' : 'Section Closed'}</span>
                </div>
              )}
            </div>

            {/* Section Deactivation Warning */}
            {sectionDeactivations.length > 0 && (
              <motion.div
                className="section-deactivation-warning"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <div className="warning-content">
                  <strong>{isRTL ? 'ملاحظة:' : 'Notice:'}</strong>
                  <span>
                    {isRTL
                      ? `القسم المحدد (${formData.fablabSection}) غير متاح في الفترة من ${new Date(sectionDeactivations[0].startDate).toLocaleDateString('ar-SA')} إلى ${new Date(sectionDeactivations[0].endDate).toLocaleDateString('ar-SA')}. السبب: ${sectionDeactivations[0].reasonAr || sectionDeactivations[0].reasonEn}`
                      : `The selected section (${formData.fablabSection}) is unavailable from ${new Date(sectionDeactivations[0].startDate).toLocaleDateString('en-US')} to ${new Date(sectionDeactivations[0].endDate).toLocaleDateString('en-US')}. Reason: ${sectionDeactivations[0].reasonEn}`}
                  </span>
                </div>
              </motion.div>
            )}
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
                        {formatTimeAMPM(slot.time)}
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
                    {formData.appointmentDuration
                      ? (isRTL
                          ? `تم اختيار الموعد: ${formatTimeAMPM(formData.appointmentTime)} - ${formatTimeAMPM(getEndTime(formData.appointmentTime, formData.appointmentDuration))}`
                          : `Appointment: ${formatTimeAMPM(formData.appointmentTime)} - ${formatTimeAMPM(getEndTime(formData.appointmentTime, formData.appointmentDuration))}`)
                      : (isRTL
                          ? `تم اختيار الوقت: ${formatTimeAMPM(formData.appointmentTime)} - يرجى اختيار المدة`
                          : `Time selected: ${formatTimeAMPM(formData.appointmentTime)} - Please select duration`)}
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
                        onClick={() => handleDurationSelect(option.value)}
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
                    <strong>{formData.visitStartTime ? formatTimeAMPM(formData.visitStartTime) : (isRTL ? 'لم يتم التحديد' : 'Not selected')}</strong>
                  </p>
                  <p>
                    {isRTL ? 'وقت النهاية: ' : 'End Time: '}
                    <strong>{formData.visitEndTime ? formatTimeAMPM(formData.visitEndTime) : (isRTL ? 'لم يتم التحديد' : 'Not selected')}</strong>
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
              min={workingHours.startTime}
              max={workingHours.endTime}
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
              min={workingHours.startTime}
              max={workingHours.endTime}
            />
          </motion.div>

          {/* Volunteer Section Selection */}
          <motion.div
            className="form-group full-width"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <label className="form-label">
              {isRTL ? 'اختر مجال التطوع' : 'Select Volunteer Section'} <span className="required">*</span>
            </label>
            <select
              className="form-select"
              value={formData.volunteerSection || ''}
              onChange={(e) => handleChange('volunteerSection', e.target.value)}
            >
              <option value="">{isRTL ? 'اختر المجال' : 'Select section'}</option>
              <option value="Electronics and Programming">{isRTL ? 'الإلكترونيات والبرمجة' : 'Electronics and Programming'}</option>
              <option value="CNC Laser">{isRTL ? 'الليزر CNC' : 'CNC Laser'}</option>
              <option value="CNC Wood">{isRTL ? 'الخشب CNC' : 'CNC Wood'}</option>
              <option value="3D">{isRTL ? 'الطباعة ثلاثية الأبعاد' : '3D Printing'}</option>
              <option value="Robotic and AI">{isRTL ? 'الروبوتات والذكاء الاصطناعي' : 'Robotic and AI'}</option>
              <option value="Kid's Club">{isRTL ? 'نادي الأطفال' : "Kid's Club"}</option>
              <option value="Vinyl Cutting">{isRTL ? 'قص الفينيل' : 'Vinyl Cutting'}</option>
              <option value="General">{isRTL ? 'عام / متعدد الأقسام' : 'General / Multiple Sections'}</option>
            </select>
          </motion.div>

          {/* Volunteer Skills and Experience */}
          <motion.div
            className="form-group full-width"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <label className="form-label">
              {isRTL ? 'اذكر خبراتك ومهاراتك' : 'Describe Your Skills and Experience'} <span className="required">*</span>
            </label>
            <textarea
              className="form-textarea"
              value={formData.volunteerSkills || ''}
              onChange={(e) => handleChange('volunteerSkills', e.target.value)}
              placeholder={isRTL ? 'اذكر خبراتك ومهاراتك السابقة في هذا المجال...' : 'Describe your previous experience and skills in this field...'}
              rows={4}
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
