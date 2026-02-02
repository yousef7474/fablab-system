const { EliteSchedule, EliteUser, Admin } = require('../models');
const { Op } = require('sequelize');

// GET /api/elite/schedules - Get all schedules (admin)
exports.getAllSchedules = async (req, res) => {
  try {
    const { eliteId, type, status, startDate, endDate } = req.query;

    const whereClause = {};
    if (eliteId) whereClause.eliteId = eliteId;
    if (type) whereClause.type = type;
    if (status) whereClause.status = status;
    if (startDate && endDate) {
      whereClause.date = {
        [Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      whereClause.date = {
        [Op.gte]: startDate
      };
    }

    const schedules = await EliteSchedule.findAll({
      where: whereClause,
      include: [
        { model: EliteUser, as: 'eliteUser', attributes: ['eliteId', 'firstName', 'lastName', 'uniqueId'] },
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
      ],
      order: [['date', 'ASC'], ['startTime', 'ASC']]
    });

    res.json(schedules);
  } catch (error) {
    console.error('Error fetching elite schedules:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /api/elite/schedules/user/:eliteId - Get schedules for specific user
exports.getSchedulesByEliteId = async (req, res) => {
  try {
    const { eliteId } = req.params;
    const { startDate, endDate, status } = req.query;

    const whereClause = { eliteId };
    if (status) whereClause.status = status;
    if (startDate && endDate) {
      whereClause.date = {
        [Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      whereClause.date = {
        [Op.gte]: startDate
      };
    }

    const schedules = await EliteSchedule.findAll({
      where: whereClause,
      include: [
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
      ],
      order: [['date', 'ASC'], ['startTime', 'ASC']]
    });

    // Group by date for calendar view
    const byDate = {};
    schedules.forEach(schedule => {
      const dateKey = schedule.date;
      if (!byDate[dateKey]) {
        byDate[dateKey] = [];
      }
      byDate[dateKey].push(schedule);
    });

    res.json({ schedules, byDate });
  } catch (error) {
    console.error('Error fetching user schedules:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /api/elite/schedules/upcoming/:eliteId - Get upcoming schedules
exports.getUpcomingSchedules = async (req, res) => {
  try {
    const { eliteId } = req.params;
    const { limit } = req.query;

    const today = new Date().toISOString().split('T')[0];

    const schedules = await EliteSchedule.findAll({
      where: {
        eliteId,
        date: { [Op.gte]: today },
        status: 'scheduled'
      },
      include: [
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
      ],
      order: [['date', 'ASC'], ['startTime', 'ASC']],
      limit: parseInt(limit) || 10
    });

    res.json(schedules);
  } catch (error) {
    console.error('Error fetching upcoming schedules:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /api/elite/schedules/:scheduleId - Get single schedule
exports.getScheduleById = async (req, res) => {
  try {
    const { scheduleId } = req.params;

    const schedule = await EliteSchedule.findByPk(scheduleId, {
      include: [
        { model: EliteUser, as: 'eliteUser', attributes: ['eliteId', 'firstName', 'lastName', 'uniqueId', 'email'] },
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
      ]
    });

    if (!schedule) {
      return res.status(404).json({
        message: 'Schedule not found',
        messageAr: 'الجدول غير موجود'
      });
    }

    res.json(schedule);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// POST /api/elite/schedules - Create schedule
exports.createSchedule = async (req, res) => {
  try {
    const {
      eliteId,
      title,
      description,
      type,
      date,
      startTime,
      endTime,
      isAllDay,
      isRecurring,
      recurrencePattern,
      recurrenceEndDate,
      location,
      isOnline,
      onlineLink,
      notes,
      color
    } = req.body;

    // Validation
    if (!eliteId || !title || !date) {
      return res.status(400).json({
        message: 'Elite ID, title, and date are required',
        messageAr: 'معرف العضو والعنوان والتاريخ مطلوبون'
      });
    }

    // Check if elite user exists
    const eliteUser = await EliteUser.findByPk(eliteId);
    if (!eliteUser) {
      return res.status(404).json({
        message: 'Elite user not found',
        messageAr: 'المستخدم غير موجود'
      });
    }

    const schedule = await EliteSchedule.create({
      eliteId,
      createdById: req.admin.adminId,
      title,
      description,
      type: type || 'session',
      date,
      startTime,
      endTime,
      isAllDay: isAllDay || false,
      isRecurring: isRecurring || false,
      recurrencePattern: isRecurring ? recurrencePattern : null,
      recurrenceEndDate: isRecurring ? recurrenceEndDate : null,
      location,
      isOnline: isOnline || false,
      onlineLink: isOnline ? onlineLink : null,
      notes,
      color: color || '#006c35'
    });

    // If recurring, create additional instances
    if (isRecurring && recurrencePattern && recurrenceEndDate) {
      const additionalSchedules = [];
      let currentDate = new Date(date);
      const endRecurrence = new Date(recurrenceEndDate);

      while (currentDate < endRecurrence) {
        if (recurrencePattern === 'daily') {
          currentDate.setDate(currentDate.getDate() + 1);
        } else if (recurrencePattern === 'weekly') {
          currentDate.setDate(currentDate.getDate() + 7);
        } else if (recurrencePattern === 'monthly') {
          currentDate.setMonth(currentDate.getMonth() + 1);
        }

        if (currentDate <= endRecurrence) {
          additionalSchedules.push({
            eliteId,
            createdById: req.admin.adminId,
            title,
            description,
            type: type || 'session',
            date: currentDate.toISOString().split('T')[0],
            startTime,
            endTime,
            isAllDay: isAllDay || false,
            isRecurring: true,
            recurrencePattern,
            recurrenceEndDate,
            location,
            isOnline: isOnline || false,
            onlineLink: isOnline ? onlineLink : null,
            notes,
            color: color || '#006c35'
          });
        }
      }

      if (additionalSchedules.length > 0) {
        await EliteSchedule.bulkCreate(additionalSchedules);
      }
    }

    const createdSchedule = await EliteSchedule.findByPk(schedule.scheduleId, {
      include: [
        { model: EliteUser, as: 'eliteUser', attributes: ['eliteId', 'firstName', 'lastName', 'uniqueId'] },
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
      ]
    });

    res.status(201).json({
      message: 'Schedule created successfully',
      messageAr: 'تم إنشاء الجدول بنجاح',
      schedule: createdSchedule
    });
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// PUT /api/elite/schedules/:scheduleId - Update schedule
exports.updateSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const updates = req.body;

    const schedule = await EliteSchedule.findByPk(scheduleId);
    if (!schedule) {
      return res.status(404).json({
        message: 'Schedule not found',
        messageAr: 'الجدول غير موجود'
      });
    }

    await schedule.update(updates);

    const updatedSchedule = await EliteSchedule.findByPk(scheduleId, {
      include: [
        { model: EliteUser, as: 'eliteUser', attributes: ['eliteId', 'firstName', 'lastName', 'uniqueId'] },
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
      ]
    });

    res.json({
      message: 'Schedule updated successfully',
      messageAr: 'تم تحديث الجدول بنجاح',
      schedule: updatedSchedule
    });
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// PATCH /api/elite/schedules/:scheduleId/status - Update schedule status
exports.updateScheduleStatus = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { status } = req.body;

    if (!['scheduled', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        message: 'Invalid status',
        messageAr: 'حالة غير صالحة'
      });
    }

    const schedule = await EliteSchedule.findByPk(scheduleId);
    if (!schedule) {
      return res.status(404).json({
        message: 'Schedule not found',
        messageAr: 'الجدول غير موجود'
      });
    }

    await schedule.update({ status });

    res.json({
      message: 'Schedule status updated',
      messageAr: 'تم تحديث حالة الجدول',
      schedule
    });
  } catch (error) {
    console.error('Error updating schedule status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// DELETE /api/elite/schedules/:scheduleId - Delete schedule
exports.deleteSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;

    const schedule = await EliteSchedule.findByPk(scheduleId);
    if (!schedule) {
      return res.status(404).json({
        message: 'Schedule not found',
        messageAr: 'الجدول غير موجود'
      });
    }

    await schedule.destroy();

    res.json({
      message: 'Schedule deleted successfully',
      messageAr: 'تم حذف الجدول بنجاح'
    });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = exports;
