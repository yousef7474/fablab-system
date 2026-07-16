const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Attendance rows for University Training interns — one row per
// intern per calendar day. checkInAt is set on the first scan,
// checkOutAt on the second.
const InternAttendance = sequelize.define('InternAttendance', {
  attendanceId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  internId: {
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
  tableName: 'intern_attendance',
  timestamps: true,
  indexes: [
    { fields: ['internId', 'date'], unique: true }
  ]
});

module.exports = InternAttendance;
