// Execution plan (الخطة التنفيذية) data model — the fields, lists and
// completeness checks of «نموذج الخطة التنفيذية - فاب لاب الأحساء» (by
// م. نوف عبدالله البوعبيد). Shared by the employee's editor, the reviewers'
// history view and the change comparison between versions.
import { uid, has, num, getPath, setPath } from '../TrainingKits/kitModel';
import { NA, FILE_BLOCKS, normalizeBlocks, blockState } from './planFiles';

export { uid, has, num, getPath, setPath };
export const idOf = (p) => `epf-${p.replace(/\./g, '-')}`;

export const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const QUARTERS = ['الربع الأول', 'الربع الثاني', 'الربع الثالث', 'الربع الرابع'];
export const monthName = (m) => MONTHS[Number(m) - 1] || '';
export const PERIOD_TYPES = [{ v: 'quarter', l: 'ربع سنوي' }, { v: 'month', l: 'شهري' }];
export const HEAD_ROLES = ['أساسي', 'مشارك', 'مساند'];

// The four «ملفات المستهدف» — each on its own path (see planFiles.js).
export { FILE_BLOCKS, NA };

// ─────────────── The media file → a design request ───────────────
// «المتطلبات الإعلامية» is a media design request (طلب تصميم إعلان, MR-###)
// with its own path: employee → design team → employee checks the design →
// project manager → manager. The target links it (requestId) and reads its
// stage live; an embedded form from older plans still shows and counts.
export const fmtMediaNo = (n) => (n == null || n === '' ? 'MR-—' : `MR-${String(n).padStart(3, '0')}`);
// Where the request is now, as the employee reads it in the plan.
export const MEDIA_STAGE = {
  draft: 'مسودة لم تُرسل بعد',
  design: 'لدى فريق التصميم',
  employee_check: 'بانتظار مراجعتك للتصميم',
  pm_review: 'لدى مسؤول إدارة المشاريع',
  manager_review: 'لدى المدير للاعتماد',
  returned_employee: 'معاد إليك للتعديل',
  approved: 'معتمد'
};
export const MEDIA_STAGE_TONE = {
  draft: 'muted', design: 'cyan', employee_check: 'amber', pm_review: 'amber', manager_review: 'cyan', returned_employee: 'red', approved: 'mint'
};
// The employee edits the request only in these stages.
export const MEDIA_EDITABLE = ['draft', 'returned_employee'];

// A target's file block state — the media block follows its linked design
// request (live.media = { [requestId]: { status, number, title } }; a
// missing map = not loaded yet, so a link then counts as present). Every
// other block: planFiles.blockState.
export const blockStateOf = (t, key, live) => {
  const x = t[key];
  if (key === 'media' && x.status !== NA && has(x.requestId)) {
    const r = live?.media ? live.media[x.requestId] : undefined;
    if (live?.media && !r) return { status: 'الطلب غير متاح', tone: 'red', ok: false, gone: true };
    const approved = r?.status === 'approved';
    return {
      status: approved ? 'مرفقة' : 'قيد الإعداد',
      tone: approved ? 'ok' : 'wait',
      ok: true,
      linked: r || null,
      stage: r ? (MEDIA_STAGE[r.status] || r.status) : ''
    };
  }
  return blockState(t, key, live);
};

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

// The four file blocks of a target; the media block also carries the
// link to its design request.
const blocksOf = (t) => {
  const b = normalizeBlocks(t || {});
  b.media = { requestId: '', requestNo: '', requestTitle: '', ...b.media };
  return b;
};

