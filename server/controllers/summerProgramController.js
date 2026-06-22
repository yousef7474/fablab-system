const { SummerProgram, SummerTeacher, SummerStudent, Admin } = require('../models');

exports.list = async (req, res) => {
  try {
    const programs = await SummerProgram.findAll({
      where: { isActive: true },
      include: [
        { model: SummerTeacher, as: 'teacher', attributes: ['teacherId', 'name', 'fablabSection'] },
        { model: SummerStudent, as: 'students', where: { isActive: true }, required: false, attributes: ['studentId'] }
      ],
      order: [['startDate', 'ASC']]
    });
    res.json(programs);
  } catch (err) {
    console.error('Error listing summer programs:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const {
      name, teacherName, teacherId, studentCount, startDate, endDate,
      startTime, endTime, fablabSection, sectionVolunteers, notes
    } = req.body || {};

    if (!name || !startDate || !endDate) {
      return res.status(400).json({
        message: 'name, startDate, endDate are required',
        messageAr: 'الاسم وتاريخا البداية والنهاية مطلوبة'
      });
    }
    if (startDate > endDate) {
      return res.status(400).json({
        message: 'startDate must be on or before endDate',
        messageAr: 'تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية'
      });
    }

    const program = await SummerProgram.create({
      name,
      teacherName: teacherName || null,
      teacherId: teacherId || null,
      studentCount: studentCount != null ? Number(studentCount) : 0,
      startDate,
      endDate,
      startTime: startTime || null,
      endTime: endTime || null,
      fablabSection: fablabSection || null,
      sectionVolunteers: Array.isArray(sectionVolunteers) ? sectionVolunteers : [],
      notes: notes || null,
      createdById: req.admin?.adminId || null
    });

    res.status(201).json(program);
  } catch (err) {
    console.error('Error creating summer program:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const program = await SummerProgram.findByPk(req.params.id);
    if (!program) return res.status(404).json({ message: 'Program not found' });

    const fields = [
      'name', 'teacherName', 'teacherId', 'studentCount', 'startDate', 'endDate',
      'startTime', 'endTime', 'fablabSection', 'sectionVolunteers', 'notes'
    ];
    const patch = {};
    for (const f of fields) {
      if (req.body[f] !== undefined) patch[f] = req.body[f];
    }
    if (patch.fablabSection === '') patch.fablabSection = null;
    if (patch.studentCount != null) patch.studentCount = Number(patch.studentCount);

    await program.update(patch);
    res.json(program);
  } catch (err) {
    console.error('Error updating summer program:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const program = await SummerProgram.findByPk(req.params.id);
    if (!program) return res.status(404).json({ message: 'Program not found' });
    await program.update({ isActive: false });
    res.json({ message: 'Program removed' });
  } catch (err) {
    console.error('Error deleting summer program:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
