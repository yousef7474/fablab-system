const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Snapshot of one printed "سند استلام" voucher for a worker.
const WorkerReceipt = sequelize.define('WorkerReceipt', {
  receiptId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  workerId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  recipientName: { type: DataTypes.STRING, allowNull: false },
  nationalId:    { type: DataTypes.STRING, allowNull: true },
  amount:        { type: DataTypes.STRING, allowNull: false },
  purpose:       { type: DataTypes.TEXT,   allowNull: true },
  receiptDate:   { type: DataTypes.DATEONLY, allowNull: false },
  recipientPhone:{ type: DataTypes.STRING, allowNull: true },
  createdById:   { type: DataTypes.UUID,   allowNull: true }
}, {
  tableName: 'worker_receipts',
  timestamps: true
});

module.exports = WorkerReceipt;
