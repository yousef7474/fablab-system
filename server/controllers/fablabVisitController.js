const { FablabVisit, FablabVisitSlot, Settings, RegistrationClosure } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const crypto = require('crypto');
const sgMail = require('@sendgrid/mail');
const { archiveSentApproval, markArchiveDecided } = require('./approvalArchiveController');
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

// -------------------- SLOTS + BOOKING RULES --------------------
// Visits are booked only into slots the admin opens (date, time window,
// capacity = most visitors one group may bring). One group per slot: a
// slot is taken while a visit pointing at it hasn't been rejected.
// Every 15 visitors (or part of 15) need at least 2 instructors.

const VISITORS_PER_INSTRUCTOR_PAIR = 15;
const requiredInstructors = (visitors) =>
  2 * Math.max(1, Math.ceil((Number(visitors) || 0) / VISITORS_PER_INSTRUCTOR_PAIR));

// Riyadh "now" as { date: 'YYYY-MM-DD', time: 'HH:MM' }.
const _riyadhNow = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const g = (t) => parts.find(p => p.type === t).value;
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour')}:${g('minute')}` };
};

const _hhmm = (t) => String(t || '').slice(0, 5);
const _isFutureSlot = (slot, now = _riyadhNow()) =>
  slot.date > now.date || (slot.date === now.date && _hhmm(slot.startTime) > now.time);

// A visit keeps its slot until it is rejected (by the manager or in the
// final decision to the visitor).
const _ACTIVE_VISIT = {
  approvalStatus: { [Op.ne]: 'rejected' },
  visitorDecision: { [Op.ne]: 'rejected' }
};

// slotId → the active visit holding it (for the given slot ids).
const _bookingsBySlot = async (slotIds, { transaction, excludeVisitId } = {}) => {
  if (!slotIds.length) return new Map();
  const where = { slotId: { [Op.in]: slotIds }, ..._ACTIVE_VISIT };
  if (excludeVisitId) where.visitId = { [Op.ne]: excludeVisitId };
  const rows = await FablabVisit.findAll({
    where,
    attributes: ['visitId', 'visitNumber', 'slotId', 'entityName', 'personInCharge', 'phone', 'visitorsCount', 'approvalStatus', 'visitorDecision'],
    transaction
  });
  return new Map(rows.map(r => [r.slotId, r]));
};

const _visitsClosed = async () => {
  const [d, r] = await Promise.all([
    Settings.findByPk('fablab_visit_disabled'),
    Settings.findByPk('fablab_visit_disabled_reason')
  ]);
  return { closed: !!(d && d.value), reason: (r && r.value) || '' };
};

const _slotOut = (slot) => ({
  slotId: slot.slotId,
  date: slot.date,
  startTime: _hhmm(slot.startTime),
  endTime: _hhmm(slot.endTime),
  capacity: slot.capacity
});

