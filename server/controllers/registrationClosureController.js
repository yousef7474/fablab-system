const { RegistrationClosure, Admin } = require('../models');
const { Op } = require('sequelize');

// GET /api/closures (public) — returns all active, non-expired closures
exports.list = async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const closures = await RegistrationClosure.findAll({
      where: { isActive: true, endDate: { [Op.gte]: today } },
      order: [['startDate', 'ASC']]
    });
    res.json(closures);
  } catch (err) {
    console.error('Error listing closures:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/closures/all (admin) — every closure incl. past/inactive
exports.listAll = async (req, res) => {
  try {
    const closures = await RegistrationClosure.findAll({
      include: [{ model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }],
      order: [['startDate', 'DESC']]
    });
    res.json(closures);
  } catch (err) {
    console.error('Error listing all closures:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/closures (admin)
exports.create = async (req, res) => {
  try {
    const { startDate, endDate, reasonEn, reasonAr } = req.body;
    if (!startDate || !endDate || !reasonEn) {
      return res.status(400).json({ message: 'startDate, endDate and reasonEn are required' });
    }
    if (startDate > endDate) {
      return res.status(400).json({ message: 'startDate must be on or before endDate' });
    }
    const closure = await RegistrationClosure.create({
      startDate, endDate, reasonEn,
      reasonAr: reasonAr || null,
      createdById: req.admin.adminId,
      isActive: true
    });
    res.status(201).json(closure);
  } catch (err) {
    console.error('Error creating closure:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

// DELETE /api/closures/:id (admin) — soft-delete by flipping isActive
exports.remove = async (req, res) => {
  try {
    const closure = await RegistrationClosure.findByPk(req.params.id);
    if (!closure) return res.status(404).json({ message: 'Closure not found' });
    await closure.update({ isActive: false });
    res.json({ message: 'Closure removed' });
  } catch (err) {
    console.error('Error removing closure:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
