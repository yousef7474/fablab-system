// Post-workshop survey. A student gets the certificate only after they
// attended enough days AND submitted this survey. The questions live
// here (one place) and are served to the public survey page and the
// admin results view, so both always render the same version.
const crypto = require('crypto');

const SURVEY_VERSION = 1;

const RATING_LABELS = {
  ar: ['غير راضٍ إطلاقاً', 'غير راضٍ', 'محايد', 'راضٍ', 'راضٍ جداً'],
  en: ['Very dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Very satisfied']
};

const QUESTIONS = [
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

// Keeps only known answers in the expected shape; reports required ones
// that are missing.
const cleanAnswers = (raw) => {
  const answers = {};
  const missing = [];
  for (const q of QUESTIONS) {
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
  QUESTIONS,
  RATING_LABELS,
  cleanAnswers,
  surveyToken,
  parseSurveyToken,
  surveyUrl,
  attendanceStatus,
  certificateBlock
};
