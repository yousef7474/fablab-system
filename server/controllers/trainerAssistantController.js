const { TrainerAssistant, TrainerAssignment, TrainerAssistantAttendance } = require('../models');
const { Op } = require('sequelize');
const QRCode = require('qrcode');
const sgMail = require('@sendgrid/mail');

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Turn a { punctuality, technical, delivery, engagement, preparation }
// object into an average 0–5 rating. Missing/null keys are dropped so
// admins can partially fill.
const avgFromCriteria = (criteria) => {
  if (!criteria || typeof criteria !== 'object') return null;
  const vals = Object.values(criteria)
    .map(v => Number(v))
    .filter(v => Number.isFinite(v) && v > 0);
  if (!vals.length) return null;
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100;
};

// ---------- Trainer CRUD ----------

exports.listTrainers = async (req, res) => {
  try {
    const trainers = await TrainerAssistant.findAll({
      order: [['name', 'ASC']],
      include: [{ model: TrainerAssignment, as: 'assignments', separate: true, order: [['chanceDate', 'DESC']] }]
    });
    res.json(trainers);
  } catch (err) {
    console.error('listTrainers:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getTrainer = async (req, res) => {
  try {
    const trainer = await TrainerAssistant.findByPk(req.params.id, {
      include: [{ model: TrainerAssignment, as: 'assignments' }]
    });
    if (!trainer) return res.status(404).json({ message: 'Not found' });
    res.json(trainer);
  } catch (err) {
    console.error('getTrainer:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createTrainer = async (req, res) => {
  try {
    const trainer = await TrainerAssistant.create(req.body);
    res.status(201).json(trainer);
  } catch (err) {
    console.error('createTrainer:', err);
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'National ID already exists', messageAr: 'رقم الهوية موجود مسبقاً' });
    }
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.updateTrainer = async (req, res) => {
  try {
    const trainer = await TrainerAssistant.findByPk(req.params.id);
    if (!trainer) return res.status(404).json({ message: 'Not found' });
    await trainer.update(req.body);
    res.json(trainer);
  } catch (err) {
    console.error('updateTrainer:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.deleteTrainer = async (req, res) => {
  try {
    const trainer = await TrainerAssistant.findByPk(req.params.id);
    if (!trainer) return res.status(404).json({ message: 'Not found' });
    await TrainerAssignment.destroy({ where: { trainerId: trainer.trainerId } });
    await trainer.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('deleteTrainer:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---------- Assignment (chance) CRUD ----------

exports.listAssignments = async (req, res) => {
  try {
    const assignments = await TrainerAssignment.findAll({
      where: { trainerId: req.params.trainerId },
      order: [['chanceDate', 'DESC']]
    });
    res.json(assignments);
  } catch (err) {
    console.error('listAssignments:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createAssignment = async (req, res) => {
  try {
    const trainer = await TrainerAssistant.findByPk(req.params.trainerId);
    if (!trainer) return res.status(404).json({ message: 'Trainer not found' });
    if (!req.body.chanceName) {
      return res.status(400).json({ message: 'chanceName is required' });
    }
    const { chanceName, destination, startAt, endAt, chanceDate, criteria, notes } = req.body;
    // If admin filled criteria we derive rating from that; otherwise
    // fall back to whatever rating value they sent (or null).
    const rating = criteria ? avgFromCriteria(criteria) : (req.body.rating ?? null);
    const legacyDate = chanceDate || (startAt ? String(startAt).slice(0, 10) : null);

    const assignment = await TrainerAssignment.create({
      trainerId: trainer.trainerId,
      chanceName,
      destination: destination || null,
      startAt: startAt || null,
      endAt: endAt || null,
      chanceDate: legacyDate,
      criteria: criteria || null,
      rating,
      notes: notes || null
    });
    res.status(201).json(assignment);
  } catch (err) {
    console.error('createAssignment:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.updateAssignment = async (req, res) => {
  try {
    const assignment = await TrainerAssignment.findByPk(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Not found' });
    const payload = { ...req.body };
    if (payload.criteria) {
      payload.rating = avgFromCriteria(payload.criteria);
    }
    // Keep legacy chanceDate in sync when the new startAt is set.
    if (payload.startAt && !payload.chanceDate) {
      payload.chanceDate = String(payload.startAt).slice(0, 10);
    }
    await assignment.update(payload);
    res.json(assignment);
  } catch (err) {
    console.error('updateAssignment:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

// Send a one-off email to the trainer. Admin supplies subject +
// message body; server wraps it in a simple RTL-friendly template.
exports.sendEmail = async (req, res) => {
  try {
    const { subject, message } = req.body;
    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: 'Message is required', messageAr: 'الرسالة مطلوبة' });
    }
    if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
      return res.status(500).json({ message: 'Email service not configured' });
    }
    const trainer = await TrainerAssistant.findByPk(req.params.id);
    if (!trainer) return res.status(404).json({ message: 'Trainer not found' });
    if (!trainer.email) {
      return res.status(400).json({ message: 'Trainer has no email address', messageAr: 'لا يوجد بريد إلكتروني للمدرب' });
    }

    const safeMsg = String(message).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = `
      <div style="font-family: 'Tajawal', 'Segoe UI', Tahoma, sans-serif; background: #f5f3ff; padding: 30px 0;">
        <div style="max-width: 640px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 6px 24px rgba(109,40,217,0.10);">
          <div style="background: linear-gradient(135deg, #6d28d9, #a855f7); color: #fff; padding: 22px 28px;">
            <h2 style="margin: 0; font-size: 20px;">فاب لاب الأحساء</h2>
            <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">FABLAB Al-Ahsa</p>
          </div>
          <div dir="rtl" style="padding: 28px; color: #0f172a;">
            <p style="margin: 0 0 12px 0; font-size: 15px;">مرحباً ${trainer.name || ''}،</p>
            <div style="background: #faf5ff; border-right: 4px solid #6d28d9; padding: 18px; border-radius: 8px; white-space: pre-wrap; line-height: 1.9; font-size: 14px; color: #0f172a;">${safeMsg}</div>
            <p style="margin: 22px 0 0 0; color: #64748b; font-size: 13px;">مع تحيات إدارة فاب لاب الأحساء</p>
          </div>
        </div>
      </div>
    `;

    await sgMail.send({
      to: trainer.email,
      from: { email: process.env.SENDGRID_FROM_EMAIL, name: process.env.SENDGRID_FROM_NAME || 'FABLAB Al-Ahsa' },
      subject: subject || 'رسالة من فاب لاب - Message from FABLAB',
      html
    });

    res.json({ message: 'Email sent', messageAr: 'تم إرسال البريد الإلكتروني' });
  } catch (err) {
    console.error('sendEmail:', err?.response?.body || err);
    res.status(500).json({ message: 'Failed to send email', detail: err.message });
  }
};

exports.deleteAssignment = async (req, res) => {
  try {
    const assignment = await TrainerAssignment.findByPk(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Not found' });
    await assignment.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('deleteAssignment:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== TRAINER ATTENDANCE ==============
// Mirrors the volunteer attendance flow — QR log is the single
// source of truth, admin can manually add / edit rows.

const _todayStr = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const d = parts.find(p => p.type === 'day').value;
  return `${y}-${m}-${d}`;
};

const _makeQrDataUrl = async (payload) => {
  return QRCode.toDataURL(String(payload), {
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 8,
    color: { dark: '#000000', light: '#FFFFFF' }
  });
};

// POST /trainer-assistants/attendance/scan — body { code } — matches
// against nationalId. Same 15-min re-scan guard as volunteers.
exports.scanAttendance = async (req, res) => {
  try {
    const raw = String(req.body?.code || '').trim();
    if (!raw) return res.status(400).json({ message: 'No code provided' });

    const trainer = await TrainerAssistant.findOne({ where: { nationalId: raw } });
    if (!trainer) {
      return res.status(404).json({ message: 'No trainer matches this code', code: raw });
    }

    const date = _todayStr();
    const now = new Date();
    let record = await TrainerAssistantAttendance.findOne({
      where: { trainerId: trainer.trainerId, date }
    });

    let action = null;
    if (!record) {
      record = await TrainerAssistantAttendance.create({
        trainerId: trainer.trainerId,
        date,
        checkInAt: now
      });
      action = 'checkin';
    } else if (!record.checkOutAt) {
      const since = now.getTime() - new Date(record.checkInAt).getTime();
      if (since < 15 * 60 * 1000) {
        return res.json({
          action: 'duplicate',
          trainer,
          record,
          message: 'Already checked in — please wait at least 15 minutes before checking out'
        });
      }
      await record.update({ checkOutAt: now });
      action = 'checkout';
    } else {
      return res.json({
        action: 'already_done',
        trainer,
        record,
        message: 'Already checked in and out today'
      });
    }

    res.json({ action, trainer, record });
  } catch (err) {
    console.error('Trainer scanAttendance error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /trainer-assistants/attendance/today
exports.todayAttendance = async (req, res) => {
  try {
    const date = _todayStr();
    const records = await TrainerAssistantAttendance.findAll({
      where: { date },
      include: [{ model: TrainerAssistant, as: 'trainer', required: false }]
    });
    const events = [];
    const list = [];
    for (const r of records) {
      const t = r.trainer || {};
      const base = {
        attendanceId: r.attendanceId,
        trainerId: r.trainerId,
        name: t.name || '',
        phone: t.phone || ''
      };
      if (r.checkInAt) events.push({ ...base, kind: 'checkin', at: r.checkInAt });
      if (r.checkOutAt) events.push({ ...base, kind: 'checkout', at: r.checkOutAt });
      list.push({
        ...base,
        checkInAt: r.checkInAt,
        checkOutAt: r.checkOutAt,
        status: r.checkOutAt ? 'checked_out' : 'checked_in'
      });
    }
    events.sort((a, b) => new Date(b.at) - new Date(a.at));
    list.sort((a, b) => new Date(b.checkOutAt || b.checkInAt || 0) - new Date(a.checkOutAt || a.checkInAt || 0));
    const checkins = events.filter(e => e.kind === 'checkin').length;
    const checkouts = events.filter(e => e.kind === 'checkout').length;
    res.json({ date, events, trainers: list, stats: { checkins, checkouts } });
  } catch (err) {
    console.error('Trainer todayAttendance error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// DELETE /trainer-assistants/attendance/today — used by the shared
// clear-today button on the attendance page.
exports.clearTodayAttendance = async (req, res) => {
  try {
    const date = _todayStr();
    const count = await TrainerAssistantAttendance.destroy({ where: { date } });
    res.json({ message: 'Today cleared', date, count });
  } catch (err) {
    console.error('Trainer clearTodayAttendance error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /trainer-assistants/:id/attendance
exports.listAttendance = async (req, res) => {
  try {
    const records = await TrainerAssistantAttendance.findAll({
      where: { trainerId: req.params.id },
      order: [['date', 'DESC'], ['checkInAt', 'DESC']]
    });
    res.json(records);
  } catch (err) {
    console.error('Trainer listAttendance error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST /trainer-assistants/attendance — manual add. Body: { trainerId,
// date, checkInAt?, checkOutAt? }. HH:MM anchored to date in Riyadh.
exports.createManualAttendance = async (req, res) => {
  try {
    const { trainerId, date, checkInAt, checkOutAt } = req.body || {};
    if (!trainerId || !date) {
      return res.status(400).json({
        message: 'trainerId and date are required',
        messageAr: 'المدرب والتاريخ مطلوبان'
      });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ message: 'Invalid date format' });
    }
    const trainer = await TrainerAssistant.findByPk(trainerId);
    if (!trainer) return res.status(404).json({ message: 'Trainer not found' });

    const existing = await TrainerAssistantAttendance.findOne({
      where: { trainerId, date }
    });
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

    const record = await TrainerAssistantAttendance.create({
      trainerId, date, checkInAt: inAt || null, checkOutAt: outAt || null
    });
    res.status(201).json({ message: 'Manual attendance created', record });
  } catch (err) {
    console.error('Trainer createManualAttendance error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// PATCH /trainer-assistants/attendance/:id/checkout — same body shape
// as the volunteer variant: empty → clear, { checkOutAt: 'HH:MM' | ISO } → set.
exports.setOrClearCheckout = async (req, res) => {
  try {
    const rec = await TrainerAssistantAttendance.findByPk(req.params.id);
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
    console.error('Trainer setOrClearCheckout error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// DELETE /trainer-assistants/attendance/:id
exports.deleteAttendance = async (req, res) => {
  try {
    const rec = await TrainerAssistantAttendance.findByPk(req.params.id);
    if (!rec) return res.status(404).json({ message: 'Record not found' });
    await rec.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Trainer deleteAttendance error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /trainer-assistants/:id/card — { trainer, qrDataUrl }
exports.getTrainerCard = async (req, res) => {
  try {
    const trainer = await TrainerAssistant.findByPk(req.params.id);
    if (!trainer) return res.status(404).json({ message: 'Trainer not found' });
    if (!trainer.nationalId) {
      return res.status(400).json({
        message: 'Trainer has no nationalId — cannot generate QR',
        messageAr: 'لا يوجد رقم هوية للمدرب — لا يمكن توليد QR'
      });
    }
    const qrDataUrl = await _makeQrDataUrl(trainer.nationalId);
    res.json({ trainer, qrDataUrl });
  } catch (err) {
    console.error('Trainer getTrainerCard error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST /trainer-assistants/cards — body { trainerIds }
exports.getTrainerCardsBulk = async (req, res) => {
  try {
    const { trainerIds } = req.body || {};
    if (!Array.isArray(trainerIds) || trainerIds.length === 0) {
      return res.status(400).json({ message: 'trainerIds array required' });
    }
    const trainers = await TrainerAssistant.findAll({
      where: { trainerId: { [Op.in]: trainerIds } }
    });
    const cards = [];
    for (const t of trainers) {
      if (!t.nationalId) continue;
      cards.push({ trainer: t, qrDataUrl: await _makeQrDataUrl(t.nationalId) });
    }
    res.json({ cards });
  } catch (err) {
    console.error('Trainer getTrainerCardsBulk error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
