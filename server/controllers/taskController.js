const { Task, Employee, Admin, Rating } = require('../models');
const { Op } = require('sequelize');

/**
 * Get all tasks with optional filters
 */
exports.getAllTasks = async (req, res) => {
  try {
    const { status, employeeId, section, startDate, endDate } = req.query;
    const whereClause = {};

    if (status) whereClause.status = status;
    if (employeeId) whereClause.employeeId = employeeId;
    if (section) whereClause.section = section;

    if (startDate && endDate) {
      whereClause.dueDate = {
        [Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      whereClause.dueDate = {
        [Op.gte]: startDate
      };
    } else if (endDate) {
      whereClause.dueDate = {
        [Op.lte]: endDate
      };
    }

    const tasks = await Task.findAll({
      where: whereClause,
      include: [
        { model: Employee, as: 'assignee', attributes: ['employeeId', 'name', 'email', 'section'] },
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName', 'role'] }
      ],
      order: [['dueDate', 'ASC'], ['priority', 'DESC'], ['createdAt', 'DESC']]
    });

    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get all tasks (each task is a single entry, may have date range)
 */
exports.getGroupedTasks = async (req, res) => {
  try {
    const { status, employeeId, section, showAll } = req.query;
    const whereClause = {};

    if (status) whereClause.status = status;
    if (employeeId) whereClause.employeeId = employeeId;
    if (section) whereClause.section = section;

    // If user is a manager and not requesting all tasks, only show tasks they created
    // Admins can see all tasks
    if (req.admin && req.admin.role === 'manager' && showAll !== 'true') {
      whereClause.createdById = req.admin.adminId;
    }

    const tasks = await Task.findAll({
      where: whereClause,
      include: [
        { model: Employee, as: 'assignee', attributes: ['employeeId', 'name', 'email', 'section'] },
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName', 'role'] }
      ],
      order: [['dueDate', 'DESC'], ['createdAt', 'DESC']]
    });

    // Format tasks with consistent structure
    const formattedTasks = tasks.map(task => {
      const startDate = task.dueDate;
      const endDate = task.dueDateEnd || task.dueDate;

      // Calculate day count
      const start = new Date(startDate);
      const end = new Date(endDate);
      const dayCount = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

      return {
        taskId: task.taskId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        section: task.section,
        notes: task.notes,
        assignee: task.assignee,
        creator: task.creator,
        employeeId: task.employeeId,
        createdById: task.createdById,
        startDate,
        endDate,
        dueTime: task.dueTime,
        dayCount,
        createdAt: task.createdAt
      };
    });

    res.json(formattedTasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get a single task by ID
 */
exports.getTaskById = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await Task.findByPk(id, {
      include: [
        { model: Employee, as: 'assignee', attributes: ['employeeId', 'name', 'email', 'section'] },
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName', 'role'] }
      ]
    });

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Create a new task (single entry, can span multiple days)
 */
exports.createTask = async (req, res) => {
  try {
    const { title, description, employeeId, dueDate, dueDateEnd, dueTime, priority, section, notes } = req.body;

    // Validate required fields
    if (!title || !employeeId || !dueDate) {
      return res.status(400).json({
        message: 'Title, employee, and due date are required',
        messageAr: 'العنوان والموظف وتاريخ الاستحقاق مطلوبة'
      });
    }

    // Verify employee exists
    const employee = await Employee.findByPk(employeeId);
    if (!employee) {
      return res.status(404).json({
        message: 'Employee not found',
        messageAr: 'الموظف غير موجود'
      });
    }

    const { dueTimeEnd, blocksCalendar } = req.body;

    // Create a single task (with optional end date for multi-day assignments)
    const task = await Task.create({
      title,
      description,
      employeeId,
      createdById: req.admin.adminId,
      dueDate,
      dueDateEnd: dueDateEnd || null,
      dueTime: dueTime || null,
      dueTimeEnd: dueTimeEnd || null,
      blocksCalendar: blocksCalendar || false,
      priority: priority || 'medium',
      section: section || employee.section,
      notes
    });

    // Fetch with associations
    const createdTask = await Task.findByPk(task.taskId, {
      include: [
        { model: Employee, as: 'assignee', attributes: ['employeeId', 'name', 'email', 'section'] },
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName', 'role'] }
      ]
    });

    res.status(201).json(createdTask);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Update a task
 */
exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, employeeId, dueDate, dueTime, dueTimeEnd, blocksCalendar, priority, status, section, notes } = req.body;

    const task = await Task.findByPk(id);

    if (!task) {
      return res.status(404).json({
        message: 'Task not found',
        messageAr: 'المهمة غير موجودة'
      });
    }

    // If changing employee, verify new employee exists
    if (employeeId && employeeId !== task.employeeId) {
      const employee = await Employee.findByPk(employeeId);
      if (!employee) {
        return res.status(404).json({
          message: 'Employee not found',
          messageAr: 'الموظف غير موجود'
        });
      }
    }

    await task.update({
      title: title !== undefined ? title : task.title,
      description: description !== undefined ? description : task.description,
      employeeId: employeeId !== undefined ? employeeId : task.employeeId,
      dueDate: dueDate !== undefined ? dueDate : task.dueDate,
      dueTime: dueTime !== undefined ? dueTime : task.dueTime,
      dueTimeEnd: dueTimeEnd !== undefined ? dueTimeEnd : task.dueTimeEnd,
      blocksCalendar: blocksCalendar !== undefined ? blocksCalendar : task.blocksCalendar,
      priority: priority !== undefined ? priority : task.priority,
      status: status !== undefined ? status : task.status,
      section: section !== undefined ? section : task.section,
      notes: notes !== undefined ? notes : task.notes
    });

    const updatedTask = await Task.findByPk(id, {
      include: [
        { model: Employee, as: 'assignee', attributes: ['employeeId', 'name', 'email', 'section'] },
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName', 'role'] }
      ]
    });

    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Delete a task
 */
exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await Task.findByPk(id);

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

/**
 * Get tasks formatted for calendar view
 */
exports.getTasksForCalendar = async (req, res) => {
  try {
    const { section, employeeId } = req.query;
    const whereClause = {
      status: { [Op.ne]: 'cancelled' }
    };

    if (section) whereClause.section = section;
    if (employeeId) whereClause.employeeId = employeeId;

    const tasks = await Task.findAll({
      where: whereClause,
      include: [
        { model: Employee, as: 'assignee', attributes: ['name', 'email', 'section'] }
      ],
      order: [['dueDate', 'ASC'], ['dueTime', 'ASC']]
    });

    // Format for calendar view (consistent with getSchedule format)
    const calendarTasks = tasks.map(task => ({
      id: task.taskId,
      title: task.title,
      date: task.dueDate,
      startTime: task.dueTime,
      endTime: null,
      section: task.section,
      type: 'task',
      priority: task.priority,
      status: task.status,
      assignee: task.assignee?.name,
      assigneeEmail: task.assignee?.email,
      description: task.description,
      notes: task.notes
    }));

    res.json(calendarTasks);
  } catch (error) {
    console.error('Error fetching tasks for calendar:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Update task status only
 * When status changes to 'completed', automatically awards 1 point to the employee
 * Points are ONLY awarded when:
 * - The task was assigned by a manager to an employee (not self-assigned)
 * - The manager (different person) marks the task as completed
 */
exports.updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        message: 'Invalid status',
        messageAr: 'حالة غير صالحة'
      });
    }

    const task = await Task.findByPk(id);

    if (!task) {
      return res.status(404).json({
        message: 'Task not found',
        messageAr: 'المهمة غير موجودة'
      });
    }

    // Check if task is being marked as completed (and wasn't already completed)
    const wasCompleted = task.status === 'completed';
    const isBeingCompleted = status === 'completed';

    await task.update({ status });

    // Auto-award 1 point to employee when task is completed
    // Only award points if:
    // 1. Task is being completed and wasn't already completed
    // 2. Task has an assigned employee
    // 3. The admin/manager marking it complete is NOT the same person as the employee
    //    (prevents employees from giving themselves points by creating and completing their own tasks)
    let awardedRating = null;
    if (isBeingCompleted && !wasCompleted && task.employeeId && req.admin) {
      try {
        // Fetch the employee to compare emails
        const employee = await Employee.findByPk(task.employeeId);

        // Only award points if the admin's email is different from the employee's email
        // This ensures points are only given when a manager completes a task assigned to someone else
        const isSamePerson = employee && req.admin.email && employee.email &&
                            req.admin.email.toLowerCase() === employee.email.toLowerCase();

        if (!isSamePerson) {
          awardedRating = await Rating.create({
            employeeId: task.employeeId,
            createdById: req.admin.adminId,
            type: 'award',
            points: 1,
            criteria: 'Task Completion',
            notes: `Completed task: "${task.title}"`,
            ratingDate: new Date().toISOString().split('T')[0]
          });
          console.log(`Auto-awarded 1 point to employee ${task.employeeId} for completing task: ${task.title}`);
        } else {
          console.log(`No points awarded - task completed by same person (self-assigned task): ${task.title}`);
        }
      } catch (ratingError) {
        console.error('Error creating auto-rating for task completion:', ratingError);
        // Don't fail the request if rating creation fails
      }
    }

    res.json({
      message: isBeingCompleted && awardedRating
        ? 'Task completed and 1 point awarded to employee'
        : 'Task status updated',
      messageAr: isBeingCompleted && awardedRating
        ? 'تم إكمال المهمة ومنح نقطة واحدة للموظف'
        : 'تم تحديث حالة المهمة',
      task,
      awardedRating
    });
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = exports;
