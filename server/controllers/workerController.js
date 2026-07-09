const { Worker, WorkerOpportunity, WorkerRating, WorkerReceipt, Admin } = require('../models');
const { Op } = require('sequelize');

// ============== WORKER PROFILE MANAGEMENT ==============

/**
 * Get all workers
 */
exports.getAllWorkers = async (req, res) => {
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
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    const workers = await Worker.findAll({
      where: whereClause,
      include: [
        {
          model: WorkerOpportunity,
          as: 'opportunities',
          attributes: ['opportunityId', 'title', 'description', 'startDate', 'endDate', 'totalHours', 'hoursAdjustment', 'attendanceDays', 'rating', 'status']
        },
        {
          model: WorkerRating,
          as: 'ratings',
          attributes: ['ratingId', 'type', 'points', 'criteria', 'notes', 'ratingDate', 'opportunityId']
        }
      ],
      order: [['name', 'ASC']]
    });

    // Calculate total stats for each worker
    const workersWithStats = workers.map(v => {
      const worker = v.toJSON();
      const completedOpps = worker.opportunities.filter(o => o.status === 'completed');
      worker.totalOpportunities = worker.opportunities.length;
      worker.completedOpportunities = completedOpps.length;
      // Count hours from ALL opportunities (active and completed), including adjustments
      worker.totalHours = worker.opportunities.reduce((sum, o) => {
        const baseHours = o.totalHours || 0;
        const adjustment = o.hoursAdjustment || 0;
        return sum + baseHours + adjustment;
      }, 0);

      // Calculate points from new ratings system (awards - deductions)
      const awards = (worker.ratings || [])
        .filter(r => r.type === 'award')
        .reduce((sum, r) => sum + (r.points || 0), 0);
      const deductions = (worker.ratings || [])
        .filter(r => r.type === 'deduction')
        .reduce((sum, r) => sum + (r.points || 0), 0);

      worker.totalAwards = awards;
      worker.totalDeductions = deductions;
      worker.totalPoints = awards - deductions;

      return worker;
    });

    res.json(workersWithStats);
  } catch (error) {
    console.error('Error fetching workers:', error);
    res.status(500).json({ message: 'Error fetching workers', error: error.message });
  }
};

/**
 * Get single worker by ID
 */
exports.getWorkerById = async (req, res) => {
  try {
    const { id } = req.params;

    const worker = await Worker.findByPk(id, {
      include: [
        {
          model: WorkerOpportunity,
          as: 'opportunities',
          include: [
            { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
          ],
          order: [['startDate', 'DESC']]
        }
      ]
    });

    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    res.json(worker);
  } catch (error) {
    console.error('Error fetching worker:', error);
    res.status(500).json({ message: 'Error fetching worker', error: error.message });
  }
};

/**
 * Create new worker profile
 */
exports.createWorker = async (req, res) => {
  try {
    const { name, nationalId, phone, email, nationalIdPhoto } = req.body;

    if (!name || !nationalId || !phone) {
      return res.status(400).json({
        message: 'Name, national ID, and phone are required',
        messageAr: 'الاسم ورقم الهوية ورقم الجوال مطلوبة'
      });
    }

    // Check if worker with same national ID exists
    const existing = await Worker.findOne({ where: { nationalId } });
    if (existing) {
      return res.status(409).json({
        message: 'Worker with this national ID already exists',
        messageAr: 'يوجد عامل بنفس رقم الهوية',
        existingWorker: existing
      });
    }

    const worker = await Worker.create({
      name,
      nationalId,
      phone,
      email: email || null,
      nationalIdPhoto: nationalIdPhoto || null
    });

    res.status(201).json(worker);
  } catch (error) {
    console.error('Error creating worker:', error);
    res.status(500).json({ message: 'Error creating worker', error: error.message });
  }
};

/**
 * Update worker profile
 */
exports.updateWorker = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, nationalId, phone, email, nationalIdPhoto, isActive } = req.body;

    const worker = await Worker.findByPk(id);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    // Check if national ID is being changed and if new one already exists
    if (nationalId && nationalId !== worker.nationalId) {
      const existing = await Worker.findOne({ where: { nationalId } });
      if (existing) {
        return res.status(409).json({
          message: 'Another worker with this national ID already exists',
          messageAr: 'يوجد عامل آخر بنفس رقم الهوية'
        });
      }
    }

    await worker.update({
      name: name !== undefined ? name : worker.name,
      nationalId: nationalId !== undefined ? nationalId : worker.nationalId,
      phone: phone !== undefined ? phone : worker.phone,
      email: email !== undefined ? email : worker.email,
      nationalIdPhoto: nationalIdPhoto !== undefined ? nationalIdPhoto : worker.nationalIdPhoto,
      isActive: isActive !== undefined ? isActive : worker.isActive
    });

    res.json(worker);
  } catch (error) {
    console.error('Error updating worker:', error);
    res.status(500).json({ message: 'Error updating worker', error: error.message });
  }
};

