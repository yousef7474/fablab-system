const { Workspace, WorkspaceRating, Admin } = require('../models');
const { Op } = require('sequelize');

/**
 * Get all workspaces
 */
exports.getAllWorkspaces = async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    const whereClause = {};

    if (status) whereClause.status = status;

    if (startDate && endDate) {
      whereClause.startDate = {
        [Op.between]: [startDate, endDate]
      };
    }

    const workspaces = await Workspace.findAll({
      where: whereClause,
      include: [
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName', 'role'] },
        { model: WorkspaceRating, as: 'ratings' }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(workspaces);
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get workspace by ID
 */
exports.getWorkspaceById = async (req, res) => {
  try {
    const { id } = req.params;

    const workspace = await Workspace.findByPk(id, {
      include: [
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName', 'role'] },
        {
          model: WorkspaceRating,
          as: 'ratings',
          include: [{ model: Admin, as: 'ratedBy', attributes: ['adminId', 'fullName'] }]
        }
      ]
    });

    if (!workspace) {
      return res.status(404).json({
        message: 'Workspace not found',
        messageAr: 'مساحة العمل غير موجودة'
      });
    }

    res.json(workspace);
  } catch (error) {
    console.error('Error fetching workspace:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Create a new workspace
 */
exports.createWorkspace = async (req, res) => {
  try {
    const {
      tableNumber,
      numberOfUsers,
      personName,
      personPhone,
      personEmail,
      startDate,
      startTime,
      endDate,
      endTime,
      photoBefore,
      notes
    } = req.body;

    if (!tableNumber || !personName || !startDate || !startTime || !endDate || !endTime) {
      return res.status(400).json({
        message: 'Table number, person name, and period are required',
        messageAr: 'رقم الطاولة واسم الشخص المسؤول والفترة مطلوبة'
      });
    }

    const workspace = await Workspace.create({
      tableNumber,
      numberOfUsers: numberOfUsers || 1,
      personName,
      personPhone,
      personEmail,
      startDate,
      startTime,
      endDate,
      endTime,
      photoBefore,
      notes,
      createdById: req.admin.adminId
    });

    const createdWorkspace = await Workspace.findByPk(workspace.workspaceId, {
      include: [
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName', 'role'] }
      ]
    });

    res.status(201).json(createdWorkspace);
  } catch (error) {
    console.error('Error creating workspace:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Update workspace
 */
exports.updateWorkspace = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      tableNumber,
      numberOfUsers,
      personName,
      personPhone,
      personEmail,
      startDate,
      startTime,
      endDate,
      endTime,
      photoBefore,
      photoAfter,
      status,
      notes
    } = req.body;

    const workspace = await Workspace.findByPk(id);

    if (!workspace) {
      return res.status(404).json({
        message: 'Workspace not found',
        messageAr: 'مساحة العمل غير موجودة'
      });
    }

    await workspace.update({
      tableNumber: tableNumber !== undefined ? tableNumber : workspace.tableNumber,
      numberOfUsers: numberOfUsers !== undefined ? numberOfUsers : workspace.numberOfUsers,
      personName: personName !== undefined ? personName : workspace.personName,
      personPhone: personPhone !== undefined ? personPhone : workspace.personPhone,
      personEmail: personEmail !== undefined ? personEmail : workspace.personEmail,
      startDate: startDate !== undefined ? startDate : workspace.startDate,
      startTime: startTime !== undefined ? startTime : workspace.startTime,
      endDate: endDate !== undefined ? endDate : workspace.endDate,
      endTime: endTime !== undefined ? endTime : workspace.endTime,
      photoBefore: photoBefore !== undefined ? photoBefore : workspace.photoBefore,
      photoAfter: photoAfter !== undefined ? photoAfter : workspace.photoAfter,
      status: status !== undefined ? status : workspace.status,
      notes: notes !== undefined ? notes : workspace.notes
    });

    const updatedWorkspace = await Workspace.findByPk(id, {
      include: [
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName', 'role'] },
        { model: WorkspaceRating, as: 'ratings' }
      ]
    });

    res.json(updatedWorkspace);
  } catch (error) {
    console.error('Error updating workspace:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Delete workspace
 */
exports.deleteWorkspace = async (req, res) => {
  try {
    const { id } = req.params;

    const workspace = await Workspace.findByPk(id);

    if (!workspace) {
      return res.status(404).json({
        message: 'Workspace not found',
        messageAr: 'مساحة العمل غير موجودة'
      });
    }

    // Delete ratings first
    await WorkspaceRating.destroy({ where: { workspaceId: id } });

    await workspace.destroy();

    res.json({
      message: 'Workspace deleted successfully',
      messageAr: 'تم حذف مساحة العمل بنجاح'
    });
  } catch (error) {
    console.error('Error deleting workspace:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Complete workspace (mark as completed)
 */
exports.completeWorkspace = async (req, res) => {
  try {
    const { id } = req.params;
    const { photoAfter, notes } = req.body;

    const workspace = await Workspace.findByPk(id);

    if (!workspace) {
      return res.status(404).json({
        message: 'Workspace not found',
        messageAr: 'مساحة العمل غير موجودة'
      });
    }

    await workspace.update({
      status: 'completed',
      photoAfter: photoAfter || workspace.photoAfter,
      notes: notes || workspace.notes
    });

    res.json({
      message: 'Workspace marked as completed',
      messageAr: 'تم تحديد مساحة العمل كمكتملة',
      workspace
    });
  } catch (error) {
    console.error('Error completing workspace:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Add rating to workspace
 */
exports.addRating = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, points, criteria, notes, ratingDate } = req.body;

    const workspace = await Workspace.findByPk(id);

    if (!workspace) {
      return res.status(404).json({
        message: 'Workspace not found',
        messageAr: 'مساحة العمل غير موجودة'
      });
    }

    if (!criteria || !points) {
      return res.status(400).json({
        message: 'Criteria and points are required',
        messageAr: 'المعيار والنقاط مطلوبة'
      });
    }

    const rating = await WorkspaceRating.create({
      workspaceId: id,
      type: type || 'award',
      points: Math.abs(points),
      criteria,
      notes,
      ratingDate: ratingDate || new Date().toISOString().split('T')[0],
      createdById: req.admin.adminId
    });

    // Update total points
    const pointChange = type === 'deduct' ? -Math.abs(points) : Math.abs(points);
    await workspace.update({
      totalPoints: workspace.totalPoints + pointChange
    });

    const createdRating = await WorkspaceRating.findByPk(rating.ratingId, {
      include: [{ model: Admin, as: 'ratedBy', attributes: ['adminId', 'fullName'] }]
    });

    res.status(201).json(createdRating);
  } catch (error) {
    console.error('Error adding rating:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get ratings for a workspace
 */
exports.getWorkspaceRatings = async (req, res) => {
  try {
    const { id } = req.params;

    const ratings = await WorkspaceRating.findAll({
      where: { workspaceId: id },
      include: [{ model: Admin, as: 'ratedBy', attributes: ['adminId', 'fullName'] }],
      order: [['createdAt', 'DESC']]
    });

    res.json(ratings);
  } catch (error) {
    console.error('Error fetching workspace ratings:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Delete a rating
 */
exports.deleteRating = async (req, res) => {
  try {
    const { id, ratingId } = req.params;

    const rating = await WorkspaceRating.findOne({
      where: { ratingId, workspaceId: id }
    });

    if (!rating) {
      return res.status(404).json({
        message: 'Rating not found',
        messageAr: 'التقييم غير موجود'
      });
    }

    // Revert points
    const workspace = await Workspace.findByPk(id);
    if (workspace) {
      const pointChange = rating.type === 'deduct' ? Math.abs(rating.points) : -Math.abs(rating.points);
      await workspace.update({
        totalPoints: workspace.totalPoints + pointChange
      });
    }

    await rating.destroy();

    res.json({
      message: 'Rating deleted successfully',
      messageAr: 'تم حذف التقييم بنجاح'
    });
  } catch (error) {
    console.error('Error deleting rating:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get workspace statistics
 */
exports.getStatistics = async (req, res) => {
  try {
    const totalWorkspaces = await Workspace.count();
    const activeWorkspaces = await Workspace.count({ where: { status: 'active' } });
    const completedWorkspaces = await Workspace.count({ where: { status: 'completed' } });

    // Today's workspaces
    const today = new Date().toISOString().split('T')[0];
    const todayWorkspaces = await Workspace.count({
      where: {
        startDate: { [Op.lte]: today },
        endDate: { [Op.gte]: today },
        status: 'active'
      }
    });

    res.json({
      totalWorkspaces,
      activeWorkspaces,
      completedWorkspaces,
      todayWorkspaces
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = exports;
