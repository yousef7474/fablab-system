const { Settings } = require('../models');

// GET /api/settings/working-hours (public)
const getWorkingHours = async (req, res) => {
  try {
    const startTime = await Settings.findByPk('working_hours_start');
    const endTime = await Settings.findByPk('working_hours_end');
    const workingDays = await Settings.findByPk('working_days');

    res.json({
      startTime: startTime ? startTime.value : '11:00',
      endTime: endTime ? endTime.value : '19:00',
      workingDays: workingDays ? workingDays.value : [0, 1, 2, 3, 4]
    });
  } catch (error) {
    console.error('Error fetching working hours:', error);
    res.status(500).json({ message: 'Error fetching working hours' });
  }
};

// PUT /api/settings/working-hours (admin-protected)
const updateWorkingHours = async (req, res) => {
  try {
    const { startTime, endTime, workingDays } = req.body;

    // Validate startTime and endTime format (HH:mm)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return res.status(400).json({ message: 'Invalid time format. Use HH:mm.' });
    }

    // Validate startTime < endTime
    if (startTime >= endTime) {
      return res.status(400).json({ message: 'Start time must be before end time.' });
    }

    // Validate workingDays is an array of numbers 0-6
    if (!Array.isArray(workingDays) || workingDays.length === 0 ||
        !workingDays.every(d => Number.isInteger(d) && d >= 0 && d <= 6)) {
      return res.status(400).json({ message: 'Working days must be an array of integers 0-6.' });
    }

    await Settings.upsert({ key: 'working_hours_start', value: startTime });
    await Settings.upsert({ key: 'working_hours_end', value: endTime });
    await Settings.upsert({ key: 'working_days', value: workingDays });

    res.json({
      message: 'Working hours updated successfully',
      startTime,
      endTime,
      workingDays
    });
  } catch (error) {
    console.error('Error updating working hours:', error);
    res.status(500).json({ message: 'Error updating working hours' });
  }
};

module.exports = {
  getWorkingHours,
  updateWorkingHours
};
