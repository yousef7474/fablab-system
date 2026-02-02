const { EliteTask, EliteUser, EliteCredit, Admin } = require('../models');
const { Op } = require('sequelize');

// GET /api/elite/tasks - Get all tasks (admin)
exports.getAllTasks = async (req, res) => {
  try {
    const { eliteId, type, status, category } = req.query;

    const whereClause = {};
    if (eliteId) whereClause.eliteId = eliteId;
    if (type) whereClause.type = type;
    if (status) whereClause.status = status;
    if (category) whereClause.category = category;

    const tasks = await EliteTask.findAll({
      where: whereClause,
      include: [
        { model: EliteUser, as: 'eliteUser', attributes: ['eliteId', 'firstName', 'lastName', 'uniqueId'] },
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(tasks);
  } catch (error) {
    console.error('Error fetching elite tasks:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /api/elite/tasks/user/:eliteId - Get tasks for specific user
exports.getTasksByEliteId = async (req, res) => {
  try {
    const { eliteId } = req.params;
    const { status } = req.query;

    const whereClause = { eliteId };
    if (status) whereClause.status = status;

    const tasks = await EliteTask.findAll({
      where: whereClause,
      include: [
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Calculate stats
    const stats = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      totalCreditsEarned: tasks.filter(t => t.status === 'completed').reduce((sum, t) => sum + (t.creditsAwarded || 0), 0)
    };

    res.json({ tasks, stats });
  } catch (error) {
    console.error('Error fetching user tasks:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /api/elite/tasks/:taskId - Get single task
exports.getTaskById = async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await EliteTask.findByPk(taskId, {
      include: [
        { model: EliteUser, as: 'eliteUser', attributes: ['eliteId', 'firstName', 'lastName', 'uniqueId', 'email'] },
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
      ]
    });

    if (!task) {
      return res.status(404).json({
        message: 'Task not found',
        messageAr: 'المهمة غير موجودة'
      });
    }

    res.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// POST /api/elite/tasks - Create task
exports.createTask = async (req, res) => {
  try {
    const {
      eliteId,
      title,
      description,
      type,
      category,
      startDate,
      endDate,
      priority,
      attachments,
      creditsAwarded
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

    const task = await EliteTask.create({
      eliteId,
      createdById: req.admin.adminId,
      title,
      description,
      type: type || 'task',
      category,
      startDate,
      endDate,
      priority: priority || 'medium',
      attachments: attachments || [],
      creditsAwarded: creditsAwarded || 0
    });

    const createdTask = await EliteTask.findByPk(task.taskId, {
      include: [
        { model: EliteUser, as: 'eliteUser', attributes: ['eliteId', 'firstName', 'lastName', 'uniqueId'] },
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
      ]
    });

    res.status(201).json({
      message: 'Task created successfully',
      messageAr: 'تم إنشاء المهمة بنجاح',
      task: createdTask
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// PUT /api/elite/tasks/:taskId - Update task
exports.updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;

    const task = await EliteTask.findByPk(taskId);
    if (!task) {
      return res.status(404).json({
        message: 'Task not found',
        messageAr: 'المهمة غير موجودة'
      });
    }

    await task.update(updates);

    const updatedTask = await EliteTask.findByPk(taskId, {
      include: [
        { model: EliteUser, as: 'eliteUser', attributes: ['eliteId', 'firstName', 'lastName', 'uniqueId'] },
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
      ]
    });

    res.json({
      message: 'Task updated successfully',
      messageAr: 'تم تحديث المهمة بنجاح',
      task: updatedTask
    });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// PATCH /api/elite/tasks/:taskId/progress - Update progress
exports.updateTaskProgress = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { progress } = req.body;

    if (progress === undefined || progress < 0 || progress > 100) {
      return res.status(400).json({
        message: 'Progress must be between 0 and 100',
        messageAr: 'يجب أن يكون التقدم بين 0 و 100'
      });
    }

    const task = await EliteTask.findByPk(taskId);
    if (!task) {
      return res.status(404).json({
        message: 'Task not found',
        messageAr: 'المهمة غير موجودة'
      });
    }

    // Update progress and status
    const updateData = { progress };
    if (progress > 0 && task.status === 'pending') {
      updateData.status = 'in_progress';
    }

    await task.update(updateData);

    res.json({
      message: 'Progress updated successfully',
      messageAr: 'تم تحديث التقدم بنجاح',
      task
    });
  } catch (error) {
    console.error('Error updating progress:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// PATCH /api/elite/tasks/:taskId/complete - Complete task and award credits
exports.completeTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { rating, feedback } = req.body;

    const task = await EliteTask.findByPk(taskId);
    if (!task) {
      return res.status(404).json({
        message: 'Task not found',
        messageAr: 'المهمة غير موجودة'
      });
    }

    if (task.status === 'completed') {
      return res.status(400).json({
        message: 'Task is already completed',
        messageAr: 'المهمة مكتملة بالفعل'
      });
    }

    // Update task
    await task.update({
      status: 'completed',
      progress: 100,
      rating: rating || null,
      feedback: feedback || null
    });

    // Award credits if specified
    if (task.creditsAwarded > 0) {
      await EliteCredit.create({
        eliteId: task.eliteId,
        createdById: req.admin?.adminId || null,
        type: 'award',
        source: 'task',
        points: task.creditsAwarded,
        reason: `Task completed: ${task.title}`,
        referenceType: 'task',
        referenceId: task.taskId
      });
    }

    const completedTask = await EliteTask.findByPk(taskId, {
      include: [
        { model: EliteUser, as: 'eliteUser', attributes: ['eliteId', 'firstName', 'lastName', 'uniqueId'] },
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
      ]
    });

    res.json({
      message: 'Task completed successfully',
      messageAr: 'تم إكمال المهمة بنجاح',
      creditsAwarded: task.creditsAwarded,
      task: completedTask
    });
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// DELETE /api/elite/tasks/:taskId - Delete task
exports.deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await EliteTask.findByPk(taskId);
    if (!task) {
      return res.status(404).json({
        message: 'Task not found',
        messageAr: 'المهمة غير موجودة'
      });
    }

    await task.destroy();

    res.json({
      message: 'Task deleted successfully',
      messageAr: 'تم حذف المهمة بنجاح'
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = exports;
