const { SummerStudent, SummerProgram, Admin } = require('../models');

exports.list = async (req, res) => {
  try {
    const where = { isActive: true };
    if (req.query.programId) where.programId = req.query.programId;
    const students = await SummerStudent.findAll({
      where,
      include: [
        { model: SummerProgram, as: 'program', attributes: ['programId', 'name', 'startDate', 'endDate'] }
      ],
      order: [['name', 'ASC']]
    });
    res.json(students);
  } catch (err) {
    console.error('Error listing summer students:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const { programId, name, nationalId, phone, email, age, gender, notes } = req.body || {};
    if (!programId || !name) {
      return res.status(400).json({ message: 'programId and name are required', messageAr: 'البرنامج والاسم مطلوبان' });
    }
    const student = await SummerStudent.create({
      programId,
      name,
      nationalId: nationalId || null,
      phone: phone || null,
      email: email || null,
      age: age != null && age !== '' ? Number(age) : null,
      gender: gender || null,
      notes: notes || null,
      createdById: req.admin?.adminId || null
    });
    res.status(201).json(student);
  } catch (err) {
    console.error('Error creating summer student:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const student = await SummerStudent.findByPk(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const fields = ['name', 'nationalId', 'phone', 'email', 'age', 'gender', 'notes', 'programId', 'attendanceDays'];
    const patch = {};
    for (const f of fields) {
      if (req.body[f] !== undefined) patch[f] = req.body[f];
    }
    if (patch.age != null && patch.age !== '') patch.age = Number(patch.age);
    await student.update(patch);
    res.json(student);
  } catch (err) {
    console.error('Error updating summer student:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const student = await SummerStudent.findByPk(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    await student.update({ isActive: false });
    res.json({ message: 'Student removed' });
  } catch (err) {
    console.error('Error deleting summer student:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
