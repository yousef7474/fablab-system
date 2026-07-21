const fs = require('fs');
const path = require('path');
const { Customer } = require('../models');

// One-time idempotent seed of the initial mailing list from the Excel export
// (server/data/initialCustomers.json). Runs on server startup — if the
// customers table already has rows, this is a no-op. Safe to redeploy.
const seedInitialCustomers = async () => {
  try {
    const existing = await Customer.count();
    if (existing > 0) {
      return; // already seeded
    }

    const seedPath = path.join(__dirname, '..', 'data', 'initialCustomers.json');
    if (!fs.existsSync(seedPath)) {
      console.log('👥 No initialCustomers.json seed file — skipping customer seed.');
      return;
    }

    const raw = fs.readFileSync(seedPath, 'utf8');
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows) || rows.length === 0) return;

    const records = rows
      .map(r => ({
        name:  (r.name  || '').toString().trim(),
        email: (r.email || '').toString().trim().toLowerCase() || null,
        phone: (r.phone || '').toString().trim() || null
      }))
      .filter(r => r.name);

    if (records.length === 0) return;

    await Customer.bulkCreate(records, { ignoreDuplicates: true });
    console.log(`👥 Seeded ${records.length} initial customers into the mailing list.`);
  } catch (err) {
    console.error('Error seeding initial customers:', err.message);
  }
};

module.exports = { seedInitialCustomers };
