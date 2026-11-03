// Training kits (الحقائب التدريبية): the employee fills the kit template
// and sends it to the project manager (مسؤول إدارة المشاريع); she
// approves it on to the manager or returns it with comments; the manager
// gives the final approval or returns it. Every submission is frozen as
// a version, so the edit history and every comment stay visible.
const path = require('path');
const sgMail = require('@sendgrid/mail');
const JSZip = require('jszip');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { TrainingKit, TrainingKitVersion, TrainingKitFile, Employee, Settings } = require('../models');
const { renderKitDocument, fmtKitNo } = require('../utils/trainingKitDoc');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const PM_SETTING = 'training_kit_pm';
const EDITABLE = ['draft', 'returned'];
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_DATA_CHARS = 2 * 1024 * 1024;

const bad = (res, status, message, messageAr, extra = {}) => res.status(status).json({ message, messageAr, ...extra });
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ─────────────── People ───────────────

// The project manager is chosen by the manager (Settings); until then the
// employee named …البوعبيد (م. نوف) is used.
const _pmEmployee = async () => {
  const row = await Settings.findByPk(PM_SETTING);
  const id = row?.value?.employeeId;
  if (id) {
    const e = await Employee.findByPk(id);
    if (e && e.isActive) return e;
  }
  return Employee.findOne({ where: { isActive: true, name: { [Op.iLike]: '%البوعبيد%' } } });
};

const _isPM = async (employee) => {
  const pm = await _pmEmployee();
  return !!(pm && employee && pm.employeeId === employee.employeeId);
};

// ─────────────── Helpers ───────────────

const _assignNumber = (transaction) => sequelize.query(
  'SELECT COALESCE(MAX("kitNumber"), 0) + 1 AS next FROM training_kits', { transaction }
).then(([rows]) => Number(rows?.[0]?.next) || 1);

const _titleOf = (data) => String(data?.card?.name || '').trim().slice(0, 250) || null;

// fileIds referenced by a kit data object (reference images + attachments).
const _fileIdsOf = (data) => {
  const ids = new Set();
  (data?.images || []).forEach(im => im?.fileId && ids.add(im.fileId));
  (data?.attachments || []).forEach(a => (a?.files || []).forEach(f => f?.fileId && ids.add(f.fileId)));
  return ids;
};

const _summary = (k) => ({
  kitId: k.kitId,
  kitNumber: k.kitNumber,
  title: k.title,
  status: k.status,
  returnedBy: k.returnedBy,
  completion: k.completion,
  currentVersion: k.currentVersion,
  submittedAt: k.submittedAt,
  approvedAt: k.approvedAt,
  approvedVersion: k.approvedVersion,
  createdAt: k.createdAt,
  updatedAt: k.updatedAt,
  author: k.author ? { employeeId: k.author.employeeId, name: k.author.name, section: k.author.section } : undefined
});

const _versions = (kitId) => TrainingKitVersion.findAll({ where: { kitId }, order: [['versionNumber', 'ASC']] });
const _filesMeta = (kitId) => TrainingKitFile.findAll({
  where: { kitId }, attributes: ['fileId', 'kind', 'name', 'mime', 'size', 'createdAt'], order: [['createdAt', 'ASC']]
});

const _full = async (kit, { withDraft = true } = {}) => {
  const [versions, files] = await Promise.all([_versions(kit.kitId), _filesMeta(kit.kitId)]);
  return { ..._summary(kit), data: withDraft ? kit.data : undefined, versions, files };
};

const _withAuthor = { model: Employee, as: 'author', attributes: ['employeeId', 'name', 'section', 'email'] };

