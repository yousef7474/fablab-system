// Media design requests (طلب تصميم إعلان — «المتطلبات الإعلامية»): their own
// line, separate from the kits' review flow.
//
//   draft ──employee sends──▶ design ──designer delivers vN──▶ employee_check
//   employee_check ──employee approves──▶ pm_review ──PM approves──▶ manager_review ──manager approves──▶ approved
//   employee_check ──employee rejects (notes)──▶ design            (designer adjusts, delivers vN+1)
//   pm_review / manager_review ──return (notes) to designer──▶ design
//   pm_review / manager_review ──return (notes) to employee──▶ returned_employee ──employee edits + re-sends──▶ design
//
// Every step is a MediaRequestEvent (who, when, note, design version,
// files) — the whole line, visible to the employee, the design team (admin
// dashboard), the project manager and the manager.
const path = require('path');
const sgMail = require('@sendgrid/mail');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { MediaRequest, MediaRequestEvent, MediaRequestFile, Employee, Settings, ExecutionPlan, ExecutionPlanFile } = require('../models');
const { pmStatus, requirePM } = require('./reviewFlow');
const { renderMediaRequestDocument, fmtMediaNo } = require('../utils/mediaRequestDoc');
const { mediaMissing, normalizeMediaForm } = require('../utils/mediaFormDoc');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const PM_SETTING = 'training_kit_pm';
const EDITABLE = ['draft', 'returned_employee'];
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_DATA_CHARS = 2 * 1024 * 1024;
const TAG = 'طلبات التصميم';

const bad = (res, status, message, messageAr, extra = {}) => res.status(status).json({ message, messageAr, ...extra });
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fail = (res, fn) => (err) => { console.error(`media ${fn}:`, err); res.status(500).json({ message: 'Server error' }); };
const notFound = (res) => bad(res, 404, 'Not found', 'الطلب غير موجود');
const wrongState = (res, messageAr) => bad(res, 409, 'Not allowed in the current state', messageAr, { code: 'STATE' });
const withAuthor = { model: Employee, as: 'author', attributes: ['employeeId', 'name', 'section', 'email'] };

// ─────────────── People & mail ───────────────

// The project manager — the same one who reviews kits and plans.
const pmEmployee = async () => {
  const row = await Settings.findByPk(PM_SETTING);
  const id = row?.value?.employeeId;
  if (id) {
    const e = await Employee.findByPk(id);
    if (e && e.isActive) return e;
  }
  return Employee.findOne({ where: { isActive: true, name: { [Op.iLike]: '%البوعبيد%' } } });
};

const sendMail = async (to, subject, bodyHtml) => {
  if (!to || (Array.isArray(to) && !to.length) || !process.env.SENDGRID_API_KEY) return;
  try {
    await sgMail.send({
      to,
      from: { email: process.env.SENDGRID_FROM_EMAIL, name: process.env.SENDGRID_FROM_NAME || 'FABLAB Al-Ahsa' },
      subject,
      html: `<div dir="rtl" style="font-family:Segoe UI,Tahoma,Arial,sans-serif;background:#f4f6fb;padding:24px;color:#0f172a">
        <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,.08)">
          <div style="background:linear-gradient(135deg,#7f1d1d,#EE2329);color:#fff;padding:18px 22px">
            <div style="font-size:12px;opacity:.85">FABLAB الأحساء · ${esc(TAG)}</div>
            <div style="font-size:19px;font-weight:800;margin-top:4px">${esc(subject)}</div>
          </div>
          <div style="padding:20px 22px;font-size:14px;line-height:1.8">${bodyHtml}</div>
        </div></div>`
    });
  } catch (err) {
    console.error('media request email failed:', err?.response?.body || err.message);
  }
};
const commentBox = (label, text) => (text
  ? `<div style="background:#fff7ed;border-right:4px solid #f59e0b;border-radius:8px;padding:10px 14px;margin:12px 0"><b>${esc(label)}</b><div style="white-space:pre-wrap">${esc(text)}</div></div>`
  : '');
