const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// One submitted version of a workshop request — a frozen copy of the
// employee's draft plus each reviewer's decision and comments on it.
// Together they are the request's edit history.
const WorkshopRequestVersion = sequelize.define('WorkshopRequestVersion', {
  versionId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  requestId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  versionNumber: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  data: {
    type: DataTypes.JSON,
    allowNull: false
  },
  completion: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // What the employee changed in this version (required after a return).
  note: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  submittedAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  // Project manager's review: 'approved' | 'returned'
  pmDecision: { type: DataTypes.STRING(10), allowNull: true },
  pmComment: { type: DataTypes.TEXT, allowNull: true },
  pmName: { type: DataTypes.STRING, allowNull: true },
  pmEmployeeId: { type: DataTypes.UUID, allowNull: true },
  pmAt: { type: DataTypes.DATE, allowNull: true },
  // Manager's review: 'approved' | 'returned'
  managerDecision: { type: DataTypes.STRING(10), allowNull: true },
  managerComment: { type: DataTypes.TEXT, allowNull: true },
  managerName: { type: DataTypes.STRING, allowNull: true },
  managerAdminId: { type: DataTypes.UUID, allowNull: true },
  managerAt: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'workshop_request_versions',
  timestamps: true,
  indexes: [{ fields: ['requestId', 'versionNumber'], unique: true }]
});

module.exports = WorkshopRequestVersion;
