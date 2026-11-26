const crypto = require('crypto');

// FabLab forms (admin "نماذج فاب لاب"): the question types, checking a
// form the admin built, checking a respondent's answers, and the first
// form (the لقاء registration, moved over from Google Forms).
//
// A field: { id, type, label, help, required, placeholder, options,
//            min, max, maxWords, showIf: { field, value } | null }
//   short / paragraph   text (paragraph may cap the word count)
//   email / phone       checked formats
//   number              optional min / max
//   date / time         yyyy-mm-dd / hh:mm
//   radio / dropdown    one of `options`
//   checkbox            any of `options`
//   consent             one tick box; `options[0]` is its text
//   section             a heading + text between questions (no answer)
//   note                a highlighted note: optional title + `content` (no answer)
//   terms               terms & conditions: title + `content` + an "I agree"
//                       tick box (`options[0]`); always required
// `showIf` shows a field only when an earlier radio / dropdown / checkbox
// answer is `value`.
// English (optional): `labelEn`, `helpEn`, `placeholderEn` and `optionsEn`
// (parallel to `options`). The Arabic text stays the canonical value —
// answers and showIf always use the Arabic option.

const TYPES = ['short', 'paragraph', 'email', 'phone', 'number', 'date', 'time', 'radio', 'dropdown', 'checkbox', 'consent', 'section', 'note', 'terms'];
const CHOICE = ['radio', 'dropdown', 'checkbox'];
// Shown to the respondent but never answered.
const NO_ANSWER = ['section', 'note'];
const TICKED = ['consent', 'terms'];
const TERMS_TITLE = 'الشروط والأحكام';
const TERMS_TICK = 'قرأت الشروط والأحكام وأوافق عليها';
const MAX_FIELDS = 100;
const MAX_OPTIONS = 60;
const TEXT_MAX = { short: 500, paragraph: 5000 };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?\d{8,15}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

const _str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const _num = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
const newFieldId = () => `f_${crypto.randomBytes(4).toString('hex')}`;

class FormError extends Error {
  constructor(message, messageAr) { super(message); this.messageAr = messageAr; this.status = 400; }
}

