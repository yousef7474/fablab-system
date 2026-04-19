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
      status, isActive, notes, color
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
      status, isActive, notes, color
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
      color: color !== undefined ? color : workshop.color
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
        'maxParticipants', 'price', 'status', 'color'
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

    if (!workshopId || !firstName || !phone || !invoiceNumber) {
      return res.status(400).json({
        message: 'Workshop ID, first name, phone, and invoice number are required',
        messageAr: 'معرف الورشة والاسم الأول ورقم الجوال ورقم الفاتورة مطلوبة'
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
      include: [{ model: WorkshopStudent, as: 'students', order: [['createdAt', 'ASC']] }]
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
    res.setHeader('Content-Disposition', `attachment; filename=workshop_${workshop.title.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_')}.csv`);
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

// Send certificate via email
exports.sendCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await WorkshopStudent.findByPk(id, {
      include: [{ model: Workshop, as: 'workshop' }]
    });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    if (!student.email) return res.status(400).json({ message: 'Student has no email', messageAr: 'الطالب ليس لديه بريد إلكتروني' });

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
