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
  const safeName = studentName ? String(studentName) : '';
  return `
  <div style="background:#eef2f7;padding:24px 12px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="max-width:660px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 24px 60px -24px rgba(15,23,42,0.25);margin:0 auto;">
      <!-- Top rainbow accent -->
      <tr><td style="height:8px;background:linear-gradient(90deg,#f59e0b 0%,#ef4444 35%,#ec4899 65%,#8b5cf6 100%);font-size:0;line-height:0;">&nbsp;</td></tr>

      <!-- Hero header -->
      <tr>
        <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 55%,#312e81 100%);padding:42px 28px 36px;text-align:center;position:relative;">
          <div style="display:inline-block;padding:10px 26px;background:rgba(253,224,71,0.14);border:1px solid rgba(253,224,71,0.4);border-radius:999px;margin-bottom:18px;">
            <span style="color:#fde68a;font-size:13px;font-weight:700;letter-spacing:3px;">TALENTED STUDENTS PROGRAM</span>
          </div>
          <h1 dir="rtl" style="margin:0;color:#ffffff;font-size:40px;font-weight:900;letter-spacing:-0.5px;line-height:1.15;">برنامج موهبة</h1>
          <div style="margin:14px auto 10px;width:60px;height:3px;background:linear-gradient(90deg,#f59e0b,#ec4899);border-radius:2px;"></div>
          <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">فاب لاب الأحساء</p>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.6);font-size:13px;letter-spacing:1px;">FABLAB Al-Ahsa &middot; Mawhba</p>
        </td>
      </tr>

      ${safeSubject ? `
      <!-- Subject banner -->
      <tr>
        <td style="padding:0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="background:linear-gradient(90deg,#fff8eb 0%,#fef3c7 100%);padding:18px 28px;border-bottom:1px solid #fde68a;">
                <div style="color:#92400e;font-size:11px;font-weight:800;letter-spacing:2.5px;margin-bottom:6px;">SUBJECT &middot; الموضوع</div>
                <div style="color:#0f172a;font-size:18px;font-weight:800;line-height:1.4;">${safeSubject}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>` : ''}

      <!-- Greeting + body -->
      <tr>
        <td dir="rtl" style="padding:36px 32px 28px;background:#ffffff;">
          <p style="margin:0 0 6px;color:#64748b;font-size:12px;font-weight:700;letter-spacing:2px;">السلام عليكم ورحمة الله وبركاته</p>
          ${safeName ? `<h2 style="margin:6px 0 22px;color:#0f172a;font-size:24px;font-weight:800;">عزيزي/تي <span style="background:linear-gradient(135deg,#8b5cf6,#ec4899);-webkit-background-clip:text;background-clip:text;color:transparent;">${safeName}</span></h2>` : `<h2 style="margin:6px 0 22px;color:#0f172a;font-size:24px;font-weight:800;">عزيزي الطالب/ـة</h2>`}
          <div style="color:#1f2937;line-height:2.05;font-size:16px;font-weight:500;">
            ${safeBody}
          </div>
        </td>
      </tr>

      <!-- Soft divider -->
      <tr><td style="padding:0 32px;"><div style="height:1px;background:linear-gradient(90deg,transparent,#e2e8f0 20%,#e2e8f0 80%,transparent);"></div></td></tr>

      <!-- Signature card -->
      <tr>
        <td dir="rtl" style="padding:22px 32px 30px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:linear-gradient(135deg,#faf5ff 0%,#fff8eb 100%);border:1px solid #e9d5ff;border-radius:12px;">
            <tr>
              <td style="padding:18px 22px;">
                <p style="margin:0;color:#581c87;font-size:14px;font-weight:700;">إدارة برنامج موهبة</p>
                <p style="margin:4px 0 0;color:#7c3aed;font-size:12px;">فاب لاب الأحساء &middot; Mawhba Program Management</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#0f172a;padding:26px 28px;text-align:center;">
          <p style="margin:0 0 6px;color:#ffffff;font-size:15px;font-weight:800;">فاب لاب الأحساء | FABLAB Al-Ahsa</p>
          <p style="margin:0;color:rgba(255,255,255,0.55);font-size:11px;letter-spacing:1px;">DIGITAL FABRICATION LABORATORY &middot; MAWHBA TALENTED STUDENTS</p>
          <div style="margin:14px auto 0;width:36px;height:2px;background:linear-gradient(90deg,#f59e0b,#ec4899);border-radius:2px;"></div>
        </td>
      </tr>
    </table>
    <p style="text-align:center;margin:16px 0 0;color:#94a3b8;font-size:11px;">هذه رسالة آلية من نظام موهبة &middot; This is an automated message from the Mawhba system</p>
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
