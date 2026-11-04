// Financial request (طلب صرف مالي — the plan target's «الملف المالي
// التفصيلي») data model: the form of «نموذج طلب صرف مالي لمشروع مع تفاصيل
// الطلب» (materials per project and section, staff, hospitality, pricing)
// plus the funding details the manager needs to approve and sign it.
// Shared by the employee's editor, the reviewers' history view and the
// change comparison between versions. computeFinance() mirrors the server
// (server/utils/financialRequestDoc.js).
import { uid, has, num, getPath, setPath } from '../../TrainingKits/kitModel';

export { uid, has, num, getPath, setPath };
export const idOf = (p) => `frf-${p.replace(/\./g, '-')}`;
export const VAT_RATE = 0.15;

export const KINDS = ['ورشة', 'معسكر', 'برنامج تدريبي', 'فعالية', 'مشروع', 'أخرى'];
export const SECTIONS = ['الإلكترونيات', 'الليزر', 'الطباعة ثلاثية الأبعاد', 'الخشب', 'CNC', 'الفينيل', 'عام / أخرى'];
export const SOURCES = ['ميزانية فاب لاب', 'دعم المؤسسة', 'رعاية / شريك', 'رسوم المشاركين', 'أخرى'];
export const METHODS = ['عهدة نقدية', 'تحويل للمورد', 'شراء مباشر', 'أخرى'];
export const BASES = [{ v: 'person', l: 'لكل مستفيد' }, { v: 'personDay', l: 'لكل مستفيد يوميًا' }, { v: 'unit', l: 'بالعدد' }];
export const basisLabel = (b) => (BASES.find(x => x.v === b) || BASES[2]).l;

// The staff of the Excel, with its hourly rates (أجر الساعة) and a 5-hour day.
export const STAFF = [
  ['مدرب', 30], ['مساعد المدرب', 25], ['أخصائي تقني', 20], ['داعم متدربين تقني', 15],
  ['المتطوعون', 10], ['مساعد إداري', 10], ['مسميات لوجستية', ''], ['مسميات إعلامية', '']
];

export const MAKE = {
  item: (section = '') => ({ id: uid(), section, item: '', specs: '', qty: '', unit: '', vat: false, notes: '' }),
  project: (name = '') => ({ id: uid(), name, items: [MAKE.item()] }),
  staff: (role = '', rate = '', fixed = false) => ({ id: uid(), role, fixed, count: '', rate, hours: rate === '' && fixed ? '' : 5, days: '', notes: '' }),
  hosp: (item = '', basis = 'unit', fixed = false) => ({ id: uid(), item, fixed, basis, count: '', unit: '', days: '', notes: '' }),
  quote: () => ({ fileId: '', name: '', size: 0, mime: '' })
};

const me = () => { try { return JSON.parse(localStorage.getItem('employeeData') || 'null'); } catch { return null; } };

export const blankState = (employee = me()) => ({
  v: 1,
  header: {
    title: '', kind: '', section: '', requester: employee?.name || '',
    startDate: '', endDate: '', days: '', beneficiaries: '',
    planId: '', planNo: '', targetId: '', targetName: '', kitId: '', kitNo: '', kitTitle: ''
  },
  projects: [MAKE.project()],
  staff: STAFF.map(([r, rate]) => MAKE.staff(r, rate, true)),
  hospitality: [MAKE.hosp('حفل ختامي وهدايا', 'person', true), MAKE.hosp('سناكات', 'personDay', true)],
  pricing: { incomeRate: 30, fee: '' },
  funding: { source: '', sourceOther: '', budgetLine: '', method: '', methodOther: '', payee: '', bank: '', iban: '', neededBy: '', amount: '', justification: '' },
  quotes: [],
  notes: ''
});

/**
 * A new request prefilled from where it starts — a plan target (the plan
 * editor's «＋ إنشاء طلب صرف») or a training kit. Every argument is
 * optional.
 */
export const newFinanceData = ({ title, kind, section, startDate, endDate, days, beneficiaries, planId, planNo, targetId, targetName, kitId, kitNo, kitTitle } = {}) => {
  const s = blankState();
  const h = s.header;
  const put = (k, v) => { if (v != null && v !== '') h[k] = v; };
  put('title', title || targetName);
  put('kind', KINDS.includes(kind) ? kind : '');
  put('section', section);
  put('startDate', startDate);
  put('endDate', endDate);
  put('days', num(days) != null ? num(days) : '');
  put('beneficiaries', num(beneficiaries) != null ? num(beneficiaries) : '');
  put('planId', planId); put('planNo', planNo); put('targetId', targetId); put('targetName', targetName);
  put('kitId', kitId); put('kitNo', kitNo); put('kitTitle', kitTitle);
  if (has(h.title)) s.projects[0].name = h.title;
  return s;
};

