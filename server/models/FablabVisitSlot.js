const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A visit window the admin opens on the calendar. The public visit form
// only offers these; one group books a whole slot (capacity = the most
// visitors that group may bring). A slot is "booked" while a visit that
// points at it hasn't been rejected — see fablabVisitController.
const FablabVisitSlot = sequelize.define('FablabVisitSlot', {
  slotId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  date:      { type: DataTypes.DATEONLY, allowNull: false },
  startTime: { type: DataTypes.TIME, allowNull: false },
  endTime:   { type: DataTypes.TIME, allowNull: false },
  capacity:  { type: DataTypes.INTEGER, allowNull: false },
  // Off = hidden from the public form without deleting it.
  isActive:  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  notes:     { type: DataTypes.TEXT, allowNull: true },
  createdBy: { type: DataTypes.STRING, allowNull: true }
}, {
  tableName: 'fablab_visit_slots',
  timestamps: true,
  indexes: [{ fields: ['date'] }]
});

module.exports = FablabVisitSlot;
