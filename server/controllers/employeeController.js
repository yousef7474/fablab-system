const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Employee, Task, Rating, Admin, Registration, User } = require('../models');
const { Op } = require('sequelize');

// Generate a random password (8 chars, letters + digits)
const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const employee = await Employee.findOne({ where: { email: email.toLowerCase().trim() } });

    if (!employee) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!employee.isActive) {
      return res.status(401).json({ message: 'Account is inactive. Contact your manager.' });
    }

    if (!employee.password) {
      return res.status(401).json({ message: 'Account not set up. Contact your manager to generate credentials.' });
    }

    const isMatch = await employee.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { employeeId: employee.employeeId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      employee: {
        employeeId: employee.employeeId,
        name: employee.name,
        email: employee.email,
        section: employee.section,
        isCustomSection: employee.isCustomSection,
        mustChangePassword: employee.mustChangePassword
      }
    });
  } catch (error) {
    console.error('Employee login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const employee = req.employee;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    // If mustChangePassword (first login), currentPassword is the generated one
    if (!employee.mustChangePassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required' });
      }
      const isMatch = await employee.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }
    }

    employee.password = newPassword;
    employee.mustChangePassword = false;
    await employee.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get own profile
exports.getProfile = async (req, res) => {
  try {
    const employee = req.employee;

    // Get total ratings
    const ratings = await Rating.findAll({
      where: { employeeId: employee.employeeId },
      include: [{ model: Admin, as: 'ratedBy', attributes: ['fullName'] }],
      order: [['ratingDate', 'DESC'], ['createdAt', 'DESC']]
    });

    const totalAwards = ratings.filter(r => r.type === 'award').reduce((sum, r) => sum + r.points, 0);
    const totalDeductions = ratings.filter(r => r.type === 'deduction').reduce((sum, r) => sum + r.points, 0);
    const netPoints = totalAwards - totalDeductions;

    // Get task stats
    const tasks = await Task.findAll({
      where: { employeeId: employee.employeeId }
    });
    const taskStats = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      uncompleted: tasks.filter(t => t.status === 'uncompleted').length,
      cancelled: tasks.filter(t => t.status === 'cancelled').length
    };

    res.json({
      employee: {
        employeeId: employee.employeeId,
        name: employee.name,
        email: employee.email,
        section: employee.section,
        isCustomSection: employee.isCustomSection,
        isActive: employee.isActive,
        createdAt: employee.createdAt
      },
      netPoints,
      totalAwards,
      totalDeductions,
      taskStats,
      recentRatings: ratings.slice(0, 10)
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get own tasks
exports.getMyTasks = async (req, res) => {
  try {
    const { status } = req.query;
    const whereClause = { employeeId: req.employee.employeeId };
    if (status && status !== 'all') whereClause.status = status;

    const tasks = await Task.findAll({
      where: whereClause,
      include: [
        { model: Admin, as: 'creator', attributes: ['fullName', 'role'] },
        { model: Employee, as: 'employeeCreator', attributes: ['name', 'email'] }
      ],
      order: [['dueDate', 'DESC'], ['createdAt', 'DESC']]
    });

    const formattedTasks = tasks.map(task => {
      const startDate = task.dueDate;
      const endDate = task.dueDateEnd || task.dueDate;
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
        creator: task.creator,
        employeeCreator: task.employeeCreator,
        createdById: task.createdById,
        createdByEmployeeId: task.createdByEmployeeId,
        selfCreated: task.createdByEmployeeId === req.employee.employeeId,
        startDate,
        endDate,
        dueTime: task.dueTime,
        dayCount,
        createdAt: task.createdAt
      };
    });

    res.json(formattedTasks);
  } catch (error) {
    console.error('Get my tasks error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update own task status
exports.updateMyTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const employee = req.employee;

    if (!['pending', 'in_progress', 'completed', 'cancelled', 'uncompleted', 'pending_review'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const task = await Task.findOne({
      where: { taskId: id, employeeId: employee.employeeId }
    });

    if (!task) {
      return res.status(404).json({ message: 'Task not found or not assigned to you' });
    }

    // Only allow status change on self-created tasks
    if (task.createdByEmployeeId !== employee.employeeId) {
      return res.status(403).json({ message: 'You can only change the status of tasks you created yourself' });
    }

    const previousStatus = task.status;
    task.status = status;
    await task.save();

    // Auto-award point when completed
    let ratingMessage = null;
    if (status === 'completed' && previousStatus !== 'completed') {
      try {
        await Rating.create({
          employeeId: employee.employeeId,
          createdById: task.createdById,
          type: 'award',
          points: 1,
          criteria: 'Task Completed',
          notes: `Auto-awarded for completing task: ${task.title}`,
          ratingDate: new Date()
        });
        ratingMessage = 'awarded';
      } catch (e) {
        console.error('Auto-award error:', e);
      }
    }

    // Auto-deduct point when uncompleted
    if (status === 'uncompleted' && previousStatus !== 'uncompleted') {
      try {
        await Rating.create({
          employeeId: employee.employeeId,
          createdById: task.createdById,
          type: 'deduction',
          points: 1,
          criteria: 'Task Uncompleted',
          notes: `Auto-deducted for uncompleted task: ${task.title}`,
          ratingDate: new Date()
        });
        ratingMessage = 'deducted';
      } catch (e) {
        console.error('Auto-deduct error:', e);
      }
    }

    res.json({
      task,
      ratingMessage,
      awardedRating: ratingMessage === 'awarded',
      deductedRating: ratingMessage === 'deducted'
    });
  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create task for self
exports.createMyTask = async (req, res) => {
  try {
    const employee = req.employee;
    const { title, description, dueDate, dueDateEnd, dueTime, priority, section, notes } = req.body;

    if (!title || !dueDate) {
      return res.status(400).json({ message: 'Title and due date are required' });
    }

    const task = await Task.create({
      title,
      description: description || null,
      employeeId: employee.employeeId,
      createdById: null,
      createdByEmployeeId: employee.employeeId,
      dueDate,
      dueDateEnd: dueDateEnd || null,
      dueTime: dueTime || null,
      priority: priority || 'medium',
      section: section || employee.section,
      notes: notes || null,
      status: 'pending'
    });

    res.status(201).json(task);
  } catch (error) {
    console.error('Create my task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get own evaluations
exports.getMyEvaluations = async (req, res) => {
  try {
    const { EmployeeEvaluation } = require('../models');
    const evaluations = await EmployeeEvaluation.findAll({
      where: { employeeId: req.employee.employeeId },
      include: [
        { model: Admin, as: 'evaluator', attributes: ['fullName', 'role'] }
      ],
      order: [['evaluationDate', 'DESC']]
    });

    let avgGrade = 0, avgScore = 0, totalBonus = 0;
    if (evaluations.length > 0) {
      avgScore = evaluations.reduce((s, e) => s + Math.min(e.totalScore, 100), 0) / evaluations.length;
      avgGrade = evaluations.reduce((s, e) => s + e.grade, 0) / evaluations.length;
      totalBonus = evaluations.reduce((s, e) => s + e.bonusPoints, 0);
    }

    res.json({
      evaluations,
      summary: {
        count: evaluations.length,
        avgScore: parseFloat(avgScore.toFixed(2)),
        avgGrade: parseFloat(avgGrade.toFixed(2)),
        totalBonus: parseFloat(totalBonus.toFixed(2))
      }
    });
  } catch (error) {
    console.error('Get my evaluations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get own ratings history
exports.getMyRatings = async (req, res) => {
  try {
    const ratings = await Rating.findAll({
      where: { employeeId: req.employee.employeeId },
      include: [{ model: Admin, as: 'ratedBy', attributes: ['fullName', 'role'] }],
      order: [['ratingDate', 'DESC'], ['createdAt', 'DESC']]
    });

    const totalAwards = ratings.filter(r => r.type === 'award').reduce((sum, r) => sum + r.points, 0);
    const totalDeductions = ratings.filter(r => r.type === 'deduction').reduce((sum, r) => sum + r.points, 0);

    res.json({
      ratings,
      totalAwards,
      totalDeductions,
      netPoints: totalAwards - totalDeductions
    });
  } catch (error) {
    console.error('Get my ratings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get own schedule (tasks + section appointments)
exports.getMySchedule = async (req, res) => {
  try {
    const employee = req.employee;

    // 1. Get employee's tasks
    const tasks = await Task.findAll({
      where: {
        employeeId: employee.employeeId,
        status: { [Op.notIn]: ['cancelled'] }
      },
      include: [{ model: Admin, as: 'creator', attributes: ['fullName'] }],
      order: [['dueDate', 'ASC']]
    });

    const taskEvents = tasks.map(task => ({
      id: task.taskId,
      title: task.title,
      date: task.dueDate,
      endDate: task.dueDateEnd || task.dueDate,
      startTime: task.dueTime,
      endTime: task.dueTimeEnd,
      type: 'task',
      priority: task.priority,
      status: task.status,
      section: task.section,
      description: task.description,
      creatorName: task.creator?.fullName,
      createdById: task.createdById,
      createdByEmployeeId: task.createdByEmployeeId,
      selfCreated: task.createdByEmployeeId === employee.employeeId
    }));

    // 2. Get all approved appointments (same schedule as admin/manager)
    const registrations = await Registration.findAll({
      where: {
        status: 'approved',
        [Op.or]: [
          { appointmentDate: { [Op.not]: null } },
          { visitDate: { [Op.not]: null } },
          { startDate: { [Op.not]: null } }
        ]
      },
      include: [{
        model: User,
        as: 'user',
        attributes: ['firstName', 'lastName', 'name', 'phoneNumber', 'email', 'applicationType']
      }],
      order: [['appointmentDate', 'ASC'], ['appointmentTime', 'ASC']]
    });

    const appointmentEvents = registrations.map(reg => {
      const date = reg.appointmentDate || reg.visitDate || reg.startDate;
      const time = reg.appointmentTime || reg.visitStartTime || reg.startTime;
      const endTime = reg.visitEndTime || reg.endTime;
      const userName = reg.user.firstName && reg.user.lastName
        ? `${reg.user.firstName} ${reg.user.lastName}`
        : reg.user.name;

      // Calculate duration
      let duration = reg.appointmentDuration;
      if (!duration && time && endTime) {
        const [sH, sM] = time.split(':').map(Number);
        const [eH, eM] = endTime.split(':').map(Number);
        const d = (eH * 60 + eM) - (sH * 60 + sM);
        if (d > 0) duration = d;
      }

      return {
        id: reg.registrationId,
        title: userName,
        date,
        endDate: date,
        startTime: time,
        endTime,
        duration,
        section: reg.fablabSection,
        services: reg.requiredServices,
        applicationType: reg.user.applicationType,
        phone: reg.user.phoneNumber,
        email: reg.user.email,
        type: 'appointment'
      };
    });

    res.json([...taskEvents, ...appointmentEvents]);
  } catch (error) {
    console.error('Get my schedule error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Generate credentials for employee (called by manager/admin)
exports.generateCredentials = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const employee = await Employee.findByPk(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const plainPassword = generatePassword();
    employee.password = plainPassword;
    employee.mustChangePassword = true;
    await employee.save();

    res.json({
      message: 'Credentials generated successfully',
      credentials: {
        email: employee.email,
        password: plainPassword,
        name: employee.name
      }
    });
  } catch (error) {
    console.error('Generate credentials error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = exports;
