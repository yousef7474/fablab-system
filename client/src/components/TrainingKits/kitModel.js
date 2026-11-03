// Training kit (الحقيبة التدريبية) data model — the fields, lists and
// completeness checks of the kit template (قالب الحقيبة التدريبية - فاب لاب
// الأحساء, by م. نوف عبدالله البوعبيد). Shared by the employee's editor,
// the reviewers' history view and the change comparison between versions.
// The attachment forms (data.forms) are defined in kitForms.js.
import { FORM_OF, blankForms, normalizeForms, analyzeForm, flattenForms } from './kitForms';

export const uid = () => Math.random().toString(36).slice(2, 10);
export const has = (v) => (Array.isArray(v) ? v.length > 0 : String(v == null ? '' : v).trim() !== '');
export const num = (v) => (v === '' || v == null || !isFinite(+v) ? null : +v);
const NF = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
export const fmt = (n) => NF.format(n);
export const idOf = (p) => `tkf-${p.replace(/\./g, '-')}`;
export const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
export const setPath = (o, p, v) => {
  const ks = p.split('.');
  const last = ks.pop();
  ks.reduce((a, k) => a[k], o)[last] = v;
};

// Arabic number agreement: [one, two, 3–10, 11+]
export const DAYS = ['يوم واحد', 'يومان', 'أيام', 'يومًا'];
export const HOURS = ['ساعة واحدة', 'ساعتان', 'ساعات', 'ساعة'];
export const GROUPS = ['مجموعة واحدة', 'مجموعتان', 'مجموعات', 'مجموعة'];
export const PEOPLE = ['مشارك واحد', 'مشاركان', 'مشاركين', 'مشاركًا'];
export const NOTES = ['ملاحظة واحدة', 'ملاحظتان', 'ملاحظات', 'ملاحظة'];
export const ar = (n, f) => {
  n = +n;
  if (n === 1) return f[0];
  if (n === 2) return f[1];
  const m = Math.floor(n) % 100;
  return `${fmt(n)} ${Number.isInteger(n) && m >= 3 && m <= 10 ? f[2] : f[3]}`;
};

