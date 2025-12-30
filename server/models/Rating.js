const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Rating = sequelize.define('Rating', {
  ratingId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  employeeId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  createdById: {
    type: DataTypes.UUID,
    allowNull: false
  },
  points: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0,
      max: 100
    }
  },
  criteria: {
    type: DataTypes.STRING,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  ratingDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'ratings',
  timestamps: true,
  hooks: {
    beforeValidate: (rating) => {
      if (rating.criteria === '') rating.criteria = null;
      if (rating.notes === '') rating.notes = null;
    }
  }
});

module.exports = Rating;