const OPEN_EMP = '<p>افتح «الطلبات» ← «طلبات التصميم» في لوحة الموظف.</p>';

// ─────────────── Helpers ───────────────

// Same scale as the editor: 14 checks of the form.
const MEDIA_CHECKS = 14;
const completionOf = (form) => Math.floor(((MEDIA_CHECKS - Math.min(MEDIA_CHECKS, mediaMissing(form).length)) / MEDIA_CHECKS) * 100);

const titleOf = (data) => String(data?.form?.activity || data?.source?.targetName || '').trim().slice(0, 250) || null;

const summary = (d) => ({
  id: d.requestId,
  number: d.requestNumber,
  requestId: d.requestId,
  requestNumber: d.requestNumber,
  title: d.title,
  status: d.status,
  completion: d.completion,
  designVersion: d.designVersion,
  submittedAt: d.submittedAt,
  approvedAt: d.approvedAt,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
  lastNote: d.lastNote,
  lastEventType: d.lastEventType,
  author: d.author ? { employeeId: d.author.employeeId, name: d.author.name, section: d.author.section } : undefined
});

const eventsOf = (id) => MediaRequestEvent.findAll({ where: { requestId: id }, order: [['seq', 'ASC']] });
const filesOf = (id) => MediaRequestFile.findAll({
  where: { requestId: id }, attributes: ['fileId', 'kind', 'name', 'mime', 'size', 'uploadedByRole', 'createdAt'], order: [['createdAt', 'ASC']]
});
const full = async (d, extra = {}) => {
  const [events, files] = await Promise.all([eventsOf(d.requestId), filesOf(d.requestId)]);
  return { ...summary(d), data: d.data, events, files, ...extra };
};

// Serialize the steps of one request and append its next event.
const lockRequest = (id, transaction) => sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:k))', { replacements: { k: `media-request-${id}` }, transaction });
const addEvent = async (d, e, transaction) => {
  const [rows] = await sequelize.query('SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM media_request_events WHERE "requestId" = :id', { replacements: { id: d.requestId }, transaction });
  const seq = Number(rows?.[0]?.next) || 1;
  return MediaRequestEvent.create({ requestId: d.requestId, seq, ...e }, { transaction });
};

const sendFile = (res, f) => {
  res.set('Content-Type', f.mime || 'application/octet-stream');
  res.set('Content-Disposition', `attachment; filename="file"; filename*=UTF-8''${encodeURIComponent(f.name)}`);
  res.send(Buffer.from(f.content));
};
const readUpload = (req, res) => {
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || !buf.length) { bad(res, 400, 'Empty file', 'الملف فارغ'); return null; }
  if (buf.length > MAX_FILE_BYTES) { bad(res, 413, 'File too large', `الملف أكبر من ${MAX_FILE_BYTES / 1048576} MB`); return null; }
  let name = 'file';
  try { name = decodeURIComponent(String(req.get('X-File-Name') || 'file')); } catch { /* keep default */ }
  return { buf, name: name.slice(0, 250), mime: String(req.get('X-File-Type') || 'application/octet-stream').slice(0, 120) };
};

// The design version a document shows: the approved one, else the latest.
const deliveryOf = (events, version) => [...events].reverse().find(e => e.type === 'design_delivered' && (version == null || e.designVersion === version));

