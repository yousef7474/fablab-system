const { Op } = require('sequelize');
const QRCode = require('qrcode');
const {
  SummerStudent,
  SummerProgram,
  SummerStudentAttendance
} = require('../models');
const { getActiveSeasonId } = require('./summerSeasonController');

// FabLab section → theme color mapping (mirrors the palette used across
// the admin panel so the Summer ID card feels consistent with the rest
// of the system).
const SECTION_COLORS = {
  'Electronics and Programming': '#6366f1',
  'CNC Laser':                   '#22c55e',
  'CNC Wood':                    '#f59e0b',
  'CNC Metal':                   '#64748b',
  '3D':                          '#ef4444',
  'Robotic and AI':              '#8b5cf6',
  "Kid's Club":                  '#06b6d4',
  'Vinyl Cutting':               '#ec4899',
  'UV Printing and Sticker Making': '#14b8a6'
};
const DEFAULT_SECTION_COLOR = '#f97316'; // Summer FabLab orange

const darken = (hex, amount = 0.55) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#0f172a';
  const n = parseInt(m[1], 16);
  const r = Math.max(0, Math.round(((n >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((n >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((n & 0xff) * (1 - amount)));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
};

// A per-program `color` (admin-picked) beats the fablabSection default —
// so a Kids' Club program the admin colored magenta prints magenta cards,
// not the standard section teal.
const isHexColor = (s) => typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s.trim());
const colorForProgram = (program) => {
  if (!program) return DEFAULT_SECTION_COLOR;
  if (isHexColor(program.color)) return program.color;
  return SECTION_COLORS[program.fablabSection] || DEFAULT_SECTION_COLOR;
};

// Riyadh-local YYYY-MM-DD so the attendance day rolls over at Riyadh
// midnight regardless of the server's TZ (matches the Mawhba flow).
const todayStr = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const d = parts.find(p => p.type === 'day').value;
  return `${y}-${m}-${d}`;
};

const riyadhTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Riyadh',
  hour12: false,
  hour: '2-digit', minute: '2-digit', second: '2-digit'
});
const fmtTime = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return riyadhTimeFmt.format(dt).replace(/^24:/, '00:');
};

// ─── CRUD ───────────────────────────────────────────────────────────

