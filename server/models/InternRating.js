const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InternRating = sequelize.define('InternRating', {
  ratingId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  internId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  trainingId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Optional link to a specific training'
  },
  createdById: {
    type: DataTypes.UUID,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'award',
    validate: {
      isIn: [['award', 'deduction']]
    },
    comment: 'Type of rating - award (+1) or deduction (-1)'
  },
  points: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: {
      min: 1,
      max: 5
    },
    comment: 'Number of points (1-5)'
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
  tableName: 'intern_ratings',
  timestamps: true,
  hooks: {
    beforeValidate: (rating) => {
      if (rating.criteria === '') rating.criteria = null;
      if (rating.notes === '') rating.notes = null;
    }
  }
});

module.exports = InternRating;
