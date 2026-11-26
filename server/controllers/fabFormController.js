const crypto = require('crypto');
const { Op, fn, col } = require('sequelize');
const { sequelize } = require('../config/database');
const { FabForm, FabFormResponse, PaymentPage, PaymentSubmission, Settings } = require('../models');
const { rateLimited } = require('../utils/siteContent');
const { FormError, validateFields, cleanAnswers, respondentOf, LIQAA_FORM } = require('../utils/fabForms');
const { sendFormConfirmation } = require('../utils/fabFormEmail');
const { _closedReason: payClosedReason, createPayment, afterPayment, paymentResult, publicPageInfo } = require('./paymentPageController');

// FabLab forms (admin "نماذج فاب لاب"): the admin builds a form, shares
// /forms/:slug, and turns it on / off by hand or between an open and a
// close time; every answer is kept and can be exported to Excel.

const REF_SEQ_KEY = 'fab_form_ref_seq';
const SEEDED_KEY = 'fab_forms_seeded';
const LIQAA_EN_KEY = 'fab_forms_liqaa_en';
const EN_COLUMNS = { titleEn: 'VARCHAR(200)', descriptionEn: 'TEXT', successMessageEn: 'TEXT', closedMessageEn: 'TEXT' };
const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,39}$/;
// "Days before the event" a reminder can go out.
const REMINDER_DAYS = [14, 7, 3, 2, 1];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const _str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const _origin = () => process.env.PUBLIC_APP_URL
  || (process.env.NODE_ENV === 'production' ? 'https://fablabsahsa.com' : 'http://localhost:3000');
const _who = (req) => req.admin?.fullName || req.admin?.username || null;
const _newSlug = () => {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  return [...crypto.randomBytes(8)].map(b => abc[b % abc.length]).join('');
};
const _date = (v) => {
  if (v == null || v === '') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};
const _fail = (res, e) => {
  if (e instanceof FormError) return res.status(e.status).json({ message: e.message, messageAr: e.messageAr });
  // A payment step error (createPayment): flagged so the page shows it there.
  if (e && e.status && !(e instanceof Error)) {
    const { status, ...body } = e;
    return res.status(status).json({ ...body, scope: 'payment' });
  }
  console.error('FabLab forms error:', e);
  return res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
};

// Why the form is not taking answers right now, or null.
const closedReason = (form, count) => {
  if (!form.isActive) return 'inactive';
  const now = Date.now();
  if (form.opensAt && now < new Date(form.opensAt).getTime()) return 'not_yet';
  if (form.closesAt && now >= new Date(form.closesAt).getTime()) return 'ended';
  if (form.maxResponses && count >= form.maxResponses) return 'full';
  return null;
};
const CLOSED_MESSAGES = {
  inactive: ['This form is not taking responses right now', 'هذا النموذج لا يستقبل ردودًا حاليًا'],
  not_yet: ['This form opens soon', 'لم يُفتح هذا النموذج بعد'],
  ended: ['This form has closed', 'انتهت فترة هذا النموذج'],
  full: ['All places have been taken', 'اكتمل العدد المسموح به'],
  payment: ['Registration is paused — payment is not available right now', 'التسجيل متوقف مؤقتًا — الدفع غير متاح حاليًا']
};

// ---------- payment (a linked "صفحات الدفع" page) ----------

const PAY_TAKES_A_PLACE = ['pending', 'verified'];

// pageId → { page, taken } for the given payment pages.
async function _payPages(ids, transaction) {
  const want = [...new Set(ids.filter(Boolean))];
  if (!want.length) return new Map();
  const pages = await PaymentPage.findAll({ where: { pageId: { [Op.in]: want } }, transaction });
  const rows = await PaymentSubmission.findAll({
    attributes: ['pageId', [fn('COUNT', col('submissionId')), 'n']],
    where: { pageId: { [Op.in]: want }, status: { [Op.in]: PAY_TAKES_A_PLACE } },
    group: ['pageId'],
    raw: true,
    transaction
  });
  const taken = Object.fromEntries(rows.map(r => [r.pageId, Number(r.n)]));
  return new Map(pages.map(p => [p.pageId, { page: p, taken: taken[p.pageId] || 0 }]));
}

