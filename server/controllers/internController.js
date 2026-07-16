const { Intern, InternTraining, InternRating, InternAttendance, Admin } = require('../models');
const { Op } = require('sequelize');
const QRCode = require('qrcode');

// ============== INTERN PROFILE MANAGEMENT ==============

/**
 * Get all interns
 */
exports.getAllInterns = async (req, res) => {
  try {
    const { search, isActive } = req.query;
    const whereClause = {};

    if (isActive !== undefined) {
      whereClause.isActive = isActive === 'true';
    }

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { nationalId: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { university: { [Op.like]: `%${search}%` } },
        { major: { [Op.like]: `%${search}%` } }
      ];
    }

    const interns = await Intern.findAll({
      where: whereClause,
      include: [
        {
          model: InternTraining,
          as: 'trainings',
          attributes: ['trainingId', 'title', 'startDate', 'endDate', 'totalHours', 'rating', 'status']
        },
        {
          model: InternRating,
          as: 'ratings',
          attributes: ['ratingId', 'type', 'points', 'criteria', 'notes', 'ratingDate', 'trainingId']
        }
      ],
      order: [['name', 'ASC']]
    });

    // Calculate total stats for each intern
    const internsWithStats = interns.map(i => {
      const intern = i.toJSON();
      const completedTrainings = intern.trainings.filter(t => t.status === 'completed');
      intern.totalTrainings = intern.trainings.length;
      intern.completedTrainings = completedTrainings.length;
      // Count hours from ALL trainings (active and completed)
      intern.totalHours = intern.trainings.reduce((sum, t) => sum + (t.totalHours || 0), 0);

      // Calculate points from new ratings system (awards - deductions)
      const awards = (intern.ratings || [])
        .filter(r => r.type === 'award')
        .reduce((sum, r) => sum + (r.points || 0), 0);
      const deductions = (intern.ratings || [])
        .filter(r => r.type === 'deduction')
        .reduce((sum, r) => sum + (r.points || 0), 0);

      intern.totalAwards = awards;
      intern.totalDeductions = deductions;
      intern.totalPoints = awards - deductions;

      return intern;
    });

    res.json(internsWithStats);
  } catch (error) {
    console.error('Error fetching interns:', error);
    res.status(500).json({ message: 'Error fetching interns', error: error.message });
  }
};

/**
 * Get single intern by ID
 */
exports.getInternById = async (req, res) => {
  try {
    const { id } = req.params;

    const intern = await Intern.findByPk(id, {
      include: [
        {
          model: InternTraining,
          as: 'trainings',
          include: [
            { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
          ],
          order: [['startDate', 'DESC']]
        }
      ]
    });

    if (!intern) {
      return res.status(404).json({ message: 'Intern not found' });
    }

    res.json(intern);
  } catch (error) {
    console.error('Error fetching intern:', error);
    res.status(500).json({ message: 'Error fetching intern', error: error.message });
  }
};

/**
 * Create new intern profile
 */
exports.createIntern = async (req, res) => {
  try {
    const { name, nationalId, phone, email, university, major, nationalIdPhoto } = req.body;

    if (!name || !nationalId || !phone) {
      return res.status(400).json({
        message: 'Name, national ID, and phone are required',
        messageAr: 'الاسم ورقم الهوية ورقم الجوال مطلوبة'
      });
    }

    // Check if intern with same national ID exists
    const existing = await Intern.findOne({ where: { nationalId } });
    if (existing) {
      return res.status(409).json({
        message: 'Intern with this national ID already exists',
        messageAr: 'يوجد متدرب بنفس رقم الهوية',
        existingIntern: existing
      });
    }

    const intern = await Intern.create({
      name,
      nationalId,
      phone,
      email: email || null,
      university: university || null,
      major: major || null,
      nationalIdPhoto: nationalIdPhoto || null
    });

    res.status(201).json(intern);
  } catch (error) {
    console.error('Error creating intern:', error);
    res.status(500).json({ message: 'Error creating intern', error: error.message });
  }
};

/**
 * Update intern profile
 */
exports.updateIntern = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, nationalId, phone, email, university, major, nationalIdPhoto, isActive } = req.body;

    const intern = await Intern.findByPk(id);
    if (!intern) {
      return res.status(404).json({ message: 'Intern not found' });
    }

    // Check if national ID is being changed and if new one already exists
    if (nationalId && nationalId !== intern.nationalId) {
      const existing = await Intern.findOne({ where: { nationalId } });
      if (existing) {
        return res.status(409).json({
          message: 'Another intern with this national ID already exists',
          messageAr: 'يوجد متدرب آخر بنفس رقم الهوية'
        });
      }
    }

    await intern.update({
      name: name !== undefined ? name : intern.name,
      nationalId: nationalId !== undefined ? nationalId : intern.nationalId,
      phone: phone !== undefined ? phone : intern.phone,
      email: email !== undefined ? email : intern.email,
      university: university !== undefined ? university : intern.university,
      major: major !== undefined ? major : intern.major,
      nationalIdPhoto: nationalIdPhoto !== undefined ? nationalIdPhoto : intern.nationalIdPhoto,
      isActive: isActive !== undefined ? isActive : intern.isActive
    });

    res.json(intern);
  } catch (error) {
    console.error('Error updating intern:', error);
    res.status(500).json({ message: 'Error updating intern', error: error.message });
  }
};

