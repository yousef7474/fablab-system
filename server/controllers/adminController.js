const { Admin, User, Registration, Employee } = require('../models');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { sendStatusUpdateEmail, sendCustomEmail } = require('../utils/emailService');
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
      dateFrom,
      dateTo,
      page = 1,
      limit = 50
    } = req.query;

    const whereClause = {};
    const userWhereClause = {};

    // Apply filters
    if (section) whereClause.fablabSection = section;
    if (status) whereClause.status = status;
    if (applicationType) userWhereClause.applicationType = applicationType;
    if (entity) userWhereClause.entityName = entity;
    if (sex) userWhereClause.sex = sex.charAt(0).toUpperCase() + sex.slice(1).toLowerCase();

    // Date range filter — matches the APPOINTMENT date (الموعد), not
    // the submission timestamp. Every registration has exactly ONE of
    // these three date fields set based on applicationType:
    //   appointmentDate → beneficiaries, general appointments
    //   visitDate       → FabLab visit requests
    //   startDate       → volunteers (their volunteering starts here)
    // We OR across all three so the filter works for every type
    // without the admin having to pick which "date" they mean.
    //
    // These columns are DATEONLY, so YYYY-MM-DD string comparison is
    // exact — no timezone shift, no midnight-cutoff bugs.
    //
    // Combined with `search` below via Op.and so both filters apply
    // at once (previously each was assigning whereClause[Op.or] and
    // the second one silently overrode the first).
    const andConditions = [];

    if (dateFrom || dateTo) {
      const bounds = {};
      if (dateFrom) bounds[Op.gte] = dateFrom;
      if (dateTo)   bounds[Op.lte] = dateTo;
      andConditions.push({
        [Op.or]: [
          { appointmentDate: bounds },
          { visitDate: bounds },
          { startDate: bounds }
        ]
      });
    }

    // Time period filter (only if date range not specified) — still
    // anchored to createdAt because "last week / month" means when
    // the request was submitted, not the appointment. Left unchanged
    // per the "date filter → الموعد" ask.
    if (timePeriod && !dateFrom && !dateTo) {
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

    // Search by name, ID, phone, etc.
    if (search) {
      andConditions.push({
        [Op.or]: [
          { registrationId: { [Op.like]: `%${search}%` } },
          { '$user.userId$': { [Op.like]: `%${search}%` } },
          { '$user.firstName$': { [Op.like]: `%${search}%` } },
          { '$user.lastName$': { [Op.like]: `%${search}%` } },
          { '$user.name$': { [Op.like]: `%${search}%` } },
          { '$user.nationalId$': { [Op.like]: `%${search}%` } },
          { '$user.phoneNumber$': { [Op.like]: `%${search}%` } }
        ]
      });
    }

    if (andConditions.length > 0) {
      whereClause[Op.and] = andConditions;
    }

    // Get registrations with pagination
    const offset = (page - 1) * limit;

    const { count, rows: registrations } = await Registration.findAndCountAll({
      where: whereClause,
      include: [{
        model: User,
        as: 'user',
        where: (Object.keys(userWhereClause).length > 0 || Object.getOwnPropertySymbols(userWhereClause).length > 0) ? userWhereClause : undefined
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      subQuery: false
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
    const {
      status,
      rejectionReason,
      adminMessage,
      sendMessageInEmail,
      statusChangeReason,
      isStatusChange,
      previousStatus
    } = req.body;

    const registration = await Registration.findByPk(id, {
      include: [{
        model: User,
        as: 'user'
      }]
    });

    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    // Store previous status for email context
    const oldStatus = registration.status;

    // Update registration
    registration.status = status;
    registration.rejectionReason = rejectionReason || null;
    registration.adminNotes = adminMessage || null;

    if (status === 'approved') {
      registration.approvedBy = req.admin?.fullName || 'Admin';
      registration.approvedAt = new Date();
    }

    await registration.save();

    // Send email to user (non-blocking, don't fail the request if email fails)
    try {
      if (registration.user && registration.user.email) {
        const userName = registration.user.firstName && registration.user.lastName
          ? `${registration.user.firstName} ${registration.user.lastName}`
          : registration.user.name || 'User';

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
            fablabSection: registration.fablabSection,
            statusChangeReason: statusChangeReason || null,
            isStatusChange: isStatusChange || false,
            previousStatus: previousStatus || oldStatus
          }
        );
      }
    } catch (emailError) {
      console.error('Failed to send status update email:', emailError);
    }

    res.json({
      message: isStatusChange ? 'Registration status changed successfully' : 'Registration status updated successfully',
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

// Export selected users to CSV
exports.exportSelectedUsersCSV = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No user IDs provided' });
    }

    const users = await User.findAll({
      where: {
        userId: {
          [Op.in]: ids
        }
      },
      order: [['createdAt', 'DESC']]
    });

    // Generate CSV with all personal data (using actual User model fields)
    const headers = [
      'User ID',
      'First Name',
      'Last Name',
      'Full Name',
      'Email',
      'Phone Number',
      'National ID',
      'Application Type',
      'Sex',
      'Nationality',
      'Current Job',
      'National Address',
      'Entity Name',
      'Visiting Entity',
      'Person In Charge',
      'Created At'
    ];

    const rows = users.map(user => {
      return [
        user.userId || 'N/A',
        user.firstName || 'N/A',
        user.lastName || 'N/A',
        user.name || (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : 'N/A'),
        user.email || 'N/A',
        user.phoneNumber || 'N/A',
        user.nationalId || 'N/A',
        user.applicationType || 'N/A',
        user.sex || 'N/A',
        user.nationality || 'N/A',
        user.currentJob || 'N/A',
        user.nationalAddress || 'N/A',
        user.entityName || 'N/A',
        user.visitingEntity || 'N/A',
        user.personInCharge || 'N/A',
        user.createdAt ? new Date(user.createdAt).toISOString() : 'N/A'
      ];
    });

    // Add BOM for Excel to recognize UTF-8 encoding (required for Arabic text)
    const BOM = '\uFEFF';
    const csvContent = BOM + [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=users_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting selected users CSV:', error);
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
      'applicationType', 'entityName', 'visitingEntity', 'personInCharge', 'profilePicture'
    ];

    // ENUM-typed fields: '' must become null (the model hook handles this, but
    // we normalise here too so the value never reaches Sequelize as '').
    const enumFields = ['sex', 'entityName', 'applicationType'];

    const filteredData = {};
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        let value = updateData[field];
        if (enumFields.includes(field) && value === '') value = null;
        filteredData[field] = value;
      }
    });

    // sex ENUM is 'Male'/'Female' — normalise any case variant.
    if (typeof filteredData.sex === 'string' && filteredData.sex) {
      const s = filteredData.sex.toLowerCase();
      if (s === 'male') filteredData.sex = 'Male';
      else if (s === 'female') filteredData.sex = 'Female';
    }

    // applicationType is NOT NULL — never overwrite it with null/empty.
    if (filteredData.applicationType === null || filteredData.applicationType === undefined) {
      delete filteredData.applicationType;
    }

    // Treat empty nationalId as null so UNIQUE constraint allows multiple users
    // without one. Trim whitespace to avoid stealth duplicates.
    if (typeof filteredData.nationalId === 'string') {
      filteredData.nationalId = filteredData.nationalId.trim() || null;
    }

    await user.update(filteredData);

    res.json({
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    console.error('Error updating user:', { userId: req.params.userId, name: error.name, message: error.message, errors: error.errors });

    if (error.name === 'SequelizeUniqueConstraintError') {
      const field = error.errors?.[0]?.path || 'field';
      return res.status(409).json({
        message: `${field} already in use by another user`,
        messageAr: `${field} مستخدم بالفعل من قبل مستخدم آخر`,
        field
      });
    }

    if (error.name === 'SequelizeValidationError') {
      const detail = error.errors?.[0];
      return res.status(400).json({
        message: detail?.message || 'Validation error',
        field: detail?.path
      });
    }

    res.status(500).json({ message: 'Server error', detail: error.message });
  }
};

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const { search, applicationType, page = 1, limit = 50 } = req.query;

    const whereClause = {};

    if (applicationType) {
      whereClause.applicationType = applicationType;
    }

    if (search) {
      whereClause[Op.or] = [
        { userId: { [Op.like]: `%${search}%` } },
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } },
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phoneNumber: { [Op.like]: `%${search}%` } },
        { nationalId: { [Op.like]: `%${search}%` } }
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
    const includeInactive = req.query.includeInactive === 'true' || req.query.includeInactive === '1';
    const where = includeInactive ? {} : { isActive: true };
    const employees = await Employee.findAll({
      where,
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
    const { name, email, section, sections } = req.body;

    // Normalize incoming sections. Accept either `sections` (new
    // multi-section) or a single `section` (legacy client).
    const incomingSections = Array.isArray(sections) && sections.length
      ? [...new Set(sections.filter(Boolean))]
      : (section ? [section] : []);

    if (incomingSections.length === 0) {
      return res.status(400).json({
        message: 'At least one section is required',
        messageAr: 'يجب اختيار قسم واحد على الأقل'
      });
    }

    const existingEmployee = await Employee.findOne({ where: { email } });
    if (existingEmployee) {
      // Merge instead of reject — the same person can work across
      // multiple FabLab sections. Take the union of their existing
      // sections and the incoming ones. If the merge doesn't add any
      // new section, return a helpful 200-ish note so admin knows.
      const currentSections = Array.isArray(existingEmployee.sections) && existingEmployee.sections.length
        ? existingEmployee.sections
        : (existingEmployee.section ? [existingEmployee.section] : []);
      const merged = [...new Set([...currentSections, ...incomingSections])];
      const addedCount = merged.length - currentSections.length;

      if (addedCount === 0) {
        return res.status(400).json({
          message: `${existingEmployee.name} is already assigned to all of these sections.`,
          messageAr: `${existingEmployee.name} مُسجَّل مسبقاً في كل هذه الأقسام.`
        });
      }

      await existingEmployee.update({
        sections: merged,
        section: merged[0], // keep legacy single field in sync with first section
        // If the employee was soft-deleted, reactivate them now that
        // admin is explicitly re-adding them.
        isActive: true
      });
      // Force-persist the JSON array (Sequelize dirty-check on JSON can miss it)
      existingEmployee.setDataValue('sections', merged);
      existingEmployee.changed('sections', true);
      await existingEmployee.save({ fields: ['sections'] });

      return res.json({
        message: `Added ${addedCount} new section(s) to existing employee ${existingEmployee.name}.`,
        messageAr: `تمت إضافة ${addedCount} قسم جديد للموظف ${existingEmployee.name}.`,
        employee: await Employee.findByPk(existingEmployee.employeeId),
        merged: true
      });
    }

    const employee = await Employee.create({
      name, email,
      section: incomingSections[0],
      sections: incomingSections
    });
    res.status(201).json({
      message: 'Employee created successfully',
      messageAr: 'تمت إضافة الموظف بنجاح',
      employee
    });
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ message: 'Server error', detail: error.message });
  }
};

