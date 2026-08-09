// Unified attendance history export — aggregates every attendance
// source (volunteers, staff, trainers, interns, mawhba, summer,
// workshop students) into one Excel-friendly TSV keyed by date range.
//
// Response is UTF-16 LE with BOM so Excel opens Arabic column
// headers + names correctly. Same encoding the volunteer attendance
// export uses.

const { Op } = require('sequelize');
const {
  Volunteer, VolunteerAttendance,
  FablabStaff, FablabStaffAttendance,
  TrainerAssistant, TrainerAssistantAttendance,
  Intern, InternAttendance,
  MawhbaStudent, MawhbaAttendance,
  SummerStudent, SummerStudentAttendance, SummerProgram,
  WorkshopStudent, Workshop
} = require('../models');

// ---- helpers ---------------------------------------------------

const _isoDate = (v) => {
  if (!v) return '';
  if (typeof v === 'string') return v.slice(0, 10);
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  return '';
};

const _riyadhTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Riyadh',
  hour12: false,
  hour: '2-digit', minute: '2-digit', second: '2-digit'
});
const _fmtTime = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return _riyadhTimeFmt.format(dt).replace(/^24:/, '00:');
};

// Duration in minutes; empty string when either side is missing.
const _durationMin = (inAt, outAt) => {
  if (!inAt || !outAt) return '';
  const a = new Date(inAt).getTime();
  const b = new Date(outAt).getTime();
  if (isNaN(a) || isNaN(b) || b <= a) return '';
  return Math.round((b - a) / 60000);
};

