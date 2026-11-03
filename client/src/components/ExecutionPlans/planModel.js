// Execution plan (الخطة التنفيذية) data model — the fields, lists and
// completeness checks of «نموذج الخطة التنفيذية - فاب لاب الأحساء» (by
// م. نوف عبدالله البوعبيد). Shared by the employee's editor, the reviewers'
// history view and the change comparison between versions.
import { uid, has, num, getPath, setPath } from '../TrainingKits/kitModel';

export { uid, has, num, getPath, setPath };
export const idOf = (p) => `epf-${p.replace(/\./g, '-')}`;

export const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const QUARTERS = ['الربع الأول', 'الربع الثاني', 'الربع الثالث', 'الربع الرابع'];
export const monthName = (m) => MONTHS[Number(m) - 1] || '';
export const PERIOD_TYPES = [{ v: 'quarter', l: 'ربع سنوي' }, { v: 'month', l: 'شهري' }];
export const HEAD_ROLES = ['أساسي', 'مشارك', 'مساند'];

// The three status columns of the template, each with the status that
// means "the file is attached" (it then needs a file or a link).
export const BLOCKS = [
  { key: 'content', label: 'المحتوى المعتمد', statuses: ['مرفق ومعتمد', 'بانتظار الاعتماد', 'لا يتطلب'], attached: 'مرفق ومعتمد' },
  { key: 'finance', label: 'الملف المالي التفصيلي', statuses: ['مرفق', 'قيد الإعداد', 'لا يتطلب'], attached: 'مرفق' },
  { key: 'media', label: 'المتطلبات الإعلامية', statuses: ['مرفقة', 'قيد الإعداد', 'لا يتطلب'], attached: 'مرفقة' }
];
export const VOLUNTEER_LABEL = 'تصاميم الفرص التطوعية';

// Employee section codes → the Arabic name used in the plan.
export const SECTION_AR = {
  'Electronics and Programming': 'الإلكترونيات والبرمجة',
  'CNC Laser': 'الليزر CNC',
  'CNC Wood': 'الخشب CNC',
  'CNC Metal': 'المعادن CNC',
  '3D': 'الطباعة ثلاثية الأبعاد',
  'Robotic and AI': 'الروبوتات والذكاء الاصطناعي',
  "Kid's Club": 'نادي الأطفال',
  'Vinyl Cutting': 'قطع الفينيل',
  'UV Printing and Sticker Making': 'طباعة UV والملصقات'
};
export const sectionAr = (s) => SECTION_AR[s] || s || '';

export const MAKE = {
  phase: () => ({ id: uid(), task: '', start: '', end: '', criterion: '' }),
  target: () => ({
    id: uid(), name: '', kpi: '', desc: '', output: '', audience: '', month: '', place: '', time: '',
    phases: [{ id: uid(), task: '', start: '', end: '', criterion: '' }, { id: uid(), task: '', start: '', end: '', criterion: '' }],
    sectionRole: '', headRole: '',
    content: { status: '', link: '', files: [], kitId: '', kitNo: '', kitTitle: '' },
    finance: { status: '', link: '', files: [] },
    media: { status: '', link: '', files: [] },
    volunteer: { link: '', files: [] },
    notes: ''
  })
};

// A new plan: the employee's section and name are filled in, and the
// period starts on the current year (the type / quarter is chosen).
export const blankState = (employee) => ({
  v: 1,
  header: {
    periodType: 'quarter',
    quarter: '',
    month: '',
    year: new Date().getFullYear(),
    section: sectionAr(employee?.section),
    head: employee?.name || ''
  },
  targets: [MAKE.target()]
});

// Fill in anything missing (older drafts, partial data) without losing values.
export const normalize = (d) => {
  const b = blankState();
  if (!d || typeof d !== 'object' || !d.header) return b;
  const s = { ...b, ...d, header: { ...b.header, ...d.header } };
  const blank = MAKE.target();
  s.targets = (Array.isArray(d.targets) ? d.targets : []).map(t => {
    const x = { ...blank, ...t, id: t?.id || uid() };
    x.phases = (Array.isArray(t?.phases) ? t.phases : []).map(p => ({ ...MAKE.phase(), ...p }));
    ['content', 'finance', 'media', 'volunteer'].forEach(k => {
      x[k] = { ...blank[k], ...(t?.[k] || {}) };
      if (!Array.isArray(x[k].files)) x[k].files = [];
    });
    return x;
  });
  return s;
};

