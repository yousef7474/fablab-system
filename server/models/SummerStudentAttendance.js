const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Attendance record for a Summer FabLab student — mirrors the Mawhba
// attendance shape so the shared UnifiedAttendancePage / QR scanner
// flow works identically for both programs. One row per student per
// day (unique index); check-in creates the row, second scan sets
// checkOutAt, third scan is refused as "already done today".
const SummerStudentAttendance = sequelize.define('SummerStudentAttendance', {
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
  tableName: 'summer_student_attendance',
  timestamps: true,
  indexes: [
    { fields: ['studentId', 'date'], unique: true }
  ]
});

module.exports = SummerStudentAttendance;