// Update employee
exports.updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, section, sections, isActive } = req.body;

    const employee = await Employee.findByPk(id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const patch = {};
    if (name !== undefined) patch.name = name;
    if (email !== undefined) patch.email = email;
    if (isActive !== undefined) patch.isActive = isActive;

    // Prefer new multi-section shape; fall back to single section
    // string. Always keep the legacy `section` column in sync with
    // sections[0] so old queries that read it still work.
    if (Array.isArray(sections)) {
      const clean = [...new Set(sections.filter(Boolean))];
      patch.sections = clean;
      patch.section = clean[0] || employee.section;
    } else if (section !== undefined) {
      patch.section = section;
      const current = Array.isArray(employee.sections) ? employee.sections : [];
      patch.sections = current.includes(section) ? current : [section, ...current];
    }

    await employee.update(patch);
    // JSON dirty-tracking workaround.
    if (patch.sections !== undefined) {
      employee.setDataValue('sections', patch.sections);
      employee.changed('sections', true);
      await employee.save({ fields: ['sections'] });
    }

    const fresh = await Employee.findByPk(id);
    res.json({ message: 'Employee updated successfully', employee: fresh });
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ message: 'Server error', detail: error.message });
  }
};

// Delete employee. Default = soft delete (isActive: false) so tasks,
// ratings, evaluations, and past workshop history stay intact for
// audit. Pass ?force=true to cascade-purge every related row and
// hard-delete the employee. Mirrors the Volunteer delete pattern.
exports.deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const force = req.query.force === 'true' || req.query.force === '1';

    const employee = await Employee.findByPk(id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found', messageAr: 'الموظف غير موجود' });
    }

    if (!force) {
      // Soft delete — preserves all related data. Employee stops
      // appearing in the active list (getAllEmployees already filters
      // by isActive).
      await employee.update({ isActive: false });
      return res.json({
        message: 'Employee deactivated successfully',
        messageAr: 'تم تعطيل الموظف بنجاح',
        softDelete: true
      });
    }

    // Hard delete — cascade every referencing table first, then destroy
    // the employee row. Wrap in a transaction so we either wipe all
    // dependents or nothing at all.
    const { Task, Rating, EmployeeEvaluation, EmployeeActivity, Workshop } = require('../models');
    const { Op } = require('sequelize');
    const { sequelize } = require('../config/database');

    await sequelize.transaction(async (t) => {
      // Tasks: employee could be either the assignee OR the creator.
      await Task.destroy({
        where: { [Op.or]: [{ employeeId: id }, { createdByEmployeeId: id }] },
        transaction: t
      });
      await Rating.destroy({ where: { employeeId: id }, transaction: t });
      await EmployeeEvaluation.destroy({ where: { employeeId: id }, transaction: t });
      await EmployeeActivity.destroy({ where: { employeeId: id }, transaction: t });
      // Workshops the employee ran are valuable records — null the FK
      // instead of deleting the workshop itself.
      await Workshop.update(
        { assignedEmployeeId: null },
        { where: { assignedEmployeeId: id }, transaction: t }
      );
      await employee.destroy({ transaction: t });
    });

    res.json({
      message: 'Employee and all related records deleted permanently',
      messageAr: 'تم حذف الموظف وكل السجلات المرتبطة نهائياً'
    });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({
      message: 'Server error',
      messageAr: 'خطأ في الخادم',
      detail: error.message
    });
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
      const { Task, Employee, Admin: AdminModel } = require('../models');

      const taskWhereClause = {
        status: { [Op.ne]: 'cancelled' }
      };

      if (section) {
        taskWhereClause.section = section;
      }

      const tasks = await Task.findAll({
        where: taskWhereClause,
        include: [
          { model: Employee, as: 'assignee', attributes: ['name', 'email', 'section'] },
          { model: AdminModel, as: 'creator', attributes: ['adminId', 'fullName', 'role'], required: false },
          { model: Employee, as: 'employeeCreator', attributes: ['name', 'email'], required: false }
        ],
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
        createdById: task.createdById,
        createdByEmployeeId: task.createdByEmployeeId,
        assignee: task.assignee?.name,
        assigneeEmail: task.assignee?.email,
        creatorName: task.creator?.fullName || task.employeeCreator?.name,
        creatorRole: task.creator?.role || (task.createdByEmployeeId ? 'employee' : null),
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

    // Calculate date range — same Riyadh-anchored parsing as the
    // registrations list, so an admin's YYYY-MM-DD picker covers the
    // full day in local time regardless of server timezone.
    const now = new Date();
    let startDate;
    let endDate = customEndDate ? new Date(`${customEndDate}T23:59:59.999+03:00`) : now;
    let groupBy;

    // Use custom dates if provided
    if (customStartDate) {
      startDate = new Date(`${customStartDate}T00:00:00.000+03:00`);
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

    // Date range filter — matches by APPOINTMENT date (الموعد) so
    // the CSV export mirrors the on-screen registrations list.
    // ORs across the three date columns because a registration only
    // has one set based on its type. See getAllRegistrations for
    // the full rationale.
    if (startDate || endDate) {
      const bounds = {};
      if (startDate) bounds[Op.gte] = startDate;
      if (endDate)   bounds[Op.lte] = endDate;
      whereClause[Op.or] = [
        { appointmentDate: bounds },
        { visitDate: bounds },
        { startDate: bounds }
      ];
    }

    const registrations = await Registration.findAll({
      where: whereClause,
      include: [{
        model: User,
        as: 'user',
        where: (Object.keys(userWhereClause).length > 0 || Object.getOwnPropertySymbols(userWhereClause).length > 0) ? userWhereClause : undefined
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

// Send bulk email to selected users
exports.sendBulkEmail = async (req, res) => {
  try {
    const { userIds, subject, message } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'No user IDs provided' });
    }

    if (!subject || !subject.trim()) {
      return res.status(400).json({ message: 'Subject is required' });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const users = await User.findAll({
      where: {
        userId: {
          [Op.in]: userIds
        }
      }
    });

    if (users.length === 0) {
      return res.status(404).json({ message: 'No users found' });
    }

    let successCount = 0;
    let failCount = 0;

    for (const user of users) {
      try {
        const userName = user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.name || 'User';

        await sendCustomEmail(user.email, userName, subject.trim(), message.trim());
        successCount++;
      } catch (error) {
        console.error(`Failed to send email to ${user.email}:`, error);
        failCount++;
      }
    }

    res.json({
      message: `Emails sent: ${successCount} successful, ${failCount} failed`,
      successCount,
      failCount
    });
  } catch (error) {
    console.error('Error sending bulk email:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = exports;
