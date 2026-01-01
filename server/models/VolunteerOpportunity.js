const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const VolunteerOpportunity = sequelize.define('VolunteerOpportunity', {
  opportunityId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  volunteerId: {
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
    comment: 'Simple 1 point rating - same as employee rating'
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
  tableName: 'volunteer_opportunities',
  timestamps: true,
  hooks: {
    beforeValidate: (opportunity) => {
      if (opportunity.description === '') opportunity.description = null;
      if (opportunity.ratingCriteria === '') opportunity.ratingCriteria = null;
      if (opportunity.ratingNotes === '') opportunity.ratingNotes = null;
    },
    beforeCreate: (opportunity) => {
      // Calculate total hours
      if (opportunity.startDate && opportunity.endDate && opportunity.dailyHours) {
        const start = new Date(opportunity.startDate);
        const end = new Date(opportunity.endDate);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        opportunity.totalHours = days * opportunity.dailyHours;
      }
    },
    beforeUpdate: (opportunity) => {
      // Recalculate total hours if dates or daily hours changed
      if (opportunity.changed('startDate') || opportunity.changed('endDate') || opportunity.changed('dailyHours')) {
        const start = new Date(opportunity.startDate);
        const end = new Date(opportunity.endDate);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        opportunity.totalHours = days * opportunity.dailyHours;
      }
    }
  }
});

module.exports = VolunteerOpportunity;
