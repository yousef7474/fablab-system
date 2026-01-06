const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InternTraining = sequelize.define('InternTraining', {
  trainingId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  internId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  dailyHours: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 8,
    comment: 'Hours worked per day'
  },
  totalHours: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Auto-calculated total hours'
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 1
    },
    comment: 'Simple 1 point rating'
  },
  ratingCriteria: {
    type: DataTypes.STRING,
    allowNull: true
  },
  ratingNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  createdById: {
    type: DataTypes.UUID,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('active', 'completed', 'cancelled'),
    defaultValue: 'active'
  }
}, {
  tableName: 'intern_trainings',
  timestamps: true,
  hooks: {
    beforeValidate: (training) => {
      if (training.description === '') training.description = null;
      if (training.ratingCriteria === '') training.ratingCriteria = null;
      if (training.ratingNotes === '') training.ratingNotes = null;
    },
    beforeCreate: (training) => {
      // Calculate total hours
      if (training.startDate && training.endDate && training.dailyHours) {
        const start = new Date(training.startDate);
        const end = new Date(training.endDate);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        training.totalHours = days * training.dailyHours;
      }
    },
    beforeUpdate: (training) => {
      // Recalculate total hours if dates or daily hours changed
      if (training.changed('startDate') || training.changed('endDate') || training.changed('dailyHours')) {
        const start = new Date(training.startDate);
        const end = new Date(training.endDate);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        training.totalHours = days * training.dailyHours;
      }
    }
  }
});

module.exports = InternTraining;
