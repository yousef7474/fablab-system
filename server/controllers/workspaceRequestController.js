const { Op } = require('sequelize');
const QRCode = require('qrcode');
const { sequelize } = require('../config/database');
const { WorkspaceRequest, WorkspaceDayLog, WorkspaceAttendance, Settings, User } = require('../models');
const { rateLimited } = require('../utils/siteContent');
const { buildQrPayload, requireRole } = require('../utils/qrPayload');
const {
  UNITS, UNIT_CODES, HOURS, MAX_MONTHS, MAX_DAYS_AHEAD, HOLDS, APPLICANT_TYPES,
  BookingError, checkPeriod, overlaps, riyadhToday, workingDaysIn, addDays, addMonths
} = require('../utils/workspaceBooking');
const { sendReceived, sendOpsNotice, sendDecision, sendUpdated } = require('../utils/workspaceRequestEmail');

// Workspace registration: the public /workspace page books one of the 8
// free workspaces for a period and a daily time, for a team of 1–4 people
// (returning users are looked up, new ones registered). Admins and
// managers accept or reject, print the banner and the members' ID cards
// (scanned at the attendance station as FL:WSM:<national ID>) and rate
// the booking day by day. A pending or accepted request holds its
// workspace, so the page only offers workspaces free for the whole period.

const REF_SEQ_KEY = 'workspace_request_seq';
const MAX_PEOPLE = 4;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?\d{8,15}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const IMAGE_RE = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGES = 6;
const MAX_IMAGE_CHARS = 3 * 1024 * 1024;

const _str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const _digits = (v) => _str(v, 40).replace(/[\s()-]/g, '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const _who = (req) => req.admin?.fullName || req.admin?.username || null;
const _fail = (res, e) => {
  if (e instanceof BookingError) {
    return res.status(e.status).json({ message: e.message, messageAr: e.messageAr, field: e.field, code: e.code, ...(e.extra || {}) });
  }
  console.error('Workspace request error:', e);
  return res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
};
const _err = (status, code, en, ar, field = null, extra = null) => {
  const e = new BookingError(en, ar, field, code);
  e.status = status;
  e.extra = extra;
  return e;
};
const unitLabel = (code) => UNITS.find(u => u.code === code)?.label || code;

async function _status() {
  const [disabled, reason, days] = await Promise.all([
    Settings.findByPk('workspace_registration_disabled'),
    Settings.findByPk('workspace_registration_disabled_reason'),
    Settings.findByPk('working_days')
  ]);
  return {
    closed: !!disabled?.value,
    reason: disabled?.value ? (reason?.value || '') : '',
    workingDays: Array.isArray(days?.value) ? days.value : [0, 1, 2, 3, 4]
  };
}

const _closed = (res, reason) => res.status(403).json({
  code: 'WORKSPACE_CLOSED', reason,
  message: 'Workspace registration is closed', messageAr: reason || 'التسجيل في مساحات العمل مغلق حاليًا'
});

// Codes of the workspaces held for (part of) this period + time.
async function _takenUnits(period, workingDays, { transaction, excludeId } = {}) {
  const rows = await WorkspaceRequest.findAll({
    attributes: ['requestId', 'unitCode', 'startDate', 'endDate', 'startTime', 'endTime'],
    where: {
      status: { [Op.in]: HOLDS },
      startDate: { [Op.lte]: period.endDate },
      endDate: { [Op.gte]: period.startDate },
      ...(excludeId ? { requestId: { [Op.ne]: excludeId } } : {})
    },
    transaction
  });
  return new Set(rows.filter(r => overlaps(r, period, workingDays)).map(r => r.unitCode));
}

const _period = (q) => ({
  startDate: _str(q.startDate, 10), endDate: _str(q.endDate, 10),
  startTime: _str(q.startTime, 5), endTime: _str(q.endTime, 5)
});

// The member list as stored → what the admin board / cards need.
const _memberOut = (m) => ({
  userId: m.userId || null,
  name: m.name || [m.firstName, m.lastName].filter(Boolean).join(' '),
  firstName: m.firstName || '',
  lastName: m.lastName || '',
  sex: m.sex || null,
  nationality: m.nationality || '',
  nationalId: m.nationalId || '',
  phoneNumber: m.phoneNumber || '',
  email: m.email || '',
  currentJob: m.currentJob || '',
  isNew: !!m.isNew
});
// Older requests (before teams) only have the leader's contact fields.
const _members = (r) => (Array.isArray(r.members) && r.members.length
  ? r.members.map(_memberOut)
  : [_memberOut({ name: r.fullName, phoneNumber: r.phone, email: r.email })]);
const _personKey = (m) => m.nationalId || m.userId || '';

// ---------- public (/api/public/workspace) — never 401 ----------

exports.publicStatus = async (req, res) => {
  try {
    const s = await _status();
    res.json({
      open: !s.closed, reason: s.reason || null, units: UNITS, hours: HOURS,
      workingDays: s.workingDays, maxMonths: MAX_MONTHS, maxDaysAhead: MAX_DAYS_AHEAD,
      maxPeople: MAX_PEOPLE, today: riyadhToday()
    });
  } catch (e) { _fail(res, e); }
};

// Which workspace is booked when, day by day (no personal details) — the
// page colours its calendar and time band from this.
exports.publicCalendar = async (req, res) => {
  try {
    const s = await _status();
    const today = riyadhToday();
    const from = DATE_RE.test(req.query.from || '') ? req.query.from : today;
    let to = DATE_RE.test(req.query.to || '') ? req.query.to : addDays(from, 41);
    if (to < from) to = from;
    if (to > addDays(from, 100)) to = addDays(from, 100);
    const rows = await WorkspaceRequest.findAll({
      attributes: ['unitCode', 'startDate', 'endDate', 'startTime', 'endTime'],
      where: { status: { [Op.in]: HOLDS }, startDate: { [Op.lte]: to }, endDate: { [Op.gte]: from } }
    });
    const days = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const working = workingDaysIn(d, d, s.workingDays).length > 0;
      days.push({
        date: d,
        working,
        past: d < today,
        bookings: working
          ? rows.filter(r => r.startDate <= d && r.endDate >= d).map(r => ({ unit: r.unitCode, start: r.startTime, end: r.endTime }))
          : []
      });
    }
    res.json({ from, to, today, workingDays: s.workingDays, hours: HOURS, units: UNITS, days });
  } catch (e) { _fail(res, e); }
};

