const { FablabVisit } = require('../models');
const crypto = require('crypto');
const sgMail = require('@sendgrid/mail');
if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const _UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const _publicOrigin = () =>
  process.env.PUBLIC_APP_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://fablabsahsa.com' : 'http://localhost:3000');

// -------------------- LIST / CRUD --------------------

// Public — no auth required. Anyone can submit a visit request.
exports.publicCreate = async (req, res) => {
  try {
    const {
      entityName, personInCharge, nationalId, phone, email,
      visitorsCount, visitDate, visitStartTime, visitEndTime,
      purpose, notes
    } = req.body || {};

    // Minimal server-side validation. Front-end enforces details.
    if (!entityName || !personInCharge || !phone || !email
        || !visitDate || !visitStartTime || !visitEndTime || !purpose) {
      return res.status(400).json({
        message: 'Missing required fields',
        messageAr: 'الرجاء تعبئة جميع الحقول المطلوبة'
      });
    }

    const row = await FablabVisit.create({
      entityName: String(entityName).trim(),
      personInCharge: String(personInCharge).trim(),
      nationalId: nationalId ? String(nationalId).trim() : null,
      phone: String(phone).trim(),
      email: String(email).trim(),
      visitorsCount: Number(visitorsCount) > 0 ? Number(visitorsCount) : 1,
      visitDate,
      visitStartTime,
      visitEndTime,
      purpose: String(purpose).trim(),
      notes: notes ? String(notes).trim() : null,
      approvalStatus: 'draft',
      visitorDecision: 'pending'
    });

    res.status(201).json({
      message: 'Request submitted',
      messageAr: 'تم استلام طلبك — سيتم التواصل معك قريباً',
      visitId: row.visitId
    });
  } catch (err) {
    console.error('publicCreate visit:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

// Admin-only from here down.

exports.list = async (req, res) => {
  try {
    const rows = await FablabVisit.findAll({ order: [['createdAt', 'DESC']] });
    res.json(rows);
  } catch (err) {
    console.error('list visits:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.get = async (req, res) => {
  try {
    const row = await FablabVisit.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    res.json(row);
  } catch (err) {
    console.error('get visit:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await FablabVisit.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });

    // Once out for approval, don't let admin edit the underlying request.
    if (row.approvalStatus === 'pending' || row.approvalStatus === 'approved') {
      return res.status(409).json({
        message: 'Request is out for approval — cannot edit',
        messageAr: 'الطلب قيد الاعتماد — لا يمكن التعديل'
      });
    }
    const payload = { ...req.body };
    // Strip admin-managed fields
    delete payload.approvalStatus;
    delete payload.approvalToken;
    delete payload.sentForApprovalAt;
    delete payload.approvedAt;
    delete payload.rejectedAt;
    delete payload.managerNote;
    delete payload.managerName;
    delete payload.visitorDecision;
    delete payload.visitorDecisionAt;
    delete payload.visitorDecisionBy;
    delete payload.visitorEmailSentAt;
    await row.update(payload);
    res.json(row);
  } catch (err) {
    console.error('update visit:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.remove = async (req, res) => {
  try {
    const row = await FablabVisit.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    await row.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('remove visit:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// -------------------- MANAGER APPROVAL FLOW --------------------

const _buildManagerEmail = ({ row, token, origin }) => {
  const previewUrl = `${origin}/public/fablab-visit/${token}`;
  const fmtTime = (t) => t ? String(t).slice(0, 5) : '—';

  return {
    subject: `طلب اعتماد زيارة فاب لاب — ${row.entityName}`,
    html: `<!doctype html><html dir="rtl"><body style="margin:0;font-family:Segoe UI,Tahoma,Arial,sans-serif;background:#f4f6fb;color:#0f172a;padding:24px">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.08)">
  <div style="background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;padding:20px 24px">
    <div style="font-size:12px;letter-spacing:1px;opacity:0.85">FABLAB الأحساء</div>
    <div style="font-size:20px;font-weight:800;margin-top:4px">طلب اعتماد زيارة</div>
  </div>
  <div style="padding:20px 24px">
    <p style="margin:0 0 14px;font-size:14px;line-height:1.7">
      تم استلام طلب زيارة جديد بحاجة إلى اعتمادكم:
    </p>
    <table style="width:100%;font-size:13px;border-collapse:collapse;margin-bottom:16px">
      <tr><td style="padding:6px 0;color:#64748b;width:140px">الجهة:</td><td style="padding:6px 0;font-weight:700">${row.entityName}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">الشخص المسؤول:</td><td style="padding:6px 0">${row.personInCharge}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">الجوال:</td><td style="padding:6px 0;direction:ltr">${row.phone}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">البريد:</td><td style="padding:6px 0;direction:ltr">${row.email}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">عدد الزوار:</td><td style="padding:6px 0">${row.visitorsCount || 1}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">تاريخ الزيارة:</td><td style="padding:6px 0;direction:ltr">${row.visitDate}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">الوقت:</td><td style="padding:6px 0;direction:ltr">${fmtTime(row.visitStartTime)} → ${fmtTime(row.visitEndTime)}</td></tr>
    </table>

    <div style="background:#f8fafc;padding:12px 14px;border-radius:8px;font-size:13px;color:#334155;margin-bottom:16px">
      <div style="font-weight:700;color:#0369a1;margin-bottom:4px">الغرض من الزيارة</div>
      <div style="white-space:pre-wrap">${row.purpose}</div>
    </div>

    ${row.notes ? `<div style="background:#f8fafc;padding:10px 12px;border-radius:8px;font-size:13px;color:#334155;margin-bottom:16px"><b>ملاحظات:</b> ${row.notes}</div>` : ''}

    <div style="text-align:center;margin:24px 0 12px">
      <a href="${previewUrl}?decision=approve" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:800;margin:0 6px">✓ اعتماد</a>
      <a href="${previewUrl}?decision=reject" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:800;margin:0 6px">✕ رفض</a>
    </div>
    <div style="text-align:center;margin-top:8px">
      <a href="${previewUrl}" style="color:#0284c7;font-size:12px">عرض التفاصيل الكاملة</a>
    </div>
  </div>
  <div style="background:#f8fafc;padding:12px 24px;font-size:11px;color:#94a3b8;text-align:center">
    فاب لاب الأحساء · مؤسسة عبدالمنعم الراشد الإنسانية
  </div>
</div>
</body></html>`,
    text: `طلب اعتماد زيارة فاب لاب

الجهة: ${row.entityName}
الشخص المسؤول: ${row.personInCharge}
تاريخ الزيارة: ${row.visitDate}  ${fmtTime(row.visitStartTime)} - ${fmtTime(row.visitEndTime)}
عدد الزوار: ${row.visitorsCount || 1}

الغرض:
${row.purpose}

للاعتماد أو الرفض:
${previewUrl}`
  };
};

// POST /fablab-visits/:id/send-for-approval — body { managerEmail }
exports.sendForApproval = async (req, res) => {
  try {
    const row = await FablabVisit.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });

    const managerEmail = String(req.body?.managerEmail || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(managerEmail)) {
      return res.status(400).json({
        message: 'Valid manager email required',
        messageAr: 'بريد المدير مطلوب'
      });
    }

    if (row.approvalStatus === 'approved' && row.visitorDecision !== 'pending') {
      return res.status(409).json({
        message: 'Visit already decided',
        messageAr: 'الطلب تم البت فيه مسبقاً'
      });
    }

    // Fresh token every send so an old link can't revive a superseded request.
    const token = crypto.randomUUID();
    await row.update({
      approvalStatus: 'pending',
      approvalToken: token,
      managerEmail,
      sentForApprovalAt: new Date(),
      approvedAt: null,
      rejectedAt: null,
      managerNote: null,
      managerName: null
    });

    if (process.env.SENDGRID_API_KEY) {
      try {
        const mail = _buildManagerEmail({ row, token, origin: _publicOrigin() });
        await sgMail.send({
          from: {
            email: process.env.SENDGRID_FROM_EMAIL,
            name: process.env.SENDGRID_FROM_NAME || 'FABLAB Al-Ahsa'
          },
          to: managerEmail,
          subject: mail.subject,
          html: mail.html,
          text: mail.text
        });
      } catch (mailErr) {
        console.error('visit approval email failed:', mailErr?.response?.body || mailErr);
        return res.json({
          message: 'Marked pending — email delivery failed, try resending',
          messageAr: 'تم إرسال الطلب — فشل إرسال البريد، حاول إعادة الإرسال',
          row,
          emailFailed: true
        });
      }
    }

    res.json({ message: 'Sent for approval', row });
  } catch (err) {
    console.error('sendForApproval visit:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

// -------------------- PUBLIC MANAGER APPROVAL --------------------

// GET /public/fablab-visit/:token
exports.publicGetByToken = async (req, res) => {
  try {
    const token = req.params.token;
    if (!token || !_UUID_RE.test(token)) return res.status(404).json({ message: 'Not found' });
    const row = await FablabVisit.findOne({ where: { approvalToken: token } });
    if (!row) return res.status(404).json({ message: 'Not found' });
    res.json({
      visitId: row.visitId,
      approvalStatus: row.approvalStatus,
      entityName: row.entityName,
      personInCharge: row.personInCharge,
      phone: row.phone,
      email: row.email,
      visitorsCount: row.visitorsCount,
      visitDate: row.visitDate,
      visitStartTime: row.visitStartTime,
      visitEndTime: row.visitEndTime,
      purpose: row.purpose,
      notes: row.notes,
      managerName: row.managerName,
      managerNote: row.managerNote,
      approvedAt: row.approvedAt,
      rejectedAt: row.rejectedAt
    });
  } catch (err) {
    console.error('publicGetByToken visit:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /public/fablab-visit/:token/decide — body { decision, managerName, note? }
exports.publicDecide = async (req, res) => {
  try {
    const token = req.params.token;
    if (!token || !_UUID_RE.test(token)) return res.status(404).json({ message: 'Not found' });
    const row = await FablabVisit.findOne({ where: { approvalToken: token } });
    if (!row) return res.status(404).json({ message: 'Not found' });

    const decision = String(req.body?.decision || '').trim();
    if (decision !== 'approve' && decision !== 'reject') {
      return res.status(400).json({ message: 'decision must be approve or reject' });
    }

    if (decision === 'approve') {
      if (row.approvalStatus === 'approved') return res.json({ message: 'Already approved', row });
      await row.update({
        approvalStatus: 'approved',
        approvedAt: new Date(),
        rejectedAt: null,
        managerNote: req.body?.note ? String(req.body.note).trim() : null,
        managerName: req.body?.managerName ? String(req.body.managerName).trim() : row.managerName
      });
    } else {
      await row.update({
        approvalStatus: 'rejected',
        rejectedAt: new Date(),
        approvedAt: null,
        managerNote: req.body?.note ? String(req.body.note).trim() : null,
        managerName: req.body?.managerName ? String(req.body.managerName).trim() : row.managerName
      });
    }
    await row.update({ approvalToken: null });

    res.json({ message: decision === 'approve' ? 'Approved' : 'Rejected', row });
  } catch (err) {
    console.error('publicDecide visit:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// -------------------- ADMIN: FINAL DECISION TO VISITOR --------------------

const _buildVisitorEmail = ({ row, accepted, customMessage }) => {
  const fmtTime = (t) => t ? String(t).slice(0, 5) : '—';
  const brand = accepted ? '#16a34a' : '#dc2626';
  const status = accepted ? 'تمت الموافقة على زيارتكم' : 'نأسف — لم نتمكن من قبول الزيارة';

  return {
    subject: accepted
      ? `تمت الموافقة على زيارتكم لفاب لاب — ${row.visitDate}`
      : `اعتذار بخصوص طلب زيارة فاب لاب`,
    html: `<!doctype html><html dir="rtl"><body style="margin:0;font-family:Segoe UI,Tahoma,Arial,sans-serif;background:#f4f6fb;color:#0f172a;padding:24px">
<div style="max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.08)">
  <div style="background:${brand};color:#fff;padding:22px 24px">
    <div style="font-size:12px;letter-spacing:1px;opacity:0.85">FABLAB الأحساء</div>
    <div style="font-size:22px;font-weight:800;margin-top:6px">${status}</div>
  </div>
  <div style="padding:22px 24px">
    <p style="margin:0 0 12px;font-size:14px;line-height:1.75">
      مرحباً ${row.personInCharge}،
    </p>
    ${accepted ? `
      <p style="margin:0 0 14px;font-size:14px;line-height:1.75">
        يسعدنا إعلامكم بأنه قد تم قبول طلب زيارتكم لفاب لاب الأحساء بالتفاصيل التالية:
      </p>
    ` : `
      <p style="margin:0 0 14px;font-size:14px;line-height:1.75">
        نشكركم على اهتمامكم بفاب لاب الأحساء. للأسف لم نتمكن من قبول طلب زيارتكم في التاريخ المطلوب.
      </p>
    `}

    <table style="width:100%;font-size:13px;border-collapse:collapse;background:#f8fafc;border-radius:10px;overflow:hidden;margin:12px 0 18px">
      <tr><td style="padding:10px 14px;color:#64748b;width:130px;border-bottom:1px solid #e5e7eb">الجهة:</td><td style="padding:10px 14px;font-weight:700;border-bottom:1px solid #e5e7eb">${row.entityName}</td></tr>
      <tr><td style="padding:10px 14px;color:#64748b;border-bottom:1px solid #e5e7eb">تاريخ الزيارة:</td><td style="padding:10px 14px;direction:ltr;border-bottom:1px solid #e5e7eb">${row.visitDate}</td></tr>
      <tr><td style="padding:10px 14px;color:#64748b;border-bottom:1px solid #e5e7eb">الوقت:</td><td style="padding:10px 14px;direction:ltr;border-bottom:1px solid #e5e7eb">${fmtTime(row.visitStartTime)} → ${fmtTime(row.visitEndTime)}</td></tr>
      <tr><td style="padding:10px 14px;color:#64748b">عدد الزوار:</td><td style="padding:10px 14px">${row.visitorsCount || 1}</td></tr>
    </table>

    ${customMessage ? `
      <div style="background:#eff6ff;padding:12px 14px;border-radius:8px;font-size:13px;color:#1e3a8a;margin-bottom:16px;border-inline-start:3px solid #3b82f6">
        <div style="font-weight:700;margin-bottom:4px">رسالة من الإدارة</div>
        <div style="white-space:pre-wrap">${customMessage}</div>
      </div>
    ` : ''}

    ${accepted ? `
      <div style="background:#ecfdf5;padding:12px 14px;border-radius:8px;font-size:13px;color:#166534;margin-top:12px;line-height:1.7">
        <div style="font-weight:700;margin-bottom:4px">تعليمات مهمة قبل الزيارة</div>
        · يرجى الحضور قبل الموعد بـ 10 دقائق.<br>
        · إحضار الهوية الشخصية.<br>
        · الالتزام بضوابط السلامة داخل المختبر.
      </div>
    ` : `
      <p style="margin:14px 0 0;font-size:13px;line-height:1.75;color:#334155">
        نرحّب بكم لتقديم طلب جديد في تاريخ آخر عبر بوابة التسجيل: <a href="${_publicOrigin()}/fablab-visit" style="color:${brand};font-weight:700">${_publicOrigin()}/fablab-visit</a>
      </p>
    `}

    <p style="margin:20px 0 0;font-size:13px;color:#64748b">
      لأي استفسار، يمكنكم التواصل معنا مباشرة.<br>
      فريق فاب لاب الأحساء
    </p>
  </div>
  <div style="background:#f8fafc;padding:12px 24px;font-size:11px;color:#94a3b8;text-align:center">
    فاب لاب الأحساء · مؤسسة عبدالمنعم الراشد الإنسانية
  </div>
</div>
</body></html>`,
    text: `${status}

الجهة: ${row.entityName}
تاريخ الزيارة: ${row.visitDate} ${fmtTime(row.visitStartTime)} - ${fmtTime(row.visitEndTime)}
عدد الزوار: ${row.visitorsCount || 1}
${customMessage ? '\nرسالة من الإدارة:\n' + customMessage + '\n' : ''}
فاب لاب الأحساء`
  };
};

// POST /fablab-visits/:id/notify-visitor — body { decision: 'accept'|'reject', message? }
// Admin-only. Requires manager approval already granted (approvalStatus === 'approved').
exports.notifyVisitor = async (req, res) => {
  try {
    const row = await FablabVisit.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });

    const decision = String(req.body?.decision || '').trim();
    if (decision !== 'accept' && decision !== 'reject') {
      return res.status(400).json({ message: 'decision must be accept or reject' });
    }

    if (row.approvalStatus !== 'approved') {
      return res.status(409).json({
        message: 'Manager approval is required before notifying the visitor',
        messageAr: 'يجب الحصول على اعتماد المدير قبل إرسال القرار للزائر'
      });
    }

    const accepted = decision === 'accept';
    const customMessage = req.body?.message ? String(req.body.message).trim() : null;
    let emailFailed = false;

    if (process.env.SENDGRID_API_KEY && row.email) {
      try {
        const mail = _buildVisitorEmail({ row, accepted, customMessage });
        await sgMail.send({
          from: {
            email: process.env.SENDGRID_FROM_EMAIL,
            name: process.env.SENDGRID_FROM_NAME || 'FABLAB Al-Ahsa'
          },
          to: row.email,
          subject: mail.subject,
          html: mail.html,
          text: mail.text
        });
      } catch (mailErr) {
        console.error('visitor decision email failed:', mailErr?.response?.body || mailErr);
        emailFailed = true;
      }
    }

    await row.update({
      visitorDecision: accepted ? 'accepted' : 'rejected',
      visitorDecisionAt: new Date(),
      visitorDecisionBy: req.admin?.fullName || req.admin?.username || req.user?.username || null,
      visitorMessage: customMessage,
      visitorEmailSentAt: emailFailed ? null : new Date()
    });

    res.json({
      message: emailFailed
        ? 'Decision saved — email delivery failed'
        : (accepted ? 'Visitor notified — accepted' : 'Visitor notified — rejected'),
      row,
      emailFailed
    });
  } catch (err) {
    console.error('notifyVisitor:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};
