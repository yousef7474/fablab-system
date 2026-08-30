const { Volunteer, VolunteerOpportunity, VolunteerRating, VolunteerReceipt, VolunteerAttendance, SummerProgram, Admin, Settings } = require('../models');
const { Op } = require('sequelize');
const crypto = require('crypto');
const QRCode = require('qrcode');
const sgMail = require('@sendgrid/mail');
const { buildQrPayload, requireRole } = require('../utils/qrPayload');

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Fire-and-forget reminder to a volunteer to upload the day's photos
// into their Google Drive folder for the given chance. Called from the
// QR check-in handler. Does not throw — attendance must still succeed
// even if SendGrid, DNS, or the volunteer's mailbox misbehaves.
const _sendPhotoUploadReminder = async ({ volunteer, opportunity }) => {
  try {
    if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) return;
    if (!volunteer?.email) return;

    const safe = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const chanceName = opportunity?.title || 'الفرصة التطوعية';
    const driveUrl = volunteer.driveUrl || '';
    const folderNote = driveUrl
      ? `<p style="margin: 10px 0 0; font-size: 14px;">🔗 <strong>مجلد Google Drive الخاص بك:</strong><br>
           <a href="${safe(driveUrl)}" style="color:#dc2626; word-break:break-all;">${safe(driveUrl)}</a>
         </p>`
      : `<p style="margin: 10px 0 0; font-size: 14px; color:#7f1d1d; background:#fef2f2; padding:10px; border-radius:8px;">
           ⚠️ لم يتم ربط مجلد Google Drive بحسابك بعد — يرجى مراجعة إدارة فاب لاب لتزويدك برابط المجلد.
         </p>`;

    const html = `
      <div style="font-family:'Tajawal','Segoe UI',Tahoma,sans-serif; background:#f8fafc; padding:24px 0;" dir="rtl">
        <div style="max-width:640px; margin:0 auto; background:#fff; border-radius:14px; overflow:hidden; box-shadow:0 6px 24px rgba(220,38,38,0.10);">
          <div style="background:linear-gradient(135deg, #ee2329, #dc2626); color:#fff; padding:22px 28px;">
            <h2 style="margin:0; font-size:20px;">تذكير — رفع صور فرصتك التطوعية</h2>
            <p style="margin:4px 0 0; font-size:13px; opacity:.92;">FABLAB Al-Ahsa — Volunteer Reminder</p>
          </div>
          <div style="padding:24px 28px; color:#0f172a;">
            <p style="margin:0 0 12px; font-size:15px;">مرحباً <strong>${safe(volunteer.name || '')}</strong>،</p>
            <p style="margin:0 0 12px; font-size:14px; line-height:1.85;">
              تم تسجيل حضورك اليوم لفرصة <strong>"${safe(chanceName)}"</strong>. نرجو منك عدم نسيان توثيق أعمالك ورفع الصور إلى مجلد Google Drive الخاص بفرصتك التطوعية.
            </p>

            <div style="background:#fff7ed; border-inline-start:4px solid #ea580c; padding:14px 18px; border-radius:8px; margin:16px 0;">
              <div style="font-weight:800; color:#9a3412; margin-bottom:6px;">📸 التعليمات:</div>
              <ul style="margin:0; padding-inline-start:20px; font-size:13.5px; line-height:1.9; color:#7c2d12;">
                <li>ارفع <strong>5 صور على الأقل</strong> لأعمالك اليومية.</li>
                <li>أنشئ مجلداً داخل Drive باسم فرصتك التطوعية: <strong>"${safe(chanceName)}"</strong>.</li>
                <li>حاول أن تكون الصور واضحة وتُظهر تفاصيل ما أنجزته اليوم.</li>
              </ul>
              ${folderNote}
            </div>

            <div style="background:#fef2f2; border:2px double #b91c1c; padding:14px 18px; border-radius:8px; margin:16px 0;">
              <div style="font-weight:900; color:#b91c1c; margin-bottom:6px;">⚠️ تنبيه هام:</div>
              <p style="margin:0; font-size:13.5px; line-height:1.75; color:#7f1d1d;">
                في حال عدم الالتزام بالأنظمة والتعليمات، وعدم رفع الصور والوثائق المطلوبة إلى مجلد Google Drive المخصص لفرصتك التطوعية،
                <strong>لن تستحق أياً من حقوقك</strong> — سواء الشهادة أو المكافأة المالية أو أي دعم آخر من فاب لاب الأحساء.
              </p>
            </div>

            <p style="margin:20px 0 0; color:#64748b; font-size:12.5px;">شكراً لعطائك — إدارة فاب لاب الأحساء</p>
          </div>
        </div>
      </div>
    `;

    await sgMail.send({
      to: volunteer.email,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL,
        name: process.env.SENDGRID_FROM_NAME || 'FABLAB Al-Ahsa'
      },
      subject: `📸 تذكير: رفع صور فرصتك "${chanceName}" — FABLAB`,
      html
    });
  } catch (err) {
    console.error('photo-upload reminder email failed:', err?.response?.body || err.message);
  }
};

// ============== VOLUNTEER PROFILE MANAGEMENT ==============

/**
 * Get all volunteers
 */
