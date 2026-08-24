const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// One overtime request per submission. `days` holds an array of
// { date, hours, task } entries so the front-end can render / edit /
// print the per-day breakdown without a separate join.
const OvertimeRequest = sequelize.define('OvertimeRequest', {
  overtimeId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  employeeName:   { type: DataTypes.STRING, allowNull: false },
  nationalId:     { type: DataTypes.STRING, allowNull: true },
  phone:          { type: DataTypes.STRING, allowNull: true },
  email:          { type: DataTypes.STRING, allowNull: true, validate: { isEmail: true } },
  position:       { type: DataTypes.STRING, allowNull: true },
  periodStart:    { type: DataTypes.DATEONLY, allowNull: true },
  periodEnd:      { type: DataTypes.DATEONLY, allowNull: true },
  totalHours:     { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  // Admin who approved this overtime; shown as a row on the printed
  // سند and used as an audit trail.
  approvedBy:     { type: DataTypes.STRING, allowNull: true },
  note:           { type: DataTypes.TEXT, allowNull: true },
  // Free-text description of what the overtime was for, printed on
  // the سند under a dedicated "تفاصيل السند" row so accounting sees
  // it separately from the general admin `note`.
  sanadDetails:   { type: DataTypes.TEXT, allowNull: true },
  days:           { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  createdById:    { type: DataTypes.UUID, allowNull: true },
  // Approval workflow — admin creates as 'draft', sends for approval
  // (→ 'pending' with a token + emailed link), manager approves or
  // rejects. Printing سند is only allowed once 'approved'.
  approvalStatus: {
    type: DataTypes.STRING(16),
    allowNull: false,
    defaultValue: 'draft'   // 'draft' | 'pending' | 'approved' | 'rejected'
  },
  approvalToken:      { type: DataTypes.UUID, allowNull: true, unique: true },
  managerEmail:       { type: DataTypes.STRING, allowNull: true },
  sentForApprovalAt:  { type: DataTypes.DATE, allowNull: true },
  approvedAt:         { type: DataTypes.DATE, allowNull: true },
  rejectedAt:         { type: DataTypes.DATE, allowNull: true },
  managerNote:        { type: DataTypes.TEXT, allowNull: true }
}, {
  tableName: 'overtime_requests',
  timestamps: true,
  hooks: {
    beforeValidate: (row) => {
      if (row.email === '') row.email = null;
    }
  }
});

module.exports = OvertimeRequest;