// The form's payment state: null (no payment) or { page, reason } where
// `reason` says why paying is not possible now (a missing page counts as closed).
const _payState = (form, pages) => {
  if (!form.paymentPageId) return null;
  const hit = pages.get(form.paymentPageId);
  if (!hit) return { page: null, reason: 'closed' };
  return { page: hit.page, reason: payClosedReason(hit.page, hit.taken) };
};

// A full payment page makes the form "full"; any other reason pauses it.
const _withPayment = (reason, pay) => reason || (pay?.reason ? (pay.reason === 'full' ? 'full' : 'payment') : null);

const _paySummary = (page) => (page ? {
  title: page.title,
  amount: Number(page.amount),
  baseAmount: page.baseAmount != null ? Number(page.baseAmount) : null,
  discountPercent: Number(page.discountPercent) || 0
} : null);

// The admin's own "closed" text wins, except when the form is simply full.
const _closedText = (form, reason) => (reason !== 'full' && form.closedMessage) || CLOSED_MESSAGES[reason][1];
const _closedTextEn = (form, reason) => (reason !== 'full' && form.closedMessageEn) || CLOSED_MESSAGES[reason][0];

// The form settings the admin sent → a clean object (throws FormError).
async function _formFields(b, { partial = false, formId = null } = {}) {
  const out = {};
  if (!partial || b.title !== undefined) {
    out.title = _str(b.title, 200);
    if (!out.title) throw new FormError('The title is required', 'عنوان النموذج مطلوب');
  }
  if (!partial || b.description !== undefined) out.description = _str(b.description, 8000) || null;
  if (!partial || b.titleEn !== undefined) out.titleEn = _str(b.titleEn, 200) || null;
  if (!partial || b.descriptionEn !== undefined) out.descriptionEn = _str(b.descriptionEn, 8000) || null;
  if (!partial || b.fields !== undefined) out.fields = validateFields(b.fields || []);
  for (const k of ['closedMessage', 'successMessage', 'closedMessageEn', 'successMessageEn']) {
    if (!partial || b[k] !== undefined) out[k] = _str(b[k], 2000) || null;
  }
  for (const k of ['opensAt', 'closesAt']) {
    if (!partial || b[k] !== undefined) {
      const d = _date(b[k]);
      if (d === undefined) throw new FormError(`Invalid ${k}`, 'تاريخ غير صحيح');
      out[k] = d;
    }
  }
  if (out.opensAt && out.closesAt && out.opensAt >= out.closesAt) {
    throw new FormError('The close time must be after the open time', 'وقت الإغلاق يجب أن يكون بعد وقت الفتح');
  }
  if (!partial || b.maxResponses !== undefined) {
    const n = b.maxResponses === '' || b.maxResponses == null ? null : Math.round(Number(b.maxResponses));
    if (n != null && (!Number.isFinite(n) || n < 1)) throw new FormError('Invalid response limit', 'الحد الأقصى للردود غير صحيح');
    out.maxResponses = n;
  }
  if (!partial || b.sendConfirmation !== undefined) out.sendConfirmation = b.sendConfirmation !== false;
  if (!partial || b.isActive !== undefined) out.isActive = !!b.isActive;
  if (!partial || b.eventStartsAt !== undefined) {
    const d = _date(b.eventStartsAt);
    if (d === undefined) throw new FormError('Invalid event time', 'موعد الفعالية غير صحيح');
    out.eventStartsAt = d;
  }
  if (!partial || b.reminderDays !== undefined) {
    const list = Array.isArray(b.reminderDays) ? b.reminderDays.map(Number) : [];
    out.reminderDays = REMINDER_DAYS.filter(d => list.includes(d));
  }
  if (!partial || b.askAttendance !== undefined) out.askAttendance = b.askAttendance !== false;
  if (!partial || b.reminderMessage !== undefined) out.reminderMessage = _str(b.reminderMessage, 2000) || null;
  if (!partial || b.paymentPageId !== undefined) {
    const id = b.paymentPageId ? String(b.paymentPageId) : null;
    if (id && !(/^[0-9a-f-]{36}$/i.test(id) && await PaymentPage.count({ where: { pageId: id } }))) {
      throw new FormError('That payment page no longer exists', 'صفحة الدفع المختارة غير موجودة');
    }
    out.paymentPageId = id;
  }
  if (b.slug !== undefined && b.slug !== null && String(b.slug).trim() !== '') {
    const slug = String(b.slug).trim().toLowerCase();
    if (!SLUG_RE.test(slug)) {
      throw new FormError('The link name may use a–z, 0–9 and dashes (3–40)', 'اسم الرابط: حروف إنجليزية صغيرة وأرقام وشرطة (3 إلى 40)');
    }
    const clash = await FabForm.count({ where: { slug, ...(formId ? { formId: { [Op.ne]: formId } } : {}) } });
    if (clash) throw new FormError('This link name is taken', 'اسم الرابط مستخدم لنموذج آخر');
    out.slug = slug;
  }
  return out;
}

