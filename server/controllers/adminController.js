const { Admin, User, Registration, Employee } = require('../models');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { sendStatusUpdateEmail } = require('../utils/emailService');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Admin login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find admin
    const admin = await Admin.findOne({ where: { username } });

    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await admin.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!admin.isActive) {
      return res.status(401).json({ message: 'Admin account is inactive' });
    }

    // Create token
    const token = jwt.sign(
      { adminId: admin.adminId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      admin: {
        adminId: admin.adminId,
        username: admin.username,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create admin
exports.createAdmin = async (req, res) => {
  try {
    const { username, email, password, fullName, role } = req.body;

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({
      where: {
        [Op.or]: [{ username }, { email }]
      }
    });

    if (existingAdmin) {
      return res.status(400).json({ message: 'Admin already exists' });
    }

    // Validate role if provided
    const validRoles = ['admin', 'manager'];
    const adminRole = role && validRoles.includes(role) ? role : 'admin';

    // Create admin
    const admin = await Admin.create({
      username,
      email,
      password,
      fullName,
      role: adminRole
    });

    res.status(201).json({
      message: 'Admin created successfully',
      admin: {
        adminId: admin.adminId,
        username: admin.username,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all registrations with filters
exports.getAllRegistrations = async (req, res) => {
  try {
    const {
      section,
      applicationType,
      entity,
      timePeriod,
      sex,
      status,
      search,
      page = 1,
      limit = 20
    } = req.query;

    const whereClause = {};
    const userWhereClause = {};

    // Apply filters
    if (section) whereClause.fablabSection = section;
    if (status) whereClause.status = status;
    if (applicationType) userWhereClause.applicationType = applicationType;
    if (entity) userWhereClause.entityName = entity;
    if (sex) userWhereClause.sex = sex;

    // Time period filter
    if (timePeriod) {
      const now = new Date();
      let startDate;

      switch (timePeriod) {
        case 'day':
          startDate = new Date(now.setDate(now.getDate() - 1));
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case '3months':
          startDate = new Date(now.setMonth(now.getMonth() - 3));
          break;
        case '6months':
          startDate = new Date(now.setMonth(now.getMonth() - 6));
          break;
        case '9months':
          startDate = new Date(now.setMonth(now.getMonth() - 9));
          break;
        case 'year':
          startDate = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
      }

      if (startDate) {
        whereClause.createdAt = { [Op.gte]: startDate };
      }
    }

    // Search by name
    if (search) {
      userWhereClause[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { name: { [Op.iLike]: `%${search}%` } },
        { nationalId: { [Op.iLike]: `%${search}%` } },
        { phoneNumber: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Get registrations with pagination
    const offset = (page - 1) * limit;

    const { count, rows: registrations } = await Registration.findAndCountAll({
      where: whereClause,
      include: [{
        model: User,
        as: 'user',
        where: Object.keys(userWhereClause).length > 0 ? userWhereClause : undefined
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      registrations,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error getting registrations:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get registration by ID
exports.getRegistrationById = async (req, res) => {
  try {
    const { id } = req.params;

    const registration = await Registration.findByPk(id, {
      include: [{
        model: User,
        as: 'user'
      }]
    });

    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    res.json(registration);
  } catch (error) {
    console.error('Error getting registration:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update registration status
exports.updateRegistrationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason, adminMessage, sendMessageInEmail } = req.body;

    const registration = await Registration.findByPk(id, {
      include: [{
        model: User,
        as: 'user'
      }]
    });

    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    // Update registration
    registration.status = status;
    registration.rejectionReason = rejectionReason || null;
    registration.adminNotes = adminMessage || null;

    if (status === 'approved') {
      registration.approvedBy = req.admin.fullName;
      registration.approvedAt = new Date();
    }

    await registration.save();

    // Send email to user
    const userName = registration.user.firstName && registration.user.lastName
      ? `${registration.user.firstName} ${registration.user.lastName}`
      : registration.user.name;

    // Get appointment date/time from registration
    const appointmentDate = registration.appointmentDate || registration.visitDate || registration.startDate;
    const appointmentTime = registration.appointmentTime || registration.visitStartTime || registration.startTime;

    await sendStatusUpdateEmail(
      registration.user.email,
      userName,
      registration.registrationId,
      status,
      {
        rejectionReason: rejectionReason || null,
        adminMessage: adminMessage || null,
        sendMessage: sendMessageInEmail || false,
        appointmentDate: appointmentDate,
        appointmentTime: appointmentTime,
        appointmentDuration: registration.appointmentDuration,
        fablabSection: registration.fablabSection
      }
    );

    res.json({
      message: 'Registration status updated successfully',
      registration
    });
  } catch (error) {
    console.error('Error updating registration status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Bulk delete registrations
exports.bulkDeleteRegistrations = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No registration IDs provided' });
    }

    const deletedCount = await Registration.destroy({
      where: {
        registrationId: {
          [Op.in]: ids
        }
      }
    });

    res.json({
      message: `${deletedCount} registration(s) deleted successfully`,
      deletedCount
    });
  } catch (error) {
    console.error('Error bulk deleting registrations:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Export selected registrations as CSV
exports.exportSelectedCSV = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No registration IDs provided' });
    }

    const registrations = await Registration.findAll({
      where: {
        registrationId: {
          [Op.in]: ids
        }
      },
      include: [{
        model: User,
        as: 'user'
      }],
      order: [['createdAt', 'DESC']]
    });

    // Generate CSV
    const headers = [
      'Registration ID',
      'User ID',
      'Name',
      'Email',
      'Phone',
      'Application Type',
      'Section',
      'Status',
      'Date',
      'Time',
      'Duration',
      'Services',
      'Created At'
    ];

    const rows = registrations.map(reg => {
      const userName = reg.user?.firstName && reg.user?.lastName
        ? `${reg.user.firstName} ${reg.user.lastName}`
        : reg.user?.name || 'N/A';

      return [
        reg.registrationId,
        reg.userId,
        userName,
        reg.user?.email || 'N/A',
        reg.user?.phoneNumber || 'N/A',
        reg.user?.applicationType || 'N/A',
        reg.fablabSection || 'N/A',
        reg.status,
        reg.appointmentDate || reg.visitDate || reg.startDate || 'N/A',
        reg.appointmentTime || reg.visitStartTime || reg.startTime || 'N/A',
        reg.appointmentDuration ? `${reg.appointmentDuration} min` : 'N/A',
        Array.isArray(reg.requiredServices) ? reg.requiredServices.join('; ') : 'N/A',
        reg.createdAt ? new Date(reg.createdAt).toISOString() : 'N/A'
      ];
    });

    // Add BOM for Excel to recognize UTF-8 encoding (required for Arabic text)
    const BOM = '\uFEFF';
    const csvContent = BOM + [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=registrations_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting selected CSV:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update registration
exports.updateRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const registration = await Registration.findByPk(id);

    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    await registration.update(updateData);

    res.json({
      message: 'Registration updated successfully',
      registration
    });
  } catch (error) {
    console.error('Error updating registration:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete registration
exports.deleteRegistration = async (req, res) => {
  try {
    const { id } = req.params;

    const registration = await Registration.findByPk(id);

    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    await registration.destroy();

    res.json({ message: 'Registration deleted successfully' });
  } catch (error) {
    console.error('Error deleting registration:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user profile
exports.getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId, {
      include: [{
        model: Registration,
        as: 'registrations',
        order: [['createdAt', 'DESC']]
      }]
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get analytics
exports.getAnalytics = async (req, res) => {
  try {
    const { timePeriod } = req.query;

    let whereClause = {};

    // Time period filter
    if (timePeriod) {
      const now = new Date();
      let startDate;

      switch (timePeriod) {
        case 'day':
          startDate = new Date(now.setDate(now.getDate() - 1));
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case 'year':
          startDate = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
      }

      if (startDate) {
        whereClause.createdAt = { [Op.gte]: startDate };
      }
    }

    // Get statistics
    const totalRegistrations = await Registration.count({ where: whereClause });
    const pendingRegistrations = await Registration.count({
      where: { ...whereClause, status: 'pending' }
    });
    const approvedRegistrations = await Registration.count({
      where: { ...whereClause, status: 'approved' }
    });
    const rejectedRegistrations = await Registration.count({
      where: { ...whereClause, status: 'rejected' }
    });

    // Registrations by section
    const bySection = await Registration.findAll({
      where: whereClause,
      attributes: [
        'fablabSection',
        [Registration.sequelize.fn('COUNT', Registration.sequelize.col('registrationId')), 'count']
      ],
      group: ['fablabSection']
    });

    // Registrations by application type
    const byApplicationType = await Registration.findAll({
      where: whereClause,
      include: [{
        model: User,
        as: 'user',
        attributes: []
      }],
      attributes: [
        [Registration.sequelize.col('user.applicationType'), 'applicationType'],
        [Registration.sequelize.fn('COUNT', Registration.sequelize.col('Registration.registrationId')), 'count']
      ],
      group: [Registration.sequelize.col('user.applicationType')],
      raw: true
    });

    res.json({
      totalRegistrations,
      pendingRegistrations,
      approvedRegistrations,
      rejectedRegistrations,
      bySection,
      byApplicationType
    });
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user profile with all registrations
exports.getUserWithRegistrations = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const registrations = await Registration.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      user,
      registrations
    });
  } catch (error) {
    console.error('Error getting user with registrations:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update user profile
exports.updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Allowed fields to update
    const allowedFields = [
      'firstName', 'lastName', 'name', 'email', 'phoneNumber',
      'sex', 'nationality', 'nationalId', 'currentJob', 'nationalAddress',
      'applicationType', 'entityName', 'personInCharge'
    ];

    const filteredData = {};
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    });

    await user.update(filteredData);

    res.json({
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const { search, applicationType, page = 1, limit = 20 } = req.query;

    const whereClause = {};

    if (applicationType) {
      whereClause.applicationType = applicationType;
    }

    if (search) {
      whereClause[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phoneNumber: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;

    const { count, rows: users } = await User.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      users,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all employees
exports.getAllEmployees = async (req, res) => {
  try {
    const employees = await Employee.findAll({
      order: [['name', 'ASC']]
    });
    res.json(employees);
  } catch (error) {
    console.error('Error getting employees:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create employee
exports.createEmployee = async (req, res) => {
  try {
    const { name, email, section } = req.body;

    const existingEmployee = await Employee.findOne({ where: { email } });
    if (existingEmployee) {
      return res.status(400).json({ message: 'Employee with this email already exists' });
    }

    const employee = await Employee.create({ name, email, section });
    res.status(201).json({ message: 'Employee created successfully', employee });
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update employee
exports.updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, section, isActive } = req.body;

    const employee = await Employee.findByPk(id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    await employee.update({ name, email, section, isActive });
    res.json({ message: 'Employee updated successfully', employee });
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete employee
exports.deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await Employee.findByPk(id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    await employee.destroy();
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get schedule data (appointments by date)
exports.getSchedule = async (req, res) => {
  try {
    const { startDate, endDate, section, includeTasks } = req.query;

    const whereClause = {
      status: 'approved'
    };

    if (section) {
      whereClause.fablabSection = section;
    }

    // Get approved registrations with appointment dates
    const registrations = await Registration.findAll({
      where: {
        ...whereClause,
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

    // Helper function to calculate duration in minutes from two time strings
    const calculateDuration = (startTime, endTime) => {
      if (!startTime || !endTime) return null;
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      const duration = endMinutes - startMinutes;
      return duration > 0 ? duration : null;
    };

    // Format for calendar view
    const scheduleItems = registrations.map(reg => {
      const date = reg.appointmentDate || reg.visitDate || reg.startDate;
      const time = reg.appointmentTime || reg.visitStartTime || reg.startTime;
      const endTime = reg.visitEndTime || reg.endTime;
      const userName = reg.user.firstName && reg.user.lastName
        ? `${reg.user.firstName} ${reg.user.lastName}`
        : reg.user.name;

      // Use appointmentDuration if available, otherwise calculate from times
      const duration = reg.appointmentDuration || calculateDuration(time, endTime);

      return {
        id: reg.registrationId,
        title: userName,
        date,
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

    // Include tasks if requested
    if (includeTasks === 'true') {
      const { Task, Employee } = require('../models');

      const taskWhereClause = {
        status: { [Op.ne]: 'cancelled' }
      };

      if (section) {
        taskWhereClause.section = section;
      }

      const tasks = await Task.findAll({
        where: taskWhereClause,
        include: [{
          model: Employee,
          as: 'assignee',
          attributes: ['name', 'email', 'section']
        }],
        order: [['dueDate', 'ASC'], ['dueTime', 'ASC']]
      });

      const taskItems = tasks.map(task => ({
        id: task.taskId,
        title: task.title,
        date: task.dueDate,
        startTime: task.dueTime,
        endTime: task.dueTimeEnd,
        duration: calculateDuration(task.dueTime, task.dueTimeEnd),
        section: task.section,
        type: 'task',
        priority: task.priority,
        status: task.status,
        employeeId: task.employeeId,
        assignee: task.assignee?.name,
        assigneeEmail: task.assignee?.email,
        description: task.description,
        dueDateEnd: task.dueDateEnd
      }));

      return res.json([...scheduleItems, ...taskItems]);
    }

    res.json(scheduleItems);
  } catch (error) {
    console.error('Error getting schedule:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get enhanced analytics with time series data
exports.getEnhancedAnalytics = async (req, res) => {
  try {
    const { period = 'month', startDate: customStartDate, endDate: customEndDate } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate;
    let endDate = customEndDate ? new Date(customEndDate + 'T23:59:59') : now;
    let groupBy;

    // Use custom dates if provided
    if (customStartDate) {
      startDate = new Date(customStartDate);
    } else {
      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          groupBy = 'day';
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          groupBy = 'day';
          break;
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          groupBy = 'month';
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          groupBy = 'day';
      }
    }

    // Build date filter
    const dateFilter = {
      createdAt: {
        [Op.gte]: startDate,
        [Op.lte]: endDate
      }
    };

    // Basic stats
    const totalRegistrations = await Registration.count();
    const totalUsers = await User.count();
    const pendingRegistrations = await Registration.count({ where: { status: 'pending' } });
    const approvedRegistrations = await Registration.count({ where: { status: 'approved' } });
    const rejectedRegistrations = await Registration.count({ where: { status: 'rejected' } });

    // Today's registrations
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayRegistrations = await Registration.count({
      where: {
        createdAt: { [Op.gte]: todayStart }
      }
    });

    // Registrations by section (filtered by date range)
    const bySectionRaw = await Registration.findAll({
      where: dateFilter,
      attributes: [
        'fablabSection',
        [Registration.sequelize.fn('COUNT', Registration.sequelize.col('registrationId')), 'count']
      ],
      group: ['fablabSection'],
      raw: true
    });
    // Convert count to number (PostgreSQL returns string)
    const bySection = bySectionRaw.map(item => ({
      ...item,
      count: parseInt(item.count, 10) || 0
    }));

    // Registrations by application type (via User table - filtered by date range)
    const byApplicationType = await User.findAll({
      where: dateFilter,
      attributes: [
        'applicationType',
        [User.sequelize.fn('COUNT', User.sequelize.col('userId')), 'count']
      ],
      group: ['applicationType'],
      raw: true
    });

    // Registrations by status (filtered by date range)
    const byStatusRaw = await Registration.findAll({
      where: dateFilter,
      attributes: [
        'status',
        [Registration.sequelize.fn('COUNT', Registration.sequelize.col('registrationId')), 'count']
      ],
      group: ['status'],
      raw: true
    });
    const byStatus = byStatusRaw.map(item => ({
      ...item,
      count: parseInt(item.count, 10) || 0
    }));

    // Time series data - registrations over time (filtered by date range)
    const timeSeriesData = await Registration.findAll({
      where: dateFilter,
      attributes: [
        [Registration.sequelize.fn('DATE', Registration.sequelize.col('createdAt')), 'date'],
        [Registration.sequelize.fn('COUNT', Registration.sequelize.col('registrationId')), 'count']
      ],
      group: [Registration.sequelize.fn('DATE', Registration.sequelize.col('createdAt'))],
      order: [[Registration.sequelize.fn('DATE', Registration.sequelize.col('createdAt')), 'ASC']],
      raw: true
    });

    // Registrations by service type (filtered by date range)
    const byServiceType = await Registration.findAll({
      where: dateFilter,
      attributes: [
        'serviceType',
        [Registration.sequelize.fn('COUNT', Registration.sequelize.col('registrationId')), 'count']
      ],
      group: ['serviceType'],
      raw: true
    });

    res.json({
      summary: {
        totalRegistrations,
        totalUsers,
        pendingRegistrations,
        approvedRegistrations,
        rejectedRegistrations,
        todayRegistrations
      },
      bySection,
      byApplicationType,
      byStatus,
      byServiceType,
      timeSeriesData
    });
  } catch (error) {
    console.error('Error getting enhanced analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Export registrations to CSV
exports.exportToCSV = async (req, res) => {
  try {
    const { registrationIds, status, section, applicationType, startDate, endDate } = req.query;

    const whereClause = {};
    const userWhereClause = {};

    // If specific IDs provided, use them
    if (registrationIds) {
      const ids = registrationIds.split(',');
      whereClause.registrationId = { [Op.in]: ids };
    }

    // Apply optional filters
    if (status) whereClause.status = status;
    if (section) whereClause.fablabSection = section;
    if (applicationType) userWhereClause.applicationType = applicationType;

    // Date range filter
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt[Op.gte] = new Date(startDate);
      if (endDate) whereClause.createdAt[Op.lte] = new Date(endDate + 'T23:59:59');
    }

    const registrations = await Registration.findAll({
      where: whereClause,
      include: [{
        model: User,
        as: 'user',
        where: Object.keys(userWhereClause).length > 0 ? userWhereClause : undefined
      }],
      order: [['createdAt', 'DESC']]
    });

    // Create CSV content with BOM for Excel compatibility
    const BOM = '\uFEFF';
    let csv = BOM + 'Registration ID,User ID,Name,Email,Phone,Sex,Nationality,National ID,Application Type,Section,Services,Service Type,Date,Time,Status,Created At\n';

    registrations.forEach(reg => {
      const userName = reg.user?.firstName && reg.user?.lastName
        ? `${reg.user.firstName} ${reg.user.lastName}`
        : reg.user?.name || '';

      const date = reg.appointmentDate || reg.visitDate || reg.startDate || '';
      const time = reg.appointmentTime || reg.visitStartTime || reg.startTime || '';
      const services = reg.requiredServices ? reg.requiredServices.join('; ') : '';
      const createdAt = reg.createdAt ? new Date(reg.createdAt).toISOString().split('T')[0] : '';

      csv += `"${reg.registrationId}","${reg.userId}","${userName}","${reg.user?.email || ''}","${reg.user?.phoneNumber || ''}","${reg.user?.sex || ''}","${reg.user?.nationality || ''}","${reg.user?.nationalId || ''}","${reg.user?.applicationType || ''}","${reg.fablabSection || ''}","${services}","${reg.serviceType || ''}","${date}","${time}","${reg.status}","${createdAt}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=registrations_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete user and all their registrations
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        messageAr: 'المستخدم غير موجود'
      });
    }

    // Delete all registrations first
    await Registration.destroy({ where: { userId } });

    // Delete user
    await user.destroy();

    res.json({
      message: 'User and all registrations deleted successfully',
      messageAr: 'تم حذف المستخدم وجميع التسجيلات بنجاح'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = exports;
