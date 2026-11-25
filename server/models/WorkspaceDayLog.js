const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// The admins' day-by-day rating of an accepted workspace booking: a 1–5
// rating, notes and photos (downscaled data URLs) for one day.
const WorkspaceDayLog = sequelize.define('WorkspaceDayLog', {
  logId: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  requestId: { type: DataTypes.UUID, allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  rating: { type: DataTypes.INTEGER, allowNull: false },
  notes: { type: DataTypes.TEXT, allowNull: true },
  images: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  createdBy: { type: DataTypes.STRING(150), allowNull: true }
}, {
  tableName: 'workspace_day_logs',
  timestamps: true,
  indexes: [{ fields: ['requestId'] }]
});

module.exports = WorkspaceDayLog;