// A form that takes payment needs the payer's name, phone and email:
// required, always-shown questions of those kinds.
const _checkPayerFields = (fields) => {
  const has = (type) => (fields || []).some(f => f.type === type && f.required && !f.showIf);
  if (!has('short') || !has('phone') || !has('email')) {
    throw new FormError(
      'A form with payment needs required name (short answer), phone and email questions',
      'النموذج المرتبط بالدفع يحتاج أسئلة إلزامية للاسم (إجابة قصيرة) ورقم الجوال والبريد الإلكتروني'
    );
  }
};

const _counts = async (ids) => {
  if (!ids.length) return {};
  const rows = await FabFormResponse.findAll({
    attributes: ['formId', [fn('COUNT', col('responseId')), 'n']],
    where: { formId: { [Op.in]: ids } },
    group: ['formId'],
    raw: true
  });
  return Object.fromEntries(rows.map(r => [r.formId, Number(r.n)]));
};

const _formJson = (form, count = 0, pages = new Map()) => {
  const pay = _payState(form, pages);
  return {
    ...form.toJSON(),
    url: `${_origin()}/forms/${form.slug}`,
    responseCount: count,
    closedReason: _withPayment(closedReason(form, count), pay),
    payment: pay ? {
      pageId: form.paymentPageId,
      missing: !pay.page,
      slug: pay.page?.slug || null,
      closedReason: pay.reason,
      ...(_paySummary(pay.page) || {})
    } : null
  };
};
const _oneFormJson = async (form) => {
  const [counts, pages] = await Promise.all([_counts([form.formId]), _payPages([form.paymentPageId])]);
  return _formJson(form, counts[form.formId] || 0, pages);
};

// ---------- admin ----------

exports.listForms = async (req, res) => {
  try {
    const forms = await FabForm.findAll({ order: [['createdAt', 'DESC']] });
    const [counts, pages] = await Promise.all([
      _counts(forms.map(f => f.formId)),
      _payPages(forms.map(f => f.paymentPageId))
    ]);
    res.json({ forms: forms.map(f => _formJson(f, counts[f.formId] || 0, pages)) });
  } catch (e) { _fail(res, e); }
};

exports.getForm = async (req, res) => {
  try {
    const form = await FabForm.findByPk(req.params.id);
    if (!form) return res.status(404).json({ message: 'Form not found', messageAr: 'النموذج غير موجود' });
    res.json({ form: await _oneFormJson(form) });
  } catch (e) { _fail(res, e); }
};

exports.createForm = async (req, res) => {
  try {
    const data = await _formFields(req.body);
    if (data.paymentPageId) _checkPayerFields(data.fields);
    if (!data.slug) {
      for (let i = 0; i < 5 && !data.slug; i++) {
        const s = _newSlug();
        if (!(await FabForm.count({ where: { slug: s } }))) data.slug = s;
      }
    }
    const form = await FabForm.create({ ...data, createdBy: _who(req), updatedBy: _who(req) });
    res.status(201).json({ form: await _oneFormJson(form) });
  } catch (e) { _fail(res, e); }
};

