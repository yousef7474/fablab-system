// Post-workshop survey. A student gets the certificate only after they
// attended enough days AND submitted this survey. DEFAULT_QUESTIONS is
// the starting set; admins edit the live list from the Workshops tab
// (Settings key `workshop_survey_questions`, see validateQuestions).
// Each response stores a snapshot of the questions it answered, so
// later edits never change what an old answer meant.
const crypto = require('crypto');

const SURVEY_VERSION = 2;
const SURVEY_SETTINGS_KEY = 'workshop_survey_questions';

const RATING_LABELS = {
  ar: ['غير راضٍ إطلاقاً', 'غير راضٍ', 'محايد', 'راضٍ', 'راضٍ جداً'],
  en: ['Very dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Very satisfied']
};

const DEFAULT_QUESTIONS = [
  { id: 'overall', type: 'rating', required: true,
    ar: 'ما مدى رضاك العام عن الورشة؟', en: 'Overall, how satisfied are you with the workshop?' },
  { id: 'presenter', type: 'rating', required: true,
    ar: 'وضوح شرح المدرب وأسلوبه في التقديم', en: "The trainer's explanations and delivery" },
  { id: 'content', type: 'rating', required: true,
    ar: 'مطابقة المحتوى لوصف الورشة وأهدافها', en: 'The content matched the description and objectives' },
  { id: 'practice', type: 'rating', required: true,
    ar: 'كفاية التطبيق العملي وتوفّر الأدوات والأجهزة', en: 'Hands-on practice, tools and equipment' },
  { id: 'organization', type: 'rating', required: true,
    ar: 'التنظيم والالتزام بالوقت', en: 'Organisation and timekeeping' },
  { id: 'venue', type: 'rating', required: true,
    ar: 'ملاءمة القاعة والبيئة التدريبية', en: 'The venue and learning environment' },
  { id: 'skillGain', type: 'choice', required: true,
    ar: 'إلى أي مدى تحسّنت مهاراتك في موضوع الورشة؟', en: 'How much did your skills in the topic improve?',
    options: [
      { v: 'a_lot', ar: 'تحسّنت كثيراً', en: 'A lot' },
      { v: 'moderate', ar: 'بشكل متوسط', en: 'Moderately' },
      { v: 'little', ar: 'قليلاً', en: 'A little' },
      { v: 'none', ar: 'لم تتحسّن', en: 'Not at all' }
    ] },
  { id: 'duration', type: 'choice', required: true,
    ar: 'مدة الورشة كانت:', en: 'The length of the workshop was:',
    options: [
      { v: 'short', ar: 'قصيرة', en: 'Too short' },
      { v: 'right', ar: 'مناسبة', en: 'About right' },
      { v: 'long', ar: 'طويلة', en: 'Too long' }
    ] },
  { id: 'recommend', type: 'choice', required: true,
    ar: 'هل تنصح غيرك بحضور هذه الورشة؟', en: 'Would you recommend this workshop to others?',
    options: [
      { v: 'yes', ar: 'نعم', en: 'Yes' },
      { v: 'maybe', ar: 'ربما', en: 'Maybe' },
      { v: 'no', ar: 'لا', en: 'No' }
    ] },
  { id: 'heardFrom', type: 'choice', required: false,
    ar: 'كيف عرفت عن الورشة؟', en: 'How did you hear about the workshop?',
    options: [
      { v: 'social', ar: 'وسائل التواصل الاجتماعي', en: 'Social media' },
      { v: 'friend', ar: 'صديق أو أحد الأقارب', en: 'A friend or relative' },
      { v: 'school', ar: 'المدرسة أو الجامعة', en: 'School or university' },
      { v: 'website', ar: 'موقع فاب لاب', en: 'FabLab website' },
      { v: 'other', ar: 'أخرى', en: 'Other' }
    ] },
  { id: 'liked', type: 'text', required: false,
    ar: 'ما أكثر ما أعجبك في الورشة؟', en: 'What did you like most?' },
  { id: 'improve', type: 'text', required: false,
    ar: 'ما اقتراحاتك لتحسين الورشة؟', en: 'What would you improve?' },
  { id: 'future', type: 'text', required: false,
    ar: 'ما الورش التي تودّ أن يقدّمها فاب لاب مستقبلاً؟', en: 'Which workshops would you like FabLab to offer next?' }
];

const MAX_TEXT = 1000;

// ---------- admin-edited question list ----------
const ID_RE = /^[A-Za-z0-9_]{1,40}$/;
const TYPES = ['rating', 'choice', 'text'];
const _t = (v, max = 300) => String(v == null ? '' : v).trim().slice(0, max);