const sendDocument = async (res, d) => {
  const events = await eventsOf(d.requestId);
  const data = d.data || {};
  const form = normalizeMediaForm(data.form);
  const delivery = deliveryOf(events, d.designVersion || null);
  const ids = [...form.images.map(im => im.fileId), ...((delivery?.files) || []).map(f => f.fileId)];
  const rows = ids.length ? await MediaRequestFile.findAll({ where: { requestId: d.requestId, fileId: ids } }) : [];
  const images = {}; const files = {};
  rows.forEach(f => {
    files[f.fileId] = { name: f.name, size: f.size, mime: f.mime };
    if (/^image\//.test(f.mime || '')) images[f.fileId] = `data:${f.mime};base64,${Buffer.from(f.content).toString('base64')}`;
  });
  const author = d.author || await Employee.findByPk(d.employeeId, { attributes: ['name', 'section'] });
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(renderMediaRequestDocument({ request: d, data, author, events, images, files }));
};

// ═════════════════════ Employee ═════════════════════

const mine = (req) => MediaRequest.findOne({ where: { requestId: req.params.id, employeeId: req.employee.employeeId } });

exports.myList = async (req, res) => {
  try {
    const list = await MediaRequest.findAll({ where: { employeeId: req.employee.employeeId }, attributes: { exclude: ['data'] }, order: [['updatedAt', 'DESC']] });
    res.json(list.map(summary));
  } catch (err) { fail(res, 'myList')(err); }
};

const createRequest = (employee, data, completion) => sequelize.transaction(async (transaction) => {
  await sequelize.query("SELECT pg_advisory_xact_lock(hashtext('media-request-number'))", { transaction });
  const [rows] = await sequelize.query('SELECT COALESCE(MAX("requestNumber"), 0) + 1 AS next FROM media_requests', { transaction });
  return MediaRequest.create({
    requestNumber: Number(rows?.[0]?.next) || 1,
    employeeId: employee.employeeId,
    title: titleOf(data),
    data,
    completion: Math.max(0, Math.min(100, Number(completion) || 0))
  }, { transaction });
});

exports.myCreate = async (req, res) => {
  try {
    const data = req.body?.data && typeof req.body.data === 'object' ? req.body.data : { v: 1, form: {}, source: {} };
    if (JSON.stringify(data).length > MAX_DATA_CHARS) return bad(res, 413, 'Data too large', 'بيانات الطلب كبيرة جدًا');
    const d = await createRequest(req.employee, data, req.body?.completion);
    res.status(201).json(await full(d));
  } catch (err) { fail(res, 'myCreate')(err); }
};

// A request from a plan target's embedded media form: the form is copied
// and its images are copied into the request (the plan keeps its own).
exports.myFromPlan = async (req, res) => {
  try {
    const { planId, targetId } = req.body || {};
    const plan = planId && await ExecutionPlan.findOne({ where: { planId, employeeId: req.employee.employeeId } });
    if (!plan) return bad(res, 404, 'Plan not found', 'الخطة غير موجودة');
    const targets = Array.isArray(plan.data?.targets) ? plan.data.targets : [];
    const t = targets.find(x => x && x.id === targetId);
    if (!t) return bad(res, 404, 'Target not found', 'المستهدف غير موجود في الخطة');
    const form = { ...(t.media?.form && typeof t.media.form === 'object' ? t.media.form : {}) };
    if (!String(form.implementer || '').trim()) form.implementer = req.employee.name || '';
    if (!String(form.activity || '').trim()) form.activity = t.name || '';
    const imgs = (Array.isArray(form.images) ? form.images : []).filter(im => im && im.fileId);
    form.images = [];
    const data = {
      v: 1,
      form,
      source: {
        planId: plan.planId,
        planNo: `EP-${String(plan.planNumber).padStart(3, '0')}`,
        planTitle: plan.title || '',
        targetId: t.id,
        targetName: t.name || '',
        kitId: t.content?.kitId || '',
        kitNo: t.content?.kitNo || ''
      }
    };
    const d = await createRequest(req.employee, data, 0);
    for (const im of imgs) {
      const src = await ExecutionPlanFile.findOne({ where: { planId: plan.planId, fileId: im.fileId } });
      if (!src) continue;
      const f = await MediaRequestFile.create({
        requestId: d.requestId, kind: 'image', name: src.name, mime: src.mime, size: src.size, content: src.content,
        uploadedByRole: 'employee', uploadedBy: req.employee.employeeId
      });
      data.form.images.push({ fileId: f.fileId, name: f.name, size: f.size, mime: f.mime || '', caption: im.caption || '' });
    }
    await d.update({ data: { ...data }, completion: completionOf(data.form) });
    res.status(201).json(await full(d));
  } catch (err) { fail(res, 'myFromPlan')(err); }
};

exports.myGet = async (req, res) => {
  try {
    const d = await mine(req);
    if (!d) return notFound(res);
    res.json(await full(d, { pm: (await pmEmployee())?.name || null }));
  } catch (err) { fail(res, 'myGet')(err); }
};

exports.mySave = async (req, res) => {
  try {
    const d = await mine(req);
    if (!d) return notFound(res);
    if (!EDITABLE.includes(d.status)) return wrongState(res, 'الطلب لدى فريق التصميم أو قيد الاعتماد ولا يمكن تعديله الآن');
    const data = req.body?.data;
    if (!data || typeof data !== 'object' || typeof data.form !== 'object') return bad(res, 400, 'Invalid data', 'بيانات الطلب غير صحيحة');
    if (JSON.stringify(data).length > MAX_DATA_CHARS) return bad(res, 413, 'Data too large', 'بيانات الطلب كبيرة جدًا');
    await d.update({ data, title: titleOf(data), completion: Math.max(0, Math.min(100, Number(req.body?.completion) || 0)) });
    res.json({ ok: true, updatedAt: d.updatedAt });
  } catch (err) { fail(res, 'mySave')(err); }
};

// Only a draft that was never sent; its files go with it.
exports.myDelete = async (req, res) => {
  try {
    const d = await mine(req);
    if (!d) return notFound(res);
    if (d.status !== 'draft' || (await MediaRequestEvent.count({ where: { requestId: d.requestId } })) > 0) {
      return bad(res, 409, 'Already sent', 'لا يمكن حذف طلب سبق إرساله');
    }
    await MediaRequestFile.destroy({ where: { requestId: d.requestId } });
    await d.destroy({ force: true });
    res.json({ ok: true });
  } catch (err) { fail(res, 'myDelete')(err); }
};

// POST /mine/:id/files — raw body (the ad images).
exports.myUpload = async (req, res) => {
  try {
    const d = await mine(req);
    if (!d) return notFound(res);
    if (!EDITABLE.includes(d.status)) return wrongState(res, 'الطلب لدى فريق التصميم أو قيد الاعتماد ولا يمكن تعديله الآن');
    const up = readUpload(req, res);
    if (!up) return;
    const f = await MediaRequestFile.create({
      requestId: d.requestId, kind: 'image', name: up.name, mime: up.mime, size: up.buf.length, content: up.buf,
      uploadedByRole: 'employee', uploadedBy: req.employee.employeeId
    });
    res.status(201).json({ fileId: f.fileId, name: f.name, size: f.size, mime: f.mime, kind: f.kind });
  } catch (err) { fail(res, 'myUpload')(err); }
};

// Removing an image deletes it unless a sent copy of the form (an event)
// still refers to it — the history keeps it.
exports.myDeleteFile = async (req, res) => {
  try {
    const d = await mine(req);
    if (!d) return notFound(res);
    if (!EDITABLE.includes(d.status)) return wrongState(res, 'الطلب لدى فريق التصميم أو قيد الاعتماد ولا يمكن تعديله الآن');
    const events = await eventsOf(d.requestId);
    const kept = events.some(e => (e.data?.form?.images || []).some(im => im && im.fileId === req.params.fileId));
    if (!kept) await MediaRequestFile.destroy({ where: { requestId: d.requestId, fileId: req.params.fileId, kind: 'image' } });
    res.json({ ok: true, kept });
  } catch (err) { fail(res, 'myDeleteFile')(err); }
};

exports.myFile = async (req, res) => {
  try {
    const f = await MediaRequestFile.findByPk(req.params.fileId);
    const d = f && await MediaRequest.findByPk(f.requestId, { attributes: ['requestId', 'employeeId'] });
    if (!f || !d || d.employeeId !== req.employee.employeeId) return bad(res, 404, 'File not found', 'الملف غير موجود');
    sendFile(res, f);
  } catch (err) { fail(res, 'myFile')(err); }
};

// Send (or re-send after a return to the employee) to the design team.
exports.mySubmit = async (req, res) => {
  try {
    const d = await mine(req);
    if (!d) return notFound(res);
    if (!EDITABLE.includes(d.status)) return wrongState(res, 'الطلب مُرسل بالفعل لفريق التصميم');
    const miss = mediaMissing(d.data?.form);
    if (miss.length) return bad(res, 400, 'Form incomplete', `أكمل النموذج قبل الإرسال: ${miss.slice(0, 4).join('، ')}${miss.length > 4 ? '…' : ''}`, { missing: miss });
    const note = String(req.body?.note || '').trim();
    const resend = d.status === 'returned_employee' || (await MediaRequestEvent.count({ where: { requestId: d.requestId } })) > 0;
    if (resend && !note) return bad(res, 400, 'Describe what you changed', 'اكتب ما الذي عدّلته في الطلب قبل إعادة إرساله');
    await sequelize.transaction(async (transaction) => {
      await lockRequest(d.requestId, transaction);
      await addEvent(d, {
        type: resend ? 'resubmitted' : 'submitted', actorRole: 'employee', actorName: req.employee.name, actorId: req.employee.employeeId,
        note: note || null, data: d.data, statusAfter: 'design'
      }, transaction);
      await d.update({ status: 'design', submittedAt: new Date(), lastNote: note || null, lastEventType: resend ? 'resubmitted' : 'submitted' }, { transaction });
    });
    res.json(await full(d));
  } catch (err) { fail(res, 'mySubmit')(err); }
};

// The employee checks the delivered design: approve → PM, reject → designer.
exports.myCheck = async (req, res) => {
  try {
    const d = await MediaRequest.findOne({ where: { requestId: req.params.id, employeeId: req.employee.employeeId }, include: [withAuthor] });
    if (!d) return notFound(res);
    if (d.status !== 'employee_check') return wrongState(res, 'لا يوجد تصميم بانتظار مراجعتك في هذا الطلب');
    const approve = req.body?.decision === 'approve';
    if (!approve && req.body?.decision !== 'reject') return bad(res, 400, 'Choose approve or reject', 'اختر اعتماد التصميم أو رفضه');
    const comment = String(req.body?.comment || '').trim();
    if (!approve && !comment) return bad(res, 400, 'Write what needs changing', 'اكتب الملاحظات المطلوب تعديلها في التصميم');
    const pm = approve ? await pmEmployee() : null;
    if (approve && !pm) return bad(res, 409, 'No project manager is set', 'لم يُحدَّد مسؤول إدارة المشاريع بعد — تواصل مع المدير', { code: 'NO_PM' });
    const to = approve ? 'pm_review' : 'design';
    await sequelize.transaction(async (transaction) => {
      await lockRequest(d.requestId, transaction);
      await addEvent(d, {
        type: approve ? 'employee_approved' : 'employee_rejected', actorRole: 'employee', actorName: req.employee.name, actorId: req.employee.employeeId,
        note: comment || null, designVersion: d.designVersion, statusAfter: to
      }, transaction);
      await d.update({ status: to, lastNote: comment || null, lastEventType: approve ? 'employee_approved' : 'employee_rejected' }, { transaction });
    });
    if (approve) {
      const name = d.title || 'طلب تصميم';
      sendMail(pm.email, `طلب تصميم للمراجعة — ${name}`,
        `<p>مرحباً ${esc(pm.name)}،</p><p>اعتمد <b>${esc(req.employee.name)}</b> تصميم الطلب <b>«${esc(name)}»</b> (${fmtMediaNo(d.requestNumber)} — التصميم الإصدار ${d.designVersion}) وأرسله لمراجعتك.</p>
         ${commentBox('ملاحظة:', comment)}<p>افتحي «لوحة إدارة المشاريع» من لوحة الموظف لمراجعته.</p>`);
    }
    res.json(await full(d));
  } catch (err) { fail(res, 'myCheck')(err); }
};

exports.myDocument = async (req, res) => {
  try {
    const d = await MediaRequest.findOne({ where: { requestId: req.params.id, employeeId: req.employee.employeeId }, include: [withAuthor] });
    if (!d) return notFound(res);
    await sendDocument(res, d);
  } catch (err) { fail(res, 'myDocument')(err); }
};

// ═════════════════════ Design team (admin dashboard) ═════════════════════

// The design team, the PM and the manager see a request once it was sent.
const sentWhere = { status: { [Op.ne]: 'draft' } };
const sentRequest = (id) => MediaRequest.findOne({ where: { requestId: id, ...sentWhere }, include: [withAuthor] });
const adminName = (req, fallback = 'فريق التصميم') => req.admin?.fullName || req.admin?.username || fallback;

const listFor = (scopeWhere) => async (req, res) => {
  try {
    const where = { ...sentWhere, ...scopeWhere(req) };
    const list = await MediaRequest.findAll({ where, attributes: { exclude: ['data'] }, include: [withAuthor], order: [['updatedAt', 'DESC']] });
    res.json(list.map(summary));
  } catch (err) { fail(res, 'list')(err); }
};

exports.designList = listFor((req) => (req.query.scope === 'active' ? { status: { [Op.ne]: 'approved' } } : req.query.scope === 'design' ? { status: 'design' } : {}));

exports.reviewGet = async (req, res) => {
  try {
    const d = await sentRequest(req.params.id);
    if (!d) return notFound(res);
    res.json(await full(d));
  } catch (err) { fail(res, 'reviewGet')(err); }
};

exports.designUpload = async (req, res) => {
  try {
    const d = await sentRequest(req.params.id);
    if (!d) return notFound(res);
    if (d.status !== 'design') return wrongState(res, 'الطلب ليس لدى فريق التصميم الآن');
    const up = readUpload(req, res);
    if (!up) return;
    const f = await MediaRequestFile.create({
      requestId: d.requestId, kind: 'design', name: up.name, mime: up.mime, size: up.buf.length, content: up.buf,
      uploadedByRole: 'designer', uploadedBy: req.admin?.adminId || null
    });
    res.status(201).json({ fileId: f.fileId, name: f.name, size: f.size, mime: f.mime, kind: f.kind });
  } catch (err) { fail(res, 'designUpload')(err); }
};

// A design file not delivered yet can be removed; delivered ones stay.
exports.designDeleteFile = async (req, res) => {
  try {
    const d = await sentRequest(req.params.id);
    if (!d) return notFound(res);
    if (d.status !== 'design') return wrongState(res, 'الطلب ليس لدى فريق التصميم الآن');
    const events = await eventsOf(d.requestId);
    if (events.some(e => (e.files || []).some(f => f.fileId === req.params.fileId))) {
      return bad(res, 409, 'Already delivered', 'هذا الملف ضمن تصميم سبق تسليمه ويبقى في السجل');
    }
    await MediaRequestFile.destroy({ where: { requestId: d.requestId, fileId: req.params.fileId, kind: 'design' } });
    res.json({ ok: true });
  } catch (err) { fail(res, 'designDeleteFile')(err); }
};

exports.reviewFile = async (req, res) => {
  try {
    const f = await MediaRequestFile.findByPk(req.params.fileId);
    const d = f && await MediaRequest.findByPk(f.requestId, { attributes: ['requestId'] });
    if (!f || !d) return bad(res, 404, 'File not found', 'الملف غير موجود');
    sendFile(res, f);
  } catch (err) { fail(res, 'reviewFile')(err); }
};

// Deliver design version N+1 to the employee.
exports.designDeliver = async (req, res) => {
  try {
    const d = await sentRequest(req.params.id);
    if (!d) return notFound(res);
    if (d.status !== 'design') return wrongState(res, 'الطلب ليس لدى فريق التصميم الآن');
    const ids = Array.isArray(req.body?.fileIds) ? [...new Set(req.body.fileIds.map(String))] : [];
    if (!ids.length) return bad(res, 400, 'Attach the design', 'أرفق ملف التصميم قبل الإرسال');
    const rows = await MediaRequestFile.findAll({ where: { requestId: d.requestId, fileId: ids, kind: 'design' }, attributes: ['fileId', 'name', 'size', 'mime'], order: [['createdAt', 'ASC']] });
    if (rows.length !== ids.length) return bad(res, 400, 'Unknown files', 'بعض الملفات غير موجودة في هذا الطلب');
    const note = String(req.body?.note || '').trim();
    const version = d.designVersion + 1;
    await sequelize.transaction(async (transaction) => {
      await lockRequest(d.requestId, transaction);
      await addEvent(d, {
        type: 'design_delivered', actorRole: 'designer', actorName: adminName(req), actorId: req.admin?.adminId || null,
        note: note || null, designVersion: version, files: rows.map(f => ({ fileId: f.fileId, name: f.name, size: f.size, mime: f.mime || '' })), statusAfter: 'employee_check'
      }, transaction);
      await d.update({ status: 'employee_check', designVersion: version, lastNote: note || null, lastEventType: 'design_delivered' }, { transaction });
    });
    const name = d.title || 'طلب تصميم';
    sendMail(d.author?.email, `تصميم جاهز لمراجعتك — ${name}`,
      `<p>مرحباً ${esc(d.author?.name)}،</p><p>سلّم فريق التصميم (${esc(adminName(req))}) <b>الإصدار ${version}</b> من تصميم طلبك <b>«${esc(name)}»</b> (${fmtMediaNo(d.requestNumber)}).</p>
       ${commentBox('ملاحظة المصمم:', note)}<p>راجع التصميم، ثم اعتمده ليصل إلى مسؤول إدارة المشاريع، أو أعده للمصمم مع ملاحظاتك.</p>${OPEN_EMP}`);
    res.json(await full(d));
  } catch (err) { fail(res, 'designDeliver')(err); }
};

exports.reviewDocument = async (req, res) => {
  try {
    const d = await sentRequest(req.params.id);
    if (!d) return notFound(res);
    await sendDocument(res, d);
  } catch (err) { fail(res, 'reviewDocument')(err); }
};

// ═════════════════════ Project manager & manager ═════════════════════

const readDecision = (req, res) => {
  const decision = req.body?.decision === 'approve' ? 'approved' : req.body?.decision === 'return' ? 'returned' : null;
  const comment = String(req.body?.comment || '').trim();
  const returnTo = req.body?.returnTo === 'employee' ? 'employee' : req.body?.returnTo === 'designer' ? 'designer' : null;
  if (!decision) { bad(res, 400, 'Choose approve or return', 'اختر الاعتماد أو الإعادة'); return null; }
  if (decision === 'returned' && !comment) { bad(res, 400, 'Write what needs fixing', 'اكتب الملاحظات المطلوب تعديلها قبل إعادة الطلب'); return null; }
  if (decision === 'returned' && !returnTo) { bad(res, 400, 'Choose who fixes it', 'اختر إعادة الطلب للمصمم أو للموظف'); return null; }
  return { decision, comment, returnTo };
};

const RETURN_LINE = {
  designer: 'إلى فريق التصميم لتعديل التصميم، ثم يراجعه منفذ الطلب من جديد',
  employee: 'إليك لتعديل بيانات الطلب، ثم يُعاد إلى فريق التصميم'
};

const decide = (stage) => async (req, res) => {
  try {
    const dec = readDecision(req, res);
    if (!dec) return;
    const d = await sentRequest(req.params.id);
    if (!d) return notFound(res);
    const want = stage === 'pm' ? 'pm_review' : 'manager_review';
    if (d.status !== want) return wrongState(res, stage === 'pm' ? 'الطلب ليس بانتظار مراجعتك' : 'الطلب ليس بانتظار اعتماد المدير');
    const approved = dec.decision === 'approved';
    const to = approved ? (stage === 'pm' ? 'manager_review' : 'approved') : (dec.returnTo === 'designer' ? 'design' : 'returned_employee');
    const actor = stage === 'pm'
      ? { actorRole: 'pm', actorName: req.employee.name, actorId: req.employee.employeeId }
      : { actorRole: 'manager', actorName: adminName(req, 'المدير'), actorId: req.admin?.adminId || null };
    const type = `${stage}_${approved ? 'approved' : 'returned'}`;
    await sequelize.transaction(async (transaction) => {
      await lockRequest(d.requestId, transaction);
      await addEvent(d, {
        type, ...actor, note: dec.comment || null, designVersion: d.designVersion, returnTo: approved ? null : dec.returnTo, statusAfter: to
      }, transaction);
      await d.update({ status: to, lastNote: dec.comment || null, lastEventType: type, ...(to === 'approved' ? { approvedAt: new Date() } : {}) }, { transaction });
    });
    const name = d.title || 'طلب تصميم';
    const no = fmtMediaNo(d.requestNumber);
    if (stage === 'pm') {
      if (approved) {
        sendMail(d.author?.email, `اعتُمدت مراجعة طلب التصميم — ${name}`,
          `<p>مرحباً ${esc(d.author?.name)}،</p><p>راجعت <b>${esc(actor.actorName)}</b> طلبك <b>«${esc(name)}»</b> (${no} — التصميم الإصدار ${d.designVersion}) وأرسلته إلى المدير للاعتماد النهائي.</p>${commentBox('ملاحظة:', dec.comment)}`);
      } else {
        sendMail(d.author?.email, `مطلوب تعديل على طلب التصميم — ${name}`,
          `<p>مرحباً ${esc(d.author?.name)}،</p><p>أعادت <b>${esc(actor.actorName)}</b> طلبك <b>«${esc(name)}»</b> (${no}) ${RETURN_LINE[dec.returnTo]}.</p>${commentBox('الملاحظات:', dec.comment)}${OPEN_EMP}`);
      }
    } else {
      const firstPm = (await MediaRequestEvent.findOne({ where: { requestId: d.requestId, type: 'pm_approved' }, order: [['seq', 'DESC']] }));
      const pm = firstPm?.actorId ? await Employee.findByPk(firstPm.actorId) : null;
      const to2 = [d.author?.email, pm?.email].filter(Boolean);
      if (approved) {
        sendMail(to2, `اعتُمد طلب التصميم — ${name}`,
          `<p>اعتمد <b>${esc(actor.actorName)}</b> طلب التصميم <b>«${esc(name)}»</b> (${no} — التصميم الإصدار ${d.designVersion}) اعتمادًا نهائيًا.</p>${commentBox('ملاحظة:', dec.comment)}<p>التصميم المعتمد محفوظ مع الطلب ويمكن طباعته من «طلبات التصميم».</p>`);
      } else {
        sendMail(to2, `مطلوب تعديل على طلب التصميم — ${name}`,
          `<p>أعاد <b>${esc(actor.actorName)}</b> طلب التصميم <b>«${esc(name)}»</b> (${no}) ${dec.returnTo === 'designer' ? 'إلى فريق التصميم لتعديل التصميم' : 'إلى منفذ الطلب لتعديل بياناته'}.</p>${commentBox('الملاحظات:', dec.comment)}<p>بعد التعديل يمر الطلب على منفذ الطلب ثم مسؤول إدارة المشاريع ثم المدير.</p>`);
      }
    }
    res.json(await full(await sentRequest(d.requestId)));
  } catch (err) { fail(res, `${stage}Decide`)(err); }
};

exports.pmList = listFor((req) => (req.query.scope === 'queue' ? { status: 'pm_review' } : {}));
exports.pmDecide = decide('pm');
exports.adminList = listFor((req) => (req.query.scope === 'pending' ? { status: 'manager_review' } : req.query.scope === 'approved' ? { status: 'approved' } : {}));
exports.adminDecide = decide('manager');

// Manager only. A soft delete (deletedAt): gone from every screen, the
// row, its events and files stay in the database.
exports.adminDelete = async (req, res) => {
  try {
    const d = await MediaRequest.findByPk(req.params.id);
    if (!d) return notFound(res);
    await d.destroy();
    console.log(`media deleted ${fmtMediaNo(d.requestNumber)} (${d.requestId}) by admin ${req.admin?.adminId}`);
    res.json({ ok: true });
  } catch (err) { fail(res, 'adminDelete')(err); }
};

exports.pmStatus = pmStatus;
exports.requirePM = requirePM;
