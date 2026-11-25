const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A request from the public /workspace page to use one of FabLab's 8
// workspaces for a period (up to one month) at a daily time inside
// 10:00–17:00, on working days. Admins and managers accept or reject it;
// a pending or accepted request holds its workspace for that period/time.
const WorkspaceRequest = sequelize.define('WorkspaceRequest', {
  requestId: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  requestNumber: { type: DataTypes.STRING(20), allowNull: false, unique: true },   // WS-0001
  fullName: { type: DataTypes.STRING(150), allowNull: false },
  phone: { type: DataTypes.STRING(30), allowNull: false },
  email: { type: DataTypes.STRING(150), allowNull: false },
  applicantType: { type: DataTypes.STRING(20), allowNull: false },                 // Beneficiary | Talented | Visitor | Entity
  organization: { type: DataTypes.STRING(200), allowNull: true },
  projectName: { type: DataTypes.STRING(200), allowNull: false },
  projectDescription: { type: DataTypes.TEXT, allowNull: true },
  peopleCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  // The team, leader first: [{ userId, firstName, lastName, name, sex,
  // nationality, nationalId, phoneNumber, email, currentJob, isNew }] —
  // returning users are linked by userId, new ones become User rows.
  members: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  unitCode: { type: DataTypes.STRING(10), allowNull: false },                       // WS1 … WS8
  startDate: { type: DataTypes.DATEONLY, allowNull: false },
  endDate: { type: DataTypes.DATEONLY, allowNull: false },
  startTime: { type: DataTypes.STRING(5), allowNull: false },                       // HH:mm, daily
  endTime: { type: DataTypes.STRING(5), allowNull: false },
  termsAcceptedAt: { type: DataTypes.DATE, allowNull: false },
  status: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'pending' }, // pending | approved | rejected
  decisionNote: { type: DataTypes.TEXT, allowNull: true },
  decidedBy: { type: DataTypes.STRING(150), allowNull: true },
  decidedAt: { type: DataTypes.DATE, allowNull: true },
  decisionEmailSentAt: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'workspace_requests',
  timestamps: true,
  indexes: [{ fields: ['status'] }, { fields: ['unitCode'] }, { fields: ['startDate', 'endDate'] }]
});

module.exports = WorkspaceRequest;
