const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A Mawhba "season" scopes a year's worth of students and attendance —
// e.g. موهبة 2026, موهبة 2027, ... — so each new year the admin gets a
// clean roster without deleting previous years' records. Exactly one
// row has isActive=true at any time (enforced in the controller).
const MawhbaSeason = sequelize.define('MawhbaSeason', {
  seasonId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'mawhba_seasons',
  timestamps: true
});

module.exports = MawhbaSeason;
