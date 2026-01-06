const { Volunteer, VolunteerOpportunity, VolunteerRating, Admin } = require('../models');
const { Op } = require('sequelize');

// ============== VOLUNTEER PROFILE MANAGEMENT ==============

/**
 * Get all volunteers
 */
exports.getAllVolunteers = async (req, res) => {
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
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const volunteers = await Volunteer.findAll({
      where: whereClause,
      include: [
        {
          model: VolunteerOpportunity,
          as: 'opportunities',
          attributes: ['opportunityId', 'title', 'startDate', 'endDate', 'totalHours', 'rating', 'status']
        },
        {
          model: VolunteerRating,
          as: 'ratings',
          attributes: ['ratingId', 'type', 'points', 'criteria', 'notes', 'ratingDate', 'opportunityId']
        }
      ],
      order: [['name', 'ASC']]
    });

    // Calculate total stats for each volunteer
    const volunteersWithStats = volunteers.map(v => {
      const volunteer = v.toJSON();
      const completedOpps = volunteer.opportunities.filter(o => o.status === 'completed');
      volunteer.totalOpportunities = volunteer.opportunities.length;
      volunteer.completedOpportunities = completedOpps.length;
      // Count hours from ALL opportunities (active and completed)
      volunteer.totalHours = volunteer.opportunities.reduce((sum, o) => sum + (o.totalHours || 0), 0);

      // Calculate points from new ratings system (awards - deductions)
      const awards = (volunteer.ratings || [])
        .filter(r => r.type === 'award')
        .reduce((sum, r) => sum + (r.points || 0), 0);
      const deductions = (volunteer.ratings || [])
        .filter(r => r.type === 'deduction')
        .reduce((sum, r) => sum + (r.points || 0), 0);

      volunteer.totalAwards = awards;
      volunteer.totalDeductions = deductions;
      volunteer.totalPoints = awards - deductions;

      return volunteer;
    });

    res.json(volunteersWithStats);
  } catch (error) {
    console.error('Error fetching volunteers:', error);
    res.status(500).json({ message: 'Error fetching volunteers', error: error.message });
  }
};

/**
 * Get single volunteer by ID
 */
exports.getVolunteerById = async (req, res) => {
  try {
    const { id } = req.params;

    const volunteer = await Volunteer.findByPk(id, {
      include: [
        {
          model: VolunteerOpportunity,
          as: 'opportunities',
          include: [
            { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
          ],
          order: [['startDate', 'DESC']]
        }
      ]
    });

    if (!volunteer) {
      return res.status(404).json({ message: 'Volunteer not found' });
    }

    res.json(volunteer);
  } catch (error) {
    console.error('Error fetching volunteer:', error);
    res.status(500).json({ message: 'Error fetching volunteer', error: error.message });
  }
};

/**
 * Create new volunteer profile
 */
exports.createVolunteer = async (req, res) => {
  try {
    const { name, nationalId, phone, email, nationalIdPhoto } = req.body;

    if (!name || !nationalId || !phone) {
      return res.status(400).json({
        message: 'Name, national ID, and phone are required',
        messageAr: 'الاسم ورقم الهوية ورقم الجوال مطلوبة'
      });
    }

    // Check if volunteer with same national ID exists
    const existing = await Volunteer.findOne({ where: { nationalId } });
    if (existing) {
      return res.status(409).json({
        message: 'Volunteer with this national ID already exists',
        messageAr: 'يوجد متطوع بنفس رقم الهوية',
        existingVolunteer: existing
      });
    }

    const volunteer = await Volunteer.create({
      name,
      nationalId,
      phone,
      email: email || null,
      nationalIdPhoto: nationalIdPhoto || null
    });

    res.status(201).json(volunteer);
  } catch (error) {
    console.error('Error creating volunteer:', error);
    res.status(500).json({ message: 'Error creating volunteer', error: error.message });
  }
};

/**
 * Update volunteer profile
 */
exports.updateVolunteer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, nationalId, phone, email, nationalIdPhoto, isActive } = req.body;

    const volunteer = await Volunteer.findByPk(id);
    if (!volunteer) {
      return res.status(404).json({ message: 'Volunteer not found' });
    }

    // Check if national ID is being changed and if new one already exists
    if (nationalId && nationalId !== volunteer.nationalId) {
      const existing = await Volunteer.findOne({ where: { nationalId } });
      if (existing) {
        return res.status(409).json({
          message: 'Another volunteer with this national ID already exists',
          messageAr: 'يوجد متطوع آخر بنفس رقم الهوية'
        });
      }
    }

    await volunteer.update({
      name: name !== undefined ? name : volunteer.name,
      nationalId: nationalId !== undefined ? nationalId : volunteer.nationalId,
      phone: phone !== undefined ? phone : volunteer.phone,
      email: email !== undefined ? email : volunteer.email,
      nationalIdPhoto: nationalIdPhoto !== undefined ? nationalIdPhoto : volunteer.nationalIdPhoto,
      isActive: isActive !== undefined ? isActive : volunteer.isActive
    });

    res.json(volunteer);
  } catch (error) {
    console.error('Error updating volunteer:', error);
    res.status(500).json({ message: 'Error updating volunteer', error: error.message });
  }
};

