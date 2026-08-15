const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// FABLAB visit requests submitted from the public /fablab-visit page.
// Two-stage approval: admin sends the request to a manager for sign-off
// via emailed token (mirror of overtime), THEN — once the manager has
// approved — admin issues the final decision to the visitor which
// triggers an email notification to them.
const FablabVisit = sequelize.define('FablabVisit', {
  visitId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // Human-friendly sequential number, shown as "زيارة #123" or "V-123".
  // Assigned atomically in the controller (MAX(visitNumber)+1). UNIQUE
  // + IF NOT EXISTS-added on boot so existing tables get it backfilled.
  visitNumber: {
    type: DataTypes.INTEGER,
    allowNull: true,
    unique: true
  },
  // Submitter identity
  entityName:      { type: DataTypes.STRING, allowNull: false },   // اسم الجهة
  personInCharge:  { type: DataTypes.STRING, allowNull: false },   // الشخص المسؤول
  nationalId:      { type: DataTypes.STRING, allowNull: false },
  phone:           { type: DataTypes.STRING, allowNull: false },
  email:           { type: DataTypes.STRING, allowNull: false, validate: { isEmail: true } },
  // Visit specifics
  visitorsCount:   { type: DataTypes.INTEGER, allowNull: true, defaultValue: 1 },
  visitDate:       { type: DataTypes.DATEONLY, allowNull: false },
  visitStartTime:  { type: DataTypes.TIME, allowNull: false },
  visitEndTime:    { type: DataTypes.TIME, allowNull: false },
  purpose:         { type: DataTypes.TEXT, allowNull: false },     // الغرض من الزيارة
  notes:           { type: DataTypes.TEXT, allowNull: true },

  // ----- Manager approval workflow (mirrors OvertimeRequest) -----
  // 'draft'  = admin hasn't sent it out yet
  // 'pending'= sent to manager, awaiting decision via emailed link
  // 'approved' | 'rejected' = manager's decision landed
  approvalStatus: {
    type: DataTypes.STRING(16),
    allowNull: false,
    defaultValue: 'draft'
  },
  approvalToken:      { type: DataTypes.UUID, allowNull: true, unique: true },
  managerEmail:       { type: DataTypes.STRING, allowNull: true },
  sentForApprovalAt:  { type: DataTypes.DATE, allowNull: true },
  approvedAt:         { type: DataTypes.DATE, allowNull: true },
  rejectedAt:         { type: DataTypes.DATE, allowNull: true },
  managerNote:        { type: DataTypes.TEXT, allowNull: true },
  managerName:        { type: DataTypes.STRING, allowNull: true },

  // ----- Admin's final call to the visitor -----
  // 'pending' | 'accepted' | 'rejected'
  visitorDecision:   { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'pending' },
  visitorDecisionAt: { type: DataTypes.DATE, allowNull: true },
  visitorDecisionBy: { type: DataTypes.STRING, allowNull: true },
  visitorMessage:    { type: DataTypes.TEXT, allowNull: true },   // custom message to include in the visitor email
  visitorEmailSentAt:{ type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'fablab_visits',
  timestamps: true,
  hooks: {
    beforeValidate: (row) => {
      if (row.email === '') row.email = null;
    }
  }
});

module.exports = FablabVisit;