exports.updateForm = async (req, res) => {
  try {
    const form = await FabForm.findByPk(req.params.id);
    if (!form) return res.status(404).json({ message: 'Form not found', messageAr: 'النموذج غير موجود' });
    const data = await _formFields(req.body, { partial: true, formId: form.formId });
    const payPageId = data.paymentPageId !== undefined ? data.paymentPageId : form.paymentPageId;
    if (payPageId) _checkPayerFields(data.fields !== undefined ? data.fields : form.fields);
    const opens = data.opensAt !== undefined ? data.opensAt : form.opensAt;
    const closes = data.closesAt !== undefined ? data.closesAt : form.closesAt;
    if (opens && closes && new Date(opens) >= new Date(closes)) {
      throw new FormError('The close time must be after the open time', 'وقت الإغلاق يجب أن يكون بعد وقت الفتح');
    }
    await form.update({ ...data, updatedBy: _who(req) });
    res.json({ form: await _oneFormJson(form) });
  } catch (e) { _fail(res, e); }
};

exports.setActive = async (req, res) => {
  try {
    const form = await FabForm.findByPk(req.params.id);
    if (!form) return res.status(404).json({ message: 'Form not found', messageAr: 'النموذج غير موجود' });
    await form.update({ isActive: !!req.body.isActive, updatedBy: _who(req) });
    res.json({ form: await _oneFormJson(form) });
  } catch (e) { _fail(res, e); }
};

exports.duplicateForm = async (req, res) => {
  try {
    const src = await FabForm.findByPk(req.params.id);
    if (!src) return res.status(404).json({ message: 'Form not found', messageAr: 'النموذج غير موجود' });
    let slug = null;
    for (let i = 0; i < 5 && !slug; i++) {
      const s = _newSlug();
      if (!(await FabForm.count({ where: { slug: s } }))) slug = s;
    }
    const { formId, createdAt, updatedAt, ...rest } = src.toJSON();
    const form = await FabForm.create({
      ...rest, slug, title: `${src.title} (نسخة)`.slice(0, 200), isActive: false,
      createdBy: _who(req), updatedBy: _who(req)
    });
    res.status(201).json({ form: await _oneFormJson(form) });
  } catch (e) { _fail(res, e); }
};

// Deleting a form with answers needs ?withResponses=1 (there are no
// database backups — the page asks the admin to confirm first).
exports.deleteForm = async (req, res) => {
  try {
    const form = await FabForm.findByPk(req.params.id);
    if (!form) return res.status(404).json({ message: 'Form not found', messageAr: 'النموذج غير موجود' });
    const count = await FabFormResponse.count({ where: { formId: form.formId } });
    if (count && req.query.withResponses !== '1') {
      return res.status(409).json({
        message: `This form has ${count} responses`, messageAr: `لهذا النموذج ${count} ردًا`, responseCount: count
      });
    }
    await sequelize.transaction(async (t) => {
      await FabFormResponse.destroy({ where: { formId: form.formId }, transaction: t });
      await form.destroy({ transaction: t });
    });
    res.json({ ok: true });
  } catch (e) { _fail(res, e); }
};

exports.listResponses = async (req, res) => {
  try {
    const form = await FabForm.findByPk(req.params.id);
    if (!form) return res.status(404).json({ message: 'Form not found', messageAr: 'النموذج غير موجود' });
    const responses = await FabFormResponse.findAll({ where: { formId: form.formId }, order: [['createdAt', 'DESC']] });
    // Each response's payment: the newest one that still counts, else the newest.
    const pays = responses.length ? await PaymentSubmission.findAll({
      attributes: ['submissionId', 'formResponseId', 'reference', 'status', 'amount', 'method', 'createdAt'],
      where: { formResponseId: { [Op.in]: responses.map(r => r.responseId) } },
      order: [['createdAt', 'DESC']]
    }) : [];
    const payOf = {};
    pays.forEach(p => {
      const cur = payOf[p.formResponseId];
      if (!cur || (cur.status === 'rejected' && p.status !== 'rejected')) payOf[p.formResponseId] = p;
    });
    const pages = await _payPages([form.paymentPageId]);
    res.json({
      form: _formJson(form, responses.length, pages),
      responses: responses.map(r => {
        const { payToken, attendToken, ...rest } = r.toJSON();
        const p = payOf[r.responseId];
        return {
          ...rest,
          payment: p ? { reference: p.reference, status: p.status, amount: Number(p.amount), method: p.method, createdAt: p.createdAt } : null
        };
      })
    });
  } catch (e) { _fail(res, e); }
};