exports.publicAvailability = async (req, res) => {
  try {
    const s = await _status();
    if (s.closed) return _closed(res, s.reason);
    const period = _period(req.query);
    checkPeriod(period, s.workingDays);
    const taken = await _takenUnits(period, s.workingDays);
    res.json({ units: UNITS.map(u => ({ ...u, available: !taken.has(u.code) })) });
  } catch (e) { _fail(res, e); }
};

// A returning user, by national ID or phone — only enough to confirm it's them.
exports.publicLookup = async (req, res) => {
  try {
    if (rateLimited(req, 'workspace-lookup', 30, 10 * 60 * 1000)) {
      return res.status(429).json({ message: 'Too many lookups — try again later', messageAr: 'محاولات كثيرة، حاول لاحقًا' });
    }
    const id = _digits(req.body?.identifier);
    if (id.length < 6) return res.json({ found: false });
    const user = await User.findOne({ where: { [Op.or]: [{ nationalId: id }, { phoneNumber: id }] } });
    if (!user) return res.json({ found: false });
    const phone = String(user.phoneNumber || '');
    res.json({
      found: true,
      member: {
        userId: user.userId,
        firstName: user.firstName || (user.name || '').split(' ')[0] || '',
        lastInitial: (user.lastName || '').slice(0, 1),
        phoneHint: phone.length > 4 ? `${phone.slice(0, 2)}${'•'.repeat(Math.max(phone.length - 4, 3))}${phone.slice(-2)}` : ''
      }
    });
  } catch (e) { _fail(res, e); }
};

// Checks the team and resolves it to stored members. New people are
// returned with `isNew` (their User rows are created inside the booking
// transaction).
async function _resolveMembers(list, applicantType, t = null) {
  if (!Array.isArray(list) || list.length < 1 || list.length > MAX_PEOPLE) {
    throw _err(400, 'INVALID', `A team has 1 to ${MAX_PEOPLE} people`, `عدد أفراد الفريق من 1 إلى ${MAX_PEOPLE}`, 'members');
  }
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const raw = list[i] || {};
    const at = (f) => `members.${i}.${f}`;
    if (raw.existingUserId) {
      const user = await User.findByPk(_str(raw.existingUserId, 30), { transaction: t });
      if (!user) throw _err(400, 'INVALID', 'Registered user not found', 'لم يتم العثور على المستخدم المسجّل', at('existingUserId'), { index: i });
      out.push({
        userId: user.userId, firstName: user.firstName || '', lastName: user.lastName || '',
        name: user.name || [user.firstName, user.lastName].filter(Boolean).join(' '),
        sex: user.sex || null, nationality: user.nationality || '', nationalId: user.nationalId || '',
        phoneNumber: user.phoneNumber || '', email: user.email || '', currentJob: user.currentJob || '', isNew: false
      });
      continue;
    }
    const m = {
      firstName: _str(raw.firstName, 80), lastName: _str(raw.lastName, 80),
      sex: raw.sex === 'Female' ? 'Female' : raw.sex === 'Male' ? 'Male' : null,
      nationality: _str(raw.nationality, 80), nationalId: _digits(raw.nationalId),
      phoneNumber: _digits(raw.phoneNumber), email: _str(raw.email, 150).toLowerCase(),
      currentJob: _str(raw.currentJob, 200), nationalAddress: _str(raw.nationalAddress, 500) || null
    };
    const need = [
      ['firstName', 'First name', 'الاسم الأول'], ['lastName', 'Last name', 'اسم العائلة'],
      ['sex', 'Gender', 'الجنس'], ['nationality', 'Nationality', 'الجنسية'],
      ['nationalId', 'National ID', 'رقم الهوية'], ['phoneNumber', 'Mobile', 'رقم الجوال'],
      ['email', 'Email', 'البريد الإلكتروني'], ['currentJob', 'Organization', 'اسم الجهة']
    ];
    for (const [f, en, ar] of need) {
      if (!m[f]) throw _err(400, 'INVALID', `${en} is required (person ${i + 1})`, `${ar} مطلوب (الشخص ${i + 1})`, at(f), { index: i });
    }
    if (!/^\d{6,15}$/.test(m.nationalId)) throw _err(400, 'INVALID', 'Invalid national ID', 'رقم هوية غير صحيح', at('nationalId'), { index: i });
    if (!PHONE_RE.test(m.phoneNumber)) throw _err(400, 'INVALID', 'Invalid mobile number', 'رقم جوال غير صحيح', at('phoneNumber'), { index: i });
    if (!EMAIL_RE.test(m.email)) throw _err(400, 'INVALID', 'Invalid email', 'بريد إلكتروني غير صحيح', at('email'), { index: i });
    // Already registered? Then they should be looked up instead.
    const clash = await User.findOne({ where: { [Op.or]: [{ nationalId: m.nationalId }, { phoneNumber: m.phoneNumber }, { email: m.email }] }, transaction: t });
    if (clash) {
      const field = clash.nationalId === m.nationalId ? 'nationalId' : clash.phoneNumber === m.phoneNumber ? 'phoneNumber' : 'email';
      throw _err(409, 'MEMBER_EXISTS', `Person ${i + 1} is already registered — use the lookup`,
        `الشخص ${i + 1} مسجّل لدينا مسبقًا — اختر «مسجّل سابقًا» وأدخل رقم هويته أو جواله`, at(field), { index: i });
    }
    out.push({ ...m, name: `${m.firstName} ${m.lastName}`, isNew: true, applicationType: applicantType === 'Entity' ? 'Beneficiary' : applicantType });
  }
  // The same person twice in one team.
  const seen = new Set();
  out.forEach((m, i) => {
    for (const k of [m.userId, m.nationalId, m.phoneNumber].filter(Boolean)) {
      if (seen.has(k)) throw _err(400, 'INVALID', 'The same person appears twice', 'تكرر نفس الشخص في الفريق', `members.${i}`, { index: i });
      seen.add(k);
    }
  });
  return out;
}

