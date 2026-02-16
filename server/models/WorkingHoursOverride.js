const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WorkingHoursOverride = sequelize.define('WorkingHoursOverride', {
  overrideId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  startTime: {
    type: DataTypes.STRING(5),
    allowNull: false,
    comment: 'HH:mm format'
  },
  endTime: {
    type: DataTypes.STRING(5),
    allowNull: false,
    comment: 'HH:mm format'
  },
  workingDays: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: 'Array of day numbers 0-6 (0=Sunday)'
  },
  labelEn: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: 'Label in English (e.g. Ramadan Hours)'
  },
  labelAr: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Label in Arabic'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  createdById: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'admins',
      key: 'adminId'
    }
  }
}, {
  tableName: 'working_hours_overrides',
  timestamps: true
});

module.exports = WorkingHoursOverride;
