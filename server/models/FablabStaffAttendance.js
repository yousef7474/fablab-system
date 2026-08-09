const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FablabStaffAttendance = sequelize.define('FablabStaffAttendance', {
  attendanceId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  staffId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  checkInAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  checkOutAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Overtime annotation — filled by admin after the day is scanned.
  // The overtime hours themselves are derived from checkInAt/checkOutAt
  // (anything > 9h is overtime), so we don't store them; we only store
  // the two admin-facing fields the auto-computed row carries.
  reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  approvedBy: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'fablab_staff_attendance',
  timestamps: true,
  indexes: [
    { fields: ['staffId', 'date'], unique: true }
  ]
});

module.exports = FablabStaffAttendance;