// New people (isNew, no userId yet) become registered users (U#…), like
// the main registration. Runs inside the booking lock / transaction.
async function _createUsers(members, t) {
  let nextId = null;
  for (const m of members.filter(x => x.isNew && !x.userId)) {
    if (!nextId) {
      const [[top]] = await sequelize.query(
        `SELECT MAX(CAST(SUBSTRING("userId" FROM 3) AS INTEGER)) AS n FROM users WHERE "userId" ~ '^U#[0-9]+$'`,
        { transaction: t }
      );
      nextId = (Number(top?.n) || 0) + 1;
    }
    let userId = `U#${String(nextId).padStart(5, '0')}`;
    // eslint-disable-next-line no-await-in-loop
    while (await User.findByPk(userId, { transaction: t })) { nextId += 1; userId = `U#${String(nextId).padStart(5, '0')}`; }
    nextId += 1;
    await User.create({
      userId, applicationType: m.applicationType || 'Beneficiary', firstName: m.firstName, lastName: m.lastName, name: m.name,
      sex: m.sex, nationality: m.nationality, nationalId: m.nationalId, phoneNumber: m.phoneNumber,
      email: m.email, currentJob: m.currentJob, nationalAddress: m.nationalAddress
    }, { transaction: t });
    m.userId = userId;
  }
}

exports.publicSubmit = async (req, res) => {
  try {
    if (rateLimited(req, 'workspace-request', 6, 10 * 60 * 1000)) {
      return res.status(429).json({ message: 'Too many requests — try again later', messageAr: 'محاولات كثيرة، حاول لاحقًا' });
    }
    const s = await _status();
    if (s.closed) return _closed(res, s.reason);

    const b = req.body || {};
    const data = {
      applicantType: _str(b.applicantType, 20),
      organization: _str(b.organization, 200) || null,
      projectName: _str(b.projectName, 200),
      projectDescription: _str(b.projectDescription, 3000) || null,
      unitCode: _str(b.unitCode, 10),
      ..._period(b)
    };
    if (!APPLICANT_TYPES[data.applicantType]) throw new BookingError('Pick who you are', 'اختر صفة المسجّل', 'applicantType', 'INVALID');
    if (!data.projectName) throw new BookingError('Enter the project name', 'أدخل اسم المشروع', 'projectName', 'INVALID');
    if (!UNIT_CODES.includes(data.unitCode)) throw new BookingError('Pick a workspace', 'اختر مساحة العمل', 'unitCode', 'INVALID');
    if (b.acceptTerms !== true) {
      throw new BookingError('Accept the terms and conditions', 'يجب الموافقة على الشروط والأحكام', 'acceptTerms', 'INVALID');
    }
    checkPeriod(data, s.workingDays);
    const members = await _resolveMembers(b.members, data.applicantType);

    const row = await sequelize.transaction(async (t) => {
      // One booking at a time, so two people can't take the same workspace.
      await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:k))', { replacements: { k: 'workspace-requests' }, transaction: t });
      const taken = await _takenUnits(data, s.workingDays, { transaction: t });
      if (taken.has(data.unitCode)) {
        throw _err(409, 'UNIT_TAKEN', 'This workspace was just taken — pick another', 'تم حجز مساحة العمل هذه للتو، اختر مساحة أخرى', 'unitCode');
      }
      await _createUsers(members, t);
      const seq = await Settings.findByPk(REF_SEQ_KEY, { transaction: t });
      const next = (Number(seq?.value) || 0) + 1;
      await Settings.upsert({ key: REF_SEQ_KEY, value: next }, { transaction: t });
      const leader = members[0];
      return WorkspaceRequest.create({
        ...data,
        requestNumber: `WS-${String(next).padStart(4, '0')}`,
        fullName: leader.name,
        phone: leader.phoneNumber,
        email: leader.email,
        peopleCount: members.length,
        members: members.map(({ applicationType, nationalAddress, ...m }) => m),
        termsAcceptedAt: new Date()
      }, { transaction: t });
    });

    sendReceived(row).catch(() => {});
    sendOpsNotice(row).catch(() => {});
    res.status(201).json({ requestNumber: row.requestNumber });
  } catch (e) { _fail(res, e); }
};

