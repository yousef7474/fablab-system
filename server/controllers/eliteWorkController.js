const { EliteWork, EliteUser, EliteTask, Admin } = require('../models');
const { Op } = require('sequelize');

// GET /api/elite/works - Get all works (admin)
exports.getAllWorks = async (req, res) => {
  try {
    const { eliteId, status, category } = req.query;

    const whereClause = {};
    if (eliteId) whereClause.eliteId = eliteId;
    if (status) whereClause.status = status;
    if (category) whereClause.category = category;

    const works = await EliteWork.findAll({
      where: whereClause,
      include: [
        { model: EliteUser, as: 'eliteUser', attributes: ['eliteId', 'firstName', 'lastName', 'uniqueId'] },
        { model: EliteTask, as: 'task', attributes: ['taskId', 'title', 'type'] },
        { model: Admin, as: 'reviewer', attributes: ['adminId', 'fullName'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(works);
  } catch (error) {
    console.error('Error fetching elite works:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /api/elite/works/user/:eliteId - Get works for specific user
exports.getWorksByEliteId = async (req, res) => {
  try {
    const { eliteId } = req.params;
    const { status } = req.query;

    const whereClause = { eliteId };
    if (status) whereClause.status = status;

    const works = await EliteWork.findAll({
      where: whereClause,
      include: [
        { model: EliteTask, as: 'task', attributes: ['taskId', 'title', 'type'] },
        { model: Admin, as: 'reviewer', attributes: ['adminId', 'fullName'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Calculate stats
    const stats = {
      total: works.length,
      draft: works.filter(w => w.status === 'draft').length,
      submitted: works.filter(w => w.status === 'submitted').length,
      approved: works.filter(w => w.status === 'approved').length,
      rejected: works.filter(w => w.status === 'rejected').length
    };

    res.json({ works, stats });
  } catch (error) {
    console.error('Error fetching user works:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /api/elite/works/:workId - Get single work
exports.getWorkById = async (req, res) => {
  try {
    const { workId } = req.params;

    const work = await EliteWork.findByPk(workId, {
      include: [
        { model: EliteUser, as: 'eliteUser', attributes: ['eliteId', 'firstName', 'lastName', 'uniqueId', 'email'] },
        { model: EliteTask, as: 'task', attributes: ['taskId', 'title', 'type', 'description'] },
        { model: Admin, as: 'reviewer', attributes: ['adminId', 'fullName'] }
      ]
    });

    if (!work) {
      return res.status(404).json({
        message: 'Work not found',
        messageAr: 'العمل غير موجود'
      });
    }

    res.json(work);
  } catch (error) {
    console.error('Error fetching work:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// POST /api/elite/works - Create work (user submits)
exports.createWork = async (req, res) => {
  try {
    const {
      eliteId,
      taskId,
      title,
      description,
      category,
      files,
      thumbnail,
      documentation,
      status
    } = req.body;

    // Validation
    if (!eliteId || !title) {
      return res.status(400).json({
        message: 'Elite ID and title are required',
        messageAr: 'معرف العضو والعنوان مطلوبان'
      });
    }

    // Check if elite user exists
    const eliteUser = await EliteUser.findByPk(eliteId);
    if (!eliteUser) {
      return res.status(404).json({
        message: 'Elite user not found',
        messageAr: 'المستخدم غير موجود'
      });
    }

    // If taskId provided, check if task exists
    if (taskId) {
      const task = await EliteTask.findByPk(taskId);
      if (!task) {
        return res.status(404).json({
          message: 'Task not found',
          messageAr: 'المهمة غير موجودة'
        });
      }
    }

    const work = await EliteWork.create({
      eliteId,
      taskId: taskId || null,
      title,
      description,
      category,
      files: files || [],
      thumbnail,
      documentation,
      status: status || 'draft'
    });

    const createdWork = await EliteWork.findByPk(work.workId, {
      include: [
        { model: EliteUser, as: 'eliteUser', attributes: ['eliteId', 'firstName', 'lastName', 'uniqueId'] },
        { model: EliteTask, as: 'task', attributes: ['taskId', 'title', 'type'] }
      ]
    });

    res.status(201).json({
      message: 'Work created successfully',
      messageAr: 'تم إنشاء العمل بنجاح',
      work: createdWork
    });
  } catch (error) {
    console.error('Error creating work:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// PUT /api/elite/works/:workId - Update work
exports.updateWork = async (req, res) => {
  try {
    const { workId } = req.params;
    const updates = req.body;

    const work = await EliteWork.findByPk(workId);
    if (!work) {
      return res.status(404).json({
        message: 'Work not found',
        messageAr: 'العمل غير موجود'
      });
    }

    // Don't allow editing if already approved
    if (work.status === 'approved' && !req.admin) {
      return res.status(400).json({
        message: 'Cannot edit approved work',
        messageAr: 'لا يمكن تعديل العمل المعتمد'
      });
    }

    await work.update(updates);

    const updatedWork = await EliteWork.findByPk(workId, {
      include: [
        { model: EliteUser, as: 'eliteUser', attributes: ['eliteId', 'firstName', 'lastName', 'uniqueId'] },
        { model: EliteTask, as: 'task', attributes: ['taskId', 'title', 'type'] },
        { model: Admin, as: 'reviewer', attributes: ['adminId', 'fullName'] }
      ]
    });

    res.json({
      message: 'Work updated successfully',
      messageAr: 'تم تحديث العمل بنجاح',
      work: updatedWork
    });
  } catch (error) {
    console.error('Error updating work:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// PATCH /api/elite/works/:workId/submit - Submit for review
exports.submitWork = async (req, res) => {
  try {
    const { workId } = req.params;

    const work = await EliteWork.findByPk(workId);
    if (!work) {
      return res.status(404).json({
        message: 'Work not found',
        messageAr: 'العمل غير موجود'
      });
    }

    if (work.status !== 'draft' && work.status !== 'rejected') {
      return res.status(400).json({
        message: 'Only draft or rejected work can be submitted',
        messageAr: 'يمكن تقديم العمل المسودة أو المرفوض فقط'
      });
    }

    await work.update({ status: 'submitted' });

    res.json({
      message: 'Work submitted successfully',
      messageAr: 'تم تقديم العمل بنجاح',
      work
    });
  } catch (error) {
    console.error('Error submitting work:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// PATCH /api/elite/works/:workId/review - Admin reviews
exports.reviewWork = async (req, res) => {
  try {
    const { workId } = req.params;
    const { status, reviewNotes } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        message: 'Status must be approved or rejected',
        messageAr: 'يجب أن تكون الحالة موافق عليه أو مرفوض'
      });
    }

    const work = await EliteWork.findByPk(workId);
    if (!work) {
      return res.status(404).json({
        message: 'Work not found',
        messageAr: 'العمل غير موجود'
      });
    }

    await work.update({
      status,
      reviewedById: req.admin.adminId,
      reviewDate: new Date(),
      reviewNotes: reviewNotes || null
    });

    const reviewedWork = await EliteWork.findByPk(workId, {
      include: [
        { model: EliteUser, as: 'eliteUser', attributes: ['eliteId', 'firstName', 'lastName', 'uniqueId'] },
        { model: EliteTask, as: 'task', attributes: ['taskId', 'title', 'type'] },
        { model: Admin, as: 'reviewer', attributes: ['adminId', 'fullName'] }
      ]
    });

    res.json({
      message: status === 'approved' ? 'Work approved successfully' : 'Work rejected',
      messageAr: status === 'approved' ? 'تم الموافقة على العمل بنجاح' : 'تم رفض العمل',
      work: reviewedWork
    });
  } catch (error) {
    console.error('Error reviewing work:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// DELETE /api/elite/works/:workId - Delete work
exports.deleteWork = async (req, res) => {
  try {
    const { workId } = req.params;

    const work = await EliteWork.findByPk(workId);
    if (!work) {
      return res.status(404).json({
        message: 'Work not found',
        messageAr: 'العمل غير موجود'
      });
    }

    await work.destroy();

    res.json({
      message: 'Work deleted successfully',
      messageAr: 'تم حذف العمل بنجاح'
    });
  } catch (error) {
    console.error('Error deleting work:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = exports;
