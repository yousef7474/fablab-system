const { User, Borrowing, Admin } = require('../models');
const { generateUserId, generateBorrowingId } = require('../utils/idGenerator');
const { sendBorrowingConfirmation, sendBorrowingStatusUpdate, sendReturnConfirmation } = require('../utils/borrowingEmailService');
const { Op } = require('sequelize');

// Check if user exists (reuse pattern from registrationController)
exports.checkUser = async (req, res) => {
  try {
    const { identifier } = req.body;

    const user = await User.findOne({
      where: {
        [Op.or]: [
          { nationalId: identifier },
          { phoneNumber: identifier }
        ]
      }
    });

    if (user) {
      return res.json({
        exists: true,
        user: {
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          name: user.name,
          sex: user.sex,
          nationality: user.nationality,
          nationalId: user.nationalId,
          phoneNumber: user.phoneNumber,
          email: user.email
        }
      });
    }

    res.json({ exists: false });
  } catch (error) {
    console.error('Error checking user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create new borrowing request
exports.createBorrowing = async (req, res) => {
  try {
    const {
      existingUserId,
      firstName,
      lastName,
      sex,
      nationality,
      nationalId,
      phoneNumber,
      email,
      section,
      purpose,
      componentDescription,
      componentPhotoBefore,
      borrowDate,
      expectedReturnDate,
      signature,
      termsAccepted
    } = req.body;

    // Validate required fields
    if (!section || !purpose || !componentDescription || !componentPhotoBefore || !borrowDate || !expectedReturnDate || !signature || !termsAccepted) {
      return res.status(400).json({ message: 'All required fields must be provided', messageAr: 'يجب تقديم جميع الحقول المطلوبة' });
    }

    // Validate max 30 days borrowing period
    const bDate = new Date(borrowDate);
    const rDate = new Date(expectedReturnDate);
    const diffDays = Math.ceil((rDate - bDate) / (1000 * 60 * 60 * 24));
    if (diffDays > 30 || diffDays < 1) {
      return res.status(400).json({ message: 'Borrowing period must be between 1 and 30 days', messageAr: 'يجب أن تكون فترة الاستعارة بين 1 و 30 يومًا' });
    }

    let userId = existingUserId;
    let user;

    if (existingUserId) {
      user = await User.findByPk(existingUserId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
    } else {
      // Validate new user fields
      if (!firstName || !lastName || !phoneNumber || !email) {
        return res.status(400).json({ message: 'Personal information is required for new users', messageAr: 'المعلومات الشخصية مطلوبة للمستخدمين الجدد' });
      }

      userId = await generateUserId();
      user = await User.create({
        userId,
        applicationType: 'Beneficiary',
        firstName,
        lastName,
        sex: sex || null,
        nationality: nationality || null,
        nationalId: nationalId || null,
        phoneNumber,
        email,
        name: `${firstName} ${lastName}`
      });
    }

    const borrowingId = await generateBorrowingId();

    const borrowing = await Borrowing.create({
      borrowingId,
      userId,
      section,
      purpose,
      componentDescription,
      componentPhotoBefore,
      borrowDate,
      expectedReturnDate,
      signature,
      termsAccepted,
      status: 'pending'
    });

    // Send confirmation email (non-blocking)
    try {
      await sendBorrowingConfirmation(borrowing, user);
    } catch (emailError) {
      console.error('Failed to send borrowing confirmation email:', emailError);
    }

    res.status(201).json({
      message: 'Borrowing request created successfully',
      messageAr: 'تم إنشاء طلب الاستعارة بنجاح',
      borrowing: {
        borrowingId,
        userId,
        section,
        borrowDate,
        expectedReturnDate,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Error creating borrowing:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all borrowings (admin)
exports.getAllBorrowings = async (req, res) => {
  try {
    const { status, section, search, page = 1, limit = 50 } = req.query;
    const where = {};

    if (status) where.status = status;
    if (section) where.section = section;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let userWhere = {};
    if (search) {
      userWhere = {
        [Op.or]: [
          { firstName: { [Op.like]: `%${search}%` } },
          { lastName: { [Op.like]: `%${search}%` } },
          { name: { [Op.like]: `%${search}%` } },
          { phoneNumber: { [Op.like]: `%${search}%` } },
          { nationalId: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } }
        ]
      };
    }

    const { count, rows } = await Borrowing.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          where: search ? userWhere : undefined,
          attributes: ['userId', 'firstName', 'lastName', 'name', 'phoneNumber', 'email', 'nationalId', 'sex', 'nationality']
        },
        { model: Admin, as: 'approvedBy', attributes: ['adminId', 'fullName'], required: false },
        { model: Admin, as: 'returnProcessor', attributes: ['adminId', 'fullName'], required: false }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      borrowings: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching borrowings:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get single borrowing (admin)
exports.getBorrowingById = async (req, res) => {
  try {
    const borrowing = await Borrowing.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user', attributes: ['userId', 'firstName', 'lastName', 'name', 'phoneNumber', 'email', 'nationalId', 'sex', 'nationality'] },
        { model: Admin, as: 'approvedBy', attributes: ['adminId', 'fullName'], required: false },
        { model: Admin, as: 'returnProcessor', attributes: ['adminId', 'fullName'], required: false }
      ]
    });

    if (!borrowing) {
      return res.status(404).json({ message: 'Borrowing not found' });
    }

    res.json(borrowing);
  } catch (error) {
    console.error('Error fetching borrowing:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update borrowing status (admin: approve/reject)
exports.updateBorrowingStatus = async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    const borrowing = await Borrowing.findByPk(req.params.id, {
      include: [{ model: User, as: 'user' }]
    });

    if (!borrowing) {
      return res.status(404).json({ message: 'Borrowing not found' });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be approved or rejected' });
    }

    const updateData = {
      status,
      adminNotes: adminNotes || borrowing.adminNotes,
      approvedById: req.admin.adminId,
      approvedAt: new Date()
    };

    await borrowing.update(updateData);

    // Send status email (non-blocking)
    try {
      await sendBorrowingStatusUpdate(borrowing, borrowing.user, status);
    } catch (emailError) {
      console.error('Failed to send borrowing status email:', emailError);
    }

    res.json({ message: `Borrowing ${status} successfully`, borrowing });
  } catch (error) {
    console.error('Error updating borrowing status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Mark as returned (admin)
exports.markAsReturned = async (req, res) => {
  try {
    const { componentPhotoAfter, adminNotes } = req.body;
    const borrowing = await Borrowing.findByPk(req.params.id, {
      include: [{ model: User, as: 'user' }]
    });

    if (!borrowing) {
      return res.status(404).json({ message: 'Borrowing not found' });
    }

    if (!['approved', 'borrowed', 'overdue'].includes(borrowing.status)) {
      return res.status(400).json({ message: 'Only approved/borrowed/overdue borrowings can be marked as returned' });
    }

    await borrowing.update({
      status: 'returned',
      actualReturnDate: new Date().toISOString().split('T')[0],
      componentPhotoAfter: componentPhotoAfter || null,
      adminNotes: adminNotes || borrowing.adminNotes,
      returnedById: req.admin.adminId
    });

    // Send return confirmation email as proof (non-blocking)
    try {
      await sendReturnConfirmation(borrowing, borrowing.user);
    } catch (emailError) {
      console.error('Failed to send return confirmation email:', emailError);
    }

    res.json({ message: 'Borrowing marked as returned successfully', borrowing });
  } catch (error) {
    console.error('Error marking borrowing as returned:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get borrowings by user identifier (public)
exports.getMyBorrowings = async (req, res) => {
  try {
    const { identifier } = req.params;

    const user = await User.findOne({
      where: {
        [Op.or]: [
          { nationalId: identifier },
          { phoneNumber: identifier },
          { userId: identifier }
        ]
      }
    });

    if (!user) {
      return res.json({ borrowings: [] });
    }

    const borrowings = await Borrowing.findAll({
      where: { userId: user.userId },
      attributes: ['borrowingId', 'section', 'borrowDate', 'expectedReturnDate', 'actualReturnDate', 'status', 'componentDescription'],
      order: [['createdAt', 'DESC']]
    });

    res.json({ borrowings });
  } catch (error) {
    console.error('Error fetching user borrowings:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = exports;