/**
 * Delete worker
 */
exports.deleteWorker = async (req, res) => {
  try {
    const { id } = req.params;
    const { force } = req.query;

    const worker = await Worker.findByPk(id);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    // Check if worker has opportunities
    const opportunityCount = await WorkerOpportunity.count({ where: { workerId: id } });
    if (opportunityCount > 0 && force !== 'true') {
      return res.status(400).json({
        message: 'Cannot delete worker with existing opportunities. Use force=true to delete all records.',
        messageAr: 'لا يمكن حذف عامل لديه فرص عمل. استخدم الحذف القسري لحذف جميع السجلات.',
        opportunityCount,
        requiresForce: true
      });
    }

    // If force delete, delete all related records first
    if (opportunityCount > 0 && force === 'true') {
      // Delete ratings for this worker's opportunities
      await WorkerRating.destroy({
        where: {
          workerId: id
        }
      });
      // Delete all opportunities
      await WorkerOpportunity.destroy({ where: { workerId: id } });
    }

    await worker.destroy();
    res.json({ message: 'Worker deleted successfully' });
  } catch (error) {
    console.error('Error deleting worker:', error);
    res.status(500).json({ message: 'Error deleting worker', error: error.message });
  }
};

// ============== WORKER OPPORTUNITY MANAGEMENT ==============

/**
 * Get all opportunities (with optional filters)
 */