const _sendMail = async (to, subject, bodyHtml) => {
  if (!to || (Array.isArray(to) && !to.length) || !process.env.SENDGRID_API_KEY) return;
  try {
    await sgMail.send({
      to,
      from: { email: process.env.SENDGRID_FROM_EMAIL, name: process.env.SENDGRID_FROM_NAME || 'FABLAB Al-Ahsa' },
      subject,
      html: `<div dir="rtl" style="font-family:Segoe UI,Tahoma,Arial,sans-serif;background:#f4f6fb;padding:24px;color:#0f172a">
        <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,.08)">
          <div style="background:linear-gradient(135deg,#7f1d1d,#EE2329);color:#fff;padding:18px 22px">
            <div style="font-size:12px;opacity:.85">FABLAB الأحساء · الحقائب التدريبية</div>
            <div style="font-size:19px;font-weight:800;margin-top:4px">${esc(subject)}</div>
          </div>
          <div style="padding:20px 22px;font-size:14px;line-height:1.8">${bodyHtml}</div>
        </div></div>`
    });
  } catch (err) {
    console.error('training kit email failed:', err?.response?.body || err.message);
  }
};

const _comment = (label, text) => (text
  ? `<div style="background:#fff7ed;border-right:4px solid #f59e0b;border-radius:8px;padding:10px 14px;margin:12px 0"><b>${esc(label)}</b><div style="white-space:pre-wrap">${esc(text)}</div></div>`
  : '');

// Images as data URLs + file name/size for the printable document.
const _docAssets = async (kitId, data) => {
  const ids = [..._fileIdsOf(data)];
  if (!ids.length) return { images: {}, files: {} };
  const rows = await TrainingKitFile.findAll({ where: { kitId, fileId: ids } });
  const images = {}; const files = {};
  rows.forEach(f => {
    files[f.fileId] = { name: f.name, size: f.size };
    if (f.kind === 'image') images[f.fileId] = `data:${f.mime || 'image/jpeg'};base64,${Buffer.from(f.content).toString('base64')}`;
  });
  return { images, files };
};

// The data + version a reviewer asked for (?version=N; default latest).
const _pick = async (kit, versionParam, { allowDraft, preferDraft = false }) => {
  if (allowDraft && preferDraft) return { version: null, data: kit.data };
  const versions = await _versions(kit.kitId);
  const n = Number(versionParam);
  const version = n ? versions.find(v => v.versionNumber === n) : versions[versions.length - 1];
  if (version) return { version, data: version.data };
  if (allowDraft) return { version: null, data: kit.data };
  return null;
};

const _sendDocument = async (res, kit, picked) => {
  const author = kit.author || await Employee.findByPk(kit.employeeId, { attributes: ['name'] });
  const assets = await _docAssets(kit.kitId, picked.data);
  const html = renderKitDocument({ kit, version: picked.version, data: picked.data, author, ...assets });
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
};

const _safeName = (s) => String(s || '').replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 120) || 'file';

const _sendZip = async (res, kit, picked) => {
  const author = kit.author || await Employee.findByPk(kit.employeeId, { attributes: ['name'] });
  const data = picked.data || {};
  const ids = [..._fileIdsOf(data)];
  const rows = ids.length ? await TrainingKitFile.findAll({ where: { kitId: kit.kitId, fileId: ids } }) : [];
  const byId = new Map(rows.map(f => [f.fileId, f]));
  const images = {}; const files = {};
  rows.forEach(f => {
    files[f.fileId] = { name: f.name, size: f.size };
    if (f.kind === 'image') images[f.fileId] = `data:${f.mime || 'image/jpeg'};base64,${Buffer.from(f.content).toString('base64')}`;
  });

  const zip = new JSZip();
  const base = `${fmtKitNo(kit.kitNumber)} - ${_safeName(data.card?.name || 'حقيبة تدريبية')}${picked.version ? ` - v${picked.version.versionNumber}` : ''}`;
  zip.file(`${base}.html`, renderKitDocument({ kit, version: picked.version, data, author, images, files }));
  zip.file('kit-data.json', JSON.stringify(data, null, 2));
  const used = new Set();
  const unique = (p) => { let q = p; let i = 2; while (used.has(q)) { const dot = p.lastIndexOf('.'); q = dot > 0 ? `${p.slice(0, dot)} (${i})${p.slice(dot)}` : `${p} (${i})`; i++; } used.add(q); return q; };
  (data.attachments || []).forEach(a => (a.files || []).forEach(f => {
    const row = byId.get(f.fileId);
    if (row) zip.file(unique(`المرفقات/${_safeName(a.label)}/${_safeName(row.name)}`), row.content);
  }));
  const outputs = data.outputs || [];
  (data.images || []).forEach(im => {
    const row = byId.get(im.fileId);
    if (!row) return;
    const i = outputs.findIndex(o => o.id === im.outputId);
    zip.file(unique(`الصور المرجعية/${i >= 0 ? `م${i + 1} - ` : ''}${_safeName(row.name)}`), row.content);
  });
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  res.set('Content-Type', 'application/zip');
  res.set('Content-Disposition', `attachment; filename="kit.zip"; filename*=UTF-8''${encodeURIComponent(`${base}.zip`)}`);
  res.send(buf);
};

