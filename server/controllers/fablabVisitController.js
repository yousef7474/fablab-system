const { FablabVisit, Settings, RegistrationClosure } = require('../models');
const { sequelize } = require('../config/database');
const crypto = require('crypto');
const sgMail = require('@sendgrid/mail');
if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Format the sequential visit number for display: 12 → "V-012"
const formatVisitNumber = (n) =>
  n == null ? '—' : `V-${String(n).padStart(3, '0')}`;

// Atomically assign the next sequential visitNumber. MAX+1 inside a
// transaction is safe for our low submission rate; if you ever need
// concurrent bursts, swap to a Postgres SEQUENCE.
const _assignNextVisitNumber = async () => {
  return await sequelize.transaction(async (t) => {
    const [row] = await sequelize.query(
      `SELECT COALESCE(MAX("visitNumber"), 0) + 1 AS next FROM fablab_visits`,
      { transaction: t }
    );
    return Number(row?.[0]?.next) || 1;
  });
};

// -------------------- OVERRIDE CODE (5-minute rotating) --------------------
// Stored as a single Settings row: { code, expiresAt }. We regenerate on
// demand and whenever the current code has expired.
const OVERRIDE_CODE_KEY = 'fablab_visit_override_code';
const OVERRIDE_CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const _generateCode = () => {
  // 6 characters, uppercase alphanumeric, unambiguous (no O/0, no I/1)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
};

const _getOrRotateOverrideCode = async () => {
  const row = await Settings.findByPk(OVERRIDE_CODE_KEY);
  const now = Date.now();
  if (row?.value?.code && row.value.expiresAt && new Date(row.value.expiresAt).getTime() > now) {
    return row.value;
  }
  const next = { code: _generateCode(), expiresAt: new Date(now + OVERRIDE_CODE_TTL_MS).toISOString() };
  await Settings.upsert({ key: OVERRIDE_CODE_KEY, value: next });
  return next;
};

const _forceRotateOverrideCode = async () => {
  const next = { code: _generateCode(), expiresAt: new Date(Date.now() + OVERRIDE_CODE_TTL_MS).toISOString() };
  await Settings.upsert({ key: OVERRIDE_CODE_KEY, value: next });
  return next;
};

const _isOverrideCodeValid = async (submitted) => {
  if (!submitted) return false;
  const row = await Settings.findByPk(OVERRIDE_CODE_KEY);
  if (!row?.value?.code || !row?.value?.expiresAt) return false;
  if (String(row.value.code).toUpperCase() !== String(submitted).toUpperCase().trim()) return false;
  return new Date(row.value.expiresAt).getTime() > Date.now();
};

// -------------------- WORKING HOURS / CLOSURE CHECKS --------------------
// Returns { ok: true } or { ok: false, reason: '...', reasonAr: '...' }.
const _validateTimingAgainstSettings = async (visitDate, visitStartTime, visitEndTime) => {
  // Working hours + working days
  const [startRow, endRow, daysRow] = await Promise.all([
    Settings.findByPk('working_hours_start'),
    Settings.findByPk('working_hours_end'),
    Settings.findByPk('working_days')
  ]);
  const workStart = startRow?.value || '11:00';
  const workEnd   = endRow?.value   || '19:00';
  const workDays  = Array.isArray(daysRow?.value) ? daysRow.value : [0, 1, 2, 3, 4];

  // Weekday check — Sun=0 .. Sat=6
  const day = new Date(`${visitDate}T00:00:00`).getDay();
  if (!workDays.includes(day)) {
    return {
      ok: false,
      reason: 'Selected day is not a working day (weekend or closed).',
      reasonAr: 'اليوم المحدد ليس يوم عمل (نهاية أسبوع أو مغلق).'
    };
  }

  // Time window check
  const hhmm = (t) => String(t || '').slice(0, 5);
  const s = hhmm(visitStartTime);
  const e = hhmm(visitEndTime);
  if (s < workStart || e > workEnd) {
    return {
      ok: false,
      reason: `Visit time must be within working hours ${workStart}–${workEnd}.`,
      reasonAr: `يجب أن تكون الزيارة ضمن ساعات العمل من ${workStart} إلى ${workEnd}.`
    };
  }

  // Active closure check
  const closures = await RegistrationClosure.findAll({ where: { isActive: true } });
  for (const c of closures) {
    if (visitDate >= String(c.startDate) && visitDate <= String(c.endDate)) {
      return {
        ok: false,
        reason: `Registration is closed on this date: ${c.reasonEn || 'closed period'}.`,
        reasonAr: `التسجيل مغلق في هذا التاريخ: ${c.reasonAr || c.reasonEn || 'فترة إغلاق'}.`
      };
    }
  }

  return { ok: true };
};

