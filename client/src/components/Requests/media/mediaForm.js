// «نموذج اعتماد طلب تصميم إعلان ( لقسم ، ورشة ، برامج )» — the media
// design request form (المتطلبات الإعلامية). One definition for the media
// design request (Requests/media) and the form embedded in older plan
// targets (ExecutionPlans/planFiles.js re-exports it), so a filled plan
// form converts 1:1 into a request. Mirrors server/utils/mediaFormDoc.js.
import { uid, has, num } from '../../TrainingKits/kitModel';

export const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const DAY_PARTS = ['صباحًا', 'مساءً'];
export const GENDERS = ['أولاد', 'بنات', 'مختلط'];
export const URGENCY = ['مستعجل', 'غير مستعجل'];
export const MEDIA_MIN_IMAGES = 3;

// The reviewers named on the paper form.
export const MEDIA_SIGNERS = [
  { role: 'تم تأكيد المحتوى العلمي من: مدير البرامج والمشاريع', name: 'م. نوف بوعبيد' },
  { role: 'الإعلام', name: 'أ. دانة الدوسري' },
  { role: 'مشاريع المؤسسة', name: 'أ. لولوة عادل' }
];
export const MEDIA_EXEC = { role: 'المسؤول التنفيذي', name: 'أ. زكي اللويم' };

export const makeAxis = () => ({ id: uid(), title: '', desc: '' });
export const makeMedia = () => ({
  activity: '', implementer: '', ageMin: '', ageMax: '', timeFrom: '', timeTo: '', dayPart: '',
  dateFrom: '', dateTo: '', beneficiaries: '', seatsNote: '', days: '', gender: '',
  axes: [makeAxis()], images: [], dueDate: '', urgency: '', cost: '', notes: ''
});

const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const fileRef = (f) => (f && typeof f === 'object' && f.fileId ? { fileId: f.fileId, name: f.name || '', size: f.size || 0, mime: f.mime || '', caption: f.caption || '' } : null);

export const normalizeMedia = (raw) => {
  const b = makeMedia(); const f = obj(raw);
  const x = { ...b, ...f };
  x.axes = Array.isArray(f.axes) ? f.axes.map(a => ({ ...makeAxis(), ...obj(a) })) : b.axes;
  x.images = (Array.isArray(f.images) ? f.images : []).map(fileRef).filter(Boolean);
  return x;
};

const parseDay = (d) => { const x = new Date(`${String(d).slice(0, 10)}T12:00:00`); return Number.isNaN(x.getTime()) ? null : x; };
export const weekdayOf = (d) => { const x = has(d) ? parseDay(d) : null; return x ? WEEKDAYS[x.getDay()] : ''; };

// What the form still misses: [{ label, path }]. `base` is where the form
// sits in the document ('media.form' in a plan target, 'form' in a request).
export const mediaMissing = (f, base = 'media.form') => {
  const miss = [];
  const need = (ok, label, k) => { if (!ok) miss.push({ label, path: `${base}.${k}` }); };
  need(has(f.activity), 'اسم النشاط', 'activity');
  need(has(f.implementer), 'اسم المنفذ', 'implementer');
  need(has(f.ageMin) && has(f.ageMax), 'العمر المستهدف', 'ageMin');
  if (num(f.ageMin) != null && num(f.ageMax) != null && num(f.ageMin) > num(f.ageMax)) need(false, 'العمر: الحد الأدنى أكبر من الأعلى', 'ageMin');
  need(has(f.timeFrom) && has(f.timeTo), 'الفترة الزمنية', 'timeFrom');
  need(has(f.dayPart), 'صباحًا أو مساءً', 'dayPart');
  need(has(f.dateFrom) && has(f.dateTo), 'تاريخ النشاط', 'dateFrom');
  if (has(f.dateFrom) && has(f.dateTo) && f.dateTo < f.dateFrom) need(false, 'تاريخ النهاية قبل البداية', 'dateTo');
  need(num(f.beneficiaries) > 0, 'عدد المستفيدين', 'beneficiaries');
  need(has(f.days), 'عدد الأيام الفعلية', 'days');
  need(has(f.gender), 'الفئة المستهدفة', 'gender');
  need(f.axes.some(a => has(a.title)), 'المحاور', 'axes.0.title');
  need(f.images.length >= MEDIA_MIN_IMAGES, `${MEDIA_MIN_IMAGES} صور على الأقل`, 'images');
  need(has(f.dueDate), 'تاريخ انتهاء التصميم', 'dueDate');
  need(has(f.urgency), 'مستعجل أو غير مستعجل', 'urgency');
  need(has(f.cost), 'تكلفة البرنامج', 'cost');
  return miss;
};

export const mediaStarted = (f) => ['activity', 'implementer', 'ageMin', 'ageMax', 'timeFrom', 'timeTo', 'dayPart', 'dateFrom', 'dateTo', 'beneficiaries', 'seatsNote', 'days', 'gender', 'dueDate', 'urgency', 'cost', 'notes']
  .some(k => has(f[k])) || f.images.length > 0 || f.axes.some(a => has(a.title) || has(a.desc));

// Field labels — the version diff and read-only views.
export const MEDIA_FIELDS = [
  ['activity', 'اسم النشاط'], ['implementer', 'اسم المنفذ'], ['ageMin', 'العمر من'], ['ageMax', 'العمر إلى'],
  ['timeFrom', 'من الساعة'], ['timeTo', 'إلى الساعة'], ['dayPart', 'صباحًا / مساءً'], ['dateFrom', 'من تاريخ'], ['dateTo', 'إلى تاريخ'],
  ['beneficiaries', 'عدد المستفيدين'], ['seatsNote', 'توزيع المقاعد'], ['days', 'عدد الأيام الفعلية'], ['gender', 'الفئة المستهدفة'],
  ['dueDate', 'تاريخ انتهاء التصميم'], ['urgency', 'الاستعجال'], ['cost', 'تكلفة البرنامج'], ['notes', 'ملاحظات للتصميم']
];
