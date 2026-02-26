const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const EducationRating = sequelize.define('EducationRating', {
  ratingId: {
    type: DataTypes.STRING,
    primaryKey: true,
    defaultValue: () => uuidv4()
  },
  educationId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'educations',
      key: 'educationId'
    }
  },
  ratingDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  cleanlinessScore: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 5
    }
  },
  damageLevel: {
    type: DataTypes.ENUM('none', 'minor', 'moderate', 'severe'),
    allowNull: false,
    defaultValue: 'none'
  },
  damageDescription: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  roomPhoto: {
    type: DataTypes.TEXT('long'),
    allowNull: true
  },
  comments: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  createdById: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'admins',
      key: 'adminId'
    }
  }
}, {
  tableName: 'education_ratings',
  timestamps: true,
  hooks: {
    beforeCreate: (rating) => {
      const nullableFields = ['damageDescription', 'roomPhoto', 'comments'];
      nullableFields.forEach(field => {
        if (rating[field] === '') rating[field] = null;
      });
    }
  }
});

module.exports = EducationRating;
