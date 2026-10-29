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

const MAX_ACTIVE_WORKSPACES = 8;

const _normTable = (t) => String(t || '').trim().toLowerCase();

// Rules for a workspace that is (or becomes) active: at most 8 active
// at a time, and a table name can't be reused until the active
// workspace holding it is completed. "Active" is the effective status,
// so rows whose period already ended don't block anything. Returns an
// error body, or null when allowed.
const _activeRulesError = async (tableNumber, { excludeId = null, checkCount = true, checkName = true, transaction } = {}) => {
  const now = _riyadhNow();
  const rows = await Workspace.findAll({
    where: { status: 'active' },
    attributes: ['workspaceId', 'tableNumber', 'status', 'endDate', 'endTime'],
    transaction
  });
  const active = rows.filter(w => w.workspaceId !== excludeId && _effectiveWorkspaceStatus(w, now) === 'active');
  if (checkCount && active.length >= MAX_ACTIVE_WORKSPACES) {
    return {
      message: `Maximum of ${MAX_ACTIVE_WORKSPACES} active workspaces reached. Please complete or cancel an existing workspace first.`,
      messageAr: `تم الوصول للحد الأقصى ${MAX_ACTIVE_WORKSPACES} مساحات عمل نشطة. يرجى إكمال أو إلغاء مساحة عمل حالية أولاً.`
    };
  }
  const name = _normTable(tableNumber);
  if (checkName && name && active.some(w => _normTable(w.tableNumber) === name)) {
    return {
      message: `Table "${String(tableNumber).trim()}" is already used by an active workspace. Complete it first to reuse the name.`,
      messageAr: `الطاولة «${String(tableNumber).trim()}» مستخدمة في مساحة عمل نشطة. أكمل المساحة الحالية أولاً لاستخدام الاسم نفسه.`
    };
  }
  return null;
};

// Create / update / extend run the rules and the write under one
// advisory lock so two admins can't both take the 8th slot or the same
// table at the same moment.
const _withWorkspaceLock = (fn) => sequelize.transaction(async (transaction) => {
  await sequelize.query("SELECT pg_advisory_xact_lock(hashtext('workspaces-active'))", { transaction });
  return fn(transaction);
});