exports.deleteResponse = async (req, res) => {
  try {
    const r = await FabFormResponse.findByPk(req.params.responseId);
    if (!r) return res.status(404).json({ message: 'Response not found', messageAr: 'الرد غير موجود' });
    await r.destroy();
    res.json({ ok: true });
  } catch (e) { _fail(res, e); }
};

// ---------- public (/forms/:slug) — never 401 ----------

exports.getPublicForm = async (req, res) => {
  try {
    const form = await FabForm.findOne({ where: { slug: String(req.params.slug || '').toLowerCase() } });
    if (!form) return res.status(404).json({ message: 'Form not found', messageAr: 'النموذج غير موجود' });
    const count = form.maxResponses ? await FabFormResponse.count({ where: { formId: form.formId } }) : 0;
    const pay = _payState(form, await _payPages([form.paymentPageId]));
    const reason = _withPayment(closedReason(form, count), pay);
    res.json({
      form: {
        slug: form.slug,
        title: form.title,
        titleEn: form.titleEn || null,
        description: form.description,
        descriptionEn: form.descriptionEn || null,
        fields: reason ? [] : form.fields,
        // Whether the form offers English (the closed screen has no fields).
        hasEn: !!(form.titleEn || (form.fields || []).some(f => f.labelEn || f.contentEn)),
        opensAt: form.opensAt,
        closesAt: form.closesAt,
        eventStartsAt: form.eventStartsAt,
        // Paid inside the form before it is sent: the linked page's price,
        // methods, bank / mada details and terms.
        payment: pay?.page && !reason ? await publicPageInfo(pay.page) : null
      },
      closedReason: reason,
      closedMessage: reason ? _closedText(form, reason) : null,
      closedMessageEn: reason ? _closedTextEn(form, reason) : null
    });
  } catch (e) { _fail(res, e); }
};

