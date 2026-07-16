const { TrainerAssistant, TrainerAssignment } = require('../models');

// ---------- Trainer CRUD ----------

exports.listTrainers = async (req, res) => {
  try {
    const trainers = await TrainerAssistant.findAll({
      order: [['name', 'ASC']],
      include: [{ model: TrainerAssignment, as: 'assignments', separate: true, order: [['chanceDate', 'DESC']] }]
    });
    res.json(trainers);
  } catch (err) {
    console.error('listTrainers:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getTrainer = async (req, res) => {
  try {
    const trainer = await TrainerAssistant.findByPk(req.params.id, {
      include: [{ model: TrainerAssignment, as: 'assignments' }]
    });
    if (!trainer) return res.status(404).json({ message: 'Not found' });
    res.json(trainer);
  } catch (err) {
    console.error('getTrainer:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createTrainer = async (req, res) => {
  try {
    const trainer = await TrainerAssistant.create(req.body);
    res.status(201).json(trainer);
  } catch (err) {
    console.error('createTrainer:', err);
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'National ID already exists', messageAr: 'رقم الهوية موجود مسبقاً' });
    }
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.updateTrainer = async (req, res) => {
  try {
    const trainer = await TrainerAssistant.findByPk(req.params.id);
    if (!trainer) return res.status(404).json({ message: 'Not found' });
    await trainer.update(req.body);
    res.json(trainer);
  } catch (err) {
    console.error('updateTrainer:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.deleteTrainer = async (req, res) => {
  try {
    const trainer = await TrainerAssistant.findByPk(req.params.id);
    if (!trainer) return res.status(404).json({ message: 'Not found' });
    await TrainerAssignment.destroy({ where: { trainerId: trainer.trainerId } });
    await trainer.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('deleteTrainer:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---------- Assignment (chance) CRUD ----------

exports.listAssignments = async (req, res) => {
  try {
    const assignments = await TrainerAssignment.findAll({
      where: { trainerId: req.params.trainerId },
      order: [['chanceDate', 'DESC']]
    });
    res.json(assignments);
  } catch (err) {
    console.error('listAssignments:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createAssignment = async (req, res) => {
  try {
    const trainer = await TrainerAssistant.findByPk(req.params.trainerId);
    if (!trainer) return res.status(404).json({ message: 'Trainer not found' });
    if (!req.body.chanceName) {
      return res.status(400).json({ message: 'chanceName is required' });
    }
    const assignment = await TrainerAssignment.create({
      trainerId: trainer.trainerId,
      chanceName: req.body.chanceName,
      destination: req.body.destination || null,
      chanceDate: req.body.chanceDate || null,
      rating: req.body.rating || null,
      notes: req.body.notes || null
    });
    res.status(201).json(assignment);
  } catch (err) {
    console.error('createAssignment:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.updateAssignment = async (req, res) => {
  try {
    const assignment = await TrainerAssignment.findByPk(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Not found' });
    await assignment.update(req.body);
    res.json(assignment);
  } catch (err) {
    console.error('updateAssignment:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.deleteAssignment = async (req, res) => {
  try {
    const assignment = await TrainerAssignment.findByPk(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Not found' });
    await assignment.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('deleteAssignment:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
