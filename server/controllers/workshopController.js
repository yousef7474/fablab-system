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
      status, isActive, isPublic, notes, color, minAge, maxAge
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
      isPublic: isPublic !== undefined ? !!isPublic : true,
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
      { where: { status: { [Op.in]: ['upcoming', 'in_progress'] }, endDate: { [Op.and]: [{ [Op.not]: null }, { [Op.lt]: today }] } } }
    );
    await Workshop.update(
      { status: 'in_progress' },
      { where: { status: 'upcoming', startDate: { [Op.lte]: today }, [Op.or]: [{ endDate: { [Op.gte]: today } }, { endDate: null }] } }
    );
    // Reset wrongly completed future workshops back to upcoming
    await Workshop.update(
      { status: 'upcoming' },
      { where: { status: 'completed', startDate: { [Op.gt]: today } } }
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
      status, isActive, isPublic, notes, color, minAge, maxAge
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
      isPublic: isPublic !== undefined ? !!isPublic : workshop.isPublic,
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
        isPublic: true,
        status: { [Op.notIn]: ['cancelled', 'completed'] }
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
// Check if student is already registered for a workshop (by national ID only).
exports.checkDuplicate = async (req, res) => {
  try {
    const { workshopId, nationalId } = req.query;
    if (!workshopId || !nationalId) return res.json({ duplicate: false });

    const existing = await WorkshopStudent.findOne({
      where: { workshopId, nationalId }
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

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        message: 'Invalid email address',
        messageAr: 'البريد الإلكتروني غير صحيح'
      });
    }

    // Concurrency note: capacity + duplicate checks MUST happen under a row
    // lock on the workshop. Without the lock, N concurrent requests can each
    // observe `count < maxParticipants` before any of them inserts, then all
    // insert — producing overbooked workshops (e.g. 30 students in 25 seats).
    const result = await sequelize.transaction(async (t) => {
      const workshop = await Workshop.findByPk(workshopId, {
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!workshop) {
        throw { status: 404, message: 'Workshop not found', messageAr: 'الورشة غير موجودة' };
      }

      if (!workshop.isActive || workshop.status === 'cancelled') {
        throw { status: 400, message: 'This workshop is not accepting registrations', messageAr: 'هذه الورشة لا تقبل التسجيل حالياً' };
      }

      // Admin-only workshops are hidden from the public listing and cannot
      // be registered for via the public form. Guarded here too so a leaked
      // workshopId can't bypass the visibility flag.
      if (workshop.isPublic === false) {
        throw { status: 403, message: 'This workshop is not open for public registration', messageAr: 'هذه الورشة غير متاحة للتسجيل العام' };
      }

      // Duplicate check is by student national ID only. Repeated emails,
      // phones, and names are allowed (e.g. a parent registering multiple
      // children from the same contact info).
      if (nationalId) {
        const existing = await WorkshopStudent.findOne({
          where: { workshopId, nationalId },
          transaction: t
        });
        if (existing) {
          throw { status: 400, message: 'This student is already registered for this workshop', messageAr: 'هذا الطالب مسجل بالفعل في هذه الورشة' };
        }
      }

      const studentAge = parseInt(age);
      if (!isNaN(studentAge) && (workshop.minAge || workshop.maxAge)) {
        if (workshop.minAge && studentAge < workshop.minAge) {
          throw { status: 400, message: `Age must be between ${workshop.minAge}-${workshop.maxAge || '∞'} years. Your age: ${studentAge}`, messageAr: `العمر يجب أن يكون بين ${workshop.minAge} و ${workshop.maxAge || '∞'} سنة. عمرك: ${studentAge}` };
        }
        if (workshop.maxAge && studentAge > workshop.maxAge) {
          throw { status: 400, message: `Age must be between ${workshop.minAge || 0}-${workshop.maxAge} years. Your age: ${studentAge}`, messageAr: `العمر يجب أن يكون بين ${workshop.minAge || 0} و ${workshop.maxAge} سنة. عمرك: ${studentAge}` };
        }
      }

      if (workshop.maxParticipants) {
        const currentCount = await WorkshopStudent.count({
          where: { workshopId },
          transaction: t
        });
        if (currentCount >= workshop.maxParticipants) {
          throw { status: 400, message: 'This workshop is full', messageAr: 'هذه الورشة ممتلئة' };
        }
      }

      const student = await WorkshopStudent.create({
        workshopId, firstName, lastName, phone, email,
        nationalId, gender, age, city, invoiceNumber, notes
      }, { transaction: t });

      return { student, workshop };
    });

    const { student, workshop } = result;

    if (email) {
      const fullName = `${firstName || ''} ${lastName || ''}`.trim();
      sendWorkshopRegistrationEmail(email, fullName, workshop, invoiceNumber).catch(err => {
        console.error('Workshop email error (non-blocking):', err.message);
      });
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
    if (error && error.status) {
      return res.status(error.status).json({ message: error.message, messageAr: error.messageAr });
    }
    console.error('Error registering student:', error);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

// Admin: manually add a student to a workshop.
// Same lock-protected capacity + duplicate-by-nationalId check as the
// public registerStudent endpoint, but more permissive: invoice number,
// email, gender, age, and city are all optional. Only first name and
// phone are required so the admin can record a walk-in quickly.
exports.adminAddStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      firstName, lastName, phone, email, nationalId,
      gender, age, city, invoiceNumber, notes
    } = req.body || {};

    if (!firstName || !phone) {
      return res.status(400).json({
        message: 'First name and phone are required',
        messageAr: 'الاسم الأول ورقم الهاتف مطلوبان'
      });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        message: 'Invalid email address',
        messageAr: 'البريد الإلكتروني غير صحيح'
      });
    }

    const result = await sequelize.transaction(async (t) => {
      const workshop = await Workshop.findByPk(id, {
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!workshop) {
        throw { status: 404, message: 'Workshop not found', messageAr: 'الورشة غير موجودة' };
      }

      if (nationalId) {
        const existing = await WorkshopStudent.findOne({
          where: { workshopId: id, nationalId },
          transaction: t
        });
        if (existing) {
          throw { status: 400, message: 'This student is already registered for this workshop', messageAr: 'هذا الطالب مسجل بالفعل في هذه الورشة' };
        }
      }

      if (workshop.maxParticipants) {
        const currentCount = await WorkshopStudent.count({
          where: { workshopId: id },
          transaction: t
        });
        if (currentCount >= workshop.maxParticipants) {
          throw { status: 400, message: 'This workshop is full', messageAr: 'هذه الورشة ممتلئة' };
        }
      }

      const student = await WorkshopStudent.create({
        workshopId: id,
        firstName,
        lastName: lastName || '',
        phone,
        email: email || '',
        nationalId: nationalId || '',
        gender: gender || '',
        age: age || '',
        city: city || '',
        invoiceNumber: invoiceNumber || '',
        notes: notes || ''
      }, { transaction: t });

      return { student, workshop };
    });

    res.status(201).json({
      message: 'Student added',
      messageAr: 'تم إضافة الطالب',
      student: result.student
    });
  } catch (error) {
    if (error && error.status) {
      return res.status(error.status).json({ message: error.message, messageAr: error.messageAr });
    }
    console.error('Admin add student error:', error);
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

    // Why this exact format: a plain UTF-8 CSV either (a) opens as a
    // single column in Excel locales whose default list separator is ';'
    // instead of ',', or (b) loses the UTF-8 BOM (and mangles Arabic)
    // when we add the `sep=,` directive that forces comma splitting.
    // UTF-16 LE with a leading FF FE BOM + tab as the field separator is
    // the only encoding every Excel locale opens cleanly: the BOM forces
    // Unicode rendering (Arabic intact), and tabs split into columns
    // regardless of regional settings.
    const TAB = '\t';
    const NL = '\r\n';
    const cell = (v) => String(v == null ? '' : v).replace(/[\t\r\n]+/g, ' ');
    const rows = [];

    rows.push(`الورشة / Workshop${TAB}${cell(workshop.title)}`);
    rows.push(`المقدم / Presenter${TAB}${cell(workshop.presenter)}`);
    rows.push(`التاريخ / Date${TAB}${cell(workshop.startDate)}${workshop.endDate ? ' → ' + cell(workshop.endDate) : ''}`);
    rows.push(`الساعات / Hours${TAB}${cell(workshop.totalHours)}`);
    rows.push(`السعر / Price${TAB}${cell(workshop.price || 'Free')}`);
    rows.push(`عدد الطلاب / Students${TAB}${(workshop.students || []).length}${workshop.maxParticipants ? ' / ' + workshop.maxParticipants : ''}`);
    rows.push('');

    rows.push([
      '#', 'الاسم الكامل', 'الهاتف', 'البريد', 'الهوية',
      'الجنس', 'العمر', 'المدينة', 'رقم الفاتورة', 'حالة الدفع',
      'الحضور (أيام)', 'التقييم', 'ملاحظات'
    ].join(TAB));

    (workshop.students || []).forEach((s, i) => {
      const attendedDays = Array.isArray(s.attendanceDates) ? s.attendanceDates.length : 0;
      const fullName = [s.firstName, s.lastName].filter(Boolean).join(' ');
      rows.push([
        i + 1,
        cell(fullName),
        cell(s.phone),
        cell(s.email),
        cell(s.nationalId),
        cell(s.gender),
        cell(s.age),
        cell(s.city),
        cell(s.invoiceNumber),
        cell(s.paymentStatus),
        attendedDays,
        cell(s.performanceRating),
        cell(s.performanceNotes)
      ].join(TAB));
    });

    const text = '﻿' + rows.join(NL);
    const buf = Buffer.from(text, 'utf16le');

    res.setHeader('Content-Type', 'text/csv; charset=utf-16le');
    res.setHeader('Content-Disposition', `attachment; filename="workshop_export.csv"; filename*=UTF-8''${encodeURIComponent(workshop.title)}.csv`);
    res.send(buf);
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

    // QR scan side-effect: auto-mark payment as verified + add today's attendance
    const today = new Date().toISOString().split('T')[0];
    const dates = Array.isArray(student.attendanceDates) ? [...student.attendanceDates] : [];
    let updated = false;
    if (!dates.includes(today)) { dates.push(today); updated = true; }
    const willMarkPaid = student.paymentStatus !== 'verified';
    if (updated || willMarkPaid) {
      await student.update({
        attendanceDates: dates,
        attended: dates.length > 0,
        paymentStatus: 'verified'
      });
    }

    const html = generateAttendanceIdHtml(student, student.workshop);
    res.json({ html, student, workshop: student.workshop, paidNow: willMarkPaid, attendedToday: updated });
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

    // "Plain" mode = content-only, meant to be printed on top of a
    // preprinted A4 landscape shell that already has the letterhead,
    // colorful outline, and logos. Uses the exact margins the admin
    // measured on the printed sheet (top 5, right 2, bottom 4, left 5
    // — in cm) so the text lands inside the empty area.
    if (req.query.plain === '1' || req.query.plain === 'true') {
      const plainHtml = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>شهادة - ${name}</title>
<style>
  @page { size: A4 landscape; margin: 5cm 2cm 4cm 5cm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
    color: #000;
    background: #fff;
  }
  body { line-height: 1.55; }
  .wrap {
    /* printable area = 297 - 2 - 5 = 200mm wide, 210 - 5 - 4 = 120mm tall */
    width: 100%;
    height: 100%;
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4mm;
  }
  .kicker { font-size: 12pt; font-weight: 600; }
  .name {
    font-size: 28pt;
    font-weight: 800;
    padding-bottom: 3mm;
    margin: 2mm auto 0;
    display: inline-block;
    border-bottom: 1.2pt solid #000;
    min-width: 80mm;
  }
  .body-text { font-size: 12pt; line-height: 1.7; margin-top: 2mm; }
  .body-text .hl { font-weight: 800; }
  .stats {
    display: flex;
    justify-content: center;
    gap: 12mm;
    font-size: 11pt;
    margin-top: 3mm;
  }
  .stats .lbl { font-size: 9pt; opacity: 0.75; }
  .stats .val { font-weight: 800; font-size: 12pt; }
  .poem { font-style: italic; font-size: 10.5pt; margin-top: 3mm; }
  .foot {
    display: flex;
    justify-content: space-between;
    font-size: 9pt;
    margin-top: 6mm;
    padding-top: 3mm;
    border-top: 0.5pt dashed #666;
  }
</style></head><body>
  <div class="wrap">
    <div class="kicker">تشهد إدارة فاب لاب الأحساء بأن</div>
    <div><span class="name">${name}</span></div>
    <div class="body-text">
      قد أتم بنجاح الورشة التدريبية <span class="hl">"${workshop.title}"</span>${workshop.presenter ? `<br/>التي قدمها <b>${workshop.presenter}</b>` : ''}<br/>
      ${workshop.objectives || 'واكتسب المعارف والمهارات المطلوبة'}
    </div>
    <div class="stats">
      ${workshop.totalHours ? `<div><div class="lbl">ساعة تدريبية</div><div class="val">${workshop.totalHours}</div></div>` : ''}
      ${attendedDays > 0 ? `<div><div class="lbl">يوم حضور</div><div class="val">${attendedDays}</div></div>` : ''}
      ${startDateF ? `<div><div class="lbl">تاريخ البداية</div><div class="val">${startDateF}</div></div>` : ''}
    </div>
    <div class="poem">"ومن سلك طريقاً يلتمس فيه علماً سهّل الله له به طريقاً إلى الجنة"</div>
    <div class="foot">
      <div>${certId}</div>
      <div>${new Date().toLocaleDateString('ar-SA')}</div>
    </div>
  </div>
</body></html>`;

      const { generatePdfFromHtml } = require('../utils/pdfGenerator');
      const pdfBuffer = await generatePdfFromHtml(plainHtml, { landscape: true });
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="certificate_plain_${(name || 'student').replace(/\s+/g, '_')}.pdf"`,
        'Content-Length': pdfBuffer.length
      });
      return res.end(pdfBuffer);
    }

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

