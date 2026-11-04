// Workshop request (طلب ورشة) data model — a workshop built from one of
// the employee's approved training kits: the fields the editor fills, the
// checks before sending, and the change comparison between versions. The
// manager's approval turns it into a real workshop (server: onApproved).
import { uid, has, num, getPath, setPath, fmtKitNo } from '../../TrainingKits/kitModel';

export { uid, has, num, getPath, setPath };
export const idOf = (p) => `wrf-${p.replace(/\./g, '-')}`;
export const fmtWrNo = (n) => (n == null ? 'WR-—' : `WR-${String(n).padStart(3, '0')}`);

export const blankState = () => ({
  v: 1,
  // The approved kit the workshop comes from.
  kit: { kitId: '', kitNo: '', kitTitle: '', approvedVersion: '' },
  // The kit's own numbers, kept for hints (duration, seats).
  kitHint: { days: '', hours: '', partMin: '', partMax: '' },
  title: '',
  description: '',
  objectives: '',
  content: '',
  presenter: '',
  cover: null, // { fileId, name, size, mime }
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  totalHours: '',
  room: '',
  maxParticipants: '',
  minAge: '',
  maxAge: '',
  price: '',
  isPublic: true,
  // Optional: the execution-plan target this workshop delivers.
  plan: { planId: '', planNo: '', planTitle: '', targetId: '', targetName: '' },
  notes: ''
});

const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

export const normalize = (d) => {
  const b = blankState();
  const x = obj(d);
  const s = { ...b, ...x };
  s.kit = { ...b.kit, ...obj(x.kit) };
  s.kitHint = { ...b.kitHint, ...obj(x.kitHint) };
  s.plan = { ...b.plan, ...obj(x.plan) };
  s.cover = x.cover && typeof x.cover === 'object' && x.cover.fileId ? x.cover : null;
  s.isPublic = x.isPublic !== false;
  return s;
};

// The kit's approved version (what the request is built from).
export const kitData = (kit) => {
  const v = (kit?.versions || []).find(x => x.versionNumber === kit.approvedVersion);
  return (v && v.data) || kit?.data || {};
};

// Copies what the kit already says into the request (title, description,
// objectives, outline, ages, seats, hours) — used for a new request and
// for «تحديث من الحقيبة».
export const fillFromKit = (s, kd) => {
  const c = obj(kd?.card);
  const objectives = (Array.isArray(c.objectives) ? c.objectives : []).map(o => String(o?.text || '').trim()).filter(Boolean);
  const days = (Array.isArray(kd?.plan) ? kd.plan : []).filter(p => has(p?.learn) || has(p?.topics));
  s.title = c.name || s.title;
  s.description = c.description || s.description;
  if (objectives.length) s.objectives = objectives.map((t, i) => `${i + 1}. ${t}`).join('\n');
  if (days.length) s.content = days.map((p, i) => `اليوم ${i + 1}: ${[p.learn, p.topics].filter(has).join(' — ')}`).join('\n');
  if (has(c.ageMin)) s.minAge = c.ageMin;
  if (has(c.ageMax)) s.maxAge = c.ageMax;
  if (has(c.partMax)) s.maxParticipants = c.partMax;
  const d = num(c.days); const h = num(c.hours);
  if (d && h) s.totalHours = d * h;
  s.kitHint = { days: c.days ?? '', hours: c.hours ?? '', partMin: c.partMin ?? '', partMax: c.partMax ?? '' };
  return s;
};

// A new request from an approved kit (full kit object with versions).
export const newWorkshopRequestData = (kit, employee) => {
  const s = blankState();
  s.kit = {
    kitId: kit.id || kit.kitId,
    kitNo: fmtKitNo(kit.number != null ? kit.number : kit.kitNumber),
    kitTitle: kit.title || '',
    approvedVersion: kit.approvedVersion || ''
  };
  fillFromKit(s, kitData(kit));
  s.presenter = employee?.name || '';
  return s;
};

// ─────────────── Derived numbers ───────────────

