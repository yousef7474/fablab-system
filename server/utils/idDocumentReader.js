// Reads the date of birth from a photo of a Saudi National ID card or
// Iqama (Gemini vision), converts Hijri → Gregorian (Umm al-Qura), and
// computes the exact age. Used by public workshop registration to
// verify age without trusting a typed number.
//
// The extraction result is handed back to the browser as a short-lived
// signed token bound to the photo's hash, so registration can verify
// the birth date server-side without calling Gemini a second time.

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Same candidates as utils/institutionSummary.js (verified catalog).
const MODEL_CANDIDATES = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-pro-latest', 'gemini-2.5-pro'];

const ALLOWED_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const TOKEN_TTL = '2h';

const PROMPT = `You read Saudi identity documents. The image should show the FRONT of a Saudi National ID card (بطاقة الهوية الوطنية) or a Resident Identity / Iqama (هوية مقيم / إقامة).

Return ONLY a JSON object with exactly these keys:
{
  "isIdDocument": boolean,
  "documentType": "national_id" | "iqama" | "other",
  "idNumber": string | null,
  "birthDate": { "calendar": "hijri" | "gregorian", "year": number, "month": number, "day": number } | null,
  "birthDateAlternate": { "calendar": "hijri" | "gregorian", "year": number, "month": number, "day": number } | null
}

Rules:
- birthDate is the HOLDER'S DATE OF BIRTH (تاريخ الميلاد / Date of Birth). Never use the issue date (تاريخ الإصدار) or the expiry date (تاريخ الانتهاء).
- Convert Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) to Western digits.
- If the card shows the birth date in both calendars, put the Gregorian one in birthDate and the Hijri one in birthDateAlternate.
- Hijri years are roughly 1300–1460; Gregorian years roughly 1900–2030.
- idNumber is the 10-digit ID / Iqama number (national IDs start with 1, Iqamas with 2), or null if unreadable.
- If you cannot read the date of birth with full confidence, set birthDate to null. Never guess.`;

// ---------- dates ----------
const pad = (n) => String(n).padStart(2, '0');
const isoOf = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

function riyadhTodayIso() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (t) => p.find(x => x.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function validGregorian(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// Umm al-Qura Hijri → Gregorian. Estimates the date, then searches
// nearby days for the one Intl formats back to the same Hijri date.
const _hijriFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric' });
function hijriToGregorianIso(hy, hm, hd) {
  if (!(hy >= 1300 && hy <= 1500 && hm >= 1 && hm <= 12 && hd >= 1 && hd <= 30)) return null;
  const days = (hy - 1) * 354.36707 + (hm - 1) * 29.530589 + (hd - 1);
  const guess = Date.UTC(622, 6, 19) + Math.round(days) * 86400000;
  for (let off = 0; off <= 60; off++) {
    for (const sign of off === 0 ? [1] : [1, -1]) {
      const dt = new Date(guess + sign * off * 86400000);
      const parts = _hijriFmt.formatToParts(dt);
      const v = (t) => Number((parts.find(x => x.type === t) || {}).value);
      if (v('year') === hy && v('month') === hm && v('day') === hd) {
        return isoOf(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
      }
    }
  }
  return null;
}

// Full years on `todayIso` for someone born on `birthIso` (both
// 'YYYY-MM-DD'): birthday not reached yet this year → one less.
function ageOn(birthIso, todayIso = riyadhTodayIso()) {
  const [by, bm, bd] = birthIso.split('-').map(Number);
  const [ty, tm, td] = todayIso.split('-').map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

// Turn the model's birthDate object(s) into { birthDate, birthDateHijri }.
function normalizeBirth(primary, alternate) {
  const asDate = (b) => {
    if (!b) return null;
    const y = Number(b.year), m = Number(b.month), d = Number(b.day);
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
    const hijri = b.calendar === 'hijri' || y < 1500;
    if (hijri) {
      const g = hijriToGregorianIso(y, m, d);
      return g ? { birthDate: g, birthDateHijri: isoOf(y, m, d) } : null;
    }
    return validGregorian(y, m, d) ? { birthDate: isoOf(y, m, d), birthDateHijri: null } : null;
  };
  const p = asDate(primary);
  const a = asDate(alternate);
  if (!p) return a;
  if (a && !p.birthDateHijri && a.birthDateHijri) p.birthDateHijri = a.birthDateHijri;
  return p;
}

// ---------- photo ----------
function sanitizeIdPhoto(input) {
  if (!input || typeof input !== 'object') return null;
  const type = String(input.fileType || '').toLowerCase().replace(/^\./, '');
  const data = input.fileData ? String(input.fileData).replace(/^data:[^;]+;base64,/, '') : '';
  if (!ALLOWED_TYPES[type] || !data) return null;
  if (data.length > MAX_PHOTO_BYTES * 1.4) return null;
  return {
    fileName: String(input.fileName || `id.${type}`).slice(0, 200),
    fileType: type,
    fileSize: Math.max(0, Number(input.fileSize) || 0),
    fileData: data
  };
}

const photoHash = (photo) => crypto.createHash('sha256').update(photo.fileData).digest('hex');

// ---------- Gemini ----------
function _parseJson(text) {
  const cleaned = String(text || '').replace(/```json|```/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
}

async function _askGemini(photo) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw Object.assign(new Error('GEMINI_API_KEY not set'), { code: 'NO_KEY' });
  const client = new GoogleGenerativeAI(apiKey);
  const parts = [
    { inlineData: { mimeType: ALLOWED_TYPES[photo.fileType], data: photo.fileData } },
    { text: PROMPT }
  ];
  let lastErr = null;
  for (const modelName of MODEL_CANDIDATES) {
    try {
      const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 512,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 }
        }
      });
      const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
      return _parseJson(result?.response?.text?.() || '');
    } catch (err) {
      lastErr = err;
      if (!/not found|is not supported|404|does not exist/i.test(err?.message || '')) throw err;
    }
  }
  throw lastErr || new Error('No Gemini model available');
}