// ---------- admin + manager (/api/workspace-requests) ----------

exports.list = async (req, res) => {
  try {
    const status = String(req.query.status || 'all');
    const where = ['pending', 'approved', 'rejected'].includes(status) ? { status } : {};
    const [requests, grouped, logCounts] = await Promise.all([
      WorkspaceRequest.findAll({ where, order: [['createdAt', 'DESC']] }),
      WorkspaceRequest.findAll({ attributes: ['status', [sequelize.fn('COUNT', sequelize.col('requestId')), 'n']], group: ['status'], raw: true }),
      WorkspaceDayLog.findAll({ attributes: ['requestId', [sequelize.fn('COUNT', sequelize.col('logId')), 'n'], [sequelize.fn('AVG', sequelize.col('rating')), 'avg']], group: ['requestId'], raw: true })
    ]);
    const counts = { pending: 0, approved: 0, rejected: 0 };
    grouped.forEach(g => { counts[g.status] = Number(g.n); });
    const logs = Object.fromEntries(logCounts.map(l => [l.requestId, { count: Number(l.n), avg: Math.round(Number(l.avg) * 10) / 10 }]));
    res.json({
      requests: requests.map(r => ({ ...r.toJSON(), members: _members(r), dayLogs: logs[r.requestId] || { count: 0, avg: null } })),
      counts,
      units: UNITS
    });
  } catch (e) { _fail(res, e); }
};

exports.decide = async (req, res) => {
  try {
    const decision = req.body?.decision;
    const note = _str(req.body?.note, 2000) || null;
    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ message: 'Unknown decision', messageAr: 'قرار غير معروف' });
    }
    if (decision === 'reject' && !note) {
      return res.status(400).json({ message: 'Write the reason for rejecting', messageAr: 'اكتب سبب الرفض', field: 'note' });
    }
    const s = await _status();
    const row = await sequelize.transaction(async (t) => {
      await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:k))', { replacements: { k: 'workspace-requests' }, transaction: t });
      const r = await WorkspaceRequest.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!r) throw _err(404, 'NOT_FOUND', 'Request not found', 'الطلب غير موجود');
      if (decision === 'approve') {
        // Another accepted request may have taken this workspace meanwhile.
        const clash = await WorkspaceRequest.findAll({
          where: {
            requestId: { [Op.ne]: r.requestId }, unitCode: r.unitCode, status: 'approved',
            startDate: { [Op.lte]: r.endDate }, endDate: { [Op.gte]: r.startDate }
          },
          transaction: t
        });
        const hit = clash.find(c => overlaps(c, r, s.workingDays));
        if (hit) throw _err(409, 'CLASH', `Clashes with accepted request ${hit.requestNumber}`, `يتعارض مع الطلب المقبول ${hit.requestNumber}`);
      }
      await r.update({
        status: decision === 'approve' ? 'approved' : 'rejected',
        decisionNote: note, decidedBy: _who(req), decidedAt: new Date()
      }, { transaction: t });
      return r;
    });
    const sent = await sendDecision(row);
    if (sent.ok) await row.update({ decisionEmailSentAt: new Date() });
    res.json({ request: row, emailSent: !!sent.ok, emailError: sent.ok ? null : sent.reason });
  } catch (e) { _fail(res, e); }
};

exports.remove = async (req, res) => {
  try {
    const r = await WorkspaceRequest.findByPk(req.params.id);
    if (!r) return res.status(404).json({ message: 'Request not found', messageAr: 'الطلب غير موجود' });
    // Kept in the database (deletedAt) — it stays in each person's archive
    // and frees the workspace.
    await r.update({ history: [...(r.history || []), { action: 'deleted', at: new Date(), by: _who(req) }] });
    await r.destroy();
    res.json({ ok: true });
  } catch (e) { _fail(res, e); }
};

