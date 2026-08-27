const { InstitutionProject } = require('../models');
const { sequelize } = require('../config/database');
const { PDFDocument } = require('pdf-lib');
const { generatePdfFromHtml } = require('../utils/pdfGenerator');

const MAX_IMAGES = 50;

const fmtProjectNumber = (n) => n == null ? '—' : `ISP-${String(n).padStart(4, '0')}`;

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const _assignNextNumber = async () => {
  return await sequelize.transaction(async (t) => {
    const [row] = await sequelize.query(
      `SELECT COALESCE(MAX("projectNumber"), 0) + 1 AS next FROM institution_projects`,
      { transaction: t }
    );
    return Number(row?.[0]?.next) || 1;
  });
};

// Normalize an incoming file payload from the client:
//   { fileName, fileType, fileSize, fileData (base64 or data-URI) }
// Only kept when both fileName and fileData are present.
const _normalizeFile = (f) => {
  if (!f || typeof f !== 'object' || !f.fileName || !f.fileData) return null;
  const ext = String(f.fileType || String(f.fileName).split('.').pop() || '')
    .toLowerCase().replace(/^\./, '');
  return {
    fileName: String(f.fileName).slice(0, 250),
    fileType: ext,
    fileSize: Math.max(0, Number(f.fileSize) || 0),
    fileData: String(f.fileData)
  };
};

// Coerce whatever the client sends for studentNames into a normalized
// [{ name, phone, nationalId }] shape. Accepts either plain strings
// (legacy shape) or objects; drops entries with no usable name.
const _normalizeStudents = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.map(s => {
    if (typeof s === 'string') {
      const name = s.trim();
      return name ? { name, phone: '', nationalId: '' } : null;
    }
    const name = String(s?.name || '').trim();
    if (!name) return null;
    return {
      name,
      phone: String(s?.phone || '').trim(),
      nationalId: String(s?.nationalId || '').trim()
    };
  }).filter(Boolean);
};

// Strip base64 payloads for list/get JSON responses so payloads stay
// small. Callers use the download endpoint to fetch actual bytes.
const _stripFileData = (row) => {
  if (!row) return row;
  const j = row.toJSON ? row.toJSON() : row;
  const shrink = (f) => f ? { fileName: f.fileName, fileType: f.fileType, fileSize: f.fileSize } : null;
  j.reportAr   = shrink(j.reportAr);
  j.reportEn   = shrink(j.reportEn);
  j.patentFile = shrink(j.patentFile);
  j.images             = Array.isArray(j.images)             ? j.images.map(shrink) : [];
  j.registrationFiles  = Array.isArray(j.registrationFiles)  ? j.registrationFiles.map(shrink) : [];
  j.chatScreenshots    = Array.isArray(j.chatScreenshots)    ? j.chatScreenshots.map(shrink) : [];
  j.googleFormResults  = Array.isArray(j.googleFormResults)  ? j.googleFormResults.map(shrink) : [];
  j.invoices   = Array.isArray(j.invoices) ? j.invoices.map(inv => ({
    fileName: inv.fileName,
    fileType: inv.fileType,
    fileSize: inv.fileSize,
    reason: inv.reason,
    amount: inv.amount,
    invoiceDate: inv.invoiceDate
  })) : [];
  return j;
};

// -------------------- CRUD --------------------