// Fill in anything missing (older drafts, partial data) without losing values.
export const normalize = (d) => {
  const b = blankState(null);
  if (!d || typeof d !== 'object' || !d.header) return b;
  const list = (arr, make) => (Array.isArray(arr) ? arr.map(x => ({ ...make(), ...x, id: x?.id || uid() })) : null);
  const s = { ...b, ...d };
  s.header = { ...b.header, ...d.header };
  s.projects = (list(d.projects, MAKE.project) || b.projects).map(p => ({ ...p, items: list(p.items, MAKE.item) || [] }));
  s.staff = list(d.staff, MAKE.staff) || b.staff;
  s.hospitality = list(d.hospitality, MAKE.hosp) || b.hospitality;
  s.pricing = { ...b.pricing, ...(d.pricing || {}) };
  s.funding = { ...b.funding, ...(d.funding || {}) };
  s.quotes = (Array.isArray(d.quotes) ? d.quotes : []).filter(q => q && q.fileId);
  return s;
};

// ─────────────── Numbers (same rules as the Excel) ───────────────

export const computeFinance = (s) => {
  const h = s.header;
  const days = num(h.days) || 0;
  const ben = num(h.beneficiaries) || 0;
  const projects = s.projects.map(p => {
    const items = p.items.map(x => {
      const base = (num(x.qty) || 0) * (num(x.unit) || 0);
      const vat = x.vat ? base * VAT_RATE : 0;
      return { id: x.id, base, vat, total: base + vat };
    });
    const bySection = {};
    p.items.forEach((x, i) => { const k = has(x.section) ? x.section : 'عام / أخرى'; bySection[k] = (bySection[k] || 0) + items[i].total; });
    const base = items.reduce((a, x) => a + x.base, 0);
    const vat = items.reduce((a, x) => a + x.vat, 0);
    return { id: p.id, items, bySection, base, vat, total: base + vat };
  });
  const projectsTotal = projects.reduce((a, p) => a + p.total, 0);
  const staff = s.staff.map(x => {
    const perDay = (num(x.rate) || 0) * (num(x.hours) || 0);
    const usedDays = has(x.days) ? (num(x.days) || 0) : days;
    return { id: x.id, perDay, usedDays, total: (num(x.count) || 0) * perDay * usedDays };
  });
  const staffTotal = staff.reduce((a, x) => a + x.total, 0);
  const hospitality = s.hospitality.map(x => {
    const unit = num(x.unit) || 0;
    let count; let usedDays;
    if (x.basis === 'person') { count = ben; usedDays = 1; }
    else if (x.basis === 'personDay') { count = ben; usedDays = days; }
    else { count = num(x.count) || 0; usedDays = has(x.days) ? (num(x.days) || 0) : 1; }
    return { id: x.id, usedCount: count, usedDays, total: count * unit * usedDays };
  });
  const hospTotal = hospitality.reduce((a, x) => a + x.total, 0);
  const cost = projectsTotal + staffTotal + hospTotal;
  const incomeRate = has(s.pricing.incomeRate) ? (num(s.pricing.incomeRate) || 0) : 30;
  const income = cost * (incomeRate / 100);
  const grand = cost + income;
  const perBen = ben ? grand / ben : null;
  const fee = has(s.pricing.fee) ? num(s.pricing.fee) : null;
  const discountPct = fee != null && perBen ? (1 - fee / perBen) * 100 : null;
  const revenue = fee != null ? fee * ben : null;
  const amount = has(s.funding.amount) ? (num(s.funding.amount) || 0) : cost;
  return { days, ben, projects, projectsTotal, staff, staffTotal, hospitality, hospTotal, cost, incomeRate, income, grand, perBen, fee, discountPct, revenue, amount };
};

