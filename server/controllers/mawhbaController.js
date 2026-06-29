const { MawhbaStudent } = require('../models');
const { Op } = require('sequelize');
const { sendCustomEmail } = require('../utils/emailService');

const ALLOWED_FIELDS = [
  'nameAr', 'nameEn', 'nationalId', 'nationality', 'schoolGrade',
  'administrativeRegion', 'educationalAdministration', 'schoolName',
  'sex', 'residenceCity', 'executingEntity', 'courseName', 'courseNumber',
  'courseAmount', 'registrationDate', 'studentPhone', 'email', 'guardianPhone'
];

const pickFields = (body) => {
  const out = {};
  for (const k of ALLOWED_FIELDS) {
    if (body[k] !== undefined) out[k] = body[k] === '' ? null : body[k];
  }
  return out;
};

exports.list = async (req, res) => {
  try {
    const { sex, search } = req.query;
    const where = {};
    if (sex && ['male', 'female'].includes(sex)) where.sex = sex;
    if (search) {
      const q = `%${search}%`;
      where[Op.or] = [
        { nameAr: { [Op.iLike]: q } },
        { nameEn: { [Op.iLike]: q } },
        { nationalId: { [Op.iLike]: q } },
        { email: { [Op.iLike]: q } },
        { schoolName: { [Op.iLike]: q } },
        { courseName: { [Op.iLike]: q } }
      ];
    }
    const students = await MawhbaStudent.findAll({ where, order: [['createdAt', 'DESC']] });
    res.json(students);
  } catch (err) {
    console.error('Mawhba list error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const data = pickFields(req.body);
    if (!data.nameAr) return res.status(400).json({ message: 'Name (Arabic) is required' });
    if (!data.nationalId) return res.status(400).json({ message: 'National ID is required' });
    const student = await MawhbaStudent.create(data);
    res.status(201).json(student);
  } catch (err) {
    console.error('Mawhba create error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const student = await MawhbaStudent.findByPk(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    const data = pickFields(req.body);
    await student.update(data);
    res.json(student);
  } catch (err) {
    console.error('Mawhba update error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const student = await MawhbaStudent.findByPk(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    await student.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Mawhba delete error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const buildMawhbaEmailHtml = ({ studentName, subject, messageBody }) => {
  const safeBody = String(messageBody || '').replace(/\n/g, '<br>');
  const safeSubject = String(subject || '').trim();
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; max-width: 640px; margin: 0 auto; background: #f8fafc;">
      <!-- Top accent bar -->
      <div style="height: 6px; background: linear-gradient(90deg, #f59e0b, #ef4444, #8b5cf6);"></div>

      <!-- Header -->
      <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 32px 24px; text-align: center;">
        <div style="display:inline-block; background: rgba(255,255,255,0.1); padding: 8px 18px; border-radius: 999px; margin-bottom: 14px;">
          <span style="color: #fde68a; font-size: 12px; letter-spacing: 2px; font-weight: 700;">برنامج موهبة</span>
        </div>
        <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 800;">فاب لاب الأحساء</h1>
        <p style="color: rgba(255,255,255,0.75); margin: 6px 0 0 0; font-size: 13px;">FABLAB Al-Ahsa &middot; Mawhba Talented Students</p>
      </div>

      <!-- Subject banner -->
      ${safeSubject ? `
      <div style="background: #fff8eb; padding: 16px 24px; border-bottom: 1px solid #fde68a;">
        <p style="margin: 0; color: #92400e; font-size: 12px; font-weight: 700; letter-spacing: 1px;">SUBJECT &middot; الموضوع</p>
        <p style="margin: 4px 0 0 0; color: #0f172a; font-size: 16px; font-weight: 700;">${safeSubject}</p>
      </div>` : ''}

      <!-- Arabic greeting/body -->
      <div dir="rtl" style="padding: 28px 26px; background: #ffffff;">
        <h2 style="color: #0f172a; margin: 0 0 14px 0; font-size: 18px;">السلام عليكم ${studentName ? `<span style="color:#ef4444">${studentName}</span>` : ''}</h2>
        <div style="color: #1f2937; line-height: 1.9; font-size: 15px;">
          ${safeBody}
        </div>
      </div>

      <!-- Divider -->
      <div style="height: 1px; background: linear-gradient(90deg, transparent, #cbd5e1, transparent);"></div>

      <!-- Footer -->
      <div style="background: #0f172a; padding: 24px; text-align: center;">
        <p style="color: white; margin: 0 0 6px 0; font-weight: 700;">فاب لاب الأحساء | FABLAB Al-Ahsa</p>
        <p style="color: rgba(255,255,255,0.55); margin: 0; font-size: 11px;">برنامج موهبة للموهوبين &middot; Mawhba Talented Students Program</p>
      </div>
    </div>
  `;
};

const sendMawhbaEmail = async (student, subject, messageBody) => {
  const sgMail = require('@sendgrid/mail');
  const html = buildMawhbaEmailHtml({
    studentName: student.nameAr || student.nameEn,
    subject,
    messageBody
  });
  const msg = {
    to: student.email,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL,
      name: process.env.SENDGRID_FROM_NAME
    },
    subject: subject,
    html
  };
  await sgMail.send(msg);
};

exports.sendEmail = async (req, res) => {
  try {
    const { studentIds, subject, message } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ message: 'No students selected' });
    }
    if (!subject || !subject.trim()) return res.status(400).json({ message: 'Subject required' });
    if (!message || !message.trim()) return res.status(400).json({ message: 'Message required' });

    const students = await MawhbaStudent.findAll({
      where: { studentId: { [Op.in]: studentIds } }
    });

    let successCount = 0;
    let failCount = 0;
    const skippedNoEmail = [];

    for (const s of students) {
      if (!s.email) {
        skippedNoEmail.push(s.nameAr || s.nameEn || s.studentId);
        continue;
      }
      try {
        await sendMawhbaEmail(s, subject.trim(), message.trim());
        successCount++;
      } catch (e) {
        console.error(`Failed to email ${s.email}:`, e?.response?.body || e?.message || e);
        failCount++;
      }
    }

    res.json({
      message: `Sent: ${successCount}, Failed: ${failCount}, Skipped (no email): ${skippedNoEmail.length}`,
      successCount,
      failCount,
      skippedNoEmail
    });
  } catch (err) {
    console.error('Mawhba sendEmail error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = exports;
