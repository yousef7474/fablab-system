const { Task, Employee, Admin } = require('../models');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

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
 * Get grouped assignments (multi-day tasks grouped together)
 */
exports.getGroupedTasks = async (req, res) => {
  try {
    const { status, employeeId, section } = req.query;
    const whereClause = {};

    if (status) whereClause.status = status;
    if (employeeId) whereClause.employeeId = employeeId;
    if (section) whereClause.section = section;

    const tasks = await Task.findAll({
      where: whereClause,
      include: [
        { model: Employee, as: 'assignee', attributes: ['employeeId', 'name', 'email', 'section'] },
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName', 'role'] }
      ],
      order: [['groupId', 'ASC'], ['dueDate', 'ASC'], ['createdAt', 'DESC']]
    });

    // Group tasks by groupId
    const groupedMap = new Map();
    const ungrouped = [];

    tasks.forEach(task => {
      if (task.groupId) {
        if (!groupedMap.has(task.groupId)) {
          groupedMap.set(task.groupId, {
            groupId: task.groupId,
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
            startDate: task.dueDate,
            endDate: task.dueDate,
            dueTime: task.dueTime,
            taskIds: [task.taskId],
            dayCount: 1,
            createdAt: task.createdAt
          });
        } else {
          const group = groupedMap.get(task.groupId);
          group.taskIds.push(task.taskId);
          group.dayCount++;
          // Update end date if this task is later
          if (task.dueDate > group.endDate) {
            group.endDate = task.dueDate;
          }
          if (task.dueDate < group.startDate) {
            group.startDate = task.dueDate;
          }
        }
      } else {
        // Single day task - treat as its own group
        ungrouped.push({
          groupId: null,
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
          startDate: task.dueDate,
          endDate: task.dueDate,
          dueTime: task.dueTime,
          taskIds: [task.taskId],
          dayCount: 1,
          createdAt: task.createdAt
        });
      }
    });

    const grouped = [...groupedMap.values(), ...ungrouped];
    // Sort by start date descending (most recent first)
    grouped.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

    res.json(grouped);
  } catch (error) {
    console.error('Error fetching grouped tasks:', error);
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
 * Create a new task or multi-day assignment
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

    // Check if this is a multi-day assignment
    const isMultiDay = dueDateEnd && dueDateEnd !== dueDate;

    if (isMultiDay) {
      // Create a group of tasks for multi-day assignment
      const groupId = uuidv4();
      const startDate = new Date(dueDate);
      const endDate = new Date(dueDateEnd);
      const tasks = [];

      // Generate tasks for each day
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const currentDate = d.toISOString().split('T')[0];
        tasks.push({
          groupId,
          title,
          description,
          employeeId,
          createdById: req.admin.adminId,
          dueDate: currentDate,
          dueDateEnd,
          dueTime: dueTime || null,
          priority: priority || 'medium',
          section: section || employee.section,
          notes
        });
      }

      await Task.bulkCreate(tasks);

      // Return grouped response
      res.status(201).json({
        groupId,
        title,
        description,
        priority: priority || 'medium',
        status: 'pending',
        section: section || employee.section,
        notes,
        startDate: dueDate,
        endDate: dueDateEnd,
        dueTime: dueTime || null,
        dayCount: tasks.length,
        employeeId,
        assignee: { employeeId: employee.employeeId, name: employee.name, email: employee.email, section: employee.section },
        message: `Created ${tasks.length}-day assignment`,
        messageAr: `تم إنشاء مهمة لمدة ${tasks.length} أيام`
      });
    } else {
      // Single day task
      const task = await Task.create({
        title,
        description,
        employeeId,
        createdById: req.admin.adminId,
        dueDate,
        dueTime: dueTime || null,
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
    }
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
    const { title, description, employeeId, dueDate, dueTime, priority, status, section, notes } = req.body;

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

    await task.update({ status });

    res.json({
      message: 'Task status updated',
      messageAr: 'تم تحديث حالة المهمة',
      task
    });
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Update all tasks in a group (assignment status)
 */
exports.updateGroupStatus = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { status } = req.body;

    if (!['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        message: 'Invalid status',
        messageAr: 'حالة غير صالحة'
      });
    }

    // Update all tasks with this groupId
    const [updatedCount] = await Task.update(
      { status },
      { where: { groupId } }
    );

    if (updatedCount === 0) {
      return res.status(404).json({
        message: 'No tasks found in this group',
        messageAr: 'لا توجد مهام في هذه المجموعة'
      });
    }

    res.json({
      message: `Updated ${updatedCount} tasks in assignment`,
      messageAr: `تم تحديث ${updatedCount} مهام في المهمة`,
      updatedCount,
      status
    });
  } catch (error) {
    console.error('Error updating group status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Delete all tasks in a group (delete entire assignment)
 */
exports.deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;

    const deletedCount = await Task.destroy({
      where: { groupId }
    });

    if (deletedCount === 0) {
      return res.status(404).json({
        message: 'No tasks found in this group',
        messageAr: 'لا توجد مهام في هذه المجموعة'
      });
    }

    res.json({
      message: `Deleted ${deletedCount} tasks in assignment`,
      messageAr: `تم حذف ${deletedCount} مهام`,
      deletedCount
    });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = exports;
