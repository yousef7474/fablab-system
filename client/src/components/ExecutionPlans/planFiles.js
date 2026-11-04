// «ملفات المستهدف» — the four files of each execution-plan target, each on
// its own path:
//   content   (المحتوى المعتمد)        → a training kit (its own PM → manager flow)
//   finance   (الملف المالي التفصيلي)  → a financial request (طلب صرف مالي, own flow)
//   media     (المتطلبات الإعلامية)     → «نموذج اعتماد طلب تصميم إعلان», filled here
//   volunteer (تصاميم الفرص التطوعية)   → the volunteer roles form, filled here
// Statuses are never typed: they follow the linked kit / request or the
// form's completeness. `status: 'لا يتطلب'` is the only stored choice;
// older plans' stored statuses, links and files still display and count.
import { uid, has, num } from '../TrainingKits/kitModel';

export const NA = 'لا يتطلب';

export const FILE_BLOCKS = [
  { key: 'content', label: 'المحتوى المعتمد', icon: '🎒', attached: 'مرفق ومعتمد', pending: 'بانتظار الاعتماد' },
  { key: 'finance', label: 'الملف المالي التفصيلي', icon: '🧾', attached: 'مرفق', pending: 'قيد الإعداد' },
  { key: 'media', label: 'المتطلبات الإعلامية', icon: '📣', attached: 'مرفقة', pending: 'قيد الإعداد' },
  { key: 'volunteer', label: 'تصاميم الفرص التطوعية', icon: '🤝', attached: 'مرفق', pending: 'قيد الإعداد' }
];
export const BLOCK_OF = Object.fromEntries(FILE_BLOCKS.map(b => [b.key, b]));

export const fmtFinanceNo = (n) => (n == null || n === '' ? 'FR-—' : `FR-${String(n).padStart(3, '0')}`);

// ─────────────── Forms ───────────────

export const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const DAY_PARTS = ['صباحًا', 'مساءً'];
export const GENDERS = ['أولاد', 'بنات', 'مختلط'];
export const URGENCY = ['مستعجل', 'غير مستعجل'];
export const V_MODES = ['حضوري', 'عن بُعد', 'مدمج'];
export const V_GENDERS = ['ذكور', 'إناث', 'الجميع'];
export const MEDIA_MIN_IMAGES = 3;

// The reviewers named on «نموذج اعتماد طلب تصميم إعلان».
export const MEDIA_SIGNERS = [
  { role: 'تم تأكيد المحتوى العلمي من: مدير البرامج والمشاريع', name: 'م. نوف بوعبيد' },
  { role: 'الإعلام', name: 'أ. دانة الدوسري' },
  { role: 'مشاريع المؤسسة', name: 'أ. لولوة عادل' }
];
export const MEDIA_EXEC = { role: 'المسؤول التنفيذي', name: 'أ. زكي اللويم' };

export const MAKE_F = {
  axis: () => ({ id: uid(), title: '', desc: '' }),
  media: () => ({
    activity: '', implementer: '', ageMin: '', ageMax: '', timeFrom: '', timeTo: '', dayPart: '',
    dateFrom: '', dateTo: '', beneficiaries: '', seatsNote: '', days: '', gender: '',
    axes: [{ id: uid(), title: '', desc: '' }], images: [], dueDate: '', urgency: '', cost: '', notes: ''
  }),
  role: () => ({
    id: uid(), title: '', field: '', count: '', tasks: '', skills: '', education: '', gender: '', ageMin: '', ageMax: '',
    dateFrom: '', dateTo: '', weekdays: [], days: '', timeFrom: '', timeTo: ''
  }),
  volunteer: () => ({ coordinatorName: '', coordinatorPhone: '', location: '', mode: '', roles: [{ ...MAKE_F.role() }], support: '', risks: '' })
};

const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const fileRef = (f) => (f && typeof f === 'object' && f.fileId ? { fileId: f.fileId, name: f.name || '', size: f.size || 0, mime: f.mime || '', caption: f.caption || '' } : null);

export const normalizeMedia = (raw) => {
  const b = MAKE_F.media(); const f = obj(raw);
  const x = { ...b, ...f };
  x.axes = Array.isArray(f.axes) ? f.axes.map(a => ({ ...MAKE_F.axis(), ...obj(a) })) : b.axes;
  x.images = (Array.isArray(f.images) ? f.images : []).map(fileRef).filter(Boolean);
  return x;
};
export const normalizeVolunteer = (raw) => {
  const b = MAKE_F.volunteer(); const f = obj(raw);
  const x = { ...b, ...f };
  x.roles = Array.isArray(f.roles) ? f.roles.map(r => {
    const y = { ...MAKE_F.role(), ...obj(r) };
    if (!Array.isArray(y.weekdays)) y.weekdays = [];
    return y;
  }) : b.roles;
  return x;
};