// «الربع الأول 2027» / «يناير 2027» / '' when not chosen yet.
export const periodLabel = (h = {}) => {
  const y = has(h.year) ? ` ${h.year}` : '';
  if (h.periodType === 'quarter' && QUARTERS[Number(h.quarter) - 1]) return `${QUARTERS[Number(h.quarter) - 1]}${y}`;
  if (h.periodType === 'month' && monthName(h.month)) return `${monthName(h.month)}${y}`;
  return '';
};
// Months (1–12) the period covers; [] = not chosen.
export const periodMonths = (h = {}) => {
  const q = num(h.quarter); const m = num(h.month);
  if (h.periodType === 'quarter' && q >= 1 && q <= 4) return [3 * q - 2, 3 * q - 1, 3 * q];
  if (h.periodType === 'month' && m >= 1 && m <= 12) return [m];
  return [];
};
export const planTitle = (s) => {
  const p = periodLabel(s?.header);
  return p ? `الخطة التنفيذية — ${p}${has(s.header.section) ? ` · ${s.header.section}` : ''}` : '';
};

const blockHasProof = (b, key) => (b.files || []).length > 0 || has(b.link) || (key === 'content' && has(b.kitId));

// Completeness — the template's fields. Each issue knows the field (target
// id) it points to and the nav section it belongs to.
export const analyze = (s) => {
  const h = s.header; const sec = {}; const issues = [];
  const chk = (k, ok, text, target) => {
    const x = sec[k] || (sec[k] = { done: 0, total: 0 });
    x.total++;
    if (ok) x.done++; else issues.push({ sec: k, text, target });
  };
  chk('header', h.periodType === 'quarter' ? has(h.quarter) : h.periodType === 'month' ? has(h.month) : false,
    h.periodType === 'month' ? 'اختر شهر الخطة' : h.periodType === 'quarter' ? 'اختر ربع السنة للخطة' : 'حدد نوع فترة الخطة (شهري أو ربع سنوي)', idOf('header.period'));
  chk('header', /^\d{4}$/.test(String(h.year || '')), 'اكتب سنة الخطة', idOf('header.year'));
  chk('header', has(h.section), 'اكتب القسم أو المسار', idOf('header.section'));
  chk('header', has(h.head), 'اكتب اسم مسؤول القسم', idOf('header.head'));
  chk('header', s.targets.length > 0, 'أضف مستهدفًا واحدًا على الأقل', 'ep-add-target');

  const months = periodMonths(h);
  const FIELDS = [['name', 'اسم العمل المخطط'], ['kpi', 'مؤشر الأداء المرتبط'], ['desc', 'وصف مختصر'], ['output', 'المخرج المتوقع والكمية'], ['audience', 'الفئة المستهدفة'],
    ['month', 'شهر التنفيذ'], ['place', 'مكان التنفيذ'], ['time', 'وقت التنفيذ'], ['sectionRole', 'دور القسم'], ['headRole', 'دور مسؤول القسم']];
  s.targets.forEach((t, i) => {
    const k = t.id; const n = `المستهدف ${i + 1}`; const q = `targets.${i}.`;
    FIELDS.forEach(([f, l]) => chk(k, has(t[f]), `${n}: أكمل «${l}»`, idOf(`${q}${f}`)));
    if (has(t.month) && months.length && !months.includes(num(t.month))) chk(k, false, `${n}: شهر التنفيذ (${monthName(t.month)}) خارج فترة الخطة`, idOf(`${q}month`));
    const full = t.phases.filter(p => has(p.task) && has(p.start) && has(p.end) && has(p.criterion));
    chk(k, full.length > 0, `${n}: أضف مرحلة تنفيذ مكتملة (المهمة والتاريخان ومعيار الاكتمال)`, `ep-phases-${t.id}`);
    t.phases.forEach((p, j) => {
      const any = has(p.task) || has(p.start) || has(p.end) || has(p.criterion);
      const miss = [['task', 'المهمة'], ['start', 'تاريخ البداية'], ['end', 'تاريخ النهاية'], ['criterion', 'معيار الاكتمال']].filter(([f]) => !has(p[f]));
      if (any && miss.length) chk(k, false, `${n} › المرحلة ${j + 1}: أكمل ${miss.map(m => m[1]).join('، ')}`, idOf(`${q}phases.${j}.${miss[0][0]}`));
      if (has(p.start) && has(p.end) && p.end < p.start) chk(k, false, `${n} › المرحلة ${j + 1}: تاريخ النهاية قبل تاريخ البداية`, idOf(`${q}phases.${j}.end`));
    });
    BLOCKS.forEach(b => {
      const x = t[b.key];
      chk(k, has(x.status), `${n}: حدد حالة «${b.label}»`, idOf(`${q}${b.key}.status`));
      if (x.status === b.attached) {
        chk(k, blockHasProof(x, b.key), `${n}: «${b.label}» ${b.attached} — ارفع الملف أو ضع رابطه${b.key === 'content' ? ' أو اربط حقيبة معتمدة' : ''}`, `ep-blk-${t.id}-${b.key}`);
      }
    });
  });

  let done = 0; let total = 0;
  Object.keys(sec).forEach(k => { done += sec[k].done; total += sec[k].total; });
  return { sec, issues, pct: total ? Math.floor((done / total) * 100) : 0 };
};