const _cell = (v) => String(v ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ');

// Build a where clause for a plain DATEONLY column bounded by from / to
const _dateWhere = (col, from, to) => {
  const w = {};
  if (from && to) w[col] = { [Op.between]: [from, to] };
  else if (from) w[col] = { [Op.gte]: from };
  else if (to)   w[col] = { [Op.lte]: to };
  return w;
};

// ---- aggregators -----------------------------------------------

const _volunteerRows = async (from, to) => {
  const records = await VolunteerAttendance.findAll({
    where: _dateWhere('date', from, to),
    include: [{ model: Volunteer, as: 'volunteer', required: false }],
    order: [['date', 'ASC'], ['checkInAt', 'ASC']]
  });
  return records.map(r => {
    const v = r.volunteer || {};
    return {
      category: 'المتطوعون',
      group: '—',
      name: v.name || '',
      nationalId: v.nationalId || '',
      phone: v.phone || '',
      date: _isoDate(r.date),
      checkIn: _fmtTime(r.checkInAt),
      checkOut: _fmtTime(r.checkOutAt),
      durationMin: _durationMin(r.checkInAt, r.checkOutAt)
    };
  });
};

const _staffRows = async (from, to) => {
  const records = await FablabStaffAttendance.findAll({
    where: _dateWhere('date', from, to),
    include: [{ model: FablabStaff, as: 'staff', required: false }],
    order: [['date', 'ASC'], ['checkInAt', 'ASC']]
  });
  return records.map(r => {
    const st = r.staff || {};
    return {
      category: 'موظفو فاب لاب',
      group: st.position || '—',
      name: st.name || '',
      nationalId: st.nationalId || '',
      phone: st.phone || '',
      date: _isoDate(r.date),
      checkIn: _fmtTime(r.checkInAt),
      checkOut: _fmtTime(r.checkOutAt),
      durationMin: _durationMin(r.checkInAt, r.checkOutAt)
    };
  });
};

const _trainerRows = async (from, to) => {
  const records = await TrainerAssistantAttendance.findAll({
    where: _dateWhere('date', from, to),
    include: [{ model: TrainerAssistant, as: 'trainer', required: false }],
    order: [['date', 'ASC'], ['checkInAt', 'ASC']]
  });
  return records.map(r => {
    const t = r.trainer || {};
    return {
      category: 'المدربون المعاونون',
      group: '—',
      name: t.name || '',
      nationalId: t.nationalId || '',
      phone: t.phone || '',
      date: _isoDate(r.date),
      checkIn: _fmtTime(r.checkInAt),
      checkOut: _fmtTime(r.checkOutAt),
      durationMin: _durationMin(r.checkInAt, r.checkOutAt)
    };
  });
};

const _internRows = async (from, to) => {
  try {
    const records = await InternAttendance.findAll({
      where: _dateWhere('date', from, to),
      include: [{ model: Intern, as: 'intern', required: false }],
      order: [['date', 'ASC'], ['checkInAt', 'ASC']]
    });
    return records.map(r => {
      const i = r.intern || {};
      return {
        category: 'التدريب الجامعي',
        group: i.university || '—',
        name: i.name || '',
        nationalId: i.nationalId || '',
        phone: i.phone || '',
        date: _isoDate(r.date),
        checkIn: _fmtTime(r.checkInAt),
        checkOut: _fmtTime(r.checkOutAt),
        durationMin: _durationMin(r.checkInAt, r.checkOutAt)
      };
    });
  } catch (e) {
    // Association missing / model mismatch → skip silently rather
    // than fail the whole export.
    console.warn('intern attendance export skipped:', e.message);
    return [];
  }
};

const _mawhbaRows = async (from, to) => {
  try {
    const records = await MawhbaAttendance.findAll({
      where: _dateWhere('date', from, to),
      include: [{ model: MawhbaStudent, as: 'student', required: false }],
      order: [['date', 'ASC'], ['checkInAt', 'ASC']]
    });
    return records.map(r => {
      const st = r.student || {};
      return {
        category: 'موهبة',
        group: st.courseName || st.course || '—',
        name: st.fullName || st.name || '',
        nationalId: st.nationalId || '',
        phone: st.phoneNumber || st.phone || '',
        date: _isoDate(r.date),
        checkIn: _fmtTime(r.checkInAt),
        checkOut: _fmtTime(r.checkOutAt),
        durationMin: _durationMin(r.checkInAt, r.checkOutAt)
      };
    });
  } catch (e) {
    console.warn('mawhba attendance export skipped:', e.message);
    return [];
  }
};

const _summerRows = async (from, to) => {
  try {
    const records = await SummerStudentAttendance.findAll({
      where: _dateWhere('date', from, to),
      include: [{
        model: SummerStudent,
        as: 'student',
        required: false,
        include: [{ model: SummerProgram, as: 'program', required: false }]
      }],
      order: [['date', 'ASC'], ['checkInAt', 'ASC']]
    });
    return records.map(r => {
      const st = r.student || {};
      const prog = st.program;
      return {
        category: 'صيف فاب لاب',
        group: prog?.name || '—',
        name: st.name || '',
        nationalId: st.nationalId || '',
        phone: st.phone || '',
        date: _isoDate(r.date),
        checkIn: _fmtTime(r.checkInAt),
        checkOut: _fmtTime(r.checkOutAt),
        durationMin: _durationMin(r.checkInAt, r.checkOutAt)
      };
    });
  } catch (e) {
    console.warn('summer attendance export skipped:', e.message);
    return [];
  }
};

// Workshop students store scans as a JSON array inside the student
// row. Filter each student's scans by the date range and shape.
const _workshopRows = async (from, to) => {
  const students = await WorkshopStudent.findAll({
    include: [{ model: Workshop, as: 'workshop', required: false }]
  });
  const out = [];
  for (const s of students) {
    const scans = Array.isArray(s.attendanceScans) ? s.attendanceScans : [];
    for (const scan of scans) {
      const d = _isoDate(scan?.date);
      if (!d) continue;
      if (from && d < from) continue;
      if (to && d > to) continue;
      const inAt = scan.checkInAt || scan.scannedAt || null;
      const outAt = scan.checkOutAt || null;
      out.push({
        category: 'طلاب الورش',
        group: s.workshop?.title || '—',
        name: `${s.firstName || ''} ${s.lastName || ''}`.trim(),
        nationalId: s.nationalId || '',
        phone: s.phone || '',
        date: d,
        checkIn: _fmtTime(inAt),
        checkOut: _fmtTime(outAt),
        durationMin: _durationMin(inAt, outAt)
      });
    }
  }
  return out;
};

// ---- endpoint ---------------------------------------------------

// GET /api/attendance/report?from=YYYY-MM-DD&to=YYYY-MM-DD
//                         &categories=volunteer,staff,workshop,...
// Streams a UTF-16 LE + BOM TSV that Excel opens directly.
exports.exportUnifiedAttendance = async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from && !to) {
      return res.status(400).json({ message: 'from and/or to required' });
    }
    if (from && !/^\d{4}-\d{2}-\d{2}$/.test(String(from))) {
      return res.status(400).json({ message: 'invalid from date' });
    }
    if (to && !/^\d{4}-\d{2}-\d{2}$/.test(String(to))) {
      return res.status(400).json({ message: 'invalid to date' });
    }

    const wanted = (String(req.query.categories || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean));
    const pick = (name) => wanted.length === 0 || wanted.includes(name);

    const tasks = [];
    if (pick('volunteer')) tasks.push(_volunteerRows(from, to));
    if (pick('staff'))     tasks.push(_staffRows(from, to));
    if (pick('trainer'))   tasks.push(_trainerRows(from, to));
    if (pick('intern'))    tasks.push(_internRows(from, to));
    if (pick('mawhba'))    tasks.push(_mawhbaRows(from, to));
    if (pick('summer'))    tasks.push(_summerRows(from, to));
    if (pick('workshop'))  tasks.push(_workshopRows(from, to));

    const results = await Promise.all(tasks);
    const rows = results.flat();

    // Stable multi-key sort: category → date → name
    rows.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category, 'ar');
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.name || '').localeCompare(b.name || '', 'ar');
    });

    const header = [
      'النوع', 'المجموعة', 'الاسم', 'رقم الهوية', 'الجوال',
      'التاريخ', 'وقت الدخول', 'وقت الخروج', 'المدة (دقيقة)', 'المدة (ساعة)'
    ];
    const lines = [header.join('\t')];
    for (const r of rows) {
      const mins = r.durationMin === '' ? '' : r.durationMin;
      const hours = r.durationMin === '' ? '' : (r.durationMin / 60).toFixed(2);
      lines.push([
        r.category, r.group, r.name, r.nationalId, r.phone,
        r.date, r.checkIn, r.checkOut, mins, hours
      ].map(_cell).join('\t'));
    }
    if (rows.length === 0) {
      lines.push(['— لا توجد سجلات في هذه الفترة —', '', '', '', '', '', '', '', '', ''].join('\t'));
    }

    const text = lines.join('\r\n');
    const bom = Buffer.from([0xFF, 0xFE]);
    const body = Buffer.from(text, 'utf16le');
    const out = Buffer.concat([bom, body]);

    const fname = `attendance-report_${from || 'all'}_to_${to || 'now'}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-16le');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.send(out);
  } catch (err) {
    console.error('exportUnifiedAttendance error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
