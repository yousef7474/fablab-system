const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Snapshot of one printed "سند استلام" voucher for a volunteer. Stored
// as plain data (the PDF re-renders client-side from these fields), so
// no file storage is needed.
const VolunteerReceipt = sequelize.define('VolunteerReceipt', {
  receiptId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  volunteerId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  recipientName: { type: DataTypes.STRING, allowNull: false },
  nationalId:    { type: DataTypes.STRING, allowNull: true },
  amount:        { type: DataTypes.STRING, allowNull: false },
  purpose:       { type: DataTypes.TEXT,   allowNull: true },
  note:          { type: DataTypes.TEXT,   allowNull: true },
  receiptDate:   { type: DataTypes.DATEONLY, allowNull: false },
  recipientPhone:{ type: DataTypes.STRING, allowNull: true },
  createdById:   { type: DataTypes.UUID,   allowNull: true }
}, {
  tableName: 'volunteer_receipts',
  timestamps: true
});

module.exports = VolunteerReceipt;