/**
 * Delete intern
 */
exports.deleteIntern = async (req, res) => {
  try {
    const { id } = req.params;

    const intern = await Intern.findByPk(id);
    if (!intern) {
      return res.status(404).json({ message: 'Intern not found' });
    }

    // Delete associated ratings first
    await InternRating.destroy({ where: { internId: id } });

    // Delete associated trainings
    await InternTraining.destroy({ where: { internId: id } });

    // Delete the intern
    await intern.destroy();
    res.json({ message: 'Intern deleted successfully' });
  } catch (error) {
    console.error('Error deleting intern:', error);
    res.status(500).json({ message: 'Error deleting intern', error: error.message });
  }
};

// ============== INTERN TRAINING MANAGEMENT ==============

/**
 * Get all trainings (with optional filters)
 */
exports.getAllTrainings = async (req, res) => {
  try {
    const { internId, status, startDate, endDate } = req.query;
    const whereClause = {};

    if (internId) whereClause.internId = internId;
    if (status) whereClause.status = status;

    if (startDate && endDate) {
      whereClause.startDate = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      whereClause.startDate = { [Op.gte]: startDate };
    } else if (endDate) {
      whereClause.startDate = { [Op.lte]: endDate };
    }

    const trainings = await InternTraining.findAll({
      where: whereClause,
      include: [
        { model: Intern, as: 'intern', attributes: ['internId', 'name', 'nationalId', 'phone', 'email', 'university', 'major'] },
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
      ],
      order: [['startDate', 'DESC']]
    });

    res.json(trainings);
  } catch (error) {
    console.error('Error fetching trainings:', error);
    res.status(500).json({ message: 'Error fetching trainings', error: error.message });
  }
};

/**
 * Create new training for an intern
 */
exports.createTraining = async (req, res) => {
  try {
    const {
      internId,
      title,
      description,
      startDate,
      endDate,
      dailyHours,
      rating,
      ratingCriteria,
      ratingNotes
    } = req.body;

    if (!internId || !title || !startDate || !endDate) {
      return res.status(400).json({
        message: 'Intern, title, start date, and end date are required',
        messageAr: 'المتدرب والعنوان وتاريخ البدء والانتهاء مطلوبة'
      });
    }

    // Verify intern exists
    const intern = await Intern.findByPk(internId);
    if (!intern) {
      return res.status(404).json({ message: 'Intern not found' });
    }

    // Calculate total hours
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const hours = dailyHours || 8;
    const totalHours = days * hours;

    const training = await InternTraining.create({
      internId,
      title,
      description: description || null,
      startDate,
      endDate,
      dailyHours: hours,
      totalHours,
      rating: rating || 0,
      ratingCriteria: ratingCriteria || null,
      ratingNotes: ratingNotes || null,
      createdById: req.admin.adminId
    });

    // Fetch with associations
    const createdTraining = await InternTraining.findByPk(training.trainingId, {
      include: [
        { model: Intern, as: 'intern', attributes: ['internId', 'name', 'nationalId', 'phone', 'email', 'university', 'major'] },
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
      ]
    });

    res.status(201).json(createdTraining);
  } catch (error) {
    console.error('Error creating training:', error);
    res.status(500).json({ message: 'Error creating training', error: error.message });
  }
};