export const OPT = {
  type: ['قصير', 'ممتد', 'معسكر', 'سلسلة تدريبية ضمن عضوية'],
  level: ['تأسيسي', 'متوسط', 'متقدم'],
  practical: ['فردي', 'جماعي', 'كلاهما'],
  delivery: ['حضوري', 'عن بُعد (أون لاين)'],
  language: ['العربية', 'الإنجليزية'],
  owner: ['المشارك', 'المجموعة', 'فاب لاب الأحساء'],
  basis: [{ v: 'person', l: 'للفرد' }, { v: 'group', l: 'للمجموعة' }, { v: 'fixed', l: 'للبرنامج' }],
  cert: ['شهادة حضور', 'شهادة اجتياز', 'شهادة تميز']
};
export const OUT_TYPES = [
  { v: 'منتج مصنّع', tech: true }, { v: 'دائرة إلكترونية', tech: true }, { v: 'برنامج أو كود', tech: true }, { v: 'تصميم رقمي', tech: true },
  { v: 'عرض أو توثيق', tech: false }, { v: 'مهارة أو معرفة', tech: false }
];
export const isTech = (t) => !!(OUT_TYPES.find(o => o.v === t) || {}).tech;
export const STAFF = ['المدرب', 'المدرب المساعد', 'المتطوعون'];
export const READINESS = ['مكان التدريب', 'الأجهزة والأدوات', 'البرامج والحسابات', 'المواد والمستهلكات', 'الملفات الرقمية', 'المخرج النموذجي', 'السلامة', 'البدائل'];
export const ATTACH = [
  ['الاختبار القبلي', 'الأسئلة والدرجات ومفاتيح الإجابة وما يقيسه كل سؤال وربطه بالأهداف.'],
  ['الاختبار البعدي', 'الأسئلة والدرجات ومفاتيح الإجابة وما يقيسه كل سؤال وربطه بالأهداف.'],
  ['المحتوى العلمي التدريبي', 'بيانات الإعداد والإصدار والأهداف والمحتوى حسب الأيام والتطبيقات والصور والمصادر والاعتماد.'],
  ['العرض التقديمي', 'نسخة بصرية مختصرة ومتطابقة مع المحتوى العلمي وخطة التنفيذ.'],
  ['ملفات المخرجات التقنية', 'التصاميم والأكواد والتطبيقات وملفات التشغيل والتصنيع النهائية المجربة.'],
  ['دليل الطالب', 'التعريف بالبرنامج ورحلة المشارك والمخرجات والجدول والتقييم والتعليمات والسلامة.'],
  ['الدليل العلمي المرجعي للطالب', 'ملخص أهم المفاهيم والأوامر والقطع وخطوات إعادة التطبيق.'],
  ['نموذج تقييم التطبيقات والمخرجات', 'معايير تقييم التطبيقات وعمل المخرج وجودته وسلامته ومطابقته.'],
  ['استبانة رضا المستفيد', 'النموذج المستخدم لقياس رضا المشاركين عن المحتوى والمدرب والتنظيم والتجربة.']
];
export const ATTACH_DESC = Object.fromEntries(ATTACH);
export const CHECKS = [
  { t: 'جميع الحقول الأساسية مكتملة', g: ['fields'] },
  { t: 'المخرجات موصوفة وصورها مرفقة', g: ['outputs'] },
  { t: 'خطة الأيام مرتبطة بالأهداف والمخرجات', g: ['plan'] },
  { t: 'الاحتياجات محسوبة حسب عدد المشاركين', g: ['needs'] },
  { t: 'جميع الملفات مرفقة ومجربة', g: ['files'], manual: 'filesTested', ml: 'تمت تجربة جميع الملفات المرفقة' },
  { t: 'يمكن لمدرب متخصص تنفيذ البرنامج من الحقيبة مباشرة', g: [], manual: 'trainerReady', ml: 'أؤكد ذلك بعد مراجعة الحقيبة كاملة' }
];
export const SECTIONS = [
  { key: 'card', id: 's1', n: '1', t: 'بطاقة البرنامج' },
  { key: 'outputs', id: 's2', n: '2', t: 'المخرجات والتسليمات' },
  { key: 'plan', id: 's3', n: '3', t: 'خطة التنفيذ' },
  { key: 'resources', id: 's4', n: '4', t: 'الاحتياجات والموارد' },
  { key: 'attachments', id: 's5', n: '5', t: 'مرفقات الحقيبة' },
  { key: 'approval', id: 's6', n: '6', t: 'الاعتماد والشهادة' },
  { key: 'done', id: 's7', n: '7', t: 'اكتمال الحقيبة' }
];

export const MAKE = {
  objective: () => ({ id: uid(), text: '' }),
  output: () => ({ id: uid(), name: '', type: '', desc: '', count: '', owner: '' }),
  measure: () => ({ id: uid(), outputId: '', what: '', result: '', proof: '' }),
  image: () => ({ id: uid(), outputId: '', fileId: '', name: '', caption: '' }),
  day: () => ({ id: uid(), learn: '', topics: '', objectives: [], outputs: [], execution: '', verify: '' }),
  staff: () => ({ id: uid(), role: '', fixed: false, count: '', expertise: '', tasks: '' }),
  need: () => ({ id: uid(), item: '', specs: '', unit: '', qty: '', basis: 'person', notes: '' })
};

export const blankState = () => ({
  v: 1,
  card: {
    name: '', description: '', type: '', level: '', sublevel: '', practical: '', delivery: '', language: '', primaryDomain: '', supportDomains: [], tools: [],
    objectives: [MAKE.objective()], target: '', ageMin: '', ageMax: '', partMin: '', partMax: '', partNote: '', groupSize: '', groupNote: '', prereq: '', days: '', hours: '',
    author: '', version: '', versionDate: '', costPerson: '', costGroup: '', costNote: '', setup: '', other: ''
  },
  outputs: [MAKE.output()],
  measures: [MAKE.measure()],
  images: [],
  plan: [MAKE.day()],
  staff: STAFF.map(r => ({ ...MAKE.staff(), role: r, fixed: true })),
  needs: [MAKE.need()],
  readiness: READINESS.map(l => ({ label: l, prepare: '', lead: '' })),
  attachments: ATTACH.map(a => ({ label: a[0], files: [], note: '' })),
  cert: { type: '', criteria: '' },
  manual: { filesTested: false, trainerReady: false },
  forms: blankForms()
});