const _UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const _publicOrigin = () =>
  process.env.PUBLIC_APP_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://fablabsahsa.com' : 'http://localhost:3000');

// -------------------- LIST / CRUD --------------------

// Public — no auth required. Anyone can submit a visit request.
// If the requested date/time falls outside working hours / working days
// or lands on an active registration closure, submission is blocked
// UNLESS the visitor supplies a valid override code (5-min TTL, admin-
// issued from the settings tab).
// Central inbox for FABLAB operations — mirrored from the store /
// print3d flows so admin sees every incoming public submission here.
const VISIT_NOTIFY_EMAIL = 'fablabspec@fablabsahsa.com';

const _sendMail = async (to, subject, html, text) => {
  if (!process.env.SENDGRID_API_KEY) return { ok: false, reason: 'no-api-key' };
  try {
    await sgMail.send({
      from: {
        email: process.env.SENDGRID_FROM_EMAIL,
        name: process.env.SENDGRID_FROM_NAME || 'FABLAB Al-Ahsa'
      },
      to, subject, html, text
    });
    return { ok: true };
  } catch (err) {
    console.error('visit email failed:', err?.response?.body || err);
    return { ok: false, reason: err.message };
  }
};

const _esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Confirmation to the visitor: "we got your request".
const _buildVisitorReceivedEmail = (row) => {
  const visitNo = formatVisitNumber(row.visitNumber);
  const brand = '#0ea5e9';
  return {
    subject: `تم استلام طلب زيارة فاب لاب — ${visitNo}`,
    text: `تم استلام طلبك ${visitNo}. سيتم مراجعته وسنتواصل معك قريباً.`,
    html: `<!doctype html><html dir="rtl"><body style="margin:0;font-family:Segoe UI,Tahoma,Arial,sans-serif;background:#f4f6fb;color:#0f172a;padding:24px">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.08)">
  <div style="background:linear-gradient(135deg,${brand},#0284c7);color:#fff;padding:22px 26px">
    <div style="font-size:12px;letter-spacing:1.2px;opacity:0.85">FABLAB الأحساء · زيارات</div>
    <div style="font-size:22px;font-weight:800;margin-top:4px">تم استلام طلبك ✓</div>
  </div>
  <div style="padding:24px 26px;font-size:14px;line-height:1.75">
    <p style="margin:0 0 14px">مرحباً <b>${_esc(row.personInCharge)}</b>،</p>
    <p style="margin:0 0 14px">شكراً لتواصلك مع فاب لاب الأحساء. تم استلام طلب زيارتكم بنجاح وسيتم مراجعته من قبل الإدارة والتواصل معكم في أقرب وقت.</p>
    <table style="width:100%;font-size:13px;border-collapse:collapse;background:#f8fafc;border-radius:10px;margin:12px 0;overflow:hidden">
      <tr><td style="padding:8px 14px;color:#64748b;width:150px">رقم الطلب:</td><td style="padding:8px 14px;font-weight:800;font-family:monospace;color:${brand}">${_esc(visitNo)}</td></tr>
      <tr><td style="padding:8px 14px;color:#64748b">الجهة:</td><td style="padding:8px 14px;font-weight:600">${_esc(row.entityName)}</td></tr>
      <tr><td style="padding:8px 14px;color:#64748b">تاريخ الزيارة:</td><td style="padding:8px 14px;font-family:monospace" dir="ltr">${_esc(row.visitDate)}</td></tr>
      <tr><td style="padding:8px 14px;color:#64748b">الوقت:</td><td style="padding:8px 14px;font-family:monospace" dir="ltr">${_esc(row.visitStartTime)} → ${_esc(row.visitEndTime)}</td></tr>
      <tr><td style="padding:8px 14px;color:#64748b">عدد الزوار:</td><td style="padding:8px 14px">${_esc(row.visitorsCount)}</td></tr>
    </table>
    <p style="margin:14px 0 0;font-size:12px;color:#6b7280;padding:10px 14px;background:#fef3c7;border-inline-start:3px solid #f59e0b;border-radius:6px">
      ⏳ سيصلكم قرار الموافقة أو الاعتذار عبر البريد الإلكتروني بمجرد الانتهاء من المراجعة.
    </p>
  </div>
  <div style="background:#f8fafc;padding:12px 24px;font-size:11px;color:#94a3b8;text-align:center">
    فاب لاب الأحساء · مؤسسة عبدالمنعم الراشد الإنسانية
  </div>
</div>
</body></html>`
  };
};