// The four blocks of one target, older plans included.
export const normalizeBlocks = (t = {}) => {
  const base = (x) => { const y = { status: '', link: '', ...obj(x) }; y.files = Array.isArray(y.files) ? y.files : []; return y; };
  const content = { kitId: '', kitNo: '', kitTitle: '', ...base(t.content) };
  const finance = { requestId: '', requestNo: '', requestTitle: '', ...base(t.finance) };
  const media = { ...base(t.media), form: normalizeMedia(t.media?.form) };
  const volunteer = { ...base(t.volunteer), form: normalizeVolunteer(t.volunteer?.form) };
  return { content, finance, media, volunteer };
};

// ─────────────── Arithmetic ───────────────

const minutes = (hm) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hm || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
// Hours between two HH:MM times (null if either is missing or to ≤ from).
export const hoursBetween = (from, to) => {
  const a = minutes(from); const b = minutes(to);
  return a == null || b == null || b <= a ? null : Math.round(((b - a) / 60) * 100) / 100;
};
const parseDay = (d) => { const x = new Date(`${String(d).slice(0, 10)}T12:00:00`); return Number.isNaN(x.getTime()) ? null : x; };
export const weekdayOf = (d) => { const x = has(d) ? parseDay(d) : null; return x ? WEEKDAYS[x.getDay()] : ''; };
// Working days of a volunteer role: the chosen weekdays between the two
// dates (every day when none is chosen), or the typed number without dates.
export const roleDays = (r) => {
  const a = has(r.dateFrom) ? parseDay(r.dateFrom) : null;
  const b = has(r.dateTo) ? parseDay(r.dateTo) : null;
  if (a && b) {
    if (b < a) return null;
    const pick = new Set((r.weekdays || []).map(w => WEEKDAYS.indexOf(w)).filter(i => i >= 0));
    let n = 0;
    for (let d = new Date(a); d <= b && n < 400; d.setDate(d.getDate() + 1)) if (!pick.size || pick.has(d.getDay())) n++;
    return n;
  }
  if (a && !b) return pick1(r);
  const n = num(r.days);
  return n && n > 0 ? n : null;
};
const pick1 = (r) => { const n = num(r.days); return n && n > 0 ? n : 1; };
export const roleHours = (r) => {
  const h = hoursBetween(r.timeFrom, r.timeTo);
  const d = roleDays(r);
  const c = num(r.count) || 0;
  return { perDay: h, days: d, perVolunteer: h != null && d != null ? h * d : null, total: h != null && d != null ? h * d * c : null };
};
export const volunteerTotals = (f) => f.roles.reduce((a, r) => {
  const x = roleHours(r);
  return { volunteers: a.volunteers + (num(r.count) || 0), hours: a.hours + (x.total || 0) };
}, { volunteers: 0, hours: 0 });

// ─────────────── Completeness ───────────────
// Each returns [{ label, path }] of what is missing; path is relative to
// the target ('media.form.activity', 'volunteer.form.roles.0.title').

export const mediaMissing = (f) => {
  const miss = [];
  const need = (ok, label, path) => { if (!ok) miss.push({ label, path }); };
  need(has(f.activity), 'اسم النشاط', 'media.form.activity');
  need(has(f.implementer), 'اسم المنفذ', 'media.form.implementer');
  need(has(f.ageMin) && has(f.ageMax), 'العمر المستهدف', 'media.form.ageMin');
  if (num(f.ageMin) != null && num(f.ageMax) != null && num(f.ageMin) > num(f.ageMax)) need(false, 'العمر: الحد الأدنى أكبر من الأعلى', 'media.form.ageMin');
  need(has(f.timeFrom) && has(f.timeTo), 'الفترة الزمنية', 'media.form.timeFrom');
  need(has(f.dayPart), 'صباحًا أو مساءً', 'media.form.dayPart');
  need(has(f.dateFrom) && has(f.dateTo), 'تاريخ النشاط', 'media.form.dateFrom');
  if (has(f.dateFrom) && has(f.dateTo) && f.dateTo < f.dateFrom) need(false, 'تاريخ النهاية قبل البداية', 'media.form.dateTo');
  need(num(f.beneficiaries) > 0, 'عدد المستفيدين', 'media.form.beneficiaries');
  need(has(f.days), 'عدد الأيام الفعلية', 'media.form.days');
  need(has(f.gender), 'الفئة المستهدفة', 'media.form.gender');
  need(f.axes.some(a => has(a.title)), 'المحاور', 'media.form.axes.0.title');
  need(f.images.length >= MEDIA_MIN_IMAGES, `${MEDIA_MIN_IMAGES} صور على الأقل`, 'media.form.images');
  need(has(f.dueDate), 'تاريخ انتهاء التصميم', 'media.form.dueDate');
  need(has(f.urgency), 'مستعجل أو غير مستعجل', 'media.form.urgency');
  need(has(f.cost), 'تكلفة البرنامج', 'media.form.cost');
  return miss;
};
export const mediaStarted = (f) => ['activity', 'implementer', 'ageMin', 'ageMax', 'timeFrom', 'timeTo', 'dayPart', 'dateFrom', 'dateTo', 'beneficiaries', 'seatsNote', 'days', 'gender', 'dueDate', 'urgency', 'cost', 'notes']
  .some(k => has(f[k])) || f.images.length > 0 || f.axes.some(a => has(a.title) || has(a.desc));