exports.getAllVolunteers = async (req, res) => {
  try {
    const { search, isActive } = req.query;
    const whereClause = {};

    if (isActive !== undefined) {
      whereClause.isActive = isActive === 'true';
    }

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { nationalId: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    const volunteers = await Volunteer.findAll({
      where: whereClause,
      include: [
        {
          model: VolunteerOpportunity,
          as: 'opportunities',
          attributes: ['opportunityId', 'title', 'description', 'startDate', 'endDate', 'totalHours', 'hoursAdjustment', 'attendanceDays', 'dailyStartTime', 'dailyEndTime', 'rating', 'status']
        },
        {
          model: VolunteerRating,
          as: 'ratings',
          attributes: ['ratingId', 'type', 'points', 'criteria', 'notes', 'ratingDate', 'opportunityId']
        },
        {
          model: SummerProgram,
          as: 'summerProgram',
          required: false,
          // `color` + `fablabSection` are needed by the client to derive
          // each volunteer card's theme color. Without them, the card
          // falls back to hash-color and looks unrelated to the program.
          attributes: ['programId', 'name', 'startDate', 'endDate', 'color', 'fablabSection']
        }
      ],
      order: [['name', 'ASC']]
    });

    // Calculate total stats for each volunteer
    const volunteersWithStats = volunteers.map(v => {
      const volunteer = v.toJSON();
      const completedOpps = volunteer.opportunities.filter(o => o.status === 'completed');
      volunteer.totalOpportunities = volunteer.opportunities.length;
      volunteer.completedOpportunities = completedOpps.length;
      // Count hours from ALL opportunities (active and completed), including adjustments
      volunteer.totalHours = volunteer.opportunities.reduce((sum, o) => {
        const baseHours = o.totalHours || 0;
        const adjustment = o.hoursAdjustment || 0;
        return sum + baseHours + adjustment;
      }, 0);

      // Calculate points from new ratings system (awards - deductions)
      const awards = (volunteer.ratings || [])
        .filter(r => r.type === 'award')
        .reduce((sum, r) => sum + (r.points || 0), 0);
      const deductions = (volunteer.ratings || [])
        .filter(r => r.type === 'deduction')
        .reduce((sum, r) => sum + (r.points || 0), 0);

      volunteer.totalAwards = awards;
      volunteer.totalDeductions = deductions;
      volunteer.totalPoints = awards - deductions;

      return volunteer;
    });

    res.json(volunteersWithStats);
  } catch (error) {
    console.error('Error fetching volunteers:', error);
    res.status(500).json({ message: 'Error fetching volunteers', error: error.message });
  }
};

/**
 * Get single volunteer by ID
 */
exports.getVolunteerById = async (req, res) => {
  try {
    const { id } = req.params;

    const volunteer = await Volunteer.findByPk(id, {
      include: [
        {
          model: VolunteerOpportunity,
          as: 'opportunities',
          include: [
            { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
          ],
          order: [['startDate', 'DESC']]
        }
      ]
    });

    if (!volunteer) {
      return res.status(404).json({ message: 'Volunteer not found' });
    }

    res.json(volunteer);
  } catch (error) {
    console.error('Error fetching volunteer:', error);
    res.status(500).json({ message: 'Error fetching volunteer', error: error.message });
  }
};

/**
 * Create new volunteer profile
 */
exports.createVolunteer = async (req, res) => {
  try {
    const { name, nationalId, phone, email, nationalIdPhoto, profilePhoto, summerProgramId } = req.body;

    if (!name || !nationalId || !phone) {
      return res.status(400).json({
        message: 'Name, national ID, and phone are required',
        messageAr: 'الاسم ورقم الهوية ورقم الجوال مطلوبة'
      });
    }

    // Check if volunteer with same national ID exists
    const existing = await Volunteer.findOne({ where: { nationalId } });
    if (existing) {
      return res.status(409).json({
        message: 'Volunteer with this national ID already exists',
        messageAr: 'يوجد متطوع بنفس رقم الهوية',
        existingVolunteer: existing
      });
    }

    const volunteer = await Volunteer.create({
      name,
      nationalId,
      phone,
      email: email || null,
      nationalIdPhoto: nationalIdPhoto || null,
      profilePhoto: profilePhoto || null,
      summerProgramId: summerProgramId || null
    });

    res.status(201).json(volunteer);
  } catch (error) {
    console.error('Error creating volunteer:', error);
    res.status(500).json({ message: 'Error creating volunteer', error: error.message });
  }
};

/**
 * Update volunteer profile
 */
exports.updateVolunteer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, nationalId, phone, email, nationalIdPhoto, profilePhoto, isActive, summerProgramId } = req.body;

    const volunteer = await Volunteer.findByPk(id);
    if (!volunteer) {
      return res.status(404).json({ message: 'Volunteer not found' });
    }

    // Check if national ID is being changed and if new one already exists
    if (nationalId && nationalId !== volunteer.nationalId) {
      const existing = await Volunteer.findOne({ where: { nationalId } });
      if (existing) {
        return res.status(409).json({
          message: 'Another volunteer with this national ID already exists',
          messageAr: 'يوجد متطوع آخر بنفس رقم الهوية'
        });
      }
    }

    await volunteer.update({
      name: name !== undefined ? name : volunteer.name,
      nationalId: nationalId !== undefined ? nationalId : volunteer.nationalId,
      phone: phone !== undefined ? phone : volunteer.phone,
      email: email !== undefined ? email : volunteer.email,
      nationalIdPhoto: nationalIdPhoto !== undefined ? nationalIdPhoto : volunteer.nationalIdPhoto,
      profilePhoto: profilePhoto !== undefined ? profilePhoto : volunteer.profilePhoto,
      isActive: isActive !== undefined ? isActive : volunteer.isActive,
      summerProgramId: summerProgramId !== undefined ? (summerProgramId || null) : volunteer.summerProgramId
    });

    res.json(volunteer);
  } catch (error) {
    console.error('Error updating volunteer:', error);
    res.status(500).json({ message: 'Error updating volunteer', error: error.message });
  }
};

/**
 * Delete volunteer
 */
exports.deleteVolunteer = async (req, res) => {
  try {
    const { id } = req.params;
    const { force } = req.query;

    const volunteer = await Volunteer.findByPk(id);
    if (!volunteer) {
      return res.status(404).json({ message: 'Volunteer not found' });
    }

    // Any child record that has a FK back to Volunteer must be counted
    // here — otherwise the destroy() at the end throws a FK violation
    // and the user sees a bare 500.
    const [opportunityCount, receiptCount, ratingCount, attendanceCount] = await Promise.all([
      VolunteerOpportunity.count({ where: { volunteerId: id } }),
      VolunteerReceipt.count({ where: { volunteerId: id } }),
      VolunteerRating.count({ where: { volunteerId: id } }),
      VolunteerAttendance.count({ where: { volunteerId: id } })
    ]);
    const childCount = opportunityCount + receiptCount + ratingCount + attendanceCount;

    if (childCount > 0 && force !== 'true') {
      return res.status(400).json({
        message: 'Cannot delete volunteer with existing records. Use force=true to delete all records.',
        messageAr: 'لا يمكن حذف متطوع لديه سجلات. استخدم الحذف القسري لحذف جميع السجلات.',
        opportunityCount,
        receiptCount,
        ratingCount,
        attendanceCount,
        requiresForce: true
      });
    }

    if (childCount > 0 && force === 'true') {
      await VolunteerRating.destroy({ where: { volunteerId: id } });
      await VolunteerReceipt.destroy({ where: { volunteerId: id } });
      await VolunteerAttendance.destroy({ where: { volunteerId: id } });
      await VolunteerOpportunity.destroy({ where: { volunteerId: id } });
    }

    await volunteer.destroy();
    res.json({ message: 'Volunteer deleted successfully' });
  } catch (error) {
    console.error('Error deleting volunteer:', error);
    res.status(500).json({ message: 'Error deleting volunteer', error: error.message });
  }
};

// ============== VOLUNTEER OPPORTUNITY MANAGEMENT ==============

/**
 * Get all opportunities (with optional filters)
 */
exports.getAllOpportunities = async (req, res) => {
  try {
    const { volunteerId, status, startDate, endDate } = req.query;
    const whereClause = {};

    if (volunteerId) whereClause.volunteerId = volunteerId;
    if (status) whereClause.status = status;

    if (startDate && endDate) {
      whereClause.startDate = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      whereClause.startDate = { [Op.gte]: startDate };
    } else if (endDate) {
      whereClause.startDate = { [Op.lte]: endDate };
    }

    const opportunities = await VolunteerOpportunity.findAll({
      where: whereClause,
      include: [
        { model: Volunteer, as: 'volunteer', attributes: ['volunteerId', 'name', 'nationalId', 'phone', 'email'] },
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
      ],
      order: [['startDate', 'DESC']]
    });

    res.json(opportunities);
  } catch (error) {
    console.error('Error fetching opportunities:', error);
    res.status(500).json({ message: 'Error fetching opportunities', error: error.message });
  }
};

/**
 * Create new opportunity for a volunteer
 */
