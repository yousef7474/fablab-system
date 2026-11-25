const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { WorkspaceRequest, Settings } = require('../models');
const { rateLimited } = require('../utils/siteContent');
const {
  UNITS, UNIT_CODES, HOURS, MAX_MONTHS, MAX_DAYS_AHEAD, HOLDS, APPLICANT_TYPES,
  BookingError, checkPeriod, overlaps, riyadhToday
} = require('../utils/workspaceBooking');
const { sendReceived, sendOpsNotice, sendDecision } = require('../utils/workspaceRequestEmail');

// Workspace registration: the public /workspace page books one of the 8
// workspaces for a period and a daily time; admins and managers accept or
// reject. A pending or accepted request holds its workspace, so the page
// only offers workspaces that are free for the whole period and time.

const REF_SEQ_KEY = 'workspace_request_seq';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?\d{8,15}$/;

const _str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const _who = (req) => req.admin?.fullName || req.admin?.username || null;
const _fail = (res, e) => {
  if (e instanceof BookingError) return res.status(e.status).json({ message: e.message, messageAr: e.messageAr, field: e.field, code: e.code });
  console.error('Workspace request error:', e);
  return res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
};

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

// ---------- public (/api/public/workspace) — never 401 ----------

exports.publicStatus = async (req, res) => {
  try {
    const s = await _status();
    res.json({
      open: !s.closed, reason: s.reason || null, units: UNITS, hours: HOURS,
      workingDays: s.workingDays, maxMonths: MAX_MONTHS, maxDaysAhead: MAX_DAYS_AHEAD, today: riyadhToday()
    });
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

exports.publicSubmit = async (req, res) => {
  try {
    if (rateLimited(req, 'workspace-request', 6, 10 * 60 * 1000)) {
      return res.status(429).json({ message: 'Too many requests — try again later', messageAr: 'محاولات كثيرة، حاول لاحقًا' });
    }
    const s = await _status();
    if (s.closed) return _closed(res, s.reason);

    const b = req.body || {};
    const data = {
      fullName: _str(b.fullName, 150),
      phone: _str(b.phone, 30).replace(/[\s()-]/g, '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)),
      email: _str(b.email, 150).toLowerCase(),
      applicantType: _str(b.applicantType, 20),
      organization: _str(b.organization, 200) || null,
      projectName: _str(b.projectName, 200),
      projectDescription: _str(b.projectDescription, 3000) || null,
      peopleCount: Number(b.peopleCount),
      unitCode: _str(b.unitCode, 10),
      ..._period(b)
    };
    if (data.fullName.length < 3) throw new BookingError('Enter your full name', 'أدخل الاسم الكامل', 'fullName', 'INVALID');
    if (!PHONE_RE.test(data.phone)) throw new BookingError('Enter a valid mobile number', 'أدخل رقم جوال صحيح', 'phone', 'INVALID');
    if (!EMAIL_RE.test(data.email)) throw new BookingError('Enter a valid email', 'أدخل بريدًا إلكترونيًا صحيحًا', 'email', 'INVALID');
    if (!APPLICANT_TYPES[data.applicantType]) throw new BookingError('Pick who you are', 'اختر صفة المسجّل', 'applicantType', 'INVALID');
    if (!data.projectName) throw new BookingError('Enter the project name', 'أدخل اسم المشروع', 'projectName', 'INVALID');
    if (!Number.isInteger(data.peopleCount) || data.peopleCount < 1 || data.peopleCount > 4) {
      throw new BookingError('1 to 4 people', 'عدد الأشخاص من 1 إلى 4', 'peopleCount', 'INVALID');
    }
    if (!UNIT_CODES.includes(data.unitCode)) throw new BookingError('Pick a workspace', 'اختر مساحة العمل', 'unitCode', 'INVALID');
    if (b.acceptTerms !== true) {
      throw new BookingError('Accept the terms and conditions', 'يجب الموافقة على الشروط والأحكام', 'acceptTerms', 'INVALID');
    }
    checkPeriod(data, s.workingDays);

    const row = await sequelize.transaction(async (t) => {
      // One booking at a time, so two people can't take the same workspace.
      await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:k))', { replacements: { k: 'workspace-requests' }, transaction: t });
      const taken = await _takenUnits(data, s.workingDays, { transaction: t });
      if (taken.has(data.unitCode)) {
        const err = new BookingError('This workspace was just taken — pick another', 'تم حجز مساحة العمل هذه للتو، اختر مساحة أخرى', 'unitCode', 'UNIT_TAKEN');
        err.status = 409;
        throw err;
      }
      const seq = await Settings.findByPk(REF_SEQ_KEY, { transaction: t });
      const next = (Number(seq?.value) || 0) + 1;
      await Settings.upsert({ key: REF_SEQ_KEY, value: next }, { transaction: t });
      return WorkspaceRequest.create({
        ...data, requestNumber: `WS-${String(next).padStart(4, '0')}`, termsAcceptedAt: new Date()
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
    const [requests, grouped] = await Promise.all([
      WorkspaceRequest.findAll({ where, order: [['createdAt', 'DESC']] }),
      WorkspaceRequest.findAll({ attributes: ['status', [sequelize.fn('COUNT', sequelize.col('requestId')), 'n']], group: ['status'], raw: true })
    ]);
    const counts = { pending: 0, approved: 0, rejected: 0 };
    grouped.forEach(g => { counts[g.status] = Number(g.n); });
    res.json({ requests, counts, units: UNITS });
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
      if (!r) { const err = new BookingError('Request not found', 'الطلب غير موجود', null, 'NOT_FOUND'); err.status = 404; throw err; }
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
        if (hit) {
          const err = new BookingError(`Clashes with accepted request ${hit.requestNumber}`, `يتعارض مع الطلب المقبول ${hit.requestNumber}`, null, 'CLASH');
          err.status = 409;
          throw err;
        }
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
    await r.destroy();
    res.json({ ok: true });
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