const NF2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export const money = (n) => (n == null ? '—' : NF2.format(round2(n)));
export const pct = (n) => (n == null ? '—' : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(n)}٪`);

const IBAN_RE = /^SA\d{22}$/;
export const cleanIban = (v) => String(v || '').replace(/\s+/g, '').toUpperCase();

// ─────────────── Completeness ───────────────

export const analyze = (s) => {
  const h = s.header; const f = s.funding; const sec = {}; const issues = [];
  const C = computeFinance(s);
  const chk = (k, ok, text, target) => {
    const x = sec[k] || (sec[k] = { done: 0, total: 0 });
    x.total++;
    if (ok) x.done++; else issues.push({ sec: k, text, target });
  };
  [['title', 'اسم البرنامج / النشاط'], ['kind', 'نوع النشاط'], ['section', 'القسم'], ['requester', 'مقدم الطلب'], ['startDate', 'تاريخ البداية'], ['endDate', 'تاريخ النهاية']]
    .forEach(([k, l]) => chk('header', has(h[k]), `أكمل «${l}»`, idOf(`header.${k}`)));
  if (has(h.startDate) && has(h.endDate) && h.endDate < h.startDate) chk('header', false, 'تاريخ النهاية قبل تاريخ البداية', idOf('header.endDate'));
  chk('header', (num(h.days) || 0) > 0, 'اكتب عدد أيام البرنامج — تُحسب منه الموارد البشرية والضيافة', idOf('header.days'));
  chk('header', (num(h.beneficiaries) || 0) > 0, 'اكتب عدد المستفيدين — تُحسب منه الضيافة وقيمة التسجيل', idOf('header.beneficiaries'));

  chk('projects', s.projects.length > 0, 'أضف مشروعًا واحدًا على الأقل', 'fr-add-project');
  s.projects.forEach((p, i) => {
    const n = `المشروع ${i + 1}`;
    chk('projects', has(p.name), `${n}: اكتب اسم المشروع`, idOf(`projects.${i}.name`));
    const full = p.items.filter(x => has(x.item) && (num(x.qty) || 0) > 0 && has(x.unit));
    chk('projects', full.length > 0, `${n}: أضف بند احتياج مكتملًا (البند والعدد وتكلفة المفرد)`, `fr-items-${p.id}`);
    p.items.forEach((x, j) => {
      const any = has(x.item) || has(x.qty) || has(x.unit) || has(x.specs);
      if (!any) return;
      const miss = [['item', 'البند'], ['qty', 'العدد'], ['unit', 'تكلفة المفرد'], ['section', 'القسم']].filter(([k]) => !has(x[k]));
      if (miss.length) chk('projects', false, `${n} › البند ${j + 1}: أكمل ${miss.map(m => m[1]).join('، ')}`, idOf(`projects.${i}.items.${j}.${miss[0][0]}`));
    });
  });

  s.staff.forEach((x, i) => {
    if ((num(x.count) || 0) <= 0) return;
    const miss = [['rate', 'أجر الساعة'], ['hours', 'الساعات يوميًا']].filter(([k]) => !((num(x[k]) || 0) > 0));
    if (miss.length) chk('staff', false, `«${x.role || 'دور'}»: أكمل ${miss.map(m => m[1]).join(' و')}`, idOf(`staff.${i}.${miss[0][0]}`));
    if (!has(x.role)) chk('staff', false, `اكتب مسمى الدور ${i + 1}`, idOf(`staff.${i}.role`));
  });
  chk('staff', s.staff.some(x => has(x.count)), 'حدد عدد المدربين أو العاملين في البرنامج (أو اكتب 0 إن لم يوجد)', idOf('staff.0.count'));

  s.hospitality.forEach((x, i) => {
    if (!has(x.unit) && !has(x.count) && (x.fixed || !has(x.item))) return;
    if (!has(x.item)) chk('hosp', false, `اكتب اسم البند ${i + 1} في الضيافة والبنود الأخرى`, idOf(`hospitality.${i}.item`));
    if (!has(x.unit)) chk('hosp', false, `«${x.item || 'البند'}»: اكتب التكلفة`, idOf(`hospitality.${i}.unit`));
    if (x.basis === 'unit' && !((num(x.count) || 0) > 0)) chk('hosp', false, `«${x.item || 'البند'}»: اكتب العدد`, idOf(`hospitality.${i}.count`));
  });

  chk('pricing', has(s.pricing.incomeRate), 'حدد نسبة الدخل (0 إن لم توجد)', idOf('pricing.incomeRate'));
  chk('pricing', has(s.pricing.fee), 'اكتب قيمة تسجيل المستفيد بعد الخصم (0 إذا كان البرنامج مجانيًا)', idOf('pricing.fee'));
  chk('pricing', C.cost > 0, 'لا توجد تكلفة — أضف بنود الاحتياجات أو الموارد', 'fr-s-pricing');

  chk('funding', has(f.source) && (f.source !== 'أخرى' || has(f.sourceOther)), 'حدد مصدر التمويل', idOf('funding.source'));
  chk('funding', has(f.method) && (f.method !== 'أخرى' || has(f.methodOther)), 'حدد طريقة الصرف', idOf('funding.method'));
  if (f.method === 'تحويل للمورد') chk('funding', has(f.payee), 'اكتب اسم المورد المستفيد من التحويل', idOf('funding.payee'));
  if (has(f.iban)) chk('funding', IBAN_RE.test(cleanIban(f.iban)), 'رقم الآيبان يبدأ بـ SA ويليه 22 رقمًا', idOf('funding.iban'));
  chk('funding', has(f.neededBy), 'حدد تاريخ الحاجة للصرف', idOf('funding.neededBy'));
  chk('funding', has(f.justification), 'اكتب مبررات الطلب', idOf('funding.justification'));
  if (has(f.amount)) chk('funding', (num(f.amount) || 0) > 0, 'المبلغ المطلوب صرفه يجب أن يكون أكبر من صفر', idOf('funding.amount'));

  let done = 0; let total = 0;
  Object.keys(sec).forEach(k => { done += sec[k].done; total += sec[k].total; });
  return { sec, issues, pct: total ? Math.floor((done / total) * 100) : 0, C };
};

// ─────────────── Change comparison (edit history) ───────────────

const short = (v) => {
  if (typeof v === 'boolean') return v ? 'نعم' : 'لا';
  return String(v == null ? '' : v);
};

export const flatten = (raw) => {
  const s = normalize(raw);
  const out = [];
  const put = (key, label, value) => out.push([key, label, short(value)]);
  const H = { title: 'اسم البرنامج / النشاط', kind: 'نوع النشاط', section: 'القسم', requester: 'مقدم الطلب', startDate: 'تاريخ البداية', endDate: 'تاريخ النهاية', days: 'عدد الأيام', beneficiaries: 'عدد المستفيدين' };
  Object.entries(H).forEach(([k, l]) => put(`h.${k}`, `بيانات الطلب › ${l}`, s.header[k]));
  put('h.plan', 'بيانات الطلب › الخطة التنفيذية', [s.header.planNo, s.header.targetName].filter(Boolean).join(' — '));
  put('h.kit', 'بيانات الطلب › الحقيبة التدريبية', [s.header.kitNo, s.header.kitTitle].filter(Boolean).join(' — '));
  s.projects.forEach((p, i) => {
    const n = `المشروع ${i + 1}${has(p.name) ? ` (${p.name})` : ''}`;
    put(`p.${p.id}.name`, `${n} › الاسم`, p.name);
    p.items.forEach((x, j) => put(`p.${p.id}.i.${x.id}`, `${n} › البند ${j + 1}`,
      has(x.item) || has(x.qty) || has(x.unit) ? `${x.section ? `[${x.section}] ` : ''}${x.item} × ${x.qty || 0} @ ${x.unit || 0}${x.vat ? ' + ض.ق.م' : ''}${has(x.specs) ? ` — ${x.specs}` : ''}${has(x.notes) ? ` (${x.notes})` : ''}` : ''));
  });
  s.staff.forEach(x => put(`s.${x.id}`, `الموارد البشرية › ${x.role || 'دور'}`,
    (num(x.count) || 0) > 0 ? `${x.count} × ${x.rate || 0} ر.س/ساعة × ${x.hours || 0} ساعات${has(x.days) ? ` × ${x.days} أيام` : ''}${has(x.notes) ? ` (${x.notes})` : ''}` : ''));
  s.hospitality.forEach(x => put(`o.${x.id}`, `الضيافة والبنود الأخرى › ${x.item || 'بند'}`,
    has(x.unit) ? `${x.unit} ر.س ${basisLabel(x.basis)}${x.basis === 'unit' ? ` × ${x.count || 0}${has(x.days) ? ` × ${x.days} أيام` : ''}` : ''}${has(x.notes) ? ` (${x.notes})` : ''}` : ''));
  put('pr.rate', 'التسعير › نسبة الدخل ٪', s.pricing.incomeRate);
  put('pr.fee', 'التسعير › قيمة التسجيل بعد الخصم', s.pricing.fee);
  const F = { source: 'مصدر التمويل', sourceOther: 'مصدر التمويل (أخرى)', budgetLine: 'بند الميزانية', method: 'طريقة الصرف', methodOther: 'طريقة الصرف (أخرى)', payee: 'المستفيد من الصرف', bank: 'البنك', iban: 'الآيبان', neededBy: 'تاريخ الحاجة للصرف', amount: 'المبلغ المطلوب صرفه', justification: 'مبررات الطلب' };
  Object.entries(F).forEach(([k, l]) => put(`f.${k}`, `التمويل والصرف › ${l}`, s.funding[k]));
  put('quotes', 'التمويل والصرف › عروض الأسعار', s.quotes.map(q => q.name).join('، '));
  put('notes', 'ملاحظات', s.notes);
  return out;
};

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

export const fmtReqNo = (n) => (n == null ? 'FR-—' : `FR-${String(n).padStart(3, '0')}`);
