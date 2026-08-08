const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Mirrors VolunteerAttendance — one row per trainer × date, storing
// the raw QR check-in / check-out timestamps. Admin can manually add
// or edit rows through the same UX we ship for volunteers.
const TrainerAssistantAttendance = sequelize.define('TrainerAssistantAttendance', {
  attendanceId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  trainerId: {
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
  tableName: 'trainer_assistant_attendance',
  timestamps: true,
  indexes: [
    { fields: ['trainerId', 'date'], unique: true }
  ]
});

module.exports = TrainerAssistantAttendance;
