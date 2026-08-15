const { CalendarEvent } = require('../models');
const { Op } = require('sequelize');

// -------------------- SAUDI HOLIDAYS --------------------
// Fixed Gregorian dates + approximate Hijri-based dates for the
// coming few years. Hijri dates shift ~11 days earlier each year
// so the app can auto-add a Founding Day / National Day for any
// year, and admins can override or extend as needed.
//
// NOTE: Hijri approximations are just starting points — the moon
// sighting is what actually decides Ramadan/Eid dates each year.
// Admin can edit or delete these once the official dates are set.
const SAUDI_STATIC_HOLIDAYS = {
  2026: [
    { date: '2026-02-22', titleAr: 'يوم التأسيس',           titleEn: 'Founding Day',        category: 'holiday' },
    { date: '2026-09-23', titleAr: 'اليوم الوطني السعودي',  titleEn: 'Saudi National Day',  category: 'holiday' },
    // Islamic dates (approximate — Umm al-Qura 1447 AH)
    { date: '2026-02-18', titleAr: 'بداية شهر رمضان',       titleEn: 'Start of Ramadan',    category: 'holiday', range: '2026-03-19' },
    { date: '2026-03-20', titleAr: 'عيد الفطر',             titleEn: 'Eid Al-Fitr',         category: 'holiday', range: '2026-03-23' },
    { date: '2026-05-27', titleAr: 'عيد الأضحى',            titleEn: 'Eid Al-Adha',         category: 'holiday', range: '2026-05-30' }
  ],
  2027: [
    { date: '2027-02-22', titleAr: 'يوم التأسيس',           titleEn: 'Founding Day',        category: 'holiday' },
    { date: '2027-09-23', titleAr: 'اليوم الوطني السعودي',  titleEn: 'Saudi National Day',  category: 'holiday' },
    { date: '2027-02-08', titleAr: 'بداية شهر رمضان',       titleEn: 'Start of Ramadan',    category: 'holiday', range: '2027-03-09' },
    { date: '2027-03-10', titleAr: 'عيد الفطر',             titleEn: 'Eid Al-Fitr',         category: 'holiday', range: '2027-03-13' },
    { date: '2027-05-17', titleAr: 'عيد الأضحى',            titleEn: 'Eid Al-Adha',         category: 'holiday', range: '2027-05-20' }
  ],
  2028: [
    { date: '2028-02-22', titleAr: 'يوم التأسيس',           titleEn: 'Founding Day',        category: 'holiday' },
    { date: '2028-09-23', titleAr: 'اليوم الوطني السعودي',  titleEn: 'Saudi National Day',  category: 'holiday' },
    { date: '2028-01-28', titleAr: 'بداية شهر رمضان',       titleEn: 'Start of Ramadan',    category: 'holiday', range: '2028-02-25' },
    { date: '2028-02-26', titleAr: 'عيد الفطر',             titleEn: 'Eid Al-Fitr',         category: 'holiday', range: '2028-02-29' },
    { date: '2028-05-05', titleAr: 'عيد الأضحى',            titleEn: 'Eid Al-Adha',         category: 'holiday', range: '2028-05-08' }
  ],
  2029: [
    { date: '2029-02-22', titleAr: 'يوم التأسيس',           titleEn: 'Founding Day',        category: 'holiday' },
    { date: '2029-09-23', titleAr: 'اليوم الوطني السعودي',  titleEn: 'Saudi National Day',  category: 'holiday' },
    { date: '2029-01-16', titleAr: 'بداية شهر رمضان',       titleEn: 'Start of Ramadan',    category: 'holiday', range: '2029-02-13' },
    { date: '2029-02-14', titleAr: 'عيد الفطر',             titleEn: 'Eid Al-Fitr',         category: 'holiday', range: '2029-02-17' },
    { date: '2029-04-24', titleAr: 'عيد الأضحى',            titleEn: 'Eid Al-Adha',         category: 'holiday', range: '2029-04-27' }
  ],
  2030: [
    { date: '2030-02-22', titleAr: 'يوم التأسيس',           titleEn: 'Founding Day',        category: 'holiday' },
    { date: '2030-09-23', titleAr: 'اليوم الوطني السعودي',  titleEn: 'Saudi National Day',  category: 'holiday' },
    { date: '2030-01-05', titleAr: 'بداية شهر رمضان',       titleEn: 'Start of Ramadan',    category: 'holiday', range: '2030-02-03' },
    { date: '2030-02-04', titleAr: 'عيد الفطر',             titleEn: 'Eid Al-Fitr',         category: 'holiday', range: '2030-02-07' },
    { date: '2030-04-13', titleAr: 'عيد الأضحى',            titleEn: 'Eid Al-Adha',         category: 'holiday', range: '2030-04-16' }
  ]
};

// -------------------- CRUD --------------------

// GET /calendar-events?year=2026 — user's saved events for the year
exports.list = async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const rows = await CalendarEvent.findAll({
      where: { year },
      order: [['startDate', 'ASC'], ['createdAt', 'ASC']]
    });
    res.json(rows);
  } catch (err) {
    console.error('list calendar events:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /calendar-events/saudi-holidays?year=2026
exports.saudiHolidays = async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const list = SAUDI_STATIC_HOLIDAYS[year] || [];
    // Shape it like a saved event so the client renders it identically.
    const events = list.map(h => ({
      eventId:     `holiday-${year}-${h.date}`,
      year,
      startDate:   h.date,
      endDate:     h.range || h.date,
      title:       h.titleAr,   // Arabic default — UI can prefer titleEn if English
      titleEn:     h.titleEn,
      description: 'مناسبة رسمية',
      category:    h.category,
      color:       '#16a34a',   // green for holidays
      isImportant: true,
      isReadOnly:  true         // client should not offer edit/delete on these
    }));
    res.json(events);
  } catch (err) {
    console.error('saudiHolidays:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /calendar-events
exports.create = async (req, res) => {
  try {
    const {
      startDate, endDate, title, description,
      category, color, isImportant, assignedTo
    } = req.body || {};

    if (!startDate || !title) {
      return res.status(400).json({ message: 'startDate and title are required' });
    }
    const y = new Date(`${startDate}T00:00:00`).getFullYear();
    const row = await CalendarEvent.create({
      year: y,
      startDate,
      endDate: endDate || null,
      title: String(title).trim(),
      description: description ? String(description).trim() : null,
      category: category || 'task',
      color: color || null,
      isImportant: !!isImportant,
      assignedTo: assignedTo ? String(assignedTo).trim() : null,
      createdBy: req.admin?.fullName || req.admin?.username || null
    });
    res.status(201).json(row);
  } catch (err) {
    console.error('create calendar event:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

// PUT /calendar-events/:id
exports.update = async (req, res) => {
  try {
    const row = await CalendarEvent.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    const payload = { ...req.body };
    delete payload.year;      // recomputed from startDate
    delete payload.createdBy;
    if (payload.startDate) {
      payload.year = new Date(`${payload.startDate}T00:00:00`).getFullYear();
    }
    await row.update(payload);
    res.json(row);
  } catch (err) {
    console.error('update calendar event:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /calendar-events/:id
exports.remove = async (req, res) => {
  try {
    const row = await CalendarEvent.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    await row.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('remove calendar event:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