/**
 * Delete volunteer
 */
exports.deleteVolunteer = async (req, res) => {
  try {
    const { id } = req.params;

    const volunteer = await Volunteer.findByPk(id);
    if (!volunteer) {
      return res.status(404).json({ message: 'Volunteer not found' });
    }

    // Check if volunteer has opportunities
    const opportunityCount = await VolunteerOpportunity.count({ where: { volunteerId: id } });
    if (opportunityCount > 0) {
      return res.status(400).json({
        message: 'Cannot delete volunteer with existing opportunities. Deactivate instead.',
        messageAr: 'لا يمكن حذف متطوع لديه فرص تطوعية. قم بتعطيله بدلاً من ذلك.',
        opportunityCount
      });
    }

    await volunteer.destroy();
    res.json({ message: 'Volunteer deleted successfully' });
  } catch (error) {
    console.error('Error deleting volunteer:', error);
    res.status(500).json({ message: 'Error deleting volunteer', error: error.message });
  }
};

// ============== VOLUNTEER OPPORTUNITY MANAGEMENT ==============

/**
 * Get all opportunities (with optional filters)
 */
exports.getAllOpportunities = async (req, res) => {
  try {
    const { volunteerId, status, startDate, endDate } = req.query;
    const whereClause = {};

    if (volunteerId) whereClause.volunteerId = volunteerId;
    if (status) whereClause.status = status;

    if (startDate && endDate) {
      whereClause.startDate = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      whereClause.startDate = { [Op.gte]: startDate };
    } else if (endDate) {
      whereClause.startDate = { [Op.lte]: endDate };
    }

    const opportunities = await VolunteerOpportunity.findAll({
      where: whereClause,
      include: [
        { model: Volunteer, as: 'volunteer', attributes: ['volunteerId', 'name', 'nationalId', 'phone', 'email'] },
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
      ],
      order: [['startDate', 'DESC']]
    });

    res.json(opportunities);
  } catch (error) {
    console.error('Error fetching opportunities:', error);
    res.status(500).json({ message: 'Error fetching opportunities', error: error.message });
  }
};

/**
 * Create new opportunity for a volunteer
 */