exports.list = async (req, res) => {
  try {
    const where = { isActive: true };
    if (req.query.programId) where.programId = req.query.programId;
    const q = String(req.query.season || '').trim();
    if (q && q !== 'all') {
      where.seasonId = q;
    } else if (q !== 'all' && !req.query.programId) {
      // Only auto-scope by active season when the caller isn't already
      // narrowing to a specific program (which itself belongs to a season).
      const active = await getActiveSeasonId();
      if (active) where.seasonId = active;
    }
    const students = await SummerStudent.findAll({
      where,
      include: [
        { model: SummerProgram, as: 'program', attributes: ['programId', 'name', 'startDate', 'endDate', 'fablabSection'] }
      ],
      order: [['name', 'ASC']]
    });
    res.json(students);
  } catch (err) {
    console.error('Error listing summer students:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const { programId, name, nationalId, phone, email, age, gender, notes } = req.body || {};
    if (!programId || !name) {
      return res.status(400).json({ message: 'programId and name are required', messageAr: 'البرنامج والاسم مطلوبان' });
    }
    // Inherit the season from the parent program if we can, so a
     // student never lands in a different season from their program.
    let seasonId = req.body.seasonId || null;
    if (!seasonId && programId) {
      const p = await SummerProgram.findByPk(programId, { attributes: ['seasonId'] });
      seasonId = p?.seasonId || null;
    }
    if (!seasonId) seasonId = await getActiveSeasonId();

    const student = await SummerStudent.create({
      programId,
      name,
      nationalId: nationalId || null,
      phone: phone || null,
      email: email || null,
      age: age != null && age !== '' ? Number(age) : null,
      gender: gender || null,
      notes: notes || null,
      createdById: req.admin?.adminId || null,
      seasonId
    });
    res.status(201).json(student);
  } catch (err) {
    console.error('Error creating summer student:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const student = await SummerStudent.findByPk(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const fields = ['name', 'nationalId', 'phone', 'email', 'age', 'gender', 'notes', 'programId', 'attendanceDays'];
    const patch = {};
    for (const f of fields) {
      if (req.body[f] !== undefined) patch[f] = req.body[f];
    }
    if (patch.age != null && patch.age !== '') patch.age = Number(patch.age);
    await student.update(patch);
    res.json(student);
  } catch (err) {
    console.error('Error updating summer student:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const student = await SummerStudent.findByPk(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    await student.update({ isActive: false });
    res.json({ message: 'Student removed' });
  } catch (err) {
    console.error('Error deleting summer student:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── ID CARDS ───────────────────────────────────────────────────────

// Returns the raw data the client needs to render one card:
//   { student, qrDataUrl, color, programName }
// The client renders the card HTML so the print layout can be tweaked
// without redeploying the server (same pattern as Mawhba).
exports.cardData = async (req, res) => {
  try {
    const student = await SummerStudent.findByPk(req.params.id, {
      include: [{ model: SummerProgram, as: 'program' }]
    });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    if (!student.nationalId) {
      return res.status(400).json({
        message: 'This student has no national ID — required for a QR-based ID card',
        messageAr: 'هذا الطالب لا يملك رقم هوية — رقم الهوية مطلوب لطباعة بطاقة QR'
      });
    }
    const qrDataUrl = await QRCode.toDataURL(student.nationalId, {
      errorCorrectionLevel: 'M', margin: 0, width: 340,
      color: { dark: '#0f172a', light: '#ffffff' }
    });
    res.json({
      student,
      qrDataUrl,
      color: colorForProgram(student.program),
      colorDark: darken(colorForProgram(student.program), 0.55),
      programName: student.program?.name || ''
    });
  } catch (err) {
    console.error('Summer cardData error:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

// Bulk card data — returns an array in the same shape as cardData for
// every requested student. Silently skips students with no nationalId
// and reports them in `skipped`.
exports.cardsBulk = async (req, res) => {
  try {
    const { studentIds } = req.body || {};
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ message: 'No students provided' });
    }
    const students = await SummerStudent.findAll({
      where: { studentId: { [Op.in]: studentIds } },
      include: [{ model: SummerProgram, as: 'program' }]
    });
    const result = [];
    const skipped = [];
    for (const s of students) {
      if (!s.nationalId) { skipped.push({ studentId: s.studentId, name: s.name }); continue; }
      const qrDataUrl = await QRCode.toDataURL(s.nationalId, {
        errorCorrectionLevel: 'M', margin: 0, width: 340,
        color: { dark: '#0f172a', light: '#ffffff' }
      });
      const color = colorForProgram(s.program);
      result.push({
        student: s,
        qrDataUrl,
        color,
        colorDark: darken(color, 0.55),
        programName: s.program?.name || ''
      });
    }
    res.json({ cards: result, skipped });
  } catch (err) {
    console.error('Summer cardsBulk error:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

// ─── ATTENDANCE ─────────────────────────────────────────────────────

exports.scanAttendance = async (req, res) => {
  try {
    const raw = String(req.body?.code || '').trim();
    if (!raw) return res.status(400).json({ message: 'No code provided' });

    const student = await SummerStudent.findOne({
      where: { nationalId: raw, isActive: true },
      include: [{ model: SummerProgram, as: 'program' }]
    });
    if (!student) return res.status(404).json({ message: 'No Summer student matches this code', code: raw });

    const date = todayStr();
    const now = new Date();
    let record = await SummerStudentAttendance.findOne({ where: { studentId: student.studentId, date } });

    let action = null;
    const color = colorForProgram(student.program);
    if (!record) {
      record = await SummerStudentAttendance.create({
        studentId: student.studentId,
        date,
        checkInAt: now
      });
      action = 'checkin';
    } else if (!record.checkOutAt) {
      const since = now.getTime() - new Date(record.checkInAt).getTime();
      if (since < 15 * 60 * 1000) {
        return res.json({
          action: 'duplicate', student, record, color,
          message: 'Already checked in — please wait at least 15 minutes before checking out'
        });
      }
      await record.update({ checkOutAt: now });
      action = 'checkout';
    } else {
      return res.json({
        action: 'already_done', student, record, color,
        message: 'Already checked in and out today'
      });
    }

    res.json({ action, student, record, color });
  } catch (err) {
    console.error('Summer scanAttendance error:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.todayAttendance = async (req, res) => {
  try {
    const date = todayStr();
    const records = await SummerStudentAttendance.findAll({
      where: { date },
      include: [{
        model: SummerStudent, as: 'student', required: false,
        include: [{ model: SummerProgram, as: 'program' }]
      }]
    });

    const events = [];
    const byProgram = new Map();
    for (const r of records) {
      const s = r.student || {};
      const prog = s.program || {};
      const color = colorForProgram(prog);
      const programKey = prog.name || '—';
      const base = {
        attendanceId: r.attendanceId,
        studentId: r.studentId,
        name: s.name || '',
        course: prog.name || '',
        color
      };
      if (r.checkInAt) events.push({ ...base, kind: 'checkin', at: r.checkInAt });
      if (r.checkOutAt) events.push({ ...base, kind: 'checkout', at: r.checkOutAt });

      if (!byProgram.has(programKey)) {
        byProgram.set(programKey, { course: programKey, color, students: [] });
      }
      byProgram.get(programKey).students.push({
        ...base,
        checkInAt: r.checkInAt,
        checkOutAt: r.checkOutAt,
        status: r.checkOutAt ? 'checked_out' : 'checked_in'
      });
    }
    events.sort((a, b) => new Date(b.at) - new Date(a.at));

    const groups = [...byProgram.values()];
    for (const g of groups) {
      g.students.sort((a, b) => new Date(b.checkOutAt || b.checkInAt || 0) - new Date(a.checkOutAt || a.checkInAt || 0));
    }
    groups.sort((a, b) => String(a.course).localeCompare(String(b.course), 'ar'));

    const checkins = events.filter(e => e.kind === 'checkin').length;
    const checkouts = events.filter(e => e.kind === 'checkout').length;
    res.json({ date, events, groups, stats: { checkins, checkouts } });
  } catch (err) {
    console.error('Summer todayAttendance error:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

// PATCH /summer/attendance/:id/checkout
//   empty body                          → clears the check-out
//   { checkOutAt: 'HH:MM' | ISO }       → sets it (HH:MM anchored to
//                                          the row's date in Riyadh)
exports.clearCheckout = async (req, res) => {
  try {
    const rec = await SummerStudentAttendance.findByPk(req.params.id);
    if (!rec) return res.status(404).json({ message: 'Record not found' });

    const raw = req.body?.checkOutAt;
    const hasValue = raw !== undefined && raw !== null && String(raw).trim() !== '';

    if (!hasValue) {
      if (!rec.checkOutAt) return res.status(400).json({ message: 'No check-out to clear' });
      await rec.update({ checkOutAt: null });
      return res.json({ message: 'Check-out cleared', record: rec });
    }

    const str = String(raw).trim();
    let newTime;
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(str)) {
      const timeStr = str.length === 5 ? `${str}:00` : str;
      newTime = new Date(`${rec.date}T${timeStr}+03:00`);
    } else {
      newTime = new Date(str);
    }
    if (isNaN(newTime.getTime())) {
      return res.status(400).json({ message: 'Invalid time format', messageAr: 'صيغة الوقت غير صالحة' });
    }
    if (rec.checkInAt && newTime < new Date(rec.checkInAt)) {
      return res.status(400).json({
        message: 'Check-out cannot be before check-in',
        messageAr: 'وقت الخروج يجب أن يكون بعد وقت الدخول'
      });
    }
    await rec.update({ checkOutAt: newTime });
    res.json({ message: 'Check-out saved', record: rec });
  } catch (err) {
    console.error('Summer clearCheckout error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /summer/attendance — admin manually adds a row for a past day
// the student didn't scan. Body: { studentId, date, checkInAt?, checkOutAt? }
exports.createManualAttendance = async (req, res) => {
  try {
    const { studentId, date, checkInAt, checkOutAt } = req.body || {};
    if (!studentId || !date) {
      return res.status(400).json({ message: 'studentId and date are required', messageAr: 'الطالب والتاريخ مطلوبان' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ message: 'Invalid date format' });
    }
    const student = await SummerStudent.findByPk(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const existing = await SummerStudentAttendance.findOne({ where: { studentId, date } });
    if (existing) {
      return res.status(409).json({
        message: 'Attendance for this date already exists — edit it instead',
        messageAr: 'يوجد سجل حضور لهذا التاريخ — عدّله بدلاً من إنشاء جديد',
        record: existing
      });
    }

    const parseTime = (raw) => {
      if (raw == null || raw === '') return null;
      const str = String(raw).trim();
      let t;
      if (/^\d{2}:\d{2}(:\d{2})?$/.test(str)) {
        const timeStr = str.length === 5 ? `${str}:00` : str;
        t = new Date(`${date}T${timeStr}+03:00`);
      } else {
        t = new Date(str);
      }
      return isNaN(t.getTime()) ? undefined : t;
    };

    const inAt = parseTime(checkInAt);
    const outAt = parseTime(checkOutAt);
    if (inAt === undefined || outAt === undefined) {
      return res.status(400).json({ message: 'Invalid time format', messageAr: 'صيغة الوقت غير صالحة' });
    }
    if (!inAt && !outAt) {
      return res.status(400).json({
        message: 'At least one of checkInAt / checkOutAt is required',
        messageAr: 'يجب إدخال وقت الدخول أو الخروج على الأقل'
      });
    }
    if (inAt && outAt && outAt < inAt) {
      return res.status(400).json({
        message: 'Check-out cannot be before check-in',
        messageAr: 'وقت الخروج يجب أن يكون بعد وقت الدخول'
      });
    }

    const record = await SummerStudentAttendance.create({
      studentId, date, checkInAt: inAt || null, checkOutAt: outAt || null
    });
    res.status(201).json({ message: 'Manual attendance created', record });
  } catch (err) {
    console.error('Summer createManualAttendance error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.clearTodayAttendance = async (req, res) => {
  try {
    const date = todayStr();
    const count = await SummerStudentAttendance.destroy({ where: { date } });
    res.json({ message: 'Today cleared', date, count });
  } catch (err) {
    console.error('Summer clearTodayAttendance error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.listStudentAttendance = async (req, res) => {
  try {
    const records = await SummerStudentAttendance.findAll({
      where: { studentId: req.params.id },
      order: [['date', 'DESC'], ['checkInAt', 'DESC']]
    });
    res.json(records);
  } catch (err) {
    console.error('Summer listStudentAttendance error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteAttendance = async (req, res) => {
  try {
    const rec = await SummerStudentAttendance.findByPk(req.params.id);
    if (!rec) return res.status(404).json({ message: 'Record not found' });
    await rec.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Summer deleteAttendance error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.exportAttendance = async (req, res) => {
  try {
    const { studentIds, from, to } = req.body || {};
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ message: 'No students selected' });
    }
    const where = { studentId: { [Op.in]: studentIds } };
    if (from) where.date = { ...(where.date || {}), [Op.gte]: from };
    if (to)   where.date = { ...(where.date || {}), [Op.lte]: to };

    const records = await SummerStudentAttendance.findAll({
      where,
      include: [{
        model: SummerStudent, as: 'student', required: false,
        include: [{ model: SummerProgram, as: 'program' }]
      }],
      order: [['date', 'ASC'], ['checkInAt', 'ASC']]
    });

    const header = ['اسم الطالب', 'رقم الهوية', 'البرنامج', 'التاريخ', 'وقت الدخول', 'وقت الخروج', 'المدة (دقيقة)'];
    const lines = [header.join('\t')];
    for (const r of records) {
      const s = r.student || {};
      const p = s.program || {};
      const minutes = r.checkInAt && r.checkOutAt
        ? Math.max(0, Math.round((new Date(r.checkOutAt) - new Date(r.checkInAt)) / 60000))
        : '';
      lines.push([
        s.name || '',
        s.nationalId || '',
        p.name || '',
        r.date || '',
        fmtTime(r.checkInAt),
        fmtTime(r.checkOutAt),
        minutes
      ].map(v => String(v ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ')).join('\t'));
    }

    const text = lines.join('\r\n');
    const bom = Buffer.from([0xFF, 0xFE]);
    const body = Buffer.from(text, 'utf16le');
    const out = Buffer.concat([bom, body]);

    const today = todayStr();
    res.setHeader('Content-Type', 'text/csv; charset=utf-16le');
    res.setHeader('Content-Disposition', `attachment; filename="summer-attendance-${today}.csv"`);
    res.send(out);
  } catch (err) {
    console.error('Summer exportAttendance error:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};
