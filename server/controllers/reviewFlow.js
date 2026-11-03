// Review workflow shared by the training kits (الحقائب التدريبية) and the
// execution plans (الخطط التنفيذية): the employee fills the form and sends
// it to the project manager (مسؤول إدارة المشاريع); she approves it on to
// the manager or returns it with comments; the manager gives the final
// approval or returns it. Every submission is frozen as a version, so the
// edit history and every comment stay visible.
//
// createReviewFlow(cfg) builds the route handlers for one document type:
//   Doc / Version / File — the Sequelize models
//   ID / NO              — the document's id and number attributes
//   table, lock          — table name (numbering) and advisory-lock name
//   fmtNo(n)             — 'TK-001' / 'EP-001'
//   titleOf(data)        — list title (null = not ready to send)
//   fileIdsOf(data)      — Set of fileIds the data refers to
//   render(o)            — printable HTML document
//   zip(o)               — adds the files to the "download everything" ZIP
//   w                    — the wording (both nouns are feminine)
const path = require('path');
const sgMail = require('@sendgrid/mail');
const JSZip = require('jszip');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { Employee, Settings } = require('../models');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const PM_SETTING = 'training_kit_pm';
const EDITABLE = ['draft', 'returned'];
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_DATA_CHARS = 2 * 1024 * 1024;

const bad = (res, status, message, messageAr, extra = {}) => res.status(status).json({ message, messageAr, ...extra });
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeName = (s) => String(s || '').replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 120) || 'file';

// ─────────────── People ───────────────

// The project manager is chosen by the manager (Settings); until then the
// employee named …البوعبيد (م. نوف) is used. One PM reviews every type.
const pmEmployee = async () => {
  const row = await Settings.findByPk(PM_SETTING);
  const id = row?.value?.employeeId;
  if (id) {
    const e = await Employee.findByPk(id);
    if (e && e.isActive) return e;
  }
  return Employee.findOne({ where: { isActive: true, name: { [Op.iLike]: '%البوعبيد%' } } });
};

const isPM = async (employee) => {
  const pm = await pmEmployee();
  return !!(pm && employee && pm.employeeId === employee.employeeId);
};

const sendMail = async (tag, to, subject, bodyHtml) => {
  if (!to || (Array.isArray(to) && !to.length) || !process.env.SENDGRID_API_KEY) return;
  try {
    await sgMail.send({
      to,
      from: { email: process.env.SENDGRID_FROM_EMAIL, name: process.env.SENDGRID_FROM_NAME || 'FABLAB Al-Ahsa' },
      subject,
      html: `<div dir="rtl" style="font-family:Segoe UI,Tahoma,Arial,sans-serif;background:#f4f6fb;padding:24px;color:#0f172a">
        <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,.08)">
          <div style="background:linear-gradient(135deg,#7f1d1d,#EE2329);color:#fff;padding:18px 22px">
            <div style="font-size:12px;opacity:.85">FABLAB الأحساء · ${esc(tag)}</div>
            <div style="font-size:19px;font-weight:800;margin-top:4px">${esc(subject)}</div>
          </div>
          <div style="padding:20px 22px;font-size:14px;line-height:1.8">${bodyHtml}</div>
        </div></div>`
    });
  } catch (err) {
    console.error(`${tag} email failed:`, err?.response?.body || err.message);
  }
};

const commentBox = (label, text) => (text
  ? `<div style="background:#fff7ed;border-right:4px solid #f59e0b;border-radius:8px;padding:10px 14px;margin:12px 0"><b>${esc(label)}</b><div style="white-space:pre-wrap">${esc(text)}</div></div>`
  : '');

const sendFile = (res, f) => {
  res.set('Content-Type', f.mime || 'application/octet-stream');
  res.set('Content-Disposition', `attachment; filename="file"; filename*=UTF-8''${encodeURIComponent(f.name)}`);
  res.send(Buffer.from(f.content));
};