exports.createOpportunity = async (req, res) => {
  try {
    const {
      volunteerId,
      title,
      description,
      startDate,
      endDate,
      dailyHours,
      dailyStartTime,
      dailyEndTime,
      rating,
      ratingCriteria,
      ratingNotes
    } = req.body;

    if (!volunteerId || !title || !startDate || !endDate) {
      return res.status(400).json({
        message: 'Volunteer, title, start date, and end date are required',
        messageAr: 'المتطوع والعنوان وتاريخ البدء والانتهاء مطلوبة'
      });
    }

    // Verify volunteer exists
    const volunteer = await Volunteer.findByPk(volunteerId);
    if (!volunteer) {
      return res.status(404).json({ message: 'Volunteer not found' });
    }

    // Calculate total hours
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    // Hours come from per-day attendance entered later in the volunteer
    // profile. Default to 0 so the legacy hours×days field stays
    // computable but unused as the source of truth.
    const hours = dailyHours || 0;
    const totalHours = days * hours;

    const opportunity = await VolunteerOpportunity.create({
      volunteerId,
      title,
      description: description || null,
      startDate,
      endDate,
      dailyHours: hours,
      dailyStartTime: dailyStartTime || null,
      dailyEndTime: dailyEndTime || null,
      totalHours,
      rating: rating || 0,
      ratingCriteria: ratingCriteria || null,
      ratingNotes: ratingNotes || null,
      createdById: req.admin.adminId
    });

    // Fetch with associations
    const createdOpportunity = await VolunteerOpportunity.findByPk(opportunity.opportunityId, {
      include: [
        { model: Volunteer, as: 'volunteer', attributes: ['volunteerId', 'name', 'nationalId', 'phone', 'email'] },
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
      ]
    });

    res.status(201).json(createdOpportunity);
  } catch (error) {
    console.error('Error creating opportunity:', error);
    res.status(500).json({ message: 'Error creating opportunity', error: error.message });
  }
};

/**
 * Update opportunity
 */
exports.updateOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      startDate,
      endDate,
      dailyHours,
      dailyStartTime,
      dailyEndTime,
      attendanceDays,
      rating,
      ratingCriteria,
      ratingNotes,
      status
    } = req.body;

    const opportunity = await VolunteerOpportunity.findByPk(id);
    if (!opportunity) {
      return res.status(404).json({ message: 'Opportunity not found' });
    }

    // Recalculate hours if dates or daily hours changed
    let totalHours = opportunity.totalHours;
    const newStartDate = startDate || opportunity.startDate;
    const newEndDate = endDate || opportunity.endDate;
    const newDailyHours = dailyHours !== undefined ? dailyHours : opportunity.dailyHours;

    if (startDate || endDate || dailyHours !== undefined) {
      const start = new Date(newStartDate);
      const end = new Date(newEndDate);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      totalHours = days * newDailyHours;
    }

    await opportunity.update({
      title: title !== undefined ? title : opportunity.title,
      description: description !== undefined ? description : opportunity.description,
      startDate: newStartDate,
      endDate: newEndDate,
      dailyHours: newDailyHours,
      dailyStartTime: dailyStartTime !== undefined ? (dailyStartTime || null) : opportunity.dailyStartTime,
      dailyEndTime: dailyEndTime !== undefined ? (dailyEndTime || null) : opportunity.dailyEndTime,
      totalHours,
      attendanceDays: attendanceDays !== undefined ? attendanceDays : opportunity.attendanceDays,
      rating: rating !== undefined ? rating : opportunity.rating,
      ratingCriteria: ratingCriteria !== undefined ? ratingCriteria : opportunity.ratingCriteria,
      ratingNotes: ratingNotes !== undefined ? ratingNotes : opportunity.ratingNotes,
      status: status !== undefined ? status : opportunity.status
    });

    // Fetch with associations
    const updatedOpportunity = await VolunteerOpportunity.findByPk(id, {
      include: [
        { model: Volunteer, as: 'volunteer', attributes: ['volunteerId', 'name', 'nationalId', 'phone', 'email'] },
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
      ]
    });

    res.json(updatedOpportunity);
  } catch (error) {
    console.error('Error updating opportunity:', error);
    res.status(500).json({ message: 'Error updating opportunity', error: error.message });
  }
};

/**
 * Adjust hours for an opportunity (increase/decrease)
 */
exports.adjustOpportunityHours = async (req, res) => {
  try {
    const { id } = req.params;
    const { adjustment, reason } = req.body;

    if (adjustment === undefined || adjustment === null) {
      return res.status(400).json({
        message: 'Adjustment value is required',
        messageAr: 'قيمة التعديل مطلوبة'
      });
    }

    const opportunity = await VolunteerOpportunity.findByPk(id);
    if (!opportunity) {
      return res.status(404).json({ message: 'Opportunity not found' });
    }

    // Update the adjustment
    const currentAdjustment = opportunity.hoursAdjustment || 0;
    const newAdjustment = currentAdjustment + parseFloat(adjustment);

    await opportunity.update({
      hoursAdjustment: newAdjustment,
      adjustmentReason: reason || opportunity.adjustmentReason
    });

    // Fetch with associations
    const updatedOpportunity = await VolunteerOpportunity.findByPk(id, {
      include: [
        { model: Volunteer, as: 'volunteer', attributes: ['volunteerId', 'name', 'nationalId', 'phone', 'email'] },
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
      ]
    });

    res.json({
      message: 'Hours adjusted successfully',
      messageAr: 'تم تعديل الساعات بنجاح',
      opportunity: updatedOpportunity,
      effectiveHours: (updatedOpportunity.totalHours || 0) + (updatedOpportunity.hoursAdjustment || 0)
    });
  } catch (error) {
    console.error('Error adjusting opportunity hours:', error);
    res.status(500).json({ message: 'Error adjusting hours', error: error.message });
  }
};

/**
 * Delete opportunity
 */
exports.deleteOpportunity = async (req, res) => {
  try {
    const { id } = req.params;

    const opportunity = await VolunteerOpportunity.findByPk(id);
    if (!opportunity) {
      return res.status(404).json({ message: 'Opportunity not found' });
    }

    await opportunity.destroy();
    res.json({ message: 'Opportunity deleted successfully' });
  } catch (error) {
    console.error('Error deleting opportunity:', error);
    res.status(500).json({ message: 'Error deleting opportunity', error: error.message });
  }
};

/**
 * Export opportunities as CSV
 */