// ─────────────── Change comparison (edit history) ───────────────

const short = (v) => (Array.isArray(v) ? v.join('، ') : String(v == null ? '' : v));

// Every field of a plan as [key, label, value], keyed by target / phase ids
// so a moved or removed item reads as such.
export const flatten = (raw) => {
  const s = normalize(raw);
  const out = [];
  const put = (key, label, value) => out.push([key, label, short(value)]);
  const h = s.header;
  put('h.period', 'بيانات الخطة › فترة الخطة', periodLabel(h));
  put('h.section', 'بيانات الخطة › القسم أو المسار', h.section);
  put('h.head', 'بيانات الخطة › اسم مسؤول القسم', h.head);
  const T = { name: 'اسم العمل المخطط', kpi: 'مؤشر الأداء المرتبط', desc: 'وصف مختصر', output: 'المخرج المتوقع والكمية', audience: 'الفئة المستهدفة',
    place: 'مكان التنفيذ', time: 'وقت التنفيذ', sectionRole: 'دور القسم', headRole: 'دور مسؤول القسم', notes: 'ملاحظات' };
  s.targets.forEach((t, i) => {
    const n = `المستهدف ${i + 1}${has(t.name) ? ` (${t.name})` : ''}`;
    put(`t.${t.id}.order`, `${n} › الترتيب`, i + 1);
    Object.entries(T).forEach(([k, l]) => put(`t.${t.id}.${k}`, `${n} › ${l}`, t[k]));
    put(`t.${t.id}.month`, `${n} › شهر التنفيذ`, monthName(t.month));
    t.phases.forEach((p, j) => put(`t.${t.id}.p.${p.id}`, `${n} › المرحلة ${j + 1}`,
      [p.task, p.start && `من ${p.start}`, p.end && `إلى ${p.end}`, p.criterion && `— ${p.criterion}`].filter(Boolean).join(' ')));
    BLOCKS.forEach(b => {
      const x = t[b.key];
      put(`t.${t.id}.${b.key}.status`, `${n} › ${b.label} › الحالة`, x.status);
      put(`t.${t.id}.${b.key}.link`, `${n} › ${b.label} › الرابط`, x.link);
      put(`t.${t.id}.${b.key}.files`, `${n} › ${b.label} › الملفات`, x.files.map(f => f.name));
    });
    put(`t.${t.id}.content.kit`, `${n} › المحتوى المعتمد › الحقيبة المرتبطة`, t.content.kitId ? `${t.content.kitNo} ${t.content.kitTitle}`.trim() : '');
    put(`t.${t.id}.volunteer.link`, `${n} › ${VOLUNTEER_LABEL} › الرابط`, t.volunteer.link);
    put(`t.${t.id}.volunteer.files`, `${n} › ${VOLUNTEER_LABEL} › الملفات`, t.volunteer.files.map(f => f.name));
  });
  return out;
};

// What changed between two versions: [{ label, before, after, kind }]
export const diffData = (prev, next) => {
  const a = new Map(flatten(prev).map(([k, l, v]) => [k, { l, v }]));
  const changes = [];
  const seen = new Set();
  flatten(next).forEach(([k, l, v]) => {
    seen.add(k);
    const old = a.get(k);
    if (!old) { if (v.trim()) changes.push({ label: l, before: '', after: v, kind: 'added' }); return; }
    if (old.v !== v) changes.push({ label: l, before: old.v, after: v, kind: old.v.trim() ? (v.trim() ? 'changed' : 'removed') : 'added' });
  });
  a.forEach((o, k) => { if (!seen.has(k) && o.v.trim()) changes.push({ label: o.l, before: o.v, after: '', kind: 'removed' }); });
  return changes;
};

export const fmtPlanNo = (n) => (n == null ? 'EP-—' : `EP-${String(n).padStart(3, '0')}`);
