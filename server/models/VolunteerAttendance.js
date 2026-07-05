const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const VolunteerAttendance = sequelize.define('VolunteerAttendance', {
  attendanceId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  volunteerId: {
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
  tableName: 'volunteer_attendance',
  timestamps: true,
  indexes: [
    { fields: ['volunteerId', 'date'], unique: true }
  ]
});

module.exports = VolunteerAttendance;