// Download formal invoice PDF (Arabic)
exports.downloadInvoicePdf = async (req, res) => {
  try {
    const { id } = req.params;
    const discountInput = parseFloat(req.query.discount);
    const discount = !isNaN(discountInput) && discountInput > 0 ? discountInput : 0;
    const discountType = (req.query.discountType === 'percent') ? 'percent' : 'amount'; // amount = SAR, percent = %
    const approverRaw = (req.query.approver || '').toString().trim().slice(0, 80);
    const approver = approverRaw.replace(/[<>]/g, ''); // basic sanitization (HTML rendered later)

    const student = await WorkshopStudent.findByPk(id, {
      include: [{ model: Workshop, as: 'workshop' }]
    });
    if (!student) return res.status(404).json({ message: 'Student not found', messageAr: 'الطالب غير موجود' });

    const ws = student.workshop || {};
    const price = Number(ws.price || 0);
    const discountValue = discountType === 'percent'
      ? (price * Math.min(discount, 100) / 100)
      : Math.min(discount, price);
    const subtotal = price;
    const total = Math.max(0, price - discountValue);

    const fmt = (n) => new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    const invoiceNo = 'FAB-' + (student.studentId || '').substring(0, 8).toUpperCase() + '-' + new Date().getFullYear();
    const issueDate = new Date().toLocaleDateString('ar-SA-u-ca-gregory', { year: 'numeric', month: 'long', day: 'numeric' });
    const issueDateG = new Date().toISOString().split('T')[0];

    const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.name || '—';
    const startDateF = ws.startDate ? ws.startDate : '';
    const endDateF = ws.endDate ? ws.endDate : '';
    const dateRange = startDateF && endDateF && startDateF !== endDateF
      ? `${startDateF} → ${endDateF}` : (startDateF || '—');

    const isPaid = student.paymentStatus === 'verified';
    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>فاتورة - ${fullName}</title>
<style>
@page { size: A4; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 210mm; height: 297mm; }
body {
  font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
  background: #ffffff;
  color: #0f172a;
  padding: 8mm 10mm 8mm;
  position: relative;
  font-size: 9.5pt;
  line-height: 1.4;
  height: 297mm;
  overflow: hidden;
}
body::before {
  content: '';
  position: fixed;
  top: 50%; left: 50%;
  width: 110mm; height: 110mm;
  transform: translate(-50%, -50%) rotate(-18deg);
  background-image: url('https://fablabsahsa.com/fablab.png');
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  opacity: 0.035;
  z-index: 0;
}
.sheet { position: relative; z-index: 1; }
/* Header band */
.hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 4mm;
  border-bottom: 2.5px solid #1a56db;
  margin-bottom: 5mm;
}
.hdr .logos { display: flex; align-items: center; gap: 4mm; }
.hdr img { height: 16mm; object-fit: contain; }
.hdr .institution {
  text-align: center;
  flex: 1;
  padding: 0 4mm;
}
.hdr .institution .org {
  font-size: 9pt;
  color: #475569;
  margin-bottom: 1mm;
}
.hdr .institution .name {
  font-size: 15pt;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.01em;
}
.hdr .institution .sub {
  font-size: 8pt;
  color: #64748b;
  letter-spacing: 0.05em;
  margin-top: 0.5mm;
}

/* Title row */
.title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 5mm;
}
.title-row .invoice-title {
  font-size: 22pt;
  font-weight: 800;
  color: #1a56db;
  letter-spacing: -0.02em;
  line-height: 1;
}
.title-row .invoice-title .en {
  font-size: 8pt;
  color: #64748b;
  font-weight: 500;
  letter-spacing: 0.18em;
  display: block;
  margin-top: 1mm;
}
.title-row .invoice-meta {
  text-align: left;
  font-size: 9pt;
}
.title-row .invoice-meta .row {
  display: flex;
  justify-content: space-between;
  gap: 6mm;
  margin-bottom: 1mm;
  min-width: 70mm;
}
.title-row .invoice-meta .label { color: #64748b; font-weight: 500; }
.title-row .invoice-meta .value { color: #0f172a; font-weight: 700; }
.invoice-no-pill {
  display: inline-block;
  padding: 1mm 3mm;
  background: linear-gradient(135deg, #1a56db, #3b82f6);
  color: #fff;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 9pt;
  font-weight: 700;
  letter-spacing: 0.05em;
}

/* PAID/UNPAID stamp — positioned absolutely */
.status-stamp {
  position: absolute;
  top: 60mm;
  left: 18mm;
  width: 50mm;
  height: 25mm;
  border: 3px solid;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-weight: 800;
  font-family: 'Arial Black', sans-serif;
  letter-spacing: 0.08em;
  transform: rotate(-12deg);
  opacity: 0.85;
  z-index: 10;
  line-height: 1.1;
  font-size: 14pt;
}
.status-stamp.paid {
  border-color: #16a34a;
  color: #16a34a;
}
.status-stamp.unpaid {
  border-color: #dc2626;
  color: #dc2626;
}
.status-stamp .en {
  font-size: 8pt;
  font-weight: 600;
  display: block;
  margin-top: 1mm;
  letter-spacing: 0.18em;
}

/* Two-column info section */
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4mm;
  margin-bottom: 5mm;
}
.info-card {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 3.5mm;
  background: #f8fafc;
}
.info-card h3 {
  font-size: 10pt;
  font-weight: 700;
  color: #1a56db;
  margin-bottom: 2.5mm;
  padding-bottom: 1.5mm;
  border-bottom: 1px solid #cbd5e1;
  display: flex;
  align-items: center;
  gap: 2mm;
}
.info-card h3::before {
  content: '';
  width: 2.5mm;
  height: 2.5mm;
  background: #1a56db;
  border-radius: 50%;
}
.info-card .field {
  display: flex;
  margin-bottom: 1.2mm;
  font-size: 8.5pt;
  line-height: 1.35;
}
.info-card .field .k {
  color: #64748b;
  width: 28mm;
  flex-shrink: 0;
  font-weight: 500;
}
.info-card .field .v {
  color: #0f172a;
  font-weight: 600;
  flex: 1;
  word-break: break-word;
}

/* Items table */
.items-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 4mm;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
}
.items-table thead {
  background: linear-gradient(135deg, #1a56db, #3b82f6);
}
.items-table th {
  color: #fff;
  font-size: 9pt;
  font-weight: 700;
  padding: 2.5mm 4mm;
  text-align: right;
  letter-spacing: 0.02em;
}
.items-table th:last-child,
.items-table td:last-child { text-align: left; }
.items-table th:first-child,
.items-table td:first-child { text-align: center; width: 10mm; }
.items-table td {
  padding: 3mm 4mm;
  font-size: 9pt;
  border-bottom: 1px solid #f1f5f9;
}
.items-table tr:last-child td { border-bottom: none; }
.items-table .desc { font-weight: 600; color: #0f172a; font-size: 9pt; }
.items-table .desc-sub { color: #64748b; font-size: 7.5pt; margin-top: 0.5mm; }
.items-table .price { font-family: 'Courier New', monospace; font-weight: 700; color: #1a56db; }

/* Totals */
.totals {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 4mm;
}
.totals .box {
  width: 80mm;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
}
.totals .row {
  display: flex;
  justify-content: space-between;
  padding: 2mm 4mm;
  font-size: 9pt;
  border-bottom: 1px solid #f1f5f9;
}
.totals .row.discount { color: #15803d; }
.totals .row .label { color: #64748b; font-weight: 500; }
.totals .row .value { font-family: 'Courier New', monospace; font-weight: 700; color: #0f172a; }
.totals .row.discount .value { color: #15803d; }
.totals .row.approver-row {
  font-size: 8pt;
  padding: 0.5mm 4mm 1.5mm;
  border-top: 0;
  margin-top: -1mm;
  color: #475569;
}
.totals .row.approver-row .label { color: #94a3b8; font-weight: 500; font-size: 7.8pt; }
.totals .row.approver-row .value { color: #1e293b; font-family: inherit; font-weight: 600; font-size: 8pt; }
.totals .grand {
  background: linear-gradient(135deg, #1a56db, #3b82f6);
  color: #fff;
  padding: 3mm 4mm;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: none;
}
.totals .grand .label { font-weight: 700; font-size: 10pt; }
.totals .grand .value { font-family: 'Courier New', monospace; font-weight: 800; font-size: 12pt; }

/* Payment status row + notes side by side */
.bottom-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4mm;
  margin-bottom: 4mm;
}
.payment-status-card {
  border: 1.5px solid;
  border-radius: 6px;
  padding: 3mm 4mm;
  font-size: 8.5pt;
}
.payment-status-card.paid {
  background: #f0fdf4;
  border-color: #16a34a;
  color: #14532d;
}
.payment-status-card.unpaid {
  background: #fef2f2;
  border-color: #dc2626;
  color: #7f1d1d;
}
.payment-status-card .label {
  font-weight: 700;
  font-size: 9pt;
  margin-bottom: 1mm;
  display: flex;
  align-items: center;
  gap: 2mm;
}
.payment-status-card .label::before {
  content: '';
  width: 2.5mm;
  height: 2.5mm;
  border-radius: 50%;
  background: currentColor;
}
.notes {
  background: #fffbeb;
  border-right: 3px solid #f59e0b;
  padding: 3mm 4mm;
  border-radius: 4px;
  font-size: 8pt;
  color: #78350f;
  line-height: 1.5;
}
.notes b { color: #92400e; display: block; margin-bottom: 1mm; }

/* Signature & footer */
.sig-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 3mm;
  gap: 6mm;
}
.sig {
  flex: 1;
  text-align: center;
}
.sig .line {
  border-top: 1.5px solid #94a3b8;
  margin: 8mm 4mm 1mm;
}
.sig .label {
  font-size: 8pt;
  color: #64748b;
}
.stamp {
  width: 24mm;
  height: 24mm;
  border: 2px solid #1a56db;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 7pt;
  color: #1a56db;
  font-weight: 700;
  transform: rotate(-12deg);
  opacity: 0.6;
  line-height: 1.3;
}

.footer {
  border-top: 1px solid #e2e8f0;
  padding-top: 2.5mm;
  display: flex;
  justify-content: space-between;
  font-size: 7pt;
  color: #94a3b8;
}
.footer .center { text-align: center; flex: 1; }
.footer .ltr { direction: ltr; }
</style>
</head>
<body>
<div class="sheet">
  <!-- Header -->
  <div class="hdr">
    <div class="logos">
      <img src="https://fablabsahsa.com/fablab.png" alt="FabLab" />
    </div>
    <div class="institution">
      <div class="org">مؤسسة عبدالمنعم الراشد الإنسانية</div>
      <div class="name">فاب لاب الأحساء</div>
      <div class="sub">FABLAB AL-AHSA · DIGITAL FABRICATION LAB</div>
    </div>
    <div class="logos">
      <img src="https://fablabsahsa.com/found.png" alt="مؤسسة الراشد" />
    </div>
  </div>

  <!-- Title + Meta -->
  <div class="title-row">
    <div class="invoice-title">فــاتـــورة<span class="en">INVOICE</span></div>
    <div class="invoice-meta">
      <div class="row"><span class="label">رقم الفاتورة</span><span class="value"><span class="invoice-no-pill">${invoiceNo}</span></span></div>
      <div class="row"><span class="label">تاريخ الإصدار</span><span class="value">${issueDate}</span></div>
      <div class="row"><span class="label">التاريخ الميلادي</span><span class="value" style="direction:ltr;">${issueDateG}</span></div>
    </div>
  </div>

  <!-- Diagonal status stamp -->
  <div class="status-stamp ${isPaid ? 'paid' : 'unpaid'}">
    ${isPaid ? 'مدفوعة<span class="en">PAID</span>' : 'غير مدفوعة<span class="en">UNPAID</span>'}
  </div>

  <!-- Customer + Workshop info -->
  <div class="info-grid">
    <div class="info-card">
      <h3>بيانات العميل</h3>
      <div class="field"><span class="k">الاسم الكامل</span><span class="v">${fullName}</span></div>
      ${student.nationalId ? `<div class="field"><span class="k">رقم الهوية</span><span class="v" style="direction:ltr;text-align:right;">${student.nationalId}</span></div>` : ''}
      ${student.phone ? `<div class="field"><span class="k">الجوال</span><span class="v" style="direction:ltr;text-align:right;">${student.phone}</span></div>` : ''}
      ${student.email ? `<div class="field"><span class="k">البريد الإلكتروني</span><span class="v" style="direction:ltr;text-align:right;font-size:9pt;">${student.email}</span></div>` : ''}
      ${student.city ? `<div class="field"><span class="k">المدينة</span><span class="v">${student.city}</span></div>` : ''}
      ${student.gender ? `<div class="field"><span class="k">الجنس</span><span class="v">${student.gender === 'male' ? 'ذكر' : 'أنثى'}</span></div>` : ''}
    </div>
    <div class="info-card">
      <h3>بيانات الورشة</h3>
      <div class="field"><span class="k">عنوان الورشة</span><span class="v">${ws.title || '—'}</span></div>
      ${ws.presenter ? `<div class="field"><span class="k">المقدّم</span><span class="v">${ws.presenter}</span></div>` : ''}
      <div class="field"><span class="k">التاريخ</span><span class="v" style="direction:ltr;text-align:right;">${dateRange}</span></div>
      ${ws.totalHours ? `<div class="field"><span class="k">الساعات</span><span class="v">${ws.totalHours} ساعة تدريبية</span></div>` : ''}
      ${ws.location ? `<div class="field"><span class="k">المكان</span><span class="v">${ws.location}</span></div>` : ''}
      ${student.invoiceNumber ? `<div class="field"><span class="k">مرجع التسجيل</span><span class="v" style="direction:ltr;text-align:right;font-family:'Courier New',monospace;font-size:9pt;">${student.invoiceNumber}</span></div>` : ''}
    </div>
  </div>

  <!-- Items table -->
  <table class="items-table">
    <thead>
      <tr>
        <th>#</th>
        <th>الوصف</th>
        <th>الكمية</th>
        <th>السعر (ر.س)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>
          <div class="desc">رسوم التسجيل في ورشة "${ws.title || ''}"</div>
          <div class="desc-sub">${ws.totalHours ? `${ws.totalHours} ساعة تدريبية · ` : ''}${dateRange}</div>
        </td>
        <td style="text-align:center;">1</td>
        <td><span class="price">${fmt(price)}</span></td>
      </tr>
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals">
    <div class="box">
      <div class="row">
        <span class="label">المجموع الفرعي</span>
        <span class="value">${fmt(subtotal)} ر.س</span>
      </div>
      ${discountValue > 0 ? `
        <div class="row discount">
          <span class="label">الخصم${discountType === 'percent' ? ` (${discount}%)` : ''}</span>
          <span class="value">- ${fmt(discountValue)} ر.س</span>
        </div>
        ${approver ? `
        <div class="row approver-row">
          <span class="label">اعتمد الخصم</span>
          <span class="value approver-name">${approver}</span>
        </div>
        ` : ''}
      ` : ''}
      <div class="grand">
        <span class="label">الإجمالي المستحق</span>
        <span class="value">${fmt(total)} ر.س</span>
      </div>
    </div>
  </div>

  <!-- Status + Notes side by side -->
  <div class="bottom-row">
    <div class="payment-status-card ${isPaid ? 'paid' : 'unpaid'}">
      <div class="label">حالة الدفع · Payment Status</div>
      <div>${isPaid
        ? 'تم استلام كامل المبلغ المستحق. الفاتورة مدفوعة.'
        : 'لم يتم استلام المبلغ بعد. الفاتورة غير مدفوعة.'}</div>
      <div style="margin-top:1mm;font-size:8pt;opacity:0.85;">
        ${isPaid ? 'Amount received in full.' : 'Payment is still pending.'}
      </div>
    </div>
    <div class="notes">
      <b>ملاحظات</b>
      وثيقة رسمية من فاب لاب الأحساء. الرسوم غير مستردة بعد بدء الورشة.
      يرجى الاحتفاظ بنسخة للمراجعة.
    </div>
  </div>

  <!-- Signatures + stamp -->
  <div class="sig-row">
    <div class="sig">
      <div class="line"></div>
      <div class="label">توقيع المتدرب</div>
    </div>
    <div class="stamp">ختم<br>فاب لاب الأحساء<br>FABLAB AHSA</div>
    <div class="sig">
      <div class="line"></div>
      <div class="label">توقيع المسؤول</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div>fablabsahsa.com</div>
    <div class="center">شكراً لاختياركم فاب لاب الأحساء</div>
    <div class="ltr">FABLAB Al-Ahsa · ${new Date().getFullYear()}</div>
  </div>
</div>
</body>
</html>`;

    const { generatePdfFromHtml } = require('../utils/pdfGenerator');
    const pdfBuffer = await generatePdfFromHtml(html, { landscape: false, format: 'A4' });

    const safeName = fullName.replace(/[^؀-ۿa-zA-Z0-9]+/g, '_').substring(0, 40) || 'student';
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename*=UTF-8''invoice_${invoiceNo}_${encodeURIComponent(safeName)}.pdf`,
      'Content-Length': pdfBuffer.length
    });
    res.end(pdfBuffer);
  } catch (error) {
    console.error('Download invoice PDF error:', error);
    res.status(500).json({ message: 'Error generating invoice', messageAr: 'خطأ في إنشاء الفاتورة' });
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
