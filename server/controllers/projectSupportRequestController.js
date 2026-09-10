const crypto = require('crypto');
const path = require('path');
const sgMail = require('@sendgrid/mail');
const { Op } = require('sequelize');
const { ProjectSupportRequest } = require('../models');
const { sequelize } = require('../config/database');
const { archiveSentApproval, markArchiveDecided } = require('./approvalArchiveController');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Ops inbox that gets the "new request received" heads-up (same
// convention as FabLab visits + 3D print requests).
const OPS_NOTIFY_EMAIL = 'fablabspec@fablabsahsa.com';
// Response SLA the confirmation email promises the user. Also
// mentioned in the manager email + admin UI so it stays consistent.
const RESPONSE_SLA_DAYS = 5;
// Client-side caps are also enforced here to defend against a
// modified request bypassing the browser. Kept a bit above the
// client cap so a rounding difference doesn't reject valid submits.
const MAX_FILES = 10;
const MAX_FILE_BYTES = 12 * 1024 * 1024; // 12 MB base64 per file

const _publicOrigin = () =>
  process.env.PUBLIC_APP_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://fablabsahsa.com' : 'http://localhost:3000');

const _UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const _esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const formatRequestNumber = (n) => n == null ? '—' : `PSR-${String(n).padStart(3, '0')}`;
exports.formatRequestNumber = formatRequestNumber;

// Atomically assign the next sequential requestNumber.
const _assignNextNumber = async () => {
  return await sequelize.transaction(async (t) => {
    const [row] = await sequelize.query(
      `SELECT COALESCE(MAX("requestNumber"), 0) + 1 AS next FROM project_support_requests`,
      { transaction: t }
    );
    return Number(row?.[0]?.next) || 1;
  });
};

// Shared fire-and-forget mail send with unified logging so pm2 logs
// clearly show who got what.
const _sendMail = async (to, subject, html, text) => {
  if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
    console.warn(`⚠️  psr: SENDGRID not configured — skipping mail to ${to} (${subject})`);
    return false;
  }
  try {
    await sgMail.send({
      to,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL,
        name: process.env.SENDGRID_FROM_NAME || 'FABLAB Al-Ahsa'
      },
      subject,
      html,
      text: text || String(subject)
    });
    console.log(`✉️  psr mail sent to ${to}: ${subject}`);
    return true;
  } catch (err) {
    console.error(`❌ psr mail FAILED to ${to}:`, err?.response?.body || err.message);
    return false;
  }
};

// ─────────────── Email templates ───────────────