// ---------- public API ----------

// Returns { ok: true, birthDate, birthDateHijri, age, idNumber, documentType, token }
// or { ok: false, reason: 'not_id' | 'unreadable' | 'invalid_photo' }.
async function readIdDocument(rawPhoto) {
  const photo = sanitizeIdPhoto(rawPhoto);
  if (!photo) return { ok: false, reason: 'invalid_photo' };

  const out = await _askGemini(photo);
  if (!out) return { ok: false, reason: 'unreadable' };
  if (out.isIdDocument === false || out.documentType === 'other') return { ok: false, reason: 'not_id' };

  const birth = normalizeBirth(out.birthDate, out.birthDateAlternate);
  if (!birth) return { ok: false, reason: 'unreadable' };

  const today = riyadhTodayIso();
  const age = ageOn(birth.birthDate, today);
  if (birth.birthDate > today || age < 1 || age > 110) return { ok: false, reason: 'unreadable' };

  const idNumber = /^[12]\d{9}$/.test(String(out.idNumber || '').trim()) ? String(out.idNumber).trim() : null;
  const token = jwt.sign(
    { bd: birth.birthDate, bdh: birth.birthDateHijri, ph: photoHash(photo), typ: 'id-age' },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
  return {
    ok: true,
    birthDate: birth.birthDate,
    birthDateHijri: birth.birthDateHijri,
    age,
    idNumber,
    documentType: out.documentType || null,
    token
  };
}

// Verifies a token from readIdDocument against the photo submitted
// with the registration. Returns { birthDate, birthDateHijri, age,
// photo } or throws { status, message, messageAr }.
function verifyIdToken(token, rawPhoto) {
  const fail = (message, messageAr) => { throw { status: 400, message, messageAr }; };
  const photo = sanitizeIdPhoto(rawPhoto);
  if (!token || !photo) {
    fail('A photo of your National ID / Iqama is required', 'يرجى رفع صورة الهوية الوطنية أو الإقامة');
  }
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    fail('ID check expired — please upload the ID photo again', 'انتهت صلاحية التحقق من الهوية — يرجى رفع صورة الهوية مرة أخرى');
  }
  if (payload.typ !== 'id-age' || !payload.bd || payload.ph !== photoHash(photo)) {
    fail('ID photo does not match the verified one — please upload it again', 'صورة الهوية لا تطابق الصورة التي تم التحقق منها — يرجى رفعها مرة أخرى');
  }
  return { birthDate: payload.bd, birthDateHijri: payload.bdh || null, age: ageOn(payload.bd), photo };
}

module.exports = { readIdDocument, verifyIdToken, sanitizeIdPhoto, hijriToGregorianIso, ageOn, riyadhTodayIso };