exports.list = async (req, res) => {
  try {
    const rows = await InstitutionProject.findAll({
      where: { isActive: true },
      order: [['createdAt', 'DESC']],
      attributes: { exclude: ['reportAr', 'reportEn', 'patentFile', 'images', 'invoices', 'registrationFiles', 'chatScreenshots', 'googleFormResults'] }
    });
    // Also include lightweight counts so the list can show "N images"
    // and "N invoices" without downloading the payloads.
    const withCounts = await Promise.all(rows.map(async r => {
      const full = await InstitutionProject.findByPk(r.projectId, {
        attributes: ['images', 'invoices', 'reportAr', 'reportEn', 'patentFile', 'registrationFiles', 'chatScreenshots', 'googleFormResults']
      });
      return {
        ...r.toJSON(),
        imageCount: Array.isArray(full?.images) ? full.images.length : 0,
        invoiceCount: Array.isArray(full?.invoices) ? full.invoices.length : 0,
        registrationFileCount: Array.isArray(full?.registrationFiles) ? full.registrationFiles.length : 0,
        chatScreenshotCount: Array.isArray(full?.chatScreenshots) ? full.chatScreenshots.length : 0,
        googleFormResultCount: Array.isArray(full?.googleFormResults) ? full.googleFormResults.length : 0,
        hasReportAr: !!full?.reportAr,
        hasReportEn: !!full?.reportEn,
        hasPatentFile: !!full?.patentFile
      };
    }));
    res.json(withCounts);
  } catch (err) {
    console.error('institution list:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.get = async (req, res) => {
  try {
    const r = await InstitutionProject.findByPk(req.params.id);
    if (!r) return res.status(404).json({ message: 'Not found' });
    res.json(_stripFileData(r));
  } catch (err) {
    console.error('institution get:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const {
      projectName, supervisorName, studentNames, evaluation,
      startDate, approvedBy, notes,
      reportAr, reportEn, patentFile,
      images, invoices
    } = req.body || {};

    if (!projectName || !String(projectName).trim()) {
      return res.status(400).json({
        message: 'projectName is required',
        messageAr: 'اسم المشروع مطلوب'
      });
    }

    const projectNumber = await _assignNextNumber();
    const cleanImages = Array.isArray(images) ? images.map(_normalizeFile).filter(Boolean).slice(0, MAX_IMAGES) : [];
    const cleanInvoices = Array.isArray(invoices) ? invoices.map(inv => {
      const f = _normalizeFile(inv);
      if (!f) return null;
      return {
        ...f,
        reason: inv.reason ? String(inv.reason).trim() : null,
        amount: inv.amount != null && inv.amount !== '' ? Number(inv.amount) : null,
        invoiceDate: inv.invoiceDate || null
      };
    }).filter(Boolean) : [];

    const row = await InstitutionProject.create({
      projectNumber,
      projectName: String(projectName).trim(),
      supervisorName: supervisorName ? String(supervisorName).trim() : null,
      studentNames: _normalizeStudents(studentNames),
      evaluation: evaluation ? String(evaluation).trim() : null,
      startDate: startDate || null,
      approvedBy: approvedBy ? String(approvedBy).trim() : null,
      notes: notes ? String(notes).trim() : null,
      reportAr: _normalizeFile(reportAr),
      reportEn: _normalizeFile(reportEn),
      patentFile: _normalizeFile(patentFile),
      images: cleanImages,
      invoices: cleanInvoices,
      createdById: req.admin?.adminId || null
    });

    res.status(201).json(_stripFileData(row));
  } catch (err) {
    console.error('institution create:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

// Update meta fields only. Files/images/invoices use their own
// dedicated endpoints so the client can add/remove one at a time
// without re-transmitting every base64 payload.
exports.update = async (req, res) => {
  try {
    const row = await InstitutionProject.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });

    const patch = {};
    const metaFields = ['projectName', 'supervisorName', 'evaluation', 'startDate', 'approvedBy', 'notes'];
    for (const f of metaFields) {
      if (req.body[f] !== undefined) patch[f] = req.body[f];
    }
    if (Array.isArray(req.body.studentNames)) {
      patch.studentNames = _normalizeStudents(req.body.studentNames);
    }
    if (patch.projectName != null) {
      const trimmed = String(patch.projectName).trim();
      if (!trimmed) return res.status(400).json({ message: 'projectName cannot be empty' });
      patch.projectName = trimmed;
    }

    await row.update(patch);
    res.json(_stripFileData(row));
  } catch (err) {
    console.error('institution update:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.remove = async (req, res) => {
  try {
    const row = await InstitutionProject.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    await row.update({ isActive: false });
    res.json({ message: 'Removed' });
  } catch (err) {
    console.error('institution remove:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// -------------------- REPORTS (ar / en / patent) --------------------

const REPORT_FIELD = { ar: 'reportAr', en: 'reportEn', patent: 'patentFile' };

exports.setReport = async (req, res) => {
  try {
    const field = REPORT_FIELD[req.params.kind];
    if (!field) return res.status(400).json({ message: 'Invalid report kind' });
    const row = await InstitutionProject.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    const file = _normalizeFile(req.body?.file || req.body);
    if (!file) return res.status(400).json({ message: 'file is required' });
    await row.update({ [field]: file });
    res.json(_stripFileData(row));
  } catch (err) {
    console.error('institution setReport:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.clearReport = async (req, res) => {
  try {
    const field = REPORT_FIELD[req.params.kind];
    if (!field) return res.status(400).json({ message: 'Invalid report kind' });
    const row = await InstitutionProject.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    await row.update({ [field]: null });
    res.json(_stripFileData(row));
  } catch (err) {
    console.error('institution clearReport:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// -------------------- IMAGES --------------------

exports.addImages = async (req, res) => {
  try {
    const row = await InstitutionProject.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    const incoming = Array.isArray(req.body?.images) ? req.body.images : [];
    const clean = incoming.map(_normalizeFile).filter(Boolean);
    const current = Array.isArray(row.images) ? row.images : [];
    const remaining = MAX_IMAGES - current.length;
    if (remaining <= 0) {
      return res.status(400).json({
        message: `Image cap reached (${MAX_IMAGES})`,
        messageAr: `تم بلوغ الحد الأقصى (${MAX_IMAGES} صورة)`
      });
    }
    const next = [...current, ...clean.slice(0, remaining)];
    await row.update({ images: next });
    res.json(_stripFileData(row));
  } catch (err) {
    console.error('institution addImages:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.removeImage = async (req, res) => {
  try {
    const row = await InstitutionProject.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    const idx = parseInt(req.params.index, 10);
    if (!Number.isFinite(idx)) return res.status(400).json({ message: 'Invalid index' });
    const current = Array.isArray(row.images) ? row.images : [];
    const next = current.filter((_, i) => i !== idx);
    await row.update({ images: next });
    res.json(_stripFileData(row));
  } catch (err) {
    console.error('institution removeImage:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// -------------------- INVOICES --------------------

exports.addInvoice = async (req, res) => {
  try {
    const row = await InstitutionProject.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    const body = req.body || {};
    const file = _normalizeFile(body.file || body);
    if (!file) return res.status(400).json({ message: 'file is required' });
    const invoice = {
      ...file,
      reason: body.reason ? String(body.reason).trim() : null,
      amount: body.amount != null && body.amount !== '' ? Number(body.amount) : null,
      invoiceDate: body.invoiceDate || null
    };
    const current = Array.isArray(row.invoices) ? row.invoices : [];
    await row.update({ invoices: [...current, invoice] });
    res.json(_stripFileData(row));
  } catch (err) {
    console.error('institution addInvoice:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateInvoice = async (req, res) => {
  try {
    const row = await InstitutionProject.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    const idx = parseInt(req.params.index, 10);
    const current = Array.isArray(row.invoices) ? [...row.invoices] : [];
    if (!Number.isFinite(idx) || idx < 0 || idx >= current.length) {
      return res.status(400).json({ message: 'Invalid index' });
    }
    const body = req.body || {};
    const patch = { ...current[idx] };
    if (body.reason !== undefined) patch.reason = body.reason ? String(body.reason).trim() : null;
    if (body.amount !== undefined) patch.amount = body.amount != null && body.amount !== '' ? Number(body.amount) : null;
    if (body.invoiceDate !== undefined) patch.invoiceDate = body.invoiceDate || null;
    // Optional file replacement.
    if (body.file) {
      const f = _normalizeFile(body.file);
      if (f) Object.assign(patch, f);
    }
    current[idx] = patch;
    await row.update({ invoices: current });
    res.json(_stripFileData(row));
  } catch (err) {
    console.error('institution updateInvoice:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.removeInvoice = async (req, res) => {
  try {
    const row = await InstitutionProject.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    const idx = parseInt(req.params.index, 10);
    if (!Number.isFinite(idx)) return res.status(400).json({ message: 'Invalid index' });
    const current = Array.isArray(row.invoices) ? row.invoices : [];
    const next = current.filter((_, i) => i !== idx);
    await row.update({ invoices: next });
    res.json(_stripFileData(row));
  } catch (err) {
    console.error('institution removeInvoice:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// -------------------- REGISTRATION FILES --------------------

exports.addRegistrationFiles = async (req, res) => {
  try {
    const row = await InstitutionProject.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    const incoming = Array.isArray(req.body?.files) ? req.body.files : [];
    const clean = incoming.map(_normalizeFile).filter(Boolean);
    const current = Array.isArray(row.registrationFiles) ? row.registrationFiles : [];
    await row.update({ registrationFiles: [...current, ...clean] });
    res.json(_stripFileData(row));
  } catch (err) {
    console.error('institution addRegistrationFiles:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.removeRegistrationFile = async (req, res) => {
  try {
    const row = await InstitutionProject.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    const idx = parseInt(req.params.index, 10);
    if (!Number.isFinite(idx)) return res.status(400).json({ message: 'Invalid index' });
    const current = Array.isArray(row.registrationFiles) ? row.registrationFiles : [];
    await row.update({ registrationFiles: current.filter((_, i) => i !== idx) });
    res.json(_stripFileData(row));
  } catch (err) {
    console.error('institution removeRegistrationFile:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// -------------------- CHAT SCREENSHOTS --------------------

exports.addChatScreenshots = async (req, res) => {
  try {
    const row = await InstitutionProject.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    const incoming = Array.isArray(req.body?.files) ? req.body.files : [];
    const clean = incoming.map(_normalizeFile).filter(Boolean);
    const current = Array.isArray(row.chatScreenshots) ? row.chatScreenshots : [];
    await row.update({ chatScreenshots: [...current, ...clean] });
    res.json(_stripFileData(row));
  } catch (err) {
    console.error('institution addChatScreenshots:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.removeChatScreenshot = async (req, res) => {
  try {
    const row = await InstitutionProject.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    const idx = parseInt(req.params.index, 10);
    if (!Number.isFinite(idx)) return res.status(400).json({ message: 'Invalid index' });
    const current = Array.isArray(row.chatScreenshots) ? row.chatScreenshots : [];
    await row.update({ chatScreenshots: current.filter((_, i) => i !== idx) });
    res.json(_stripFileData(row));
  } catch (err) {
    console.error('institution removeChatScreenshot:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// -------------------- GOOGLE FORM RESULTS --------------------

exports.addGoogleFormResults = async (req, res) => {
  try {
    const row = await InstitutionProject.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    const incoming = Array.isArray(req.body?.files) ? req.body.files : [];
    const clean = incoming.map(_normalizeFile).filter(Boolean);
    const current = Array.isArray(row.googleFormResults) ? row.googleFormResults : [];
    await row.update({ googleFormResults: [...current, ...clean] });
    res.json(_stripFileData(row));
  } catch (err) {
    console.error('institution addGoogleFormResults:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.removeGoogleFormResult = async (req, res) => {
  try {
    const row = await InstitutionProject.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    const idx = parseInt(req.params.index, 10);
    if (!Number.isFinite(idx)) return res.status(400).json({ message: 'Invalid index' });
    const current = Array.isArray(row.googleFormResults) ? row.googleFormResults : [];
    await row.update({ googleFormResults: current.filter((_, i) => i !== idx) });
    res.json(_stripFileData(row));
  } catch (err) {
    console.error('institution removeGoogleFormResult:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// -------------------- DOWNLOAD --------------------

// GET /:id/download/:kind[/:index]
// kind = report-ar | report-en | patent | image | invoice
// index required for image / invoice.
exports.download = async (req, res) => {
  try {
    const row = await InstitutionProject.findByPk(req.params.id);
    if (!row) return res.status(404).send('Not found');
    const kind = String(req.params.kind || '').toLowerCase();
    let file = null;
    if (kind === 'report-ar')  file = row.reportAr;
    else if (kind === 'report-en')  file = row.reportEn;
    else if (kind === 'patent')     file = row.patentFile;
    else if (kind === 'image') {
      const idx = parseInt(req.params.index, 10);
      const arr = Array.isArray(row.images) ? row.images : [];
      file = Number.isFinite(idx) ? arr[idx] : null;
    } else if (kind === 'invoice') {
      const idx = parseInt(req.params.index, 10);
      const arr = Array.isArray(row.invoices) ? row.invoices : [];
      file = Number.isFinite(idx) ? arr[idx] : null;
    } else if (kind === 'registration') {
      const idx = parseInt(req.params.index, 10);
      const arr = Array.isArray(row.registrationFiles) ? row.registrationFiles : [];
      file = Number.isFinite(idx) ? arr[idx] : null;
    } else if (kind === 'chat') {
      const idx = parseInt(req.params.index, 10);
      const arr = Array.isArray(row.chatScreenshots) ? row.chatScreenshots : [];
      file = Number.isFinite(idx) ? arr[idx] : null;
    } else if (kind === 'googleform') {
      const idx = parseInt(req.params.index, 10);
      const arr = Array.isArray(row.googleFormResults) ? row.googleFormResults : [];
      file = Number.isFinite(idx) ? arr[idx] : null;
    } else {
      return res.status(400).send('Invalid kind');
    }
    if (!file || !file.fileData) return res.status(404).send('File not found');

    const raw = String(file.fileData);
    const b64 = raw.includes(',') ? raw.split(',').pop() : raw;
    const buf = Buffer.from(b64, 'base64');
    const safeName = String(file.fileName || 'file').replace(/[^A-Za-z0-9._-]/g, '_');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('Content-Length', buf.length);
    res.send(buf);
  } catch (err) {
    console.error('institution download:', err);
    res.status(500).send('Server error');
  }
};

// -------------------- PRINT (single full HTML report) --------------------

// Build the full project HTML report as a self-contained string.
// When `opts.skipPdfEmbeds` is true, PDF files render as a lightweight
// caption card instead of an <embed> — used by the merge-PDF flow so
// the actual PDF pages can be appended via pdf-lib afterward. When
// `opts.forPrint` is true, includes an in-page toolbar with a print
// button (used by the browser preview path only).
const _buildProjectHtml = (p, opts = {}) => {
  const { skipPdfEmbeds = false, forPrint = false } = opts;
  const projectNo = fmtProjectNumber(p.projectNumber);
  const invoiceDate = new Date(p.createdAt).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', {
    calendar: 'gregory', year: 'numeric', month: 'long', day: 'numeric'
  });

  // Render a single file (report, patent, registration doc, or
  // screenshot) as an inline block that shows the actual content:
  //   - Images → <img> with the data URI
  //   - PDFs   → <embed> sized to A4 so the pages render inline
  //              (or a lightweight caption card when skipPdfEmbeds
  //               is true — the merge flow appends real PDF pages)
  //   - Other  → a labeled placeholder card (docx, xlsx, etc.)
  const IMG_EXTS = new Set(['jpg','jpeg','png','gif','webp','bmp','svg','avif','heic','heif']);
  const renderEmbeddedFile = (file, label) => {
    if (!file || !file.fileData) return '';
    const ext = String(file.fileType || '').toLowerCase().replace(/^\./, '');
    const raw = String(file.fileData);
    const isPdf = ext === 'pdf';
    const isImg = IMG_EXTS.has(ext);
    const mime = isPdf ? 'application/pdf'
      : isImg ? `image/${ext === 'jpg' ? 'jpeg' : ext}`
      : 'application/octet-stream';
    const src = raw.startsWith('data:') ? raw : `data:${mime};base64,${raw}`;

    const captionHtml = `<div class="file-caption">
      ${label ? `<b>${esc(label)}</b>` : ''}
      <span class="file-name">${esc(file.fileName || '')}</span>
      <span class="ext">.${esc(ext)}</span>
    </div>`;

    if (isImg) {
      return `<div class="embedded-file embedded-image">
        ${captionHtml}
        <img src="${src}" alt="${esc(label || file.fileName || '')}" />
      </div>`;
    }
    if (isPdf) {
      if (skipPdfEmbeds) {
        // Merge flow — just show a caption card. The actual PDF
        // pages get appended after the cover PDF via pdf-lib.
        return `<div class="embedded-file embedded-pdf-marker">
          ${captionHtml}
          <div class="file-note">📎 محتوى الملف يُلحق كصفحات مستقلة داخل نفس التقرير.</div>
        </div>`;
      }
      // Browser preview — inline <embed>. When saved-as-PDF from
      // the browser, only the first page will render; the merge
      // endpoint (/pdf) is the way to get a fully-flattened PDF.
      return `<div class="embedded-file embedded-pdf">
        ${captionHtml}
        <embed src="${src}" type="application/pdf" />
        <div class="file-note">📄 عرض للملف — إذا كان الملف يحتوي على صفحات متعددة، استخدم زر "تحميل PDF كامل" لتصدير كل الملفات مدمجة.</div>
      </div>`;
    }
    // Unsupported inline format — show a labeled placeholder card.
    return `<div class="embedded-file embedded-other">
      ${captionHtml}
      <div class="file-placeholder">
        <div class="ph-icon">📎</div>
        <div>
          <b>${esc(file.fileName || '')}</b>
          <div>لا يمكن عرض هذا النوع من الملفات داخل التقرير (${esc(ext).toUpperCase()}). يرجى تحميل الملف من النظام لعرضه.</div>
        </div>
      </div>
    </div>`;
  };

  // Images (project image gallery) — always inlined as data URIs.
  const imageEls = (Array.isArray(p.images) ? p.images : []).map((img, i) => {
    if (!img?.fileData) return '';
    const raw = String(img.fileData);
    const src = raw.startsWith('data:')
      ? raw
      : `data:image/${(img.fileType || 'jpeg').toLowerCase()};base64,${raw}`;
    return `<figure class="img-cell">
      <img src="${esc(src)}" alt="${esc(img.fileName || `image-${i + 1}`)}" />
      <figcaption>#${i + 1} · ${esc(img.fileName || '')}</figcaption>
    </figure>`;
  }).join('');

  // Invoices table
  const invoiceRows = (Array.isArray(p.invoices) ? p.invoices : []).map((inv, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td>${esc(inv.reason || '—')}</td>
      <td class="c mono">${esc(inv.invoiceDate || '—')}</td>
      <td class="c mono">${inv.amount != null ? Number(inv.amount).toFixed(2) + ' ر.س' : '—'}</td>
      <td class="c">${esc(inv.fileName || '')} <span class="ext">.${esc(inv.fileType || '')}</span></td>
    </tr>`).join('');

    const embeddedReports = [
      p.reportAr   && renderEmbeddedFile(p.reportAr,   'التقرير (عربي)'),
      p.reportEn   && renderEmbeddedFile(p.reportEn,   'التقرير (إنجليزي)'),
      p.patentFile && renderEmbeddedFile(p.patentFile, 'ملف براءة الاختراع')
    ].filter(Boolean).join('');

    const embeddedRegistration = (Array.isArray(p.registrationFiles) ? p.registrationFiles : [])
      .map((f, i) => renderEmbeddedFile(f, `ملف تسجيل #${i + 1}`))
      .join('');

    const embeddedScreenshots = (Array.isArray(p.chatScreenshots) ? p.chatScreenshots : [])
      .map((f, i) => renderEmbeddedFile(f, `محادثة #${i + 1}`))
      .join('');

    const embeddedGoogleForms = (Array.isArray(p.googleFormResults) ? p.googleFormResults : [])
      .map((f, i) => renderEmbeddedFile(f, `نتيجة نموذج قوقل #${i + 1}`))
      .join('');

    // Invoice files: each invoice can carry a PDF or image — embed
    // the file content itself below the tabular summary.
    const embeddedInvoices = (Array.isArray(p.invoices) ? p.invoices : [])
      .map((inv, i) => {
        if (!inv?.fileData) return '';
        const reasonLabel = inv.reason || `فاتورة #${i + 1}`;
        const amountLabel = inv.amount != null
          ? ` — ${Number(inv.amount).toFixed(2)} ر.س`
          : '';
        const dateLabel = inv.invoiceDate ? ` — ${inv.invoiceDate}` : '';
        return renderEmbeddedFile(inv, `فاتورة: ${reasonLabel}${amountLabel}${dateLabel}`);
      })
      .join('');

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>${esc(projectNo)} — ${esc(p.projectName)}</title>
<style>
  :root { color-scheme: light; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Cairo','Segoe UI',Tahoma,Arial,sans-serif; background:#f4f6fb; color:#0f172a; padding:24px 12px; }
  .actions { max-width:920px; margin:0 auto 16px; display:flex; gap:10px; justify-content:end; flex-wrap:wrap; }
  .actions button { padding:12px 22px; border-radius:10px; border:none; background:linear-gradient(135deg,#EE2329,#c41e24); color:#fff; font-family:inherit; font-weight:800; font-size:14px; cursor:pointer; }
  .actions .ghost { background:#fff; color:#0f172a; border:1px solid #e5e7eb; }
  .doc { max-width:920px; margin:0 auto; background:#fff; border-radius:16px; box-shadow:0 20px 40px -20px rgba(15,23,42,0.12); padding:32px; }
  header { display:grid; grid-template-columns:1fr 1fr; gap:16px; align-items:end; padding-bottom:16px; margin-bottom:20px; border-bottom:3px solid #0f172a; }
  .brand { display:flex; gap:14px; align-items:center; }
  .brand img { height:56px; }
  .brand h1 { font-family:'Bricolage Grotesque','Cairo',sans-serif; font-size:20px; }
  .brand p { font-size:11px; color:#64748b; margin-top:2px; }
  .meta { text-align:end; }
  .meta .kicker { font-size:11px; color:#64748b; letter-spacing:1.4px; text-transform:uppercase; font-weight:700; }
  .meta h2 { font-family:'Bricolage Grotesque','Cairo',sans-serif; font-size:26px; margin:2px 0; }
  .meta .no { font-family:'JetBrains Mono',monospace; color:#EE2329; font-weight:800; letter-spacing:2px; font-size:15px; }
  .meta .date { font-size:11px; color:#64748b; margin-top:6px; }
  section.card { background:#f8fafc; border:1px solid #e5e7eb; border-radius:12px; padding:18px 20px; margin-bottom:16px; }
  section.card h3 { font-family:'Bricolage Grotesque','Cairo',sans-serif; font-size:15px; font-weight:800; color:#0f172a; margin-bottom:12px; display:flex; align-items:center; gap:8px; padding-bottom:8px; border-bottom:1px solid #e5e7eb; }
  section.card h3::before { content:''; display:inline-block; width:4px; height:16px; background:#EE2329; border-radius:2px; }
  .kv { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:10px 20px; font-size:13.5px; }
  .kv > div { display:flex; gap:6px; padding:6px 0; }
  .kv span { color:#64748b; min-width:100px; }
  .kv b { color:#0f172a; font-weight:700; }
  .prose { font-size:14px; line-height:1.8; color:#334155; white-space:pre-wrap; }
  .chips { display:flex; flex-wrap:wrap; gap:6px; }
  .chip { padding:5px 12px; background:#fff; border:1px solid #cbd5e1; border-radius:999px; font-size:12.5px; font-weight:600; color:#334155; }
  table.students-table { width:100%; border-collapse:collapse; font-size:12.5px; background:#fff; border-radius:8px; overflow:hidden; border:1px solid #e5e7eb; }
  table.students-table thead { background:#0f172a; color:#fff; }
  table.students-table thead th { padding:10px 12px; text-align:start; font-size:11px; text-transform:uppercase; letter-spacing:0.8px; font-weight:800; }
  table.students-table tbody td { padding:10px 12px; border-top:1px solid #f1f5f9; color:#334155; }
  table.students-table tbody tr:nth-child(even) td { background:#f9fafb; }
  table.students-table td.c { text-align:center; }
  table.students-table td.mono { font-family:'JetBrains Mono',monospace; }
  table.students-table td b { color:#0f172a; }
  ul.files { list-style:none; display:flex; flex-direction:column; gap:6px; font-size:13.5px; }
  ul.files li { padding:8px 12px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; }
  ul.files .ext { display:inline-block; padding:2px 8px; background:#0f172a; color:#fff; border-radius:5px; font-family:monospace; font-size:10.5px; font-weight:800; margin-inline-start:6px; }
  table { width:100%; border-collapse:collapse; font-size:13px; background:#fff; border-radius:8px; overflow:hidden; border:1px solid #e5e7eb; }
  table thead { background:#0f172a; color:#fff; }
  table th, table td { padding:10px 12px; text-align:start; }
  table th { font-size:11px; text-transform:uppercase; letter-spacing:0.8px; }
  table tbody tr:nth-child(even) { background:#f9fafb; }
  table td.c { text-align:center; }
  table td.mono { font-family:'JetBrains Mono',monospace; }
  table .ext { display:inline-block; padding:1px 6px; background:#e5e7eb; color:#334155; border-radius:4px; font-family:monospace; font-size:10.5px; font-weight:700; margin-inline-start:4px; }
  .images { display:grid; grid-template-columns:repeat(2, 1fr); gap:12px; }
  .img-cell { background:#fff; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; page-break-inside:avoid; }
  .img-cell img { width:100%; height:220px; object-fit:cover; display:block; }
  .img-cell figcaption { padding:6px 10px; font-size:11px; color:#64748b; background:#f8fafc; border-top:1px solid #e5e7eb; }
  /* Embedded reports / registration / screenshots */
  .embedded-file { margin-bottom:16px; background:#fff; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; page-break-inside:avoid; }
  .embedded-file:last-child { margin-bottom:0; }
  .file-caption { display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:10px 14px; background:#f8fafc; border-bottom:1px solid #e5e7eb; font-size:12px; }
  .file-caption b { color:#0f172a; font-size:13px; }
  .file-caption .file-name { color:#64748b; overflow:hidden; text-overflow:ellipsis; max-width:100%; }
  .file-caption .ext { display:inline-block; padding:2px 8px; background:#0f172a; color:#fff; border-radius:5px; font-family:monospace; font-size:10.5px; font-weight:800; letter-spacing:0.4px; }
  .embedded-image img { display:block; width:100%; max-height:900px; object-fit:contain; background:#fff; }
  .embedded-pdf embed { display:block; width:100%; height:900px; background:#fff; border:none; }
  .file-note { padding:8px 14px; font-size:10.5px; color:#78350f; background:#fffbeb; border-top:1px solid #fde68a; }
  .embedded-other .file-placeholder { display:flex; gap:14px; align-items:center; padding:20px 22px; }
  .embedded-other .file-placeholder .ph-icon { font-size:36px; }
  .embedded-other .file-placeholder b { display:block; color:#0f172a; font-size:14px; margin-bottom:4px; }
  .embedded-other .file-placeholder div div { font-size:12px; color:#64748b; line-height:1.6; }
  footer { margin-top:20px; padding-top:12px; border-top:1px solid #e5e7eb; display:flex; justify-content:space-between; font-size:10.5px; color:#94a3b8; }
  @media print {
    body { background:#fff; padding:0; }
    .actions { display:none; }
    .doc { box-shadow:none; border-radius:0; padding:14mm 12mm; max-width:none; }
    section.card { page-break-inside:avoid; }
    .img-cell { page-break-inside:avoid; }
    @page { size:A4; margin:0; }
  }
</style></head><body>
${forPrint ? `<div class="actions">
  <button onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
  <button class="ghost" onclick="window.close()">إغلاق</button>
</div>` : ''}
<div class="doc">
  <header>
    <div class="brand">
      <img src="/found.png" alt="مؤسسة" onerror="this.style.display='none'"/>
      <img src="/fablab.png" alt="فاب لاب" onerror="this.style.display='none'"/>
      <div>
        <h1>فاب لاب الأحساء</h1>
        <p>مؤسسة عبدالمنعم الراشد الإنسانية</p>
      </div>
    </div>
    <div class="meta">
      <div class="kicker">تقرير دعم مؤسسة</div>
      <h2>${esc(p.projectName)}</h2>
      <div class="no">${esc(projectNo)}</div>
      <div class="date">تاريخ الإصدار: ${esc(invoiceDate)}</div>
    </div>
  </header>

  <section class="card">
    <h3>معلومات المشروع</h3>
    <div class="kv">
      <div><span>اسم المشروع:</span><b>${esc(p.projectName)}</b></div>
      <div><span>المشرف:</span><b>${esc(p.supervisorName || '—')}</b></div>
      <div><span>تاريخ البداية:</span><b>${esc(p.startDate || '—')}</b></div>
      <div><span>معتمد من:</span><b>${esc(p.approvedBy || '—')}</b></div>
    </div>
    ${Array.isArray(p.studentNames) && p.studentNames.length > 0 ? `
      <div style="margin-top:14px">
        <div style="font-size:11px;color:#64748b;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:8px">الطالبات (${p.studentNames.length})</div>
        <table class="students-table">
          <thead>
            <tr>
              <th style="width:36px">#</th>
              <th>الاسم</th>
              <th>الجوال</th>
              <th>رقم الهوية</th>
            </tr>
          </thead>
          <tbody>
            ${p.studentNames.map((s, i) => {
              const name = typeof s === 'string' ? s : (s?.name || '');
              const phone = typeof s === 'object' ? (s?.phone || '') : '';
              const nid = typeof s === 'object' ? (s?.nationalId || '') : '';
              return `<tr>
                <td class="c">${i + 1}</td>
                <td><b>${esc(name)}</b></td>
                <td class="mono" dir="ltr">${esc(phone || '—')}</td>
                <td class="mono" dir="ltr">${esc(nid || '—')}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>` : ''}
  </section>

  ${p.evaluation ? `
  <section class="card">
    <h3>تقييم المشروع (نسبة / كمية الدعم)</h3>
    <div class="prose">${esc(p.evaluation)}</div>
  </section>` : ''}

  ${p.notes ? `
  <section class="card">
    <h3>ملاحظات</h3>
    <div class="prose">${esc(p.notes)}</div>
  </section>` : ''}

  ${embeddedReports ? `
  <section class="card">
    <h3>التقارير والمستندات</h3>
    ${embeddedReports}
  </section>` : ''}

  ${embeddedRegistration ? `
  <section class="card">
    <h3>ملفات التسجيل في فاب لاب (${(p.registrationFiles || []).length})</h3>
    ${embeddedRegistration}
  </section>` : ''}

  ${invoiceRows ? `
  <section class="card">
    <h3>الفواتير والمصروفات</h3>
    <table>
      <thead>
        <tr>
          <th class="c" style="width:36px">#</th>
          <th>السبب</th>
          <th class="c" style="width:110px">التاريخ</th>
          <th class="c" style="width:110px">المبلغ</th>
          <th class="c">الملف</th>
        </tr>
      </thead>
      <tbody>${invoiceRows}</tbody>
    </table>
    ${embeddedInvoices ? `<div style="margin-top:14px">${embeddedInvoices}</div>` : ''}
  </section>` : ''}

  ${imageEls ? `
  <section class="card">
    <h3>صور المشروع (${(p.images || []).length})</h3>
    <div class="images">${imageEls}</div>
  </section>` : ''}

  ${embeddedScreenshots ? `
  <section class="card">
    <h3>لقطات المحادثات (${(p.chatScreenshots || []).length})</h3>
    ${embeddedScreenshots}
  </section>` : ''}

  ${embeddedGoogleForms ? `
  <section class="card">
    <h3>نتائج نماذج قوقل (${(p.googleFormResults || []).length})</h3>
    ${embeddedGoogleForms}
  </section>` : ''}

  <footer>
    <div><b>فاب لاب الأحساء</b> · مؤسسة عبدالمنعم الراشد الإنسانية</div>
    <div>fablabsahsa.com</div>
  </footer>
</div>
</body></html>`;
};

// GET /:id/print — HTML preview in the browser (Save-as-PDF still
// works, but for a fully-merged PDF including uploaded PDF files use
// GET /:id/pdf instead).
exports.printHtml = async (req, res) => {
  try {
    const row = await InstitutionProject.findByPk(req.params.id);
    if (!row) return res.status(404).send('Not found');
    const html = _buildProjectHtml(row.toJSON(), { skipPdfEmbeds: false, forPrint: true });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('institution printHtml:', err);
    res.status(500).send('Server error');
  }
};

// GET /:id/pdf — full merged PDF. Cover pages (meta, invoice table,
// images, screenshots) are rendered from HTML via puppeteer; every
// uploaded PDF file is then appended verbatim via pdf-lib so the
// downloaded file is a single self-contained PDF with all the real
// content — no more "only-first-page" limitation of <embed>.
exports.exportPdf = async (req, res) => {
  const t0 = Date.now();
  let stage = 'load-project';
  try {
    const row = await InstitutionProject.findByPk(req.params.id);
    if (!row) return res.status(404).send('Not found');
    const p = row.toJSON();
    console.log(`[institution/pdf] ${p.projectId} — starting export`);

    // 1) Build the cover HTML (with PDFs as marker cards). Log its
    //    size so we can spot memory-blowup scenarios in production.
    stage = 'build-html';
    const html = _buildProjectHtml(p, { skipPdfEmbeds: true, forPrint: false });
    console.log(`[institution/pdf] ${p.projectId} — HTML built (${(html.length / 1024).toFixed(1)} KB)`);

    // 2) Render the cover to PDF via puppeteer.
    stage = 'render-cover';
    const coverBytes = await generatePdfFromHtml(html, {
      landscape: false,
      timeout: 90000
    });
    console.log(`[institution/pdf] ${p.projectId} — cover PDF rendered (${(coverBytes.length / 1024).toFixed(1)} KB)`);

    // 3) Merge every uploaded PDF into it, in a stable order that
    //    matches the sections shown in the cover.
    stage = 'load-cover-into-pdf-lib';
    const merged = await PDFDocument.load(coverBytes);
    const pdfSources = [];
    const collect = (file) => {
      if (!file || !file.fileData) return;
      const ext = String(file.fileType || '').toLowerCase();
      if (ext !== 'pdf') return;
      const raw = String(file.fileData);
      const b64 = raw.includes(',') ? raw.split(',').pop() : raw;
      pdfSources.push({ label: file.fileName, buf: Buffer.from(b64, 'base64') });
    };
    collect(p.reportAr);
    collect(p.reportEn);
    collect(p.patentFile);
    (p.registrationFiles || []).forEach(collect);
    (p.invoices || []).forEach(collect);
    (p.chatScreenshots || []).forEach(collect);
    (p.googleFormResults || []).forEach(collect);
    console.log(`[institution/pdf] ${p.projectId} — merging ${pdfSources.length} uploaded PDF(s)`);

    stage = 'merge-pdfs';
    for (const src of pdfSources) {
      try {
        const doc = await PDFDocument.load(src.buf, { ignoreEncryption: true });
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach((pg) => merged.addPage(pg));
      } catch (mergeErr) {
        console.warn(`[institution/pdf] Skipped bad PDF "${src.label}":`, mergeErr.message);
        // Continue — one bad PDF shouldn't break the whole export.
      }
    }

    stage = 'save';
    const finalBytes = await merged.save();
    const projectNo = fmtProjectNumber(p.projectNumber);
    // ASCII-only filename to avoid Content-Disposition encoding issues.
    const safeName = `${projectNo}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('Content-Length', finalBytes.length);
    res.send(Buffer.from(finalBytes));
    console.log(`[institution/pdf] ${p.projectId} — done in ${Date.now() - t0}ms (${(finalBytes.length / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.error(`[institution/pdf] FAILED at stage=${stage} after ${Date.now() - t0}ms:`, err);
    res.status(500).json({
      message: 'PDF export failed',
      stage,
      detail: err && err.message ? err.message : String(err)
    });
  }
};
