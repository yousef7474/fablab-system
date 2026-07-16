const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A "مدرب معاون" — assistant trainer we may call on for a training
// chance. Kept as a lightweight rolodex; assignments live in a
// separate model.
const TrainerAssistant = sequelize.define('TrainerAssistant', {
  trainerId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name:              { type: DataTypes.STRING, allowNull: false },
  phone:             { type: DataTypes.STRING, allowNull: true },
  nationalId:        { type: DataTypes.STRING, allowNull: true, unique: true },
  email:             { type: DataTypes.STRING, allowNull: true, validate: { isEmail: true } },
  age:               { type: DataTypes.INTEGER, allowNull: true },
  educationalDegree: { type: DataTypes.STRING, allowNull: true },
  skills:            { type: DataTypes.TEXT, allowNull: true },
  performanceRating: { type: DataTypes.FLOAT, allowNull: true },  // 0–5, admin's overall read
  notes:             { type: DataTypes.TEXT, allowNull: true },
  isActive:          { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
  tableName: 'trainer_assistants',
  timestamps: true,
  hooks: {
    beforeValidate: (row) => {
      if (row.email === '') row.email = null;
      if (row.nationalId === '') row.nationalId = null;
    }
  }
});

module.exports = TrainerAssistant;