// Admin period check: like the public one, but an ongoing booking may have
// started in the past and the admin may go past one month.
function _checkAdminPeriod(p, workingDays) {
  const ok = (d) => DATE_RE.test(d || '') && !Number.isNaN(Date.parse(d));
  if (!ok(p.startDate)) throw new BookingError('Pick a start date', 'اختر تاريخ البداية', 'startDate');
  if (!ok(p.endDate)) throw new BookingError('Pick an end date', 'اختر تاريخ النهاية', 'endDate');
  if (p.endDate < p.startDate) throw new BookingError('The end date is before the start date', 'تاريخ النهاية قبل تاريخ البداية', 'endDate');
  if (p.endDate > addDays(p.startDate, 366)) throw new BookingError('A booking can last a year at most', 'لا تتجاوز مدة الحجز سنة', 'endDate');
  const TIME = /^([01]\d|2[0-3]):(00|30)$/;
  if (!TIME.test(p.startTime || '') || !TIME.test(p.endTime || '')) throw new BookingError('Pick the daily times', 'اختر وقت البداية والنهاية', 'startTime');
  if (p.startTime < HOURS.start || p.endTime > HOURS.end) {
    throw new BookingError(`Times must be within ${HOURS.start}–${HOURS.end}`, `الوقت يجب أن يكون بين ${HOURS.start} و ${HOURS.end}`, 'startTime');
  }
  if (p.endTime <= p.startTime) throw new BookingError('The end time must be after the start time', 'وقت النهاية يجب أن يكون بعد وقت البداية', 'endTime');
  if (!workingDaysIn(p.startDate, p.endDate, workingDays).length) {
    throw new BookingError('The period has no FabLab working days', 'الفترة لا تتضمن أيام عمل فاب لاب', 'startDate');
  }
}

// Does another holding request take this workspace in this period / time?
async function _clash(r, period, unitCode, workingDays, t) {
  const rows = await WorkspaceRequest.findAll({
    where: {
      requestId: { [Op.ne]: r.requestId }, unitCode, status: { [Op.in]: HOLDS },
      startDate: { [Op.lte]: period.endDate }, endDate: { [Op.gte]: period.startDate }
    },
    transaction: t
  });
  return rows.find(c => overlaps(c, period, workingDays)) || null;
}

// The admin's edited team → stored members. Members already on the booking
// keep their user link (their user record is updated with the edits); new
// rows are a returning user ({ existingUserId }) or a new person.
async function _resolveEditedMembers(list, applicantType, current, t) {
  if (!Array.isArray(list) || list.length < 1 || list.length > MAX_PEOPLE) {
    throw _err(400, 'INVALID', `A team has 1 to ${MAX_PEOPLE} people`, `عدد أفراد الفريق من 1 إلى ${MAX_PEOPLE}`, 'members');
  }
  const out = [];
  const fresh = [];
  for (let i = 0; i < list.length; i++) {
    const raw = list[i] || {};
    const at = (f) => `members.${i}.${f}`;
    if (raw.existingUserId && !current.some(m => m.userId === raw.existingUserId)) {
      fresh.push({ i, raw: { existingUserId: raw.existingUserId } });
      out.push(null);
      continue;
    }
    if (!raw.userId && !raw.keep) {
      fresh.push({ i, raw });
      out.push(null);
      continue;
    }
    // A member already on the booking, possibly edited.
    const m = {
      userId: raw.userId || null,
      firstName: _str(raw.firstName, 80), lastName: _str(raw.lastName, 80),
      sex: raw.sex === 'Female' ? 'Female' : raw.sex === 'Male' ? 'Male' : null,
      nationality: _str(raw.nationality, 80), nationalId: _digits(raw.nationalId),
      phoneNumber: _digits(raw.phoneNumber), email: _str(raw.email, 150).toLowerCase(),
      currentJob: _str(raw.currentJob, 200), isNew: !!raw.isNew
    };
    m.name = [m.firstName, m.lastName].filter(Boolean).join(' ') || _str(raw.name, 200);
    if (!m.name) throw _err(400, 'INVALID', `Name is required (person ${i + 1})`, `الاسم مطلوب (الشخص ${i + 1})`, at('firstName'), { index: i });
    if (m.phoneNumber && !PHONE_RE.test(m.phoneNumber)) throw _err(400, 'INVALID', 'Invalid mobile number', 'رقم جوال غير صحيح', at('phoneNumber'), { index: i });
    if (m.email && !EMAIL_RE.test(m.email)) throw _err(400, 'INVALID', 'Invalid email', 'بريد إلكتروني غير صحيح', at('email'), { index: i });
    if (m.nationalId && !/^\d{6,15}$/.test(m.nationalId)) throw _err(400, 'INVALID', 'Invalid national ID', 'رقم هوية غير صحيح', at('nationalId'), { index: i });
    if (m.userId) {
      const user = await User.findByPk(m.userId, { transaction: t });
      if (user) {
        const clash = await User.findOne({
          where: {
            userId: { [Op.ne]: user.userId },
            [Op.or]: [m.nationalId && { nationalId: m.nationalId }, m.phoneNumber && { phoneNumber: m.phoneNumber }, m.email && { email: m.email }].filter(Boolean)
          },
          transaction: t
        });
        if (clash) {
          throw _err(409, 'MEMBER_EXISTS', `Person ${i + 1}: those details belong to another registered user`,
            `الشخص ${i + 1}: هذه البيانات مسجّلة لمستخدم آخر (${clash.name || clash.userId})`, at('nationalId'), { index: i });
        }
        const patch = {};
        for (const k of ['firstName', 'lastName', 'sex', 'nationality', 'nationalId', 'phoneNumber', 'email', 'currentJob']) {
          if (m[k] && m[k] !== user[k]) patch[k] = m[k];
        }
        if (patch.firstName || patch.lastName) patch.name = m.name;
        if (Object.keys(patch).length) await user.update(patch, { transaction: t });
      }
    }
    out.push(m);
  }
  if (fresh.length) {
    const resolved = await _resolveMembers(fresh.map(f => f.raw), applicantType, t);
    fresh.forEach((f, k) => { out[f.i] = resolved[k]; });
    await _createUsers(out, t);
  }
  const seen = new Set();
  out.forEach((m, i) => {
    for (const k of [m.userId, m.nationalId, m.phoneNumber].filter(Boolean)) {
      if (seen.has(k)) throw _err(400, 'INVALID', 'The same person appears twice', 'تكرر نفس الشخص في الفريق', `members.${i}`, { index: i });
      seen.add(k);
    }
  });
  return out.map(({ applicationType, nationalAddress, ...m }) => m);
}

