// One-page executive summary generator for "دعم مؤسسة" projects.
//
// Reads every text-bearing file uploaded to the project (reports,
// invoices, registration paperwork, Google form results) and hands
// the extracted text + project metadata to Gemini, which returns an
// Arabic executive summary structured so the manager can decide
// without reading each file individually.
//
// Image / screenshot handling: the first N images are attached to
// the Gemini request as multimodal content so their contents can be
// described. Additional images fall back to a filename listing to
// keep prompt size (and API cost) bounded.

const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

// ─────────────── Config ───────────────
// Order matters — first model that succeeds wins. Kept a mix of
// current flash + pro variants so a decommissioned or gated model
// falls through to a working one automatically.
// Only names ACTUALLY exposed by the current v1beta model catalog
// (verified against ListModels output on the production key on
// 2026-09-12). Order: cheapest/latest first, upgrade if it fails.
// Override the whole list with GEMINI_MODEL env if you want to pin.
const MODEL_CANDIDATES = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : [
      'gemini-flash-latest',       // Google-maintained "latest flash" alias
      'gemini-2.5-flash',          // Explicit stable flash (June 2025)
      'gemini-2.5-flash-lite',     // Cheaper fallback
      'gemini-flash-lite-latest',
      'gemini-pro-latest',
      'gemini-2.5-pro'
    ];
const MAX_TEXT_CHARS_PER_FILE = 20_000;   // hard cap per file post-extraction
const MAX_TOTAL_TEXT_CHARS    = 120_000;  // guard against runaway prompts
const MAX_IMAGES_INLINE       = 6;        // vision inputs (rest are named-only)
const MAX_IMAGE_BYTES         = 4 * 1024 * 1024; // ~4 MB per image sent inline

// ─────────────── File-type helpers ───────────────
const _ext = (name) => (path.extname(String(name || '')).replace('.', '').toLowerCase());
const _kind = (file) => {
  const ext = _ext(file?.fileName) || String(file?.fileType || '').toLowerCase();
  if (['pdf'].includes(ext)) return 'pdf';
  if (['doc', 'docx'].includes(ext)) return 'docx';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'xlsx';
  if (['txt', 'md'].includes(ext)) return 'text';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'image';
  return 'other';
};
const _mime = (file) => {
  const ext = _ext(file?.fileName);
  const map = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    webp: 'image/webp', gif: 'image/gif'
  };
  return map[ext] || file?.fileType || 'application/octet-stream';
};

// ─────────────── Text extraction ───────────────
async function extractText(file) {
  if (!file?.fileData) return '';
  const buf = Buffer.from(String(file.fileData), 'base64');
  try {
    switch (_kind(file)) {
      case 'pdf': {
        // Handle both pdf-parse APIs:
        //  - v1.x: `require('pdf-parse')` is a function returning
        //          { text, numpages, … }.
        //  - v2.x: exports a `PDFParse` CLASS you instantiate with
        //          `{ data: buffer }` then call `.getText()`.
        const mod = require('pdf-parse');
        // v1 function form
        if (typeof mod === 'function') {
          const out = await mod(buf);
          return (out?.text || '').slice(0, MAX_TEXT_CHARS_PER_FILE);
        }
        // v2 class form
        if (typeof mod?.PDFParse === 'function') {
          const parser = new mod.PDFParse({ data: buf });
          const out = await parser.getText();
          return (out?.text || '').slice(0, MAX_TEXT_CHARS_PER_FILE);
        }
        // Legacy default / named function forms
        const fn = mod?.pdf || mod?.default || mod?.parse;
        if (typeof fn === 'function') {
          const out = await fn(buf);
          return (out?.text || '').slice(0, MAX_TEXT_CHARS_PER_FILE);
        }
        console.warn('institutionSummary: pdf-parse export shape unknown', Object.keys(mod || {}));
        return '';
      }
      case 'docx': {
        const mammoth = require('mammoth');
        const { value } = await mammoth.extractRawText({ buffer: buf });
        return (value || '').slice(0, MAX_TEXT_CHARS_PER_FILE);
      }
      case 'xlsx': {
        const XLSX = require('xlsx');
        const wb = XLSX.read(buf, { type: 'buffer' });
        const sheets = wb.SheetNames.map(name => {
          const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
          return `# ${name}\n${csv}`;
        });
        return sheets.join('\n\n').slice(0, MAX_TEXT_CHARS_PER_FILE);
      }
      case 'text':
        return buf.toString('utf8').slice(0, MAX_TEXT_CHARS_PER_FILE);
      default:
        return ''; // images and other binary types return via listing / vision
    }
  } catch (err) {
    console.warn(`institutionSummary: extract failed for ${file?.fileName}: ${err.message}`);
    return '';
  }
}

