const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const EliteCredit = sequelize.define('EliteCredit', {
  creditId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  eliteId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'elite_users',
      key: 'eliteId'
    }
  },
  // Who added/deducted the credit (null for system-generated)
  createdById: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'admins',
      key: 'adminId'
    }
  },
  // Type of credit transaction
  type: {
    type: DataTypes.ENUM('award', 'deduction'),
    allowNull: false
  },
  // Source of the credit
  source: {
    type: DataTypes.ENUM('admin', 'engineer', 'system', 'task', 'course'),
    allowNull: false
  },
  // Points value (positive number, type determines add/subtract)
  points: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: { min: 1, max: 100 }
  },
  // Reason/description for the credit
  reason: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  // Optional reference to related task/course
  referenceType: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  referenceId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  creditDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'elite_credits',
  timestamps: true
});

module.exports = EliteCredit;
