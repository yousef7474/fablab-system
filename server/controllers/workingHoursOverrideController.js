const { WorkingHoursOverride, Admin } = require('../models');
const { Op } = require('sequelize');

// Helper: find the active override that contains a given date
const findActiveOverrideForDate = async (dateString) => {
  const override = await WorkingHoursOverride.findOne({
    where: {
      isActive: true,
      startDate: { [Op.lte]: dateString },
      endDate: { [Op.gte]: dateString }
    },
    order: [['createdAt', 'DESC']]
  });
  return override;
};

// GET /active — public, returns all active overrides (for calendar display)
const getActiveOverrides = async (req, res) => {
  try {
    const overrides = await WorkingHoursOverride.findAll({
      where: { isActive: true },
      order: [['startDate', 'ASC']]
    });
    res.json(overrides);
  } catch (error) {
    console.error('Error fetching active overrides:', error);
    res.status(500).json({ message: 'Error fetching active overrides' });
  }
};

// GET / — admin, returns all overrides with creator info
const getAllOverrides = async (req, res) => {
  try {
    const overrides = await WorkingHoursOverride.findAll({
      include: [{
        model: Admin,
        as: 'creator',
        attributes: ['adminId', 'fullName', 'email']
      }],
      order: [['createdAt', 'DESC']]
    });
    res.json(overrides);
  } catch (error) {
    console.error('Error fetching all overrides:', error);
    res.status(500).json({ message: 'Error fetching overrides' });
  }
};

// POST / — admin, create a new override
const createOverride = async (req, res) => {
  try {
    let { startDate, endDate, startTime, endTime, workingDays, labelEn, labelAr } = req.body;

    // Validate required fields
    if (!startDate || !endDate || !startTime || !endTime || !workingDays || !labelEn) {
      return res.status(400).json({ message: 'Missing required fields: startDate, endDate, startTime, endTime, workingDays, labelEn' });
    }

    // Normalize time to HH:mm (pad single-digit hours)
    const normalizeTime = (t) => {
      const parts = t.split(':');
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    };
    startTime = normalizeTime(startTime);
    endTime = normalizeTime(endTime);

    // Validate time format
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return res.status(400).json({ message: 'Invalid time format. Use HH:mm.' });
    }

    // Validate startTime < endTime
    // Allow cross-midnight ranges (e.g. 21:00 to 00:30) — when endTime < startTime it means past midnight
    if (startTime === endTime) {
      return res.status(400).json({ message: 'Start time and end time cannot be the same.' });
    }

    // Validate dates
    if (startDate > endDate) {
      return res.status(400).json({ message: 'Start date must be before or equal to end date.' });
    }

    // Validate workingDays
    if (!Array.isArray(workingDays) || workingDays.length === 0 ||
        !workingDays.every(d => Number.isInteger(d) && d >= 0 && d <= 6)) {
      return res.status(400).json({ message: 'Working days must be an array of integers 0-6.' });
    }

    // Check for overlapping active overrides
    const overlapping = await WorkingHoursOverride.findOne({
      where: {
        isActive: true,
        startDate: { [Op.lte]: endDate },
        endDate: { [Op.gte]: startDate }
      }
    });

    if (overlapping) {
      return res.status(409).json({
        message: `Overlapping override exists: "${overlapping.labelEn}" (${overlapping.startDate} to ${overlapping.endDate})`,
        overlapping
      });
    }

    const override = await WorkingHoursOverride.create({
      startDate,
      endDate,
      startTime,
      endTime,
      workingDays,
      labelEn,
      labelAr: labelAr || null,
      createdById: req.admin.adminId
    });

    res.status(201).json(override);
  } catch (error) {
    console.error('Error creating override:', error);
    res.status(500).json({ message: 'Error creating override' });
  }
};

// DELETE /:id — admin, soft-delete by setting isActive: false
const deleteOverride = async (req, res) => {
  try {
    const { id } = req.params;
    const override = await WorkingHoursOverride.findByPk(id);

    if (!override) {
      return res.status(404).json({ message: 'Override not found' });
    }

    await override.update({ isActive: false });
    res.json({ message: 'Override deactivated successfully' });
  } catch (error) {
    console.error('Error deleting override:', error);
    res.status(500).json({ message: 'Error deleting override' });
  }
};

module.exports = {
  getActiveOverrides,
  getAllOverrides,
  createOverride,
  deleteOverride,
  findActiveOverrideForDate
};