const _HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// Normalises the attendance schedule from the admin form. Returns
// { schedule } (null = every day of the period) or { error }.
const _cleanSchedule = (raw) => {
  if (raw === undefined) return { schedule: undefined };
  if (raw === null || (Array.isArray(raw) && raw.length === 0)) return { schedule: null };
  if (!Array.isArray(raw)) return { error: { message: 'Invalid schedule', messageAr: 'جدول الحضور غير صحيح' } };
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const day = Number(item?.day);
    const startTime = String(item?.startTime || '').slice(0, 5);
    const endTime = String(item?.endTime || '').slice(0, 5);
    if (!Number.isInteger(day) || day < 0 || day > 6 || seen.has(day)) {
      return { error: { message: 'Invalid schedule day', messageAr: 'يوم غير صحيح في جدول الحضور' } };
    }
    if (!_HHMM.test(startTime) || !_HHMM.test(endTime) || endTime <= startTime) {
      return { error: { message: 'Each schedule day needs a start time before its end time', messageAr: 'حدد لكل يوم في جدول الحضور وقت بداية قبل وقت النهاية' } };
    }
    seen.add(day);
    out.push({ day, startTime, endTime });
  }
  out.sort((a, b) => a.day - b.day);
  return { schedule: out };
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
    // 'active' so it stops rendering as completed in the UI. A
    // completed one coming back counts toward the 8 and its table name.
    const wasActive = _effectiveWorkspaceStatus(workspace, _riyadhNow()) === 'active';
    const ruleError = await _withWorkspaceLock(async (transaction) => {
      if (!wasActive) {
        const err = await _activeRulesError(workspace.tableNumber, { excludeId: workspace.workspaceId, transaction });
        if (err) return err;
      }
      await workspace.update({
        endDate,
        endTime: String(endTime).length === 5 ? `${endTime}:00` : endTime,
        status: 'active'
      }, { transaction });
      return null;
    });
    if (ruleError) return res.status(409).json(ruleError);

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
      projectName,
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

    if (!String(tableNumber || '').trim() || !personName || !startDate || !startTime || !endDate || !endTime) {
      return res.status(400).json({
        message: 'Table number, person name, and period are required',
        messageAr: 'رقم الطاولة واسم الشخص المسؤول والفترة مطلوبة'
      });
    }

    const { schedule, error: scheduleError } = _cleanSchedule(req.body.schedule);
    if (scheduleError) return res.status(400).json(scheduleError);

    const fields = {
      tableNumber: String(tableNumber).trim(),
      projectName: projectName || null,
      numberOfUsers: numberOfUsers || 1,
      personName,
      personPhone,
      personEmail,
      startDate,
      startTime,
      endDate,
      endTime,
      schedule: schedule || null,
      photoBefore,
      notes,
      createdById: req.admin.adminId
    };

    // A workspace recorded after its period ended is already completed
    // and doesn't take a slot.
    const isActive = _effectiveWorkspaceStatus({ status: 'active', endDate, endTime }, _riyadhNow()) === 'active';
    const result = await _withWorkspaceLock(async (transaction) => {
      if (isActive) {
        const err = await _activeRulesError(fields.tableNumber, { transaction });
        if (err) return { err };
      }
      return { workspace: await Workspace.create(fields, { transaction }) };
    });
    if (result.err) return res.status(409).json(result.err);
    const { workspace } = result;

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
      projectName,
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

    if (tableNumber !== undefined && !String(tableNumber || '').trim()) {
      return res.status(400).json({ message: 'Table number is required', messageAr: 'رقم الطاولة مطلوب' });
    }
    const { schedule, error: scheduleError } = _cleanSchedule(req.body.schedule);
    if (scheduleError) return res.status(400).json(scheduleError);

    const next = {
      tableNumber: tableNumber !== undefined ? String(tableNumber).trim() : workspace.tableNumber,
      projectName: projectName !== undefined ? (projectName || null) : workspace.projectName,
      numberOfUsers: numberOfUsers !== undefined ? numberOfUsers : workspace.numberOfUsers,
      personName: personName !== undefined ? personName : workspace.personName,
      personPhone: personPhone !== undefined ? personPhone : workspace.personPhone,
      personEmail: personEmail !== undefined ? personEmail : workspace.personEmail,
      startDate: startDate !== undefined ? startDate : workspace.startDate,
      startTime: startTime !== undefined ? startTime : workspace.startTime,
      endDate: endDate !== undefined ? endDate : workspace.endDate,
      endTime: endTime !== undefined ? endTime : workspace.endTime,
      schedule: schedule !== undefined ? schedule : workspace.schedule,
      photoBefore: photoBefore !== undefined ? photoBefore : workspace.photoBefore,
      photoAfter: photoAfter !== undefined ? photoAfter : workspace.photoAfter,
      status: status !== undefined ? status : workspace.status,
      notes: notes !== undefined ? notes : workspace.notes
    };

    // Only a change that makes the workspace active again, or renames
    // an active one, is checked — an untouched active row (even an old
    // duplicate) can still be edited.
    if (!['active', 'completed', 'cancelled'].includes(next.status)) {
      return res.status(400).json({ message: 'Invalid status', messageAr: 'حالة غير صحيحة' });
    }
    const now = _riyadhNow();
    const wasActive = _effectiveWorkspaceStatus(workspace, now) === 'active';
    const willBeActive = _effectiveWorkspaceStatus(next, now) === 'active';
    // Activating (reusing the workspace for a new period) needs a period
    // that hasn't ended yet — otherwise it would just read as completed.
    if (status === 'active' && !willBeActive) {
      return res.status(400).json({
        message: 'The period has already ended — set new dates to activate the workspace',
        messageAr: 'نهاية الفترة في الماضي — حدّث التاريخ والوقت لتفعيل المساحة'
      });
    }
    const renamed = _normTable(next.tableNumber) !== _normTable(workspace.tableNumber);
    const ruleError = await _withWorkspaceLock(async (transaction) => {
      if (willBeActive && (!wasActive || renamed)) {
        const err = await _activeRulesError(next.tableNumber, { excludeId: workspace.workspaceId, checkCount: !wasActive, transaction });
        if (err) return err;
      }
      await workspace.update(next, { transaction });
      return null;
    });
    if (ruleError) return res.status(409).json(ruleError);

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
    // Counted on the effective status (an 'active' row whose period
    // ended is completed), same as the list.
    const now = _riyadhNow();
    const rows = await Workspace.findAll({ attributes: ['status', 'startDate', 'endDate', 'endTime'] });
    const statuses = rows.map(w => _effectiveWorkspaceStatus(w, now));
    const totalWorkspaces = rows.length;
    const activeWorkspaces = statuses.filter(s => s === 'active').length;
    const completedWorkspaces = statuses.filter(s => s === 'completed').length;

    // Today's workspaces
    const todayWorkspaces = rows.filter((w, i) => statuses[i] === 'active'
      && String(w.startDate).slice(0, 10) <= now.date
      && String(w.endDate).slice(0, 10) >= now.date).length;

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
