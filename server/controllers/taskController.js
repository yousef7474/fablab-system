const { Task, Employee, Admin, Rating } = require('../models');
const { Op } = require('sequelize');
const path = require('path');
const sgMail = require('@sendgrid/mail');
const { sendTaskRatingEmail } = require('../utils/emailService');

// Absolute-path .env load — matches the pattern used elsewhere so
// SENDGRID_API_KEY is definitely picked up regardless of pm2 cwd.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Fire-and-forget: email an employee that a new task has been
// assigned to them. Never blocks task creation, never throws — a
// misconfigured SendGrid must not break the manager's workflow.
const _sendTaskAssignedEmail = async ({ task, employee, creator }) => {
  try {
    if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) return;
    if (!employee?.email) return;

    const safe = (v) => String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const priorityAr = task.priority === 'high' ? '🔴 مرتفعة'
      : task.priority === 'low' ? '🟢 منخفضة' : '🟡 متوسطة';
    const priorityColor = task.priority === 'high' ? '#dc2626'
      : task.priority === 'low' ? '#16a34a' : '#f59e0b';

    const dueRange = task.dueDateEnd && task.dueDateEnd !== task.dueDate
      ? `${task.dueDate} → ${task.dueDateEnd}`
      : task.dueDate;
    const timeRange = task.dueTimeEnd && task.dueTime
      ? `${String(task.dueTime).slice(0, 5)} – ${String(task.dueTimeEnd).slice(0, 5)}`
      : task.dueTime ? String(task.dueTime).slice(0, 5) : '';

    const html = `
<div style="font-family: 'Tajawal','Segoe UI',Tahoma,sans-serif; background:#f5f7fa; padding:24px 0;" dir="rtl">
  <div style="max-width:640px; margin:0 auto; background:#fff; border-radius:14px; overflow:hidden; box-shadow:0 6px 24px rgba(15,23,42,0.10);">
    <div style="background:linear-gradient(135deg, ${priorityColor}, #0f172a); color:#fff; padding:22px 28px;">
      <div style="font-size:12px; letter-spacing:1.2px; opacity:0.85">FABLAB الأحساء · مهمة جديدة</div>
      <h1 style="margin:6px 0 0; font-size:20px; font-weight:800">📋 تم تعيين مهمة جديدة لك</h1>
    </div>
    <div style="padding:24px 28px; color:#0f172a;">
      <p style="margin:0 0 14px; font-size:14px; line-height:1.75">
        مرحباً <strong>${safe(employee.name)}</strong>،<br>
        قام <strong>${safe(creator?.fullName || 'المدير')}</strong> بإسناد مهمة جديدة لك بالتفاصيل التالية:
      </p>
      <div style="background:#f8fafc; border-inline-start:4px solid ${priorityColor}; padding:14px 18px; border-radius:8px; margin-bottom:16px">
        <div style="font-size:16px; font-weight:800; color:#0f172a; margin-bottom:6px">${safe(task.title)}</div>
        ${task.description ? `<div style="font-size:13px; color:#475569; line-height:1.7; white-space:pre-wrap">${safe(task.description)}</div>` : ''}
      </div>

      <table style="width:100%; font-size:13px; border-collapse:collapse; margin-bottom:16px">
        <tr>
          <td style="padding:8px 0; color:#64748b; width:150px">📅 تاريخ الاستحقاق:</td>
          <td style="padding:8px 0; font-weight:800; direction:ltr; text-align:right">${safe(dueRange)}</td>
        </tr>
        ${timeRange ? `
        <tr>
          <td style="padding:8px 0; color:#64748b">🕒 الوقت:</td>
          <td style="padding:8px 0; font-weight:700; direction:ltr; text-align:right">${safe(timeRange)}</td>
        </tr>` : ''}
        <tr>
          <td style="padding:8px 0; color:#64748b">⚡ الأولوية:</td>
          <td style="padding:8px 0; font-weight:800; color:${priorityColor}">${priorityAr}</td>
        </tr>
        ${task.section ? `
        <tr>
          <td style="padding:8px 0; color:#64748b">🏷 القسم:</td>
          <td style="padding:8px 0; font-weight:700">${safe(task.section)}</td>
        </tr>` : ''}
      </table>

      ${task.notes ? `
        <div style="background:#eff6ff; border-inline-start:4px solid #3b82f6; padding:12px 16px; border-radius:8px; margin-bottom:16px">
          <div style="font-size:12px; font-weight:800; color:#1e40af; margin-bottom:4px">📝 ملاحظات المدير</div>
          <div style="font-size:13px; color:#1e3a8a; white-space:pre-wrap; line-height:1.7">${safe(task.notes)}</div>
        </div>` : ''}

      <p style="margin:20px 0 0; color:#64748b; font-size:12.5px">
        يمكنك متابعة وتحديث حالة المهمة من لوحة الموظف.<br>
        فريق فاب لاب الأحساء
      </p>
    </div>
  </div>
</div>`;

    await sgMail.send({
      to: employee.email,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL,
        name: process.env.SENDGRID_FROM_NAME || 'FABLAB Al-Ahsa'
      },
      subject: `📋 مهمة جديدة: ${task.title}`,
      html
    });
    console.log(`✉️  Task assigned email sent to ${employee.email} for task "${task.title}"`);
  } catch (err) {
    console.error('task-assigned email failed:', err?.response?.body || err.message);
  }
};

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

    // If user is a manager and not requesting all tasks, show tasks they created
    // OR tasks created by employees themselves (createdByEmployeeId is set)
    // Admins can see all tasks
    if (req.admin && req.admin.role === 'manager' && showAll !== 'true') {
      const { Op } = require('sequelize');
      whereClause[Op.or] = [
        { createdById: req.admin.adminId },
        { createdByEmployeeId: { [Op.not]: null } }
      ];
    }

    const tasks = await Task.findAll({
      where: whereClause,
      include: [
        { model: Employee, as: 'assignee', attributes: ['employeeId', 'name', 'email', 'section'] },
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName', 'role'] },
        { model: Employee, as: 'employeeCreator', attributes: ['employeeId', 'name', 'email'] }
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
        employeeCreator: task.employeeCreator,
        employeeId: task.employeeId,
        createdById: task.createdById,
        createdByEmployeeId: task.createdByEmployeeId,
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
 * Check for task conflicts for given employees and date/time
 */
exports.checkConflicts = async (req, res) => {
  try {
    const { employeeIds, dueDate, dueDateEnd, dueTime, dueTimeEnd } = req.body;
    if (!employeeIds || !dueDate) return res.json({ conflicts: [] });

    const { Op } = require('sequelize');
    const conflicts = [];

    for (const empId of employeeIds) {
      const employee = await Employee.findByPk(empId, { attributes: ['employeeId', 'name'] });
      if (!employee) continue;

      // Find overlapping tasks by date range
      const dateEnd = dueDateEnd || dueDate;
      const whereClause = {
        employeeId: empId,
        status: { [Op.notIn]: ['cancelled'] },
        [Op.or]: [
          // Task starts within new range
          { dueDate: { [Op.between]: [dueDate, dateEnd] } },
          // Task ends within new range (dueDateEnd)
          { dueDateEnd: { [Op.between]: [dueDate, dateEnd] } },
          // Task spans the entire new range
          { [Op.and]: [{ dueDate: { [Op.lte]: dueDate } }, { dueDateEnd: { [Op.gte]: dateEnd } }] },
          // Single-day task on any day in range (dueDateEnd is null)
          { [Op.and]: [{ dueDateEnd: null }, { dueDate: { [Op.between]: [dueDate, dateEnd] } }] }
        ]
      };

      const overlapping = await Task.findAll({
        where: whereClause,
        attributes: ['taskId', 'title', 'dueDate', 'dueDateEnd', 'dueTime', 'dueTimeEnd', 'status', 'priority'],
        order: [['dueDate', 'ASC']]
      });

      // If time is specified, further filter by time overlap
      let conflictingTasks = overlapping;
      if (dueTime && dueTimeEnd) {
        conflictingTasks = overlapping.filter(t => {
          if (!t.dueTime || !t.dueTimeEnd) return true; // no time = all day = always conflicts
          return t.dueTime < dueTimeEnd && t.dueTimeEnd > dueTime;
        });
      }

      if (conflictingTasks.length > 0) {
        conflicts.push({
          employeeId: empId,
          employeeName: employee.name,
          tasks: conflictingTasks.map(t => ({
            taskId: t.taskId,
            title: t.title,
            dueDate: t.dueDate,
            dueDateEnd: t.dueDateEnd,
            dueTime: t.dueTime,
            dueTimeEnd: t.dueTimeEnd,
            status: t.status
          }))
        });
      }
    }

    res.json({ conflicts });
  } catch (error) {
    console.error('Check conflicts error:', error);
    res.status(500).json({ message: 'Server error' });
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

    // Fire-and-forget: email the assignee about their new task. The
    // client calls this endpoint in a loop when a manager assigns to
    // multiple employees, so each employee gets their own email.
    _sendTaskAssignedEmail({
      task: createdTask,
      employee: createdTask?.assignee,
      creator: createdTask?.creator
    }).catch(() => {});

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

    if (!['pending', 'in_progress', 'completed', 'cancelled', 'uncompleted', 'pending_review'].includes(status)) {
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
    const previousStatus = task.status;
    const wasCompleted = previousStatus === 'completed';
    const isBeingCompleted = status === 'completed';
    const wasPendingReview = previousStatus === 'pending_review';

    await task.update({ status });

    // Auto-award 1 point to employee when task is completed
    let awardedRating = null;
    if (isBeingCompleted && !wasCompleted && task.employeeId && req.admin) {
      const isManager = req.admin.role === 'manager';
      const isTaskCreator = req.admin.adminId === task.createdById;

      // Award if: manager created the task, OR manager approves a pending_review task
      if (isManager && (isTaskCreator || wasPendingReview)) {
        try {
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
        } catch (ratingError) {
          console.error('Error creating auto-rating for task completion:', ratingError);
        }
      } else {
        console.log(`No points awarded - role: ${req.admin.role}, isTaskCreator: ${isTaskCreator}, task: ${task.title}`);
      }
    }

    // Auto-deduct 1 point from employee when task is marked as uncompleted
    const isBeingUncompleted = status === 'uncompleted';
    let deductedRating = null;
    if (isBeingUncompleted && task.employeeId && req.admin) {
      try {
        deductedRating = await Rating.create({
          employeeId: task.employeeId,
          createdById: req.admin.adminId,
          type: 'deduction',
          points: 1,
          criteria: 'Task Uncompleted',
          notes: `Uncompleted task: "${task.title}"`,
          ratingDate: new Date().toISOString().split('T')[0]
        });
        console.log(`Auto-deducted 1 point from employee ${task.employeeId} for uncompleted task: ${task.title}`);
      } catch (ratingError) {
        console.error('Error creating auto-deduction for uncompleted task:', ratingError);
      }
    }

    // Send email notification to employee on award/deduction
    if ((awardedRating || deductedRating) && task.employeeId) {
      try {
        const employee = await Employee.findByPk(task.employeeId);
        if (employee && employee.email) {
          const type = awardedRating ? 'award' : 'deduction';
          await sendTaskRatingEmail(employee.email, employee.name, task.title, type, task.description);
        }
      } catch (emailError) {
        console.error('Error sending task rating email:', emailError);
      }
    }

    let message = 'Task status updated';
    let messageAr = 'تم تحديث حالة المهمة';
    if (isBeingCompleted && awardedRating) {
      message = 'Task completed and 1 point awarded to employee';
      messageAr = 'تم إكمال المهمة ومنح نقطة واحدة للموظف';
    } else if (isBeingUncompleted && deductedRating) {
      message = 'Task marked uncompleted and 1 point deducted from employee';
      messageAr = 'تم تحديد المهمة كغير مكتملة وخصم نقطة واحدة من الموظف';
    }

    res.json({
      message,
      messageAr,
      task,
      awardedRating,
      deductedRating
    });
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = exports;
