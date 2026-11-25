// Workspace registration rules (public /workspace page): FabLab's 8
// workspaces, the daily window (10:00–17:00), a booking of at most one
// month on working days, and the overlap test between two bookings.

const UNITS = Array.from({ length: 8 }, (_, i) => ({
  code: `WS${i + 1}`,
  label: `مساحة العمل ${i + 1}`,
  labelEn: `Workspace ${i + 1}`
}));
const UNIT_CODES = UNITS.map(u => u.code);
const HOURS = { start: '10:00', end: '17:00' };
const MAX_MONTHS = 1;
const MAX_DAYS_AHEAD = 90;            // how far ahead a booking may start
const HOLDS = ['pending', 'approved']; // requests that keep their workspace
const APPLICANT_TYPES = {
  Beneficiary: 'مستفيد',
  Talented: 'موهوب',
  Visitor: 'زائر',
  Entity: 'جهة'
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):(00|30)$/;

// Today in Riyadh as YYYY-MM-DD.
const riyadhToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date());

const _utc = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const _ymd = (dt) => dt.toISOString().slice(0, 10);
const addDays = (ymd, n) => { const d = _utc(ymd); d.setUTCDate(d.getUTCDate() + n); return _ymd(d); };
// One calendar month later (31 Jan → 28/29 Feb).
const addMonths = (ymd, n) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return _ymd(new Date(Date.UTC(y, m - 1 + n, Math.min(d, last))));
};
const validDate = (s) => DATE_RE.test(s || '') && _ymd(_utc(s)) === s;

// Working days (0 = Sunday) inside [from, to].
function workingDaysIn(from, to, workingDays) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (workingDays.includes(_utc(d).getUTCDay())) out.push(d);
  }
  return out;
}

class BookingError extends Error {
  constructor(message, messageAr, field = null, code = 'INVALID_PERIOD') {
    super(message); this.messageAr = messageAr; this.field = field; this.code = code; this.status = 400;
  }
}

// Checks a period + daily time (throws BookingError). Returns the working days.
function checkPeriod({ startDate, endDate, startTime, endTime }, workingDays) {
  const today = riyadhToday();
  if (!validDate(startDate)) throw new BookingError('Pick a start date', 'اختر تاريخ البداية', 'startDate');
  if (!validDate(endDate)) throw new BookingError('Pick an end date', 'اختر تاريخ النهاية', 'endDate');
  if (startDate < today) throw new BookingError('The start date has passed', 'تاريخ البداية مضى', 'startDate');
  if (startDate > addDays(today, MAX_DAYS_AHEAD)) {
    throw new BookingError(`Bookings open up to ${MAX_DAYS_AHEAD} days ahead`, `يمكن الحجز قبل ${MAX_DAYS_AHEAD} يومًا كحد أقصى`, 'startDate');
  }
  if (endDate < startDate) throw new BookingError('The end date is before the start date', 'تاريخ النهاية قبل تاريخ البداية', 'endDate');
  if (endDate > addMonths(startDate, MAX_MONTHS)) {
    throw new BookingError('A booking can last one month at most', 'لا تتجاوز مدة الحجز شهرًا واحدًا', 'endDate');
  }
  if (!TIME_RE.test(startTime || '') || !TIME_RE.test(endTime || '')) {
    throw new BookingError('Pick the daily times', 'اختر وقت البداية والنهاية', 'startTime');
  }
  if (startTime < HOURS.start || endTime > HOURS.end) {
    throw new BookingError(`Times must be within ${HOURS.start}–${HOURS.end}`, `الوقت يجب أن يكون بين ${HOURS.start} و ${HOURS.end}`, 'startTime');
  }
  if (endTime <= startTime) throw new BookingError('The end time must be after the start time', 'وقت النهاية يجب أن يكون بعد وقت البداية', 'endTime');
  const days = workingDaysIn(startDate, endDate, workingDays);
  if (!days.length) throw new BookingError('The period has no FabLab working days', 'الفترة لا تتضمن أيام عمل فاب لاب', 'startDate');
  return days;
}

// Do two bookings share a working day and a time?
function overlaps(a, b, workingDays) {
  if (a.startTime >= b.endTime || b.startTime >= a.endTime) return false;
  const from = a.startDate > b.startDate ? a.startDate : b.startDate;
  const to = a.endDate < b.endDate ? a.endDate : b.endDate;
  if (from > to) return false;
  return workingDaysIn(from, to, workingDays).length > 0;
}

module.exports = {
  UNITS, UNIT_CODES, HOURS, MAX_MONTHS, MAX_DAYS_AHEAD, HOLDS, APPLICANT_TYPES,
  BookingError, checkPeriod, overlaps, workingDaysIn, riyadhToday, addMonths, addDays
};
