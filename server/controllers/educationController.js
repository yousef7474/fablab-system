const { User, Education, EducationRating, Admin } = require('../models');
const { generateUserId, generateEducationId } = require('../utils/idGenerator');
const { Op } = require('sequelize');

// Check if user exists (public)
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

// Create new education request (public)
exports.createEducation = async (req, res) => {
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
      otherSectionDescription,
      numberOfStudents,
      periodStartDate,
      periodEndDate,
      periodStartTime,
      periodEndTime,
      roomPhotoBefore,
      signature,
      termsAccepted
    } = req.body;

    // Validate required fields
    if (!section || !numberOfStudents || !periodStartDate || !periodEndDate || !periodStartTime || !periodEndTime || !roomPhotoBefore || !signature || !termsAccepted) {
      return res.status(400).json({ message: 'All required fields must be provided', messageAr: 'يجب تقديم جميع الحقول المطلوبة' });
    }

    if (section === 'Other' && !otherSectionDescription) {
      return res.status(400).json({ message: 'Please describe the other section', messageAr: 'يرجى وصف القسم الآخر' });
    }

    // Validate dates
    const startDate = new Date(periodStartDate);
    const endDate = new Date(periodEndDate);
    if (endDate <= startDate) {
      return res.status(400).json({ message: 'End date must be after start date', messageAr: 'يجب أن يكون تاريخ الانتهاء بعد تاريخ البدء' });
    }

    let userId = existingUserId;
    let user;

    if (existingUserId) {
      user = await User.findByPk(existingUserId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
    } else {
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

    const educationId = await generateEducationId();

    const education = await Education.create({
      educationId,
      userId,
      section,
      otherSectionDescription: section === 'Other' ? otherSectionDescription : null,
      numberOfStudents,
      periodStartDate,
      periodEndDate,
      periodStartTime,
      periodEndTime,
      roomPhotoBefore,
      signature,
      termsAccepted,
      status: 'pending'
    });

    res.status(201).json({
      message: 'Education request created successfully',
      messageAr: 'تم إنشاء طلب التعليم بنجاح',
      education: {
        educationId,
        userId,
        section,
        periodStartDate,
        periodEndDate,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Error creating education:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all educations (auth)
exports.getAllEducations = async (req, res) => {
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

    const { count, rows } = await Education.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          where: search ? userWhere : undefined,
          attributes: ['userId', 'firstName', 'lastName', 'name', 'phoneNumber', 'email', 'nationalId', 'sex', 'nationality']
        },
        { model: Admin, as: 'approvedBy', attributes: ['adminId', 'fullName'], required: false }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      educations: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching educations:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get education by ID with ratings (auth)
exports.getEducationById = async (req, res) => {
  try {
    const education = await Education.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user', attributes: ['userId', 'firstName', 'lastName', 'name', 'phoneNumber', 'email', 'nationalId', 'sex', 'nationality'] },
        { model: Admin, as: 'approvedBy', attributes: ['adminId', 'fullName'], required: false },
        {
          model: EducationRating,
          as: 'ratings',
          include: [{ model: Admin, as: 'ratedBy', attributes: ['adminId', 'fullName'] }],
          order: [['ratingDate', 'DESC']]
        }
      ]
    });

    if (!education) {
      return res.status(404).json({ message: 'Education record not found' });
    }

    res.json(education);
  } catch (error) {
    console.error('Error fetching education:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update education status (auth)
exports.updateEducationStatus = async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    const education = await Education.findByPk(req.params.id, {
      include: [{ model: User, as: 'user' }]
    });

    if (!education) {
      return res.status(404).json({ message: 'Education record not found' });
    }

    if (!['approved', 'rejected', 'active', 'completed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const updateData = {
      status,
      adminNotes: adminNotes || education.adminNotes,
      approvedById: req.admin.adminId,
      approvedAt: new Date()
    };

    await education.update(updateData);

    res.json({ message: `Education ${status} successfully`, education });
  } catch (error) {
    console.error('Error updating education status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get educations by user identifier (public)
exports.getMyEducations = async (req, res) => {
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
      return res.json({ educations: [] });
    }

    const educations = await Education.findAll({
      where: { userId: user.userId },
      attributes: ['educationId', 'section', 'numberOfStudents', 'periodStartDate', 'periodEndDate', 'periodStartTime', 'periodEndTime', 'status'],
      order: [['createdAt', 'DESC']]
    });

    res.json({ educations });
  } catch (error) {
    console.error('Error fetching user educations:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add daily rating (auth)
exports.addRating = async (req, res) => {
  try {
    const { educationId } = req.params;
    const { ratingDate, cleanlinessScore, damageLevel, damageDescription, roomPhoto, comments } = req.body;

    const education = await Education.findByPk(educationId);
    if (!education) {
      return res.status(404).json({ message: 'Education record not found' });
    }

    if (!['approved', 'active'].includes(education.status)) {
      return res.status(400).json({ message: 'Can only rate approved or active education records', messageAr: 'يمكن تقييم السجلات المعتمدة أو النشطة فقط' });
    }

    // Enforce one rating per education per day
    const existingRating = await EducationRating.findOne({
      where: { educationId, ratingDate }
    });

    if (existingRating) {
      return res.status(400).json({ message: 'A rating already exists for this date', messageAr: 'يوجد تقييم بالفعل لهذا التاريخ' });
    }

    if (!cleanlinessScore || cleanlinessScore < 1 || cleanlinessScore > 5) {
      return res.status(400).json({ message: 'Cleanliness score must be between 1 and 5' });
    }

    if (damageLevel && damageLevel !== 'none' && !damageDescription) {
      return res.status(400).json({ message: 'Damage description is required when damage level is not none', messageAr: 'وصف الضرر مطلوب عندما يكون مستوى الضرر غير "بدون"' });
    }

    const rating = await EducationRating.create({
      educationId,
      ratingDate,
      cleanlinessScore,
      damageLevel: damageLevel || 'none',
      damageDescription: damageLevel !== 'none' ? damageDescription : null,
      roomPhoto: roomPhoto || null,
      comments: comments || null,
      createdById: req.admin.adminId
    });

    res.status(201).json({ message: 'Rating added successfully', messageAr: 'تم إضافة التقييم بنجاح', rating });
  } catch (error) {
    console.error('Error adding rating:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get ratings for an education record (auth)
exports.getRatings = async (req, res) => {
  try {
    const ratings = await EducationRating.findAll({
      where: { educationId: req.params.id },
      include: [{ model: Admin, as: 'ratedBy', attributes: ['adminId', 'fullName'] }],
      order: [['ratingDate', 'DESC']]
    });

    res.json({ ratings });
  } catch (error) {
    console.error('Error fetching ratings:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a rating (auth)
exports.deleteRating = async (req, res) => {
  try {
    const rating = await EducationRating.findByPk(req.params.ratingId);

    if (!rating) {
      return res.status(404).json({ message: 'Rating not found' });
    }

    await rating.destroy();
    res.json({ message: 'Rating deleted successfully', messageAr: 'تم حذف التقييم بنجاح' });
  } catch (error) {
    console.error('Error deleting rating:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = exports;