// The admin's field list → a clean list (throws FormError).
function validateFields(input) {
  if (!Array.isArray(input)) throw new FormError('Fields must be a list', 'قائمة الأسئلة غير صحيحة');
  if (input.length > MAX_FIELDS) throw new FormError(`At most ${MAX_FIELDS} fields`, `الحد الأقصى ${MAX_FIELDS} سؤالًا`);
  const seen = new Set();
  const out = [];
  input.forEach((raw, i) => {
    const n = i + 1;
    const type = TYPES.includes(raw?.type) ? raw.type : null;
    if (!type) throw new FormError(`Field ${n}: unknown type`, `السؤال ${n}: نوع غير معروف`);
    let id = ID_RE.test(raw.id || '') ? raw.id : newFieldId();
    while (seen.has(id)) id = newFieldId();
    seen.add(id);
    const label = _str(raw.label, 600) || (type === 'terms' ? TERMS_TITLE : '');
    if (!label && type !== 'note') throw new FormError(`Field ${n}: the question text is required`, `السؤال ${n}: نص السؤال مطلوب`);
    const f = {
      id, type, label, help: _str(raw.help, 2000) || '',
      required: type === 'terms' || (!NO_ANSWER.includes(type) && !!raw.required)
    };
    if (type === 'note' || type === 'terms') {
      f.content = _str(raw.content, 20000);
      f.contentEn = _str(raw.contentEn, 20000);
      if (type === 'terms' && !f.content) throw new FormError(`Field ${n}: the terms text is required`, `العنصر ${n}: نص الشروط والأحكام مطلوب`);
      if (type === 'note' && !f.content && !label) throw new FormError(`Field ${n}: write the note`, `العنصر ${n}: اكتب نص الملاحظة`);
      if (!f.contentEn) delete f.contentEn;
    }
    f.labelEn = _str(raw.labelEn, 600);
    f.helpEn = _str(raw.helpEn, 2000);
    if (['short', 'paragraph', 'email', 'phone', 'number'].includes(type)) {
      f.placeholder = _str(raw.placeholder, 200) || '';
      f.placeholderEn = _str(raw.placeholderEn, 200);
    }
    if (CHOICE.includes(type) || TICKED.includes(type)) {
      // Keep each option's English beside it while dropping blanks / repeats.
      const rawEn = Array.isArray(raw.optionsEn) ? raw.optionsEn : [];
      const pairs = [];
      const taken = new Set();
      (Array.isArray(raw.options) ? raw.options : []).forEach((o, k) => {
        const ar = _str(o, 300);
        if (!ar || taken.has(ar)) return;
        taken.add(ar);
        pairs.push([ar, _str(rawEn[k], 300)]);
      });
      const list = pairs.slice(0, MAX_OPTIONS);
      if (TICKED.includes(type)) {
        f.options = [list[0]?.[0] || (type === 'terms' ? TERMS_TICK : 'أوافق')];
        f.optionsEn = [list[0]?.[1] || ''];
      } else if (!list.length) {
        throw new FormError(`Field ${n}: add at least one option`, `السؤال ${n}: أضف خيارًا واحدًا على الأقل`);
      } else {
        f.options = list.map(x => x[0]);
        f.optionsEn = list.map(x => x[1]);
      }
      if (!f.optionsEn.some(Boolean)) delete f.optionsEn;
    }
    if (!f.labelEn) delete f.labelEn;
    if (!f.helpEn) delete f.helpEn;
    if (f.placeholderEn === '') delete f.placeholderEn;
    if (type === 'number') {
      f.min = _num(raw.min);
      f.max = _num(raw.max);
      if (f.min != null && f.max != null && f.min > f.max) throw new FormError(`Field ${n}: min is above max`, `السؤال ${n}: الحد الأدنى أكبر من الأعلى`);
    }
    if (type === 'paragraph' || type === 'short') {
      const w = _num(raw.maxWords);
      f.maxWords = w && w > 0 ? Math.min(Math.round(w), 5000) : null;
    }
    // Only an earlier choice question can control this one.
    const cond = raw.showIf;
    if (cond && cond.field && cond.value != null) {
      const ctl = out.find(o => o.id === cond.field && CHOICE.includes(o.type));
      const value = _str(cond.value, 300);
      if (ctl && ctl.options.includes(value)) f.showIf = { field: ctl.id, value };
    }
    if (!f.showIf) f.showIf = null;
    out.push(f);
  });
  return out;
}

const _isEmpty = (v) => v == null || v === '' || v === false || (Array.isArray(v) && v.length === 0);
const _words = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;

// Is `field` shown, given the (already cleaned) answers so far?
function isShown(field, answers) {
  if (!field.showIf) return true;
  const a = answers[field.showIf.field];
  return Array.isArray(a) ? a.includes(field.showIf.value) : a === field.showIf.value;
}