// Fill in anything missing (older drafts, partial data) without losing values.
export const normalize = (d) => {
  const b = blankState();
  if (!d || typeof d !== 'object' || !d.card) return b;
  const s = { ...b, ...d };
  s.card = { ...b.card, ...d.card };
  s.cert = { ...b.cert, ...(d.cert || {}) };
  s.manual = { ...b.manual, ...(d.manual || {}) };
  ['supportDomains', 'tools'].forEach(k => { if (!Array.isArray(s.card[k])) s.card[k] = []; });
  const list = (arr, make, fallback) => (Array.isArray(arr) ? arr.map(x => ({ ...make(), ...x })) : fallback);
  s.card.objectives = list(d.card.objectives, MAKE.objective, b.card.objectives);
  if (!s.card.objectives.length) s.card.objectives = [MAKE.objective()];
  s.outputs = list(d.outputs, MAKE.output, b.outputs);
  s.measures = list(d.measures, MAKE.measure, b.measures);
  s.images = list(d.images, MAKE.image, []).filter(x => x.fileId);
  s.plan = list(d.plan, MAKE.day, b.plan);
  s.plan.forEach(p => { if (!Array.isArray(p.objectives)) p.objectives = []; if (!Array.isArray(p.outputs)) p.outputs = []; });
  s.staff = list(d.staff, MAKE.staff, b.staff);
  s.needs = list(d.needs, MAKE.need, b.needs);
  const byLabel = (arr, lbl) => (Array.isArray(arr) ? arr : []).find(r => r && r.label === lbl) || {};
  s.readiness = b.readiness.map(r => ({ ...r, ...byLabel(d.readiness, r.label) }));
  s.attachments = b.attachments.map(r => {
    const x = { ...r, ...byLabel(d.attachments, r.label) };
    if (!Array.isArray(x.files)) x.files = [];
    return x;
  });
  s.forms = normalizeForms(d.forms, s);
  return s;
};

// Derived numbers used by the editor and its checks.
export const derive = (s) => {
  const c = s.card;
  const d = num(c.days); const h = num(c.hours); const pmin = num(c.partMin); const pmax = num(c.partMax); const gs = num(c.groupSize);
  const groups = (p) => (gs && p ? Math.ceil(p / gs) : null);
  const cp = num(c.costPerson) || 0; const cg = num(c.costGroup) || 0;
  const cost = (p) => (p == null || (cg && !gs) ? null : cp * p + cg * (groups(p) || 0));
  const gmax = groups(pmax);
  const needTotal = (x) => {
    const q = num(x.qty);
    if (q == null) return null;
    if (x.basis === 'fixed') return q;
    if (x.basis === 'group') return gmax != null ? q * gmax : null;
    return pmax != null ? q * pmax : null;
  };
  return { d, h, pmin, pmax, gs, groups, cp, cg, cost, gmax, needTotal };
};

