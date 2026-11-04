const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Workshop request (طلب ورشة) an employee builds from one of their
// approved training kits and sends for approval: employee → project
// manager (مسؤول إدارة المشاريع) → manager — the same flow as the kits.
// `data` is the working draft (client/src/components/Requests/workshop/
// wrModel.js); every submission freezes a copy in WorkshopRequestVersion.
// The manager's approval creates the real Workshop (workshopId).
const WorkshopRequest = sequelize.define('WorkshopRequest', {
  requestId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  requestNumber: {
    type: DataTypes.INTEGER,
    allowNull: true,
    unique: true
  },
  employeeId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: true
  },
  data: {
    type: DataTypes.JSON,
    allowNull: true
  },
  // Completion % of the draft (the form's checks), saved by the editor.
  completion: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // draft → pm_review → manager_review → approved; a reviewer can send
  // it back (returned, with returnedBy = 'pm' | 'manager').
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'draft'
  },
  returnedBy: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  currentVersion: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  submittedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  approvedVersion: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  // The workshop created when the manager approved the request.
  workshopId: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  tableName: 'workshop_requests',
  timestamps: true,
  // The manager's delete is a soft delete (deletedAt) — gone from every
  // screen, still recoverable in the database.
  paranoid: true
});

module.exports = WorkshopRequest;