exports.createOpportunity = async (req, res) => {
  try {
    const {
      volunteerId,
      title,
      description,
      startDate,
      endDate,
      dailyHours,
      rating,
      ratingCriteria,
      ratingNotes
    } = req.body;

    if (!volunteerId || !title || !startDate || !endDate) {
      return res.status(400).json({
        message: 'Volunteer, title, start date, and end date are required',
        messageAr: 'المتطوع والعنوان وتاريخ البدء والانتهاء مطلوبة'
      });
    }

    // Verify volunteer exists
    const volunteer = await Volunteer.findByPk(volunteerId);
    if (!volunteer) {
      return res.status(404).json({ message: 'Volunteer not found' });
    }

    // Calculate total hours
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const hours = dailyHours || 8;
    const totalHours = days * hours;

    const opportunity = await VolunteerOpportunity.create({
      volunteerId,
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
    const createdOpportunity = await VolunteerOpportunity.findByPk(opportunity.opportunityId, {
      include: [
        { model: Volunteer, as: 'volunteer', attributes: ['volunteerId', 'name', 'nationalId', 'phone', 'email'] },
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
      ]
    });

    res.status(201).json(createdOpportunity);
  } catch (error) {
    console.error('Error creating opportunity:', error);
    res.status(500).json({ message: 'Error creating opportunity', error: error.message });
  }
};

/**
 * Update opportunity
 */
exports.updateOpportunity = async (req, res) => {
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

    const opportunity = await VolunteerOpportunity.findByPk(id);
    if (!opportunity) {
      return res.status(404).json({ message: 'Opportunity not found' });
    }

    // Recalculate hours if dates or daily hours changed
    let totalHours = opportunity.totalHours;
    const newStartDate = startDate || opportunity.startDate;
    const newEndDate = endDate || opportunity.endDate;
    const newDailyHours = dailyHours !== undefined ? dailyHours : opportunity.dailyHours;

    if (startDate || endDate || dailyHours !== undefined) {
      const start = new Date(newStartDate);
      const end = new Date(newEndDate);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      totalHours = days * newDailyHours;
    }

    await opportunity.update({
      title: title !== undefined ? title : opportunity.title,
      description: description !== undefined ? description : opportunity.description,
      startDate: newStartDate,
      endDate: newEndDate,
      dailyHours: newDailyHours,
      totalHours,
      rating: rating !== undefined ? rating : opportunity.rating,
      ratingCriteria: ratingCriteria !== undefined ? ratingCriteria : opportunity.ratingCriteria,
      ratingNotes: ratingNotes !== undefined ? ratingNotes : opportunity.ratingNotes,
      status: status !== undefined ? status : opportunity.status
    });

    // Fetch with associations
    const updatedOpportunity = await VolunteerOpportunity.findByPk(id, {
      include: [
        { model: Volunteer, as: 'volunteer', attributes: ['volunteerId', 'name', 'nationalId', 'phone', 'email'] },
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
      ]
    });

    res.json(updatedOpportunity);
  } catch (error) {
    console.error('Error updating opportunity:', error);
    res.status(500).json({ message: 'Error updating opportunity', error: error.message });
  }
};

/**
 * Delete opportunity
 */
exports.deleteOpportunity = async (req, res) => {
  try {
    const { id } = req.params;

    const opportunity = await VolunteerOpportunity.findByPk(id);
    if (!opportunity) {
      return res.status(404).json({ message: 'Opportunity not found' });
    }

    await opportunity.destroy();
    res.json({ message: 'Opportunity deleted successfully' });
  } catch (error) {
    console.error('Error deleting opportunity:', error);
    res.status(500).json({ message: 'Error deleting opportunity', error: error.message });
  }
};

/**
 * Export opportunities as CSV
 */
exports.exportOpportunities = async (req, res) => {
  try {
    const { volunteerId, startDate, endDate, status } = req.query;
    const whereClause = {};

    if (volunteerId && volunteerId !== 'all') whereClause.volunteerId = volunteerId;
    if (status && status !== 'all') whereClause.status = status;

    if (startDate && endDate) {
      whereClause.startDate = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      whereClause.startDate = { [Op.gte]: startDate };
    } else if (endDate) {
      whereClause.startDate = { [Op.lte]: endDate };
    }

    const opportunities = await VolunteerOpportunity.findAll({
      where: whereClause,
      include: [
        { model: Volunteer, as: 'volunteer', attributes: ['name', 'nationalId', 'phone', 'email'] }
      ],
      order: [['startDate', 'DESC']]
    });

    // Create CSV content
    const headers = [
      'Volunteer Name', 'National ID', 'Phone', 'Email',
      'Opportunity Title', 'Start Date', 'End Date', 'Daily Hours', 'Total Hours',
      'Rating', 'Rating Criteria', 'Status'
    ];

    const rows = opportunities.map(o => [
      o.volunteer?.name || 'N/A',
      o.volunteer?.nationalId || 'N/A',
      o.volunteer?.phone || 'N/A',
      o.volunteer?.email || 'N/A',
      o.title,
      o.startDate,
      o.endDate,
      o.dailyHours,
      o.totalHours,
      o.rating,
      o.ratingCriteria || '',
      o.status
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Add BOM for Excel UTF-8 compatibility
    const bom = '\uFEFF';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="volunteer_opportunities_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(bom + csvContent);
  } catch (error) {
    console.error('Error exporting opportunities:', error);
    res.status(500).json({ message: 'Error exporting opportunities', error: error.message });
  }
};

// ============== VOLUNTEER RATINGS ==============

/**
 * Get all ratings for a volunteer
 */
exports.getVolunteerRatings = async (req, res) => {
  try {
    const { volunteerId } = req.params;
    const { startDate, endDate } = req.query;

    const where = { volunteerId };

    if (startDate && endDate) {
      where.ratingDate = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      where.ratingDate = { [Op.gte]: startDate };
    } else if (endDate) {
      where.ratingDate = { [Op.lte]: endDate };
    }

    const ratings = await VolunteerRating.findAll({
      where,
      include: [
        { model: VolunteerOpportunity, as: 'opportunity', attributes: ['opportunityId', 'title'] },
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
    console.error('Error fetching volunteer ratings:', error);
    res.status(500).json({ message: 'Error fetching ratings', error: error.message });
  }
};

/**
 * Create a volunteer rating
 */
exports.createVolunteerRating = async (req, res) => {
  try {
    const { volunteerId, opportunityId, type, points, criteria, notes, ratingDate } = req.body;

    if (!req.admin || !req.admin.adminId) {
      return res.status(401).json({ message: 'Admin authentication required' });
    }

    if (!volunteerId || !type || points === undefined) {
      return res.status(400).json({ message: 'Volunteer ID, type, and points are required' });
    }

    // Verify volunteer exists
    const volunteer = await Volunteer.findByPk(volunteerId);
    if (!volunteer) {
      return res.status(404).json({ message: 'Volunteer not found' });
    }

    const rating = await VolunteerRating.create({
      volunteerId,
      opportunityId: opportunityId || null,
      createdById: req.admin.adminId,
      type,
      points: parseInt(points, 10),
      criteria: criteria || null,
      notes: notes || null,
      ratingDate: ratingDate || new Date().toISOString().split('T')[0]
    });

    // Fetch with associations
    const createdRating = await VolunteerRating.findByPk(rating.ratingId, {
      include: [
        { model: Volunteer, as: 'volunteer', attributes: ['volunteerId', 'name'] },
        { model: VolunteerOpportunity, as: 'opportunity', attributes: ['opportunityId', 'title'] },
        { model: Admin, as: 'ratedBy', attributes: ['adminId', 'fullName', 'email'] }
      ]
    });

    res.status(201).json(createdRating);
  } catch (error) {
    console.error('Error creating volunteer rating:', error);
    res.status(500).json({ message: 'Error creating rating', error: error.message });
  }
};

/**
 * Delete a volunteer rating
 */
exports.deleteVolunteerRating = async (req, res) => {
  try {
    const { id } = req.params;

    const rating = await VolunteerRating.findByPk(id);
    if (!rating) {
      return res.status(404).json({ message: 'Rating not found' });
    }

    await rating.destroy();
    res.json({ message: 'Rating deleted successfully' });
  } catch (error) {
    console.error('Error deleting volunteer rating:', error);
    res.status(500).json({ message: 'Error deleting rating', error: error.message });
  }
};

module.exports = exports;