// Completeness + traceability — the template's checks. Each issue knows
// the field (target id) it points to.
export const analyze = (s) => {
  const c = s.card; const sec = {}; const issues = [];
  const chk = (k, ok, text, target, group) => {
    const x = sec[k] || (sec[k] = { done: 0, total: 0 });
    x.total++;
    if (ok) x.done++; else issues.push({ sec: k, text, target, group });
  };
  [['name', 'اسم البرنامج التدريبي'], ['description', 'وصف البرنامج التدريبي'], ['type', 'نوع البرنامج'], ['level', 'المستوى'], ['practical', 'نوع التطبيق العملي'],
    ['delivery', 'آلية تقديم البرنامج'], ['language', 'لغة البرنامج'], ['primaryDomain', 'المجال الأساسي'], ['tools', 'الأجهزة والبرامج'], ['target', 'الفئة المستهدفة'],
    ['ageMin', 'الحد الأدنى للعمر'], ['ageMax', 'الحد الأعلى للعمر'], ['partMin', 'الحد الأدنى للمشاركين'], ['partMax', 'الحد الأعلى للمشاركين'],
    ['days', 'عدد أيام البرنامج'], ['hours', 'الساعات اليومية'], ['prereq', 'شروط الالتحاق'], ['author', 'مُعدّ المحتوى العلمي'], ['version', 'رقم الإصدار'], ['versionDate', 'تاريخ التحديث']]
    .forEach(f => chk('card', has(c[f[0]]), `أكمل حقل «${f[1]}»`, idOf(`card.${f[0]}`), 'fields'));
  chk('card', c.objectives.some(o => has(o.text)), 'اكتب هدفًا واحدًا على الأقل للبرنامج', idOf('card.objectives.0.text'), 'fields');
  chk('card', has(c.costPerson) || has(c.costGroup), 'حدد تكلفة المستهلكات للمشارك أو للمجموعة', idOf('card.costPerson'), 'fields');
  if (c.practical && c.practical !== 'فردي') chk('card', has(c.groupSize), 'حدد عدد المشاركين في كل مجموعة', idOf('card.groupSize'), 'fields');
  if (num(c.ageMin) != null && num(c.ageMax) != null && num(c.ageMin) > num(c.ageMax)) chk('card', false, 'الحد الأدنى للعمر أكبر من الحد الأعلى', idOf('card.ageMin'), 'fields');
  if (num(c.partMin) != null && num(c.partMax) != null && num(c.partMin) > num(c.partMax)) chk('card', false, 'الحد الأدنى للمشاركين أكبر من الحد الأعلى', idOf('card.partMin'), 'fields');

  chk('outputs', s.outputs.length > 0, 'أضف مخرجًا واحدًا على الأقل', 'tk-list-outputs', 'outputs');
  s.outputs.forEach((o, i) => {
    const code = `م${i + 1}`;
    const miss = [['name', 'الاسم'], ['type', 'النوع'], ['count', 'العدد'], ['owner', 'الملكية'], ['desc', 'الوصف']].filter(f => !has(o[f[0]]));
    chk('outputs', !miss.length, `المخرج ${code}: أكمل ${miss.map(f => f[1]).join('، ')}`, idOf(`outputs.${i}.${miss[0] ? miss[0][0] : 'name'}`), 'outputs');
    chk('outputs', s.measures.some(m => m.outputId === o.id && has(m.what) && has(m.result) && has(m.proof)), `المخرج ${code} يحتاج معيار قياس مكتملًا`, 'tk-list-measures', 'measures');
    if (isTech(o.type)) chk('outputs', s.images.some(im => im.outputId === o.id), `المخرج ${code} تقني ويحتاج صورة مرجعية`, 'tk-list-images', 'outputs');
  });
  s.measures.forEach((m, i) => { if (!m.outputId && (has(m.what) || has(m.result) || has(m.proof))) chk('outputs', false, `حدد المخرج المرتبط بمعيار القياس ${i + 1}`, idOf(`measures.${i}.outputId`), 'measures'); });
  s.images.forEach((im, i) => { if (!im.outputId) chk('outputs', false, `حدد رقم المخرج للصورة ${i + 1}`, idOf(`images.${i}.outputId`), 'outputs'); });

  const d = num(c.days);
  chk('plan', s.plan.length > 0, 'أضف يومًا واحدًا على الأقل إلى الخطة', 'tk-list-plan', 'plan');
  if (d && s.plan.length) chk('plan', s.plan.length === d, `خطة التنفيذ تضم ${ar(s.plan.length, DAYS)} ومدة البرنامج ${ar(d, DAYS)}`, 'tk-list-plan', 'plan');
  s.plan.forEach((p, i) => {
    const miss = [['learn', 'ماذا سنتعلم'], ['topics', 'المحاور'], ['execution', 'التنفيذ والمدة'], ['verify', 'التحقق']].filter(f => !has(p[f[0]]));
    chk('plan', !miss.length, `اليوم ${i + 1}: أكمل ${miss.map(f => f[1]).join('، ')}`, idOf(`plan.${i}.${miss[0] ? miss[0][0] : 'learn'}`), 'plan');
    chk('plan', p.objectives.length > 0, `اليوم ${i + 1} غير مرتبط بأي هدف`, `tk-day-${p.id}`, 'plan');
    chk('plan', p.outputs.length > 0, `اليوم ${i + 1} غير مرتبط بأي مخرج`, `tk-day-${p.id}`, 'plan');
  });
  c.objectives.forEach((o, i) => { if (has(o.text)) chk('plan', s.plan.some(p => p.objectives.includes(o.id)), `الهدف ه${i + 1} لا يغطيه أي يوم في الخطة`, 'tk-list-plan', 'plan'); });
  s.outputs.forEach((o, i) => chk('plan', s.plan.some(p => p.outputs.includes(o.id)), `المخرج م${i + 1} لا يُنفَّذ في أي يوم`, 'tk-list-plan', 'plan'));

  const tr = s.staff[0];
  if (tr) chk('resources', has(tr.count) && has(tr.expertise) && has(tr.tasks), 'أكمل بيانات المدرب: العدد والخبرة والمهام', idOf('staff.0.count'), 'resources');
  s.staff.forEach((x, i) => { if (i > 0 && num(x.count) > 0) chk('resources', has(x.expertise) && has(x.tasks), `أكمل خبرة ومهام «${x.role || 'الدور'}»`, idOf(`staff.${i}.expertise`), 'resources'); });
  chk('resources', num(c.partMax) != null, 'حدد الحد الأعلى للمشاركين لحساب الكميات الإجمالية', idOf('card.partMax'), 'needs');
  chk('resources', s.needs.some(x => has(x.item)), 'أضف احتياجًا ماديًا أو تقنيًا واحدًا على الأقل', 'tk-list-needs', 'needs');
  s.needs.forEach((x, i) => {
    if (has(x.item)) chk('resources', has(x.unit) && has(x.qty), `الاحتياج «${x.item}»: حدد الوحدة والكمية`, idOf(`needs.${i}.${has(x.unit) ? 'qty' : 'unit'}`), 'needs');
    if (has(x.item) && x.basis === 'group' && !has(c.groupSize)) chk('resources', false, `الاحتياج «${x.item}» محسوب للمجموعة، فحدد حجم المجموعة`, idOf('card.groupSize'), 'needs');
  });
  s.readiness.forEach((r, i) => chk('resources', has(r.prepare) && has(r.lead), `بند الجاهزية «${r.label}»: حدد ما يجب تجهيزه والمدة`, idOf(`readiness.${i}.${has(r.prepare) ? 'lead' : 'prepare'}`), 'resources'));

  // An attachment with a form counts once, done when its form passes its
  // own checks; the issue opens the form at its first missing field.
  s.attachments.forEach((a, i) => {
    const key = FORM_OF[a.label];
    if (!key) { chk('attachments', a.files.length > 0, `أرفق ملف «${a.label}»`, `tk-att-${i}`, 'files'); return; }
    const r = analyzeForm(key, s);
    const text = !r.issues.length ? '' : r.started
      ? `«${a.label}»: ${ar(r.issues.length, NOTES)} — ${r.issues[0].text}`
      : `عبّئ نموذج «${a.label}»`;
    chk('attachments', !r.issues.length, text, r.issues.length ? `form:${key}:${r.issues[0].target}` : `tk-att-${i}`, 'files');
  });

  chk('approval', has(s.cert.type), 'حدد نوع الشهادة', idOf('cert.type'), 'approval');
  chk('approval', has(s.cert.criteria), 'اكتب معايير استحقاق الشهادة', idOf('cert.criteria'), 'approval');

  let done = 0; let total = 0;
  Object.keys(sec).forEach(k => { done += sec[k].done; total += sec[k].total; });
  return { sec, issues, pct: total ? Math.floor((done / total) * 100) : 0 };
};