exports.exportOpportunities = async (req, res) => {
  try {
    const { volunteerId, startDate, endDate, status } = req.query;
    const whereClause = {};

    if (volunteerId && volunteerId !== 'all') whereClause.volunteerId = volunteerId;
    if (status && status !== 'all') whereClause.status = status;

    if (startDate && endDate) {
      whereClause.startDate = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      whereClause.startDate = { [Op.gte]: startDate };
    } else if (endDate) {
      whereClause.startDate = { [Op.lte]: endDate };
    }

    const opportunities = await VolunteerOpportunity.findAll({
      where: whereClause,
      include: [
        { model: Volunteer, as: 'volunteer', attributes: ['name', 'nationalId', 'phone', 'email'] }
      ],
      order: [['startDate', 'DESC']]
    });

    // Create CSV content
    const headers = [
      'Volunteer Name', 'National ID', 'Phone', 'Email',
      'Opportunity Title', 'Start Date', 'End Date', 'Daily Hours', 'Total Hours',
      'Rating', 'Rating Criteria', 'Status'
    ];

    const rows = opportunities.map(o => [
      o.volunteer?.name || 'N/A',
      o.volunteer?.nationalId || 'N/A',
      o.volunteer?.phone || 'N/A',
      o.volunteer?.email || 'N/A',
      o.title,
      o.startDate,
      o.endDate,
      o.dailyHours,
      o.totalHours,
      o.rating,
      o.ratingCriteria || '',
      o.status
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Add BOM for Excel UTF-8 compatibility
    const bom = '\uFEFF';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="volunteer_opportunities_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(bom + csvContent);
  } catch (error) {
    console.error('Error exporting opportunities:', error);
    res.status(500).json({ message: 'Error exporting opportunities', error: error.message });
  }
};

// ============== VOLUNTEER RATINGS ==============

/**
 * Get all ratings for a volunteer
 */
exports.getVolunteerRatings = async (req, res) => {
  try {
    const { volunteerId } = req.params;
    const { startDate, endDate } = req.query;

    const where = { volunteerId };

    if (startDate && endDate) {
      where.ratingDate = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      where.ratingDate = { [Op.gte]: startDate };
    } else if (endDate) {
      where.ratingDate = { [Op.lte]: endDate };
    }

    const ratings = await VolunteerRating.findAll({
      where,
      include: [
        { model: VolunteerOpportunity, as: 'opportunity', attributes: ['opportunityId', 'title'] },
        { model: Admin, as: 'ratedBy', attributes: ['adminId', 'fullName', 'email'] }
      ],
      order: [['ratingDate', 'DESC'], ['createdAt', 'DESC']]
    });

    // Calculate summary
    const awards = ratings.filter(r => r.type === 'award').reduce((sum, r) => sum + r.points, 0);
    const deductions = ratings.filter(r => r.type === 'deduction').reduce((sum, r) => sum + r.points, 0);

    res.json({
      ratings,
      summary: {
        totalRatings: ratings.length,
        awards,
        deductions,
        netPoints: awards - deductions
      }
    });
  } catch (error) {
    console.error('Error fetching volunteer ratings:', error);
    res.status(500).json({ message: 'Error fetching ratings', error: error.message });
  }
};

/**
 * Create a volunteer rating
 */
exports.createVolunteerRating = async (req, res) => {
  try {
    const { volunteerId, opportunityId, type, points, criteria, notes, ratingDate } = req.body;

    if (!req.admin || !req.admin.adminId) {
      return res.status(401).json({ message: 'Admin authentication required' });
    }

    if (!volunteerId || !type || points === undefined) {
      return res.status(400).json({ message: 'Volunteer ID, type, and points are required' });
    }

    // Verify volunteer exists
    const volunteer = await Volunteer.findByPk(volunteerId);
    if (!volunteer) {
      return res.status(404).json({ message: 'Volunteer not found' });
    }

    const rating = await VolunteerRating.create({
      volunteerId,
      opportunityId: opportunityId || null,
      createdById: req.admin.adminId,
      type,
      points: parseInt(points, 10),
      criteria: criteria || null,
      notes: notes || null,
      ratingDate: ratingDate || new Date().toISOString().split('T')[0]
    });

    // Fetch with associations
    const createdRating = await VolunteerRating.findByPk(rating.ratingId, {
      include: [
        { model: Volunteer, as: 'volunteer', attributes: ['volunteerId', 'name'] },
        { model: VolunteerOpportunity, as: 'opportunity', attributes: ['opportunityId', 'title'] },
        { model: Admin, as: 'ratedBy', attributes: ['adminId', 'fullName', 'email'] }
      ]
    });

    res.status(201).json(createdRating);
  } catch (error) {
    console.error('Error creating volunteer rating:', error);
    res.status(500).json({ message: 'Error creating rating', error: error.message });
  }
};

/**
 * Delete a volunteer rating
 */
exports.deleteVolunteerRating = async (req, res) => {
  try {
    const { id } = req.params;

    const rating = await VolunteerRating.findByPk(id);
    if (!rating) {
      return res.status(404).json({ message: 'Rating not found' });
    }

    await rating.destroy();
    res.json({ message: 'Rating deleted successfully' });
  } catch (error) {
    console.error('Error deleting volunteer rating:', error);
    res.status(500).json({ message: 'Error deleting rating', error: error.message });
  }
};

// ============== VOLUNTEER RECEIPTS (سند استلام) ==============

exports.listVolunteerReceipts = async (req, res) => {
  try {
    const receipts = await VolunteerReceipt.findAll({
      where: { volunteerId: req.params.id },
      include: [{ model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }],
      order: [['receiptDate', 'DESC'], ['createdAt', 'DESC']]
    });
    res.json(receipts);
  } catch (err) {
    console.error('Error listing volunteer receipts:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createVolunteerReceipt = async (req, res) => {
  try {
    const { recipientName, nationalId, amount, purpose, note, receiptDate, recipientPhone } = req.body || {};
    if (!recipientName || !amount || !receiptDate) {
      return res.status(400).json({ message: 'recipientName, amount and receiptDate are required' });
    }
    const volunteer = await Volunteer.findByPk(req.params.id);
    if (!volunteer) return res.status(404).json({ message: 'Volunteer not found' });

    const receipt = await VolunteerReceipt.create({
      volunteerId: volunteer.volunteerId,
      recipientName,
      nationalId: nationalId || null,
      amount,
      purpose: purpose || null,
      note: note || null,
      receiptDate,
      recipientPhone: recipientPhone || null,
      createdById: req.admin?.adminId || null
    });
    res.status(201).json(receipt);
  } catch (err) {
    console.error('Error creating volunteer receipt:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.deleteVolunteerReceipt = async (req, res) => {
  try {
    const receipt = await VolunteerReceipt.findByPk(req.params.id);
    if (!receipt) return res.status(404).json({ message: 'Receipt not found' });
    await receipt.destroy();
    res.json({ message: 'Receipt deleted' });
  } catch (err) {
    console.error('Error deleting volunteer receipt:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== VOLUNTEER ID CARD (QR) ==============

// "Today" is computed in Riyadh time (UTC+3) so the attendance day
// rolls over at Riyadh midnight regardless of the server's local
// timezone (production containers usually run in UTC).
const todayStr = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const d = parts.find(p => p.type === 'day').value;
  return `${y}-${m}-${d}`;
};

const makeQrDataUrl = async (payload) => {
  return QRCode.toDataURL(String(payload), {
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 8,
    color: { dark: '#000000', light: '#FFFFFF' }
  });
};

// GET /volunteers/:id/card — returns { volunteer, qrDataUrl }
exports.getVolunteerCard = async (req, res) => {
  try {
    const volunteer = await Volunteer.findByPk(req.params.id);
    if (!volunteer) return res.status(404).json({ message: 'Volunteer not found' });
    const qrDataUrl = await makeQrDataUrl(buildQrPayload('VOL', volunteer.nationalId));
    res.json({ volunteer, qrDataUrl });
  } catch (err) {
    console.error('Error getting volunteer card:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

// POST /volunteers/cards — body { volunteerIds: [...] } → array of {volunteer, qrDataUrl}
exports.getVolunteerCardsBulk = async (req, res) => {
  try {
    const { volunteerIds } = req.body || {};
    if (!Array.isArray(volunteerIds) || volunteerIds.length === 0) {
      return res.status(400).json({ message: 'volunteerIds array required' });
    }
    const volunteers = await Volunteer.findAll({ where: { volunteerId: volunteerIds } });
    const cards = await Promise.all(volunteers.map(async (v) => ({
      volunteer: v,
      qrDataUrl: await makeQrDataUrl(buildQrPayload('VOL', v.nationalId))
    })));
    res.json({ cards });
  } catch (err) {
    console.error('Error getting volunteer cards bulk:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

// ============== ATTENDANCE AUTO-MARK HELPERS ==============

// Parse 'HH:MM' → minutes-from-midnight (integer). Null if malformed.
const _hhmmToMin = (str) => {
  if (!str || typeof str !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(str.trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
};

// Given a stored timestamp and the record's date (YYYY-MM-DD), return
// the Riyadh-local minute-of-day. This lets us compare against a chance
// window that's expressed in the same local terms without pulling in a
// date library.
const _tsToRiyadhMinOfDay = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh', hour12: false,
    hour: '2-digit', minute: '2-digit'
  }).formatToParts(d);
  const h = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const m = parseInt(parts.find(p => p.type === 'minute').value, 10);
  return h * 60 + m;
};

// For a volunteer's freshly-completed check-in/check-out on `date`,
// find every active opportunity whose date-range covers today AND has
// both dailyStartTime/dailyEndTime set. If the visit window overlaps
// the chance window, upsert an attendanceDays entry with the actual
// overlap hours. Manual entries (existing `attended: true` for today)
// are never overwritten.
//
// Returns: [{ opportunityId, title, hours }, ...] describing what was
// auto-marked, so the client can show a toast.
const _autoMarkOpportunitiesForCheckout = async (volunteerId, date, checkInAt, checkOutAt) => {
  const visitFrom = _tsToRiyadhMinOfDay(checkInAt);
  const visitTo = _tsToRiyadhMinOfDay(checkOutAt);
  if (visitFrom == null || visitTo == null || visitTo <= visitFrom) return [];

  // Fetch candidate opportunities in a single query.
  const opps = await VolunteerOpportunity.findAll({
    where: {
      volunteerId,
      status: 'active',
      startDate: { [Op.lte]: date },
      endDate: { [Op.gte]: date },
      dailyStartTime: { [Op.ne]: null },
      dailyEndTime: { [Op.ne]: null }
    }
  });

  const marked = [];
  for (const opp of opps) {
    const chanceFrom = _hhmmToMin(opp.dailyStartTime);
    const chanceTo = _hhmmToMin(opp.dailyEndTime);
    if (chanceFrom == null || chanceTo == null || chanceTo <= chanceFrom) continue;

    const overlapStart = Math.max(visitFrom, chanceFrom);
    const overlapEnd = Math.min(visitTo, chanceTo);
    const overlapMin = overlapEnd - overlapStart;
    if (overlapMin <= 0) continue;

    // Read existing attendanceDays and check for a same-day entry.
    const existing = Array.isArray(opp.attendanceDays) ? [...opp.attendanceDays] : [];
    const sameDayIdx = existing.findIndex(d => _isoDate(d?.date) === date);
    if (sameDayIdx !== -1 && existing[sameDayIdx].attended) {
      // Never overwrite a manual "attended" mark.
      continue;
    }

    const overlapHours = Math.round((overlapMin / 60) * 100) / 100; // 2-decimal
    const entry = {
      date,
      attended: true,
      hours: overlapHours,
      task: 'حضور تلقائي بالمسح'
    };
    if (sameDayIdx === -1) {
      existing.push(entry);
    } else {
      existing[sameDayIdx] = { ...existing[sameDayIdx], ...entry };
    }

    // Sequelize JSON dirty-tracking workaround.
    opp.setDataValue('attendanceDays', existing);
    opp.changed('attendanceDays', true);
    await opp.save({ fields: ['attendanceDays'] });

    marked.push({
      opportunityId: opp.opportunityId,
      title: opp.title,
      hours: overlapHours
    });
  }

  return marked;
};

// ============== VOLUNTEER ATTENDANCE ==============

// POST /volunteers/attendance/scan — body { code } — accepts nationalId scan
exports.scanAttendance = async (req, res) => {
  try {
    const raw = String(req.body?.code || '').trim();
    if (!raw) return res.status(400).json({ message: 'No code provided' });

    const check = requireRole(raw, 'VOL');
    if (!check.ok) return res.status(check.status).json(check.response);
    const nid = check.id;

    const volunteer = await Volunteer.findOne({ where: { nationalId: nid } });
    if (!volunteer) {
      return res.status(404).json({ message: 'No volunteer matches this code', code: nid });
    }

    const date = todayStr();
    const now = new Date();
    let record = await VolunteerAttendance.findOne({
      where: { volunteerId: volunteer.volunteerId, date }
    });

    let action = null;
    if (!record) {
      record = await VolunteerAttendance.create({
        volunteerId: volunteer.volunteerId,
        date,
        checkInAt: now
      });
      action = 'checkin';

      // Send the photo-upload reminder on check-in only (not on
      // check-out) so each attended day generates exactly one email.
      // Look up the volunteer's active opportunity whose date range
      // covers today — that's the "chance" mentioned in the message.
      try {
        const todayOpp = await VolunteerOpportunity.findOne({
          where: {
            volunteerId: volunteer.volunteerId,
            status: 'active',
            startDate: { [Op.lte]: date },
            endDate:   { [Op.gte]: date }
          },
          order: [['startDate', 'DESC']]
        });
        // Fire-and-forget: don't await, don't block the response.
        _sendPhotoUploadReminder({ volunteer, opportunity: todayOpp });
      } catch (mailErr) {
        console.error('photo reminder lookup failed:', mailErr.message);
      }
    } else if (!record.checkOutAt) {
      const since = now.getTime() - new Date(record.checkInAt).getTime();
      if (since < 15 * 60 * 1000) {
        return res.json({
          action: 'duplicate',
          volunteer,
          record,
          message: 'Already checked in — please wait at least 15 minutes before checking out'
        });
      }
      await record.update({ checkOutAt: now });
      action = 'checkout';
    } else {
      return res.json({
        action: 'already_done',
        volunteer,
        record,
        message: 'Already checked in and out today'
      });
    }

    // On check-out, auto-mark attendance in any of the volunteer's
    // active opportunities whose daily time window overlaps their
    // visit today.
    let autoMarked = [];
    if (action === 'checkout') {
      try {
        autoMarked = await _autoMarkOpportunitiesForCheckout(
          volunteer.volunteerId, record.date, record.checkInAt, record.checkOutAt
        );
      } catch (autoErr) {
        console.error('auto-mark opportunities error:', autoErr);
      }
    }

    res.json({ action, volunteer, record, autoMarked });
  } catch (err) {
    console.error('Volunteer scanAttendance error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /volunteers/attendance/today — today's events + volunteers array
exports.todayAttendance = async (req, res) => {
  try {
    const date = todayStr();
    const records = await VolunteerAttendance.findAll({
      where: { date },
      include: [{ model: Volunteer, as: 'volunteer', required: false }]
    });

    const events = [];
    const volunteersList = [];
    for (const r of records) {
      const v = r.volunteer || {};
      const base = {
        attendanceId: r.attendanceId,
        volunteerId: r.volunteerId,
        name: v.name || '',
        phone: v.phone || ''
      };
      if (r.checkInAt) events.push({ ...base, kind: 'checkin', at: r.checkInAt });
      if (r.checkOutAt) events.push({ ...base, kind: 'checkout', at: r.checkOutAt });

      volunteersList.push({
        ...base,
        checkInAt: r.checkInAt,
        checkOutAt: r.checkOutAt,
        status: r.checkOutAt ? 'checked_out' : 'checked_in'
      });
    }
    events.sort((a, b) => new Date(b.at) - new Date(a.at));
    volunteersList.sort((a, b) => {
      return new Date(b.checkOutAt || b.checkInAt || 0) - new Date(a.checkOutAt || a.checkInAt || 0);
    });

    const checkins = events.filter(e => e.kind === 'checkin').length;
    const checkouts = events.filter(e => e.kind === 'checkout').length;
    res.json({ date, events, volunteers: volunteersList, stats: { checkins, checkouts } });
  } catch (err) {
    console.error('Volunteer todayAttendance error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// DELETE /volunteers/attendance/today
exports.clearTodayAttendance = async (req, res) => {
  try {
    const date = todayStr();
    const count = await VolunteerAttendance.destroy({ where: { date } });
    res.json({ message: 'Today cleared', date, count });
  } catch (err) {
    console.error('Volunteer clearTodayAttendance error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /volunteers/:id/attendance
exports.listVolunteerAttendance = async (req, res) => {
  try {
    const records = await VolunteerAttendance.findAll({
      where: { volunteerId: req.params.id },
      order: [['date', 'DESC'], ['checkInAt', 'DESC']]
    });
    res.json(records);
  } catch (err) {
    console.error('Volunteer listVolunteerAttendance error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST /volunteers/attendance — admin-created attendance row for a
// past date the volunteer didn't scan. Body: { volunteerId, date,
// checkInAt?, checkOutAt? } where the times are 'HH:MM' anchored to
// the date in Riyadh (+03:00) or full ISO. If a row for (volunteerId,
// date) already exists, this returns 409 to force the admin to edit
// the existing one via the ✎ button instead of silently overwriting.
exports.createManualAttendance = async (req, res) => {
  try {
    const { volunteerId, date, checkInAt, checkOutAt } = req.body || {};
    if (!volunteerId || !date) {
      return res.status(400).json({
        message: 'volunteerId and date are required',
        messageAr: 'المتطوع والتاريخ مطلوبان'
      });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ message: 'Invalid date format' });
    }
    const volunteer = await Volunteer.findByPk(volunteerId);
    if (!volunteer) return res.status(404).json({ message: 'Volunteer not found' });

    const existing = await VolunteerAttendance.findOne({
      where: { volunteerId, date }
    });
    if (existing) {
      return res.status(409).json({
        message: 'Attendance for this date already exists — edit it instead',
        messageAr: 'يوجد سجل حضور لهذا التاريخ — عدّله بدلاً من إنشاء جديد',
        record: existing
      });
    }

    const parseTime = (raw) => {
      if (raw == null || raw === '') return null;
      const str = String(raw).trim();
      let t;
      if (/^\d{2}:\d{2}(:\d{2})?$/.test(str)) {
        const timeStr = str.length === 5 ? `${str}:00` : str;
        t = new Date(`${date}T${timeStr}+03:00`);
      } else {
        t = new Date(str);
      }
      return isNaN(t.getTime()) ? undefined : t;
    };

    const inAt = parseTime(checkInAt);
    const outAt = parseTime(checkOutAt);
    if (inAt === undefined || outAt === undefined) {
      return res.status(400).json({
        message: 'Invalid time format',
        messageAr: 'صيغة الوقت غير صالحة'
      });
    }
    if (!inAt && !outAt) {
      return res.status(400).json({
        message: 'At least one of checkInAt / checkOutAt is required',
        messageAr: 'يجب إدخال وقت الدخول أو الخروج على الأقل'
      });
    }
    if (inAt && outAt && outAt < inAt) {
      return res.status(400).json({
        message: 'Check-out cannot be before check-in',
        messageAr: 'وقت الخروج يجب أن يكون بعد وقت الدخول'
      });
    }

    const record = await VolunteerAttendance.create({
      volunteerId,
      date,
      checkInAt: inAt || null,
      checkOutAt: outAt || null
    });
    res.status(201).json({ message: 'Manual attendance created', record });
  } catch (err) {
    console.error('createManualAttendance error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// PATCH /volunteers/attendance/:id/checkout
// - body empty (or { checkOutAt: null/'' }) → clears the check-out
// - body { checkOutAt: 'HH:MM' | 'HH:MM:SS' } → combines with the
//   record's date in Riyadh time (+03:00) and stores as a full timestamp
// - body { checkOutAt: '<ISO>' } → uses the timestamp as-is
//
// Used both by the "clear" button and the "sign check-out for a day
// the volunteer forgot" admin flow.
exports.clearCheckout = async (req, res) => {
  try {
    const rec = await VolunteerAttendance.findByPk(req.params.id);
    if (!rec) return res.status(404).json({ message: 'Record not found' });

    const raw = req.body?.checkOutAt;
    const hasValue = raw !== undefined && raw !== null && String(raw).trim() !== '';

    if (!hasValue) {
      if (!rec.checkOutAt) return res.status(400).json({ message: 'No check-out to clear' });
      await rec.update({ checkOutAt: null });
      return res.json({ message: 'Check-out cleared', record: rec });
    }

    const str = String(raw).trim();
    let newTime;
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(str)) {
      // HH:MM(:SS) — anchor to the record's date, Riyadh timezone
      const timeStr = str.length === 5 ? `${str}:00` : str;
      newTime = new Date(`${rec.date}T${timeStr}+03:00`);
    } else {
      newTime = new Date(str);
    }
    if (isNaN(newTime.getTime())) {
      return res.status(400).json({
        message: 'Invalid time format',
        messageAr: 'صيغة الوقت غير صالحة'
      });
    }

    if (rec.checkInAt && newTime < new Date(rec.checkInAt)) {
      return res.status(400).json({
        message: 'Check-out cannot be before check-in',
        messageAr: 'وقت الخروج يجب أن يكون بعد وقت الدخول'
      });
    }

    await rec.update({ checkOutAt: newTime });
    res.json({ message: 'Check-out saved', record: rec });
  } catch (err) {
    console.error('Volunteer clearCheckout error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// DELETE /volunteers/attendance/:id
exports.deleteAttendance = async (req, res) => {
  try {
    const rec = await VolunteerAttendance.findByPk(req.params.id);
    if (!rec) return res.status(404).json({ message: 'Record not found' });
    await rec.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Volunteer deleteAttendance error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ============== Attendance export (Excel-friendly TSV) ==============

const riyadhTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Riyadh',
  hour12: false,
  hour: '2-digit', minute: '2-digit', second: '2-digit'
});
const fmtTimeRiyadh = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return riyadhTimeFmt.format(dt).replace(/^24:/, '00:');
};

exports.exportAttendance = async (req, res) => {
  try {
    const { volunteerIds, from, to } = req.body || {};
    const where = {};
    if (Array.isArray(volunteerIds) && volunteerIds.length > 0) {
      where.volunteerId = { [Op.in]: volunteerIds };
    }
    if (from) where.date = { ...(where.date || {}), [Op.gte]: from };
    if (to) where.date = { ...(where.date || {}), [Op.lte]: to };

    const records = await VolunteerAttendance.findAll({
      where,
      include: [{ model: Volunteer, as: 'volunteer', required: false }],
      order: [['date', 'ASC'], ['checkInAt', 'ASC']]
    });

    const header = ['اسم المتطوع', 'رقم الهوية', 'رقم الجوال', 'التاريخ', 'وقت الدخول', 'وقت الخروج', 'المدة (دقيقة)'];
    const lines = [header.join('\t')];
    for (const r of records) {
      const v = r.volunteer || {};
      const minutes = r.checkInAt && r.checkOutAt
        ? Math.max(0, Math.round((new Date(r.checkOutAt) - new Date(r.checkInAt)) / 60000))
        : '';
      lines.push([
        v.name || '',
        v.nationalId || '',
        v.phone || '',
        r.date || '',
        fmtTimeRiyadh(r.checkInAt),
        fmtTimeRiyadh(r.checkOutAt),
        minutes
      ].map(x => String(x ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ')).join('\t'));
    }

    const text = lines.join('\r\n');
    const bom = Buffer.from([0xFF, 0xFE]);
    const body = Buffer.from(text, 'utf16le');
    const out = Buffer.concat([bom, body]);

    const today = todayStr();
    res.setHeader('Content-Type', 'text/csv; charset=utf-16le');
    res.setHeader('Content-Disposition', `attachment; filename="volunteers-attendance-${today}.csv"`);
    res.send(out);
  } catch (err) {
    console.error('Volunteer exportAttendance error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ============== VOLUNTEER PUBLIC SHARE (admin side) ==============

// PATCH /volunteers/:id/share — body { shareEnabled?, driveUrl?,
// shareFromDate?, shareToDate? }. Nulls / empty strings clear the field.
exports.updateVolunteerShare = async (req, res) => {
  try {
    const { id } = req.params;
    const { shareEnabled, driveUrl, shareFromDate, shareToDate } = req.body || {};

    const volunteer = await Volunteer.findByPk(id);
    if (!volunteer) return res.status(404).json({ message: 'Volunteer not found' });

    const patch = {};
    if (shareEnabled !== undefined) patch.shareEnabled = !!shareEnabled;
    if (driveUrl !== undefined) {
      const trimmed = String(driveUrl || '').trim();
      patch.driveUrl = trimmed || null;
    }
    if (shareFromDate !== undefined) {
      patch.shareFromDate = shareFromDate ? String(shareFromDate) : null;
    }
    if (shareToDate !== undefined) {
      patch.shareToDate = shareToDate ? String(shareToDate) : null;
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ message: 'Nothing to update' });
    }

    // Lazy-mint a share token if the row was created before the
    // migration and somehow slipped through without one.
    if (!volunteer.shareToken) {
      patch.shareToken = crypto.randomUUID();
    }

    await volunteer.update(patch);
    res.json({
      volunteerId: volunteer.volunteerId,
      shareEnabled: volunteer.shareEnabled,
      driveUrl: volunteer.driveUrl,
      shareToken: volunteer.shareToken,
      shareFromDate: volunteer.shareFromDate,
      shareToDate: volunteer.shareToDate
    });
  } catch (err) {
    console.error('Volunteer updateVolunteerShare error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST /volunteers/:id/share/rotate — invalidates the old link
exports.rotateVolunteerShareToken = async (req, res) => {
  try {
    const { id } = req.params;
    const volunteer = await Volunteer.findByPk(id);
    if (!volunteer) return res.status(404).json({ message: 'Volunteer not found' });

    const newToken = crypto.randomUUID();
    await volunteer.update({ shareToken: newToken });
    res.json({ volunteerId: volunteer.volunteerId, shareToken: newToken });
  } catch (err) {
    console.error('Volunteer rotateVolunteerShareToken error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /volunteers/share/master-token — fetches (or creates) the single
// master token used for the combined attendance report link.
exports.getMasterShareToken = async (req, res) => {
  try {
    const KEY = 'volunteer_master_share_token';
    let row = await Settings.findOne({ where: { key: KEY } });
    if (!row) {
      row = await Settings.create({ key: KEY, value: crypto.randomUUID() });
    }
    res.json({ masterToken: row.value });
  } catch (err) {
    console.error('Volunteer getMasterShareToken error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST /volunteers/share/master-token/rotate — rotates the master token
exports.rotateMasterShareToken = async (req, res) => {
  try {
    const KEY = 'volunteer_master_share_token';
    const newToken = crypto.randomUUID();
    const [row] = await Settings.findOrCreate({
      where: { key: KEY },
      defaults: { value: newToken }
    });
    if (row.value !== newToken) {
      await row.update({ value: newToken });
    }
    res.json({ masterToken: newToken });
  } catch (err) {
    console.error('Volunteer rotateMasterShareToken error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ============== VOLUNTEER PUBLIC SHARE (no-auth side) ==============

const _UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Normalize a DATEONLY (which sequelize may return as a Date or a
// 'YYYY-MM-DD' string depending on driver) to a plain 'YYYY-MM-DD'.
const _isoDate = (v) => {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  return null;
};

// Resolve the effective attendance window for a volunteer's public share.
// Priority: explicit shareFromDate/shareToDate → linked summer program's
// startDate/endDate → unbounded (return nulls).
const _resolveShareRange = (volunteer) => {
  const prog = volunteer.summerProgram;
  const from = _isoDate(volunteer.shareFromDate) || _isoDate(prog?.startDate);
  const to = _isoDate(volunteer.shareToDate) || _isoDate(prog?.endDate);
  return { from, to };
};

// Derive one opportunity's per-day attendance from the shared
// VolunteerAttendance QR log — the single source of truth. Each
// eligible day yields { date, attended:true, hours, checkInAt,
// checkOutAt, source:'qr' } so the UI can show the raw scan times
// alongside the computed hours.
//
// Overlap rules:
//   - If the opportunity has both dailyStartTime/dailyEndTime AND the
//     attendance row has check-in + check-out, hours = clamped overlap
//   - Otherwise (no time window OR incomplete scan), the whole day
//     counts and hours = duration between check-in/out (0 if still-in)
const _shapeOpportunityDays = (opp, attendanceRows) => {
  const start = _isoDate(opp.startDate);
  const end = _isoDate(opp.endDate);
  const chFrom = _hhmmToMin(opp.dailyStartTime);
  const chTo = _hhmmToMin(opp.dailyEndTime);
  const timeWindowed = chFrom != null && chTo != null && chTo > chFrom;

  const days = [];
  for (const rec of (attendanceRows || [])) {
    const d = _isoDate(rec.date);
    if (!d) continue;
    if (start && d < start) continue;
    if (end && d > end) continue;

    let overlapMin;
    if (timeWindowed && rec.checkInAt && rec.checkOutAt) {
      const inMin = _tsToRiyadhMinOfDay(rec.checkInAt);
      const outMin = _tsToRiyadhMinOfDay(rec.checkOutAt);
      if (inMin == null || outMin == null || outMin <= inMin) continue;
      overlapMin = Math.min(outMin, chTo) - Math.max(inMin, chFrom);
      if (overlapMin <= 0) continue;
    } else if (rec.checkInAt) {
      // No window OR incomplete record — count the day at full duration
      const inMin = _tsToRiyadhMinOfDay(rec.checkInAt);
      const outMin = rec.checkOutAt ? _tsToRiyadhMinOfDay(rec.checkOutAt) : null;
      overlapMin = outMin != null && outMin > inMin ? outMin - inMin : 0;
    } else {
      continue;
    }

    days.push({
      date: d,
      attended: true,
      hours: Math.round((overlapMin / 60) * 100) / 100,
      checkInAt: rec.checkInAt || null,
      checkOutAt: rec.checkOutAt || null,
      source: 'qr'
    });
  }
  // Newest first for display consistency with attendance table.
  days.sort((a, b) => (a.date < b.date ? 1 : -1));
  return days;
};

const _shapeAttendance = (record) => {
  const inAt = record.checkInAt ? new Date(record.checkInAt) : null;
  const outAt = record.checkOutAt ? new Date(record.checkOutAt) : null;
  const minutes = inAt && outAt ? Math.max(0, Math.round((outAt - inAt) / 60000)) : null;
  return {
    date: record.date,
    checkInAt: record.checkInAt || null,
    checkOutAt: record.checkOutAt || null,
    minutes
  };
};

// GET /public/volunteer/:token — full profile + attendance for one
// volunteer. NO AUTH.
exports.publicGetVolunteerByToken = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || !_UUID_RE.test(token)) {
      return res.status(404).json({ message: 'Not found' });
    }

    const volunteer = await Volunteer.findOne({
      where: { shareToken: token },
      include: [
        {
          model: SummerProgram,
          as: 'summerProgram',
          required: false,
          attributes: ['programId', 'name', 'color', 'fablabSection', 'startDate', 'endDate']
        },
        {
          model: VolunteerOpportunity,
          as: 'opportunities',
          required: false,
          where: { status: { [Op.ne]: 'cancelled' } },
          attributes: [
            'opportunityId', 'title', 'description',
            'startDate', 'endDate',
            'dailyStartTime', 'dailyEndTime',
            'dailyHours', 'totalHours', 'hoursAdjustment',
            'attendanceDays', 'status'
          ]
        }
      ]
    });
    if (!volunteer || !volunteer.shareEnabled) {
      return res.status(404).json({ message: 'Not found or sharing disabled' });
    }

    // Effective attendance window: explicit override → linked program's
    // dates → unbounded. Applied as a WHERE on the attendance query so
    // the reviewer only sees hours from the relevant volunteering period.
    const range = _resolveShareRange(volunteer);
    const attWhere = { volunteerId: volunteer.volunteerId };
    if (range.from && range.to) attWhere.date = { [Op.between]: [range.from, range.to] };
    else if (range.from) attWhere.date = { [Op.gte]: range.from };
    else if (range.to) attWhere.date = { [Op.lte]: range.to };

    const attendance = await VolunteerAttendance.findAll({
      where: attWhere,
      order: [['date', 'DESC'], ['checkInAt', 'DESC']]
    });

    // Shape opportunities: keep only those that overlap the effective
    // period, and derive attendanceDays dynamically from the QR log
    // (VolunteerAttendance) so admin QR scans + manual edits are the
    // ONE source of truth — no more parallel attendanceDays JSON drift.
    const opps = (volunteer.opportunities || [])
      .filter(o => {
        const os = _isoDate(o.startDate);
        const oe = _isoDate(o.endDate);
        if (range.from && oe && oe < range.from) return false;
        if (range.to && os && os > range.to) return false;
        return true;
      })
      .map(o => ({
        opportunityId: o.opportunityId,
        title: o.title,
        description: o.description,
        startDate: _isoDate(o.startDate),
        endDate: _isoDate(o.endDate),
        dailyStartTime: o.dailyStartTime,
        dailyEndTime: o.dailyEndTime,
        dailyHours: o.dailyHours,
        totalHours: o.totalHours,
        hoursAdjustment: o.hoursAdjustment,
        status: o.status,
        attendanceDays: _shapeOpportunityDays(o, attendance)
      }));

    res.json({
      volunteer: {
        volunteerId: volunteer.volunteerId,
        name: volunteer.name,
        nationalId: volunteer.nationalId,
        phone: volunteer.phone,
        email: volunteer.email,
        driveUrl: volunteer.driveUrl,
        summerProgram: volunteer.summerProgram
          ? {
              programId: volunteer.summerProgram.programId,
              name: volunteer.summerProgram.name,
              color: volunteer.summerProgram.color,
              fablabSection: volunteer.summerProgram.fablabSection,
              startDate: _isoDate(volunteer.summerProgram.startDate),
              endDate: _isoDate(volunteer.summerProgram.endDate)
            }
          : null
      },
      shareRange: range,
      opportunities: opps,
      attendance: attendance.map(_shapeAttendance)
    });
  } catch (err) {
    console.error('publicGetVolunteerByToken error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /public/attendance-report/:masterToken — every share-enabled
// volunteer + their full attendance. NO AUTH.
exports.publicGetMasterReport = async (req, res) => {
  try {
    const { masterToken } = req.params;
    if (!masterToken || !_UUID_RE.test(masterToken)) {
      return res.status(404).json({ message: 'Not found' });
    }

    const setting = await Settings.findOne({ where: { key: 'volunteer_master_share_token' } });
    if (!setting || setting.value !== masterToken) {
      return res.status(404).json({ message: 'Not found' });
    }

    const volunteers = await Volunteer.findAll({
      where: { shareEnabled: true },
      include: [
        {
          model: VolunteerAttendance,
          as: 'attendance',
          required: false
        },
        {
          model: SummerProgram,
          as: 'summerProgram',
          required: false,
          attributes: ['programId', 'name', 'color', 'fablabSection', 'startDate', 'endDate']
        },
        {
          model: VolunteerOpportunity,
          as: 'opportunities',
          required: false,
          where: { status: { [Op.ne]: 'cancelled' } },
          attributes: [
            'opportunityId', 'title', 'startDate', 'endDate',
            'dailyStartTime', 'dailyEndTime',
            'totalHours', 'hoursAdjustment', 'attendanceDays', 'status'
          ]
        }
      ],
      order: [['name', 'ASC']]
    });

    const shaped = volunteers.map(v => {
      const range = _resolveShareRange(v);
      const inRange = (isoDate) => {
        if (!isoDate) return false;
        const d = _isoDate(isoDate);
        if (range.from && d < range.from) return false;
        if (range.to && d > range.to) return false;
        return true;
      };

      const att = (v.attendance || [])
        .filter(r => inRange(r.date))
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .map(_shapeAttendance);
      const totalMinutes = att.reduce((s, r) => s + (r.minutes || 0), 0);

      // Fresh (unshaped) attendance rows scoped to this volunteer,
      // filtered by effective range — reused by _shapeOpportunityDays
      // so each chance's days are computed from the same QR source
      // instead of the legacy attendanceDays JSON.
      const rangedRawAtt = (v.attendance || [])
        .filter(r => inRange(r.date));

      const opps = (v.opportunities || [])
        .filter(o => {
          const os = _isoDate(o.startDate);
          const oe = _isoDate(o.endDate);
          if (range.from && oe && oe < range.from) return false;
          if (range.to && os && os > range.to) return false;
          return true;
        })
        .map(o => ({
          opportunityId: o.opportunityId,
          title: o.title,
          startDate: _isoDate(o.startDate),
          endDate: _isoDate(o.endDate),
          dailyStartTime: o.dailyStartTime,
          dailyEndTime: o.dailyEndTime,
          totalHours: o.totalHours,
          hoursAdjustment: o.hoursAdjustment,
          status: o.status,
          attendanceDays: _shapeOpportunityDays(o, rangedRawAtt)
        }));

      return {
        volunteerId: v.volunteerId,
        shareToken: v.shareToken,
        name: v.name,
        nationalId: v.nationalId,
        phone: v.phone,
        driveUrl: v.driveUrl,
        summerProgram: v.summerProgram
          ? {
              programId: v.summerProgram.programId,
              name: v.summerProgram.name,
              color: v.summerProgram.color,
              fablabSection: v.summerProgram.fablabSection,
              startDate: _isoDate(v.summerProgram.startDate),
              endDate: _isoDate(v.summerProgram.endDate)
            }
          : null,
        shareRange: range,
        totalDays: att.filter(r => r.checkInAt).length,
        totalMinutes,
        opportunities: opps,
        attendance: att
      };
    });

    res.json({ generatedAt: new Date().toISOString(), volunteers: shaped });
  } catch (err) {
    console.error('publicGetMasterReport error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = exports;