// PUT /api/workspace-requests/:id — the admin edits the booking and team.
exports.update = async (req, res) => {
  try {
    const s = await _status();
    const b = req.body || {};
    const row = await sequelize.transaction(async (t) => {
      await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:k))', { replacements: { k: 'workspace-requests' }, transaction: t });
      const r = await WorkspaceRequest.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!r) throw _err(404, 'NOT_FOUND', 'Request not found', 'الطلب غير موجود');
      const data = {
        applicantType: APPLICANT_TYPES[b.applicantType] ? b.applicantType : r.applicantType,
        organization: b.organization !== undefined ? (_str(b.organization, 200) || null) : r.organization,
        projectName: b.projectName !== undefined ? _str(b.projectName, 200) : r.projectName,
        projectDescription: b.projectDescription !== undefined ? (_str(b.projectDescription, 3000) || null) : r.projectDescription,
        unitCode: UNIT_CODES.includes(b.unitCode) ? b.unitCode : r.unitCode,
        startDate: b.startDate || r.startDate, endDate: b.endDate || r.endDate,
        startTime: b.startTime || r.startTime, endTime: b.endTime || r.endTime
      };
      if (!data.projectName) throw new BookingError('Enter the project name', 'أدخل اسم المشروع', 'projectName', 'INVALID');
      _checkAdminPeriod(data, s.workingDays);
      if (HOLDS.includes(r.status)) {
        const hit = await _clash(r, data, data.unitCode, s.workingDays, t);
        if (hit) throw _err(409, 'CLASH', `Clashes with ${hit.requestNumber}`, `يتعارض مع الطلب ${hit.requestNumber} على نفس المساحة`, 'unitCode');
      }
      if (Array.isArray(b.members)) {
        data.members = await _resolveEditedMembers(b.members, data.applicantType, _members(r), t);
        const leader = data.members[0];
        Object.assign(data, { fullName: leader.name, phone: leader.phoneNumber || r.phone, email: leader.email || r.email, peopleCount: data.members.length });
      }
      const before = { unitCode: r.unitCode, startDate: r.startDate, endDate: r.endDate, startTime: r.startTime, endTime: r.endTime, peopleCount: r.peopleCount };
      const after = { unitCode: data.unitCode, startDate: data.startDate, endDate: data.endDate, startTime: data.startTime, endTime: data.endTime, peopleCount: data.peopleCount || r.peopleCount };
      await r.update({
        ...data,
        history: [...(r.history || []), { action: 'edited', at: new Date(), by: _who(req), from: before, to: after, note: _str(b.note, 500) || null }]
      }, { transaction: t });
      return r;
    });
    let emailSent = false;
    if (b.notify) emailSent = (await sendUpdated(row, 'edited')).ok;
    res.json({ request: { ...row.toJSON(), members: _members(row) }, emailSent });
  } catch (e) { _fail(res, e); }
};

// POST /api/workspace-requests/:id/extend — a new end date (and optionally
// a new daily time) instead of a new registration.
exports.extend = async (req, res) => {
  try {
    const s = await _status();
    const b = req.body || {};
    const row = await sequelize.transaction(async (t) => {
      await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:k))', { replacements: { k: 'workspace-requests' }, transaction: t });
      const r = await WorkspaceRequest.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!r) throw _err(404, 'NOT_FOUND', 'Request not found', 'الطلب غير موجود');
      if (!HOLDS.includes(r.status)) throw _err(400, 'INVALID', 'Only pending or accepted bookings can be extended', 'يمكن تمديد الطلبات المقبولة أو قيد المراجعة فقط');
      const next = {
        startDate: r.startDate,
        endDate: _str(b.endDate, 10),
        startTime: _str(b.startTime, 5) || r.startTime,
        endTime: _str(b.endTime, 5) || r.endTime
      };
      if (!DATE_RE.test(next.endDate) || next.endDate < r.endDate) {
        throw new BookingError('Pick a new end date after the current one', 'اختر تاريخ نهاية جديدًا بعد التاريخ الحالي', 'endDate');
      }
      if (next.endDate > addMonths(r.endDate, MAX_MONTHS)) {
        throw new BookingError('Extend by one month at most each time', 'التمديد شهر واحد كحد أقصى في كل مرة', 'endDate');
      }
      if (next.endDate === r.endDate && next.startTime === r.startTime && next.endTime === r.endTime) {
        throw new BookingError('Nothing changed', 'لم يتغير شيء', 'endDate');
      }
      _checkAdminPeriod(next, s.workingDays);
      const hit = await _clash(r, next, r.unitCode, s.workingDays, t);
      if (hit) throw _err(409, 'CLASH', `Clashes with ${hit.requestNumber}`, `لا يمكن التمديد: يتعارض مع الطلب ${hit.requestNumber} على نفس المساحة`, 'endDate');
      const from = { endDate: r.endDate, startTime: r.startTime, endTime: r.endTime };
      await r.update({
        endDate: next.endDate, startTime: next.startTime, endTime: next.endTime,
        history: [...(r.history || []), { action: 'extended', at: new Date(), by: _who(req), from, to: { endDate: next.endDate, startTime: next.startTime, endTime: next.endTime }, note: _str(b.note, 500) || null }]
      }, { transaction: t });
      return r;
    });
    let emailSent = false;
    if (b.notify !== false) emailSent = (await sendUpdated(row, 'extended')).ok;
    res.json({ request: { ...row.toJSON(), members: _members(row) }, emailSent });
  } catch (e) { _fail(res, e); }
};