const createReviewFlow = (cfg) => {
  const { Doc, Version, File, ID, NO, table, lock, fmtNo, titleOf, fileIdsOf, render, zip, w } = cfg;
  const log = (fn, err) => console.error(`${w.logTag} ${fn}:`, err);
  const fail = (res, fn) => (err) => { log(fn, err); res.status(500).json({ message: 'Server error' }); };
  const notFound = (res) => bad(res, 404, 'Not found', `${w.the} غير موجودة`);
  const withAuthor = { model: Employee, as: 'author', attributes: ['employeeId', 'name', 'section', 'email'] };

  const assignNumber = (transaction) => sequelize.query(
    `SELECT COALESCE(MAX("${NO}"), 0) + 1 AS next FROM ${table}`, { transaction }
  ).then(([rows]) => Number(rows?.[0]?.next) || 1);

  // `id` / `number` are the type-neutral names the shared client views use.
  const summary = (d) => ({
    id: d[ID],
    number: d[NO],
    [ID]: d[ID],
    [NO]: d[NO],
    title: d.title,
    status: d.status,
    returnedBy: d.returnedBy,
    completion: d.completion,
    currentVersion: d.currentVersion,
    submittedAt: d.submittedAt,
    approvedAt: d.approvedAt,
    approvedVersion: d.approvedVersion,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    author: d.author ? { employeeId: d.author.employeeId, name: d.author.name, section: d.author.section } : undefined
  });

  const versions = (id) => Version.findAll({ where: { [ID]: id }, order: [['versionNumber', 'ASC']] });
  const filesMeta = (id) => File.findAll({
    where: { [ID]: id }, attributes: ['fileId', 'kind', 'name', 'mime', 'size', 'createdAt'], order: [['createdAt', 'ASC']]
  });
  const full = async (d, { withDraft = true } = {}) => {
    const [vs, fs] = await Promise.all([versions(d[ID]), filesMeta(d[ID])]);
    return { ...summary(d), data: withDraft ? d.data : undefined, versions: vs, files: fs };
  };

  // Files the data refers to: rows, images as data URLs, name/size.
  const assets = async (id, data) => {
    const ids = [...fileIdsOf(data)];
    const rows = ids.length ? await File.findAll({ where: { [ID]: id, fileId: ids } }) : [];
    const images = {}; const files = {};
    rows.forEach(f => {
      files[f.fileId] = { name: f.name, size: f.size };
      if (f.kind === 'image') images[f.fileId] = `data:${f.mime || 'image/jpeg'};base64,${Buffer.from(f.content).toString('base64')}`;
    });
    return { rows, images, files };
  };

  // The data + version a reviewer asked for (?version=N; default latest).
  const pick = async (d, versionParam, { allowDraft, preferDraft = false }) => {
    if (allowDraft && preferDraft) return { version: null, data: d.data };
    const vs = await versions(d[ID]);
    const n = Number(versionParam);
    const version = n ? vs.find(v => v.versionNumber === n) : vs[vs.length - 1];
    if (version) return { version, data: version.data };
    if (allowDraft) return { version: null, data: d.data };
    return null;
  };

  const authorOf = async (d) => d.author || Employee.findByPk(d.employeeId, { attributes: ['name', 'section'] });

  // ?part=<key> renders one part (an attachment form) on its own;
  // ?audience=participant leaves out answer keys.
  const sendDocument = async (req, res, d, picked) => {
    const author = await authorOf(d);
    const { images, files } = await assets(d[ID], picked.data);
    const html = render({ doc: d, version: picked.version, data: picked.data, author, images, files, part: req.query.part || null, audience: req.query.audience || null });
    if (!html) return notFound(res);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  };

  const sendZip = async (res, d, picked) => {
    const author = await authorOf(d);
    const data = picked.data || {};
    const { rows, images, files } = await assets(d[ID], data);
    const byId = new Map(rows.map(f => [f.fileId, f]));
    const out = new JSZip();
    const used = new Set();
    const add = (p, content) => {
      let q = p; let i = 2;
      while (used.has(q)) { const dot = p.lastIndexOf('.'); q = dot > 0 ? `${p.slice(0, dot)} (${i})${p.slice(dot)}` : `${p} (${i})`; i++; }
      used.add(q);
      out.file(q, content);
    };
    const base = `${fmtNo(d[NO])} - ${safeName(d.title || w.a)}${picked.version ? ` - v${picked.version.versionNumber}` : ''}`;
    add(`${base}.html`, render({ doc: d, version: picked.version, data, author, images, files }));
    add('data.json', JSON.stringify(data, null, 2));
    zip({ data, byId, add, safeName, renderPart: (part, audience) => render({ doc: d, version: picked.version, data, author, images, files, part, audience }) });
    const buf = await out.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', `attachment; filename="${w.zipName}.zip"; filename*=UTF-8''${encodeURIComponent(`${base}.zip`)}`);
    res.send(buf);
  };

  // ═════════════════════ Employee ═════════════════════

  const mine = (req) => Doc.findOne({ where: { [ID]: req.params.id, employeeId: req.employee.employeeId } });

  const myList = async (req, res) => {
    try {
      const docs = await Doc.findAll({
        where: { employeeId: req.employee.employeeId },
        attributes: { exclude: ['data'] },
        order: [['updatedAt', 'DESC']]
      });
      // latest reviewer comment, so the list can say why it came back
      const returned = docs.filter(d => d.status === 'returned').map(d => d[ID]);
      const latest = returned.length ? await Version.findAll({ where: { [ID]: returned }, order: [['versionNumber', 'DESC']] }) : [];
      res.json(docs.map(d => {
        const v = latest.find(x => x[ID] === d[ID]);
        return { ...summary(d), lastComment: v ? (v.managerDecision === 'returned' ? v.managerComment : v.pmComment) : null };
      }));
    } catch (err) { fail(res, 'myList')(err); }
  };

  const myCreate = async (req, res) => {
    try {
      const data = req.body?.data || null;
      if (data && JSON.stringify(data).length > MAX_DATA_CHARS) return bad(res, 413, 'Data too large', `بيانات ${w.the} كبيرة جدًا`);
      const d = await sequelize.transaction(async (transaction) => {
        await sequelize.query(`SELECT pg_advisory_xact_lock(hashtext('${lock}'))`, { transaction });
        const number = await assignNumber(transaction);
        return Doc.create({
          [NO]: number,
          employeeId: req.employee.employeeId,
          title: titleOf(data, req.employee),
          data,
          completion: Math.max(0, Math.min(100, Number(req.body?.completion) || 0))
        }, { transaction });
      });
      res.status(201).json(await full(d));
    } catch (err) { fail(res, 'myCreate')(err); }
  };

  const myGet = async (req, res) => {
    try {
      const d = await mine(req);
      if (!d) return notFound(res);
      res.json({ ...(await full(d)), pm: (await pmEmployee())?.name || null });
    } catch (err) { fail(res, 'myGet')(err); }
  };

  const mySave = async (req, res) => {
    try {
      const d = await mine(req);
      if (!d) return notFound(res);
      if (!EDITABLE.includes(d.status)) {
        return bad(res, 409, 'Under review — cannot be edited', `${w.the} قيد المراجعة ولا يمكن تعديلها الآن`, { code: 'LOCKED' });
      }
      const data = req.body?.data;
      if (!data || typeof data !== 'object' || !cfg.validData(data)) return bad(res, 400, 'Invalid data', `بيانات ${w.the} غير صحيحة`);
      if (JSON.stringify(data).length > MAX_DATA_CHARS) return bad(res, 413, 'Data too large', `بيانات ${w.the} كبيرة جدًا`);
      await d.update({ data, title: titleOf(data, req.employee), completion: Math.max(0, Math.min(100, Number(req.body?.completion) || 0)) });
      res.json({ ok: true, updatedAt: d.updatedAt });
    } catch (err) { fail(res, 'mySave')(err); }
  };

  // Only a draft that was never sent; its files go with it.
  const myDelete = async (req, res) => {
    try {
      const d = await mine(req);
      if (!d) return notFound(res);
      if (d.currentVersion > 0) return bad(res, 409, 'Already submitted', `لا يمكن حذف ${w.one} سبق إرسالها للمراجعة`);
      await File.destroy({ where: { [ID]: d[ID] } });
      await d.destroy({ force: true });
      res.json({ ok: true });
    } catch (err) { fail(res, 'myDelete')(err); }
  };

  // POST /mine/:id/files — raw body; name in X-File-Name (URI-encoded),
  // type in X-File-Type, ?kind=image|attachment.
  const myUpload = async (req, res) => {
    try {
      const d = await mine(req);
      if (!d) return notFound(res);
      if (!EDITABLE.includes(d.status)) return bad(res, 409, 'Under review', `${w.the} قيد المراجعة ولا يمكن تعديلها الآن`);
      const buf = req.body;
      if (!Buffer.isBuffer(buf) || !buf.length) return bad(res, 400, 'Empty file', 'الملف فارغ');
      if (buf.length > MAX_FILE_BYTES) return bad(res, 413, 'File too large', `الملف أكبر من ${MAX_FILE_BYTES / 1048576} MB`);
      let name = 'file';
      try { name = decodeURIComponent(String(req.get('X-File-Name') || 'file')); } catch { /* keep default */ }
      const f = await File.create({
        [ID]: d[ID],
        kind: req.query.kind === 'image' ? 'image' : 'attachment',
        name: name.slice(0, 250),
        mime: String(req.get('X-File-Type') || 'application/octet-stream').slice(0, 120),
        size: buf.length,
        content: buf,
        uploadedBy: req.employee.employeeId
      });
      res.status(201).json({ fileId: f.fileId, name: f.name, size: f.size, mime: f.mime, kind: f.kind });
    } catch (err) { fail(res, 'myUpload')(err); }
  };

  // Removing a file from the draft deletes it unless a submitted version
  // still refers to it (the history keeps it).
  const myDeleteFile = async (req, res) => {
    try {
      const d = await mine(req);
      if (!d) return notFound(res);
      if (!EDITABLE.includes(d.status)) return bad(res, 409, 'Under review', `${w.the} قيد المراجعة ولا يمكن تعديلها الآن`);
      const vs = await versions(d[ID]);
      const kept = vs.some(v => fileIdsOf(v.data).has(req.params.fileId));
      if (!kept) await File.destroy({ where: { [ID]: d[ID], fileId: req.params.fileId } });
      res.json({ ok: true, kept });
    } catch (err) { fail(res, 'myDeleteFile')(err); }
  };

  const myFile = async (req, res) => {
    try {
      const f = await File.findByPk(req.params.fileId);
      const d = f && await Doc.findByPk(f[ID], { attributes: [ID, 'employeeId'] });
      if (!f || !d || d.employeeId !== req.employee.employeeId) return bad(res, 404, 'File not found', 'الملف غير موجود');
      sendFile(res, f);
    } catch (err) { fail(res, 'myFile')(err); }
  };

  const mySubmit = async (req, res) => {
    try {
      const d = await mine(req);
      if (!d) return notFound(res);
      if (!EDITABLE.includes(d.status)) return bad(res, 409, 'Already sent', `${w.the} مُرسلة بالفعل وقيد المراجعة`);
      if (!cfg.readyToSend(d.data)) return bad(res, 400, 'Not ready to send', w.notReady);
      const note = String(req.body?.note || '').trim();
      if (d.currentVersion > 0 && !note) {
        return bad(res, 400, 'Describe what you changed', 'اكتب ما الذي عدّلته في هذا الإصدار قبل إعادة الإرسال');
      }
      const pm = await pmEmployee();
      if (!pm) {
        return bad(res, 409, 'No project manager is set', 'لم يُحدَّد مسؤول إدارة المشاريع بعد — تواصل مع المدير', { code: 'NO_PM' });
      }
      const versionNumber = d.currentVersion + 1;
      await sequelize.transaction(async (transaction) => {
        await Version.create({
          [ID]: d[ID], versionNumber, data: d.data, completion: d.completion,
          note: note || null, submittedAt: new Date()
        }, { transaction });
        await d.update({ status: 'pm_review', returnedBy: null, currentVersion: versionNumber, submittedAt: new Date() }, { transaction });
      });
      const name = d.title || w.a;
      sendMail(w.mailTag, pm.email, `${w.a} للمراجعة — ${name}`,
        `<p>مرحباً ${esc(pm.name)}،</p><p>أرسل <b>${esc(req.employee.name)}</b> ${w.the_} <b>«${esc(name)}»</b> (${fmtNo(d[NO])} — الإصدار ${versionNumber}) لمراجعتك.</p>
         ${commentBox('ما الذي تغيّر في هذا الإصدار:', note)}<p>افتحي «لوحة إدارة المشاريع» من لوحة الموظف لمراجعتها.</p>`);
      res.json(await full(d));
    } catch (err) { fail(res, 'mySubmit')(err); }
  };

  const myDocument = async (req, res) => {
    try {
      const d = await mine(req);
      if (!d) return notFound(res);
      await sendDocument(req, res, d, await pick(d, req.query.version, { allowDraft: true, preferDraft: req.query.draft === '1' }));
    } catch (err) { fail(res, 'myDocument')(err); }
  };

  const myZip = async (req, res) => {
    try {
      const d = await mine(req);
      if (!d) return notFound(res);
      await sendZip(res, d, await pick(d, req.query.version, { allowDraft: true, preferDraft: req.query.draft === '1' }));
    } catch (err) { fail(res, 'myZip')(err); }
  };

  // ═════════════════════ Reviewers ═════════════════════

  // Reviewers see a document once it has been sent at least once.
  const reviewDoc = (id) => Doc.findOne({ where: { [ID]: id, currentVersion: { [Op.gt]: 0 } }, include: [withAuthor] });

  const pmList = async (req, res) => {
    try {
      const where = { currentVersion: { [Op.gt]: 0 } };
      if (req.query.scope === 'queue') where.status = 'pm_review';
      const docs = await Doc.findAll({ where, attributes: { exclude: ['data'] }, include: [withAuthor], order: [['updatedAt', 'DESC']] });
      res.json(docs.map(summary));
    } catch (err) { fail(res, 'pmList')(err); }
  };

  const reviewGet = async (req, res) => {
    try {
      const d = await reviewDoc(req.params.id);
      if (!d) return notFound(res);
      res.json(await full(d, { withDraft: false }));
    } catch (err) { fail(res, 'reviewGet')(err); }
  };

  const decideOn = async ({ d, stage, decision, comment, reviewer }) => {
    const version = await Version.findOne({ where: { [ID]: d[ID], versionNumber: d.currentVersion } });
    const now = new Date();
    await sequelize.transaction(async (transaction) => {
      if (stage === 'pm') {
        await version.update({ pmDecision: decision, pmComment: comment || null, pmName: reviewer.name, pmEmployeeId: reviewer.id, pmAt: now }, { transaction });
        await d.update(decision === 'approved'
          ? { status: 'manager_review', returnedBy: null }
          : { status: 'returned', returnedBy: 'pm' }, { transaction });
      } else {
        await version.update({ managerDecision: decision, managerComment: comment || null, managerName: reviewer.name, managerAdminId: reviewer.id, managerAt: now }, { transaction });
        await d.update(decision === 'approved'
          ? { status: 'approved', returnedBy: null, approvedAt: now, approvedVersion: d.currentVersion }
          : { status: 'returned', returnedBy: 'manager' }, { transaction });
      }
    });
    return version;
  };

  const readDecision = (req, res) => {
    const decision = req.body?.decision === 'approve' ? 'approved' : req.body?.decision === 'return' ? 'returned' : null;
    const comment = String(req.body?.comment || '').trim();
    if (!decision) { bad(res, 400, 'Choose approve or return', 'اختر الاعتماد أو الإعادة'); return null; }
    if (decision === 'returned' && !comment) { bad(res, 400, 'Write what needs fixing', `اكتب الملاحظات المطلوب تعديلها قبل إعادة ${w.the}`); return null; }
    return { decision, comment };
  };

  const pmDecide = async (req, res) => {
    try {
      const dec = readDecision(req, res);
      if (!dec) return;
      const d = await reviewDoc(req.params.id);
      if (!d) return notFound(res);
      if (d.status !== 'pm_review') return bad(res, 409, 'Not waiting for your review', `${w.the} ليست بانتظار مراجعتك`);
      await decideOn({ d, stage: 'pm', ...dec, reviewer: { name: req.employee.name, id: req.employee.employeeId } });
      const name = d.title || w.a;
      if (dec.decision === 'approved') {
        sendMail(w.mailTag, d.author?.email, `اعتُمدت مراجعة ${w.the} — ${name}`,
          `<p>مرحباً ${esc(d.author?.name)}،</p><p>راجعت <b>${esc(req.employee.name)}</b> ${w.your} <b>«${esc(name)}»</b> (الإصدار ${d.currentVersion}) وأرسلتها إلى المدير للاعتماد النهائي.</p>${commentBox('ملاحظة:', dec.comment)}`);
      } else {
        sendMail(w.mailTag, d.author?.email, `مطلوب تعديل على ${w.the} — ${name}`,
          `<p>مرحباً ${esc(d.author?.name)}،</p><p>أعادت <b>${esc(req.employee.name)}</b> ${w.your} <b>«${esc(name)}»</b> (الإصدار ${d.currentVersion}) مع ملاحظات للتعديل:</p>${commentBox('الملاحظات:', dec.comment)}<p>افتح «${w.tab}» في لوحة الموظف، عدّلها ثم أعد إرسالها.</p>`);
      }
      res.json(await full(await reviewDoc(d[ID]), { withDraft: false }));
    } catch (err) { fail(res, 'pmDecide')(err); }
  };

  const reviewFile = async (req, res) => {
    try {
      const f = await File.findByPk(req.params.fileId);
      if (!f) return bad(res, 404, 'File not found', 'الملف غير موجود');
      sendFile(res, f);
    } catch (err) { fail(res, 'reviewFile')(err); }
  };

  const reviewDocument = async (req, res) => {
    try {
      const d = await reviewDoc(req.params.id);
      if (!d) return notFound(res);
      await sendDocument(req, res, d, await pick(d, req.query.version, { allowDraft: false }));
    } catch (err) { fail(res, 'reviewDocument')(err); }
  };

  const reviewZip = async (req, res) => {
    try {
      const d = await reviewDoc(req.params.id);
      if (!d) return notFound(res);
      await sendZip(res, d, await pick(d, req.query.version, { allowDraft: false }));
    } catch (err) { fail(res, 'reviewZip')(err); }
  };

  // ═════════════════════ Manager ═════════════════════

  const adminList = async (req, res) => {
    try {
      const where = { currentVersion: { [Op.gt]: 0 } };
      if (req.query.scope === 'pending') where.status = 'manager_review';
      if (req.query.scope === 'approved') where.status = 'approved';
      const docs = await Doc.findAll({ where, attributes: { exclude: ['data'] }, include: [withAuthor], order: [['updatedAt', 'DESC']] });
      res.json(docs.map(summary));
    } catch (err) { fail(res, 'adminList')(err); }
  };

  const adminDecide = async (req, res) => {
    try {
      const dec = readDecision(req, res);
      if (!dec) return;
      const d = await reviewDoc(req.params.id);
      if (!d) return notFound(res);
      if (d.status !== 'manager_review') return bad(res, 409, 'Not waiting for the manager', `${w.the} ليست بانتظار اعتماد المدير`);
      const reviewer = { name: req.admin.fullName || req.admin.username || 'المدير', id: req.admin.adminId };
      const version = await decideOn({ d, stage: 'manager', ...dec, reviewer });
      const name = d.title || w.a;
      const pm = version.pmEmployeeId ? await Employee.findByPk(version.pmEmployeeId) : null;
      const to = [d.author?.email, pm?.email].filter(Boolean);
      if (dec.decision === 'approved') {
        sendMail(w.mailTag, to, `اعتُمدت ${w.the_} — ${name}`,
          `<p>اعتمد <b>${esc(reviewer.name)}</b> ${w.the_} <b>«${esc(name)}»</b> (${fmtNo(d[NO])} — الإصدار ${d.currentVersion}) اعتمادًا نهائيًا.</p>${commentBox('ملاحظة:', dec.comment)}${w.approvedNote || ''}`);
      } else {
        sendMail(w.mailTag, to, `مطلوب تعديل على ${w.the} — ${name}`,
          `<p>أعاد <b>${esc(reviewer.name)}</b> ${w.the_} <b>«${esc(name)}»</b> (الإصدار ${d.currentVersion}) مع ملاحظات للتعديل:</p>${commentBox('الملاحظات:', dec.comment)}<p>بعد التعديل تُعاد إلى مسؤول إدارة المشاريع ثم إلى المدير.</p>`);
      }
      res.json(await full(await reviewDoc(d[ID]), { withDraft: false }));
    } catch (err) { fail(res, 'adminDecide')(err); }
  };

  // Manager only. A soft delete (deletedAt): it disappears from every
  // list and screen, but the row, its versions and files stay in the
  // database so a mistake can still be undone there.
  const adminDelete = async (req, res) => {
    try {
      const d = await Doc.findByPk(req.params.id);
      if (!d) return notFound(res);
      await d.destroy();
      console.log(`${w.logTag} deleted ${fmtNo(d[NO])} (${d[ID]}) by admin ${req.admin.adminId}`);
      res.json({ ok: true });
    } catch (err) { fail(res, 'adminDelete')(err); }
  };

  return {
    myList, myCreate, myGet, mySave, myDelete, myUpload, myDeleteFile, myFile, mySubmit, myDocument, myZip,
    pmList, pmGet: reviewGet, pmDecide, pmFile: reviewFile, reviewDocument, reviewZip,
    adminList, adminGet: reviewGet, adminDecide, adminFile: reviewFile, adminDelete
  };
};

