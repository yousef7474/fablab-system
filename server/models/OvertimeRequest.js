const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// One overtime request per submission. `days` holds an array of
// { date, hours, task } entries so the front-end can render / edit /
// print the per-day breakdown without a separate join.
const OvertimeRequest = sequelize.define('OvertimeRequest', {
  overtimeId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  employeeName:   { type: DataTypes.STRING, allowNull: false },
  nationalId:     { type: DataTypes.STRING, allowNull: true },
  phone:          { type: DataTypes.STRING, allowNull: true },
  email:          { type: DataTypes.STRING, allowNull: true, validate: { isEmail: true } },
  position:       { type: DataTypes.STRING, allowNull: true },
  periodStart:    { type: DataTypes.DATEONLY, allowNull: true },
  periodEnd:      { type: DataTypes.DATEONLY, allowNull: true },
  totalHours:     { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  // Admin who approved this overtime; shown as a row on the printed
  // سند and used as an audit trail.
  approvedBy:     { type: DataTypes.STRING, allowNull: true },
  note:           { type: DataTypes.TEXT, allowNull: true },
  days:           { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  createdById:    { type: DataTypes.UUID, allowNull: true }
}, {
  tableName: 'overtime_requests',
  timestamps: true,
  hooks: {
    beforeValidate: (row) => {
      if (row.email === '') row.email = null;
    }
  }
});

module.exports = OvertimeRequest;