// GET /public/fablab-visit/slots — open, future, unbooked slots.
exports.publicSlots = async (req, res) => {
  try {
    const status = await _visitsClosed();
    if (status.closed) {
      return res.json({ open: false, reason: status.reason, slots: [], visitorsPerInstructorPair: VISITORS_PER_INSTRUCTOR_PAIR });
    }
    const now = _riyadhNow();
    const slots = await FablabVisitSlot.findAll({
      where: { isActive: true, date: { [Op.gte]: now.date } },
      order: [['date', 'ASC'], ['startTime', 'ASC']]
    });
    const future = slots.filter(sl => _isFutureSlot(sl, now));
    const booked = await _bookingsBySlot(future.map(sl => sl.slotId));
    res.json({
      open: true,
      reason: '',
      visitorsPerInstructorPair: VISITORS_PER_INSTRUCTOR_PAIR,
      slots: future.filter(sl => !booked.has(sl.slotId)).map(_slotOut)
    });
  } catch (err) {
    console.error('publicSlots:', err);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

// GET /fablab-visits/slots?from=YYYY-MM-DD&to=YYYY-MM-DD (admin) — every
// slot in the range with the visit holding it, if any.
exports.listSlots = async (req, res) => {
  try {
    const where = {};
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (iso.test(String(req.query.from || '')) || iso.test(String(req.query.to || ''))) {
      where.date = {};
      if (iso.test(String(req.query.from || ''))) where.date[Op.gte] = req.query.from;
      if (iso.test(String(req.query.to || ''))) where.date[Op.lte] = req.query.to;
    }
    const slots = await FablabVisitSlot.findAll({ where, order: [['date', 'ASC'], ['startTime', 'ASC']] });
    const booked = await _bookingsBySlot(slots.map(sl => sl.slotId));
    const now = _riyadhNow();
    res.json(slots.map(sl => {
      const b = booked.get(sl.slotId);
      return {
        ..._slotOut(sl),
        isActive: sl.isActive,
        notes: sl.notes,
        isPast: !_isFutureSlot(sl, now),
        booking: b ? {
          visitId: b.visitId,
          visitNumber: b.visitNumber,
          visitNumberLabel: formatVisitNumber(b.visitNumber),
          entityName: b.entityName,
          personInCharge: b.personInCharge,
          phone: b.phone,
          visitorsCount: b.visitorsCount,
          approvalStatus: b.approvalStatus,
          visitorDecision: b.visitorDecision
        } : null
      };
    }));
  } catch (err) {
    console.error('listSlots:', err);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

const _TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const _DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// POST /fablab-visits/slots (manager) — body { dates: [], startTime, endTime, capacity, notes? }
// Opens the same time window on every selected date.
exports.createSlots = async (req, res) => {
  try {
    const { startTime, endTime, notes } = req.body || {};
    const capacity = parseInt(req.body?.capacity, 10);
    const dates = [...new Set((Array.isArray(req.body?.dates) ? req.body.dates : []).map(String))];
    const now = _riyadhNow();
    if (!dates.length || dates.length > 62 || !dates.every(d => _DATE_RE.test(d))) {
      return res.status(400).json({ message: 'Choose one or more dates', messageAr: 'اختر يوماً واحداً على الأقل' });
    }
    if (dates.some(d => d < now.date)) {
      return res.status(400).json({ message: 'Dates in the past cannot be opened', messageAr: 'لا يمكن فتح مواعيد في أيام سابقة' });
    }
    if (!_TIME_RE.test(String(startTime || '')) || !_TIME_RE.test(String(endTime || '')) || startTime >= endTime) {
      return res.status(400).json({ message: 'Enter a valid time window (start before end)', messageAr: 'أدخل وقتاً صحيحاً (البداية قبل النهاية)' });
    }
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) {
      return res.status(400).json({ message: 'Capacity must be between 1 and 1000', messageAr: 'العدد المسموح يجب أن يكون بين 1 و 1000' });
    }
    const existing = await FablabVisitSlot.findAll({ where: { date: { [Op.in]: dates } } });
    const created = [];
    const skipped = [];
    for (const date of dates.sort()) {
      // Skip a window that overlaps one already open that day, or one
      // today whose start time has already passed.
      const clash = existing.find(e => e.date === date && _hhmm(e.startTime) < endTime && _hhmm(e.endTime) > startTime);
      if (clash || (date === now.date && startTime <= now.time)) { skipped.push(date); continue; }
      created.push(await FablabVisitSlot.create({
        date, startTime, endTime, capacity,
        notes: notes ? String(notes).trim().slice(0, 500) : null,
        createdBy: req.admin?.fullName || req.admin?.username || null
      }));
    }
    res.status(201).json({
      created: created.map(_slotOut),
      skipped,
      message: `${created.length} slot(s) opened${skipped.length ? `, ${skipped.length} skipped (overlapping an existing slot, or already started today)` : ''}`,
      messageAr: `تم فتح ${created.length} موعد${skipped.length ? ` — وتم تجاوز ${skipped.length} (تتعارض مع موعد قائم أو بدأ وقتها اليوم)` : ''}`
    });
  } catch (err) {
    console.error('createSlots:', err);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

// PUT /fablab-visits/slots/:id (manager) — { date?, startTime?, endTime?, capacity?, isActive?, notes? }
// A booked slot keeps its date and time; its capacity can't drop below
// the group already booked.
exports.updateSlot = async (req, res) => {
  try {
    const slot = await FablabVisitSlot.findByPk(req.params.id);
    if (!slot) return res.status(404).json({ message: 'Slot not found', messageAr: 'الموعد غير موجود' });
    const booking = (await _bookingsBySlot([slot.slotId])).get(slot.slotId);
    const b = req.body || {};
    const patch = {};
    const date = b.date !== undefined ? String(b.date) : slot.date;
    const startTime = b.startTime !== undefined ? String(b.startTime) : _hhmm(slot.startTime);
    const endTime = b.endTime !== undefined ? String(b.endTime) : _hhmm(slot.endTime);
    const moved = date !== slot.date || startTime !== _hhmm(slot.startTime) || endTime !== _hhmm(slot.endTime);
    if (moved) {
      if (booking) {
        return res.status(409).json({ message: 'This slot is booked — its date and time cannot change', messageAr: 'هذا الموعد محجوز — لا يمكن تغيير تاريخه أو وقته' });
      }
      if (!_DATE_RE.test(date) || !_TIME_RE.test(startTime) || !_TIME_RE.test(endTime) || startTime >= endTime) {
        return res.status(400).json({ message: 'Enter a valid date and time window', messageAr: 'أدخل تاريخاً ووقتاً صحيحين' });
      }
      Object.assign(patch, { date, startTime, endTime });
    }
    if (b.capacity !== undefined) {
      const capacity = parseInt(b.capacity, 10);
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) {
        return res.status(400).json({ message: 'Capacity must be between 1 and 1000', messageAr: 'العدد المسموح يجب أن يكون بين 1 و 1000' });
      }
      if (booking && capacity < (booking.visitorsCount || 0)) {
        return res.status(409).json({ message: `The booked group has ${booking.visitorsCount} visitors`, messageAr: `المجموعة المحجوزة عددها ${booking.visitorsCount} زائر — لا يمكن تقليل العدد عن ذلك` });
      }
      patch.capacity = capacity;
    }
    if (b.isActive !== undefined) patch.isActive = !!b.isActive;
    if (b.notes !== undefined) patch.notes = b.notes ? String(b.notes).trim().slice(0, 500) : null;
    await slot.update(patch);
    res.json(_slotOut(slot));
  } catch (err) {
    console.error('updateSlot:', err);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

// DELETE /fablab-visits/slots/:id (manager) — only while not booked.
exports.deleteSlot = async (req, res) => {
  try {
    const slot = await FablabVisitSlot.findByPk(req.params.id);
    if (!slot) return res.status(404).json({ message: 'Slot not found', messageAr: 'الموعد غير موجود' });
    const booking = (await _bookingsBySlot([slot.slotId])).get(slot.slotId);
    if (booking) {
      return res.status(409).json({ message: 'This slot is booked — reject or delete the visit first', messageAr: 'هذا الموعد محجوز — ارفض الطلب أو احذفه أولاً' });
    }
    await slot.destroy();
    res.json({ message: 'Deleted', messageAr: 'تم حذف الموعد' });
  } catch (err) {
    console.error('deleteSlot:', err);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

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

// Instructors as an email table (name · phone · job).
const _instructorsHtml = (row) => {
  const list = Array.isArray(row.instructors) ? row.instructors : [];
  if (!list.length) return '';
  const rows = list.map((i, k) => `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;color:#64748b">${k + 1}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-weight:600">${_esc(i.name)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb" dir="ltr">${_esc(i.phone)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${_esc(i.job || '—')}</td>
    </tr>`).join('');
  return `<div style="font-weight:700;color:#0369a1;margin:14px 0 6px;font-size:13px">المرافقون (${list.length})</div>
    <table style="width:100%;font-size:12.5px;border-collapse:collapse;background:#f8fafc;border-radius:8px;overflow:hidden">
      <tr style="background:#eef2f7"><th style="padding:6px 8px;text-align:start">#</th><th style="padding:6px 8px;text-align:start">الاسم</th><th style="padding:6px 8px;text-align:start">الجوال</th><th style="padding:6px 8px;text-align:start">الوظيفة</th></tr>
      ${rows}
    </table>`;
};

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
      ${Array.isArray(row.instructors) && row.instructors.length ? `<tr><td style="padding:8px 14px;color:#64748b">عدد المرافقين:</td><td style="padding:8px 14px">${row.instructors.length}</td></tr>` : ''}
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
      <tr><td style="padding:6px 0;color:#64748b">المشرف:</td><td style="padding:6px 0">${_esc(row.personInCharge)}</td></tr>
      ${row.supervisorJob ? `<tr><td style="padding:6px 0;color:#64748b">وظيفة المشرف:</td><td style="padding:6px 0">${_esc(row.supervisorJob)}</td></tr>` : ''}
      ${row.nationalId ? `<tr><td style="padding:6px 0;color:#64748b">رقم الهوية:</td><td style="padding:6px 0" dir="ltr">${_esc(row.nationalId)}</td></tr>` : ''}
      <tr><td style="padding:6px 0;color:#64748b">الجوال:</td><td style="padding:6px 0" dir="ltr">${_esc(row.phone)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">البريد:</td><td style="padding:6px 0" dir="ltr">${_esc(row.email)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">عدد الزوار:</td><td style="padding:6px 0">${_esc(row.visitorsCount)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">تاريخ الزيارة:</td><td style="padding:6px 0" dir="ltr">${_esc(row.visitDate)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">الوقت:</td><td style="padding:6px 0" dir="ltr">${_esc(row.visitStartTime)} → ${_esc(row.visitEndTime)}</td></tr>
      ${row.purpose ? `<tr><td style="padding:6px 0;color:#64748b;vertical-align:top">الغرض:</td><td style="padding:6px 0;white-space:pre-wrap">${_esc(row.purpose)}</td></tr>` : ''}
      ${row.notes ? `<tr><td style="padding:6px 0;color:#64748b;vertical-align:top">ملاحظات:</td><td style="padding:6px 0;white-space:pre-wrap">${_esc(row.notes)}</td></tr>` : ''}
    </table>
    ${_instructorsHtml(row)}
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
    const b = req.body || {};
    const entityName = String(b.entityName || '').trim();
    const supervisorName = String(b.supervisorName || b.personInCharge || '').trim();
    const supervisorJob = String(b.supervisorJob || '').trim();
    const phone = String(b.phone || '').trim();
    const email = String(b.email || '').trim();
    const visitorsCount = parseInt(b.visitorsCount, 10);

    const status = await _visitsClosed();
    if (status.closed) {
      return res.status(403).json({
        code: 'VISITS_CLOSED',
        message: status.reason || 'FabLab visit registration is currently closed',
        messageAr: status.reason || 'التسجيل في زيارات فاب لاب مغلق حالياً'
      });
    }

    if (!entityName || !supervisorName || !supervisorJob || !phone || !email || !b.slotId) {
      return res.status(400).json({ message: 'Missing required fields', messageAr: 'الرجاء تعبئة جميع الحقول المطلوبة' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Invalid email address', messageAr: 'البريد الإلكتروني غير صحيح' });
    }
    if (!Number.isInteger(visitorsCount) || visitorsCount < 1) {
      return res.status(400).json({ message: 'Enter the number of visitors', messageAr: 'أدخل عدد الزوار' });
    }

    // Instructors: at least 2 per 15 visitors, each with a name + phone.
    const need = requiredInstructors(visitorsCount);
    const instructors = (Array.isArray(b.instructors) ? b.instructors : [])
      .map(i => ({
        name: String(i?.name || '').trim().slice(0, 120),
        phone: String(i?.phone || '').trim().slice(0, 30),
        job: String(i?.job || '').trim().slice(0, 120)
      }))
      .filter(i => i.name || i.phone || i.job)
      .slice(0, 100);
    if (instructors.length < need || instructors.some(i => !i.name || !i.phone)) {
      return res.status(400).json({
        code: 'INSTRUCTORS_REQUIRED',
        required: need,
        message: `${visitorsCount} visitors need at least ${need} instructors (2 for every 15) — enter each instructor's name and phone`,
        messageAr: `عدد ${visitorsCount} زائر يتطلب ${need} مرافقين على الأقل (2 لكل 15 زائراً) — أدخل اسم ورقم جوال كل مرافق`
      });
    }

    const visitNumber = await _assignNextVisitNumber();

    // Lock the slot so two groups can't take it at the same moment.
    const result = await sequelize.transaction(async (t) => {
      const slot = await FablabVisitSlot.findByPk(String(b.slotId), { transaction: t, lock: t.LOCK.UPDATE });
      if (!slot || !slot.isActive || !_isFutureSlot(slot)) {
        throw { status: 409, code: 'SLOT_UNAVAILABLE', message: 'This slot is no longer available — choose another one', messageAr: 'هذا الموعد لم يعد متاحاً — اختر موعداً آخر' };
      }
      if (visitorsCount > slot.capacity) {
        throw { status: 400, code: 'OVER_CAPACITY', message: `This slot takes up to ${slot.capacity} visitors`, messageAr: `هذا الموعد يتسع لـ ${slot.capacity} زائر كحد أقصى` };
      }
      const taken = (await _bookingsBySlot([slot.slotId], { transaction: t })).get(slot.slotId);
      if (taken) {
        throw { status: 409, code: 'SLOT_UNAVAILABLE', message: 'This slot was just booked — choose another one', messageAr: 'تم حجز هذا الموعد للتو — اختر موعداً آخر' };
      }
      return FablabVisit.create({
        visitNumber,
        slotId: slot.slotId,
        entityName,
        personInCharge: supervisorName,
        supervisorJob,
        phone,
        email,
        instructors,
        visitorsCount,
        visitDate: slot.date,
        visitStartTime: _hhmm(slot.startTime),
        visitEndTime: _hhmm(slot.endTime),
        purpose: b.purpose ? String(b.purpose).trim().slice(0, 2000) : null,
        notes: b.notes ? String(b.notes).trim().slice(0, 2000) : null,
        approvalStatus: 'draft',
        visitorDecision: 'pending'
      }, { transaction: t });
    });
    const row = result;

    // Same notifications as before: ops inbox + confirmation to the visitor.
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
    if (err && err.status) {
      return res.status(err.status).json({ code: err.code, message: err.message, messageAr: err.messageAr });
    }
    console.error('publicCreate visit:', err);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
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
      <tr><td style="padding:6px 0;color:#64748b">المشرف:</td><td style="padding:6px 0">${_esc(row.personInCharge)}${row.supervisorJob ? ` — ${_esc(row.supervisorJob)}` : ''}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">الجوال:</td><td style="padding:6px 0;direction:ltr">${row.phone}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">البريد:</td><td style="padding:6px 0;direction:ltr">${row.email}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">عدد الزوار:</td><td style="padding:6px 0">${row.visitorsCount || 1}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">تاريخ الزيارة:</td><td style="padding:6px 0;direction:ltr">${row.visitDate}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">الوقت:</td><td style="padding:6px 0;direction:ltr">${fmtTime(row.visitStartTime)} → ${fmtTime(row.visitEndTime)}</td></tr>
    </table>

    ${row.purpose ? `<div style="background:#f8fafc;padding:12px 14px;border-radius:8px;font-size:13px;color:#334155;margin-bottom:16px">
      <div style="font-weight:700;color:#0369a1;margin-bottom:4px">الغرض من الزيارة</div>
      <div style="white-space:pre-wrap">${_esc(row.purpose)}</div>
    </div>` : ''}
    ${_instructorsHtml(row) ? `<div style="margin-bottom:16px">${_instructorsHtml(row)}</div>` : ''}

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
المشرف: ${row.personInCharge}${row.supervisorJob ? ` (${row.supervisorJob})` : ''}
تاريخ الزيارة: ${row.visitDate}  ${fmtTime(row.visitStartTime)} - ${fmtTime(row.visitEndTime)}
عدد الزوار: ${row.visitorsCount || 1}
عدد المرافقين: ${Array.isArray(row.instructors) ? row.instructors.length : 0}
${row.purpose ? `\nالغرض:\n${row.purpose}\n` : ''}
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

    // A rejected booking gave its slot back; re-sending it must not
    // double-book a slot another group has taken since.
    if (row.slotId) {
      const other = (await _bookingsBySlot([row.slotId], { excludeVisitId: row.visitId })).get(row.slotId);
      if (other) {
        return res.status(409).json({
          message: `This slot is now booked by ${other.entityName} — move this visit to another slot first`,
          messageAr: `هذا الموعد محجوز الآن لـ ${other.entityName} — لا يمكن إعادة إرسال الطلب على نفس الموعد`
        });
      }
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

    let archivedSubject = null;
    let archivedEmailHtml = null;
    try {
      const mail = _buildManagerEmail({ row, token, origin: _publicOrigin() });
      archivedSubject = mail.subject;
      archivedEmailHtml = mail.html;
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
      // Archive the attempt so it's visible in the archive with a
      // "pending" status; admin can hit Resend from there.
      if (archivedEmailHtml) {
        archiveSentApproval({
          type: 'fablab_visit',
          sourceId: row.visitId,
          requestNumber: row.visitNumber != null ? formatVisitNumber(row.visitNumber) : null,
          title: row.entityName || row.personInCharge || 'FabLab Visit',
          managerEmail,
          subject: archivedSubject,
          emailHtml: archivedEmailHtml,
          payloadSnapshot: row.toJSON(),
          sentById: req.admin?.adminId || null
        });
      }
      return res.json({
        message: 'Marked pending — email delivery failed, try resending',
        messageAr: 'تم حفظ الطلب — فشل إرسال البريد، حاول إعادة الإرسال',
        row,
        emailFailed: true,
        emailFailReason: 'send-failed'
      });
    }

    if (archivedEmailHtml) {
      archiveSentApproval({
        type: 'fablab_visit',
        sourceId: row.visitId,
        requestNumber: row.visitNumber != null ? formatVisitNumber(row.visitNumber) : null,
        title: row.entityName || row.personInCharge || 'FabLab Visit',
        managerEmail,
        subject: archivedSubject,
        emailHtml: archivedEmailHtml,
        payloadSnapshot: row.toJSON(),
        sentById: req.admin?.adminId || null
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
      supervisorJob: row.supervisorJob,
      instructors: row.instructors || [],
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

    markArchiveDecided({
      type: 'fablab_visit',
      sourceId: row.visitId,
      status: decision === 'approve' ? 'approved' : 'rejected',
      managerName: row.managerName
    });

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
    markArchiveDecided({
      type: 'fablab_visit',
      sourceId: row.visitId,
      status: 'approved',
      managerName: row.managerName
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
    markArchiveDecided({
      type: 'fablab_visit',
      sourceId: row.visitId,
      status: 'rejected',
      managerName: row.managerName
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

// Exposed for the archive backfill (server/utils/backfillApprovalArchive.js).
exports._buildManagerEmail = _buildManagerEmail;
exports._formatVisitNumber = formatVisitNumber;
exports._publicOrigin = _publicOrigin;