const _buildUserReceivedEmail = (row) => {
  const reqNo = formatRequestNumber(row.requestNumber);
  const brand = '#8b5cf6';
  return {
    subject: `تم استلام طلب الدعم — ${reqNo}`,
    text: `تم استلام طلبك ${reqNo}. سيتم الرد خلال ${RESPONSE_SLA_DAYS} أيام عمل.`,
    html: `<!doctype html><html dir="rtl"><body style="margin:0;font-family:Segoe UI,Tahoma,Arial,sans-serif;background:#f4f6fb;color:#0f172a;padding:24px">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.08)">
  <div style="background:linear-gradient(135deg,${brand},#6d28d9);color:#fff;padding:22px 26px">
    <div style="font-size:12px;letter-spacing:1.2px;opacity:0.85">FABLAB الأحساء · طلب دعم للمشروع</div>
    <div style="font-size:22px;font-weight:800;margin-top:4px">تم استلام طلبك ✓</div>
  </div>
  <div style="padding:24px 26px;font-size:14px;line-height:1.75">
    <p style="margin:0 0 14px">مرحباً <b>${_esc(row.firstName)}${row.lastName ? ' ' + _esc(row.lastName) : ''}</b>،</p>
    <p style="margin:0 0 14px">شكراً لتواصلك مع فاب لاب الأحساء. تم استلام طلب الدعم الخاص بمشروعك بنجاح، وسيتم مراجعته من قبل الإدارة والرد عليك في أقرب وقت.</p>
    <table style="width:100%;font-size:13px;border-collapse:collapse;background:#f8fafc;border-radius:10px;margin:12px 0;overflow:hidden">
      <tr><td style="padding:8px 14px;color:#64748b;width:150px">رقم الطلب:</td><td style="padding:8px 14px;font-weight:800;font-family:monospace;color:${brand}">${_esc(reqNo)}</td></tr>
      ${row.projectTitle ? `<tr><td style="padding:8px 14px;color:#64748b">المشروع:</td><td style="padding:8px 14px;font-weight:600">${_esc(row.projectTitle)}</td></tr>` : ''}
      ${row.supportType ? `<tr><td style="padding:8px 14px;color:#64748b">نوع الدعم:</td><td style="padding:8px 14px">${_esc(row.supportType)}</td></tr>` : ''}
      <tr><td style="padding:8px 14px;color:#64748b">عدد الملفات المرفقة:</td><td style="padding:8px 14px">${Array.isArray(row.files) ? row.files.length : 0}</td></tr>
    </table>
    <div style="background:#fef3c7;border-inline-start:4px solid #f59e0b;padding:14px 18px;border-radius:8px;margin:16px 0">
      <div style="font-weight:800;color:#92400e;margin-bottom:4px">⏳ موعد الرد</div>
      <div style="color:#78350f;font-size:13px;line-height:1.7">
        سيصلكم قرار الإدارة (قبول أو اعتذار) مع تعليقاتها خلال أقصى مدة <b>${RESPONSE_SLA_DAYS} أيام عمل</b> عبر هذا البريد الإلكتروني.
      </div>
    </div>
    <p style="margin:14px 0 0;font-size:13px;color:#475569">
      شكراً لاختياركم فاب لاب الأحساء شريكاً لمشروعكم.<br>
      فريق فاب لاب الأحساء
    </p>
  </div>
  <div style="background:#f8fafc;padding:12px 24px;font-size:11px;color:#94a3b8;text-align:center">
    فاب لاب الأحساء · مؤسسة عبدالمنعم الراشد الإنسانية
  </div>
</div>
</body></html>`
  };
};

const _buildOpsReceivedEmail = (row) => {
  const reqNo = formatRequestNumber(row.requestNumber);
  const fileCount = Array.isArray(row.files) ? row.files.length : 0;
  return {
    subject: `طلب دعم جديد ${reqNo} — ${row.firstName}${row.lastName ? ' ' + row.lastName : ''}`,
    text: `New project-support request ${reqNo} from ${row.firstName} — ${fileCount} file(s) attached.`,
    html: `<!doctype html><html dir="rtl"><body style="margin:0;font-family:Segoe UI,Tahoma,Arial,sans-serif;background:#f4f6fb;color:#0f172a;padding:24px">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.08)">
  <div style="background:linear-gradient(135deg,#EE2329,#c41e24);color:#fff;padding:22px 26px">
    <div style="font-size:12px;letter-spacing:1.2px;opacity:0.85">FABLAB الأحساء · دعم مشاريع</div>
    <div style="font-size:20px;font-weight:800;margin-top:4px">طلب دعم جديد ${_esc(reqNo)}</div>
  </div>
  <div style="padding:22px 26px;font-size:14px;line-height:1.7">
    <p style="margin:0 0 14px">وصل طلب دعم جديد بحاجة إلى مراجعتكم واعتماد المدير.</p>
    <table style="width:100%;font-size:13px;border-collapse:collapse;margin:0 0 16px">
      <tr><td style="padding:6px 0;color:#64748b;width:150px">مقدم الطلب:</td><td style="padding:6px 0;font-weight:700">${_esc(row.firstName)} ${_esc(row.lastName || '')}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">رقم الهوية:</td><td style="padding:6px 0" dir="ltr">${_esc(row.nationalId)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">الجوال:</td><td style="padding:6px 0" dir="ltr">${_esc(row.phoneNumber)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">البريد:</td><td style="padding:6px 0" dir="ltr">${_esc(row.email)}</td></tr>
      ${row.projectTitle ? `<tr><td style="padding:6px 0;color:#64748b">المشروع:</td><td style="padding:6px 0;font-weight:600">${_esc(row.projectTitle)}</td></tr>` : ''}
      ${row.supportType ? `<tr><td style="padding:6px 0;color:#64748b">نوع الدعم:</td><td style="padding:6px 0">${_esc(row.supportType)}</td></tr>` : ''}
      <tr><td style="padding:6px 0;color:#64748b;vertical-align:top">الوصف:</td><td style="padding:6px 0;white-space:pre-wrap">${_esc(row.description)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">مرفقات:</td><td style="padding:6px 0"><b>${fileCount}</b> ملف</td></tr>
    </table>
    <div style="text-align:center;margin-top:16px">
      <a href="${_publicOrigin()}/admin/dashboard?tab=project-support" style="display:inline-block;background:#EE2329;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:800">مراجعة الطلب</a>
    </div>
  </div>
  <div style="background:#f8fafc;padding:12px 24px;font-size:11px;color:#94a3b8;text-align:center">
    فاب لاب الأحساء · مؤسسة عبدالمنعم الراشد الإنسانية
  </div>
</div>
</body></html>`
  };
};