export const volunteerMissing = (f) => {
  const miss = [];
  const need = (ok, label, path) => { if (!ok) miss.push({ label, path }); };
  need(has(f.coordinatorName), 'اسم منسق الفرص', 'volunteer.form.coordinatorName');
  need(has(f.coordinatorPhone), 'جوال المنسق', 'volunteer.form.coordinatorPhone');
  need(has(f.location), 'مكان التطوع', 'volunteer.form.location');
  need(has(f.mode), 'طريقة التطوع', 'volunteer.form.mode');
  need(f.roles.length > 0, 'دور تطوعي واحد على الأقل', 'volunteer.form.roles');
  f.roles.forEach((r, j) => {
    const p = `volunteer.form.roles.${j}.`; const n = `الدور ${j + 1}`;
    need(has(r.title), `${n}: المسمى`, `${p}title`);
    need(has(r.field), `${n}: المجال أو التخصص`, `${p}field`);
    need(num(r.count) > 0, `${n}: عدد المتطوعين`, `${p}count`);
    need(has(r.tasks), `${n}: المهام والمسؤوليات`, `${p}tasks`);
    need(has(r.gender), `${n}: الجنس`, `${p}gender`);
    need(roleDays(r) != null, `${n}: الأيام`, `${p}dateFrom`);
    need(hoursBetween(r.timeFrom, r.timeTo) != null, `${n}: الساعات اليومية`, `${p}timeFrom`);
    if (num(r.ageMin) != null && num(r.ageMax) != null && num(r.ageMin) > num(r.ageMax)) need(false, `${n}: الحد الأدنى للعمر أكبر من الأعلى`, `${p}ageMin`);
  });
  return miss;
};
export const volunteerStarted = (f) => ['coordinatorName', 'coordinatorPhone', 'location', 'mode', 'support', 'risks'].some(k => has(f[k]))
  || f.roles.some(r => ['title', 'field', 'count', 'tasks', 'skills', 'timeFrom', 'dateFrom', 'days'].some(k => has(r[k])));

// ─────────────── Derived status ───────────────
// live = { kits: { [kitId]: { status, number, title } }, finance: { [requestId]: … } }
// (missing map = not loaded yet: a link then counts as present).

const legacyProof = (x) => x.files.length > 0 || has(x.link);

export const blockState = (t, key, live) => {
  const b = BLOCK_OF[key]; const x = t[key];
  if (x.status === NA) return { status: NA, tone: 'na', ok: true };
  if (key === 'content' && has(x.kitId)) {
    const k = live?.kits ? live.kits[x.kitId] : undefined;
    if (live?.kits && !k) return { status: 'الحقيبة غير متاحة', tone: 'red', ok: false, gone: true };
    const approved = k?.status === 'approved';
    return { status: approved ? b.attached : b.pending, tone: approved ? 'ok' : 'wait', ok: true, linked: k || null };
  }
  if (key === 'finance' && has(x.requestId)) {
    const r = live?.finance ? live.finance[x.requestId] : undefined;
    if (live?.finance && !r) return { status: 'الطلب غير متاح', tone: 'red', ok: false, gone: true };
    const approved = r?.status === 'approved';
    return { status: approved ? b.attached : b.pending, tone: approved ? 'ok' : 'wait', ok: true, linked: r || null };
  }
  if (key === 'media' || key === 'volunteer') {
    const f = x.form;
    const started = key === 'media' ? mediaStarted(f) : volunteerStarted(f);
    if (started) {
      const miss = key === 'media' ? mediaMissing(f) : volunteerMissing(f);
      return { status: miss.length ? b.pending : b.attached, tone: miss.length ? 'wait' : 'ok', ok: !miss.length, form: true, missing: miss };
    }
  }
  // Older plans (statuses were typed): a status with an uploaded file or
  // a link, or a "not attached yet" status, still stands — an "attached"
  // status without any proof did not count then either.
  if (legacyProof(x)) {
    const st = has(x.status) ? x.status : b.attached;
    return { status: st, tone: /^مرفق/.test(st) ? 'ok' : 'wait', ok: true, legacy: true };
  }
  if (has(x.status)) return { status: x.status, tone: /^مرفق/.test(x.status) ? 'none' : 'wait', ok: !/^مرفق/.test(x.status), legacy: true };
  return { status: '', tone: 'none', ok: false };
};
