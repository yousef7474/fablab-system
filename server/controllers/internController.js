const { Intern, InternTraining, InternRating, Admin } = require('../models');
const { Op } = require('sequelize');

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
        { name: { [Op.iLike]: `%${search}%` } },
        { nationalId: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { university: { [Op.iLike]: `%${search}%` } },
        { major: { [Op.iLike]: `%${search}%` } }
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

module.exports = exports;