const _buildManagerEmail = ({ row, token, origin }) => {
  const reqNo = formatRequestNumber(row.requestNumber);
  const previewUrl = `${origin}/public/project-support/${token}`;
  const fileCount = Array.isArray(row.files) ? row.files.length : 0;
  return {
    subject: `طلب دعم مشروع ${reqNo} — يستدعي اعتمادكم`,
    text: `طلب دعم مشروع ${reqNo}. للاعتماد: ${previewUrl}`,
    html: `<!doctype html><html dir="rtl"><body style="margin:0;font-family:Segoe UI,Tahoma,Arial,sans-serif;background:#f4f6fb;color:#0f172a;padding:24px">
<div style="max-width:680px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 8px 30px -12px rgba(15,23,42,0.15)">
  <div style="background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;padding:24px 28px">
    <div style="font-size:12px;letter-spacing:1.4px;opacity:0.85;text-transform:uppercase">FABLAB الأحساء · طلب دعم مشروع</div>
    <div style="font-size:22px;font-weight:800;margin-top:6px">طلب دعم جديد يستدعي اعتمادكم</div>
    <div style="font-family:monospace;font-size:13px;letter-spacing:1.6px;background:rgba(255,255,255,0.2);display:inline-block;padding:4px 12px;border-radius:6px;margin-top:8px">${_esc(reqNo)}</div>
  </div>
  <div style="padding:22px 28px;font-size:14px;line-height:1.7">
    <p style="margin:0 0 14px">
      وصل طلب دعم من مستفيد يستدعي اعتمادكم. نأمل مراجعة التفاصيل والرد بالقبول أو الرفض مع ملاحظاتكم — التي سيتم إرسالها للمستفيد مباشرة.
    </p>
    <table style="width:100%;font-size:13px;border-collapse:collapse;background:#f8fafc;border-radius:10px;overflow:hidden;margin-bottom:16px">
      <tr><td style="padding:8px 14px;color:#64748b;width:150px">مقدم الطلب:</td><td style="padding:8px 14px;font-weight:700">${_esc(row.firstName)} ${_esc(row.lastName || '')}</td></tr>
      <tr><td style="padding:8px 14px;color:#64748b">الجوال / البريد:</td><td style="padding:8px 14px" dir="ltr">${_esc(row.phoneNumber)} · ${_esc(row.email)}</td></tr>
      ${row.projectTitle ? `<tr><td style="padding:8px 14px;color:#64748b">المشروع:</td><td style="padding:8px 14px;font-weight:600">${_esc(row.projectTitle)}</td></tr>` : ''}
      ${row.supportType ? `<tr><td style="padding:8px 14px;color:#64748b">نوع الدعم:</td><td style="padding:8px 14px">${_esc(row.supportType)}</td></tr>` : ''}
      <tr><td style="padding:8px 14px;color:#64748b;vertical-align:top">الوصف:</td><td style="padding:8px 14px;white-space:pre-wrap">${_esc(row.description)}</td></tr>
      <tr><td style="padding:8px 14px;color:#64748b">مرفقات:</td><td style="padding:8px 14px"><b>${fileCount}</b> ملف — يمكن تنزيلها من صفحة المراجعة</td></tr>
    </table>
    <div style="text-align:center;margin:24px 0 4px">
      <a href="${previewUrl}" style="display:inline-block;background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:800;box-shadow:0 10px 24px -8px rgba(139,92,246,0.5)">مراجعة الطلب واتخاذ القرار</a>
    </div>
    <p style="font-size:11.5px;color:#94a3b8;text-align:center;margin-top:14px">
      يمكنكم أيضاً الاعتماد مباشرة من لوحة الإدارة عبر تبويب "الاعتمادات".
    </p>
  </div>
  <div style="background:#f8fafc;padding:12px 24px;font-size:11px;color:#94a3b8;text-align:center;border-top:1px solid #e5e7eb">
    فاب لاب الأحساء · مؤسسة عبدالمنعم الراشد الإنسانية
  </div>
</div>
</body></html>`
  };
};

