const { FablabStaff, FablabStaffAttendance } = require('../models');
const { Op } = require('sequelize');
const QRCode = require('qrcode');

// ============== Riyadh-anchored "today" ==============

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

// ============== Staff CRUD ==============

exports.getAllStaff = async (req, res) => {
  try {
    const { search, isActive } = req.query;
    const where = {};
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { nationalId: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { position: { [Op.like]: `%${search}%` } }
      ];
    }
    const rows = await FablabStaff.findAll({ where, order: [['name', 'ASC']] });
    res.json(rows);
  } catch (err) {
    console.error('getAllStaff error:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.getStaffById = async (req, res) => {
  try {
    const row = await FablabStaff.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Staff not found' });
    res.json(row);
  } catch (err) {
    console.error('getStaffById error:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.createStaff = async (req, res) => {
  try {
    const { name, nationalId, phone, email, position, nationalIdPhoto } = req.body || {};
    if (!name || !nationalId) {
      return res.status(400).json({ message: 'Name and national ID are required' });
    }
    const existing = await FablabStaff.findOne({ where: { nationalId } });
    if (existing) return res.status(409).json({ message: 'Staff with this national ID already exists' });
    const row = await FablabStaff.create({
      name, nationalId, phone: phone || null, email: email || null,
      position: position || null, nationalIdPhoto: nationalIdPhoto || null
    });
    res.status(201).json(row);
  } catch (err) {
    console.error('createStaff error:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.updateStaff = async (req, res) => {
  try {
    const row = await FablabStaff.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Staff not found' });
    const { name, nationalId, phone, email, position, nationalIdPhoto, isActive } = req.body || {};
    if (nationalId && nationalId !== row.nationalId) {
      const dup = await FablabStaff.findOne({ where: { nationalId, staffId: { [Op.ne]: row.staffId } } });
      if (dup) return res.status(409).json({ message: 'Staff with this national ID already exists' });
    }
    await row.update({
      name: name ?? row.name,
      nationalId: nationalId ?? row.nationalId,
      phone: phone ?? row.phone,
      email: email ?? row.email,
      position: position ?? row.position,
      nationalIdPhoto: nationalIdPhoto ?? row.nationalIdPhoto,
      isActive: isActive ?? row.isActive
    });
    res.json(row);
  } catch (err) {
    console.error('updateStaff error:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.deleteStaff = async (req, res) => {
  try {
    const row = await FablabStaff.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Staff not found' });
    await FablabStaffAttendance.destroy({ where: { staffId: row.staffId } });
    await row.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('deleteStaff error:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

// ============== QR ID card ==============

const makeQrDataUrl = async (payload) =>
  QRCode.toDataURL(String(payload), {
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 8,
    color: { dark: '#000000', light: '#FFFFFF' }
  });

exports.getStaffCard = async (req, res) => {
  try {
    const row = await FablabStaff.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Staff not found' });
    const qrDataUrl = await makeQrDataUrl(row.nationalId);
    res.json({ staff: row, qrDataUrl });
  } catch (err) {
    console.error('getStaffCard error:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.getStaffCardsBulk = async (req, res) => {
  try {
    const { staffIds } = req.body || {};
    if (!Array.isArray(staffIds) || staffIds.length === 0) {
      return res.status(400).json({ message: 'staffIds array required' });
    }
    const rows = await FablabStaff.findAll({ where: { staffId: staffIds } });
    const cards = await Promise.all(rows.map(async (r) => ({
      staff: r,
      qrDataUrl: await makeQrDataUrl(r.nationalId)
    })));
    res.json({ cards });
  } catch (err) {
    console.error('getStaffCardsBulk error:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

// ============== Attendance ==============

exports.scanAttendance = async (req, res) => {
  try {
    const raw = String(req.body?.code || '').trim();
    if (!raw) return res.status(400).json({ message: 'No code provided' });

    const staff = await FablabStaff.findOne({ where: { nationalId: raw } });
    if (!staff) {
      return res.status(404).json({ message: 'No staff matches this code', code: raw });
    }

    const date = todayStr();
    const now = new Date();
    let record = await FablabStaffAttendance.findOne({
      where: { staffId: staff.staffId, date }
    });

    let action = null;
    if (!record) {
      record = await FablabStaffAttendance.create({
        staffId: staff.staffId, date, checkInAt: now
      });
      action = 'checkin';
    } else if (!record.checkOutAt) {
      const since = now.getTime() - new Date(record.checkInAt).getTime();
      if (since < 15 * 60 * 1000) {
        return res.json({
          action: 'duplicate', staff, record,
          message: 'Already checked in — please wait at least 15 minutes before checking out'
        });
      }
      await record.update({ checkOutAt: now });
      action = 'checkout';
    } else {
      return res.json({
        action: 'already_done', staff, record,
        message: 'Already checked in and out today'
      });
    }

    res.json({ action, staff, record });
  } catch (err) {
    console.error('Staff scanAttendance error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.todayAttendance = async (req, res) => {
  try {
    const date = todayStr();
    const records = await FablabStaffAttendance.findAll({
      where: { date },
      include: [{ model: FablabStaff, as: 'staff', required: false }]
    });

    const events = [];
    const staffList = [];
    for (const r of records) {
      const s = r.staff || {};
      const base = {
        attendanceId: r.attendanceId,
        staffId: r.staffId,
        name: s.name || '',
        phone: s.phone || '',
        position: s.position || ''
      };
      if (r.checkInAt) events.push({ ...base, kind: 'checkin', at: r.checkInAt });
      if (r.checkOutAt) events.push({ ...base, kind: 'checkout', at: r.checkOutAt });

      staffList.push({
        ...base,
        checkInAt: r.checkInAt,
        checkOutAt: r.checkOutAt,
        status: r.checkOutAt ? 'checked_out' : 'checked_in'
      });
    }
    events.sort((a, b) => new Date(b.at) - new Date(a.at));
    staffList.sort((a, b) =>
      new Date(b.checkOutAt || b.checkInAt || 0) - new Date(a.checkOutAt || a.checkInAt || 0)
    );

    const checkins = events.filter(e => e.kind === 'checkin').length;
    const checkouts = events.filter(e => e.kind === 'checkout').length;
    res.json({ date, events, staff: staffList, stats: { checkins, checkouts } });
  } catch (err) {
    console.error('Staff todayAttendance error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.clearTodayAttendance = async (req, res) => {
  try {
    const date = todayStr();
    const count = await FablabStaffAttendance.destroy({ where: { date } });
    res.json({ message: 'Today cleared', date, count });
  } catch (err) {
    console.error('Staff clearTodayAttendance error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.listStaffAttendance = async (req, res) => {
  try {
    const records = await FablabStaffAttendance.findAll({
      where: { staffId: req.params.id },
      order: [['date', 'DESC'], ['checkInAt', 'DESC']]
    });
    res.json(records);
  } catch (err) {
    console.error('Staff listStaffAttendance error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.clearCheckout = async (req, res) => {
  try {
    const rec = await FablabStaffAttendance.findByPk(req.params.id);
    if (!rec) return res.status(404).json({ message: 'Record not found' });
    if (!rec.checkOutAt) return res.status(400).json({ message: 'No check-out to clear' });
    await rec.update({ checkOutAt: null });
    res.json({ message: 'Check-out cleared', record: rec });
  } catch (err) {
    console.error('Staff clearCheckout error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.deleteAttendance = async (req, res) => {
  try {
    const rec = await FablabStaffAttendance.findByPk(req.params.id);
    if (!rec) return res.status(404).json({ message: 'Record not found' });
    await rec.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Staff deleteAttendance error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = exports;