// Shared by every type: who the PM is, and the manager's setting for it.
const pmStatus = async (req, res) => {
  try {
    const pm = await pmEmployee();
    res.json({ isPM: !!(pm && pm.employeeId === req.employee.employeeId), pmName: pm?.name || null });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const requirePM = async (req, res, next) => {
  try {
    if (!(await isPM(req.employee))) return bad(res, 403, 'Project manager only', 'هذه الصفحة مخصصة لمسؤول إدارة المشاريع');
    next();
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const adminSettings = async (req, res) => {
  try {
    const [pm, employees] = await Promise.all([
      pmEmployee(),
      Employee.findAll({ where: { isActive: true }, attributes: ['employeeId', 'name', 'section'], order: [['name', 'ASC']] })
    ]);
    res.json({ pm: pm ? { employeeId: pm.employeeId, name: pm.name } : null, employees });
  } catch (err) {
    console.error('reviewFlow adminSettings:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const adminSaveSettings = async (req, res) => {
  try {
    const id = req.body?.pmEmployeeId;
    const e = id ? await Employee.findByPk(id) : null;
    if (!e || !e.isActive) return bad(res, 400, 'Choose an active employee', 'اختر موظفًا نشطًا');
    await Settings.upsert({ key: PM_SETTING, value: { employeeId: e.employeeId } });
    res.json({ pm: { employeeId: e.employeeId, name: e.name } });
  } catch (err) {
    console.error('reviewFlow adminSaveSettings:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createReviewFlow, pmStatus, requirePM, adminSettings, adminSaveSettings };