// The user's final decision email. Response = the manager's own text.
const _buildUserDecisionEmail = ({ row, accepted, response }) => {
  const reqNo = formatRequestNumber(row.requestNumber);
  const brand = accepted ? '#16a34a' : '#dc2626';
  const status = accepted ? 'تمت الموافقة على طلب الدعم' : 'اعتذار بخصوص طلب الدعم';
  return {
    subject: accepted
      ? `تمت الموافقة على طلب الدعم — ${reqNo}`
      : `اعتذار بخصوص طلب الدعم — ${reqNo}`,
    text: `${status} ${reqNo}\n\n${response || ''}`,
    html: `<!doctype html><html dir="rtl"><body style="margin:0;font-family:Segoe UI,Tahoma,Arial,sans-serif;background:#f4f6fb;color:#0f172a;padding:24px">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,0.10)">
  <div style="background:${brand};color:#fff;padding:22px 28px">
    <div style="font-size:12px;letter-spacing:1.2px;opacity:0.9">FABLAB الأحساء · طلب دعم مشروع</div>
    <div style="font-size:22px;font-weight:800;margin-top:6px">${_esc(status)}</div>
  </div>
  <div style="padding:24px 28px;font-size:14px;line-height:1.75">
    <p style="margin:0 0 12px">مرحباً <b>${_esc(row.firstName)}${row.lastName ? ' ' + _esc(row.lastName) : ''}</b>،</p>
    ${accepted ? `
      <p style="margin:0 0 14px">يسعدنا إعلامكم بأن طلب الدعم الخاص بمشروعكم قد <b>حصل على الموافقة</b> من إدارة فاب لاب الأحساء.</p>
    ` : `
      <p style="margin:0 0 14px">شكراً لتواصلكم مع فاب لاب الأحساء. للأسف لم نتمكن من قبول طلب الدعم في هذه المرحلة.</p>
    `}
    <table style="width:100%;font-size:13px;border-collapse:collapse;background:#f8fafc;border-radius:10px;overflow:hidden;margin:12px 0 18px">
      <tr><td style="padding:10px 14px;color:#64748b;width:140px">رقم الطلب:</td><td style="padding:10px 14px;font-weight:800;color:${brand};font-family:monospace">${_esc(reqNo)}</td></tr>
      ${row.projectTitle ? `<tr><td style="padding:10px 14px;color:#64748b">المشروع:</td><td style="padding:10px 14px;font-weight:700">${_esc(row.projectTitle)}</td></tr>` : ''}
      ${row.managerName ? `<tr><td style="padding:10px 14px;color:#64748b">اعتمد بواسطة:</td><td style="padding:10px 14px">${_esc(row.managerName)}</td></tr>` : ''}
    </table>
    ${response ? `
      <div style="background:${accepted ? '#ecfdf5' : '#fef2f2'};border-inline-start:4px solid ${brand};padding:14px 18px;border-radius:8px;margin:16px 0">
        <div style="font-size:12px;font-weight:800;color:${brand};margin-bottom:6px">💬 رد الإدارة</div>
        <div style="font-size:14px;color:#0f172a;white-space:pre-wrap;line-height:1.7">${_esc(response)}</div>
      </div>` : ''}
    <p style="margin:20px 0 0;color:#64748b;font-size:12.5px">
      شكراً لثقتكم بفاب لاب الأحساء.<br>
      فريق فاب لاب الأحساء
    </p>
  </div>
  <div style="background:#f8fafc;padding:12px 24px;font-size:11px;color:#94a3b8;text-align:center">
    فاب لاب الأحساء · مؤسسة عبدالمنعم الراشد الإنسانية
  </div>
</div>
</body></html>`
  };
};

