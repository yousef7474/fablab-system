const { Registration } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment');

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

    // Query for conflicts
    const conflicts = await Registration.findAll({
      where: {
        ...whereClause,
        [Op.or]: [
          // For regular appointments
          {
            appointmentDate: date,
            appointmentTime: {
              [Op.between]: [startTime, endTime]
            }
          },
          // For volunteers
          {
            [Op.and]: [
              { startDate: { [Op.lte]: date } },
              { endDate: { [Op.gte]: date } },
              {
                [Op.or]: [
                  {
                    startTime: {
                      [Op.between]: [startTime, endTime]
                    }
                  },
                  {
                    endTime: {
                      [Op.between]: [startTime, endTime]
                    }
                  }
                ]
              }
            ]
          },
          // For visits
          {
            visitDate: date,
            [Op.or]: [
              {
                visitStartTime: {
                  [Op.between]: [startTime, endTime]
                }
              },
              {
                visitEndTime: {
                  [Op.between]: [startTime, endTime]
                }
              }
            ]
          }
        ]
      }
    });

    return conflicts.length === 0;
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

    // Mark unavailable slots
    registrations.forEach(reg => {
      let regStartTime, regEndTime;

      if (reg.appointmentTime) {
        regStartTime = reg.appointmentTime;
        const duration = reg.appointmentDuration || 60;
        const endMoment = moment(reg.appointmentTime, 'HH:mm').add(duration, 'minutes');
        regEndTime = endMoment.format('HH:mm');
      } else if (reg.startTime && reg.endTime) {
        regStartTime = reg.startTime;
        regEndTime = reg.endTime;
      } else if (reg.visitStartTime && reg.visitEndTime) {
        regStartTime = reg.visitStartTime;
        regEndTime = reg.visitEndTime;
      }

      if (regStartTime && regEndTime) {
        slots.forEach(slot => {
          if (slot.time >= regStartTime && slot.time < regEndTime) {
            slot.available = false;
          }
        });
      }
    });

    return slots.filter(slot => slot.available);
  } catch (error) {
    console.error('Error getting available time slots:', error);
    throw error;
  }
};

module.exports = {
  checkTimeSlotAvailability,
  getAvailableTimeSlots
};