// ─────────────── Payload assembly ───────────────
async function assembleContext(row) {
  const groups = [
    { label: 'التقرير النهائي (عربي)', files: row.reportAr ? [row.reportAr] : [] },
    { label: 'التقرير النهائي (إنجليزي)', files: row.reportEn ? [row.reportEn] : [] },
    { label: 'براءة الاختراع', files: row.patentFile ? [row.patentFile] : [] },
    { label: 'الفواتير', files: Array.isArray(row.invoices) ? row.invoices : [] },
    { label: 'ملفات التسجيل', files: Array.isArray(row.registrationFiles) ? row.registrationFiles : [] },
    { label: 'نتائج نموذج التقييم', files: Array.isArray(row.googleFormResults) ? row.googleFormResults : [] }
  ];

  const textBlocks = [];
  let totalChars = 0;

  for (const g of groups) {
    for (const f of g.files) {
      if (!f) continue;
      if (totalChars >= MAX_TOTAL_TEXT_CHARS) break;
      const text = await extractText(f);
      if (text) {
        const chunk = text.slice(0, MAX_TOTAL_TEXT_CHARS - totalChars);
        textBlocks.push(`### ${g.label} — ${f.fileName || 'ملف'}\n${chunk}`);
        totalChars += chunk.length;
      } else {
        // Non-text file (e.g. an image invoice) — still note it exists.
        textBlocks.push(`### ${g.label} — ${f.fileName || 'ملف'} (نوع غير نصي)`);
      }
    }
  }

  // Image + screenshot inventory. First N images become inline vision
  // inputs; the rest get a filename-only listing to keep costs sane.
  const images = Array.isArray(row.images) ? row.images : [];
  const screenshots = Array.isArray(row.chatScreenshots) ? row.chatScreenshots : [];
  const allImages = [...images, ...screenshots].filter(f => _kind(f) === 'image');
  const inlineImages = [];
  const listedImages = [];
  for (const f of allImages) {
    if (inlineImages.length < MAX_IMAGES_INLINE
        && f?.fileData
        && Buffer.byteLength(f.fileData, 'base64') <= MAX_IMAGE_BYTES) {
      inlineImages.push({
        inlineData: {
          data: String(f.fileData),
          mimeType: _mime(f)
        }
      });
    } else {
      listedImages.push(f?.fileName || 'صورة');
    }
  }

  // Invoice amount totals (best-effort — invoice objects may carry
  // `amount` numeric or a string with currency).
  const invoiceLine = groups
    .find(g => g.label === 'الفواتير').files
    .map(f => f?.amount != null ? Number(f.amount) : null)
    .filter(n => Number.isFinite(n))
    .reduce((sum, n) => sum + n, 0);

  const meta = [
    `اسم المشروع: ${row.projectName || '—'}`,
    row.projectNumber != null ? `رقم المشروع: ISP-${String(row.projectNumber).padStart(4, '0')}` : null,
    row.supervisorName ? `المشرف: ${row.supervisorName}` : null,
    Array.isArray(row.studentNames) && row.studentNames.length ? `الطلاب: ${row.studentNames.join('، ')}` : null,
    row.startDate ? `تاريخ البدء: ${row.startDate}` : null,
    row.approvedBy ? `المعتمد: ${row.approvedBy}` : null,
    row.evaluation ? `تقييم داخلي: ${row.evaluation}` : null,
    row.notes ? `ملاحظات مسجلة: ${row.notes}` : null,
    invoiceLine > 0 ? `إجمالي مبالغ الفواتير المسجلة: ${invoiceLine.toLocaleString('ar-SA')} ريال` : null,
    `عدد الصور المرفقة: ${images.length}${screenshots.length ? ` + ${screenshots.length} لقطة محادثة` : ''}`
  ].filter(Boolean).join('\n');

  return {
    meta,
    textBlocks,
    inlineImages,
    listedImages,
    totalChars,
    inlineImageCount: inlineImages.length
  };
}