const _sendFile = (res, f) => {
  res.set('Content-Type', f.mime || 'application/octet-stream');
  res.set('Content-Disposition', `attachment; filename="file"; filename*=UTF-8''${encodeURIComponent(f.name)}`);
  res.send(Buffer.from(f.content));
};

// ═════════════════════ Employee ═════════════════════

exports.myList = async (req, res) => {
  try {
    const kits = await TrainingKit.findAll({
      where: { employeeId: req.employee.employeeId },
      attributes: { exclude: ['data'] },
      order: [['updatedAt', 'DESC']]
    });
    // latest reviewer comment, so the list can say why a kit came back
    const returned = kits.filter(k => k.status === 'returned').map(k => k.kitId);
    const latest = returned.length ? await TrainingKitVersion.findAll({ where: { kitId: returned }, order: [['versionNumber', 'DESC']] }) : [];
    res.json(kits.map(k => {
      const v = latest.find(x => x.kitId === k.kitId);
      return { ..._summary(k), lastComment: v ? (v.managerDecision === 'returned' ? v.managerComment : v.pmComment) : null };
    }));
  } catch (err) {
    console.error('kits myList:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.myCreate = async (req, res) => {
  try {
    const data = req.body?.data || null;
    const kit = await sequelize.transaction(async (transaction) => {
      await sequelize.query("SELECT pg_advisory_xact_lock(hashtext('training-kit-number'))", { transaction });
      const kitNumber = await _assignNumber(transaction);
      return TrainingKit.create({
        kitNumber,
        employeeId: req.employee.employeeId,
        title: _titleOf(data),
        data,
        completion: Number(req.body?.completion) || 0
      }, { transaction });
    });
    res.status(201).json(await _full(kit));
  } catch (err) {
    console.error('kits myCreate:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const _myKit = (req) => TrainingKit.findOne({ where: { kitId: req.params.id, employeeId: req.employee.employeeId } });

exports.myGet = async (req, res) => {
  try {
    const kit = await _myKit(req);
    if (!kit) return bad(res, 404, 'Kit not found', 'الحقيبة غير موجودة');
    res.json({ ...(await _full(kit)), pm: (await _pmEmployee())?.name || null });
  } catch (err) {
    console.error('kits myGet:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.mySave = async (req, res) => {
  try {
    const kit = await _myKit(req);
    if (!kit) return bad(res, 404, 'Kit not found', 'الحقيبة غير موجودة');
    if (!EDITABLE.includes(kit.status)) {
      return bad(res, 409, 'The kit is under review and cannot be edited', 'الحقيبة قيد المراجعة ولا يمكن تعديلها الآن', { code: 'KIT_LOCKED' });
    }
    const data = req.body?.data;
    if (!data || typeof data !== 'object' || !data.card) return bad(res, 400, 'Invalid kit data', 'بيانات الحقيبة غير صحيحة');
    if (JSON.stringify(data).length > MAX_DATA_CHARS) return bad(res, 413, 'Kit data too large', 'بيانات الحقيبة كبيرة جدًا');
    await kit.update({ data, title: _titleOf(data), completion: Math.max(0, Math.min(100, Number(req.body?.completion) || 0)) });
    res.json({ ok: true, updatedAt: kit.updatedAt });
  } catch (err) {
    console.error('kits mySave:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.myDelete = async (req, res) => {
  try {
    const kit = await _myKit(req);
    if (!kit) return bad(res, 404, 'Kit not found', 'الحقيبة غير موجودة');
    if (kit.currentVersion > 0) return bad(res, 409, 'A submitted kit cannot be deleted', 'لا يمكن حذف حقيبة سبق إرسالها للمراجعة');
    await TrainingKitFile.destroy({ where: { kitId: kit.kitId } });
    await kit.destroy();
    res.json({ ok: true });
  } catch (err) {
    console.error('kits myDelete:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /mine/:id/files — raw body; name in X-File-Name (URI-encoded),
// type in X-File-Type, ?kind=image|attachment.
exports.myUpload = async (req, res) => {
  try {
    const kit = await _myKit(req);
    if (!kit) return bad(res, 404, 'Kit not found', 'الحقيبة غير موجودة');
    if (!EDITABLE.includes(kit.status)) return bad(res, 409, 'The kit is under review', 'الحقيبة قيد المراجعة ولا يمكن تعديلها الآن');
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || !buf.length) return bad(res, 400, 'Empty file', 'الملف فارغ');
    if (buf.length > MAX_FILE_BYTES) return bad(res, 413, 'File too large', `الملف أكبر من ${MAX_FILE_BYTES / 1048576} MB`);
    let name = 'file';
    try { name = decodeURIComponent(String(req.get('X-File-Name') || 'file')); } catch { /* keep default */ }
    const f = await TrainingKitFile.create({
      kitId: kit.kitId,
      kind: req.query.kind === 'image' ? 'image' : 'attachment',
      name: name.slice(0, 250),
      mime: String(req.get('X-File-Type') || 'application/octet-stream').slice(0, 120),
      size: buf.length,
      content: buf,
      uploadedBy: req.employee.employeeId
    });
    res.status(201).json({ fileId: f.fileId, name: f.name, size: f.size, mime: f.mime, kind: f.kind });
  } catch (err) {
    console.error('kits myUpload:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Removing a file from the draft deletes it unless a submitted version
// still refers to it (the history keeps it).
exports.myDeleteFile = async (req, res) => {
  try {
    const kit = await _myKit(req);
    if (!kit) return bad(res, 404, 'Kit not found', 'الحقيبة غير موجودة');
    if (!EDITABLE.includes(kit.status)) return bad(res, 409, 'The kit is under review', 'الحقيبة قيد المراجعة ولا يمكن تعديلها الآن');
    const versions = await _versions(kit.kitId);
    const kept = versions.some(v => _fileIdsOf(v.data).has(req.params.fileId));
    if (!kept) await TrainingKitFile.destroy({ where: { kitId: kit.kitId, fileId: req.params.fileId } });
    res.json({ ok: true, kept });
  } catch (err) {
    console.error('kits myDeleteFile:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.myFile = async (req, res) => {
  try {
    const f = await TrainingKitFile.findByPk(req.params.fileId);
    const kit = f && await TrainingKit.findByPk(f.kitId, { attributes: ['kitId', 'employeeId'] });
    if (!f || !kit || kit.employeeId !== req.employee.employeeId) return bad(res, 404, 'File not found', 'الملف غير موجود');
    _sendFile(res, f);
  } catch (err) {
    console.error('kits myFile:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.mySubmit = async (req, res) => {
  try {
    const kit = await _myKit(req);
    if (!kit) return bad(res, 404, 'Kit not found', 'الحقيبة غير موجودة');
    if (!EDITABLE.includes(kit.status)) return bad(res, 409, 'The kit was already sent', 'الحقيبة مُرسلة بالفعل وقيد المراجعة');
    if (!_titleOf(kit.data)) return bad(res, 400, 'Add the program name first', 'اكتب اسم البرنامج التدريبي قبل الإرسال');
    const note = String(req.body?.note || '').trim();
    if (kit.currentVersion > 0 && !note) {
      return bad(res, 400, 'Describe what you changed', 'اكتب ما الذي عدّلته في هذا الإصدار قبل إعادة الإرسال');
    }
    const pm = await _pmEmployee();
    if (!pm) {
      return bad(res, 409, 'No project manager is set', 'لم يُحدَّد مسؤول إدارة المشاريع بعد — تواصل مع المدير', { code: 'NO_PM' });
    }
    const versionNumber = kit.currentVersion + 1;
    await sequelize.transaction(async (transaction) => {
      await TrainingKitVersion.create({
        kitId: kit.kitId, versionNumber, data: kit.data, completion: kit.completion,
        note: note || null, submittedAt: new Date()
      }, { transaction });
      await kit.update({ status: 'pm_review', returnedBy: null, currentVersion: versionNumber, submittedAt: new Date() }, { transaction });
    });
    const name = kit.title || 'حقيبة تدريبية';
    _sendMail(pm.email, `حقيبة تدريبية للمراجعة — ${name}`,
      `<p>مرحباً ${esc(pm.name)}،</p><p>أرسل <b>${esc(req.employee.name)}</b> الحقيبة التدريبية <b>«${esc(name)}»</b> (${fmtKitNo(kit.kitNumber)} — الإصدار ${versionNumber}) لمراجعتك.</p>
       ${_comment('ما الذي تغيّر في هذا الإصدار:', note)}<p>افتحي «لوحة إدارة المشاريع» من لوحة الموظف لمراجعتها.</p>`);
    res.json(await _full(kit));
  } catch (err) {
    console.error('kits mySubmit:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.myDocument = async (req, res) => {
  try {
    const kit = await _myKit(req);
    if (!kit) return bad(res, 404, 'Kit not found', 'الحقيبة غير موجودة');
    await _sendDocument(res, kit, await _pick(kit, req.query.version, { allowDraft: true, preferDraft: req.query.draft === '1' }));
  } catch (err) {
    console.error('kits myDocument:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.myZip = async (req, res) => {
  try {
    const kit = await _myKit(req);
    if (!kit) return bad(res, 404, 'Kit not found', 'الحقيبة غير موجودة');
    await _sendZip(res, kit, await _pick(kit, req.query.version, { allowDraft: true, preferDraft: req.query.draft === '1' }));
  } catch (err) {
    console.error('kits myZip:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ═════════════════════ Project manager ═════════════════════

exports.pmStatus = async (req, res) => {
  try {
    const pm = await _pmEmployee();
    res.json({ isPM: !!(pm && pm.employeeId === req.employee.employeeId), pmName: pm?.name || null });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.requirePM = async (req, res, next) => {
  try {
    if (!(await _isPM(req.employee))) {
      return bad(res, 403, 'Project manager only', 'هذه الصفحة مخصصة لمسؤول إدارة المشاريع');
    }
    next();
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Reviewers see a kit once it has been sent at least once.
const _reviewKit = (id) => TrainingKit.findOne({ where: { kitId: id, currentVersion: { [Op.gt]: 0 } }, include: [_withAuthor] });

exports.pmList = async (req, res) => {
  try {
    const where = { currentVersion: { [Op.gt]: 0 } };
    if (req.query.scope === 'queue') where.status = 'pm_review';
    const kits = await TrainingKit.findAll({ where, attributes: { exclude: ['data'] }, include: [_withAuthor], order: [['updatedAt', 'DESC']] });
    res.json(kits.map(_summary));
  } catch (err) {
    console.error('kits pmList:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.pmGet = async (req, res) => {
  try {
    const kit = await _reviewKit(req.params.id);
    if (!kit) return bad(res, 404, 'Kit not found', 'الحقيبة غير موجودة');
    res.json(await _full(kit, { withDraft: false }));
  } catch (err) {
    console.error('kits pmGet:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const _decide = async ({ kit, stage, decision, comment, reviewer }) => {
  const version = await TrainingKitVersion.findOne({ where: { kitId: kit.kitId, versionNumber: kit.currentVersion } });
  const now = new Date();
  await sequelize.transaction(async (transaction) => {
    if (stage === 'pm') {
      await version.update({ pmDecision: decision, pmComment: comment || null, pmName: reviewer.name, pmEmployeeId: reviewer.id, pmAt: now }, { transaction });
      await kit.update(decision === 'approved'
        ? { status: 'manager_review', returnedBy: null }
        : { status: 'returned', returnedBy: 'pm' }, { transaction });
    } else {
      await version.update({ managerDecision: decision, managerComment: comment || null, managerName: reviewer.name, managerAdminId: reviewer.id, managerAt: now }, { transaction });
      await kit.update(decision === 'approved'
        ? { status: 'approved', returnedBy: null, approvedAt: now, approvedVersion: kit.currentVersion }
        : { status: 'returned', returnedBy: 'manager' }, { transaction });
    }
  });
  return version;
};

const _readDecision = (req, res) => {
  const decision = req.body?.decision === 'approve' ? 'approved' : req.body?.decision === 'return' ? 'returned' : null;
  const comment = String(req.body?.comment || '').trim();
  if (!decision) { bad(res, 400, 'Choose approve or return', 'اختر الاعتماد أو الإعادة'); return null; }
  if (decision === 'returned' && !comment) { bad(res, 400, 'Write what needs fixing', 'اكتب الملاحظات المطلوب تعديلها قبل إعادة الحقيبة'); return null; }
  return { decision, comment };
};

exports.pmDecide = async (req, res) => {
  try {
    const d = _readDecision(req, res);
    if (!d) return;
    const kit = await _reviewKit(req.params.id);
    if (!kit) return bad(res, 404, 'Kit not found', 'الحقيبة غير موجودة');
    if (kit.status !== 'pm_review') return bad(res, 409, 'The kit is not waiting for your review', 'الحقيبة ليست بانتظار مراجعتك');
    await _decide({ kit, stage: 'pm', ...d, reviewer: { name: req.employee.name, id: req.employee.employeeId } });
    const name = kit.title || 'حقيبة تدريبية';
    if (d.decision === 'approved') {
      _sendMail(kit.author?.email, `اعتُمدت مراجعة الحقيبة — ${name}`,
        `<p>مرحباً ${esc(kit.author?.name)}،</p><p>راجعت <b>${esc(req.employee.name)}</b> حقيبتك <b>«${esc(name)}»</b> (الإصدار ${kit.currentVersion}) وأرسلتها إلى المدير للاعتماد النهائي.</p>${_comment('ملاحظة:', d.comment)}`);
    } else {
      _sendMail(kit.author?.email, `مطلوب تعديل على الحقيبة — ${name}`,
        `<p>مرحباً ${esc(kit.author?.name)}،</p><p>أعادت <b>${esc(req.employee.name)}</b> حقيبتك <b>«${esc(name)}»</b> (الإصدار ${kit.currentVersion}) مع ملاحظات للتعديل:</p>${_comment('الملاحظات:', d.comment)}<p>افتح «الحقائب التدريبية» في لوحة الموظف، عدّل الحقيبة ثم أعد إرسالها.</p>`);
    }
    res.json(await _full(await _reviewKit(kit.kitId), { withDraft: false }));
  } catch (err) {
    console.error('kits pmDecide:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.pmFile = async (req, res) => {
  try {
    const f = await TrainingKitFile.findByPk(req.params.fileId);
    if (!f) return bad(res, 404, 'File not found', 'الملف غير موجود');
    _sendFile(res, f);
  } catch (err) {
    console.error('kits pmFile:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.reviewDocument = async (req, res) => {
  try {
    const kit = await _reviewKit(req.params.id);
    if (!kit) return bad(res, 404, 'Kit not found', 'الحقيبة غير موجودة');
    await _sendDocument(res, kit, await _pick(kit, req.query.version, { allowDraft: false }));
  } catch (err) {
    console.error('kits reviewDocument:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.reviewZip = async (req, res) => {
  try {
    const kit = await _reviewKit(req.params.id);
    if (!kit) return bad(res, 404, 'Kit not found', 'الحقيبة غير موجودة');
    await _sendZip(res, kit, await _pick(kit, req.query.version, { allowDraft: false }));
  } catch (err) {
    console.error('kits reviewZip:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ═════════════════════ Manager ═════════════════════

exports.adminList = async (req, res) => {
  try {
    const where = { currentVersion: { [Op.gt]: 0 } };
    if (req.query.scope === 'pending') where.status = 'manager_review';
    if (req.query.scope === 'approved') where.status = 'approved';
    const kits = await TrainingKit.findAll({ where, attributes: { exclude: ['data'] }, include: [_withAuthor], order: [['updatedAt', 'DESC']] });
    res.json(kits.map(_summary));
  } catch (err) {
    console.error('kits adminList:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.adminGet = exports.pmGet;

exports.adminDecide = async (req, res) => {
  try {
    const d = _readDecision(req, res);
    if (!d) return;
    const kit = await _reviewKit(req.params.id);
    if (!kit) return bad(res, 404, 'Kit not found', 'الحقيبة غير موجودة');
    if (kit.status !== 'manager_review') return bad(res, 409, 'The kit is not waiting for the manager', 'الحقيبة ليست بانتظار اعتماد المدير');
    const reviewer = { name: req.admin.fullName || req.admin.username || 'المدير', id: req.admin.adminId };
    const version = await _decide({ kit, stage: 'manager', ...d, reviewer });
    const name = kit.title || 'حقيبة تدريبية';
    const pm = version.pmEmployeeId ? await Employee.findByPk(version.pmEmployeeId) : null;
    const to = [kit.author?.email, pm?.email].filter(Boolean);
    if (d.decision === 'approved') {
      _sendMail(to, `اعتُمدت الحقيبة التدريبية — ${name}`,
        `<p>اعتمد <b>${esc(reviewer.name)}</b> الحقيبة التدريبية <b>«${esc(name)}»</b> (${fmtKitNo(kit.kitNumber)} — الإصدار ${kit.currentVersion}) اعتمادًا نهائيًا.</p>${_comment('ملاحظة:', d.comment)}<p>أصبحت الحقيبة متاحة في «الحقائب التدريبية» لاستخدامها في طلب ورشة لاحقًا.</p>`);
    } else {
      _sendMail(to, `مطلوب تعديل على الحقيبة — ${name}`,
        `<p>أعاد <b>${esc(reviewer.name)}</b> الحقيبة التدريبية <b>«${esc(name)}»</b> (الإصدار ${kit.currentVersion}) مع ملاحظات للتعديل:</p>${_comment('الملاحظات:', d.comment)}<p>بعد التعديل تُعاد الحقيبة إلى مسؤول إدارة المشاريع ثم إلى المدير.</p>`);
    }
    res.json(await _full(await _reviewKit(kit.kitId), { withDraft: false }));
  } catch (err) {
    console.error('kits adminDecide:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.adminFile = exports.pmFile;

// Project manager setting (who reviews kits before the manager).
exports.adminSettings = async (req, res) => {
  try {
    const [pm, employees] = await Promise.all([
      _pmEmployee(),
      Employee.findAll({ where: { isActive: true }, attributes: ['employeeId', 'name', 'section'], order: [['name', 'ASC']] })
    ]);
    res.json({ pm: pm ? { employeeId: pm.employeeId, name: pm.name } : null, employees });
  } catch (err) {
    console.error('kits adminSettings:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.adminSaveSettings = async (req, res) => {
  try {
    const id = req.body?.pmEmployeeId;
    const e = id ? await Employee.findByPk(id) : null;
    if (!e || !e.isActive) return bad(res, 400, 'Choose an active employee', 'اختر موظفًا نشطًا');
    await Settings.upsert({ key: PM_SETTING, value: { employeeId: e.employeeId } });
    res.json({ pm: { employeeId: e.employeeId, name: e.name } });
  } catch (err) {
    console.error('kits adminSaveSettings:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
