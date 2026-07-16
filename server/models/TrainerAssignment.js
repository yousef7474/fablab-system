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
  // Legacy single-day date. New rows use startAt/endAt (which include
  // the time). Kept so old records still display something sensible.
  chanceDate: { type: DataTypes.DATEONLY, allowNull: true },
  startAt:    { type: DataTypes.DATE, allowNull: true },
  endAt:      { type: DataTypes.DATE, allowNull: true },
  // Per-criterion scores (0–5 each): { punctuality, technical,
  // delivery, engagement, preparation }. `rating` is the average of
  // whatever keys are present, and is what UI/list views use.
  criteria:   { type: DataTypes.JSON, allowNull: true },
  rating:     { type: DataTypes.FLOAT, allowNull: true },  // computed from criteria; 0–5
  notes:      { type: DataTypes.TEXT, allowNull: true }
}, {
  tableName: 'trainer_assignments',
  timestamps: true
});

module.exports = TrainerAssignment;