// ─────────────── Change comparison (edit history) ───────────────

const short = (v) => {
  if (Array.isArray(v)) return v.join('، ');
  if (typeof v === 'boolean') return v ? 'نعم' : 'لا';
  return String(v == null ? '' : v);
};

// Every field of a kit as [key, label, value], keyed by item ids so a
// moved or removed item reads as such.
export const flatten = (raw) => {
  const s = normalize(raw);
  const out = [];
  const put = (key, label, value) => out.push([key, label, short(value)]);
  const c = s.card;
  const CARD = {
    name: 'اسم البرنامج', description: 'وصف البرنامج', type: 'نوع البرنامج', level: 'المستوى', sublevel: 'رقم المستوى', practical: 'نوع التطبيق العملي',
    delivery: 'آلية التقديم', language: 'لغة البرنامج', primaryDomain: 'المجال الأساسي', supportDomains: 'المجالات المساندة', tools: 'الأجهزة والبرامج',
    target: 'الفئة المستهدفة', ageMin: 'الحد الأدنى للعمر', ageMax: 'الحد الأعلى للعمر', partMin: 'الحد الأدنى للمشاركين', partMax: 'الحد الأعلى للمشاركين',
    partNote: 'توزيع المشاركين', groupSize: 'حجم المجموعة', groupNote: 'تفاصيل تقسيم المشاركين', prereq: 'شروط الالتحاق', days: 'عدد الأيام', hours: 'الساعات اليومية', author: 'مُعدّ المحتوى',
    version: 'رقم الإصدار', versionDate: 'تاريخ التحديث', costPerson: 'التكلفة لكل مشارك', costGroup: 'التكلفة لكل مجموعة', costNote: 'تفاصيل التكلفة', setup: 'التكلفة التأسيسية', other: 'اعتبارات أخرى'
  };
  Object.entries(CARD).forEach(([k, l]) => put(`card.${k}`, `بطاقة البرنامج › ${l}`, c[k]));
  c.objectives.forEach((o, i) => put(`obj.${o.id}`, `الأهداف › ه${i + 1}`, o.text));
  const outCode = (id) => { const i = s.outputs.findIndex(o => o.id === id); return i < 0 ? '—' : `م${i + 1}`; };
  const objCode = (id) => { const i = c.objectives.findIndex(o => o.id === id); return i < 0 ? '—' : `ه${i + 1}`; };
  const OUT = { name: 'الاسم', type: 'النوع', count: 'العدد', owner: 'الملكية', desc: 'الوصف' };
  s.outputs.forEach((o, i) => Object.entries(OUT).forEach(([k, l]) => put(`out.${o.id}.${k}`, `المخرجات › م${i + 1} › ${l}`, o[k])));
  const MS = { what: 'ما الذي سنقيسه', result: 'النتيجة المطلوبة', proof: 'كيف نثبت تحققها' };
  s.measures.forEach((m, i) => {
    put(`ms.${m.id}.out`, `قياس المخرجات › معيار ${i + 1} › المخرج`, outCode(m.outputId));
    Object.entries(MS).forEach(([k, l]) => put(`ms.${m.id}.${k}`, `قياس المخرجات › معيار ${i + 1} › ${l}`, m[k]));
  });
  s.images.forEach((im, i) => put(`img.${im.id}`, `الصور المرجعية › صورة ${i + 1}`, `${outCode(im.outputId)} ${im.name || ''} ${im.caption || ''}`.trim()));
  const DAY = { learn: 'ماذا سنتعلم', topics: 'المحاور', execution: 'التنفيذ والمدة', verify: 'التحقق' };
  s.plan.forEach((p, i) => {
    Object.entries(DAY).forEach(([k, l]) => put(`day.${p.id}.${k}`, `خطة التنفيذ › اليوم ${i + 1} › ${l}`, p[k]));
    put(`day.${p.id}.obj`, `خطة التنفيذ › اليوم ${i + 1} › الأهداف المرتبطة`, p.objectives.map(objCode));
    put(`day.${p.id}.out`, `خطة التنفيذ › اليوم ${i + 1} › المخرجات المرتبطة`, p.outputs.map(outCode));
  });
  s.staff.forEach((x) => ['count', 'expertise', 'tasks'].forEach(k => put(`staff.${x.id}.${k}`, `الموارد البشرية › ${x.role || 'دور'} › ${{ count: 'العدد', expertise: 'الخبرة', tasks: 'المهام' }[k]}`, x[k])));
  const ND = { item: 'الاحتياج', specs: 'المواصفات', unit: 'الوحدة', qty: 'الكمية', basis: 'أساس الحساب', notes: 'ملاحظات' };
  s.needs.forEach((x, i) => Object.entries(ND).forEach(([k, l]) => put(`need.${x.id}.${k}`, `الاحتياجات › ${x.item || `بند ${i + 1}`} › ${l}`, k === 'basis' ? ({ person: 'للفرد', group: 'للمجموعة', fixed: 'للبرنامج' }[x[k]] || x[k]) : x[k])));
  s.readiness.forEach(r => { put(`ready.${r.label}.p`, `الجاهزية › ${r.label} › ما يجب تجهيزه`, r.prepare); put(`ready.${r.label}.l`, `الجاهزية › ${r.label} › المدة`, r.lead); });
  s.attachments.forEach(a => { put(`att.${a.label}.files`, `المرفقات › ${a.label} › الملفات`, a.files.map(f => f.name)); put(`att.${a.label}.note`, `المرفقات › ${a.label} › ملاحظة`, a.note); });
  put('cert.type', 'الشهادة › النوع', s.cert.type);
  put('cert.criteria', 'الشهادة › معايير الاستحقاق', s.cert.criteria);
  flattenForms(s, put);
  put('manual.filesTested', 'الاكتمال › تمت تجربة الملفات', s.manual.filesTested);
  put('manual.trainerReady', 'الاكتمال › جاهزة للتنفيذ من مدرب متخصص', s.manual.trainerReady);
  return out;
};

