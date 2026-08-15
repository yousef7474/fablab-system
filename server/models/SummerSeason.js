const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A Summer FabLab "season" scopes a year's worth of programs, teachers,
// students and attendance. Same shape as MawhbaSeason so admin muscle
// memory carries over. Exactly one row has isActive=true at any time
// (enforced by the controller).
const SummerSeason = sequelize.define('SummerSeason', {
  seasonId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name:     { type: DataTypes.STRING, allowNull: false },
  year:     { type: DataTypes.INTEGER, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
  tableName: 'summer_seasons',
  timestamps: true
});

module.exports = SummerSeason;
