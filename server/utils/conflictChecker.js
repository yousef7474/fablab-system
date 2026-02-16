const { Registration, Task, User, Settings } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment');
const { findActiveOverrideForDate } = require('../controllers/workingHoursOverrideController');

// Helper to fetch working hours from DB with fallback defaults
// If a date is provided, checks for an active override first
const getWorkingHoursSettings = async (date) => {
  try {
    // Check for active override for the given date
    if (date) {
      const override = await findActiveOverrideForDate(date);
      if (override) {
        const [startH, startM] = override.startTime.split(':').map(Number);
        const [endH, endM] = override.endTime.split(':').map(Number);
        const startMinutes = startH * 60 + (startM || 0);
        const endMinutes = endH * 60 + (endM || 0);

        return {
          startHour: startH, endHour: endH,
          startMinutes, endMinutes,
          startTime: override.startTime, endTime: override.endTime,
          workingDays: override.workingDays
        };
      }
    }

    const startSetting = await Settings.findByPk('working_hours_start');
    const endSetting = await Settings.findByPk('working_hours_end');
    const daysSetting = await Settings.findByPk('working_days');

    const startTime = startSetting ? startSetting.value : '11:00';
    const endTime = endSetting ? endSetting.value : '19:00';
    const workingDays = daysSetting ? daysSetting.value : [0, 1, 2, 3, 4];

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMinutes = startH * 60 + (startM || 0);
    const endMinutes = endH * 60 + (endM || 0);

    return { startHour: startH, endHour: endH, startMinutes, endMinutes, startTime, endTime, workingDays };
  } catch (error) {
    console.error('Error fetching working hours settings, using defaults:', error);
    return { startHour: 11, endHour: 19, startTime: '11:00', endTime: '19:00', workingDays: [0, 1, 2, 3, 4] };
  }
};

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
    // Include User to filter out Volunteer registrations
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
      },
      include: [{
        model: User,
        as: 'user',
        attributes: ['applicationType']
      }]
    });

    // Filter out Volunteer registrations - they don't block calendar slots
    const blockingRegistrations = registrations.filter(reg => {
      return reg.user?.applicationType !== 'Volunteer';
    });

    console.log(`Checking availability: section=${section}, date=${date}, time=${startTime}-${endTime}`);
    console.log(`Found ${registrations.length} existing registrations (${blockingRegistrations.length} blocking)`);

    // Check each non-volunteer registration for time overlap
    for (const reg of blockingRegistrations) {
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

    // Also check for employee tasks that block the calendar
    const tasks = await Task.findAll({
      where: {
        section: section,
        blocksCalendar: true,
        status: { [Op.notIn]: ['completed', 'cancelled'] },
        [Op.or]: [
          { dueDate: date },
          {
            [Op.and]: [
              { dueDate: { [Op.lte]: date } },
              { dueDateEnd: { [Op.gte]: date } }
            ]
          }
        ]
      }
    });

    console.log(`Found ${tasks.length} blocking tasks to check`);

    for (const task of tasks) {
      if (task.dueTime && task.dueTimeEnd) {
        const taskStartTime = normalizeTime(task.dueTime);
        const taskEndTime = normalizeTime(task.dueTimeEnd);

        if (doTimesOverlap(startTime, endTime, taskStartTime, taskEndTime)) {
          console.log(`Conflict found with task ${task.taskId}: ${taskStartTime}-${taskEndTime}`);
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
    // Fetch dynamic working hours from DB (with override support for this date)
    const workingHoursSettings = await getWorkingHoursSettings(date);
    const dayOfWeek = moment(date).day();

    // Check if it's a working day
    if (!workingHoursSettings.workingDays.includes(dayOfWeek)) {
      return []; // Not a working day
    }

    // Generate all possible 30-minute slots based on configured hours
    const slots = [];
    const startMin = workingHoursSettings.startMinutes;
    const endMin = workingHoursSettings.endMinutes;

    for (let m = startMin; m < endMin; m += 30) {
      const hour = Math.floor(m / 60);
      const minute = m % 60;
      const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      slots.push({
        time: timeStr,
        timeInMinutes: m,
        available: true
      });
    }

    // Get all registrations for this section and date
    // Include User to filter out Volunteer registrations (volunteers don't block calendar slots)
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
      },
      include: [{
        model: User,
        as: 'user',
        attributes: ['applicationType']
      }]
    });

    // Filter out Volunteer registrations - they don't block calendar slots for regular users
    const blockingRegistrations = registrations.filter(reg => {
      return reg.user?.applicationType !== 'Volunteer';
    });

    console.log(`Found ${registrations.length} registrations for section ${section} on ${date} (${blockingRegistrations.length} blocking, ${registrations.length - blockingRegistrations.length} volunteers excluded)`);

    // Mark unavailable slots (only from non-volunteer registrations)
    blockingRegistrations.forEach(reg => {
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

    // Also check for employee tasks that block the calendar
    const tasks = await Task.findAll({
      where: {
        section: section,
        blocksCalendar: true,
        status: { [Op.notIn]: ['completed', 'cancelled'] },
        [Op.or]: [
          { dueDate: date },
          {
            [Op.and]: [
              { dueDate: { [Op.lte]: date } },
              { dueDateEnd: { [Op.gte]: date } }
            ]
          }
        ]
      }
    });

    console.log(`Found ${tasks.length} blocking tasks for section ${section} on ${date}`);

    tasks.forEach(task => {
      if (task.dueTime && task.dueTimeEnd) {
        const taskStartTime = normalizeTime(task.dueTime);
        const taskEndTime = normalizeTime(task.dueTimeEnd);
        const startMinutes = timeToMinutes(taskStartTime);
        const endMinutes = timeToMinutes(taskEndTime);

        console.log(`Blocking slots from task: ${taskStartTime} (${startMinutes}min) to ${taskEndTime} (${endMinutes}min)`);

        slots.forEach(slot => {
          if (slot.timeInMinutes >= startMinutes && slot.timeInMinutes < endMinutes) {
            slot.available = false;
            console.log(`  Marking ${slot.time} as unavailable (task)`);
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