// Returns { questions } (normalised) or { message, messageAr }.
const validateQuestions = (list) => {
  const fail = (message, messageAr) => ({ message, messageAr });
  if (!Array.isArray(list) || list.length === 0) return fail('Add at least one question', 'أضف سؤالاً واحداً على الأقل');
  if (list.length > 40) return fail('The survey can have up to 40 questions', 'الحد الأقصى 40 سؤالاً');
  const ids = new Set();
  const questions = [];
  for (let i = 0; i < list.length; i++) {
    const q = list[i] || {};
    const n = i + 1;
    const id = _t(q.id, 40);
    if (!ID_RE.test(id) || ids.has(id)) return fail(`Question ${n}: invalid or duplicate id`, `السؤال ${n}: معرّف غير صالح أو مكرر`);
    ids.add(id);
    if (!TYPES.includes(q.type)) return fail(`Question ${n}: unknown type`, `السؤال ${n}: نوع غير معروف`);
    const ar = _t(q.ar);
    const en = _t(q.en);
    if (!ar && !en) return fail(`Question ${n}: enter the question text`, `السؤال ${n}: اكتب نص السؤال`);
    const item = { id, type: q.type, required: !!q.required, ar: ar || en, en: en || ar };
    if (q.type === 'choice') {
      const values = new Set();
      const options = [];
      for (const o of (Array.isArray(q.options) ? q.options : [])) {
        const oar = _t(o && o.ar, 120);
        const oen = _t(o && o.en, 120);
        if (!oar && !oen) continue;
        let v = _t(o && o.v, 40);
        if (!ID_RE.test(v) || values.has(v)) {
          let k = options.length + 1;
          while (values.has(`o${k}`)) k++;
          v = `o${k}`;
        }
        values.add(v);
        options.push({ v, ar: oar || oen, en: oen || oar });
      }
      if (options.length < 2) return fail(`Question ${n}: a choice question needs at least 2 options`, `السؤال ${n}: سؤال الاختيار يحتاج خيارين على الأقل`);
      if (options.length > 12) return fail(`Question ${n}: up to 12 options`, `السؤال ${n}: الحد الأقصى 12 خياراً`);
      item.options = options;
    }
    questions.push(item);
  }
  return { questions };
};

// Live question list: the admin's saved version, or the defaults.
const loadQuestions = async (Settings) => {
  const row = await Settings.findByPk(SURVEY_SETTINGS_KEY);
  const v = validateQuestions(row && row.value);
  return v.questions || DEFAULT_QUESTIONS;
};

// Keeps only known answers in the expected shape; reports required ones
// that are missing.
const cleanAnswers = (raw, questions = DEFAULT_QUESTIONS) => {
  const answers = {};
  const missing = [];
  for (const q of questions) {
    const v = raw ? raw[q.id] : undefined;
    if (q.type === 'rating') {
      const n = Number(v);
      if (Number.isInteger(n) && n >= 1 && n <= 5) answers[q.id] = n;
    } else if (q.type === 'choice') {
      if (q.options.some(o => o.v === v)) answers[q.id] = v;
    } else {
      const t = String(v == null ? '' : v).trim().slice(0, MAX_TEXT);
      if (t) answers[q.id] = t;
    }
    if (q.required && answers[q.id] === undefined) missing.push(q.id);
  }
  return { answers, missing };
};

// Survey links are `<studentId>.<hmac>`: stable per student, nothing to
// store, and not guessable from the studentId (which is printed on the
// attendance card's QR).
const _sig = (studentId) =>
  crypto.createHmac('sha256', String(process.env.JWT_SECRET || ''))
    .update(`ws-survey:${studentId}`)
    .digest('base64url')
    .slice(0, 22);

const surveyToken = (studentId) => `${studentId}.${_sig(studentId)}`;

const parseSurveyToken = (token) => {
  const m = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{22})$/i.exec(String(token || ''));
  if (!m) return null;
  const want = Buffer.from(_sig(m[1]));
  const got = Buffer.from(m[2]);
  return want.length === got.length && crypto.timingSafeEqual(want, got) ? m[1] : null;
};

const appOrigin = () => process.env.PUBLIC_APP_URL
  || (process.env.NODE_ENV === 'production' ? 'https://fablabsahsa.com' : 'http://localhost:3000');

const surveyUrl = (studentId) => `${appOrigin()}/workshop-survey/${surveyToken(studentId)}`;

// Attendance rule: at least half of the workshop days (rounded up).
const attendanceStatus = (student, workshop) => {
  let workshopDays = 1;
  if (workshop && workshop.startDate) {
    const start = new Date(workshop.startDate);
    const end = workshop.endDate ? new Date(workshop.endDate) : start;
    workshopDays = Math.max(1, Math.ceil((end - start) / 86400000) + 1);
  }
  const attendedDays = Array.isArray(student.attendanceDates) ? student.attendanceDates.length : 0;
  const requiredDays = Math.ceil(workshopDays / 2);
  return { ok: attendedDays >= requiredDays, attendedDays, requiredDays, workshopDays };
};

// Why the certificate can't be issued yet, or null when it can.
const certificateBlock = (student, workshop) => {
  const att = attendanceStatus(student, workshop);
  if (!att.ok) {
    return {
      code: 'ATTENDANCE_REQUIRED',
      message: `Student must attend at least ${att.requiredDays} of ${att.workshopDays} days. Currently attended: ${att.attendedDays}`,
      messageAr: `يجب على الطالب حضور ${att.requiredDays} يوم على الأقل من أصل ${att.workshopDays} يوم. الحضور الحالي: ${att.attendedDays} يوم`
    };
  }
  if (!student.surveySubmittedAt) {
    return {
      code: 'SURVEY_REQUIRED',
      message: 'The student has not completed the workshop survey yet — the certificate is issued after the survey',
      messageAr: 'لم يعبّئ الطالب استبيان الورشة بعد — تُصدر الشهادة بعد تعبئة الاستبيان'
    };
  }
  return null;
};

module.exports = {
  SURVEY_VERSION,
  SURVEY_SETTINGS_KEY,
  DEFAULT_QUESTIONS,
  QUESTIONS: DEFAULT_QUESTIONS,
  validateQuestions,
  loadQuestions,
  RATING_LABELS,
  cleanAnswers,
  surveyToken,
  parseSurveyToken,
  surveyUrl,
  attendanceStatus,
  certificateBlock
};
