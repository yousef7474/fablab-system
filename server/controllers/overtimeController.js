const { OvertimeRequest } = require('../models');
const { Op } = require('sequelize');
const crypto = require('crypto');
const sgMail = require('@sendgrid/mail');
const { archiveSentApproval, markArchiveDecided } = require('./approvalArchiveController');
if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Short display id for the archive — overtime rows don't have a
// sequential number yet, so we use the UUID prefix as a stable
// reference.
const overtimeRef = (row) => `OT-${String(row.overtimeId || '').slice(0, 8).toUpperCase()}`;

// Compute totalHours from the days array if the client didn't send one.
const sumDayHours = (days) => (Array.isArray(days) ? days : []).reduce(
  (s, d) => s + (Number(d?.hours) || 0), 0
);

const _UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Public origin used to build the email approval links. Falls back to
// the production domain so QA env still gets clickable links.
const _publicOrigin = () =>
  process.env.PUBLIC_APP_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://fablabsahsa.com' : 'http://localhost:3000');

// -------------------- LIST / CRUD --------------------

exports.listOvertime = async (req, res) => {
  try {
    const rows = await OvertimeRequest.findAll({ order: [['createdAt', 'DESC']] });
    res.json(rows);
  } catch (err) {
    console.error('listOvertime:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /overtime/pending — for the manager approval board
exports.listPendingOvertime = async (req, res) => {
  try {
    const rows = await OvertimeRequest.findAll({
      where: { approvalStatus: 'pending' },
      order: [['sentForApprovalAt', 'DESC']]
    });
    res.json(rows);
  } catch (err) {
    console.error('listPendingOvertime:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getOvertime = async (req, res) => {
  try {
    const row = await OvertimeRequest.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    res.json(row);
  } catch (err) {
    console.error('getOvertime:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createOvertime = async (req, res) => {
  try {
    const {
      employeeName, nationalId, phone, email, position,
      periodStart, periodEnd, note, sanadDetails, days, approvedBy
    } = req.body;

    if (!employeeName) {
      return res.status(400).json({ message: 'employeeName is required' });
    }
    const normalizedDays = Array.isArray(days) ? days : [];
    const totalHours = Number(req.body.totalHours) > 0
      ? Number(req.body.totalHours)
      : sumDayHours(normalizedDays);

    const row = await OvertimeRequest.create({
      employeeName,
      nationalId: nationalId || null,
      phone: phone || null,
      email: email || null,
      position: position || null,
      periodStart: periodStart || null,
      periodEnd: periodEnd || null,
      approvedBy: approvedBy || null,
      note: note || null,
      sanadDetails: sanadDetails || null,
      days: normalizedDays,
      totalHours,
      approvalStatus: 'draft',
      createdById: req.user?.userId || req.user?.id || null
    });
    res.status(201).json(row);
  } catch (err) {
    console.error('createOvertime:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.updateOvertime = async (req, res) => {
  try {
    const row = await OvertimeRequest.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });

    // Only block edits while the request is out for approval (the
    // manager might be looking at that snapshot). Once decided
    // — approved OR rejected — admin can fix typos and reprint
    // the sanad. approvalStatus is preserved so the printed doc
    // still carries the manager signature line intact.
    if (row.approvalStatus === 'pending') {
      return res.status(409).json({
        message: 'Request is out for approval — recall or wait for the decision before editing',
        messageAr: 'الطلب قيد الاعتماد — اسحب الطلب أو انتظر القرار قبل التعديل'
      });
    }

    const payload = { ...req.body };
    // Strip fields the admin can't set directly on update:
    delete payload.approvalStatus;
    delete payload.approvalToken;
    delete payload.sentForApprovalAt;
    delete payload.approvedAt;
    delete payload.rejectedAt;
    delete payload.managerNote;

    if (Array.isArray(payload.days) && !(Number(payload.totalHours) > 0)) {
      payload.totalHours = sumDayHours(payload.days);
    }
    await row.update(payload);
    res.json(row);
  } catch (err) {
    console.error('updateOvertime:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.deleteOvertime = async (req, res) => {
  try {
    const row = await OvertimeRequest.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    await row.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('deleteOvertime:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// -------------------- APPROVAL FLOW --------------------

const _buildApprovalEmail = ({ row, token, origin }) => {
  const dayRows = (row.days || []).map(d => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${d.date || '—'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;direction:ltr">${d.startTime || ''}${d.startTime && d.endTime ? ' - ' : ''}${d.endTime || ''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center">${Number(d.hours || 0).toFixed(2)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${d.task || '—'}</td>
    </tr>
  `).join('');

  const previewUrl = `${origin}/public/overtime/${token}`;

  return {
    subject: `طلب اعتماد ساعات إضافية — ${row.employeeName}`,
    html: `<!doctype html><html dir="rtl"><body style="margin:0;font-family:Segoe UI,Tahoma,Arial,sans-serif;background:#f4f6fb;color:#0f172a;padding:24px">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.08)">
  <div style="background:linear-gradient(135deg,#6d28d9,#8b5cf6);color:#fff;padding:20px 24px">
    <div style="font-size:12px;letter-spacing:1px;opacity:0.85">FABLAB الأحساء</div>
    <div style="font-size:20px;font-weight:800;margin-top:4px">طلب اعتماد ساعات إضافية</div>
  </div>
  <div style="padding:20px 24px">
    <p style="margin:0 0 14px;font-size:14px;line-height:1.7">
      يوجد طلب جديد للساعات الإضافية بحاجة إلى اعتمادكم:
    </p>
    <table style="width:100%;font-size:13px;border-collapse:collapse;margin-bottom:16px">
      <tr><td style="padding:6px 0;color:#64748b;width:130px">الموظف:</td><td style="padding:6px 0;font-weight:700">${row.employeeName}</td></tr>
      ${row.position ? `<tr><td style="padding:6px 0;color:#64748b">الوظيفة:</td><td style="padding:6px 0">${row.position}</td></tr>` : ''}
      ${row.nationalId ? `<tr><td style="padding:6px 0;color:#64748b">رقم الهوية:</td><td style="padding:6px 0;direction:ltr">${row.nationalId}</td></tr>` : ''}
      ${row.periodStart ? `<tr><td style="padding:6px 0;color:#64748b">الفترة:</td><td style="padding:6px 0;direction:ltr">${row.periodStart} → ${row.periodEnd || '—'}</td></tr>` : ''}
      <tr><td style="padding:6px 0;color:#64748b">إجمالي الساعات:</td><td style="padding:6px 0;font-weight:800;color:#6d28d9">${Number(row.totalHours || 0).toFixed(2)} ساعة</td></tr>
    </table>

    <div style="font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">تفصيل الأيام</div>
    <table style="width:100%;font-size:12px;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px">
      <thead>
        <tr style="background:#f5f3ff">
          <th style="padding:8px;text-align:right;color:#6d28d9">التاريخ</th>
          <th style="padding:8px;text-align:right;color:#6d28d9">الوقت</th>
          <th style="padding:8px;text-align:center;color:#6d28d9">الساعات</th>
          <th style="padding:8px;text-align:right;color:#6d28d9">المهمة</th>
        </tr>
      </thead>
      <tbody>${dayRows || '<tr><td colspan="4" style="padding:12px;text-align:center;color:#94a3b8">لا توجد أيام</td></tr>'}</tbody>
    </table>

    ${row.note ? `<div style="background:#f8fafc;padding:10px 12px;border-radius:8px;font-size:13px;color:#334155;margin-bottom:16px"><b>ملاحظة الإدارة:</b> ${row.note}</div>` : ''}

    <div style="text-align:center;margin:24px 0 12px">
      <a href="${previewUrl}?decision=approve" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:800;margin:0 6px">✓ اعتماد</a>
      <a href="${previewUrl}?decision=reject" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:800;margin:0 6px">✕ رفض</a>
    </div>
    <div style="text-align:center;margin-top:8px">
      <a href="${previewUrl}" style="color:#6d28d9;font-size:12px">عرض التفاصيل الكاملة</a>
    </div>
  </div>
  <div style="background:#f8fafc;padding:12px 24px;font-size:11px;color:#94a3b8;text-align:center">
    فاب لاب الأحساء · مؤسسة عبدالمنعم الراشد الإنسانية
  </div>
</div>
</body></html>`,
    text: `طلب اعتماد ساعات إضافية

الموظف: ${row.employeeName}
${row.position ? `الوظيفة: ${row.position}\n` : ''}الفترة: ${row.periodStart || ''} → ${row.periodEnd || ''}
إجمالي الساعات: ${Number(row.totalHours || 0).toFixed(2)}

للاعتماد أو الرفض، افتح الرابط:
${previewUrl}`
  };
};

// POST /overtime/:id/send-for-approval — body { managerEmail }
exports.sendForApproval = async (req, res) => {
  try {
    const row = await OvertimeRequest.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });

    const managerEmail = String(req.body?.managerEmail || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(managerEmail)) {
      return res.status(400).json({
        message: 'Valid manager email required',
        messageAr: 'بريد المدير مطلوب'
      });
    }

    if (row.approvalStatus === 'approved') {
      return res.status(409).json({
        message: 'Already approved',
        messageAr: 'الطلب معتمد مسبقاً'
      });
    }

    // Fresh token on every send so an old email link can't approve
    // a superseded version by accident.
    const token = crypto.randomUUID();
    await row.update({
      approvalStatus: 'pending',
      approvalToken: token,
      managerEmail,
      sentForApprovalAt: new Date(),
      approvedAt: null,
      rejectedAt: null,
      managerNote: null
    });

    // Send the email (non-blocking on failure — the row is still
    // marked pending, admin can resend).
    let archivedEmailHtml = null;
    let archivedSubject = null;
    if (process.env.SENDGRID_API_KEY) {
      try {
        const mail = _buildApprovalEmail({ row, token, origin: _publicOrigin() });
        archivedEmailHtml = mail.html;
        archivedSubject = mail.subject;
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
        console.error('overtime approval email failed:', mailErr?.response?.body || mailErr);
        // Still archive the attempt so the admin can retry from the
        // archive page. Silent no-op if the archive insert also fails.
        if (archivedEmailHtml) {
          archiveSentApproval({
            type: 'overtime',
            sourceId: row.overtimeId,
            requestNumber: overtimeRef(row),
            title: row.employeeName || 'Overtime request',
            managerEmail,
            subject: archivedSubject,
            emailHtml: archivedEmailHtml,
            payloadSnapshot: row.toJSON(),
            sentById: req.admin?.adminId || null
          });
        }
        // Still return success — admin can hit "Resend" to retry.
        return res.json({
          message: 'Marked pending — email delivery failed, try resending',
          messageAr: 'تم إرسال الطلب للاعتماد — فشل إرسال البريد، حاول إعادة الإرسال',
          row,
          emailFailed: true
        });
      }
    }

    if (archivedEmailHtml) {
      archiveSentApproval({
        type: 'overtime',
        sourceId: row.overtimeId,
        requestNumber: overtimeRef(row),
        title: row.employeeName || 'Overtime request',
        managerEmail,
        subject: archivedSubject,
        emailHtml: archivedEmailHtml,
        payloadSnapshot: row.toJSON(),
        sentById: req.admin?.adminId || null
      });
    }

    res.json({ message: 'Sent for approval', row });
  } catch (err) {
    console.error('sendForApproval error:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

// POST /overtime/:id/approve — logged-in manager
exports.approveOvertime = async (req, res) => {
  try {
    const row = await OvertimeRequest.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    if (row.approvalStatus === 'approved') {
      return res.status(409).json({ message: 'Already approved' });
    }
    await row.update({
      approvalStatus: 'approved',
      approvedAt: new Date(),
      rejectedAt: null,
      managerNote: req.body?.note ? String(req.body.note).trim() : row.managerNote,
      approvedBy: req.body?.approvedBy || req.admin?.fullName || row.approvedBy
    });
    markArchiveDecided({
      type: 'overtime',
      sourceId: row.overtimeId,
      status: 'approved',
      managerName: row.approvedBy
    });
    res.json({ message: 'Approved', row });
  } catch (err) {
    console.error('approveOvertime:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /overtime/:id/reject — logged-in manager
exports.rejectOvertime = async (req, res) => {
  try {
    const row = await OvertimeRequest.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    await row.update({
      approvalStatus: 'rejected',
      rejectedAt: new Date(),
      approvedAt: null,
      managerNote: req.body?.note ? String(req.body.note).trim() : row.managerNote
    });
    markArchiveDecided({
      type: 'overtime',
      sourceId: row.overtimeId,
      status: 'rejected',
      managerName: req.admin?.fullName || null
    });
    res.json({ message: 'Rejected', row });
  } catch (err) {
    console.error('rejectOvertime:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// -------------------- PUBLIC (token-gated, no auth) --------------------

// GET /public/overtime/:token — preview for the email link
exports.publicGetByToken = async (req, res) => {
  try {
    const token = req.params.token;
    if (!token || !_UUID_RE.test(token)) {
      return res.status(404).json({ message: 'Not found' });
    }
    const row = await OvertimeRequest.findOne({ where: { approvalToken: token } });
    if (!row) return res.status(404).json({ message: 'Not found' });
    res.json({
      overtimeId: row.overtimeId,
      approvalStatus: row.approvalStatus,
      employeeName: row.employeeName,
      nationalId: row.nationalId,
      phone: row.phone,
      position: row.position,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      totalHours: row.totalHours,
      note: row.note,
      days: row.days,
      approvedBy: row.approvedBy,
      managerNote: row.managerNote,
      approvedAt: row.approvedAt,
      rejectedAt: row.rejectedAt
    });
  } catch (err) {
    console.error('publicGetByToken:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /public/overtime/:token/decide — body { decision: 'approve'|'reject', approvedBy?, note? }
exports.publicDecide = async (req, res) => {
  try {
    const token = req.params.token;
    if (!token || !_UUID_RE.test(token)) {
      return res.status(404).json({ message: 'Not found' });
    }
    const row = await OvertimeRequest.findOne({ where: { approvalToken: token } });
    if (!row) return res.status(404).json({ message: 'Not found' });

    const decision = String(req.body?.decision || '').trim();
    if (decision !== 'approve' && decision !== 'reject') {
      return res.status(400).json({ message: 'decision must be approve or reject' });
    }

    if (decision === 'approve') {
      if (row.approvalStatus === 'approved') {
        return res.json({ message: 'Already approved', row });
      }
      await row.update({
        approvalStatus: 'approved',
        approvedAt: new Date(),
        rejectedAt: null,
        managerNote: req.body?.note ? String(req.body.note).trim() : null,
        approvedBy: req.body?.approvedBy ? String(req.body.approvedBy).trim() : row.approvedBy
      });
    } else {
      await row.update({
        approvalStatus: 'rejected',
        rejectedAt: new Date(),
        approvedAt: null,
        managerNote: req.body?.note ? String(req.body.note).trim() : null
      });
    }
    // Token is single-use — clear it so the same link can't flip back later.
    await row.update({ approvalToken: null });

    markArchiveDecided({
      type: 'overtime',
      sourceId: row.overtimeId,
      status: decision === 'approve' ? 'approved' : 'rejected',
      managerName: row.approvedBy || (req.body?.approvedBy || null)
    });

    res.json({ message: decision === 'approve' ? 'Approved' : 'Rejected', row });
  } catch (err) {
    console.error('publicDecide:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Exposed for the archive backfill (server/utils/backfillApprovalArchive.js)
// so historical rows can be materialized into the archive using the
// same HTML template the live send flow emits.
exports._buildApprovalEmail = _buildApprovalEmail;
exports._overtimeRef = overtimeRef;
exports._publicOrigin = _publicOrigin;
