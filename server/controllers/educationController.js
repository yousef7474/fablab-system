const { User, Education, EducationRating, EducationStudent, EducationAttendance, Admin } = require('../models');
const { generateUserId, generateEducationId, generateStudentId } = require('../utils/idGenerator');
const { Op } = require('sequelize');
const { sendEducationConfirmation, sendEducationStatusUpdate, sendEducationPeriodEnd, sendCustomEducationEmail } = require('../utils/educationEmailService');

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

    // Send confirmation email
    if (user.email) {
      sendEducationConfirmation(education, user).catch(err => console.error('Email error:', err));
    }

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

    // Send email notification
    if (education.user && education.user.email) {
      if (status === 'approved' || status === 'rejected') {
        sendEducationStatusUpdate(education, education.user, status).catch(err => console.error('Email error:', err));
      } else if (status === 'completed') {
        sendEducationPeriodEnd(education, education.user).catch(err => console.error('Email error:', err));
      }
    }

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
    const educationId = req.params.id;
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

// Send custom email to teacher (auth)
exports.sendCustomEmail = async (req, res) => {
  try {
    const { subject, message } = req.body;
    const education = await Education.findByPk(req.params.id, {
      include: [{ model: User, as: 'user' }]
    });

    if (!education) {
      return res.status(404).json({ message: 'Education record not found' });
    }

    if (!education.user || !education.user.email) {
      return res.status(400).json({ message: 'Teacher has no email address', messageAr: 'لا يوجد بريد إلكتروني للمعلم' });
    }

    if (!message) {
      return res.status(400).json({ message: 'Message is required', messageAr: 'الرسالة مطلوبة' });
    }

    await sendCustomEducationEmail(education, education.user, subject, message);

    res.json({ message: 'Email sent successfully', messageAr: 'تم إرسال البريد الإلكتروني بنجاح' });
  } catch (error) {
    console.error('Error sending custom email:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Verify education ID (public)
exports.verifyEducationId = async (req, res) => {
  try {
    const education = await Education.findByPk(req.params.id, {
      include: [{ model: User, as: 'user', attributes: ['firstName', 'lastName', 'name'] }]
    });

    if (!education) {
      return res.status(404).json({ message: 'Education record not found', messageAr: 'لم يتم العثور على سجل التعليم' });
    }

    res.json({
      educationId: education.educationId,
      section: education.section,
      teacherName: education.user?.firstName && education.user?.lastName
        ? `${education.user.firstName} ${education.user.lastName}`
        : education.user?.name || 'N/A',
      status: education.status,
      periodStartDate: education.periodStartDate,
      periodEndDate: education.periodEndDate,
      periodStartTime: education.periodStartTime,
      periodEndTime: education.periodEndTime
    });
  } catch (error) {
    console.error('Error verifying education:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Bulk add students (public)
exports.bulkAddStudents = async (req, res) => {
  try {
    const educationId = req.params.id;
    const { students } = req.body;

    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ message: 'Students array is required', messageAr: 'قائمة الطلاب مطلوبة' });
    }

    const education = await Education.findByPk(educationId);
    if (!education) {
      return res.status(404).json({ message: 'Education record not found', messageAr: 'لم يتم العثور على سجل التعليم' });
    }

    // Generate IDs sequentially - find max once
    const lastStudent = await EducationStudent.findOne({
      order: [['createdAt', 'DESC']]
    });
    let nextIdNumber = 1;
    if (lastStudent && lastStudent.studentId) {
      nextIdNumber = parseInt(lastStudent.studentId.replace('S#', '')) + 1;
    }

    const studentRecords = students.map((student, index) => ({
      studentId: `S#${String(nextIdNumber + index).padStart(5, '0')}`,
      educationId,
      fullName: student.fullName,
      nationalId: student.nationalId,
      phoneNumber: student.phoneNumber,
      schoolName: student.schoolName,
      educationLevel: student.educationLevel,
      parentPhoneNumber: student.parentPhoneNumber,
      personalPhoto: student.personalPhoto,
      status: 'active'
    }));

    const created = await EducationStudent.bulkCreate(studentRecords);

    res.status(201).json({
      message: 'Students added successfully',
      messageAr: 'تم إضافة الطلاب بنجاح',
      count: created.length,
      educationId
    });
  } catch (error) {
    console.error('Error bulk adding students:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get students for an education (auth)
exports.getStudentsForEducation = async (req, res) => {
  try {
    const students = await EducationStudent.findAll({
      where: { educationId: req.params.id, status: 'active' },
      order: [['createdAt', 'ASC']]
    });

    res.json({ students });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add single student (auth)
exports.addSingleStudent = async (req, res) => {
  try {
    const educationId = req.params.id;
    const { fullName, nationalId, phoneNumber, schoolName, educationLevel, parentPhoneNumber, personalPhoto } = req.body;

    if (!fullName || !nationalId || !phoneNumber || !schoolName || !educationLevel || !parentPhoneNumber || !personalPhoto) {
      return res.status(400).json({ message: 'All fields are required', messageAr: 'جميع الحقول مطلوبة' });
    }

    const education = await Education.findByPk(educationId);
    if (!education) {
      return res.status(404).json({ message: 'Education record not found' });
    }

    const studentId = await generateStudentId();

    const student = await EducationStudent.create({
      studentId,
      educationId,
      fullName,
      nationalId,
      phoneNumber,
      schoolName,
      educationLevel,
      parentPhoneNumber,
      personalPhoto,
      status: 'active'
    });

    res.status(201).json({ message: 'Student added successfully', messageAr: 'تم إضافة الطالب بنجاح', student });
  } catch (error) {
    console.error('Error adding student:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update student (auth)
exports.updateStudent = async (req, res) => {
  try {
    const student = await EducationStudent.findByPk(req.params.studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const allowedFields = ['fullName', 'nationalId', 'phoneNumber', 'schoolName', 'educationLevel', 'parentPhoneNumber', 'personalPhoto'];
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    await student.update(updates);
    res.json({ message: 'Student updated successfully', messageAr: 'تم تحديث بيانات الطالب بنجاح', student });
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Remove student - soft delete (auth)
exports.removeStudent = async (req, res) => {
  try {
    const student = await EducationStudent.findByPk(req.params.studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    await student.update({ status: 'removed' });
    res.json({ message: 'Student removed successfully', messageAr: 'تم إزالة الطالب بنجاح' });
  } catch (error) {
    console.error('Error removing student:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get students for education (public - for attendance page)
exports.getStudentsForEducationPublic = async (req, res) => {
  try {
    const { id } = req.params;
    const education = await Education.findOne({ where: { educationId: id } });
    if (!education) {
      return res.status(404).json({ message: 'Education not found', messageAr: 'لم يتم العثور على التعليم' });
    }

    const students = await EducationStudent.findAll({
      where: { educationId: id, status: 'active' },
      order: [['fullName', 'ASC']]
    });

    res.json(students);
  } catch (error) {
    console.error('Error getting students for education (public):', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Submit attendance records (public)
exports.submitAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, records } = req.body;

    if (!date || !records || !Array.isArray(records)) {
      return res.status(400).json({ message: 'Date and records are required', messageAr: 'التاريخ والسجلات مطلوبة' });
    }

    const education = await Education.findOne({ where: { educationId: id } });
    if (!education) {
      return res.status(404).json({ message: 'Education not found', messageAr: 'لم يتم العثور على التعليم' });
    }

    const results = [];
    for (const record of records) {
      const [attendance] = await EducationAttendance.upsert({
        educationId: id,
        studentId: record.studentId,
        date: date,
        status: record.status
      });
      results.push(attendance);
    }

    res.json({ message: 'Attendance submitted successfully', messageAr: 'تم تسجيل الحضور بنجاح', count: results.length });
  } catch (error) {
    console.error('Error submitting attendance:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get attendance for a date or date range (public)
exports.getAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, startDate, endDate } = req.query;

    const whereClause = { educationId: id };

    if (date) {
      whereClause.date = date;
    } else if (startDate && endDate) {
      whereClause.date = { [Op.between]: [startDate, endDate] };
    }

    const attendance = await EducationAttendance.findAll({
      where: whereClause,
      include: [{ model: EducationStudent, as: 'student', attributes: ['studentId', 'fullName', 'nationalId', 'schoolName'] }],
      order: [['date', 'ASC'], ['studentId', 'ASC']]
    });

    res.json(attendance);
  } catch (error) {
    console.error('Error getting attendance:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Export attendance data as structured JSON (public)
exports.exportAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Start date and end date are required', messageAr: 'تاريخ البداية والنهاية مطلوبان' });
    }

    const education = await Education.findOne({
      where: { educationId: id },
      include: [{ model: User, as: 'user', attributes: ['firstName', 'lastName'] }]
    });

    if (!education) {
      return res.status(404).json({ message: 'Education not found', messageAr: 'لم يتم العثور على التعليم' });
    }

    const students = await EducationStudent.findAll({
      where: { educationId: id, status: 'active' },
      order: [['fullName', 'ASC']]
    });

    const attendance = await EducationAttendance.findAll({
      where: {
        educationId: id,
        date: { [Op.between]: [startDate, endDate] }
      },
      order: [['date', 'ASC']]
    });

    // Build a lookup: studentId -> { date -> status }
    const attendanceMap = {};
    attendance.forEach(a => {
      if (!attendanceMap[a.studentId]) attendanceMap[a.studentId] = {};
      attendanceMap[a.studentId][a.date] = a.status;
    });

    // Get unique dates
    const dates = [...new Set(attendance.map(a => a.date))].sort();

    const teacherName = education.user ? `${education.user.firstName} ${education.user.lastName}` : 'N/A';

    res.json({
      education: {
        educationId: education.educationId,
        section: education.section,
        teacherName,
        periodStartDate: education.periodStartDate,
        periodEndDate: education.periodEndDate
      },
      dates,
      students: students.map(s => ({
        studentId: s.studentId,
        fullName: s.fullName,
        nationalId: s.nationalId,
        schoolName: s.schoolName,
        attendance: dates.map(d => attendanceMap[s.studentId]?.[d] || '-')
      }))
    });
  } catch (error) {
    console.error('Error exporting attendance:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = exports;
