const { SummerTeacher, SummerTeacherRating, SummerProgram, Admin } = require('../models');

exports.list = async (req, res) => {
  try {
    const teachers = await SummerTeacher.findAll({
      where: { isActive: true },
      include: [
        { model: SummerTeacherRating, as: 'ratings', attributes: ['ratingId', 'type', 'points', 'criteria', 'notes', 'ratingDate', 'programId'] },
        { model: SummerProgram, as: 'programs', where: { isActive: true }, required: false, attributes: ['programId', 'name', 'startDate', 'endDate'] }
      ],
      order: [['name', 'ASC']]
    });
    // Compute summary points
    const withSummary = teachers.map(t => {
      const json = t.toJSON();
      const awards = (json.ratings || []).filter(r => r.type === 'award').reduce((s, r) => s + (r.points || 0), 0);
      const deductions = (json.ratings || []).filter(r => r.type === 'deduction').reduce((s, r) => s + (r.points || 0), 0);
      json.totalAwards = awards;
      json.totalDeductions = deductions;
      json.netPoints = awards - deductions;
      return json;
    });
    res.json(withSummary);
  } catch (err) {
    console.error('Error listing summer teachers:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, nationalId, phone, email, fablabSection, bio } = req.body || {};
    if (!name) {
      return res.status(400).json({ message: 'name is required', messageAr: 'الاسم مطلوب' });
    }
    const teacher = await SummerTeacher.create({
      name,
      nationalId: nationalId || null,
      phone: phone || null,
      email: email || null,
      fablabSection: fablabSection || null,
      bio: bio || null,
      createdById: req.admin?.adminId || null
    });
    res.status(201).json(teacher);
  } catch (err) {
    console.error('Error creating summer teacher:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const teacher = await SummerTeacher.findByPk(req.params.id);
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

    const fields = ['name', 'nationalId', 'phone', 'email', 'fablabSection', 'bio'];
    const patch = {};
    for (const f of fields) {
      if (req.body[f] !== undefined) patch[f] = req.body[f];
    }
    await teacher.update(patch);
    res.json(teacher);
  } catch (err) {
    console.error('Error updating summer teacher:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const teacher = await SummerTeacher.findByPk(req.params.id);
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
    await teacher.update({ isActive: false });
    res.json({ message: 'Teacher removed' });
  } catch (err) {
    console.error('Error deleting summer teacher:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============ Ratings ============

exports.addRating = async (req, res) => {
  try {
    const { teacherId, programId, type, points, criteria, notes, ratingDate } = req.body || {};
    if (!teacherId || !type || points == null) {
      return res.status(400).json({ message: 'teacherId, type and points are required' });
    }
    const rating = await SummerTeacherRating.create({
      teacherId,
      programId: programId || null,
      type,
      points: parseInt(points, 10),
      criteria: criteria || null,
      notes: notes || null,
      ratingDate: ratingDate || new Date().toISOString().slice(0, 10),
      createdById: req.admin?.adminId || null
    });
    res.status(201).json(rating);
  } catch (err) {
    console.error('Error adding teacher rating:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.deleteRating = async (req, res) => {
  try {
    const r = await SummerTeacherRating.findByPk(req.params.id);
    if (!r) return res.status(404).json({ message: 'Rating not found' });
    await r.destroy();
    res.json({ message: 'Rating deleted' });
  } catch (err) {
    console.error('Error deleting teacher rating:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
