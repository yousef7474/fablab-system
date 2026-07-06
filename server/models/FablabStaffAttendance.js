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
  }
}, {
  tableName: 'fablab_staff_attendance',
  timestamps: true,
  indexes: [
    { fields: ['staffId', 'date'], unique: true }
  ]
});

module.exports = FablabStaffAttendance;
