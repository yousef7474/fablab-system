const { Settings } = require('../models');

// Employees who run the 3D printing service from their own board, by
// email (Settings print3d_staff_emails). They get the same 3D printing
// access as an admin: requests, quotes, statuses, customer emails,
// materials and opening / closing the service.
const KEY = 'print3d_staff_emails';
const DEFAULT_STAFF = ['saad.m.alsalman@gmail.com'];

async function print3dStaffEmails() {
  const row = await Settings.findByPk(KEY);
  const list = Array.isArray(row?.value) ? row.value : DEFAULT_STAFF;
  return list.map(e => String(e).trim().toLowerCase()).filter(Boolean);
}

async function isPrint3dStaff(employee) {
  if (!employee?.email) return false;
  return (await print3dStaffEmails()).includes(String(employee.email).toLowerCase());
}

module.exports = { PRINT3D_STAFF_KEY: KEY, DEFAULT_STAFF, print3dStaffEmails, isPrint3dStaff };
