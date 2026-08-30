const crypto = require('crypto');
const { VolunteerOpportunityRequest } = require('../models');
const { sequelize } = require('../config/database');
const sgMail = require('@sendgrid/mail');
const { archiveSentApproval, markArchiveDecided } = require('./approvalArchiveController');
if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const _publicOrigin = () =>
  process.env.PUBLIC_APP_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://fablabsahsa.com' : 'http://localhost:3000');

const fmtRequestNumber = (n) => n == null ? '—' : `VOR-${String(n).padStart(3, '0')}`;

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const _UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Atomically assign the next sequential requestNumber.
const _assignNextNumber = async () => {
  return await sequelize.transaction(async (t) => {
    const [row] = await sequelize.query(
      `SELECT COALESCE(MAX("requestNumber"), 0) + 1 AS next FROM volunteer_opportunity_requests`,
      { transaction: t }
    );
    return Number(row?.[0]?.next) || 1;
  });
};

// ---------- LIST + CRUD (admin) ----------

exports.list = async (req, res) => {
  try {
    const rows = await VolunteerOpportunityRequest.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json(rows);
  } catch (err) {
    console.error('vor list:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.get = async (req, res) => {
  try {
    const row = await VolunteerOpportunityRequest.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    res.json(row);
  } catch (err) {
    console.error('vor get:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.coordinatorName || !String(b.coordinatorName).trim()) {
      return res.status(400).json({ message: 'coordinatorName required', messageAr: 'اسم المنسق مطلوب' });
    }
    if (!b.coordinatorPhone || !String(b.coordinatorPhone).trim()) {
      return res.status(400).json({ message: 'coordinatorPhone required', messageAr: 'رقم جوال المنسق مطلوب' });
    }
    if (!b.title || !String(b.title).trim()) {
      return res.status(400).json({ message: 'title required', messageAr: 'مسمى الفرصة مطلوب' });
    }

    const requestNumber = await _assignNextNumber();

    const row = await VolunteerOpportunityRequest.create({
      requestNumber,
      coordinatorName:  String(b.coordinatorName).trim(),
      coordinatorPhone: String(b.coordinatorPhone).trim(),
      title:            String(b.title).trim(),
      location:         b.location ? String(b.location).trim() : null,
      mode:             ['onsite', 'remote', 'hybrid'].includes(b.mode) ? b.mode : 'onsite',
      description:      b.description ? String(b.description).trim() : null,
      responsibilities: b.responsibilities ? String(b.responsibilities).trim() : null,
      volunteersNeeded: b.volunteersNeeded != null && b.volunteersNeeded !== ''
        ? Math.max(1, Number(b.volunteersNeeded) || 1)
        : null,
      genderPreference: ['male', 'female', 'any'].includes(b.genderPreference) ? b.genderPreference : 'any',
      minAge: b.minAge != null && b.minAge !== '' ? Number(b.minAge) : null,
      maxAge: b.maxAge != null && b.maxAge !== '' ? Number(b.maxAge) : null,
      programStartTime: b.programStartTime || null,
      programEndTime:   b.programEndTime || null,
      requiredSkills:      b.requiredSkills      ? String(b.requiredSkills).trim() : null,
      educationLevel:      b.educationLevel      ? String(b.educationLevel).trim() : null,
      supportProvided:     b.supportProvided     ? String(b.supportProvided).trim() : null,
      risksAndChallenges:  b.risksAndChallenges  ? String(b.risksAndChallenges).trim() : null,
      startDate: b.startDate || null,
      endDate:   b.endDate   || null,
      createdById: req.admin?.adminId || null,
      approvalStatus: 'draft'
    });
    res.status(201).json(row);
  } catch (err) {
    console.error('vor create:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await VolunteerOpportunityRequest.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });

    // Only block edits while the request is out for approval (the
    // manager might be reviewing that exact snapshot). Once decided
    // — approved OR rejected — admin can edit and reprint. The
    // approval status is preserved so the printed doc still carries
    // the manager's signature line intact.
    if (row.approvalStatus === 'pending') {
      return res.status(409).json({
        message: 'Request is out for approval — recall or wait for the decision before editing',
        messageAr: 'الطلب قيد الاعتماد — اسحب الطلب أو انتظر القرار قبل التعديل'
      });
    }

    const patch = { ...req.body };
    delete patch.requestNumber;
    delete patch.approvalStatus;
    delete patch.approvalToken;
    delete patch.managerName;
    delete patch.managerNote;
    delete patch.managerEmail;
    delete patch.sentForApprovalAt;
    delete patch.approvedAt;
    delete patch.rejectedAt;

    await row.update(patch);
    res.json(row);
  } catch (err) {
    console.error('vor update:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.remove = async (req, res) => {
  try {
    const row = await VolunteerOpportunityRequest.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    await row.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('vor remove:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---------- EMAIL TEMPLATE ----------

const _buildApprovalEmail = ({ row, token, origin }) => {
  const reqNo = fmtRequestNumber(row.requestNumber);
  const url = `${origin}/public/volunteer-opportunity/${token}`;
  const modeAr = row.mode === 'remote' ? 'عن بُعد' : row.mode === 'hybrid' ? 'هجين' : 'حضوري';
  const genderAr = row.genderPreference === 'male' ? 'ذكور فقط'
    : row.genderPreference === 'female' ? 'إناث فقط' : 'الجميع';
  const ageAr = (row.minAge || row.maxAge)
    ? `${row.minAge || '—'} - ${row.maxAge || '—'} سنة`
    : 'غير محدد';

  const rowHtml = (label, val) => val
    ? `<tr><td style="padding:6px 12px;color:#64748b;width:170px;vertical-align:top">${esc(label)}:</td><td style="padding:6px 12px;color:#0f172a;white-space:pre-wrap">${esc(val)}</td></tr>`
    : '';

  return {
    subject: `طلب فتح فرصة تطوعية ${reqNo} — ${row.title}`,
    text: `طلب فتح فرصة تطوعية جديد ${reqNo}: ${row.title}\n\nللاعتماد: ${url}`,
    html: `<!doctype html><html dir="rtl" lang="ar"><body style="margin:0;font-family:Segoe UI,Tahoma,Arial,sans-serif;background:#f4f6fb;color:#0f172a;padding:24px">
<div style="max-width:680px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 8px 30px -12px rgba(15,23,42,0.15)">
  <div style="background:linear-gradient(135deg,#16a34a,#0d9488);color:#fff;padding:24px 28px">
    <div style="font-size:12px;letter-spacing:1.4px;opacity:0.85;text-transform:uppercase">FABLAB الأحساء · تطوع</div>
    <div style="font-size:22px;font-weight:800;margin-top:6px">طلب فتح فرصة تطوعية جديدة</div>
    <div style="font-family:monospace;font-size:13px;letter-spacing:1.6px;background:rgba(255,255,255,0.2);display:inline-block;padding:4px 12px;border-radius:6px;margin-top:8px">${esc(reqNo)}</div>
  </div>
  <div style="padding:22px 28px;font-size:14px;line-height:1.7">
    <p style="margin:0 0 14px">
      تم إعداد طلب فتح فرصة تطوعية جديدة يستدعي اعتمادكم قبل الإعلان عنها.
    </p>
    <div style="padding:14px 18px;background:#f0fdf4;border:1px solid #86efac;border-inline-start:4px solid #16a34a;border-radius:10px;margin-bottom:16px">
      <div style="font-size:11px;color:#166534;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">مسمى الفرصة</div>
      <div style="font-size:17px;font-weight:800;color:#0f172a">${esc(row.title)}</div>
    </div>
    <table style="width:100%;font-size:13px;border-collapse:collapse;background:#f8fafc;border-radius:10px;overflow:hidden;margin-bottom:16px">
      ${rowHtml('منسق الفرصة', row.coordinatorName)}
      ${rowHtml('جوال المنسق', row.coordinatorPhone)}
      ${rowHtml('المكان', row.location)}
      ${rowHtml('طبيعة الفرصة', modeAr)}
      ${rowHtml('عدد المتطوعين المطلوب', row.volunteersNeeded)}
      ${rowHtml('الجنس', genderAr)}
      ${rowHtml('العمر المناسب', ageAr)}
      ${row.programStartTime && row.programEndTime ? rowHtml('وقت البرنامج', `${row.programStartTime} → ${row.programEndTime}`) : ''}
      ${row.startDate || row.endDate ? rowHtml('الفترة', `${row.startDate || '—'} إلى ${row.endDate || '—'}`) : ''}
      ${rowHtml('المؤهل العلمي', row.educationLevel)}
      ${rowHtml('المهارات المطلوبة', row.requiredSkills)}
      ${rowHtml('وصف الفرصة', row.description)}
      ${rowHtml('مهام ومسؤوليات المتطوع', row.responsibilities)}
      ${rowHtml('الدعم المقدم للمتطوع', row.supportProvided)}
      ${rowHtml('المخاطر والتحديات', row.risksAndChallenges)}
    </table>
    <div style="text-align:center;margin:24px 0 4px">
      <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:800;box-shadow:0 10px 24px -8px rgba(22,163,74,0.5)">مراجعة الطلب واتخاذ القرار</a>
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

// ---------- SEND FOR APPROVAL (admin) ----------

exports.sendForApproval = async (req, res) => {
  try {
    const row = await VolunteerOpportunityRequest.findByPk(req.params.id);
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

    // Fresh token on every send.
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
        console.error('vor approval email failed:', mailErr?.response?.body || mailErr);
        // Still archive the attempt so the admin can retry from the
        // archive page. Silent no-op if the archive insert also fails.
        if (archivedEmailHtml) {
          archiveSentApproval({
            type: 'volunteer_opportunity',
            sourceId: row.requestId,
            requestNumber: fmtRequestNumber(row.requestNumber),
            title: row.title,
            managerEmail,
            subject: archivedSubject,
            emailHtml: archivedEmailHtml,
            payloadSnapshot: row.toJSON(),
            sentById: req.admin?.adminId || null
          });
        }
        return res.json({
          message: 'Marked pending — email delivery failed, try resending',
          messageAr: 'تم إرسال الطلب للاعتماد — فشل إرسال البريد، حاول إعادة الإرسال',
          row,
          emailFailed: true
        });
      }
    }

    // Fire-and-forget archive write — never blocks the response.
    if (archivedEmailHtml) {
      archiveSentApproval({
        type: 'volunteer_opportunity',
        sourceId: row.requestId,
        requestNumber: fmtRequestNumber(row.requestNumber),
        title: row.title,
        managerEmail,
        subject: archivedSubject,
        emailHtml: archivedEmailHtml,
        payloadSnapshot: row.toJSON(),
        sentById: req.admin?.adminId || null
      });
    }

    res.json({ message: 'Sent for approval', row });
  } catch (err) {
    console.error('vor sendForApproval:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

// ---------- MANAGER DASHBOARD (logged-in) ----------

exports.listPending = async (req, res) => {
  try {
    const rows = await VolunteerOpportunityRequest.findAll({
      where: { approvalStatus: 'pending' },
      order: [['sentForApprovalAt', 'DESC']]
    });
    res.json(rows);
  } catch (err) {
    console.error('vor listPending:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Hard-coded standard approver for volunteer opportunities. Falling
// back to req.admin.fullName was wrong — the admin who clicks the
// button is often just a system user labeled "FABLAB Manager", but
// the ACTUAL signing manager is fixed. Keep this name authoritative
// so the printed sanad always shows the right person.
const DEFAULT_MANAGER_NAME = 'أ. زكي اللويم';

exports.managerApprove = async (req, res) => {
  try {
    const row = await VolunteerOpportunityRequest.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    if (row.approvalStatus === 'approved') return res.status(409).json({ message: 'Already approved' });
    await row.update({
      approvalStatus: 'approved',
      approvedAt: new Date(),
      rejectedAt: null,
      managerNote: req.body?.note ? String(req.body.note).trim() : row.managerNote,
      managerName: req.body?.managerName
        ? String(req.body.managerName).trim()
        : (row.managerName || DEFAULT_MANAGER_NAME),
      approvalToken: null
    });
    markArchiveDecided({
      type: 'volunteer_opportunity',
      sourceId: row.requestId,
      status: 'approved',
      managerName: row.managerName
    });
    res.json({ message: 'Approved', row });
  } catch (err) {
    console.error('vor managerApprove:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.managerReject = async (req, res) => {
  try {
    const row = await VolunteerOpportunityRequest.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    await row.update({
      approvalStatus: 'rejected',
      rejectedAt: new Date(),
      approvedAt: null,
      managerNote: req.body?.note ? String(req.body.note).trim() : row.managerNote,
      managerName: req.body?.managerName
        ? String(req.body.managerName).trim()
        : (row.managerName || DEFAULT_MANAGER_NAME),
      approvalToken: null
    });
    markArchiveDecided({
      type: 'volunteer_opportunity',
      sourceId: row.requestId,
      status: 'rejected',
      managerName: row.managerName
    });
    res.json({ message: 'Rejected', row });
  } catch (err) {
    console.error('vor managerReject:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---------- PUBLIC (token-gated, no auth) ----------

exports.publicGetByToken = async (req, res) => {
  try {
    const token = req.params.token;
    if (!token || !_UUID_RE.test(token)) {
      return res.status(404).json({ message: 'Not found' });
    }
    const row = await VolunteerOpportunityRequest.findOne({ where: { approvalToken: token } });
    if (!row) return res.status(404).json({ message: 'Not found' });
    res.json(row);
  } catch (err) {
    console.error('vor publicGetByToken:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.publicDecide = async (req, res) => {
  try {
    const token = req.params.token;
    if (!token || !_UUID_RE.test(token)) return res.status(404).json({ message: 'Not found' });
    const row = await VolunteerOpportunityRequest.findOne({ where: { approvalToken: token } });
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

    markArchiveDecided({
      type: 'volunteer_opportunity',
      sourceId: row.requestId,
      status: decision === 'approve' ? 'approved' : 'rejected',
      managerName: row.managerName
    });

    res.json({ message: decision === 'approve' ? 'Approved' : 'Rejected', row });
  } catch (err) {
    console.error('vor publicDecide:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
