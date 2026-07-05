const { MawhbaStudent, MawhbaCourseColor, MawhbaAttendance } = require('../models');
const { Op } = require('sequelize');
const QRCode = require('qrcode');
const { sendCustomEmail } = require('../utils/emailService');

const DEFAULT_COURSE_COLOR = '#8b5cf6';

// Derives a darker shade of a hex color for gradient endpoints
const darken = (hex, amount = 0.45) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#0f172a';
  const n = parseInt(m[1], 16);
  const r = Math.max(0, Math.round(((n >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((n >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((n & 0xff) * (1 - amount)));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
};

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
    const { sex, search, course } = req.query;
    const where = {};
    if (sex && ['male', 'female'].includes(sex)) where.sex = sex;
    if (course) where.courseName = course;
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

exports.listCourses = async (req, res) => {
  try {
    const rows = await MawhbaStudent.findAll({
      attributes: ['courseName'],
      where: { courseName: { [Op.ne]: null } },
      group: ['courseName'],
      order: [['courseName', 'ASC']]
    });
    res.json(rows.map(r => r.courseName).filter(Boolean));
  } catch (err) {
    console.error('Mawhba listCourses error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.listCourseColors = async (req, res) => {
  try {
    const rows = await MawhbaCourseColor.findAll({ order: [['courseName', 'ASC']] });
    res.json(rows);
  } catch (err) {
    console.error('Mawhba listCourseColors error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.setCourseColor = async (req, res) => {
  try {
    const { courseName, color } = req.body;
    if (!courseName) return res.status(400).json({ message: 'courseName required' });
    if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) return res.status(400).json({ message: 'Valid hex color required (e.g. #8b5cf6)' });
    const [row] = await MawhbaCourseColor.findOrCreate({
      where: { courseName },
      defaults: { color }
    });
    if (row.color !== color) await row.update({ color });
    res.json(row);
  } catch (err) {
    console.error('Mawhba setCourseColor error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getColorForCourse = async (courseName) => {
  if (!courseName) return DEFAULT_COURSE_COLOR;
  const row = await MawhbaCourseColor.findOne({ where: { courseName } });
  return row?.color || DEFAULT_COURSE_COLOR;
};

const buildIdCardHtml = ({ student, qrDataUrl, logoSrc, color }) => {
  const name = student.nameAr || student.nameEn || '';
  const nid = student.nationalId || '';
  const guardian = student.guardianPhone || student.studentPhone || '';
  const course = student.courseName || '';
  const grade = student.schoolGrade || '';
  const c = color || DEFAULT_COURSE_COLOR;
  const cDark = darken(c, 0.55);
  return `
  <div class="mawhba-card" dir="rtl" style="--course-color:${c}; --course-color-dark:${cDark};">
    <div class="mawhba-card-top">
      <div class="mawhba-card-brand">
        <img src="${logoSrc}" alt="FabLab" class="mawhba-card-logo" />
        <div class="mawhba-card-brand-text">
          <div class="mawhba-card-fablab">فاب لاب الأحساء</div>
          <div class="mawhba-card-fablab-en">FABLAB AL-AHSA</div>
        </div>
      </div>
      <div class="mawhba-card-program">
        <div class="mawhba-card-program-ar">برنامج موهبة</div>
        <div class="mawhba-card-program-en">MAWHBA</div>
      </div>
    </div>

    <div class="mawhba-card-body">
      <div class="mawhba-card-name">${name}</div>

      <div class="mawhba-card-field">
        <div class="mawhba-card-field-label">رقم الهوية</div>
        <div class="mawhba-card-field-value mono">${nid}</div>
      </div>
      <div class="mawhba-card-field">
        <div class="mawhba-card-field-label">رقم ولي الأمر</div>
        <div class="mawhba-card-field-value mono">${guardian || '—'}</div>
      </div>
      ${grade ? `<div class="mawhba-card-field">
        <div class="mawhba-card-field-label">الصف</div>
        <div class="mawhba-card-field-value">${grade}</div>
      </div>` : ''}
    </div>

    <div class="mawhba-card-course">
      <div class="mawhba-card-course-label">اسم الدورة</div>
      <div class="mawhba-card-course-name">${course || '—'}</div>
    </div>

    <div class="mawhba-card-bottom">
      <img src="${qrDataUrl}" alt="QR" class="mawhba-card-qr" />
      <div class="mawhba-card-qr-label">رمز الحضور</div>
      <div class="mawhba-card-footer-text">
        <div>هذه البطاقة ملك لفاب لاب الأحساء — يرجى إعادتها عند الفقدان</div>
        <div class="mono">ID · ${nid}</div>
      </div>
    </div>
  </div>`;
};

const CARD_CSS = `
  .mawhba-card {
    width: 360px;
    min-height: 600px;
    background: white;
    border-radius: 18px;
    box-shadow: 0 20px 40px -20px rgba(15, 23, 42, 0.4);
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
    overflow: hidden;
    position: relative;
    color: #0f172a;
    border: 1px solid #e2e8f0;
  }
  .mawhba-card::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 6px;
    background: var(--course-color, #8b5cf6);
  }
  .mawhba-card-top {
    background: linear-gradient(135deg, var(--course-color, #8b5cf6) 0%, var(--course-color-dark, #0f172a) 100%);
    padding: 18px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: white;
  }
  .mawhba-card-brand { display: flex; align-items: center; gap: 10px; }
  .mawhba-card-logo {
    width: 40px; height: 40px;
    background: white;
    border-radius: 8px;
    padding: 4px;
    object-fit: contain;
  }
  .mawhba-card-fablab { font-size: 13px; font-weight: 800; line-height: 1.2; }
  .mawhba-card-fablab-en { font-size: 9px; letter-spacing: 1.4px; color: rgba(255,255,255,0.75); margin-top: 2px; }
  .mawhba-card-program { text-align: end; }
  .mawhba-card-program-ar {
    font-size: 19px;
    font-weight: 800;
    color: #ffffff;
    text-shadow: 0 1px 2px rgba(0,0,0,0.2);
  }
  .mawhba-card-program-en {
    font-size: 9px;
    letter-spacing: 2.5px;
    color: rgba(255,255,255,0.7);
    margin-top: 2px;
  }

  .mawhba-card-body { padding: 18px 20px 6px; }
  .mawhba-card-name {
    font-size: 21px;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.35;
    padding-bottom: 12px;
    border-bottom: 2px solid var(--course-color, #8b5cf6);
    margin-bottom: 14px;
    text-align: center;
  }
  .mawhba-card-field {
    margin-bottom: 10px;
  }
  .mawhba-card-field-label {
    font-size: 10px;
    letter-spacing: 1.3px;
    color: var(--course-color, #8b5cf6);
    font-weight: 800;
    margin-bottom: 3px;
  }
  .mawhba-card-field-value {
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
    word-break: break-word;
  }
  .mawhba-card-field-value.mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 14px;
    letter-spacing: 0.5px;
  }

  .mawhba-card-course {
    margin: 10px 20px 8px;
    background: var(--course-color, #8b5cf6);
    color: white;
    border-radius: 10px;
    padding: 10px 14px;
    text-align: center;
    box-shadow: 0 6px 14px -6px var(--course-color, #8b5cf6);
  }
  .mawhba-card-course-label {
    font-size: 10px;
    letter-spacing: 2px;
    color: rgba(255,255,255,0.85);
    font-weight: 700;
    margin-bottom: 3px;
  }
  .mawhba-card-course-name {
    font-size: 17px;
    font-weight: 800;
    color: white;
  }

  .mawhba-card-bottom {
    padding: 6px 20px 22px;
    text-align: center;
  }
  .mawhba-card-qr {
    width: 175px;
    height: 175px;
    display: block;
    margin: 0 auto;
    background: white;
    padding: 6px;
    border: 3px solid var(--course-color, #8b5cf6);
    border-radius: 14px;
  }
  .mawhba-card-qr-label {
    margin-top: 8px;
    font-size: 12px;
    letter-spacing: 2px;
    color: var(--course-color-dark, #0f172a);
    font-weight: 800;
    text-align: center;
  }
  .mawhba-card-footer-text {
    margin-top: 12px;
    font-size: 9px;
    color: #64748b;
    line-height: 1.5;
  }
  .mawhba-card-footer-text .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    margin-top: 2px;
    color: #334155;
    letter-spacing: 1px;
  }
`;

const buildCardPage = ({ cardHtml, autoPrint }) => `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>بطاقة موهبة</title>
<style>
  body {
    margin: 0;
    background: #f1f5f9;
    padding: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
  }
  ${CARD_CSS}
  @media print {
    body { background: white; padding: 0; gap: 0; }
    .mawhba-card { box-shadow: none; page-break-after: always; margin: 0 auto; }
    .mawhba-card:last-child { page-break-after: auto; }
  }
</style>
</head>
<body>
${cardHtml}
${autoPrint ? '<script>window.onload = function() { setTimeout(function(){ window.print(); }, 350); };</script>' : ''}
</body>
</html>`;

exports.cardData = async (req, res) => {
  try {
    const student = await MawhbaStudent.findByPk(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    const color = await getColorForCourse(student.courseName);
    const qrDataUrl = await QRCode.toDataURL(student.nationalId, {
      errorCorrectionLevel: 'M',
      margin: 0,
      width: 340,
      color: { dark: '#0f172a', light: '#ffffff' }
    });
    res.json({ student, qrDataUrl, color });
  } catch (err) {
    console.error('Mawhba cardData error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.cardsBulk = async (req, res) => {
  try {
    const { studentIds } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ message: 'No students provided' });
    }
    const students = await MawhbaStudent.findAll({
      where: { studentId: { [Op.in]: studentIds } }
    });
    const colorRows = await MawhbaCourseColor.findAll();
    const colorMap = Object.fromEntries(colorRows.map(r => [r.courseName, r.color]));
    const result = [];
    for (const s of students) {
      const qrDataUrl = await QRCode.toDataURL(s.nationalId, {
        errorCorrectionLevel: 'M', margin: 0, width: 340,
        color: { dark: '#0f172a', light: '#ffffff' }
      });
      result.push({
        student: s,
        qrDataUrl,
        color: colorMap[s.courseName] || DEFAULT_COURSE_COLOR
      });
    }
    res.json(result);
  } catch (err) {
    console.error('Mawhba cardsBulk error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const PUBLIC_LOGO_URL = process.env.PUBLIC_LOGO_URL || 'https://fablabsahsa.com/fablab.png';

// Bulletproof table-based card that survives Gmail / Outlook.
// All styles are inlined, no CSS variables, no <style> blocks, no flex/grid.
// qrSrc is a cid: reference (Gmail blocks data: URLs in <img>).
const buildIdCardEmailHtml = ({ student, qrSrc, logoSrc, color }) => {
  const name = (student.nameAr || student.nameEn || '').replace(/</g, '&lt;');
  const nid = (student.nationalId || '').replace(/</g, '&lt;');
  const guardian = (student.guardianPhone || student.studentPhone || '').replace(/</g, '&lt;');
  const course = (student.courseName || '').replace(/</g, '&lt;');
  const grade = (student.schoolGrade || '').replace(/</g, '&lt;');
  const c = color || DEFAULT_COURSE_COLOR;
  const cDark = darken(c, 0.55);
  const headerGradient = `linear-gradient(135deg, ${c} 0%, ${cDark} 100%)`;

  // helper row for stacked fields in the body
  const fieldRow = (label, value, mono) => `
    <tr>
      <td style="padding:0 20px 10px 20px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
        <div style="font-size:10px;letter-spacing:1.3px;color:${c};font-weight:800;margin-bottom:3px;">${label}</div>
        <div style="font-size:14px;font-weight:700;color:#0f172a;${mono ? "font-family:Consolas,'Courier New',monospace;letter-spacing:0.5px;" : ''}">${value || '—'}</div>
      </td>
    </tr>`;

  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" dir="rtl" style="width:360px;background:#ffffff;border-radius:18px;border:1px solid #e2e8f0;box-shadow:0 20px 40px -20px rgba(15,23,42,0.4);font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#0f172a;border-collapse:separate;overflow:hidden;">
    <!-- Header -->
    <tr>
      <td bgcolor="${c}" style="background-color:${c};background:${headerGradient};padding:18px 20px;color:#ffffff;" align="right">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td valign="middle" align="right" width="60%">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="right"><tr>
                <td valign="middle">
                  <img src="${logoSrc}" alt="FabLab" width="40" height="40" style="display:block;background:#ffffff;border-radius:8px;padding:4px;border:0;" />
                </td>
                <td valign="middle" style="padding-${dirSide()}:10px;">
                  <div style="font-size:13px;font-weight:800;line-height:1.2;color:#ffffff;">فاب لاب الأحساء</div>
                  <div style="font-size:9px;letter-spacing:1.4px;color:rgba(255,255,255,0.75);margin-top:2px;">FABLAB AL-AHSA</div>
                </td>
              </tr></table>
            </td>
            <td valign="middle" align="left" width="40%">
              <div style="font-size:19px;font-weight:800;color:#ffffff;text-shadow:0 1px 2px rgba(0,0,0,0.2);">برنامج موهبة</div>
              <div style="font-size:9px;letter-spacing:2.5px;color:rgba(255,255,255,0.7);margin-top:2px;">MAWHBA</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Student name -->
    <tr>
      <td align="center" style="padding:18px 20px 12px 20px;">
        <div style="font-size:21px;font-weight:800;color:#0f172a;line-height:1.35;padding-bottom:12px;border-bottom:2px solid ${c};text-align:center;">${name}</div>
      </td>
    </tr>

    ${fieldRow('رقم الهوية', nid, true)}
    ${fieldRow('رقم ولي الأمر', guardian, true)}
    ${grade ? fieldRow('الصف', grade, false) : ''}

    <!-- Course banner -->
    <tr>
      <td style="padding:8px 20px 8px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" bgcolor="${c}" style="background-color:${c};border-radius:10px;">
          <tr>
            <td align="center" style="padding:10px 14px;color:#ffffff;">
              <div style="font-size:10px;letter-spacing:2px;color:rgba(255,255,255,0.85);font-weight:700;margin-bottom:3px;">اسم الدورة</div>
              <div style="font-size:17px;font-weight:800;color:#ffffff;">${course || '—'}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- QR (forced white wrapper so Gmail / Outlook render solid white behind the code) -->
    <tr>
      <td align="center" style="padding:8px 20px 6px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"><tr>
          <td bgcolor="#ffffff" style="background-color:#ffffff;padding:14px;border-radius:14px;border:1px solid #e5e7eb;">
            <img src="${qrSrc}" width="175" height="175" alt="QR" style="display:block;background:#ffffff;" />
          </td>
        </tr></table>
      </td>
    </tr>

    <!-- Scan label -->
    <tr>
      <td align="center" style="padding:0 20px 14px 20px;">
        <div style="font-size:12px;letter-spacing:2px;color:${cDark};font-weight:800;">رمز الحضور</div>
      </td>
    </tr>

    <!-- Card footer text -->
    <tr>
      <td align="center" style="padding:0 20px 14px 20px;">
        <div style="font-size:9px;color:#64748b;line-height:1.5;">هذه البطاقة ملك لفاب لاب الأحساء — يرجى إعادتها عند الفقدان</div>
        <div style="font-family:Consolas,'Courier New',monospace;font-size:9px;color:#334155;letter-spacing:1px;margin-top:2px;">ID · ${nid}</div>
      </td>
    </tr>

    <!-- Bottom accent stripe -->
    <tr>
      <td bgcolor="${c}" style="background-color:${c};font-size:0;line-height:0;height:6px;">&nbsp;</td>
    </tr>
  </table>`;
};

// Small RTL helper — Arabic emails go right-to-left so logo padding goes on the left
function dirSide() { return 'left'; }

// Plain-text alternative — Gmail / Outlook show this in the inbox preview line
// and use it as a fallback. Keeping the visible top of the HTML version close to
// this same text prevents Gmail from collapsing the body behind a "…".
const buildEmailText = () => [
  'السلام عليكم ورحمة الله وبركاته،',
  '',
  'نرفق لك بطاقة الحضور الخاصة بك في برنامج موهبة بفاب لاب الأحساء.',
  '',
  'يرجى الالتزام بالتالي:',
  '• اطبع البطاقة بحجم مناسب وبجودة عالية على ورق صلب إن أمكن.',
  '• أحضرها معك يومياً عند الحضور للفاب لاب.',
  '• سيتم مسح رمز الحضور عند الدخول والخروج لتسجيل وقت حضورك آلياً.',
  '',
  'البطاقة مرفقة في أسفل الرسالة كصورة.',
  '',
  'شكراً لتعاونك،',
  'إدارة برنامج موهبة — فاب لاب الأحساء',
  '',
  '— Mawhba · FABLAB Al-Ahsa',
  'Please print your attached ID card, bring it daily, and use it to check in / out at the FabLab.'
].join('\n');

// HTML version: plain styled paragraphs FIRST, then the card. This gives
// Gmail real preview text and stops it from showing the body as "…".
const buildEmailWrap = (cardHtml) => `
  <div dir="rtl" style="font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#ffffff;padding:24px 18px;max-width:640px;margin:0 auto;color:#0f172a;line-height:1.85;">

    <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#0f172a;">
      السلام عليكم ورحمة الله وبركاته،
    </p>

    <p style="margin:0 0 14px;font-size:15px;color:#334155;">
      نرفق لك بطاقة الحضور الخاصة بك في برنامج <strong style="color:#0f172a;">موهبة</strong> بفاب لاب الأحساء.
    </p>

    <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#0f172a;">
      📌 يرجى الالتزام بالتالي:
    </p>
    <p style="margin:0 0 6px;font-size:15px;color:#475569;padding-inline-start:14px;">
      • <strong>اطبع البطاقة</strong> بحجم مناسب وبجودة عالية على ورق صلب إن أمكن.
    </p>
    <p style="margin:0 0 6px;font-size:15px;color:#475569;padding-inline-start:14px;">
      • <strong>أحضرها معك يومياً</strong> عند الحضور للفاب لاب.
    </p>
    <p style="margin:0 0 18px;font-size:15px;color:#475569;padding-inline-start:14px;">
      • سيتم <strong>مسح رمز الحضور</strong> عند الدخول والخروج من المركز لتسجيل وقت حضورك آلياً.
    </p>

    <p style="margin:0 0 22px;font-size:14px;color:#64748b;">
      شكراً لتعاونك،<br>
      <strong style="color:#0f172a;">إدارة برنامج موهبة — فاب لاب الأحساء</strong>
    </p>

    <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 22px;" />

    <p style="margin:0 0 12px;font-size:13px;color:#64748b;text-align:center;">
      بطاقتك أدناه — Your ID card below
    </p>

    <div style="text-align:center;margin:0 0 22px;">${cardHtml}</div>

    <p dir="ltr" style="margin:0;color:#94a3b8;font-size:11px;text-align:center;letter-spacing:0.8px;">
      FABLAB Al-Ahsa · Mawhba Program · Print the card, bring it every day, scan at entry &amp; exit.
    </p>
  </div>`;

const sendCardEmailFor = async (student, color) => {
  const sgMail = require('@sendgrid/mail');
  const qrBuffer = await QRCode.toBuffer(student.nationalId, {
    errorCorrectionLevel: 'M', margin: 0, width: 340, type: 'png',
    color: { dark: '#0f172a', light: '#ffffff' }
  });
  const qrCid = 'mawhba-qr-1';
  const cardHtml = buildIdCardEmailHtml({
    student,
    qrSrc: `cid:${qrCid}`,
    logoSrc: PUBLIC_LOGO_URL,
    color
  });
  const emailHtml = buildEmailWrap(cardHtml);
  await sgMail.send({
    to: student.email,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL,
      name: process.env.SENDGRID_FROM_NAME
    },
    subject: 'بطاقة موهبة الخاصة بك — Your Mawhba ID Card',
    text: buildEmailText(),
    html: emailHtml,
    attachments: [{
      content: qrBuffer.toString('base64'),
      filename: 'mawhba-qr.png',
      type: 'image/png',
      disposition: 'inline',
      content_id: qrCid
    }]
  });
};

exports.emailCard = async (req, res) => {
  try {
    const student = await MawhbaStudent.findByPk(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    if (!student.email) return res.status(400).json({ message: 'Student has no email on file' });

    const color = await getColorForCourse(student.courseName);
    await sendCardEmailFor(student, color);
    res.json({ message: 'Card emailed', to: student.email });
  } catch (err) {
    console.error('Mawhba emailCard error:', err?.response?.body || err);
    res.status(500).json({ message: 'Failed to send card', error: err.message });
  }
};

exports.emailCardsBulk = async (req, res) => {
  try {
    const { studentIds } = req.body || {};
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ message: 'No students selected' });
    }

    const students = await MawhbaStudent.findAll({
      where: { studentId: { [Op.in]: studentIds } }
    });
    const colorRows = await MawhbaCourseColor.findAll();
    const colorMap = Object.fromEntries(colorRows.map(r => [r.courseName, r.color]));

    let successCount = 0;
    let failCount = 0;
    const skippedNoEmail = [];
    const failures = [];

    for (const s of students) {
      if (!s.email) {
        skippedNoEmail.push(s.nameAr || s.nameEn || s.studentId);
        continue;
      }
      const color = colorMap[s.courseName] || DEFAULT_COURSE_COLOR;
      try {
        await sendCardEmailFor(s, color);
        successCount++;
      } catch (err) {
        failCount++;
        failures.push({ name: s.nameAr || s.nameEn, email: s.email, error: err?.message });
        console.error(`Mawhba bulk card send failed for ${s.email}:`, err?.response?.body || err);
      }
    }

    res.json({
      message: `Sent: ${successCount}, Failed: ${failCount}, Skipped (no email): ${skippedNoEmail.length}`,
      successCount,
      failCount,
      skippedNoEmail,
      failures: failures.slice(0, 5)
    });
  } catch (err) {
    console.error('Mawhba emailCardsBulk error:', err);
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

// Accepts a data URL ("data:image/jpeg;base64,...") or undefined.
// Returns { mime, base64 } or null if invalid.
const parseDataUrl = (dataUrl) => {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  return { mime: m[1], base64: m[2] };
};

const buildMawhbaEmailHtml = ({ studentName, subject, messageBody, hasPhoto }) => {
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
          ${safeName ? `<h2 style="margin:6px 0 22px;color:#0f172a;font-size:24px;font-weight:800;"><span style="background:linear-gradient(135deg,#8b5cf6,#ec4899);-webkit-background-clip:text;background-clip:text;color:transparent;">${safeName}</span></h2>` : ''}
          <div style="color:#1f2937;line-height:2.05;font-size:16px;font-weight:500;">
            ${safeBody}
          </div>
          ${hasPhoto ? `
          <div style="margin-top:22px;text-align:center;">
            <img src="cid:mawhba-photo-1" alt="" style="max-width:100%;height:auto;border-radius:12px;border:1px solid #e2e8f0;box-shadow:0 12px 28px -16px rgba(15,23,42,0.4);" />
          </div>` : ''}
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

const sendMawhbaEmail = async (student, subject, messageBody, photo) => {
  const sgMail = require('@sendgrid/mail');
  const html = buildMawhbaEmailHtml({
    studentName: student.nameAr || student.nameEn,
    subject,
    messageBody,
    hasPhoto: Boolean(photo)
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
  if (photo) {
    const ext = (photo.mime.split('/')[1] || 'jpg').toLowerCase();
    msg.attachments = [{
      content: photo.base64,
      filename: `photo.${ext}`,
      type: photo.mime,
      disposition: 'inline',
      content_id: 'mawhba-photo-1'
    }];
  }
  await sgMail.send(msg);
};

exports.sendEmail = async (req, res) => {
  try {
    const { studentIds, subject, message, photo: photoDataUrl } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ message: 'No students selected' });
    }
    if (!subject || !subject.trim()) return res.status(400).json({ message: 'Subject required' });
    if (!message || !message.trim()) return res.status(400).json({ message: 'Message required' });

    let photo = null;
    if (photoDataUrl) {
      photo = parseDataUrl(photoDataUrl);
      if (!photo) return res.status(400).json({ message: 'Photo must be a data URL like data:image/png;base64,...' });
      // SendGrid hard-caps a single message attachment at ~30 MB; we cap stricter for safety.
      const approxBytes = Math.floor((photo.base64.length * 3) / 4);
      if (approxBytes > 8 * 1024 * 1024) {
        return res.status(400).json({ message: 'Photo too large (max 8 MB)' });
      }
    }

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
        await sendMawhbaEmail(s, subject.trim(), message.trim(), photo);
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

// ───────────────── Attendance ─────────────────

// "today" is computed in the server's local TZ via YYYY-MM-DD
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

exports.scanAttendance = async (req, res) => {
  try {
    const raw = String(req.body?.code || '').trim();
    if (!raw) return res.status(400).json({ message: 'No code provided' });

    // The Mawhba QR encodes the student's national ID
    const student = await MawhbaStudent.findOne({ where: { nationalId: raw } });
    if (!student) return res.status(404).json({ message: 'No Mawhba student matches this code', code: raw });

    const date = todayStr();
    const now = new Date();
    let record = await MawhbaAttendance.findOne({ where: { studentId: student.studentId, date } });

    let action = null;
    const color = await getColorForCourse(student.courseName);
    if (!record) {
      record = await MawhbaAttendance.create({ studentId: student.studentId, date, checkInAt: now });
      action = 'checkin';
    } else if (!record.checkOutAt) {
      // require a small gap to avoid the same scan registering twice — 30 seconds
      const since = now.getTime() - new Date(record.checkInAt).getTime();
      if (since < 15 * 60 * 1000) {
        return res.json({ action: 'duplicate', student, record, color, message: 'Already checked in — please wait at least 15 minutes before checking out' });
      }
      await record.update({ checkOutAt: now });
      action = 'checkout';
    } else {
      return res.json({ action: 'already_done', student, record, color, message: 'Already checked in and out today' });
    }

    res.json({ action, student, record, color });
  } catch (err) {
    console.error('Mawhba scanAttendance error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.todayAttendance = async (req, res) => {
  try {
    const date = todayStr();
    const records = await MawhbaAttendance.findAll({
      where: { date },
      include: [{ model: MawhbaStudent, as: 'student', required: false }]
    });

    const colorRows = await MawhbaCourseColor.findAll();
    const colorMap = Object.fromEntries(colorRows.map(r => [r.courseName, r.color]));

    const events = [];
    const byCourse = new Map();
    for (const r of records) {
      const s = r.student || {};
      const color = colorMap[s.courseName] || DEFAULT_COURSE_COLOR;
      const courseKey = s.courseName || '—';
      const base = {
        attendanceId: r.attendanceId,
        studentId: r.studentId,
        name: s.nameAr || s.nameEn || '',
        course: s.courseName || '',
        color
      };
      if (r.checkInAt) events.push({ ...base, kind: 'checkin', at: r.checkInAt });
      if (r.checkOutAt) events.push({ ...base, kind: 'checkout', at: r.checkOutAt });

      if (!byCourse.has(courseKey)) {
        byCourse.set(courseKey, { course: courseKey, color, students: [] });
      }
      byCourse.get(courseKey).students.push({
        ...base,
        checkInAt: r.checkInAt,
        checkOutAt: r.checkOutAt,
        status: r.checkOutAt ? 'checked_out' : 'checked_in'
      });
    }
    events.sort((a, b) => new Date(b.at) - new Date(a.at));

    const groups = [...byCourse.values()];
    for (const g of groups) {
      g.students.sort((a, b) => {
        const at = new Date(b.checkOutAt || b.checkInAt || 0) - new Date(a.checkOutAt || a.checkInAt || 0);
        return at;
      });
    }
    groups.sort((a, b) => String(a.course).localeCompare(String(b.course), 'ar'));

    const checkins = events.filter(e => e.kind === 'checkin').length;
    const checkouts = events.filter(e => e.kind === 'checkout').length;
    res.json({ date, events, groups, stats: { checkins, checkouts } });
  } catch (err) {
    console.error('Mawhba todayAttendance error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.clearCheckout = async (req, res) => {
  try {
    const rec = await MawhbaAttendance.findByPk(req.params.id);
    if (!rec) return res.status(404).json({ message: 'Record not found' });
    if (!rec.checkOutAt) return res.status(400).json({ message: 'No check-out to clear' });
    await rec.update({ checkOutAt: null });
    res.json({ message: 'Check-out cleared', record: rec });
  } catch (err) {
    console.error('Mawhba clearCheckout error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.clearTodayAttendance = async (req, res) => {
  try {
    const date = todayStr();
    const count = await MawhbaAttendance.destroy({ where: { date } });
    res.json({ message: 'Today cleared', date, count });
  } catch (err) {
    console.error('Mawhba clearTodayAttendance error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.listStudentAttendance = async (req, res) => {
  try {
    const records = await MawhbaAttendance.findAll({
      where: { studentId: req.params.id },
      order: [['date', 'DESC'], ['checkInAt', 'DESC']]
    });
    res.json(records);
  } catch (err) {
    console.error('Mawhba listStudentAttendance error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.deleteAttendance = async (req, res) => {
  try {
    const rec = await MawhbaAttendance.findByPk(req.params.id);
    if (!rec) return res.status(404).json({ message: 'Record not found' });
    await rec.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Mawhba deleteAttendance error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const fmtTime = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
};

exports.exportAttendance = async (req, res) => {
  try {
    const { studentIds, from, to } = req.body || {};
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ message: 'No students selected' });
    }
    const where = { studentId: { [Op.in]: studentIds } };
    if (from) where.date = { ...(where.date || {}), [Op.gte]: from };
    if (to) where.date = { ...(where.date || {}), [Op.lte]: to };

    const records = await MawhbaAttendance.findAll({
      where,
      include: [{ model: MawhbaStudent, as: 'student', required: false }],
      order: [['date', 'ASC'], ['checkInAt', 'ASC']]
    });

    // Build TSV (Excel reads UTF-16 LE TSV natively as a workbook)
    const header = ['اسم الطالب', 'رقم الهوية', 'اسم الدورة', 'التاريخ', 'وقت الدخول', 'وقت الخروج', 'المدة (دقيقة)'];
    const lines = [header.join('\t')];
    for (const r of records) {
      const s = r.student || {};
      const minutes = r.checkInAt && r.checkOutAt
        ? Math.max(0, Math.round((new Date(r.checkOutAt) - new Date(r.checkInAt)) / 60000))
        : '';
      lines.push([
        s.nameAr || s.nameEn || '',
        s.nationalId || '',
        s.courseName || '',
        r.date || '',
        fmtTime(r.checkInAt),
        fmtTime(r.checkOutAt),
        minutes
      ].map(v => String(v ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ')).join('\t'));
    }

    const text = lines.join('\r\n');
    // UTF-16 LE BOM (Excel-friendly Arabic)
    const bom = Buffer.from([0xFF, 0xFE]);
    const body = Buffer.from(text, 'utf16le');
    const out = Buffer.concat([bom, body]);

    const today = todayStr();
    res.setHeader('Content-Type', 'text/csv; charset=utf-16le');
    res.setHeader('Content-Disposition', `attachment; filename="mawhba-attendance-${today}.csv"`);
    res.send(out);
  } catch (err) {
    console.error('Mawhba exportAttendance error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = exports;