// ─────────────── Gemini call ───────────────
async function callGemini({ meta, textBlocks, inlineImages, listedImages }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set on the server. Add it to server .env and restart pm2.');
  }
  const client = new GoogleGenerativeAI(apiKey);

  const instruction = `أنت محرر تقارير تنفيذية لدى فاب لاب الأحساء. مهمتك: إعداد ملخص تنفيذي من صفحة واحدة عن مشروع مدعوم بحيث يستطيع المدير اتخاذ قرار دون الرجوع لكامل الملفات.

اكتب الملخص بالعربية الفصحى، بأسلوب مباشر ومنظم في الأقسام التالية بالضبط، مع استخدام عناوين ماركداون (##) قبل كل قسم:

## 1) نظرة عامة
جملة أو جملتان تصف فكرة المشروع وهدفه بوضوح.

## 2) الفريق والنطاق
الطلاب، المشرف، القسم المسؤول، والفترة الزمنية.

## 3) الملفات المرفقة والمخرجات
تلخيص محتوى التقارير والملفات (بما فيها الصور إن كانت متاحة) بشكل يوضح ما تم إنجازه.

## 4) الجانب المالي
إن ذُكرت مبالغ في الفواتير أو التقارير، لخّصها. إن لم تُذكر، قل ذلك بوضوح.

## 5) التقييم ونتائج التقييم النهائي
ما الذي تشير إليه نتائج نموذج التقييم؟ هل حقق المشروع أهدافه؟

## 6) المخاطر أو الملاحظات الحرجة
أي شيء يستدعي انتباه المدير (تأخير، مشكلات، ملاحظات المشرف، إلخ). إن لم يوجد، اذكر "لا توجد ملاحظات حرجة ظاهرة".

## 7) التوصية
جملة أو جملتان بتوصية واضحة (مثال: يُوصى بالاعتماد / يحتاج مزيد من المراجعة / …).

قيّد الطول الإجمالي بحيث يُطبع في صفحة A4 واحدة. لا تختلق أرقاماً أو معلومات لم ترد في المصادر. إذا كانت المعلومات ناقصة في قسم ما، اذكر ذلك بصراحة.`;

  const parts = [
    { text: instruction },
    { text: `\n---\n\n### بيانات المشروع (البيانات المُدخلة يدوياً)\n${meta}` },
    ...(textBlocks.length ? [{ text: `\n\n### محتوى الملفات المرفوعة\n\n${textBlocks.join('\n\n')}` }] : []),
    ...(listedImages.length ? [{ text: `\n\n### صور إضافية لم تُرسل للنموذج (بأسمائها فقط)\n- ${listedImages.slice(0, 40).join('\n- ')}${listedImages.length > 40 ? `\n… وعدد ${listedImages.length - 40} صورة أخرى` : ''}` }] : []),
    ...inlineImages
  ];

  // Try each model candidate; a 404 on one just means Google
  // renamed / deprecated it, so we fall through to the next.
  let lastErr = null;
  for (const modelName of MODEL_CANDIDATES) {
    try {
      const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: { temperature: 0.35, maxOutputTokens: 2048 }
      });
      const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
      const text = result?.response?.text?.() || '';
      if (!text.trim()) {
        throw new Error('empty response');
      }
      return { text: text.trim(), model: modelName };
    } catch (err) {
      lastErr = err;
      const msg = err?.message || String(err);
      // Only fall through on 404 / not-found / model errors — auth
      // and quota errors should surface immediately.
      if (!/not found|is not supported|404|does not exist/i.test(msg)) {
        throw err;
      }
      console.warn(`institutionSummary: model ${modelName} unavailable, trying next — ${msg.slice(0, 200)}`);
    }
  }
  throw new Error(`All Gemini model candidates failed. Last error: ${lastErr?.message || 'unknown'}`);
}

// ─────────────── Public API ───────────────
async function generateProjectSummary(row) {
  const ctx = await assembleContext(row);
  const { text, model } = await callGemini(ctx);
  return {
    summary: text,
    model,
    stats: {
      textChars: ctx.totalChars,
      inlineImages: ctx.inlineImageCount,
      listedImages: ctx.listedImages.length
    }
  };
}

// Diagnostic: hit Google's ListModels endpoint to see EXACTLY which
// model names this API key is allowed to call. Useful when the
// fallback list keeps 404ing.
async function listGeminiModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ListModels HTTP ${res.status}: ${body.slice(0, 400)}`);
  }
  const data = await res.json();
  return (data?.models || []).map(m => ({
    name: m.name,
    supported: m.supportedGenerationMethods || []
  }));
}

module.exports = { generateProjectSummary, listGeminiModels };