/**
 * Update training
 */
exports.updateTraining = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      startDate,
      endDate,
      dailyHours,
      rating,
      ratingCriteria,
      ratingNotes,
      status
    } = req.body;

    const training = await InternTraining.findByPk(id);
    if (!training) {
      return res.status(404).json({ message: 'Training not found' });
    }

    // Recalculate hours if dates or daily hours changed
    let totalHours = training.totalHours;
    const newStartDate = startDate || training.startDate;
    const newEndDate = endDate || training.endDate;
    const newDailyHours = dailyHours !== undefined ? dailyHours : training.dailyHours;

    if (startDate || endDate || dailyHours !== undefined) {
      const start = new Date(newStartDate);
      const end = new Date(newEndDate);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      totalHours = days * newDailyHours;
    }

    await training.update({
      title: title !== undefined ? title : training.title,
      description: description !== undefined ? description : training.description,
      startDate: newStartDate,
      endDate: newEndDate,
      dailyHours: newDailyHours,
      totalHours,
      rating: rating !== undefined ? rating : training.rating,
      ratingCriteria: ratingCriteria !== undefined ? ratingCriteria : training.ratingCriteria,
      ratingNotes: ratingNotes !== undefined ? ratingNotes : training.ratingNotes,
      status: status !== undefined ? status : training.status
    });

    // Fetch with associations
    const updatedTraining = await InternTraining.findByPk(id, {
      include: [
        { model: Intern, as: 'intern', attributes: ['internId', 'name', 'nationalId', 'phone', 'email', 'university', 'major'] },
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
      ]
    });

    res.json(updatedTraining);
  } catch (error) {
    console.error('Error updating training:', error);
    res.status(500).json({ message: 'Error updating training', error: error.message });
  }
};

/**
 * Delete training
 */
exports.deleteTraining = async (req, res) => {
  try {
    const { id } = req.params;

    const training = await InternTraining.findByPk(id);
    if (!training) {
      return res.status(404).json({ message: 'Training not found' });
    }

    await training.destroy();
    res.json({ message: 'Training deleted successfully' });
  } catch (error) {
    console.error('Error deleting training:', error);
    res.status(500).json({ message: 'Error deleting training', error: error.message });
  }
};

/**
 * Export trainings as CSV
 */