// POST /api/forms/:slug — { answers, payment? }. A form with a payment
// page is only accepted together with its payment ({ method, proof?,
// couponCode?, termsAccepted }): both are saved in one transaction, so a
// failed payment saves nothing.
exports.submitForm = async (req, res) => {
  try {
    const slug = String(req.params.slug || '').toLowerCase();
    if (rateLimited(req, `form:${slug}`, 10, 10 * 60 * 1000)) {
      return res.status(429).json({ message: 'Too many submissions — try again later', messageAr: 'محاولات كثيرة، حاول لاحقًا' });
    }
    const form = await FabForm.findOne({ where: { slug } });
    if (!form) return res.status(404).json({ message: 'Form not found', messageAr: 'النموذج غير موجود' });

    const closedFirst = _withPayment(
      closedReason(form, form.maxResponses ? await FabFormResponse.count({ where: { formId: form.formId } }) : 0),
      _payState(form, await _payPages([form.paymentPageId]))
    );
    if (closedFirst) {
      return res.status(409).json({ message: _closedTextEn(form, closedFirst), messageAr: _closedText(form, closedFirst), closedReason: closedFirst });
    }

    const fields = form.fields || [];
    const { answers, errors } = cleanAnswers(fields, req.body?.answers);
    if (errors.length) {
      return res.status(400).json({ message: errors[0].message, messageAr: errors[0].messageAr, errors });
    }
    const who = respondentOf(fields, answers);
    if (form.paymentPageId && (!who.name || !who.phone || !who.email)) {
      throw new FormError('Enter your name, phone and email to pay', 'أدخل الاسم ورقم الجوال والبريد الإلكتروني لإتمام الدفع');
    }

    const { response, page, sub } = await sequelize.transaction(async (t) => {
      // One submission at a time per form (response limit) and for the reference number.
      await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:k))', { replacements: { k: 'fab-form-ref' }, transaction: t });
      const count = await FabFormResponse.count({ where: { formId: form.formId }, transaction: t });
      const pay = _payState(form, await _payPages([form.paymentPageId], t));
      const reason = _withPayment(closedReason(form, count), pay);
      if (reason) {
        const err = new FormError(_closedTextEn(form, reason), _closedText(form, reason));
        err.status = 409;
        throw err;
      }
      const seq = await Settings.findByPk(REF_SEQ_KEY, { transaction: t });
      const next = (Number(seq?.value) || 0) + 1;
      await Settings.upsert({ key: REF_SEQ_KEY, value: next }, { transaction: t });
      const created = await FabFormResponse.create({
        formId: form.formId,
        reference: `F-${String(next).padStart(4, '0')}`,
        answers,
        fieldsSnapshot: fields,
        respondentName: who.name,
        respondentEmail: who.email,
        attendToken: crypto.randomUUID()
      }, { transaction: t });
      if (!pay?.page) return { response: created };
      // The payment, in the same transaction: no payment, no registration.
      const p = req.body?.payment || {};
      const paid = await createPayment(t, { pageId: pay.page.pageId }, {
        fullName: who.name, phone: who.phone, email: who.email,
        method: p.method, proof: p.proof, couponCode: p.couponCode, termsAccepted: p.termsAccepted === true,
        note: `${form.title} — ${created.reference}`
      }, { formResponseId: created.responseId });
      return { response: created, page: paid.page, sub: paid.sub };
    });

    if (sub) afterPayment(page, sub);
    const payment = sub ? { ...paymentResult(sub), title: page.title } : null;
    if (form.sendConfirmation && response.respondentEmail) {
      sendFormConfirmation({
        to: response.respondentEmail, name: response.respondentName, form, response,
        payment: payment ? { title: payment.title, amount: payment.amount, reference: payment.reference, status: payment.status, method: payment.method } : null
      }).catch(e => console.error('Form confirmation email failed:', e.message));
    }
    res.status(201).json({
      reference: response.reference,
      successMessage: form.successMessage || null,
      successMessageEn: form.successMessageEn || null,
      payment
    });
  } catch (e) { _fail(res, e); }
};

// ---------- attendance (reminder email link, /forms/attend/:token) ----------

const _attendee = async (token) => {
  if (!UUID_RE.test(String(token || ''))) return null;
  return FabFormResponse.findOne({
    where: { attendToken: String(token) },
    include: [{ model: FabForm, as: 'form', attributes: ['formId', 'title', 'titleEn', 'eventStartsAt', 'askAttendance'] }]
  });
};
const _attendJson = (r) => ({
  reference: r.reference,
  name: r.respondentName,
  title: r.form?.title,
  titleEn: r.form?.titleEn || null,
  eventStartsAt: r.form?.eventStartsAt || null,
  attendance: r.attendance,
  attendanceAt: r.attendanceAt,
  // No more answers once the event has started.
  locked: !!(r.form?.eventStartsAt && Date.now() >= new Date(r.form.eventStartsAt).getTime())
});

exports.getAttendance = async (req, res) => {
  try {
    const r = await _attendee(req.params.token);
    if (!r || !r.form) return res.status(404).json({ message: 'Invalid link', messageAr: 'الرابط غير صحيح' });
    res.json(_attendJson(r));
  } catch (e) { _fail(res, e); }
};

exports.setAttendance = async (req, res) => {
  try {
    if (rateLimited(req, 'form-attend', 30, 10 * 60 * 1000)) {
      return res.status(429).json({ message: 'Too many attempts — try again later', messageAr: 'محاولات كثيرة، حاول لاحقًا' });
    }
    const answer = req.body?.answer;
    if (!['yes', 'no'].includes(answer)) return res.status(400).json({ message: 'Choose yes or no', messageAr: 'اختر الحضور أو الاعتذار' });
    const r = await _attendee(req.params.token);
    if (!r || !r.form) return res.status(404).json({ message: 'Invalid link', messageAr: 'الرابط غير صحيح' });
    if (_attendJson(r).locked) return res.status(409).json({ message: 'The event has already started', messageAr: 'بدأت الفعالية، لا يمكن تعديل الرد' });
    await r.update({ attendance: answer, attendanceAt: new Date() });
    res.json(_attendJson(r));
  } catch (e) { _fail(res, e); }
};