// A respondent's answers → { answers, errors }. Hidden and section fields
// are dropped; errors are [{ field, message, messageAr }].
function cleanAnswers(fields, body) {
  const input = body && typeof body === 'object' ? body : {};
  const answers = {};
  const errors = [];
  const fail = (f, en, ar) => errors.push({ field: f.id, message: `${f.label}: ${en}`, messageAr: `${f.label}: ${ar}` });

  for (const f of fields) {
    if (NO_ANSWER.includes(f.type) || !isShown(f, answers)) continue;
    let v = input[f.id];
    if (typeof v === 'string') v = v.trim();
    if (f.type === 'checkbox' && !Array.isArray(v)) v = _isEmpty(v) ? [] : [v];
    if (TICKED.includes(f.type)) v = v === true || v === 'true' || v === 1;
    if (_isEmpty(v)) {
      if (f.required) fail(f, 'required', 'مطلوب');
      continue;
    }
    switch (f.type) {
      case 'short':
      case 'paragraph': {
        v = String(v).slice(0, TEXT_MAX[f.type]);
        if (f.maxWords && _words(v) > f.maxWords) { fail(f, `at most ${f.maxWords} words`, `لا يتجاوز ${f.maxWords} كلمة`); continue; }
        break;
      }
      case 'email':
        v = String(v).toLowerCase().slice(0, 200);
        if (!EMAIL_RE.test(v)) { fail(f, 'invalid email', 'بريد إلكتروني غير صحيح'); continue; }
        break;
      case 'phone':
        v = String(v).replace(/[\s()-]/g, '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
        if (!PHONE_RE.test(v)) { fail(f, 'invalid phone number', 'رقم جوال غير صحيح'); continue; }
        break;
      case 'number': {
        const n = Number(String(v).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
        if (!Number.isFinite(n)) { fail(f, 'must be a number', 'يجب أن يكون رقمًا'); continue; }
        if (f.min != null && n < f.min) { fail(f, `at least ${f.min}`, `الحد الأدنى ${f.min}`); continue; }
        if (f.max != null && n > f.max) { fail(f, `at most ${f.max}`, `الحد الأعلى ${f.max}`); continue; }
        v = n;
        break;
      }
      case 'date':
        if (!DATE_RE.test(v) || Number.isNaN(Date.parse(v))) { fail(f, 'invalid date', 'تاريخ غير صحيح'); continue; }
        break;
      case 'time':
        if (!TIME_RE.test(v)) { fail(f, 'invalid time', 'وقت غير صحيح'); continue; }
        break;
      case 'radio':
      case 'dropdown':
        if (!f.options.includes(v)) { fail(f, 'pick one of the options', 'اختر أحد الخيارات'); continue; }
        break;
      case 'checkbox':
        v = [...new Set(v.map(x => String(x)))];
        if (!v.every(x => f.options.includes(x))) { fail(f, 'pick from the options', 'اختر من الخيارات'); continue; }
        break;
      case 'consent':
      case 'terms':
        v = true;
        break;
      default:
        continue;
    }
    answers[f.id] = v;
  }
  return { answers, errors };
}

// An answer as text (lists, emails, exports).
function answerText(field, value) {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) return value.join('، ');
  if (TICKED.includes(field?.type)) return value ? (field.options?.[0] || 'نعم') : '';
  return String(value);
}

// Who answered: the first short / name-like answer, the first email and phone.
function respondentOf(fields, answers) {
  const email = fields.find(f => f.type === 'email' && answers[f.id]);
  const phone = fields.find(f => f.type === 'phone' && answers[f.id]);
  const nameField = fields.find(f => f.type === 'short' && /اسم|name/i.test(f.label) && answers[f.id])
    || fields.find(f => f.type === 'short' && answers[f.id]);
  return {
    name: nameField ? String(answers[nameField.id]).slice(0, 200) : null,
    email: email ? answers[email.id] : null,
    phone: phone ? answers[phone.id] : null
  };
}

// The لقاء registration form, moved over from Google Forms (created once,
// switched off so the admin can review it before sharing).
const LIQAA_FORM = {
  slug: 'asla-tech-2026',
  title: 'التسجيل في لقاء أصالتك (ASLA TECH 2026)',
  titleEn: 'Register for the Asalatak Meetup (ASLA TECH 2026)',
  description: [
    'لقاء الابتكار والبحث العلمي وبراءات الاختراع',
    'لقاء حواري مع / م. فوزي العيسى - مستشار الفاب لاب',
    '',
    '( شروط الحضور )',
    'الحد الأدنى للعمر 13 سنة فما فوق، ولا يوجد حد أعلى.',
    'سيصلك تأكيد الحضور قبل أسبوع من الموعد وقبل يومين منه، ويُعوَّض المقعد غير المؤكد حضوره من قائمة الانتظار.',
    'يُرجى الحضور قبل الموعد بربع ساعة على الأقل لاستلام بطاقة الاسم.'
  ].join('\n'),
  descriptionEn: [
    'Innovation, Scientific Research & Patents Meetup',
    'An open conversation with Eng. Fawzi Al-Essa — FabLab Advisor',
    '',
    '(Attendance conditions)',
    'Minimum age is 13; there is no upper age limit.',
    'You will receive an attendance confirmation one week and two days before the event; unconfirmed seats are offered to the waiting list.',
    'Please arrive at least 15 minutes early to collect your name badge.'
  ].join('\n'),
  successMessage: 'تم تسجيلك بنجاح. سيصلك تأكيد الحضور قبل أسبوع من الموعد وقبل يومين منه.',
  successMessageEn: "You're registered. You will receive an attendance confirmation one week and two days before the event.",
  closedMessage: 'التسجيل في اللقاء مغلق حاليًا.',
  closedMessageEn: 'Registration for this meetup is currently closed.',
  fields: [
    { id: 'full_name', type: 'short', label: 'الاسم الكامل', labelEn: 'Full name', required: true },
    { id: 'age', type: 'number', label: 'العمر', labelEn: 'Age', required: true, min: 13, help: 'الحد الأدنى للعمر 13 سنة', helpEn: 'Minimum age is 13' },
    { id: 'phone', type: 'phone', label: 'رقم الجوال', labelEn: 'Mobile number', required: true, placeholder: '05xxxxxxxx', placeholderEn: '05xxxxxxxx' },
    { id: 'email', type: 'email', label: 'البريد الإلكتروني', labelEn: 'Email', required: true, placeholder: 'name@example.com', placeholderEn: 'name@example.com' },
    {
      id: 'entity', type: 'radio', label: 'الجهة', labelEn: 'Affiliation', required: true,
      options: ['مدرسة', 'جامعة', 'عمل', 'مستقل'], optionsEn: ['School', 'University', 'Work', 'Independent']
    },
    { id: 'interest', type: 'short', label: 'المجال المهتم به', labelEn: 'Field of interest', required: true },
    {
      id: 'has_idea', type: 'radio', label: 'هل لديك فكرة ابتكارية ترغب في عرضها؟', labelEn: 'Do you have an innovative idea you would like to present?',
      required: false, options: ['نعم', 'لا'], optionsEn: ['Yes', 'No']
    },
    {
      id: 'idea', type: 'paragraph', label: 'وصف عام مختصر للفكرة', labelEn: 'A brief overview of your idea', required: false, maxWords: 100,
      help: 'لا يتجاوز 100 كلمة، ودون ذكر تفاصيل تقنية سرية حفاظًا على جِدّة الفكرة',
      helpEn: 'No more than 100 words — please leave out confidential technical details to protect the novelty of your idea',
      showIf: { field: 'has_idea', value: 'نعم' }
    },
    {
      id: 'wants_consult', type: 'radio', label: 'هل ترغب بحجز استشارة فردية مسبقة؟', labelEn: 'Would you like to book a one-to-one consultation in advance?',
      required: false, options: ['نعم', 'لا'], optionsEn: ['Yes', 'No']
    },
    {
      id: 'consult_area', type: 'radio', label: 'ما مجال الاستشارة؟', labelEn: 'What is the consultation about?', required: false,
      options: ['براءات', 'تصنيع', 'إلكترونيات', 'دعم واحتضان', 'ناشئين'],
      optionsEn: ['Patents', 'Manufacturing', 'Electronics', 'Support & incubation', 'Startups'],
      showIf: { field: 'wants_consult', value: 'نعم' }
    },
    {
      id: 'pledge', type: 'consent', required: true, options: ['أتعهد وأوافق'], optionsEn: ['I pledge and agree'],
      label: 'أتعهد بتأكيد حضوري عند استلام رسالة التذكير، وأفهم أن المقعد غير المؤكد يُعوَّض من قائمة الانتظار',
      labelEn: 'I pledge to confirm my attendance when I receive the reminder message, and I understand that an unconfirmed seat will be offered to the waiting list'
    }
  ]
};

module.exports = { TYPES, CHOICE, NO_ANSWER, FormError, validateFields, cleanAnswers, isShown, answerText, respondentOf, newFieldId, LIQAA_FORM };