// What changed between two versions: [{ label, before, after, kind }]
export const diffData = (prev, next) => {
  const a = new Map(flatten(prev).map(([k, l, v]) => [k, { l, v }]));
  const b = flatten(next);
  const seen = new Set();
  const changes = [];
  b.forEach(([k, l, v]) => {
    seen.add(k);
    const old = a.get(k);
    if (!old) { if (v.trim()) changes.push({ label: l, before: '', after: v, kind: 'added' }); return; }
    if (old.v !== v) changes.push({ label: l, before: old.v, after: v, kind: old.v.trim() ? (v.trim() ? 'changed' : 'removed') : 'added' });
  });
  a.forEach((o, k) => { if (!seen.has(k) && o.v.trim()) changes.push({ label: o.l, before: o.v, after: '', kind: 'removed' }); });
  return changes;
};

// ─────────────── Workflow labels ───────────────

export const fmtKitNo = (n) => (n == null ? 'TK-—' : `TK-${String(n).padStart(3, '0')}`);

export const statusOf = (kit) => {
  switch (kit?.status) {
    case 'pm_review': return { label: 'لدى مسؤول إدارة المشاريع', tone: 'amber' };
    case 'manager_review': return { label: 'لدى المدير للاعتماد', tone: 'cyan' };
    case 'returned': return { label: kit.returnedBy === 'manager' ? 'أعادها المدير للتعديل' : 'معادة للتعديل', tone: 'red' };
    case 'approved': return { label: 'معتمدة', tone: 'mint' };
    default: return { label: 'مسودة', tone: 'muted' };
  }
};

export const fmtDateTime = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
};
export const fmtDay = (v) => {
  if (!v) return '';
  const d = new Date(String(v).length <= 10 ? `${v}T12:00:00` : v);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
};
export const humanSize = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`);
