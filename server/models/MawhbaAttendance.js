const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MawhbaAttendance = sequelize.define('MawhbaAttendance', {
  attendanceId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  studentId: {
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
  tableName: 'mawhba_attendance',
  timestamps: true,
  indexes: [
    { fields: ['studentId', 'date'], unique: true }
  ]
});

module.exports = MawhbaAttendance;
