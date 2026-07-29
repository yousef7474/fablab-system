const { Op } = require('sequelize');
const { SummerProgram, SummerTeacher, SummerStudent, Volunteer, Admin } = require('../models');

// When a program is saved with a sectionVolunteers name array, we mirror
// that selection onto the actual Volunteer records so the Summer FabLab
// → Volunteers tab (which filters by summerProgramId) shows the same
// people. Volunteers not in the new list but previously linked to this
// program get unlinked. Non-existent names (free-text people who aren't
// in the Volunteers table) are silently ignored — they still live on
// the program's sectionVolunteers JSON column.
const syncSectionVolunteerLinks = async (programId, names) => {
  if (!programId) return;
  const wanted = Array.isArray(names) ? names.map(n => String(n || '').trim()).filter(Boolean) : [];

  // (1) Un-link volunteers previously in this program but no longer named
  const currentlyLinked = await Volunteer.findAll({
    where: { summerProgramId: programId },
    attributes: ['volunteerId', 'name']
  });
  const wantedSet = new Set(wanted);
  const toUnlink = currentlyLinked
    .filter(v => !wantedSet.has(v.name))
    .map(v => v.volunteerId);
  if (toUnlink.length) {
    await Volunteer.update(
      { summerProgramId: null },
      { where: { volunteerId: { [Op.in]: toUnlink } } }
    );
  }

  // (2) Link volunteers whose names match. Names that don't match any
  // Volunteer record are ignored (they might be free-text extras).
  if (wanted.length) {
    await Volunteer.update(
      { summerProgramId: programId },
      { where: { name: { [Op.in]: wanted } } }
    );
  }
};

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
      name, teacherName, teacherId, teacherIds, studentCount, startDate, endDate,
      startTime, endTime, fablabSection, sectionVolunteers, notes, color
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

    // Multi-teacher: accept teacherIds array (new). Fall back to the
    // legacy single teacherId if the new field wasn't sent so old
    // clients keep working. Keep the legacy `teacherId` column in sync
    // with the first entry so `include: teacher` (single belongsTo)
    // keeps rendering something sensible.
    const teacherIdArr = Array.isArray(teacherIds)
      ? teacherIds.filter(Boolean)
      : (teacherId ? [teacherId] : []);

    const program = await SummerProgram.create({
      name,
      teacherName: teacherName || null,
      teacherId: teacherIdArr[0] || null,
      teacherIds: teacherIdArr,
      studentCount: studentCount != null ? Number(studentCount) : 0,
      startDate,
      endDate,
      startTime: startTime || null,
      endTime: endTime || null,
      fablabSection: fablabSection || null,
      sectionVolunteers: Array.isArray(sectionVolunteers) ? sectionVolunteers : [],
      color: color || null,
      notes: notes || null,
      createdById: req.admin?.adminId || null
    });

    // Mirror the sectionVolunteers list onto the actual Volunteer
    // records so they appear under the Summer Volunteers tab.
    await syncSectionVolunteerLinks(program.programId, sectionVolunteers);

    // Sanity re-read so the client sees whatever Postgres actually
    // stored (helpful when debugging column-missing issues).
    const fresh = await SummerProgram.findByPk(program.programId);
    res.status(201).json(fresh || program);
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
      'name', 'teacherName', 'teacherId', 'teacherIds', 'studentCount',
      'startDate', 'endDate', 'startTime', 'endTime',
      'fablabSection', 'sectionVolunteers', 'notes', 'color'
    ];
    const patch = {};
    for (const f of fields) {
      if (req.body[f] !== undefined) patch[f] = req.body[f];
    }
    if (patch.fablabSection === '') patch.fablabSection = null;
    if (patch.studentCount != null) patch.studentCount = Number(patch.studentCount);

    // Keep the legacy single `teacherId` column in sync with the new
    // multi-teacher array so `include: teacher` still resolves.
    if (patch.teacherIds !== undefined) {
      patch.teacherIds = Array.isArray(patch.teacherIds) ? patch.teacherIds.filter(Boolean) : [];
      patch.teacherId = patch.teacherIds[0] || null;
    }

    await program.update(patch);
    // Sequelize's JSON dirty-tracking sometimes misses in-place array
    // replacements. Force-persist the array by explicitly setting it
    // and marking the field changed, then saving. Safe no-op if the
    // update() above already wrote it.
    if (patch.teacherIds !== undefined) {
      program.setDataValue('teacherIds', patch.teacherIds);
      program.changed('teacherIds', true);
      await program.save({ fields: ['teacherIds'] });
    }
    // Same JSON dirty-tracking issue for sectionVolunteers.
    if (patch.sectionVolunteers !== undefined) {
      program.setDataValue('sectionVolunteers', patch.sectionVolunteers);
      program.changed('sectionVolunteers', true);
      await program.save({ fields: ['sectionVolunteers'] });
      // Mirror the updated list onto the actual Volunteer records.
      await syncSectionVolunteerLinks(program.programId, patch.sectionVolunteers);
    }

    // Re-read from DB so the caller sees the actually-persisted state.
    const fresh = await SummerProgram.findByPk(program.programId);
    res.json(fresh || program);
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