exports.getAllOpportunities = async (req, res) => {
  try {
    const { workerId, status, startDate, endDate } = req.query;
    const whereClause = {};

    if (workerId) whereClause.workerId = workerId;
    if (status) whereClause.status = status;

    if (startDate && endDate) {
      whereClause.startDate = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      whereClause.startDate = { [Op.gte]: startDate };
    } else if (endDate) {
      whereClause.startDate = { [Op.lte]: endDate };
    }

    const opportunities = await WorkerOpportunity.findAll({
      where: whereClause,
      include: [
        { model: Worker, as: 'worker', attributes: ['workerId', 'name', 'nationalId', 'phone', 'email'] },
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
 * Create new opportunity for a worker
 */
exports.createOpportunity = async (req, res) => {
  try {
    const {
      workerId,
      title,
      description,
      startDate,
      endDate,
      dailyHours,
      rating,
      ratingCriteria,
      ratingNotes
    } = req.body;

    if (!workerId || !title || !startDate || !endDate) {
      return res.status(400).json({
        message: 'Worker, title, start date, and end date are required',
        messageAr: 'العامل والعنوان وتاريخ البدء والانتهاء مطلوبة'
      });
    }

    // Verify worker exists
    const worker = await Worker.findByPk(workerId);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    // Calculate total hours
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    // Workers don't supply dailyHours upfront — billable hours come from
    // per-day attendance entered later in the worker profile. Default to
    // 0 so the legacy "hours × days" field stays meaningful but unused.
    const hours = dailyHours || 0;
    const totalHours = days * hours;

    const opportunity = await WorkerOpportunity.create({
      workerId,
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
    const createdOpportunity = await WorkerOpportunity.findByPk(opportunity.opportunityId, {
      include: [
        { model: Worker, as: 'worker', attributes: ['workerId', 'name', 'nationalId', 'phone', 'email'] },
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
      attendanceDays,
      rating,
      ratingCriteria,
      ratingNotes,
      status
    } = req.body;

    const opportunity = await WorkerOpportunity.findByPk(id);
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
      attendanceDays: attendanceDays !== undefined ? attendanceDays : opportunity.attendanceDays,
      rating: rating !== undefined ? rating : opportunity.rating,
      ratingCriteria: ratingCriteria !== undefined ? ratingCriteria : opportunity.ratingCriteria,
      ratingNotes: ratingNotes !== undefined ? ratingNotes : opportunity.ratingNotes,
      status: status !== undefined ? status : opportunity.status
    });

    // Fetch with associations
    const updatedOpportunity = await WorkerOpportunity.findByPk(id, {
      include: [
        { model: Worker, as: 'worker', attributes: ['workerId', 'name', 'nationalId', 'phone', 'email'] },
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
 * Adjust hours for an opportunity (increase/decrease)
 */
exports.adjustOpportunityHours = async (req, res) => {
  try {
    const { id } = req.params;
    const { adjustment, reason } = req.body;

    if (adjustment === undefined || adjustment === null) {
      return res.status(400).json({
        message: 'Adjustment value is required',
        messageAr: 'قيمة التعديل مطلوبة'
      });
    }

    const opportunity = await WorkerOpportunity.findByPk(id);
    if (!opportunity) {
      return res.status(404).json({ message: 'Opportunity not found' });
    }

    // Update the adjustment
    const currentAdjustment = opportunity.hoursAdjustment || 0;
    const newAdjustment = currentAdjustment + parseFloat(adjustment);

    await opportunity.update({
      hoursAdjustment: newAdjustment,
      adjustmentReason: reason || opportunity.adjustmentReason
    });

    // Fetch with associations
    const updatedOpportunity = await WorkerOpportunity.findByPk(id, {
      include: [
        { model: Worker, as: 'worker', attributes: ['workerId', 'name', 'nationalId', 'phone', 'email'] },
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
      ]
    });

    res.json({
      message: 'Hours adjusted successfully',
      messageAr: 'تم تعديل الساعات بنجاح',
      opportunity: updatedOpportunity,
      effectiveHours: (updatedOpportunity.totalHours || 0) + (updatedOpportunity.hoursAdjustment || 0)
    });
  } catch (error) {
    console.error('Error adjusting opportunity hours:', error);
    res.status(500).json({ message: 'Error adjusting hours', error: error.message });
  }
};

/**
 * Delete opportunity
 */
exports.deleteOpportunity = async (req, res) => {
  try {
    const { id } = req.params;

    const opportunity = await WorkerOpportunity.findByPk(id);
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
    const { workerId, startDate, endDate, status } = req.query;
    const whereClause = {};

    if (workerId && workerId !== 'all') whereClause.workerId = workerId;
    if (status && status !== 'all') whereClause.status = status;

    if (startDate && endDate) {
      whereClause.startDate = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      whereClause.startDate = { [Op.gte]: startDate };
    } else if (endDate) {
      whereClause.startDate = { [Op.lte]: endDate };
    }

    const opportunities = await WorkerOpportunity.findAll({
      where: whereClause,
      include: [
        { model: Worker, as: 'worker', attributes: ['name', 'nationalId', 'phone', 'email'] }
      ],
      order: [['startDate', 'DESC']]
    });

    // Create CSV content
    const headers = [
      'Worker Name', 'National ID', 'Phone', 'Email',
      'Opportunity Title', 'Start Date', 'End Date', 'Daily Hours', 'Total Hours',
      'Rating', 'Rating Criteria', 'Status'
    ];

    const rows = opportunities.map(o => [
      o.worker?.name || 'N/A',
      o.worker?.nationalId || 'N/A',
      o.worker?.phone || 'N/A',
      o.worker?.email || 'N/A',
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
    res.setHeader('Content-Disposition', `attachment; filename="worker_opportunities_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(bom + csvContent);
  } catch (error) {
    console.error('Error exporting opportunities:', error);
    res.status(500).json({ message: 'Error exporting opportunities', error: error.message });
  }
};

// ============== WORKER RATINGS ==============

/**
 * Get all ratings for a worker
 */
exports.getWorkerRatings = async (req, res) => {
  try {
    const { workerId } = req.params;
    const { startDate, endDate } = req.query;

    const where = { workerId };

    if (startDate && endDate) {
      where.ratingDate = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      where.ratingDate = { [Op.gte]: startDate };
    } else if (endDate) {
      where.ratingDate = { [Op.lte]: endDate };
    }

    const ratings = await WorkerRating.findAll({
      where,
      include: [
        { model: WorkerOpportunity, as: 'opportunity', attributes: ['opportunityId', 'title'] },
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
    console.error('Error fetching worker ratings:', error);
    res.status(500).json({ message: 'Error fetching ratings', error: error.message });
  }
};

/**
 * Create a worker rating
 */
exports.createWorkerRating = async (req, res) => {
  try {
    const { workerId, opportunityId, type, points, criteria, notes, ratingDate } = req.body;

    if (!req.admin || !req.admin.adminId) {
      return res.status(401).json({ message: 'Admin authentication required' });
    }

    if (!workerId || !type || points === undefined) {
      return res.status(400).json({ message: 'Worker ID, type, and points are required' });
    }

    // Verify worker exists
    const worker = await Worker.findByPk(workerId);
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    const rating = await WorkerRating.create({
      workerId,
      opportunityId: opportunityId || null,
      createdById: req.admin.adminId,
      type,
      points: parseInt(points, 10),
      criteria: criteria || null,
      notes: notes || null,
      ratingDate: ratingDate || new Date().toISOString().split('T')[0]
    });

    // Fetch with associations
    const createdRating = await WorkerRating.findByPk(rating.ratingId, {
      include: [
        { model: Worker, as: 'worker', attributes: ['workerId', 'name'] },
        { model: WorkerOpportunity, as: 'opportunity', attributes: ['opportunityId', 'title'] },
        { model: Admin, as: 'ratedBy', attributes: ['adminId', 'fullName', 'email'] }
      ]
    });

    res.status(201).json(createdRating);
  } catch (error) {
    console.error('Error creating worker rating:', error);
    res.status(500).json({ message: 'Error creating rating', error: error.message });
  }
};

/**
 * Delete a worker rating
 */
exports.deleteWorkerRating = async (req, res) => {
  try {
    const { id } = req.params;

    const rating = await WorkerRating.findByPk(id);
    if (!rating) {
      return res.status(404).json({ message: 'Rating not found' });
    }

    await rating.destroy();
    res.json({ message: 'Rating deleted successfully' });
  } catch (error) {
    console.error('Error deleting worker rating:', error);
    res.status(500).json({ message: 'Error deleting rating', error: error.message });
  }
};

// ============== WORKER RECEIPTS (سند استلام) ==============

exports.listWorkerReceipts = async (req, res) => {
  try {
    const receipts = await WorkerReceipt.findAll({
      where: { workerId: req.params.id },
      include: [{ model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }],
      order: [['receiptDate', 'DESC'], ['createdAt', 'DESC']]
    });
    res.json(receipts);
  } catch (err) {
    console.error('Error listing worker receipts:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createWorkerReceipt = async (req, res) => {
  try {
    const { recipientName, nationalId, amount, purpose, note, receiptDate, recipientPhone } = req.body || {};
    if (!recipientName || !amount || !receiptDate) {
      return res.status(400).json({ message: 'recipientName, amount and receiptDate are required' });
    }
    const worker = await Worker.findByPk(req.params.id);
    if (!worker) return res.status(404).json({ message: 'Worker not found' });

    const receipt = await WorkerReceipt.create({
      workerId: worker.workerId,
      recipientName,
      nationalId: nationalId || null,
      amount,
      purpose: purpose || null,
      note: note || null,
      receiptDate,
      recipientPhone: recipientPhone || null,
      createdById: req.admin?.adminId || null
    });
    res.status(201).json(receipt);
  } catch (err) {
    console.error('Error creating worker receipt:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.deleteWorkerReceipt = async (req, res) => {
  try {
    const receipt = await WorkerReceipt.findByPk(req.params.id);
    if (!receipt) return res.status(404).json({ message: 'Receipt not found' });
    await receipt.destroy();
    res.json({ message: 'Receipt deleted' });
  } catch (err) {
    console.error('Error deleting worker receipt:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = exports;
