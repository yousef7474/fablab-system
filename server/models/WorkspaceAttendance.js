const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Check-in / check-out of a workspace team member at the attendance
// station (card QR FL:WSM:<nationalId>), one row per person per day.
const WorkspaceAttendance = sequelize.define('WorkspaceAttendance', {
  attendanceId: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  requestId: { type: DataTypes.UUID, allowNull: false },
  personKey: { type: DataTypes.STRING(40), allowNull: false },   // national ID (or user ID)
  memberName: { type: DataTypes.STRING(200), allowNull: true },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  checkInAt: { type: DataTypes.DATE, allowNull: false },
  checkOutAt: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'workspace_attendance',
  timestamps: true,
  indexes: [{ unique: true, fields: ['personKey', 'date'] }, { fields: ['date'] }]
});

module.exports = WorkspaceAttendance;