// Shared helper: send the decision email to the user + record when.
const _sendUserDecisionEmail = async (row, { accepted, response }) => {
  if (!row?.email) return false;
  const mail = _buildUserDecisionEmail({ row, accepted, response });
  const ok = await _sendMail(row.email, mail.subject, mail.html, mail.text);
  if (ok) {
    await row.update({ userEmailSentAt: new Date() });
  }
  return ok;
};

// ─────────────── Validation ───────────────

const _sanitizeFiles = (input) => {
  if (!Array.isArray(input)) return [];
  return input.slice(0, MAX_FILES).map(f => ({
    fileName: String(f?.fileName || '').slice(0, 250),
    fileType: String(f?.fileType || '').toLowerCase().replace(/^\./, '').slice(0, 12),
    fileSize: Math.max(0, Number(f?.fileSize) || 0),
    fileData: f?.fileData ? String(f.fileData) : ''
  })).filter(f => f.fileName && f.fileData);
};

// ─────────────── Public: submit ───────────────

exports.publicCreate = async (req, res) => {
  try {
    const {
      firstName, lastName, sex, nationality, nationalId,
      phoneNumber, email, age, city,
      projectTitle, supportType, description,
      files
    } = req.body || {};

    if (!firstName || !nationalId || !phoneNumber || !email || !description) {
      return res.status(400).json({
        message: 'Missing required fields',
        messageAr: 'يرجى تعبئة الحقول المطلوبة (الاسم، الهوية، الجوال، البريد، الوصف)'
      });
    }
    if (String(description).trim().length < 20) {
      return res.status(400).json({
        message: 'Description too short',
        messageAr: 'وصف الطلب قصير جداً — يرجى إضافة تفاصيل أكثر (20 حرفاً على الأقل)'
      });
    }

    const cleanFiles = _sanitizeFiles(files);
    if (cleanFiles.length > MAX_FILES) {
      return res.status(400).json({
        message: `Max ${MAX_FILES} files`,
        messageAr: `الحد الأقصى ${MAX_FILES} ملفات`
      });
    }
    const oversized = cleanFiles.find(f => f.fileData.length > MAX_FILE_BYTES * 1.4);
    if (oversized) {
      return res.status(413).json({
        message: `File "${oversized.fileName}" exceeds the per-file cap`,
        messageAr: `الملف "${oversized.fileName}" أكبر من الحد المسموح لكل ملف (~${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB)`
      });
    }

    const requestNumber = await _assignNextNumber();

    const row = await ProjectSupportRequest.create({
      requestNumber,
      firstName: String(firstName).trim(),
      lastName: lastName ? String(lastName).trim() : null,
      sex: sex ? String(sex).trim() : null,
      nationality: nationality ? String(nationality).trim() : null,
      nationalId: String(nationalId).trim(),
      phoneNumber: String(phoneNumber).trim(),
      email: String(email).trim(),
      age: age ? Number(age) || null : null,
      city: city ? String(city).trim() : null,
      projectTitle: projectTitle ? String(projectTitle).trim() : null,
      supportType: supportType ? String(supportType).trim() : null,
      description: String(description).trim(),
      files: cleanFiles,
      approvalStatus: 'draft'
    });

    // Fire-and-forget confirmation email to the user + heads-up to
    // the ops inbox. Same pattern as fablab-visit publicCreate.
    (async () => {
      const userMail = _buildUserReceivedEmail(row);
      _sendMail(row.email, userMail.subject, userMail.html, userMail.text);
      const opsMail = _buildOpsReceivedEmail(row);
      _sendMail(OPS_NOTIFY_EMAIL, opsMail.subject, opsMail.html, opsMail.text);
    })();

    // Strip file blobs from the response — the client only needs to
    // know the request was accepted.
    const stripped = row.toJSON();
    stripped.files = (stripped.files || []).map(f => ({ ...f, fileData: undefined }));
    res.status(201).json({
      message: 'Request received',
      messageAr: 'تم استلام طلبك بنجاح',
      requestNumber: formatRequestNumber(row.requestNumber),
      request: stripped
    });
  } catch (err) {
    console.error('psr publicCreate:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

// ─────────────── Admin: list / detail / delete ───────────────

exports.list = async (req, res) => {
  try {
    const { status, search } = req.query || {};
    const where = {};
    if (status) where.approvalStatus = status;
    if (search && String(search).trim()) {
      const like = `%${String(search).trim()}%`;
      where[Op.or] = [
        { firstName: { [Op.iLike]: like } },
        { lastName: { [Op.iLike]: like } },
        { projectTitle: { [Op.iLike]: like } },
        { email: { [Op.iLike]: like } },
        { phoneNumber: { [Op.iLike]: like } },
        { nationalId: { [Op.iLike]: like } }
      ];
    }
    const rows = await ProjectSupportRequest.findAll({
      where,
      order: [['createdAt', 'DESC']],
      // Strip file blobs from the LIST to keep it fast; detail
      // endpoint returns them.
      attributes: { exclude: ['files'] }
    });
    // Attach file count derived from the excluded column via a
    // separate raw query so the list doesn't lie about attachments.
    const ids = rows.map(r => r.requestId);
    const counts = ids.length > 0
      ? await sequelize.query(
          `SELECT "requestId", COALESCE(jsonb_array_length(files::jsonb), 0) AS n
             FROM project_support_requests
            WHERE "requestId" IN (:ids)`,
          { replacements: { ids }, type: sequelize.QueryTypes.SELECT }
        )
      : [];
    const countByRid = Object.fromEntries(counts.map(c => [c.requestId, Number(c.n) || 0]));
    res.json(rows.map(r => {
      const j = r.toJSON();
      j.fileCount = countByRid[j.requestId] || 0;
      return j;
    }));
  } catch (err) {
    console.error('psr list:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.get = async (req, res) => {
  try {
    const row = await ProjectSupportRequest.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    res.json(row);
  } catch (err) {
    console.error('psr get:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /project-support/:id/files/:index — download a single file.
// Kept as its own endpoint so the admin UI can pull heavy blobs on
// demand instead of loading them upfront.
exports.downloadFile = async (req, res) => {
  try {
    const row = await ProjectSupportRequest.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    const idx = parseInt(req.params.index, 10);
    const file = Array.isArray(row.files) ? row.files[idx] : null;
    if (!file || !file.fileData) return res.status(404).json({ message: 'File not found' });
    res.json({
      fileName: file.fileName,
      fileType: file.fileType,
      fileSize: file.fileSize,
      fileData: file.fileData
    });
  } catch (err) {
    console.error('psr downloadFile:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.remove = async (req, res) => {
  try {
    const row = await ProjectSupportRequest.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    await row.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('psr remove:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────── Admin: send for approval ───────────────

exports.sendForApproval = async (req, res) => {
  try {
    const row = await ProjectSupportRequest.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });

    const managerEmail = String(req.body?.managerEmail || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(managerEmail)) {
      return res.status(400).json({
        message: 'Valid manager email required',
        messageAr: 'بريد المدير مطلوب'
      });
    }

    const token = crypto.randomUUID();
    await row.update({
      approvalStatus: 'pending',
      approvalToken: token,
      managerEmail,
      sentForApprovalAt: new Date(),
      approvedAt: null,
      rejectedAt: null,
      managerResponse: null,
      managerName: null
    });

    let archivedEmailHtml = null;
    let archivedSubject = null;
    if (!process.env.SENDGRID_API_KEY) {
      console.warn(`⚠️  psr approval: SENDGRID_API_KEY not set — manager ${managerEmail} will NOT receive the email`);
    }
    if (process.env.SENDGRID_API_KEY) {
      const mail = _buildManagerEmail({ row, token, origin: _publicOrigin() });
      archivedEmailHtml = mail.html;
      archivedSubject = mail.subject;
      const ok = await _sendMail(managerEmail, mail.subject, mail.html, mail.text);
      if (!ok) {
        // Still archive so admin can retry from the archive UI.
        if (archivedEmailHtml) {
          archiveSentApproval({
            type: 'project_support',
            sourceId: row.requestId,
            requestNumber: formatRequestNumber(row.requestNumber),
            title: row.projectTitle || `${row.firstName} ${row.lastName || ''}`.trim(),
            managerEmail,
            subject: archivedSubject,
            emailHtml: archivedEmailHtml,
            payloadSnapshot: row.toJSON(),
            sentById: req.admin?.adminId || null
          });
        }
        return res.json({
          message: 'Marked pending — email delivery failed, try resending',
          messageAr: 'تم حفظ الطلب — فشل إرسال البريد للمدير، حاول إعادة الإرسال',
          row,
          emailFailed: true
        });
      }
    }

    if (archivedEmailHtml) {
      archiveSentApproval({
        type: 'project_support',
        sourceId: row.requestId,
        requestNumber: formatRequestNumber(row.requestNumber),
        title: row.projectTitle || `${row.firstName} ${row.lastName || ''}`.trim(),
        managerEmail,
        subject: archivedSubject,
        emailHtml: archivedEmailHtml,
        payloadSnapshot: row.toJSON(),
        sentById: req.admin?.adminId || null
      });
    }

    res.json({ message: 'Sent for approval', row });
  } catch (err) {
    console.error('psr sendForApproval:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

// ─────────────── Manager dashboard: pending queue + decide ───────────────

exports.listPending = async (req, res) => {
  try {
    const rows = await ProjectSupportRequest.findAll({
      where: { approvalStatus: 'pending' },
      order: [['sentForApprovalAt', 'DESC']],
      attributes: { exclude: ['files'] }
    });
    res.json(rows);
  } catch (err) {
    console.error('psr listPending:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const DEFAULT_MANAGER_NAME = 'أ. زكي اللويم';

exports.managerApprove = async (req, res) => {
  try {
    const row = await ProjectSupportRequest.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    if (row.approvalStatus === 'approved') return res.status(409).json({ message: 'Already approved' });

    const response = req.body?.response ? String(req.body.response).trim() : null;
    const managerName = req.body?.managerName
      ? String(req.body.managerName).trim()
      : (row.managerName || DEFAULT_MANAGER_NAME);

    await row.update({
      approvalStatus: 'approved',
      approvedAt: new Date(),
      rejectedAt: null,
      managerResponse: response,
      managerName,
      approvalToken: null
    });

    // Auto-email the user with the manager's response.
    _sendUserDecisionEmail(row, { accepted: true, response }).catch(() => {});
    markArchiveDecided({
      type: 'project_support',
      sourceId: row.requestId,
      status: 'approved',
      managerName
    });

    res.json({ message: 'Approved', row });
  } catch (err) {
    console.error('psr managerApprove:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.managerReject = async (req, res) => {
  try {
    const row = await ProjectSupportRequest.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });

    const response = req.body?.response ? String(req.body.response).trim() : null;
    const managerName = req.body?.managerName
      ? String(req.body.managerName).trim()
      : (row.managerName || DEFAULT_MANAGER_NAME);

    await row.update({
      approvalStatus: 'rejected',
      rejectedAt: new Date(),
      approvedAt: null,
      managerResponse: response,
      managerName,
      approvalToken: null
    });

    _sendUserDecisionEmail(row, { accepted: false, response }).catch(() => {});
    markArchiveDecided({
      type: 'project_support',
      sourceId: row.requestId,
      status: 'rejected',
      managerName
    });

    res.json({ message: 'Rejected', row });
  } catch (err) {
    console.error('psr managerReject:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────── Public token flow (manager email link) ───────────────

exports.publicGetByToken = async (req, res) => {
  try {
    const token = req.params.token;
    if (!token || !_UUID_RE.test(token)) return res.status(404).json({ message: 'Not found' });
    const row = await ProjectSupportRequest.findOne({ where: { approvalToken: token } });
    if (!row) return res.status(404).json({ message: 'Not found' });
    // Return metadata WITHOUT the full file blobs — the manager page
    // shows file name / size / type and offers per-file download via
    // /public/project-support/:token/file/:index.
    const j = row.toJSON();
    j.files = (j.files || []).map((f, i) => ({
      index: i,
      fileName: f.fileName,
      fileType: f.fileType,
      fileSize: f.fileSize
    }));
    res.json(j);
  } catch (err) {
    console.error('psr publicGetByToken:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.publicDownloadFile = async (req, res) => {
  try {
    const token = req.params.token;
    if (!token || !_UUID_RE.test(token)) return res.status(404).json({ message: 'Not found' });
    const row = await ProjectSupportRequest.findOne({ where: { approvalToken: token } });
    if (!row) return res.status(404).json({ message: 'Not found' });
    const idx = parseInt(req.params.index, 10);
    const file = Array.isArray(row.files) ? row.files[idx] : null;
    if (!file || !file.fileData) return res.status(404).json({ message: 'File not found' });
    res.json({
      fileName: file.fileName,
      fileType: file.fileType,
      fileSize: file.fileSize,
      fileData: file.fileData
    });
  } catch (err) {
    console.error('psr publicDownloadFile:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.publicDecide = async (req, res) => {
  try {
    const token = req.params.token;
    if (!token || !_UUID_RE.test(token)) return res.status(404).json({ message: 'Not found' });
    const row = await ProjectSupportRequest.findOne({ where: { approvalToken: token } });
    if (!row) return res.status(404).json({ message: 'Not found' });

    const decision = String(req.body?.decision || '').trim();
    if (decision !== 'approve' && decision !== 'reject') {
      return res.status(400).json({ message: 'decision must be approve or reject' });
    }
    const response = req.body?.response ? String(req.body.response).trim() : null;
    const managerName = req.body?.managerName
      ? String(req.body.managerName).trim()
      : (row.managerName || DEFAULT_MANAGER_NAME);

    if (decision === 'approve') {
      if (row.approvalStatus === 'approved') return res.json({ message: 'Already approved', row });
      await row.update({
        approvalStatus: 'approved',
        approvedAt: new Date(),
        rejectedAt: null,
        managerResponse: response,
        managerName
      });
    } else {
      await row.update({
        approvalStatus: 'rejected',
        rejectedAt: new Date(),
        approvedAt: null,
        managerResponse: response,
        managerName
      });
    }
    await row.update({ approvalToken: null });

    _sendUserDecisionEmail(row, { accepted: decision === 'approve', response }).catch(() => {});
    markArchiveDecided({
      type: 'project_support',
      sourceId: row.requestId,
      status: decision === 'approve' ? 'approved' : 'rejected',
      managerName
    });

    res.json({ message: decision === 'approve' ? 'Approved' : 'Rejected', row });
  } catch (err) {
    console.error('psr publicDecide:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─────────────── Admin: manual re-notify ───────────────

// POST /project-support/:id/notify-user — admin sends the user a
// follow-up email with their own message. Only allowed after the
// manager has decided.
exports.notifyUser = async (req, res) => {
  try {
    const row = await ProjectSupportRequest.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    if (row.approvalStatus !== 'approved' && row.approvalStatus !== 'rejected') {
      return res.status(409).json({
        message: 'Manager decision required first',
        messageAr: 'يجب الحصول على قرار المدير أولاً'
      });
    }
    const response = req.body?.response ? String(req.body.response).trim() : row.managerResponse;
    const ok = await _sendUserDecisionEmail(row, {
      accepted: row.approvalStatus === 'approved',
      response
    });
    res.json({ message: ok ? 'User notified' : 'Send failed', emailSent: ok });
  } catch (err) {
    console.error('psr notifyUser:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
