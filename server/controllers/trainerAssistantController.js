const { TrainerAssistant, TrainerAssignment } = require('../models');
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
