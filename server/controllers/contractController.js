const { Contract } = require('../models');

exports.list = async (req, res) => {
  try {
    const where = {};
    if (req.query.templateId) where.templateId = req.query.templateId;

    const contracts = await Contract.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });
    res.json(contracts);
  } catch (err) {
    console.error('Error listing contracts:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const c = await Contract.findByPk(req.params.id);
    if (!c) return res.status(404).json({ message: 'Contract not found' });
    res.json(c);
  } catch (err) {
    console.error('Error fetching contract:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { templateId, title, data } = req.body || {};
    if (!templateId) {
      return res.status(400).json({ message: 'templateId is required' });
    }
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ message: 'data (form snapshot) is required' });
    }
    const contract = await Contract.create({
      templateId,
      title: title || null,
      data,
      createdById: req.admin?.adminId || null
    });
    res.status(201).json(contract);
  } catch (err) {
    console.error('Error creating contract:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const c = await Contract.findByPk(req.params.id);
    if (!c) return res.status(404).json({ message: 'Contract not found' });

    const patch = {};
    if (req.body.title !== undefined) patch.title = req.body.title || null;
    if (req.body.data !== undefined) {
      if (!req.body.data || typeof req.body.data !== 'object') {
        return res.status(400).json({ message: 'data must be an object' });
      }
      patch.data = req.body.data;
    }
    await c.update(patch);
    res.json(c);
  } catch (err) {
    console.error('Error updating contract:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const c = await Contract.findByPk(req.params.id);
    if (!c) return res.status(404).json({ message: 'Contract not found' });
    await c.destroy();
    res.json({ message: 'Contract deleted' });
  } catch (err) {
    console.error('Error deleting contract:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};
