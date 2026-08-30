const { ApprovalArchive, VolunteerOpportunityRequest, OvertimeRequest } = require('../models');
const { Op } = require('sequelize');
const sgMail = require('@sendgrid/mail');

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Called from the individual approval-send endpoints (VOR, overtime,
// etc.). Fire-and-forget: never blocks the send flow. If archiving
// fails we just log — the manager email itself already went out.
exports.archiveSentApproval = async ({
  type,
  sourceId,
  requestNumber,
  title,
  managerEmail,
  managerName = null,
  subject,
  emailHtml,
  payloadSnapshot,
  sentById = null
}) => {
  try {
    return await ApprovalArchive.create({
      type,
      sourceId,
      requestNumber: requestNumber == null ? null : String(requestNumber),
      title: title == null ? null : String(title).slice(0, 500),
      managerEmail,
      managerName,
      subject: subject == null ? null : String(subject).slice(0, 500),
      emailHtml,
      payloadSnapshot: payloadSnapshot || null,
      status: 'pending',
      sentAt: new Date(),
      sentById
    });
  } catch (err) {
    console.error('archiveSentApproval failed:', err.message);
    return null;
  }
};

// Called from the manager approve/reject endpoints. Updates the most
// recent archive row for this source to reflect the decision so the
// archive list can be filtered by outcome.
exports.markArchiveDecided = async ({ type, sourceId, status, managerName = null }) => {
  try {
    const latest = await ApprovalArchive.findOne({
      where: { type, sourceId },
      order: [['sentAt', 'DESC']]
    });
    if (!latest) return null;
    await latest.update({
      status,
      managerName: managerName || latest.managerName,
      decidedAt: new Date()
    });
    return latest;
  } catch (err) {
    console.error('markArchiveDecided failed:', err.message);
    return null;
  }
};

// GET /approval-archive?type=&status=&search=&limit=
exports.list = async (req, res) => {
  try {
    const { type, status, search } = req.query;
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 200));
    const where = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (search && String(search).trim()) {
      const like = `%${String(search).trim()}%`;
      where[Op.or] = [
        { title: { [Op.iLike]: like } },
        { requestNumber: { [Op.iLike]: like } },
        { managerEmail: { [Op.iLike]: like } },
        { managerName: { [Op.iLike]: like } },
        { subject: { [Op.iLike]: like } }
      ];
    }
    const rows = await ApprovalArchive.findAll({
      where,
      order: [['sentAt', 'DESC']],
      limit,
      // Trim the huge emailHtml column out of the list payload — the
      // detail endpoint returns it. Keeps the list fast.
      attributes: { exclude: ['emailHtml'] }
    });
    res.json(rows);
  } catch (err) {
    console.error('archive list:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.get = async (req, res) => {
  try {
    const row = await ApprovalArchive.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    res.json(row);
  } catch (err) {
    console.error('archive get:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /approval-archive/:id/print — returns the raw HTML so the client
// can open it in a new tab and hit print. Same content that was
// emailed to the manager.
exports.printHtml = async (req, res) => {
  try {
    const row = await ApprovalArchive.findByPk(req.params.id);
    if (!row) return res.status(404).send('Not found');
    // Inject a print helper so opening this URL directly triggers the
    // browser print dialog. `?print=0` disables that (useful for admin
    // previews).
    const auto = req.query.print === '0'
      ? ''
      : `<script>window.addEventListener('load', () => setTimeout(() => window.print(), 400));</script>`;
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(String(row.emailHtml || '') + auto);
  } catch (err) {
    console.error('archive printHtml:', err);
    res.status(500).send('Server error');
  }
};

// POST /approval-archive/:id/resend — re-fire the exact same email to
// the same (or a new) manager address without touching the source
// row's approval state. Useful when the original email got lost.
exports.resend = async (req, res) => {
  try {
    const row = await ApprovalArchive.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
      return res.status(500).json({ message: 'Email service not configured' });
    }
    const to = String(req.body?.managerEmail || row.managerEmail || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({ message: 'Invalid email' });
    }
    await sgMail.send({
      to,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL,
        name: process.env.SENDGRID_FROM_NAME || 'FABLAB Al-Ahsa'
      },
      subject: `[إعادة إرسال] ${row.subject || 'طلب اعتماد'}`,
      html: row.emailHtml
    });
    res.json({ message: 'Resent', to });
  } catch (err) {
    console.error('archive resend:', err?.response?.body || err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const row = await ApprovalArchive.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    await row.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('archive remove:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
