const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Education = sequelize.define('Education', {
  educationId: {
    type: DataTypes.STRING,
    primaryKey: true,
    unique: true
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'users',
      key: 'userId'
    }
  },
  section: {
    type: DataTypes.STRING,
    allowNull: false
  },
  otherSectionDescription: {
    type: DataTypes.STRING,
    allowNull: true
  },
  numberOfStudents: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  periodStartDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  periodEndDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  periodStartTime: {
    type: DataTypes.STRING,
    allowNull: false
  },
  periodEndTime: {
    type: DataTypes.STRING,
    allowNull: false
  },
  roomPhotoBefore: {
    type: DataTypes.TEXT('long'),
    allowNull: false
  },
  signature: {
    type: DataTypes.STRING,
    allowNull: false
  },
  termsAccepted: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'active', 'completed', 'rejected'),
    defaultValue: 'pending'
  },
  adminNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  approvedById: {
    type: DataTypes.STRING,
    allowNull: true,
    references: {
      model: 'admins',
      key: 'adminId'
    }
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'educations',
  timestamps: true,
  hooks: {
    beforeCreate: (education) => {
      const nullableFields = ['otherSectionDescription', 'adminNotes', 'approvedById', 'approvedAt'];
      nullableFields.forEach(field => {
        if (education[field] === '') education[field] = null;
      });
    }
  }
});

module.exports = Education;