const minutes = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
export const spanDays = (a, b) => {
  if (!has(a)) return null;
  const x = new Date(`${a}T12:00:00`); const y = new Date(`${has(b) ? b : a}T12:00:00`);
  if (Number.isNaN(x.getTime()) || Number.isNaN(y.getTime()) || y < x) return null;
  return Math.round((y - x) / 86400000) + 1;
};
export const derive = (s) => {
  const days = spanDays(s.startDate, s.endDate);
  const a = minutes(s.startTime); const b = minutes(s.endTime);
  const daily = a != null && b != null && b > a ? (b - a) / 60 : null;
  return { days, daily, suggested: days && daily ? Math.round(days * daily * 100) / 100 : null };
};
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// '16:30' → '4:30 م'
export const fmtTime = (t) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ''));
  if (!m) return '';
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? 'ص' : 'م'}`;
};

// ─────────────── Completeness ───────────────

export const SECTIONS = [
  { key: 'kit', id: 'wr-s1', n: '1', t: 'الحقيبة المعتمدة' },
  { key: 'info', id: 'wr-s2', n: '2', t: 'بيانات الورشة' },
  { key: 'schedule', id: 'wr-s3', n: '3', t: 'الموعد والمكان' },
  { key: 'reg', id: 'wr-s4', n: '4', t: 'التسجيل' },
  { key: 'plan', id: 'wr-s5', n: '5', t: 'الخطة التنفيذية' },
  { key: 'done', id: 'wr-s6', n: '6', t: 'الملاحظات والإرسال' }
];

export const analyze = (s) => {
  const sec = {}; const issues = [];
  const chk = (k, ok, text, target) => {
    const x = sec[k] || (sec[k] = { done: 0, total: 0 });
    x.total++;
    if (ok) x.done++; else issues.push({ sec: k, text, target });
  };
  chk('kit', has(s.kit.kitId), 'اختر الحقيبة التدريبية المعتمدة التي تُبنى عليها الورشة', 'wr-s1');

  [['title', 'عنوان الورشة'], ['presenter', 'المقدم / المدرب'], ['description', 'وصف الورشة'], ['objectives', 'أهداف الورشة'], ['content', 'محتوى الورشة ومحاورها']]
    .forEach(([k, l]) => chk('info', has(s[k]), `أكمل «${l}»`, idOf(k)));
  chk('info', !!s.cover, 'أضف صورة غلاف للورشة — تظهر في صفحة التسجيل', 'wr-cover');

  const D = derive(s);
  chk('schedule', has(s.startDate), 'حدد تاريخ بداية الورشة', idOf('startDate'));
  if (has(s.startDate) && s.startDate < todayISO()) chk('schedule', false, 'تاريخ بداية الورشة في الماضي', idOf('startDate'));
  chk('schedule', has(s.endDate), 'حدد تاريخ نهاية الورشة (أو نفس يوم البداية)', idOf('endDate'));
  if (has(s.startDate) && has(s.endDate) && s.endDate < s.startDate) chk('schedule', false, 'تاريخ النهاية قبل تاريخ البداية', idOf('endDate'));
  chk('schedule', has(s.startTime) && has(s.endTime), 'حدد وقت البداية والنهاية اليومي', idOf(has(s.startTime) ? 'endTime' : 'startTime'));
  if (has(s.startTime) && has(s.endTime) && D.daily == null) chk('schedule', false, 'وقت النهاية يجب أن يكون بعد وقت البداية', idOf('endTime'));
  chk('schedule', num(s.totalHours) > 0, 'حدد إجمالي ساعات الورشة', idOf('totalHours'));
  chk('schedule', has(s.room), 'حدد مكان الورشة أو القاعة', idOf('room'));

  chk('reg', num(s.maxParticipants) >= 1, 'حدد عدد المقاعد المتاحة', idOf('maxParticipants'));
  chk('reg', num(s.price) != null && num(s.price) >= 0, 'حدد رسوم التسجيل (0 للورشة المجانية)', idOf('price'));
  if (num(s.minAge) != null && num(s.maxAge) != null && num(s.minAge) > num(s.maxAge)) chk('reg', false, 'الحد الأدنى للعمر أكبر من الحد الأعلى', idOf('minAge'));

  let done = 0; let total = 0;
  Object.keys(sec).forEach(k => { done += sec[k].done; total += sec[k].total; });
  return { sec, issues, pct: total ? Math.floor((done / total) * 100) : 0 };
};

// ─────────────── Change comparison (edit history) ───────────────

const short = (v) => (typeof v === 'boolean' ? (v ? 'نعم' : 'لا') : String(v == null ? '' : v));

export const flatten = (raw) => {
  const s = normalize(raw);
  const out = [];
  const put = (key, label, value) => out.push([key, label, short(value)]);
  put('kit', 'الحقيبة المعتمدة', has(s.kit.kitId) ? `${s.kit.kitNo} ${s.kit.kitTitle}`.trim() : '');
  [['title', 'عنوان الورشة'], ['presenter', 'المقدم / المدرب'], ['description', 'وصف الورشة'], ['objectives', 'أهداف الورشة'], ['content', 'محتوى الورشة'],
    ['startDate', 'تاريخ البداية'], ['endDate', 'تاريخ النهاية'], ['startTime', 'وقت البداية'], ['endTime', 'وقت النهاية'], ['totalHours', 'إجمالي الساعات'],
    ['room', 'المكان / القاعة'], ['maxParticipants', 'عدد المقاعد'], ['minAge', 'الحد الأدنى للعمر'], ['maxAge', 'الحد الأعلى للعمر'], ['price', 'رسوم التسجيل'], ['notes', 'ملاحظات']]
    .forEach(([k, l]) => put(k, l, s[k]));
  put('isPublic', 'الظهور', s.isPublic ? 'عامة في صفحة التسجيل' : 'خاصة برابط مباشر');
  put('cover', 'صورة الغلاف', s.cover ? s.cover.name || 'صورة' : '');
  put('plan', 'الخطة التنفيذية', has(s.plan.planId) ? `${s.plan.planNo} — ${s.plan.targetName || ''}` : '');
  return out;
};

export const diffData = (prev, next) => {
  const a = new Map(flatten(prev).map(([k, l, v]) => [k, { l, v }]));
  const changes = [];
  flatten(next).forEach(([k, l, v]) => {
    const old = a.get(k);
    const ov = old ? old.v : '';
    if (ov !== v) changes.push({ label: l, before: ov, after: v, kind: ov.trim() ? (v.trim() ? 'changed' : 'removed') : 'added' });
  });
  return changes;
};
