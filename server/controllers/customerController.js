const { Op } = require('sequelize');
const { Customer } = require('../models');
const { sendBulk } = require('../utils/customerEmailService');

const isValidEmail = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

exports.list = async (req, res) => {
  try {
    const customers = await Customer.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']]
    });
    res.json(customers);
  } catch (err) {
    console.error('Error listing customers:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, email, phone } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'name is required', messageAr: 'الاسم مطلوب' });
    }
    const customer = await Customer.create({
      name: String(name).trim(),
      email: email ? String(email).trim().toLowerCase() : null,
      phone: phone ? String(phone).trim() : null,
      createdById: req.admin?.adminId || null
    });
    res.status(201).json(customer);
  } catch (err) {
    console.error('Error creating customer:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const patch = {};
    if (req.body.name  !== undefined) patch.name  = String(req.body.name || '').trim();
    if (req.body.email !== undefined) patch.email = req.body.email ? String(req.body.email).trim().toLowerCase() : null;
    if (req.body.phone !== undefined) patch.phone = req.body.phone ? String(req.body.phone).trim() : null;
    await customer.update(patch);
    res.json(customer);
  } catch (err) {
    console.error('Error updating customer:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    await customer.update({ isActive: false });
    res.json({ message: 'Customer removed' });
  } catch (err) {
    console.error('Error deleting customer:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Bulk import — accepts an array of { name, email, phone }. Upserts by email
// (case-insensitive); rows with no email are always inserted (no way to
// dedupe them). Returns { inserted, updated, skipped, errors }.
exports.bulkImport = async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
    if (!rows) {
      return res.status(400).json({ message: 'rows array is required' });
    }

    const summary = { inserted: 0, updated: 0, skipped: 0, errors: [] };
    const createdById = req.admin?.adminId || null;

    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx] || {};
      const name  = (r.name  || r.Name  || '').toString().trim();
      const email = (r.email || r.Email || '').toString().trim().toLowerCase();
      const phone = (r.phone || r.Phone || '').toString().trim();

      if (!name) { summary.skipped++; continue; }

      try {
        let existing = null;
        if (email) {
          existing = await Customer.findOne({ where: { email } });
        }
        if (existing) {
          const patch = {};
          if (!existing.name  && name)  patch.name  = name;
          if (!existing.phone && phone) patch.phone = phone;
          if (existing.isActive === false) patch.isActive = true;
          if (Object.keys(patch).length) {
            await existing.update(patch);
            summary.updated++;
          } else {
            summary.skipped++;
          }
        } else {
          await Customer.create({
            name,
            email: email || null,
            phone: phone || null,
            createdById
          });
          summary.inserted++;
        }
      } catch (rowErr) {
        summary.errors.push({ row: idx + 1, name, email, error: rowErr.message });
      }
    }

    res.json(summary);
  } catch (err) {
    console.error('Error in bulk import:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

// Send bulk email to all active customers with a valid email. Can also
// send a test-only run to a single supplied `testEmail` — that path does
// not hit the customer table at all.
exports.sendBulkEmail = async (req, res) => {
  try {
    const { subject, message, useHtml, testEmail } = req.body || {};
    if (!subject || !String(subject).trim()) {
      return res.status(400).json({ message: 'subject is required', messageAr: 'العنوان مطلوب' });
    }
    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: 'message is required', messageAr: 'الرسالة مطلوبة' });
    }

    let recipients;
    if (testEmail && String(testEmail).trim()) {
      const t = String(testEmail).trim().toLowerCase();
      if (!isValidEmail(t)) {
        return res.status(400).json({ message: 'testEmail is not a valid email' });
      }
      recipients = [{ email: t, name: req.admin?.fullName || 'Test' }];
    } else {
      const customers = await Customer.findAll({
        where: {
          isActive: true,
          email: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
        }
      });
      recipients = customers
        .map(c => ({ email: c.email, name: c.name }))
        .filter(r => isValidEmail(r.email));
    }

    if (recipients.length === 0) {
      return res.status(400).json({
        message: 'No valid recipients',
        messageAr: 'لا يوجد مستلمون صالحون'
      });
    }

    const result = await sendBulk({
      recipients,
      subject: String(subject).trim(),
      bodyPlain: String(message),
      useHtml: !!useHtml
    });

    res.json({
      totalRecipients: recipients.length,
      ...result,
      testMode: !!testEmail
    });
  } catch (err) {
    console.error('Error sending bulk email:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.stats = async (req, res) => {
  try {
    const [total, withEmail, withPhone] = await Promise.all([
      Customer.count({ where: { isActive: true } }),
      Customer.count({
        where: {
          isActive: true,
          email: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
        }
      }),
      Customer.count({
        where: {
          isActive: true,
          phone: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
        }
      })
    ]);
    res.json({ total, withEmail, withPhone, withoutEmail: total - withEmail });
  } catch (err) {
    console.error('Error fetching customer stats:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