// GET /api/workspace-requests/people?q= — every person's workspace history
// (deleted bookings included, marked), newest first.
exports.people = async (req, res) => {
  try {
    const q = _str(req.query.q, 80).toLowerCase();
    const [rows, logRows] = await Promise.all([
      WorkspaceRequest.findAll({ paranoid: false, order: [['startDate', 'DESC']] }),
      WorkspaceDayLog.findAll({ attributes: ['requestId', [sequelize.fn('AVG', sequelize.col('rating')), 'avg']], group: ['requestId'], raw: true })
    ]);
    const avg = Object.fromEntries(logRows.map(l => [l.requestId, Math.round(Number(l.avg) * 10) / 10]));
    const people = new Map();
    for (const r of rows) {
      _members(r).forEach((m, i) => {
        const key = m.userId || m.nationalId || m.phoneNumber || m.name;
        if (!key) return;
        const p = people.get(key) || { key, userId: m.userId, name: m.name, nationalId: m.nationalId, phoneNumber: m.phoneNumber, email: m.email, bookings: [] };
        p.bookings.push({
          requestId: r.requestId, requestNumber: r.requestNumber,
          status: r.deletedAt ? 'deleted' : r.status, role: i === 0 ? 'leader' : 'member',
          unitCode: r.unitCode, unitLabel: unitLabel(r.unitCode), projectName: r.projectName,
          startDate: r.startDate, endDate: r.endDate, startTime: r.startTime, endTime: r.endTime,
          extensions: (r.history || []).filter(h => h.action === 'extended').length,
          rating: avg[r.requestId] || null
        });
        people.set(key, p);
      });
    }
    let list = [...people.values()];
    if (q) list = list.filter(p => [p.name, p.nationalId, p.phoneNumber, p.email, p.userId].some(v => String(v || '').toLowerCase().includes(q)));
    list.sort((a, b) => String(b.bookings[0]?.startDate || '').localeCompare(String(a.bookings[0]?.startDate || '')));
    res.json({ people: list.slice(0, 300), total: list.length });
  } catch (e) { _fail(res, e); }
};

// The members' ID cards: each QR is FL:WSM:<national ID> for the station.
exports.cards = async (req, res) => {
  try {
    const r = await WorkspaceRequest.findByPk(req.params.id);
    if (!r) return res.status(404).json({ message: 'Request not found', messageAr: 'الطلب غير موجود' });
    const cards = [];
    for (const m of _members(r)) {
      const key = _personKey(m);
      // eslint-disable-next-line no-await-in-loop
      const qrDataUrl = key ? await QRCode.toDataURL(buildQrPayload('WSM', key), { errorCorrectionLevel: 'M', margin: 1, scale: 8 }) : null;
      cards.push({ member: m, qr: key ? buildQrPayload('WSM', key) : null, qrDataUrl });
    }
    res.json({ request: { ...r.toJSON(), members: _members(r), unitLabel: unitLabel(r.unitCode) }, cards });
  } catch (e) { _fail(res, e); }
};

// ---------- day-by-day ratings ----------

exports.listLogs = async (req, res) => {
  try {
    const logs = await WorkspaceDayLog.findAll({ where: { requestId: req.params.id }, order: [['date', 'DESC'], ['createdAt', 'DESC']] });
    res.json({ logs });
  } catch (e) { _fail(res, e); }
};

exports.addLog = async (req, res) => {
  try {
    const r = await WorkspaceRequest.findByPk(req.params.id);
    if (!r) return res.status(404).json({ message: 'Request not found', messageAr: 'الطلب غير موجود' });
    const b = req.body || {};
    const date = DATE_RE.test(b.date || '') ? b.date : riyadhToday();
    const rating = Math.round(Number(b.rating));
    if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ message: 'Rate 1 to 5', messageAr: 'التقييم من 1 إلى 5', field: 'rating' });
    const images = (Array.isArray(b.images) ? b.images : []).slice(0, MAX_IMAGES);
    if (images.some(x => typeof x !== 'string' || x.length > MAX_IMAGE_CHARS || !IMAGE_RE.test(x))) {
      return res.status(400).json({ message: 'Images must be PNG / JPG / WEBP, up to 3MB', messageAr: 'الصور يجب أن تكون PNG أو JPG أو WEBP وبحد أقصى 3 ميجابايت', field: 'images' });
    }
    const log = await WorkspaceDayLog.create({
      requestId: r.requestId, date, rating, notes: _str(b.notes, 3000) || null, images, createdBy: _who(req)
    });
    res.status(201).json({ log });
  } catch (e) { _fail(res, e); }
};

