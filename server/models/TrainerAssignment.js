const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A "chance" (training opportunity) given to an assistant trainer.
// Each row lets the admin rate that specific engagement.
const TrainerAssignment = sequelize.define('TrainerAssignment', {
  assignmentId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  trainerId:  { type: DataTypes.UUID, allowNull: false },
  chanceName: { type: DataTypes.STRING, allowNull: false },
  destination:{ type: DataTypes.STRING, allowNull: true },
  chanceDate: { type: DataTypes.DATEONLY, allowNull: true },
  rating:     { type: DataTypes.FLOAT, allowNull: true },  // 0–5 for this chance
  notes:      { type: DataTypes.TEXT, allowNull: true }
}, {
  tableName: 'trainer_assignments',
  timestamps: true
});

module.exports = TrainerAssignment;
