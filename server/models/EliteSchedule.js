const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EliteSchedule = sequelize.define('EliteSchedule', {
  scheduleId: {
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
  createdById: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'admins',
      key: 'adminId'
    }
  },
  // Schedule Item Details
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('session', 'deadline', 'meeting', 'workshop', 'other'),
    allowNull: false,
    defaultValue: 'session'
  },
  // Date/Time
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  startTime: {
    type: DataTypes.TIME,
    allowNull: true
  },
  endTime: {
    type: DataTypes.TIME,
    allowNull: true
  },
  isAllDay: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  // Recurrence
  isRecurring: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  recurrencePattern: {
    type: DataTypes.ENUM('daily', 'weekly', 'monthly'),
    allowNull: true
  },
  recurrenceEndDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  // Location
  location: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  isOnline: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  onlineLink: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  // Status
  status: {
    type: DataTypes.ENUM('scheduled', 'completed', 'cancelled'),
    allowNull: false,
    defaultValue: 'scheduled'
  },
  // Notes
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Color for calendar display
  color: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: '#006c35'
  }
}, {
  tableName: 'elite_schedules',
  timestamps: true
});

module.exports = EliteSchedule;
