const { Workshop, WorkshopStudent, Employee, Admin } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { sendWorkshopRegistrationEmail, sendAttendanceIdEmail, sendWorkshopCustomEmail, generateAttendanceIdHtml, sendCertificateEmail } = require('../utils/emailService');

// Create a new workshop (admin)
exports.createWorkshop = async (req, res) => {
  try {
    const {
      title, description, presenter, assignedEmployeeId,
      startDate, endDate, startTime, endTime, totalHours,
      content, objectives, photo, maxParticipants, price,
      status, isActive, notes, color, minAge, maxAge
    } = req.body;

    if (!title || !presenter || !startDate) {
      return res.status(400).json({
        message: 'Title, presenter, and start date are required',
        messageAr: 'العنوان والمقدم وتاريخ البداية مطلوبة'
      });
    }

    const workshop = await Workshop.create({
      title, description, presenter, assignedEmployeeId,
      startDate, endDate, startTime, endTime, totalHours,
      content, objectives, photo, maxParticipants, price,
      status: status || 'upcoming',
      isActive: isActive !== undefined ? isActive : true,
      notes,
      color: color || '#1a56db',
      minAge: minAge || null,
      maxAge: maxAge || null,
      createdById: req.admin.adminId
    });

    res.status(201).json(workshop);
  } catch (error) {
    console.error('Error creating workshop:', error);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

// Get all workshops (admin)
exports.getAllWorkshops = async (req, res) => {
  try {
    // Auto-update workshop statuses based on dates
    const today = new Date().toISOString().split('T')[0];
    await Workshop.update(
      { status: 'completed' },
      { where: { status: { [Op.in]: ['upcoming', 'in_progress'] }, endDate: { [Op.lt]: today }, endDate: { [Op.not]: null } } }
    );
    await Workshop.update(
      { status: 'in_progress' },
      { where: { status: 'upcoming', startDate: { [Op.lte]: today }, [Op.or]: [{ endDate: { [Op.gte]: today } }, { endDate: null }] } }
    );

    const workshops = await Workshop.findAll({
      include: [
        {
          model: Employee,
          as: 'assignedEmployee',
          attributes: ['employeeId', 'name', 'email']
        },
        {
          model: Admin,
          as: 'creator',
          attributes: ['adminId', 'username', 'fullName']
        },
        {
          model: WorkshopStudent,
          as: 'students',
          attributes: ['studentId']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const result = workshops.map(w => {
      const plain = w.toJSON();
      plain.studentCount = plain.students ? plain.students.length : 0;
      delete plain.students;
      return plain;
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching workshops:', error);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

// Get workshop by ID with all students (admin)
exports.getWorkshopById = async (req, res) => {
  try {
    const { id } = req.params;

    const workshop = await Workshop.findByPk(id, {
      include: [
        {
          model: Employee,
          as: 'assignedEmployee',
          attributes: ['employeeId', 'name', 'email']
        },
        {
          model: Admin,
          as: 'creator',
          attributes: ['adminId', 'username', 'fullName']
        },
        {
          model: WorkshopStudent,
          as: 'students',
          order: [['createdAt', 'ASC']]
        }
      ]
    });

    if (!workshop) {
      return res.status(404).json({
        message: 'Workshop not found',
        messageAr: 'الورشة غير موجودة'
      });
    }

    res.json(workshop);
  } catch (error) {
    console.error('Error fetching workshop:', error);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

// Update workshop (admin)
exports.updateWorkshop = async (req, res) => {
  try {
    const { id } = req.params;

    const workshop = await Workshop.findByPk(id);
    if (!workshop) {
      return res.status(404).json({
        message: 'Workshop not found',
        messageAr: 'الورشة غير موجودة'
      });
    }

    const {
      title, description, presenter, assignedEmployeeId,
      startDate, endDate, startTime, endTime, totalHours,
      content, objectives, photo, maxParticipants, price,
      status, isActive, notes, color, minAge, maxAge
    } = req.body;

    await workshop.update({
      title: title !== undefined ? title : workshop.title,
      description: description !== undefined ? description : workshop.description,
      presenter: presenter !== undefined ? presenter : workshop.presenter,
      assignedEmployeeId: assignedEmployeeId !== undefined ? assignedEmployeeId : workshop.assignedEmployeeId,
      startDate: startDate !== undefined ? startDate : workshop.startDate,
      endDate: endDate !== undefined ? endDate : workshop.endDate,
      startTime: startTime !== undefined ? startTime : workshop.startTime,
      endTime: endTime !== undefined ? endTime : workshop.endTime,
      totalHours: totalHours !== undefined ? totalHours : workshop.totalHours,
      content: content !== undefined ? content : workshop.content,
      objectives: objectives !== undefined ? objectives : workshop.objectives,
      photo: photo !== undefined ? photo : workshop.photo,
      maxParticipants: maxParticipants !== undefined ? maxParticipants : workshop.maxParticipants,
      price: price !== undefined ? price : workshop.price,
      status: status !== undefined ? status : workshop.status,
      isActive: isActive !== undefined ? isActive : workshop.isActive,
      notes: notes !== undefined ? notes : workshop.notes,
      color: color !== undefined ? color : workshop.color,
      minAge: minAge !== undefined ? (minAge || null) : workshop.minAge,
      maxAge: maxAge !== undefined ? (maxAge || null) : workshop.maxAge
    });

    const updated = await Workshop.findByPk(id, {
      include: [
        {
          model: Employee,
          as: 'assignedEmployee',
          attributes: ['employeeId', 'name', 'email']
        },
        {
          model: Admin,
          as: 'creator',
          attributes: ['adminId', 'username', 'fullName']
        }
      ]
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating workshop:', error);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

// Delete workshop (admin)
exports.deleteWorkshop = async (req, res) => {
  try {
    const { id } = req.params;

    const workshop = await Workshop.findByPk(id);
    if (!workshop) {
      return res.status(404).json({
        message: 'Workshop not found',
        messageAr: 'الورشة غير موجودة'
      });
    }

    // Delete all students first
    await WorkshopStudent.destroy({ where: { workshopId: id } });
    await workshop.destroy();

    res.json({ message: 'Workshop deleted successfully', messageAr: 'تم حذف الورشة بنجاح' });
  } catch (error) {
    console.error('Error deleting workshop:', error);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

// Get active workshops (public, for registration form)
exports.getActiveWorkshops = async (req, res) => {
  try {
    const workshops = await Workshop.findAll({
      where: {
        isActive: true,
        status: { [Op.ne]: 'cancelled' }
      },
      attributes: [
        'workshopId', 'title', 'description', 'presenter',
        'startDate', 'endDate', 'startTime', 'endTime',
        'totalHours', 'content', 'objectives', 'photo',
        'maxParticipants', 'price', 'status', 'color', 'minAge', 'maxAge'
      ],
      include: [
        {
          model: WorkshopStudent,
          as: 'students',
          attributes: ['studentId']
        }
      ],
      order: [['startDate', 'ASC']]
    });

    const result = workshops.map(w => {
      const plain = w.toJSON();
      plain.studentCount = plain.students ? plain.students.length : 0;
      plain.spotsRemaining = plain.maxParticipants
        ? plain.maxParticipants - plain.studentCount
        : null;
      delete plain.students;
      return plain;
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching active workshops:', error);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

// Lookup student by phone or nationalId (public)
exports.lookupStudent = async (req, res) => {
  try {
    const { identifier } = req.query;
    if (!identifier) return res.json({ found: false });

    const student = await WorkshopStudent.findOne({
      where: {
        [Op.or]: [
          { phone: identifier },
          { nationalId: identifier }
        ]
      },
      order: [['createdAt', 'DESC']]
    });

    if (student) {
      res.json({
        found: true,
        student: {
          firstName: student.firstName,
          lastName: student.lastName,
          phone: student.phone,
          email: student.email,
          nationalId: student.nationalId,
          gender: student.gender,
          age: student.age,
          city: student.city
        }
      });
    } else {
      res.json({ found: false });
    }
  } catch (error) {
    console.error('Lookup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Register student for workshop (public)
// Check if student is already registered for a workshop
exports.checkDuplicate = async (req, res) => {
  try {
    const { workshopId, phone, email, nationalId } = req.query;
    if (!workshopId || !phone) return res.json({ duplicate: false });

    const orConditions = [{ phone }];
    if (email) orConditions.push({ email });
    if (nationalId) orConditions.push({ nationalId });

    const existing = await WorkshopStudent.findOne({
      where: { workshopId, [Op.or]: orConditions }
    });

    res.json({ duplicate: !!existing });
  } catch (error) {
    res.json({ duplicate: false });
  }
};

exports.registerStudent = async (req, res) => {
  try {
    const {
      workshopId, firstName, lastName, phone, email,
      nationalId, gender, age, city, invoiceNumber, notes
    } = req.body;

    if (!workshopId || !firstName || !lastName || !phone || !email || !nationalId || !gender || !age || !city || !invoiceNumber) {
      return res.status(400).json({
        message: 'All fields are required',
        messageAr: 'جميع الحقول مطلوبة'
      });
    }

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        message: 'Invalid email address',
        messageAr: 'البريد الإلكتروني غير صحيح'
      });
    }

    // Check workshop exists and is active
    const workshop = await Workshop.findByPk(workshopId, {
      include: [{
        model: WorkshopStudent,
        as: 'students',
        attributes: ['studentId']
      }]
    });

    if (!workshop) {
      return res.status(404).json({
        message: 'Workshop not found',
        messageAr: 'الورشة غير موجودة'
      });
    }

    if (!workshop.isActive || workshop.status === 'cancelled') {
      return res.status(400).json({
        message: 'This workshop is not accepting registrations',
        messageAr: 'هذه الورشة لا تقبل التسجيل حالياً'
      });
    }

    // Check duplicate registration (same workshop + same phone or email)
    const duplicateWhere = { workshopId, [Op.or]: [{ phone }] };
    if (email) duplicateWhere[Op.or].push({ email });
    if (nationalId) duplicateWhere[Op.or].push({ nationalId });

    const existing = await WorkshopStudent.findOne({ where: duplicateWhere });
    if (existing) {
      return res.status(400).json({
        message: 'You are already registered for this workshop',
        messageAr: 'أنت مسجل بالفعل في هذه الورشة'
      });
    }

    // Check age range
    const studentAge = parseInt(age);
    if (!isNaN(studentAge) && (workshop.minAge || workshop.maxAge)) {
      if (workshop.minAge && studentAge < workshop.minAge) {
        return res.status(400).json({ message: `Age must be between ${workshop.minAge}-${workshop.maxAge || '∞'} years. Your age: ${studentAge}`, messageAr: `العمر يجب أن يكون بين ${workshop.minAge} و ${workshop.maxAge || '∞'} سنة. عمرك: ${studentAge}` });
      }
      if (workshop.maxAge && studentAge > workshop.maxAge) {
        return res.status(400).json({ message: `Age must be between ${workshop.minAge || 0}-${workshop.maxAge} years. Your age: ${studentAge}`, messageAr: `العمر يجب أن يكون بين ${workshop.minAge || 0} و ${workshop.maxAge} سنة. عمرك: ${studentAge}` });
      }
    }

    // Check capacity
    if (workshop.maxParticipants) {
      const currentCount = workshop.students ? workshop.students.length : 0;
      if (currentCount >= workshop.maxParticipants) {
        return res.status(400).json({
          message: 'This workshop is full',
          messageAr: 'هذه الورشة ممتلئة'
        });
      }
    }

    const student = await WorkshopStudent.create({
      workshopId, firstName, lastName, phone, email,
      nationalId, gender, age, city, invoiceNumber, notes
    });

    // Send confirmation email with workshop details + attendance ID
    if (email) {
      const fullName = `${firstName || ''} ${lastName || ''}`.trim();
      sendWorkshopRegistrationEmail(email, fullName, workshop, invoiceNumber).catch(err => {
        console.error('Workshop email error (non-blocking):', err.message);
      });
      // Also send attendance ID
      sendAttendanceIdEmail(email, student, workshop).catch(err => {
        console.error('Attendance ID email error (non-blocking):', err.message);
      });
    }

    res.status(201).json({
      message: 'Registration successful',
      messageAr: 'تم التسجيل بنجاح',
      student,
      workshop: { title: workshop.title, startDate: workshop.startDate, endDate: workshop.endDate }
    });
  } catch (error) {
    console.error('Error registering student:', error);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

// Update student (admin)
exports.updateStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await WorkshopStudent.findByPk(id);
    if (!student) {
      return res.status(404).json({
        message: 'Student not found',
        messageAr: 'الطالب غير موجود'
      });
    }

    const {
      firstName, lastName, phone, email, nationalId,
      gender, age, city, invoiceNumber, paymentStatus,
      attended, performanceRating, performanceNotes,
      certificatePrinted, notes
    } = req.body;

    await student.update({
      firstName: firstName !== undefined ? firstName : student.firstName,
      lastName: lastName !== undefined ? lastName : student.lastName,
      phone: phone !== undefined ? phone : student.phone,
      email: email !== undefined ? email : student.email,
      nationalId: nationalId !== undefined ? nationalId : student.nationalId,
      gender: gender !== undefined ? gender : student.gender,
      age: age !== undefined ? age : student.age,
      city: city !== undefined ? city : student.city,
      invoiceNumber: invoiceNumber !== undefined ? invoiceNumber : student.invoiceNumber,
      paymentStatus: paymentStatus !== undefined ? paymentStatus : student.paymentStatus,
      attended: attended !== undefined ? attended : student.attended,
      performanceRating: performanceRating !== undefined ? performanceRating : student.performanceRating,
      performanceNotes: performanceNotes !== undefined ? performanceNotes : student.performanceNotes,
      certificatePrinted: certificatePrinted !== undefined ? certificatePrinted : student.certificatePrinted,
      notes: notes !== undefined ? notes : student.notes
    });

    res.json(student);
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

// Delete student (admin)
exports.deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await WorkshopStudent.findByPk(id);
    if (!student) {
      return res.status(404).json({
        message: 'Student not found',
        messageAr: 'الطالب غير موجود'
      });
    }

    await student.destroy();

    res.json({ message: 'Student deleted successfully', messageAr: 'تم حذف الطالب بنجاح' });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

// Mark attendance (admin)
exports.markAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, present } = req.body;
    const today = date || new Date().toISOString().split('T')[0];

    const student = await WorkshopStudent.findByPk(id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found', messageAr: 'الطالب غير موجود' });
    }

    let dates = Array.isArray(student.attendanceDates) ? [...student.attendanceDates] : [];
    if (present) {
      if (!dates.includes(today)) dates.push(today);
    } else {
      dates = dates.filter(d => d !== today);
    }

    await student.update({ attendanceDates: dates, attended: dates.length > 0 });
    res.json(student);
  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

// Rate student (admin)
exports.rateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { performanceRating, performanceNotes } = req.body;

    const student = await WorkshopStudent.findByPk(id);
    if (!student) {
      return res.status(404).json({
        message: 'Student not found',
        messageAr: 'الطالب غير موجود'
      });
    }

    if (performanceRating !== undefined && (performanceRating < 1 || performanceRating > 5)) {
      return res.status(400).json({
        message: 'Rating must be between 1 and 5',
        messageAr: 'التقييم يجب أن يكون بين 1 و 5'
      });
    }

    await student.update({
      performanceRating: performanceRating !== undefined ? performanceRating : student.performanceRating,
      performanceNotes: performanceNotes !== undefined ? performanceNotes : student.performanceNotes
    });

    res.json(student);
  } catch (error) {
    console.error('Error rating student:', error);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

// Verify payment (admin)
exports.verifyPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;

    const student = await WorkshopStudent.findByPk(id);
    if (!student) {
      return res.status(404).json({
        message: 'Student not found',
        messageAr: 'الطالب غير موجود'
      });
    }

    if (!['pending', 'verified', 'rejected'].includes(paymentStatus)) {
      return res.status(400).json({
        message: 'Invalid payment status',
        messageAr: 'حالة الدفع غير صالحة'
      });
    }

    await student.update({ paymentStatus });

    res.json(student);
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

// Get my workshops (employee)
// Send email to all students in a workshop
exports.emailAllStudents = async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, message } = req.body;
    if (!subject || !message) return res.status(400).json({ message: 'Subject and message required' });

    const workshop = await Workshop.findByPk(id, {
      include: [{ model: WorkshopStudent, as: 'students' }]
    });
    if (!workshop) return res.status(404).json({ message: 'Workshop not found' });

    const emails = (workshop.students || []).filter(s => s.email).map(s => s.email);
    if (emails.length === 0) return res.status(400).json({ message: 'No students with email addresses' });

    await sendWorkshopCustomEmail(emails, subject, message, workshop.title);
    res.json({ message: `Email sent to ${emails.length} students`, count: emails.length });
  } catch (error) {
    console.error('Email all students error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Send email to one student
exports.emailOneStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, message } = req.body;
    if (!subject || !message) return res.status(400).json({ message: 'Subject and message required' });

    const student = await WorkshopStudent.findByPk(id, {
      include: [{ model: Workshop, as: 'workshop' }]
    });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    if (!student.email) return res.status(400).json({ message: 'Student has no email' });

    await sendWorkshopCustomEmail(student.email, subject, message, student.workshop?.title || '');
    res.json({ message: 'Email sent' });
  } catch (error) {
    console.error('Email student error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Send attendance ID email to a student
exports.sendAttendanceId = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await WorkshopStudent.findByPk(id, {
      include: [{ model: Workshop, as: 'workshop' }]
    });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    if (!student.email) return res.status(400).json({ message: 'Student has no email' });

    await sendAttendanceIdEmail(student.email, student, student.workshop);
    res.json({ message: 'Attendance ID sent' });
  } catch (error) {
    console.error('Send attendance ID error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get attendance ID HTML (for printing from admin)
// Export workshop students as CSV
exports.exportStudentsCSV = async (req, res) => {
  try {
    const { id } = req.params;
    const workshop = await Workshop.findByPk(id, {
      include: [{ model: WorkshopStudent, as: 'students' }],
      order: [[{ model: WorkshopStudent, as: 'students' }, 'createdAt', 'ASC']]
    });
    if (!workshop) return res.status(404).json({ message: 'Workshop not found' });

    const BOM = '\uFEFF';
    const rows = [];

    // Workshop info header
    rows.push(`"الورشة / Workshop","${workshop.title}"`);
    rows.push(`"المقدم / Presenter","${workshop.presenter || ''}"`);
    rows.push(`"التاريخ / Date","${workshop.startDate || ''}${workshop.endDate ? ' → ' + workshop.endDate : ''}"`);
    rows.push(`"الساعات / Hours","${workshop.totalHours || ''}"`);
    rows.push(`"السعر / Price","${workshop.price || 'Free'}"`);
    rows.push(`"عدد الطلاب / Students","${(workshop.students || []).length}${workshop.maxParticipants ? ' / ' + workshop.maxParticipants : ''}"`);
    rows.push('');

    // Student table header
    rows.push('"#","الاسم الأول","الاسم الأخير","الهاتف","البريد","الهوية","الجنس","العمر","المدينة","رقم الفاتورة","حالة الدفع","الحضور (أيام)","التقييم","ملاحظات"');

    // Student rows
    (workshop.students || []).forEach((s, i) => {
      const attendedDays = Array.isArray(s.attendanceDates) ? s.attendanceDates.length : 0;
      rows.push([
        i + 1,
        `"${s.firstName || ''}"`,
        `"${s.lastName || ''}"`,
        `"${s.phone || ''}"`,
        `"${s.email || ''}"`,
        `"${s.nationalId || ''}"`,
        `"${s.gender || ''}"`,
        `"${s.age || ''}"`,
        `"${s.city || ''}"`,
        `"${s.invoiceNumber || ''}"`,
        `"${s.paymentStatus || ''}"`,
        attendedDays,
        s.performanceRating || '',
        `"${(s.performanceNotes || '').replace(/"/g, '""')}"`
      ].join(','));
    });

    const csv = BOM + rows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="workshop_export.csv"; filename*=UTF-8''${encodeURIComponent(workshop.title)}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Export CSV error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAttendanceIdHtml = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await WorkshopStudent.findByPk(id, {
      include: [{ model: Workshop, as: 'workshop' }]
    });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const html = generateAttendanceIdHtml(student, student.workshop);
    res.json({ html, student, workshop: student.workshop });
  } catch (error) {
    console.error('Get attendance ID error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Download certificate as PDF
exports.downloadCertificatePdf = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await WorkshopStudent.findByPk(id, {
      include: [{ model: Workshop, as: 'workshop' }]
    });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // Check attendance - must attend more than half the workshop days
    const workshopDays = (() => {
      if (!student.workshop.startDate) return 1;
      const start = new Date(student.workshop.startDate);
      const end = student.workshop.endDate ? new Date(student.workshop.endDate) : start;
      return Math.max(1, Math.ceil((end - start) / (1000*60*60*24)) + 1);
    })();
    const attendedDaysCount = Array.isArray(student.attendanceDates) ? student.attendanceDates.length : 0;
    const requiredDays = Math.ceil(workshopDays / 2);

    if (attendedDaysCount < requiredDays) {
      return res.status(400).json({
        message: `Student must attend at least ${requiredDays} of ${workshopDays} days. Currently attended: ${attendedDaysCount}`,
        messageAr: `يجب على الطالب حضور ${requiredDays} يوم على الأقل من أصل ${workshopDays} يوم. الحضور الحالي: ${attendedDaysCount} يوم`
      });
    }

    const name = `${student.firstName || ''} ${student.lastName || ''}`.trim();
    const certId = 'WS-' + (student.studentId || '').substring(0, 8).toUpperCase();
    const attendedDays = Array.isArray(student.attendanceDates) ? student.attendanceDates.length : 0;
    const startDateF = student.workshop.startDate ? student.workshop.startDate.split('-').reverse().join('/') : '';
    const workshop = student.workshop;

    const certHtml = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>شهادة - ${name}</title>
<style>@page{size:A4 landscape;margin:0;}*{margin:0;padding:0;box-sizing:border-box;}html,body{width:297mm;height:210mm;overflow:hidden;}
body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 50%,#f093fb 100%);display:flex;align-items:center;justify-content:center;padding:10mm;}
.cert{width:277mm;height:190mm;background:linear-gradient(145deg,#fff,#f8fafc);border-radius:16px;position:relative;overflow:hidden;}
.cert::before{content:'';position:absolute;inset:0;border:6px solid transparent;border-image:linear-gradient(135deg,#e02529,#ff6b6b,#feca57,#48dbfb,#e02529) 1;pointer-events:none;}
.dc{position:absolute;border-radius:50%;opacity:0.1;}.d1{width:200px;height:200px;background:#e02529;top:-50px;right:-50px;}.d2{width:150px;height:150px;background:#667eea;bottom:-30px;left:-30px;}.d3{width:100px;height:100px;background:#feca57;top:50%;left:20px;transform:translateY(-50%);}
.inner{padding:20mm 25mm;height:100%;display:flex;flex-direction:column;position:relative;z-index:1;}
.hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:12mm;}.logo{height:85px;}
.hc{text-align:center;flex:1;padding:0 20px;}.on{font-size:11px;color:#64748b;letter-spacing:2px;margin-bottom:5px;}
.ct{font-size:44px;font-weight:800;color:#e02529;margin-bottom:4px;}
.cs{font-size:16px;color:#475569;font-weight:500;letter-spacing:3px;}
.div{height:4px;background:linear-gradient(90deg,#e02529,#ff6b6b,#feca57,#48dbfb,#667eea,#764ba2);border-radius:2px;margin-bottom:10mm;}
.mc{text-align:center;flex:1;display:flex;flex-direction:column;justify-content:center;}
.pt{font-size:14px;color:#64748b;margin-bottom:8px;}
.vn{font-size:42px;font-weight:700;color:#1e293b;margin-bottom:12px;border-bottom:4px solid #e02529;display:inline-block;padding-bottom:6px;}
.at{font-size:15px;line-height:1.8;color:#475569;max-width:600px;margin:15px auto;}.hl{color:#e02529;font-weight:700;font-size:17px;}
.sc{display:flex;justify-content:center;gap:30px;margin:12px 0;}
.st{background:linear-gradient(135deg,#e02529,#ff6b6b);color:#fff;padding:12px 30px;border-radius:12px;text-align:center;min-width:140px;}
.st.a{background:linear-gradient(135deg,#667eea,#764ba2);}.st.g{background:linear-gradient(135deg,#f59e0b,#fbbf24);}
.sv{font-size:22px;font-weight:700;}.sl{font-size:10px;opacity:0.9;margin-top:2px;}
.ty{font-size:13px;color:#64748b;margin-top:10px;font-style:italic;}.hd{color:#e02529;font-weight:600;}
.fs{display:flex;justify-content:space-between;align-items:flex-end;margin-top:auto;padding-top:10mm;}
.ci{font-family:monospace;font-size:10px;color:#94a3b8;background:#f1f5f9;padding:6px 14px;border-radius:20px;display:inline-block;}
.cd{font-size:10px;color:#94a3b8;margin-top:5px;}.of{text-align:center;flex:1;font-size:10px;color:#94a3b8;}
.rb{position:absolute;top:25px;left:-35px;width:150px;height:30px;background:linear-gradient(135deg,#e02529,#c41e24);transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:600;}
</style></head><body><div class="cert">
<div class="dc d1"></div><div class="dc d2"></div><div class="dc d3"></div>
<div class="rb">متدرب متميز</div>
<div class="inner"><div class="hdr"><div><img src="https://fablabsahsa.com/found.png" class="logo"/></div><div class="hc"><div class="on">مؤسسة عبدالمنعم الراشد الإنسانية</div><div class="ct">شهادة إتمام ورشة</div><div class="cs">WORKSHOP CERTIFICATE</div></div><div><img src="https://fablabsahsa.com/fablab.png" class="logo"/></div></div>
<div class="div"></div>
<div class="mc"><div class="pt">تشهد إدارة فاب لاب الأحساء بأن</div><div class="vn">${name}</div>
<div class="at">قد أتم بنجاح الورشة التدريبية <span class="hl">"${workshop.title}"</span>${workshop.presenter ? `<br/>التي قدمها <b>${workshop.presenter}</b>` : ''}<br/>${workshop.objectives || 'واكتسب المعارف والمهارات المطلوبة'}</div>
<div class="sc">${workshop.totalHours ? `<div class="st"><div class="sv">${workshop.totalHours}</div><div class="sl">ساعة تدريبية</div></div>` : ''}${attendedDays > 0 ? `<div class="st a"><div class="sv">${attendedDays}</div><div class="sl">يوم حضور</div></div>` : ''}${startDateF ? `<div class="st g"><div class="sv">${startDateF}</div><div class="sl">تاريخ البداية</div></div>` : ''}</div>
<div class="ty"><span class="hd">"ومن سلك طريقاً يلتمس فيه علماً سهّل الله له به طريقاً إلى الجنة"</span><br/>شكراً لحضورك وتفاعلك</div></div>
<div class="fs"><div><div class="ci">${certId}</div><div class="cd">${new Date().toLocaleDateString('ar-SA')}</div></div><div class="of">فاب لاب الأحساء — مختبر التصنيع الرقمي<br/>FABLAB Al-Ahsa</div><div style="width:140px;"></div></div>
</div></div></body></html>`;

    const { generatePdfFromHtml } = require('../utils/pdfGenerator');
    const pdfBuffer = await generatePdfFromHtml(certHtml, { landscape: true });

    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="certificate.pdf"',
      'Content-Length': pdfBuffer.length
    });
    res.end(pdfBuffer);
  } catch (error) {
    console.error('Download certificate PDF error:', error);
    res.status(500).json({ message: 'Error generating PDF. Make sure Chromium is installed on the server.' });
  }
};

// Send certificate via email
exports.sendCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await WorkshopStudent.findByPk(id, {
      include: [{ model: Workshop, as: 'workshop' }]
    });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    if (!student.email) return res.status(400).json({ message: 'Student has no email', messageAr: 'الطالب ليس لديه بريد إلكتروني' });

    // Check attendance - must attend more than half the workshop days
    const workshopDays = (() => {
      if (!student.workshop.startDate) return 1;
      const start = new Date(student.workshop.startDate);
      const end = student.workshop.endDate ? new Date(student.workshop.endDate) : start;
      return Math.max(1, Math.ceil((end - start) / (1000*60*60*24)) + 1);
    })();
    const attendedDays = Array.isArray(student.attendanceDates) ? student.attendanceDates.length : 0;
    const requiredDays = Math.ceil(workshopDays / 2);

    if (attendedDays < requiredDays) {
      return res.status(400).json({
        message: `Student must attend at least ${requiredDays} of ${workshopDays} days. Currently attended: ${attendedDays}`,
        messageAr: `يجب على الطالب حضور ${requiredDays} يوم على الأقل من أصل ${workshopDays} يوم. الحضور الحالي: ${attendedDays} يوم`
      });
    }

    await sendCertificateEmail(student.email, student, student.workshop);
    res.json({ message: 'Certificate sent' });
  } catch (error) {
    console.error('Send certificate error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMyWorkshops = async (req, res) => {
  try {
    const employeeId = req.employee.employeeId;

    const workshops = await Workshop.findAll({
      where: { assignedEmployeeId: employeeId },
      include: [
        {
          model: WorkshopStudent,
          as: 'students'
        }
      ],
      order: [['startDate', 'DESC']]
    });

    res.json(workshops);
  } catch (error) {
    console.error('Error fetching employee workshops:', error);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

// Mark attendance (employee) - verifies workshop assignment
exports.markAttendanceEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { attended } = req.body;
    const employeeId = req.employee.employeeId;

    const student = await WorkshopStudent.findByPk(id, {
      include: [{
        model: Workshop,
        as: 'workshop',
        attributes: ['workshopId', 'assignedEmployeeId']
      }]
    });

    if (!student) {
      return res.status(404).json({
        message: 'Student not found',
        messageAr: 'الطالب غير موجود'
      });
    }

    if (!student.workshop || student.workshop.assignedEmployeeId !== employeeId) {
      return res.status(403).json({
        message: 'You are not assigned to this workshop',
        messageAr: 'لم يتم تعيينك لهذه الورشة'
      });
    }

    const { date, present } = req.body;
    const today = date || new Date().toISOString().split('T')[0];
    let dates = Array.isArray(student.attendanceDates) ? [...student.attendanceDates] : [];
    if (present) {
      if (!dates.includes(today)) dates.push(today);
    } else {
      dates = dates.filter(d => d !== today);
    }
    await student.update({ attendanceDates: dates, attended: dates.length > 0 });

    res.json(student);
  } catch (error) {
    console.error('Error marking attendance (employee):', error);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

// Rate student (employee) - verifies workshop assignment
exports.rateStudentEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { performanceRating, performanceNotes } = req.body;
    const employeeId = req.employee.employeeId;

    const student = await WorkshopStudent.findByPk(id, {
      include: [{
        model: Workshop,
        as: 'workshop',
        attributes: ['workshopId', 'assignedEmployeeId']
      }]
    });

    if (!student) {
      return res.status(404).json({
        message: 'Student not found',
        messageAr: 'الطالب غير موجود'
      });
    }

    if (!student.workshop || student.workshop.assignedEmployeeId !== employeeId) {
      return res.status(403).json({
        message: 'You are not assigned to this workshop',
        messageAr: 'لم يتم تعيينك لهذه الورشة'
      });
    }

    if (performanceRating !== undefined && (performanceRating < 1 || performanceRating > 5)) {
      return res.status(400).json({
        message: 'Rating must be between 1 and 5',
        messageAr: 'التقييم يجب أن يكون بين 1 و 5'
      });
    }

    await student.update({
      performanceRating: performanceRating !== undefined ? performanceRating : student.performanceRating,
      performanceNotes: performanceNotes !== undefined ? performanceNotes : student.performanceNotes
    });

    res.json(student);
  } catch (error) {
    console.error('Error rating student (employee):', error);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};
