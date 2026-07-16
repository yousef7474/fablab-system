const { OvertimeRequest } = require('../models');

// Compute totalHours from the days array if the client didn't send one.
const sumDayHours = (days) => (Array.isArray(days) ? days : []).reduce(
  (s, d) => s + (Number(d?.hours) || 0), 0
);

exports.listOvertime = async (req, res) => {
  try {
    const rows = await OvertimeRequest.findAll({ order: [['createdAt', 'DESC']] });
    res.json(rows);
  } catch (err) {
    console.error('listOvertime:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getOvertime = async (req, res) => {
  try {
    const row = await OvertimeRequest.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    res.json(row);
  } catch (err) {
    console.error('getOvertime:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createOvertime = async (req, res) => {
  try {
    const {
      employeeName, nationalId, phone, email, position,
      periodStart, periodEnd, note, days
    } = req.body;

    if (!employeeName) {
      return res.status(400).json({ message: 'employeeName is required' });
    }
    const normalizedDays = Array.isArray(days) ? days : [];
    const totalHours = Number(req.body.totalHours) > 0
      ? Number(req.body.totalHours)
      : sumDayHours(normalizedDays);

    const row = await OvertimeRequest.create({
      employeeName,
      nationalId: nationalId || null,
      phone: phone || null,
      email: email || null,
      position: position || null,
      periodStart: periodStart || null,
      periodEnd: periodEnd || null,
      note: note || null,
      days: normalizedDays,
      totalHours,
      createdById: req.user?.userId || req.user?.id || null
    });
    res.status(201).json(row);
  } catch (err) {
    console.error('createOvertime:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.updateOvertime = async (req, res) => {
  try {
    const row = await OvertimeRequest.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });

    const payload = { ...req.body };
    if (Array.isArray(payload.days) && !(Number(payload.totalHours) > 0)) {
      payload.totalHours = sumDayHours(payload.days);
    }
    await row.update(payload);
    res.json(row);
  } catch (err) {
    console.error('updateOvertime:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.deleteOvertime = async (req, res) => {
  try {
    const row = await OvertimeRequest.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    await row.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('deleteOvertime:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
