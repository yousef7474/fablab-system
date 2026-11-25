const crypto = require('crypto');
const { Op, fn, col } = require('sequelize');
const { sequelize } = require('../config/database');
const { FabForm, FabFormResponse, Settings } = require('../models');
const { rateLimited } = require('../utils/siteContent');
const { FormError, validateFields, cleanAnswers, respondentOf, LIQAA_FORM } = require('../utils/fabForms');
const { sendFormConfirmation } = require('../utils/fabFormEmail');

// FabLab forms (admin "نماذج فاب لاب"): the admin builds a form, shares
// /forms/:slug, and turns it on / off by hand or between an open and a
// close time; every answer is kept and can be exported to Excel.

const REF_SEQ_KEY = 'fab_form_ref_seq';
const SEEDED_KEY = 'fab_forms_seeded';
const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,39}$/;

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
  full: ['All places have been taken', 'اكتمل العدد المسموح به']
};
// The admin's own "closed" text wins, except when the form is simply full.
const _closedText = (form, reason) => (reason !== 'full' && form.closedMessage) || CLOSED_MESSAGES[reason][1];

// The form settings the admin sent → a clean object (throws FormError).
async function _formFields(b, { partial = false, formId = null } = {}) {
  const out = {};
  if (!partial || b.title !== undefined) {
    out.title = _str(b.title, 200);
    if (!out.title) throw new FormError('The title is required', 'عنوان النموذج مطلوب');
  }
  if (!partial || b.description !== undefined) out.description = _str(b.description, 8000) || null;
  if (!partial || b.fields !== undefined) out.fields = validateFields(b.fields || []);
  for (const k of ['closedMessage', 'successMessage']) {
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

const _formJson = (form, count = 0) => ({
  ...form.toJSON(),
  url: `${_origin()}/forms/${form.slug}`,
  responseCount: count,
  closedReason: closedReason(form, count)
});

// ---------- admin ----------

exports.listForms = async (req, res) => {
  try {
    const forms = await FabForm.findAll({ order: [['createdAt', 'DESC']] });
    const counts = await _counts(forms.map(f => f.formId));
    res.json({ forms: forms.map(f => _formJson(f, counts[f.formId] || 0)) });
  } catch (e) { _fail(res, e); }
};

exports.getForm = async (req, res) => {
  try {
    const form = await FabForm.findByPk(req.params.id);
    if (!form) return res.status(404).json({ message: 'Form not found', messageAr: 'النموذج غير موجود' });
    const counts = await _counts([form.formId]);
    res.json({ form: _formJson(form, counts[form.formId] || 0) });
  } catch (e) { _fail(res, e); }
};

exports.createForm = async (req, res) => {
  try {
    const data = await _formFields(req.body);
    if (!data.slug) {
      for (let i = 0; i < 5 && !data.slug; i++) {
        const s = _newSlug();
        if (!(await FabForm.count({ where: { slug: s } }))) data.slug = s;
      }
    }
    const form = await FabForm.create({ ...data, createdBy: _who(req), updatedBy: _who(req) });
    res.status(201).json({ form: _formJson(form, 0) });
  } catch (e) { _fail(res, e); }
};

exports.updateForm = async (req, res) => {
  try {
    const form = await FabForm.findByPk(req.params.id);
    if (!form) return res.status(404).json({ message: 'Form not found', messageAr: 'النموذج غير موجود' });
    const data = await _formFields(req.body, { partial: true, formId: form.formId });
    const opens = data.opensAt !== undefined ? data.opensAt : form.opensAt;
    const closes = data.closesAt !== undefined ? data.closesAt : form.closesAt;
    if (opens && closes && new Date(opens) >= new Date(closes)) {
      throw new FormError('The close time must be after the open time', 'وقت الإغلاق يجب أن يكون بعد وقت الفتح');
    }
    await form.update({ ...data, updatedBy: _who(req) });
    const counts = await _counts([form.formId]);
    res.json({ form: _formJson(form, counts[form.formId] || 0) });
  } catch (e) { _fail(res, e); }
};

exports.setActive = async (req, res) => {
  try {
    const form = await FabForm.findByPk(req.params.id);
    if (!form) return res.status(404).json({ message: 'Form not found', messageAr: 'النموذج غير موجود' });
    await form.update({ isActive: !!req.body.isActive, updatedBy: _who(req) });
    const counts = await _counts([form.formId]);
    res.json({ form: _formJson(form, counts[form.formId] || 0) });
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
    res.status(201).json({ form: _formJson(form, 0) });
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
    res.json({ form: _formJson(form, responses.length), responses });
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
    const reason = closedReason(form, count);
    res.json({
      form: {
        slug: form.slug,
        title: form.title,
        description: form.description,
        fields: reason ? [] : form.fields,
        opensAt: form.opensAt,
        closesAt: form.closesAt
      },
      closedReason: reason,
      closedMessage: reason ? _closedText(form, reason) : null
    });
  } catch (e) { _fail(res, e); }
};

exports.submitForm = async (req, res) => {
  try {
    const slug = String(req.params.slug || '').toLowerCase();
    if (rateLimited(req, `form:${slug}`, 10, 10 * 60 * 1000)) {
      return res.status(429).json({ message: 'Too many submissions — try again later', messageAr: 'محاولات كثيرة، حاول لاحقًا' });
    }
    const form = await FabForm.findOne({ where: { slug } });
    if (!form) return res.status(404).json({ message: 'Form not found', messageAr: 'النموذج غير موجود' });

    const closedFirst = closedReason(form, form.maxResponses ? await FabFormResponse.count({ where: { formId: form.formId } }) : 0);
    if (closedFirst) {
      const [en] = CLOSED_MESSAGES[closedFirst];
      return res.status(409).json({ message: en, messageAr: _closedText(form, closedFirst), closedReason: closedFirst });
    }

    const fields = form.fields || [];
    const { answers, errors } = cleanAnswers(fields, req.body?.answers);
    if (errors.length) {
      return res.status(400).json({ message: errors[0].message, messageAr: errors[0].messageAr, errors });
    }

    const response = await sequelize.transaction(async (t) => {
      // One submission at a time per form (response limit) and for the reference number.
      await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:k))', { replacements: { k: 'fab-form-ref' }, transaction: t });
      const count = await FabFormResponse.count({ where: { formId: form.formId }, transaction: t });
      const reason = closedReason(form, count);
      if (reason) {
        const [en] = CLOSED_MESSAGES[reason];
        const err = new FormError(en, _closedText(form, reason));
        err.status = 409;
        throw err;
      }
      const seq = await Settings.findByPk(REF_SEQ_KEY, { transaction: t });
      const next = (Number(seq?.value) || 0) + 1;
      await Settings.upsert({ key: REF_SEQ_KEY, value: next }, { transaction: t });
      const who = respondentOf(fields, answers);
      return FabFormResponse.create({
        formId: form.formId,
        reference: `F-${String(next).padStart(4, '0')}`,
        answers,
        fieldsSnapshot: fields,
        respondentName: who.name,
        respondentEmail: who.email
      }, { transaction: t });
    });

    if (form.sendConfirmation && response.respondentEmail) {
      sendFormConfirmation({ to: response.respondentEmail, name: response.respondentName, form, response })
        .catch(e => console.error('Form confirmation email failed:', e.message));
    }
    res.status(201).json({ reference: response.reference, successMessage: form.successMessage || null });
  } catch (e) { _fail(res, e); }
};

// ---------- startup ----------

// Creates the لقاء registration form once (switched off for review).
exports.seedFabForms = async () => {
  try {
    if (await Settings.findByPk(SEEDED_KEY)) return;
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
  } catch (e) {
    console.log('FabLab forms seed skipped:', e.message);
  }
};