// Heads-up to the ops inbox: "a new visit request came in".
const _buildAdminVisitReceivedEmail = (row) => {
  const visitNo = formatVisitNumber(row.visitNumber);
  return {
    subject: `طلب زيارة جديد ${visitNo} — ${row.entityName}`,
    text: `New visit request ${visitNo} from ${row.entityName} (${row.personInCharge}).`,
    html: `<!doctype html><html dir="rtl"><body style="margin:0;font-family:Segoe UI,Tahoma,Arial,sans-serif;background:#f4f6fb;color:#0f172a;padding:24px">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.08)">
  <div style="background:linear-gradient(135deg,#EE2329,#c41e24);color:#fff;padding:22px 26px">
    <div style="font-size:12px;letter-spacing:1.2px;opacity:0.85">FABLAB الأحساء · زيارات</div>
    <div style="font-size:20px;font-weight:800;margin-top:4px">طلب زيارة جديد ${_esc(visitNo)}</div>
  </div>
  <div style="padding:22px 26px;font-size:14px;line-height:1.7">
    <p style="margin:0 0 14px">وصل طلب زيارة جديد بحاجة إلى مراجعتكم واعتماد المدير.</p>
    <table style="width:100%;font-size:13px;border-collapse:collapse;margin:0 0 16px">
      <tr><td style="padding:6px 0;color:#64748b;width:150px">الجهة:</td><td style="padding:6px 0;font-weight:700">${_esc(row.entityName)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">المسؤول:</td><td style="padding:6px 0">${_esc(row.personInCharge)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">رقم الهوية:</td><td style="padding:6px 0" dir="ltr">${_esc(row.nationalId)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">الجوال:</td><td style="padding:6px 0" dir="ltr">${_esc(row.phone)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">البريد:</td><td style="padding:6px 0" dir="ltr">${_esc(row.email)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">عدد الزوار:</td><td style="padding:6px 0">${_esc(row.visitorsCount)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">تاريخ الزيارة:</td><td style="padding:6px 0" dir="ltr">${_esc(row.visitDate)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">الوقت:</td><td style="padding:6px 0" dir="ltr">${_esc(row.visitStartTime)} → ${_esc(row.visitEndTime)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;vertical-align:top">الغرض:</td><td style="padding:6px 0;white-space:pre-wrap">${_esc(row.purpose)}</td></tr>
      ${row.notes ? `<tr><td style="padding:6px 0;color:#64748b;vertical-align:top">ملاحظات:</td><td style="padding:6px 0;white-space:pre-wrap">${_esc(row.notes)}</td></tr>` : ''}
    </table>
    <div style="text-align:center;margin-top:16px">
      <a href="${_publicOrigin()}/admin/dashboard?tab=fablab-visits" style="display:inline-block;background:#EE2329;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:800">مراجعة الطلب</a>
    </div>
  </div>
  <div style="background:#f8fafc;padding:12px 24px;font-size:11px;color:#94a3b8;text-align:center">
    فاب لاب الأحساء · مؤسسة عبدالمنعم الراشد الإنسانية
  </div>
</div>
</body></html>`
  };
};

