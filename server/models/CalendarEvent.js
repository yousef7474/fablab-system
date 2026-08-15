const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Year-planning calendar events. Each row is either a single day
// (endDate null / equal to startDate) or a range. `year` is stored
// explicitly for cheap year-scoped queries and for events that
// span year boundaries we can just create two rows.
const CalendarEvent = sequelize.define('CalendarEvent', {
  eventId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  year:        { type: DataTypes.INTEGER, allowNull: false },
  startDate:   { type: DataTypes.DATEONLY, allowNull: false },
  endDate:     { type: DataTypes.DATEONLY, allowNull: true },
  title:       { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  // Categorises the event visually — colored dot, badge, etc.
  // 'task' | 'reminder' | 'meeting' | 'event' | 'holiday' | 'other'
  category:    { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'task' },
  // Optional per-event color override. When null, the UI falls back
  // to the category's default hue.
  color:       { type: DataTypes.STRING(16), allowNull: true },
  isImportant: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  createdBy:   { type: DataTypes.STRING, allowNull: true },
  assignedTo:  { type: DataTypes.STRING, allowNull: true }
}, {
  tableName: 'calendar_events',
  timestamps: true,
  indexes: [
    { fields: ['year'] },
    { fields: ['startDate'] }
  ]
});

module.exports = CalendarEvent;