// ---------- startup ----------

// Startup: make sure the payment, reminder and English columns exist (older databases), create
// the لقاء registration form once (switched off for review), and give it
// its English text once.
exports.seedFabForms = async () => {
  for (const [table, column, type] of [
    ['fab_forms', 'paymentPageId', 'UUID'],
    ['fab_forms', 'eventStartsAt', 'TIMESTAMP WITH TIME ZONE'],
    ['fab_forms', 'reminderDays', `JSON NOT NULL DEFAULT '[7,2]'::json`],
    ['fab_forms', 'askAttendance', 'BOOLEAN NOT NULL DEFAULT true'],
    ['fab_forms', 'reminderMessage', 'TEXT'],
    ['fab_form_responses', 'payToken', 'UUID'],
    ['fab_form_responses', 'remindersSent', `JSON NOT NULL DEFAULT '[]'::json`],
    ['fab_form_responses', 'attendance', 'VARCHAR(10)'],
    ['fab_form_responses', 'attendanceAt', 'TIMESTAMP WITH TIME ZONE'],
    ['fab_form_responses', 'attendToken', 'UUID'],
    ['payment_submissions', 'formResponseId', 'UUID']
  ]) {
    try {
      await sequelize.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS "${column}" ${type}`);
    } catch (e) {
      if (!/does not exist/i.test(e.message)) console.log(`${table}.${column} migration note:`, e.message);
    }
  }
  for (const [col, type] of Object.entries(EN_COLUMNS)) {
    try {
      await sequelize.query(`ALTER TABLE fab_forms ADD COLUMN IF NOT EXISTS "${col}" ${type}`);
    } catch (e) {
      if (!/does not exist/i.test(e.message)) console.log(`fab_forms.${col} migration note:`, e.message);
    }
  }
  try {
    if (!(await Settings.findByPk(SEEDED_KEY))) {
      if (!(await FabForm.count({ where: { slug: LIQAA_FORM.slug } }))) {
        await FabForm.create({
          ...LIQAA_FORM,
          fields: validateFields(LIQAA_FORM.fields),
          isActive: false,
          sendConfirmation: true,
          createdBy: 'FabLab'
        });
        console.log('📝 FabLab forms: created the لقاء registration form (inactive)');
      }
      await Settings.upsert({ key: SEEDED_KEY, value: true });
    }
  } catch (e) {
    console.log('FabLab forms seed skipped:', e.message);
  }
  try {
    if (await Settings.findByPk(LIQAA_EN_KEY)) return;
    const form = await FabForm.findOne({ where: { slug: LIQAA_FORM.slug } });
    if (form) {
      // Fill only what is still empty — never overwrite the admin's edits.
      const patch = {};
      for (const k of ['titleEn', 'descriptionEn', 'successMessageEn', 'closedMessageEn']) {
        if (!form[k] && LIQAA_FORM[k]) patch[k] = LIQAA_FORM[k];
      }
      const byId = Object.fromEntries(LIQAA_FORM.fields.map(f => [f.id, f]));
      patch.fields = validateFields((form.fields || []).map(f => {
        const en = byId[f.id];
        if (!en) return f;
        const next = { ...f };
        if (!next.labelEn && en.labelEn) next.labelEn = en.labelEn;
        if (!next.helpEn && en.helpEn) next.helpEn = en.helpEn;
        if (!next.placeholderEn && en.placeholderEn) next.placeholderEn = en.placeholderEn;
        // Option English only when the Arabic options are still the seeded ones.
        if (en.optionsEn && !(next.optionsEn || []).some(Boolean)
          && JSON.stringify(next.options) === JSON.stringify(en.options)) next.optionsEn = en.optionsEn;
        return next;
      }));
      await form.update(patch);
      console.log('📝 FabLab forms: added English to the لقاء form');
    }
    await Settings.upsert({ key: LIQAA_EN_KEY, value: true });
  } catch (e) {
    console.log('FabLab forms English seed skipped:', e.message);
  }
};
