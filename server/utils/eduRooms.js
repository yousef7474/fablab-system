// FabLab rooms a teacher can pick when registering through an education
// workshop link, and the overlap rule: a room picked for one education
// workshop is unavailable to every other education workshop whose dates
// AND daily times overlap it.
const EDU_ROOMS = [
  { id: 'digital',  ar: 'قاعة الديجتال',  en: 'Digital Hall' },
  { id: 'future',   ar: 'قاعة المستقبل', en: 'Future Hall' },
  { id: 'alrashed', ar: 'قاعة الراشد',   en: 'Al-Rashed Hall' }
];

const roomById = (id) => EDU_ROOMS.find(r => r.id === id) || null;
// The admin can also type a room on the workshop itself (free text).
const roomByName = (name) => {
  const n = String(name || '').trim();
  return EDU_ROOMS.find(r => r.ar === n || r.en.toLowerCase() === n.toLowerCase()) || null;
};

const _hhmm = (t) => (t ? String(t).slice(0, 5) : '');

// Same days and same hours? Missing times count as the whole day.
const workshopsOverlap = (a, b) => {
  const aStart = String(a.startDate || '').slice(0, 10);
  const aEnd = String(a.endDate || a.startDate || '').slice(0, 10);
  const bStart = String(b.startDate || '').slice(0, 10);
  const bEnd = String(b.endDate || b.startDate || '').slice(0, 10);
  if (!aStart || !bStart || aStart > bEnd || bStart > aEnd) return false;
  const as = _hhmm(a.startTime), ae = _hhmm(a.endTime), bs = _hhmm(b.startTime), be = _hhmm(b.endTime);
  if (!as || !ae || !bs || !be) return true;
  return as < be && bs < ae;
};

// Workshop registration (every workshop, not only education) closes 24
// hours before the start (start date + start time, Riyadh = UTC+3, no
// DST) unless the admin opens it as an exception.
const EDU_DEADLINE_HOURS = 24;
const eduDeadline = (w) => {
  if (!w || !w.startDate) return null;
  const t = _hhmm(w.startTime) || '00:00';
  const start = Date.parse(`${String(w.startDate).slice(0, 10)}T${t}:00+03:00`);
  return Number.isNaN(start) ? null : new Date(start - EDU_DEADLINE_HOURS * 3600 * 1000);
};

module.exports = { EDU_ROOMS, roomById, roomByName, workshopsOverlap, eduDeadline, EDU_DEADLINE_HOURS };