export const MAKE = {
  phase: () => ({ id: uid(), task: '', start: '', end: '', criterion: '' }),
  target: () => ({
    id: uid(), name: '', kpi: '', desc: '', output: '', audience: '', month: '', place: '', time: '',
    phases: [{ id: uid(), task: '', start: '', end: '', criterion: '' }, { id: uid(), task: '', start: '', end: '', criterion: '' }],
    sectionRole: '', headRole: '',
    ...blocksOf({}),
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
    Object.assign(x, blocksOf(t));
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

const GONE = {
  content: 'الحقيبة المرتبطة لم تعد متاحة',
  finance: 'طلب الصرف المرتبط لم يعد متاحًا',
  media: 'طلب التصميم المرتبط لم يعد متاحًا',
  volunteer: 'النموذج غير متاح'
};

// What each file block asks for when it is neither linked / filled nor
// «لا يتطلب».
const BLOCK_ASK = {
  content: 'اربط حقيبة تدريبية أو أنشئ حقيبة جديدة، أو اختر «لا يتطلب»',
  finance: 'أنشئ طلب صرف مالي أو اربط طلبًا قائمًا، أو اختر «لا يتطلب»',
  media: 'أنشئ طلب تصميم إعلان لفريق التصميم أو اربط طلبًا قائمًا، أو اختر «لا يتطلب»',
  volunteer: 'عبّئ نموذج الفرص التطوعية، أو اختر «لا يتطلب»'
};

// Completeness — the template's fields. Each issue knows the field (target
// id) it points to and the nav section it belongs to; `open` names the
// embedded form to open before jumping (media / volunteer).
// live = live statuses of the linked kits / financial / design requests.
export const analyze = (s, live) => {
  const h = s.header; const sec = {}; const issues = [];
  const chk = (k, ok, text, target, open) => {
    const x = sec[k] || (sec[k] = { done: 0, total: 0 });
    x.total++;
    if (ok) x.done++; else issues.push({ sec: k, text, target, open });
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
    FILE_BLOCKS.forEach(b => {
      const st = blockStateOf(t, b.key, live);
      if (st.gone) {
        chk(k, false, `${n}: ${GONE[b.key]} — اربط غيره أو أنشئ جديدًا`, `ep-blk-${t.id}-${b.key}`);
        return;
      }
      // An unfinished media form from an older plan: it now becomes a
      // design request (what was filled carries over).
      if (b.key === 'media' && st.form && st.missing.length) {
        chk(k, false, `${n}: «${b.label}» — أنشئ طلب تصميم من النموذج (ينتقل إليه ما عبّأته) أو اختر «لا يتطلب»`, `ep-blk-${t.id}-media`);
        return;
      }
      if (st.form && st.missing.length) {
        const m = st.missing;
        chk(k, false, `${n} › ${b.label}: أكمل ${m.slice(0, 3).map(x => x.label).join('، ')}${m.length > 3 ? ` و${m.length - 3} غيرها` : ''}`, idOf(`${q}${m[0].path}`), `${b.key}-${t.id}`);
        return;
      }
      chk(k, st.ok, `${n}: «${b.label}» — ${BLOCK_ASK[b.key]}`, `ep-blk-${t.id}-${b.key}`);
    });
  });

  let done = 0; let total = 0;
  Object.keys(sec).forEach(k => { done += sec[k].done; total += sec[k].total; });
  return { sec, issues, pct: total ? Math.floor((done / total) * 100) : 0 };
};

// ─────────────── Change comparison (edit history) ───────────────

const short = (v) => (Array.isArray(v) ? v.join('، ') : String(v == null ? '' : v));
const MEDIA_F = {
  activity: 'اسم النشاط', implementer: 'اسم المنفذ', ageMin: 'العمر من', ageMax: 'العمر إلى', timeFrom: 'الوقت من', timeTo: 'الوقت إلى', dayPart: 'الفترة',
  dateFrom: 'التاريخ من', dateTo: 'التاريخ إلى', beneficiaries: 'عدد المستفيدين', seatsNote: 'توزيع المقاعد', days: 'عدد الأيام الفعلية', gender: 'الفئة المستهدفة',
  dueDate: 'تاريخ انتهاء التصميم', urgency: 'الأولوية', cost: 'تكلفة البرنامج', notes: 'ملاحظات للتصميم'
};
const VOL_F = { coordinatorName: 'منسق الفرص', coordinatorPhone: 'جوال المنسق', location: 'مكان التطوع', mode: 'طريقة التطوع', support: 'الدعم المقدم للمتطوع', risks: 'المخاطر والتحديات' };
const ROLE_F = { title: 'المسمى', field: 'المجال أو التخصص', count: 'العدد', tasks: 'المهام', skills: 'المهارات', education: 'المؤهل', gender: 'الجنس', ageMin: 'العمر من', ageMax: 'العمر إلى', timeFrom: 'من الساعة', timeTo: 'إلى الساعة' };

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
    FILE_BLOCKS.forEach(b => {
      const x = t[b.key];
      put(`t.${t.id}.${b.key}.status`, `${n} › ${b.label} › الحالة`, x.status);
      put(`t.${t.id}.${b.key}.link`, `${n} › ${b.label} › الرابط`, x.link);
      put(`t.${t.id}.${b.key}.files`, `${n} › ${b.label} › الملفات`, x.files.map(f => f.name));
    });
    put(`t.${t.id}.content.kit`, `${n} › المحتوى المعتمد › الحقيبة المرتبطة`, t.content.kitId ? `${t.content.kitNo} ${t.content.kitTitle}`.trim() : '');
    put(`t.${t.id}.finance.req`, `${n} › الملف المالي › طلب الصرف المرتبط`, t.finance.requestId ? `${t.finance.requestNo} ${t.finance.requestTitle}`.trim() : '');
    put(`t.${t.id}.media.req`, `${n} › المتطلبات الإعلامية › طلب التصميم المرتبط`, t.media.requestId ? `${t.media.requestNo || ''} ${t.media.requestTitle || ''}`.trim() : '');
    const mf = t.media.form; const M = `${n} › المتطلبات الإعلامية`;
    Object.entries(MEDIA_F).forEach(([k, l]) => put(`t.${t.id}.mf.${k}`, `${M} › ${l}`, mf[k]));
    mf.axes.forEach((a, j) => put(`t.${t.id}.mf.ax.${a.id}`, `${M} › المحور ${j + 1}`, [a.title, a.desc].filter(has).join(' — ')));
    put(`t.${t.id}.mf.images`, `${M} › الصور`, mf.images.map(im => im.caption || im.name));
    const vf = t.volunteer.form; const V = `${n} › الفرص التطوعية`;
    Object.entries(VOL_F).forEach(([k, l]) => put(`t.${t.id}.vf.${k}`, `${V} › ${l}`, vf[k]));
    vf.roles.forEach((r, j) => {
      Object.entries(ROLE_F).forEach(([k, l]) => put(`t.${t.id}.vf.r.${r.id}.${k}`, `${V} › الدور ${j + 1} › ${l}`, r[k]));
      put(`t.${t.id}.vf.r.${r.id}.days`, `${V} › الدور ${j + 1} › الأيام`,
        [r.dateFrom && `من ${r.dateFrom}`, r.dateTo && `إلى ${r.dateTo}`, r.weekdays.join('، '), !r.dateFrom && r.days && `${r.days} أيام`].filter(Boolean).join(' '));
    });
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