exports.removeLog = async (req, res) => {
  try {
    const log = await WorkspaceDayLog.findByPk(req.params.logId);
    if (!log) return res.status(404).json({ message: 'Not found', messageAr: 'غير موجود' });
    await log.destroy();
    res.json({ ok: true });
  } catch (e) { _fail(res, e); }
};

// ---------- attendance station (FL:WSM:<national ID>) ----------

exports.scanAttendance = async (req, res) => {
  try {
    const raw = String(req.body?.code || '').trim();
    if (!raw) return res.status(400).json({ message: 'No code provided' });
    const check = requireRole(raw, 'WSM');
    if (!check.ok) return res.status(check.status).json(check.response);
    const key = check.id;
    const date = riyadhToday();
    // An accepted booking running today that this person is part of.
    const live = await WorkspaceRequest.findAll({
      where: { status: 'approved', startDate: { [Op.lte]: date }, endDate: { [Op.gte]: date } }
    });
    let request = null;
    let member = null;
    for (const r of live) {
      const m = _members(r).find(x => x.nationalId === key || x.userId === key);
      if (m) { request = r; member = m; break; }
    }
    if (!request) {
      return res.status(404).json({ message: 'No workspace booking today for this card', messageAr: 'لا يوجد حجز مساحة عمل اليوم لهذه البطاقة', code: key });
    }
    const who = { name: member.name, nationalId: member.nationalId, unitLabel: unitLabel(request.unitCode), requestNumber: request.requestNumber, projectName: request.projectName, time: `${request.startTime}–${request.endTime}` };
    const now = new Date();
    let record = await WorkspaceAttendance.findOne({ where: { personKey: key, date } });
    if (!record) {
      record = await WorkspaceAttendance.create({ requestId: request.requestId, personKey: key, memberName: member.name, date, checkInAt: now });
      return res.json({ action: 'checkin', member: who, record });
    }
    if (!record.checkOutAt) {
      if (now.getTime() - new Date(record.checkInAt).getTime() < 15 * 60 * 1000) {
        return res.json({ action: 'duplicate', member: who, record, message: 'Already checked in — wait at least 15 minutes before checking out' });
      }
      await record.update({ checkOutAt: now });
      return res.json({ action: 'checkout', member: who, record });
    }
    return res.json({ action: 'already_done', member: who, record, message: 'Already checked in and out today' });
  } catch (e) { _fail(res, e); }
};

exports.attendanceToday = async (req, res) => {
  try {
    const date = riyadhToday();
    const rows = await WorkspaceAttendance.findAll({ where: { date }, order: [['checkInAt', 'DESC']] });
    const reqs = await WorkspaceRequest.findAll({ where: { requestId: { [Op.in]: [...new Set(rows.map(r => r.requestId))] } }, attributes: ['requestId', 'unitCode', 'requestNumber'] });
    const byId = Object.fromEntries(reqs.map(r => [r.requestId, r]));
    const records = rows.map(r => ({ ...r.toJSON(), unitLabel: unitLabel(byId[r.requestId]?.unitCode), requestNumber: byId[r.requestId]?.requestNumber || null }));
    // The station's board: one group per workspace booking.
    const groups = {};
    for (const r of records) {
      const g = (groups[r.requestId] = groups[r.requestId] || { course: `${r.unitLabel} · ${r.requestNumber || ''}`, students: [] });
      g.students.push({
        attendanceId: r.attendanceId, name: r.memberName, checkInAt: r.checkInAt, checkOutAt: r.checkOutAt,
        status: r.checkOutAt ? 'checked_out' : 'checked_in'
      });
    }
    res.json({
      date,
      records,
      groups: Object.values(groups),
      stats: { checkins: records.length, checkouts: records.filter(r => r.checkOutAt).length }
    });
  } catch (e) { _fail(res, e); }
};

exports.clearAttendanceToday = async (req, res) => {
  try {
    const n = await WorkspaceAttendance.destroy({ where: { date: riyadhToday() } });
    res.json({ deleted: n, count: n });
  } catch (e) { _fail(res, e); }
};

// ---------- settings: open / close the page with a reason ----------

exports.getRegistrationStatus = async (req, res) => {
  try {
    const s = await _status();
    res.json({ disabled: s.closed, reason: s.reason });
  } catch (e) { _fail(res, e); }
};

exports.updateRegistrationStatus = async (req, res) => {
  try {
    const disabled = !!req.body?.disabled;
    const reason = disabled ? _str(req.body?.reason, 1000) : '';
    if (disabled && !reason) {
      return res.status(400).json({ message: 'Write the reason for closing', messageAr: 'اكتب سبب الإغلاق' });
    }
    await Settings.upsert({ key: 'workspace_registration_disabled', value: disabled });
    await Settings.upsert({ key: 'workspace_registration_disabled_reason', value: reason });
    res.json({ disabled, reason });
  } catch (e) { _fail(res, e); }
};