exports.publicCreate = async (req, res) => {
  try {
    const {
      entityName, personInCharge, nationalId, phone, email,
      visitorsCount, visitDate, visitStartTime, visitEndTime,
      purpose, notes, overrideCode
    } = req.body || {};

    if (!entityName || !personInCharge || !nationalId || !phone || !email
        || !visitDate || !visitStartTime || !visitEndTime || !purpose) {
      return res.status(400).json({
        message: 'Missing required fields',
        messageAr: 'الرجاء تعبئة جميع الحقول المطلوبة'
      });
    }

    // Check working-hours / working-days / closures. If it fails, only
    // proceed with a valid override code from the admin.
    const timing = await _validateTimingAgainstSettings(visitDate, visitStartTime, visitEndTime);
    let usedOverride = false;
    if (!timing.ok) {
      const codeOk = await _isOverrideCodeValid(overrideCode);
      if (!codeOk) {
        return res.status(409).json({
          message: timing.reason + ' A valid override code is required to submit outside allowed times.',
          messageAr: timing.reasonAr + ' يلزم رمز خاص من إدارة فاب لاب لتقديم الطلب خارج الأوقات المتاحة.',
          requiresOverride: true
        });
      }
      usedOverride = true;
      // Consume the code — force-rotate so the same code can't be reused.
      await _forceRotateOverrideCode();
    }

    const visitNumber = await _assignNextVisitNumber();

    const row = await FablabVisit.create({
      visitNumber,
      entityName: String(entityName).trim(),
      personInCharge: String(personInCharge).trim(),
      nationalId: String(nationalId).trim(),
      phone: String(phone).trim(),
      email: String(email).trim(),
      visitorsCount: Number(visitorsCount) > 0 ? Number(visitorsCount) : 1,
      visitDate,
      visitStartTime,
      visitEndTime,
      purpose: String(purpose).trim(),
      // If admin override was used, tag the notes so admin sees it in the review modal.
      notes: [
        notes ? String(notes).trim() : null,
        usedOverride ? '⚠️ تم تقديم هذا الطلب باستخدام رمز إدارة فاب لاب (خارج الأوقات المتاحة).' : null
      ].filter(Boolean).join('\n\n') || null,
      approvalStatus: 'draft',
      visitorDecision: 'pending'
    });

    // Fire-and-forget notification pair — mirrors store / print3d
    // flows so the ops inbox sees every submission and the visitor
    // gets an immediate confirmation.
    process.nextTick(async () => {
      try {
        const adminMail = _buildAdminVisitReceivedEmail(row);
        await _sendMail(VISIT_NOTIFY_EMAIL, adminMail.subject, adminMail.html, adminMail.text);
      } catch (e) { console.error('visit admin-notify email:', e); }
      try {
        const visitorMail = _buildVisitorReceivedEmail(row);
        await _sendMail(row.email, visitorMail.subject, visitorMail.html, visitorMail.text);
      } catch (e) { console.error('visit visitor-confirm email:', e); }
    });

    res.status(201).json({
      message: 'Request submitted',
      messageAr: 'تم استلام طلبك — سيتم التواصل معك قريباً',
      visitId: row.visitId,
      visitNumber: row.visitNumber
    });
  } catch (err) {
    console.error('publicCreate visit:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

// -------------------- ADMIN: OVERRIDE CODE MANAGEMENT --------------------

// GET /fablab-visits/override-code — returns { code, expiresAt }. Rotates
// automatically if the current one has expired.
exports.getOverrideCode = async (req, res) => {
  try {
    const value = await _getOrRotateOverrideCode();
    res.json(value);
  } catch (err) {
    console.error('getOverrideCode:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /fablab-visits/override-code/regenerate — forces a fresh code.
exports.regenerateOverrideCode = async (req, res) => {
  try {
    const value = await _forceRotateOverrideCode();
    res.json(value);
  } catch (err) {
    console.error('regenerateOverrideCode:', err);
    res.status(500).json({ message: 'Server error' });
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

  const visitNoStr = formatVisitNumber(row.visitNumber);

  return {
    subject: `طلب اعتماد زيارة فاب لاب #${visitNoStr} — ${row.entityName}`,
    html: `<!doctype html><html dir="rtl"><body style="margin:0;font-family:Segoe UI,Tahoma,Arial,sans-serif;background:#f4f6fb;color:#0f172a;padding:24px">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.08)">
  <div style="background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;padding:20px 24px">
    <div style="font-size:12px;letter-spacing:1px;opacity:0.85">FABLAB الأحساء · ${visitNoStr}</div>
    <div style="font-size:20px;font-weight:800;margin-top:4px">طلب اعتماد زيارة</div>
  </div>
  <div style="padding:20px 24px">
    <p style="margin:0 0 14px;font-size:14px;line-height:1.7">
      تم استلام طلب زيارة جديد بحاجة إلى اعتمادكم:
    </p>
    <table style="width:100%;font-size:13px;border-collapse:collapse;margin-bottom:16px">
      <tr><td style="padding:6px 0;color:#64748b;width:140px">رقم الطلب:</td><td style="padding:6px 0;font-weight:800;color:#0284c7;font-family:'JetBrains Mono',monospace">${visitNoStr}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">الجهة:</td><td style="padding:6px 0;font-weight:700">${row.entityName}</td></tr>
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

    if (!process.env.SENDGRID_API_KEY) {
      console.warn(`⚠️  visit approval: SENDGRID_API_KEY not set — manager ${managerEmail} will NOT receive the email`);
      return res.json({
        message: 'Marked pending — email service not configured on server',
        messageAr: 'تم حفظ الطلب — لكن خدمة البريد غير مفعّلة على السيرفر',
        row,
        emailFailed: true,
        emailFailReason: 'not-configured'
      });
    }

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
      console.log(`✉️  visit approval email sent to ${managerEmail} (visit ${row.visitId})`);
    } catch (mailErr) {
      console.error(`❌ visit approval email FAILED for ${managerEmail}:`, mailErr?.response?.body || mailErr.message);
      return res.json({
        message: 'Marked pending — email delivery failed, try resending',
        messageAr: 'تم حفظ الطلب — فشل إرسال البريد، حاول إعادة الإرسال',
        row,
        emailFailed: true,
        emailFailReason: 'send-failed'
      });
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
      visitNumber: row.visitNumber,
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

    // Same auto-notify as the dashboard path — the manager decided
    // via the emailed token link, so the visitor gets an email too.
    _sendVisitorDecisionEmail(row, {
      accepted: decision === 'approve',
      customMessage: row.managerNote || null,
      actor: `manager:${row.managerName || 'email-link'}`
    }).catch(() => {});

    res.json({ message: decision === 'approve' ? 'Approved' : 'Rejected', row });
  } catch (err) {
    console.error('publicDecide visit:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// -------------------- MANAGER DASHBOARD (logged-in, no token) --------------------

// GET /fablab-visits/pending — for the manager approvals tab
exports.listPending = async (req, res) => {
  try {
    const rows = await FablabVisit.findAll({
      where: { approvalStatus: 'pending' },
      order: [['sentForApprovalAt', 'DESC']]
    });
    res.json(rows);
  } catch (err) {
    console.error('listPending visits:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /fablab-visits/:id/manager-approve — logged-in manager
exports.managerApprove = async (req, res) => {
  try {
    const row = await FablabVisit.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    if (row.approvalStatus === 'approved') {
      return res.status(409).json({ message: 'Already approved' });
    }
    await row.update({
      approvalStatus: 'approved',
      approvedAt: new Date(),
      rejectedAt: null,
      managerNote: req.body?.note ? String(req.body.note).trim() : row.managerNote,
      managerName: req.body?.managerName
        ? String(req.body.managerName).trim()
        : (req.admin?.fullName || row.managerName),
      approvalToken: null // once decided from the dashboard, invalidate the email link
    });
    // Auto-notify the visitor — pass the manager's note as the
    // custom message so the visitor sees the reasoning. Fire-and-
    // forget: never blocks the response and never fails the decision.
    _sendVisitorDecisionEmail(row, {
      accepted: true,
      customMessage: row.managerNote || null,
      actor: `manager:${row.managerName || 'dashboard'}`
    }).catch(() => {});
    res.json({ message: 'Approved', row });
  } catch (err) {
    console.error('managerApprove visit:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /fablab-visits/:id/manager-reject — logged-in manager
exports.managerReject = async (req, res) => {
  try {
    const row = await FablabVisit.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    await row.update({
      approvalStatus: 'rejected',
      rejectedAt: new Date(),
      approvedAt: null,
      managerNote: req.body?.note ? String(req.body.note).trim() : row.managerNote,
      managerName: req.body?.managerName
        ? String(req.body.managerName).trim()
        : (req.admin?.fullName || row.managerName),
      approvalToken: null
    });
    _sendVisitorDecisionEmail(row, {
      accepted: false,
      customMessage: row.managerNote || null,
      actor: `manager:${row.managerName || 'dashboard'}`
    }).catch(() => {});
    res.json({ message: 'Rejected', row });
  } catch (err) {
    console.error('managerReject visit:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// -------------------- ADMIN: FINAL DECISION TO VISITOR --------------------

const _buildVisitorEmail = ({ row, accepted, customMessage }) => {
  const fmtTime = (t) => t ? String(t).slice(0, 5) : '—';
  const brand = accepted ? '#16a34a' : '#dc2626';
  const status = accepted ? 'تمت الموافقة على زيارتكم' : 'نأسف — لم نتمكن من قبول الزيارة';

  const visitNoStr = formatVisitNumber(row.visitNumber);
  return {
    subject: accepted
      ? `تمت الموافقة على زيارتكم لفاب لاب #${visitNoStr}`
      : `اعتذار بخصوص طلب زيارة فاب لاب #${visitNoStr}`,
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
      <tr><td style="padding:10px 14px;color:#64748b;width:130px;border-bottom:1px solid #e5e7eb">رقم الطلب:</td><td style="padding:10px 14px;font-weight:800;color:#0284c7;font-family:'JetBrains Mono',monospace;border-bottom:1px solid #e5e7eb">${visitNoStr}</td></tr>
      <tr><td style="padding:10px 14px;color:#64748b;width:130px;border-bottom:1px solid #e5e7eb">الجهة:</td><td style="padding:10px 14px;font-weight:700;border-bottom:1px solid #e5e7eb">${row.entityName}</td></tr>
      <tr><td style="padding:10px 14px;color:#64748b;border-bottom:1px solid #e5e7eb">تاريخ الزيارة:</td><td style="padding:10px 14px;direction:ltr;border-bottom:1px solid #e5e7eb">${row.visitDate}</td></tr>
      <tr><td style="padding:10px 14px;color:#64748b;border-bottom:1px solid #e5e7eb">الوقت:</td><td style="padding:10px 14px;direction:ltr;border-bottom:1px solid #e5e7eb">${fmtTime(row.visitStartTime)} → ${fmtTime(row.visitEndTime)}</td></tr>
      <tr><td style="padding:10px 14px;color:#64748b">عدد الزوار:</td><td style="padding:10px 14px">${row.visitorsCount || 1}</td></tr>
    </table>

    <div style="background:${accepted ? '#ecfdf5' : '#fef2f2'};padding:12px 14px;border-radius:8px;font-size:13px;color:${accepted ? '#166534' : '#991b1b'};margin-bottom:12px;border-inline-start:3px solid ${brand}">
      <div style="font-weight:800;margin-bottom:2px">قرار المدير</div>
      <div style="font-size:14px;font-weight:700">${accepted ? '✓ تمت الموافقة' : '✕ لم تتم الموافقة'}</div>
      ${row.managerName ? `<div style="font-size:12px;margin-top:4px;opacity:0.85">المعتمد: ${row.managerName}</div>` : ''}
    </div>

    ${customMessage ? `
      <div style="background:#eff6ff;padding:12px 14px;border-radius:8px;font-size:13px;color:#1e3a8a;margin-bottom:16px;border-inline-start:3px solid #3b82f6">
        <div style="font-weight:700;margin-bottom:4px">📝 ملاحظات مرفقة</div>
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

// Shared visitor-notify helper — sends the email + persists tracking
// fields. Callers pick between auto-fire (manager decision hooks
// below) and manual admin-triggered (notifyVisitor endpoint).
// Returns { sent: bool, reason: string } — never throws.
const _sendVisitorDecisionEmail = async (row, { accepted, customMessage, actor = 'system' }) => {
  if (!row?.email) return { sent: false, reason: 'no-email' };
  if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
    return { sent: false, reason: 'not-configured' };
  }
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
    await row.update({
      visitorDecision: accepted ? 'accepted' : 'rejected',
      visitorDecisionAt: new Date(),
      visitorDecisionBy: actor,
      visitorMessage: customMessage || row.visitorMessage,
      visitorEmailSentAt: new Date()
    });
    return { sent: true, reason: 'ok' };
  } catch (err) {
    console.error('visitor decision email failed:', err?.response?.body || err.message);
    return { sent: false, reason: 'send-failed' };
  }
};

// POST /fablab-visits/:id/notify-visitor — body { decision: 'accept'|'reject', message? }
// Admin-only. Manual re-send / follow-up notification. Works whether
// the manager approved OR rejected (auto-notify fires either way,
// but admin may want to add a customized message afterwards).
exports.notifyVisitor = async (req, res) => {
  try {
    const row = await FablabVisit.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });

    const decision = String(req.body?.decision || '').trim();
    if (decision !== 'accept' && decision !== 'reject') {
      return res.status(400).json({ message: 'decision must be accept or reject' });
    }

    // Allow manual notify for BOTH approved and rejected requests —
    // admin may want to add a follow-up message with custom notes
    // regardless of what the manager decided. Blocks only drafts /
    // still-pending requests so the visitor never gets a decision
    // email before the manager actually decides.
    if (row.approvalStatus !== 'approved' && row.approvalStatus !== 'rejected') {
      return res.status(409).json({
        message: 'Manager decision is required before notifying the visitor',
        messageAr: 'يجب الحصول على قرار المدير (قبول أو رفض) قبل إرسال الإشعار للزائر'
      });
    }

    const accepted = decision === 'accept';
    const customMessage = req.body?.message ? String(req.body.message).trim() : null;

    const result = await _sendVisitorDecisionEmail(row, {
      accepted,
      customMessage,
      actor: req.admin?.fullName || req.admin?.username || req.user?.username || 'admin'
    });

    res.json({
      message: !result.sent
        ? (result.reason === 'no-email'
            ? 'Decision saved — visitor has no email on file'
            : result.reason === 'not-configured'
              ? 'Decision saved — email service is not configured'
              : 'Decision saved — email delivery failed')
        : (accepted ? 'Visitor notified — accepted' : 'Visitor notified — rejected'),
      row,
      emailFailed: !result.sent,
      emailFailReason: result.reason
    });
  } catch (err) {
    console.error('notifyVisitor:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};
