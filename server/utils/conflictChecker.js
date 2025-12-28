const { Registration } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment');

// Helper to normalize time to HH:mm format
const normalizeTime = (time) => {
  if (!time) return null;
  // Handle both "HH:mm" and "HH:mm:ss" formats
  const parts = time.toString().split(':');
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
};

// Convert time string to minutes since midnight for proper comparison
const timeToMinutes = (time) => {
  if (!time) return 0;
  const normalized = normalizeTime(time);
  const [hours, minutes] = normalized.split(':').map(Number);
  return hours * 60 + minutes;
};

// Check if two time ranges overlap
const doTimesOverlap = (start1, end1, start2, end2) => {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);

  // Two ranges overlap if one starts before the other ends
  return s1 < e2 && s2 < e1;
};

// Check if time slot is available for a given section
const checkTimeSlotAvailability = async (section, date, startTime, endTime, excludeRegistrationId = null) => {
  try {
    // Build where clause
    const whereClause = {
      fablabSection: section,
      status: { [Op.in]: ['pending', 'approved', 'on-hold'] }
    };

    // Exclude specific registration (for updates)
    if (excludeRegistrationId) {
      whereClause.registrationId = { [Op.ne]: excludeRegistrationId };
    }

    // Get all registrations for this section that might conflict
    const registrations = await Registration.findAll({
      where: {
        ...whereClause,
        [Op.or]: [
          { appointmentDate: date },
          {
            [Op.and]: [
              { startDate: { [Op.lte]: date } },
              { endDate: { [Op.gte]: date } }
            ]
          },
          { visitDate: date }
        ]
      }
    });

    console.log(`Checking availability: section=${section}, date=${date}, time=${startTime}-${endTime}`);
    console.log(`Found ${registrations.length} existing registrations to check`);

    // Check each registration for time overlap
    for (const reg of registrations) {
      let regStartTime, regEndTime;

      if (reg.appointmentTime) {
        regStartTime = normalizeTime(reg.appointmentTime);
        const duration = reg.appointmentDuration || 60;
        const endMoment = moment(regStartTime, 'HH:mm').add(duration, 'minutes');
        regEndTime = endMoment.format('HH:mm');
      } else if (reg.startTime && reg.endTime) {
        regStartTime = normalizeTime(reg.startTime);
        regEndTime = normalizeTime(reg.endTime);
      } else if (reg.visitStartTime && reg.visitEndTime) {
        regStartTime = normalizeTime(reg.visitStartTime);
        regEndTime = normalizeTime(reg.visitEndTime);
      }

      if (regStartTime && regEndTime) {
        if (doTimesOverlap(startTime, endTime, regStartTime, regEndTime)) {
          console.log(`Conflict found with registration ${reg.registrationId}: ${regStartTime}-${regEndTime}`);
          return false;
        }
      }
    }

    console.log('No conflicts found, slot is available');
    return true;
  } catch (error) {
    console.error('Error checking time slot availability:', error);
    throw error;
  }
};

// Get available time slots for a specific section and date
const getAvailableTimeSlots = async (section, date) => {
  try {
    // Working hours: Sunday to Thursday, 8 AM to 3 PM
    const dayOfWeek = moment(date).day();

    // Check if it's a working day (Sunday=0, Thursday=4 in moment.js)
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      return []; // Friday and Saturday are not working days
    }

    // Generate all possible 30-minute slots from 8 AM to 3 PM
    const slots = [];
    const startHour = 8;
    const endHour = 15; // 3 PM

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        slots.push({
          time: timeStr,
          timeInMinutes: hour * 60 + minute,
          available: true
        });
      }
    }

    // Get all registrations for this section and date
    const registrations = await Registration.findAll({
      where: {
        fablabSection: section,
        status: { [Op.in]: ['pending', 'approved', 'on-hold'] },
        [Op.or]: [
          { appointmentDate: date },
          {
            [Op.and]: [
              { startDate: { [Op.lte]: date } },
              { endDate: { [Op.gte]: date } }
            ]
          },
          { visitDate: date }
        ]
      }
    });

    console.log(`Found ${registrations.length} registrations for section ${section} on ${date}`);

    // Mark unavailable slots
    registrations.forEach(reg => {
      let regStartTime, regEndTime;

      if (reg.appointmentTime) {
        regStartTime = normalizeTime(reg.appointmentTime);
        const duration = reg.appointmentDuration || 60;
        const endMoment = moment(regStartTime, 'HH:mm').add(duration, 'minutes');
        regEndTime = endMoment.format('HH:mm');
      } else if (reg.startTime && reg.endTime) {
        regStartTime = normalizeTime(reg.startTime);
        regEndTime = normalizeTime(reg.endTime);
      } else if (reg.visitStartTime && reg.visitEndTime) {
        regStartTime = normalizeTime(reg.visitStartTime);
        regEndTime = normalizeTime(reg.visitEndTime);
      }

      if (regStartTime && regEndTime) {
        const startMinutes = timeToMinutes(regStartTime);
        const endMinutes = timeToMinutes(regEndTime);

        console.log(`Blocking slots from ${regStartTime} (${startMinutes}min) to ${regEndTime} (${endMinutes}min)`);

        slots.forEach(slot => {
          // Check if slot falls within the booked time range
          if (slot.timeInMinutes >= startMinutes && slot.timeInMinutes < endMinutes) {
            slot.available = false;
            console.log(`  Marking ${slot.time} as unavailable`);
          }
        });
      }
    });

    const availableSlots = slots.filter(slot => slot.available).map(slot => ({
      time: slot.time,
      available: true
    }));

    console.log(`Returning ${availableSlots.length} available slots`);

    return availableSlots;
  } catch (error) {
    console.error('Error getting available time slots:', error);
    throw error;
  }
};

module.exports = {
  checkTimeSlotAvailability,
  getAvailableTimeSlots
};
