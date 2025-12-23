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
    const { username, email, password, fullName } = req.body;

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({
      where: {
        [Op.or]: [{ username }, { email }]
      }
    });

    if (existingAdmin) {
      return res.status(400).json({ message: 'Admin already exists' });
    }

    // Create admin
    const admin = await Admin.create({
      username,
      email,
      password,
      fullName
    });

    res.status(201).json({
      message: 'Admin created successfully',
      admin: {
        adminId: admin.adminId,
        username: admin.username,
        email: admin.email,
        fullName: admin.fullName
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
    const { status, rejectionReason, adminNotes } = req.body;

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
    registration.rejectionReason = rejectionReason;
    registration.adminNotes = adminNotes;

    if (status === 'approved') {
      registration.approvedBy = req.admin.fullName;
      registration.approvedAt = new Date();
    }

    await registration.save();

    // Send email to user
    const userName = registration.user.firstName && registration.user.lastName
      ? `${registration.user.firstName} ${registration.user.lastName}`
      : registration.user.name;

    await sendStatusUpdateEmail(
      registration.user.email,
      userName,
      registration.registrationId,
      status,
      rejectionReason
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

// Export registrations to CSV
exports.exportToCSV = async (req, res) => {
  try {
    const { registrationIds } = req.body;

    const registrations = await Registration.findAll({
      where: {
        registrationId: { [Op.in]: registrationIds }
      },
      include: [{
        model: User,
        as: 'user'
      }]
    });

    // Create CSV content
    let csv = 'Registration ID,User ID,Name,Email,Phone,Application Type,Section,Services,Date,Time,Status\n';

    registrations.forEach(reg => {
      const userName = reg.user.firstName && reg.user.lastName
        ? `${reg.user.firstName} ${reg.user.lastName}`
        : reg.user.name;

      const date = reg.appointmentDate || reg.visitDate || reg.startDate || '';
      const time = reg.appointmentTime || reg.visitStartTime || reg.startTime || '';

      csv += `${reg.registrationId},${reg.userId},"${userName}",${reg.user.email},${reg.user.phoneNumber},${reg.user.applicationType},${reg.fablabSection},"${reg.requiredServices.join('; ')}",${date},${time},${reg.status}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=registrations.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = exports;
