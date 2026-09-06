const { Workspace, WorkspaceRating, Admin } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');

// Riyadh "now" as YYYY-MM-DD + HH:mm, used to auto-promote 'active'
// workspaces whose end period has passed to 'completed' on the way
// out. DB stays whatever the admin last set — we compute the effective
// status at response time so it always reflects the wall clock.
const _riyadhNow = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date());
  const g = (t) => parts.find(p => p.type === t).value;
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour')}:${g('minute')}` };
};

// 'cancelled' + 'completed' pass through as-is. 'active' with a
// past end-of-period becomes 'completed'.
const _effectiveWorkspaceStatus = (ws, now) => {
  const s = ws?.status || 'active';
  if (s !== 'active') return s;
  const endDate = ws?.endDate ? String(ws.endDate).slice(0, 10) : null;
  const endTime = ws?.endTime ? String(ws.endTime).slice(0, 5) : '23:59';
  if (!endDate) return s;
  if (endDate < now.date) return 'completed';
  if (endDate === now.date && endTime <= now.time) return 'completed';
  return s;
};

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

    // Promote 'active' past-end rows to 'completed' at response time
    // so the UI always shows current reality. DB row untouched unless
    // client posts /complete or /extend or the boot backfill runs.
    const now = _riyadhNow();
    const shaped = workspaces.map(w => {
      const json = w.toJSON();
      json.status = _effectiveWorkspaceStatus(json, now);
      return json;
    });
    res.json(shaped);
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

    const now = _riyadhNow();
    const shaped = workspace.toJSON();
    shaped.status = _effectiveWorkspaceStatus(shaped, now);
    res.json(shaped);
  } catch (error) {
    console.error('Error fetching workspace:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Extend an existing workspace's period — pushes endDate/endTime out
 * so the admin doesn't have to create a brand-new row when a table
 * is re-booked or an active session runs long. Also flips status
 * back to 'active' if the workspace was auto-completed by an
 * already-passed end date.
 *
 * PATCH /workspaces/:id/extend  body: { endDate, endTime }
 */
exports.extendWorkspace = async (req, res) => {
  try {
    const { id } = req.params;
    const { endDate, endTime } = req.body || {};

    if (!endDate || !endTime) {
      return res.status(400).json({
        message: 'endDate and endTime are required',
        messageAr: 'تاريخ ووقت النهاية الجديدين مطلوبان'
      });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(endDate)) || !/^\d{2}:\d{2}(:\d{2})?$/.test(String(endTime))) {
      return res.status(400).json({
        message: 'Invalid date/time format',
        messageAr: 'صيغة التاريخ أو الوقت غير صحيحة'
      });
    }

    const workspace = await Workspace.findByPk(id);
    if (!workspace) {
      return res.status(404).json({
        message: 'Workspace not found',
        messageAr: 'مساحة العمل غير موجودة'
      });
    }
    if (workspace.status === 'cancelled') {
      return res.status(409).json({
        message: 'Cannot extend a cancelled workspace',
        messageAr: 'لا يمكن تمديد مساحة ملغاة'
      });
    }

    // Sanity: the new end must be strictly after the existing start.
    const startKey = `${String(workspace.startDate).slice(0, 10)}T${String(workspace.startTime).slice(0, 5)}`;
    const endKey   = `${endDate}T${String(endTime).slice(0, 5)}`;
    if (endKey <= startKey) {
      return res.status(400).json({
        message: 'New end must be after the workspace start',
        messageAr: 'نهاية التمديد يجب أن تكون بعد بداية المساحة'
      });
    }

    // Extending also RE-OPENS the workspace: sets status back to
    // 'active' so it stops rendering as completed in the UI.
    await workspace.update({
      endDate,
      endTime: String(endTime).length === 5 ? `${endTime}:00` : endTime,
      status: 'active'
    });

    // Return shaped so the client sees the effective status right
    // away (should be 'active' — the new endTime is in the future).
    const now = _riyadhNow();
    const shaped = workspace.toJSON();
    shaped.status = _effectiveWorkspaceStatus(shaped, now);
    res.json({
      message: 'Workspace extended',
      messageAr: 'تم تمديد فترة مساحة العمل',
      workspace: shaped
    });
  } catch (error) {
    console.error('Error extending workspace:', error);
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

    const MAX_ACTIVE_WORKSPACES = 8;
    const activeCount = await Workspace.count({ where: { status: 'active' } });
    if (activeCount >= MAX_ACTIVE_WORKSPACES) {
      return res.status(400).json({
        message: `Maximum of ${MAX_ACTIVE_WORKSPACES} active workspaces reached. Please complete or cancel an existing workspace first.`,
        messageAr: `تم الوصول للحد الأقصى ${MAX_ACTIVE_WORKSPACES} مساحات عمل نشطة. يرجى إكمال أو إلغاء مساحة عمل حالية أولاً.`
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