exports.exportTrainings = async (req, res) => {
  try {
    const { internId, startDate, endDate, status } = req.query;
    const whereClause = {};

    if (internId && internId !== 'all') whereClause.internId = internId;
    if (status && status !== 'all') whereClause.status = status;

    if (startDate && endDate) {
      whereClause.startDate = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      whereClause.startDate = { [Op.gte]: startDate };
    } else if (endDate) {
      whereClause.startDate = { [Op.lte]: endDate };
    }

    const trainings = await InternTraining.findAll({
      where: whereClause,
      include: [
        { model: Intern, as: 'intern', attributes: ['name', 'nationalId', 'phone', 'email', 'university', 'major'] }
      ],
      order: [['startDate', 'DESC']]
    });

    // Create CSV content
    const headers = [
      'Intern Name', 'National ID', 'Phone', 'Email', 'University', 'Major',
      'Training Title', 'Start Date', 'End Date', 'Daily Hours', 'Total Hours',
      'Rating', 'Rating Criteria', 'Status'
    ];

    const rows = trainings.map(t => [
      t.intern?.name || 'N/A',
      t.intern?.nationalId || 'N/A',
      t.intern?.phone || 'N/A',
      t.intern?.email || 'N/A',
      t.intern?.university || 'N/A',
      t.intern?.major || 'N/A',
      t.title,
      t.startDate,
      t.endDate,
      t.dailyHours,
      t.totalHours,
      t.rating,
      t.ratingCriteria || '',
      t.status
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Add BOM for Excel UTF-8 compatibility
    const bom = '\uFEFF';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="intern_trainings_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(bom + csvContent);
  } catch (error) {
    console.error('Error exporting trainings:', error);
    res.status(500).json({ message: 'Error exporting trainings', error: error.message });
  }
};

// ============== INTERN RATINGS ==============

/**
 * Get all ratings for an intern
 */
exports.getInternRatings = async (req, res) => {
  try {
    const { internId } = req.params;
    const { startDate, endDate } = req.query;

    const where = { internId };

    if (startDate && endDate) {
      where.ratingDate = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      where.ratingDate = { [Op.gte]: startDate };
    } else if (endDate) {
      where.ratingDate = { [Op.lte]: endDate };
    }

    const ratings = await InternRating.findAll({
      where,
      include: [
        { model: InternTraining, as: 'training', attributes: ['trainingId', 'title'] },
        { model: Admin, as: 'ratedBy', attributes: ['adminId', 'fullName', 'email'] }
      ],
      order: [['ratingDate', 'DESC'], ['createdAt', 'DESC']]
    });

    // Calculate summary
    const awards = ratings.filter(r => r.type === 'award').reduce((sum, r) => sum + r.points, 0);
    const deductions = ratings.filter(r => r.type === 'deduction').reduce((sum, r) => sum + r.points, 0);

    res.json({
      ratings,
      summary: {
        totalRatings: ratings.length,
        awards,
        deductions,
        netPoints: awards - deductions
      }
    });
  } catch (error) {
    console.error('Error fetching intern ratings:', error);
    res.status(500).json({ message: 'Error fetching ratings', error: error.message });
  }
};

/**
 * Create an intern rating
 */
exports.createInternRating = async (req, res) => {
  try {
    const { internId, trainingId, type, points, criteria, notes, ratingDate } = req.body;

    if (!req.admin || !req.admin.adminId) {
      return res.status(401).json({ message: 'Admin authentication required' });
    }

    if (!internId || !type || points === undefined) {
      return res.status(400).json({ message: 'Intern ID, type, and points are required' });
    }

    // Verify intern exists
    const intern = await Intern.findByPk(internId);
    if (!intern) {
      return res.status(404).json({ message: 'Intern not found' });
    }

    const rating = await InternRating.create({
      internId,
      trainingId: trainingId || null,
      createdById: req.admin.adminId,
      type,
      points: parseInt(points, 10),
      criteria: criteria || null,
      notes: notes || null,
      ratingDate: ratingDate || new Date().toISOString().split('T')[0]
    });

    // Fetch with associations
    const createdRating = await InternRating.findByPk(rating.ratingId, {
      include: [
        { model: Intern, as: 'intern', attributes: ['internId', 'name'] },
        { model: InternTraining, as: 'training', attributes: ['trainingId', 'title'] },
        { model: Admin, as: 'ratedBy', attributes: ['adminId', 'fullName', 'email'] }
      ]
    });

    res.status(201).json(createdRating);
  } catch (error) {
    console.error('Error creating intern rating:', error);
    res.status(500).json({ message: 'Error creating rating', error: error.message });
  }
};

/**
 * Delete an intern rating
 */
exports.deleteInternRating = async (req, res) => {
  try {
    const { id } = req.params;

    const rating = await InternRating.findByPk(id);
    if (!rating) {
      return res.status(404).json({ message: 'Rating not found' });
    }

    await rating.destroy();
    res.json({ message: 'Rating deleted successfully' });
  } catch (error) {
    console.error('Error deleting intern rating:', error);
    res.status(500).json({ message: 'Error deleting rating', error: error.message });
  }
};

// ============== INTERN ID CARD (QR) ==============
// Mirrors the volunteer QR/card flow; QR encodes nationalId so a
// scan looks the intern up directly.

const makeQrDataUrl = async (payload) => QRCode.toDataURL(String(payload), {
  errorCorrectionLevel: 'M',
  margin: 1,
  scale: 8,
  color: { dark: '#000000', light: '#FFFFFF' }
});

exports.getInternCard = async (req, res) => {
  try {
    const intern = await Intern.findByPk(req.params.id);
    if (!intern) return res.status(404).json({ message: 'Intern not found' });
    const qrDataUrl = await makeQrDataUrl(intern.nationalId);
    res.json({ intern, qrDataUrl });
  } catch (err) {
    console.error('getInternCard:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.getInternCardsBulk = async (req, res) => {
  try {
    const { internIds } = req.body || {};
    if (!Array.isArray(internIds) || internIds.length === 0) {
      return res.status(400).json({ message: 'internIds array required' });
    }
    const interns = await Intern.findAll({ where: { internId: internIds } });
    const cards = await Promise.all(interns.map(async (i) => ({
      intern: i,
      qrDataUrl: await makeQrDataUrl(i.nationalId)
    })));
    res.json({ cards });
  } catch (err) {
    console.error('getInternCardsBulk:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

// ============== INTERN ATTENDANCE ==============

// Riyadh-anchored "today" so late-night check-ins land on the right
// calendar day regardless of server timezone.
const riyadhDateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Riyadh',
  year: 'numeric', month: '2-digit', day: '2-digit'
});
const todayStr = () => {
  const parts = riyadhDateFmt.formatToParts(new Date());
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const d = parts.find(p => p.type === 'day').value;
  return `${y}-${m}-${d}`;
};

// POST /interns/attendance/scan — body { code } — accepts nationalId
exports.scanAttendance = async (req, res) => {
  try {
    const raw = String(req.body?.code || '').trim();
    if (!raw) return res.status(400).json({ message: 'No code provided' });

    const intern = await Intern.findOne({ where: { nationalId: raw } });
    if (!intern) {
      return res.status(404).json({ message: 'No intern matches this code', code: raw });
    }

    const date = todayStr();
    const now = new Date();
    let record = await InternAttendance.findOne({
      where: { internId: intern.internId, date }
    });

    let action = null;
    if (!record) {
      record = await InternAttendance.create({
        internId: intern.internId, date, checkInAt: now
      });
      action = 'checkin';
    } else if (!record.checkOutAt) {
      const since = now.getTime() - new Date(record.checkInAt).getTime();
      if (since < 15 * 60 * 1000) {
        return res.json({
          action: 'duplicate', intern, record,
          message: 'Already checked in — please wait at least 15 minutes before checking out'
        });
      }
      await record.update({ checkOutAt: now });
      action = 'checkout';
    } else {
      return res.json({
        action: 'already_done', intern, record,
        message: 'Already checked in and out today'
      });
    }

    res.json({ action, intern, record });
  } catch (err) {
    console.error('Intern scanAttendance:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /interns/attendance/today
exports.todayAttendance = async (req, res) => {
  try {
    const date = todayStr();
    const records = await InternAttendance.findAll({
      where: { date },
      include: [{ model: Intern, as: 'intern', required: false }]
    });

    const events = [];
    const trainees = [];
    for (const r of records) {
      const i = r.intern || {};
      const base = {
        attendanceId: r.attendanceId,
        internId: r.internId,
        name: i.name || '',
        phone: i.phone || '',
        university: i.university || ''
      };
      if (r.checkInAt) events.push({ ...base, kind: 'checkin', at: r.checkInAt });
      if (r.checkOutAt) events.push({ ...base, kind: 'checkout', at: r.checkOutAt });
      trainees.push({
        ...base,
        checkInAt: r.checkInAt,
        checkOutAt: r.checkOutAt,
        status: r.checkOutAt ? 'checked_out' : 'checked_in'
      });
    }
    events.sort((a, b) => new Date(b.at) - new Date(a.at));
    trainees.sort((a, b) => new Date(b.checkOutAt || b.checkInAt || 0) - new Date(a.checkOutAt || a.checkInAt || 0));

    const checkins = events.filter(e => e.kind === 'checkin').length;
    const checkouts = events.filter(e => e.kind === 'checkout').length;
    res.json({ date, events, trainees, stats: { checkins, checkouts } });
  } catch (err) {
    console.error('Intern todayAttendance:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// DELETE /interns/attendance/today
exports.clearTodayAttendance = async (req, res) => {
  try {
    const date = todayStr();
    const count = await InternAttendance.destroy({ where: { date } });
    res.json({ message: 'Today cleared', date, count });
  } catch (err) {
    console.error('Intern clearTodayAttendance:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /interns/:id/attendance — full history for one intern
exports.listInternAttendance = async (req, res) => {
  try {
    const records = await InternAttendance.findAll({
      where: { internId: req.params.id },
      order: [['date', 'DESC'], ['checkInAt', 'DESC']]
    });
    res.json(records);
  } catch (err) {
    console.error('Intern listInternAttendance:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// PATCH /interns/attendance/:id/checkout — clears only checkOutAt
exports.clearCheckout = async (req, res) => {
  try {
    const rec = await InternAttendance.findByPk(req.params.id);
    if (!rec) return res.status(404).json({ message: 'Record not found' });
    if (!rec.checkOutAt) return res.status(400).json({ message: 'No check-out to clear' });
    await rec.update({ checkOutAt: null });
    res.json({ message: 'Check-out cleared', record: rec });
  } catch (err) {
    console.error('Intern clearCheckout:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.deleteAttendance = async (req, res) => {
  try {
    const rec = await InternAttendance.findByPk(req.params.id);
    if (!rec) return res.status(404).json({ message: 'Record not found' });
    await rec.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Intern deleteAttendance:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ============== Attendance export (Excel-friendly UTF-16 LE + BOM) ==============

const riyadhTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Riyadh', hour12: false,
  hour: '2-digit', minute: '2-digit', second: '2-digit'
});
const fmtTimeRiyadh = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return riyadhTimeFmt.format(dt).replace(/^24:/, '00:');
};

exports.exportAttendance = async (req, res) => {
  try {
    const { internIds, from, to } = req.body || {};
    const where = {};
    if (Array.isArray(internIds) && internIds.length > 0) {
      where.internId = { [Op.in]: internIds };
    }
    if (from) where.date = { ...(where.date || {}), [Op.gte]: from };
    if (to)   where.date = { ...(where.date || {}), [Op.lte]: to };

    const records = await InternAttendance.findAll({
      where,
      include: [{ model: Intern, as: 'intern', required: false }],
      order: [['date', 'ASC'], ['checkInAt', 'ASC']]
    });

    const header = ['اسم المتدرب', 'رقم الهوية', 'الجامعة', 'التخصص', 'رقم الجوال', 'التاريخ', 'وقت الدخول', 'وقت الخروج', 'المدة (دقيقة)'];
    const lines = [header.join('\t')];
    for (const r of records) {
      const i = r.intern || {};
      const minutes = r.checkInAt && r.checkOutAt
        ? Math.max(0, Math.round((new Date(r.checkOutAt) - new Date(r.checkInAt)) / 60000))
        : '';
      lines.push([
        i.name || '', i.nationalId || '', i.university || '', i.major || '',
        i.phone || '', r.date || '',
        fmtTimeRiyadh(r.checkInAt), fmtTimeRiyadh(r.checkOutAt), minutes
      ].map(x => String(x ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ')).join('\t'));
    }

    const text = lines.join('\r\n');
    const bom = Buffer.from([0xFF, 0xFE]);
    const body = Buffer.from(text, 'utf16le');
    const out = Buffer.concat([bom, body]);

    const today = todayStr();
    res.setHeader('Content-Type', 'text/csv; charset=utf-16le');
    res.setHeader('Content-Disposition', `attachment; filename="interns-attendance-${today}.csv"`);
    res.send(out);
  } catch (err) {
    console.error('Intern exportAttendance:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = exports;
