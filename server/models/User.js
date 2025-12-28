const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  userId: {
    type: DataTypes.STRING,
    primaryKey: true,
    unique: true
  },
  applicationType: {
    type: DataTypes.ENUM(
      'Beneficiary',
      'Visitor',
      'Volunteer',
      'Talented',
      'Entity',
      'FABLAB Visit'
    ),
    allowNull: false
  },
  // Personal Info (for Beneficiary, Talented, Volunteer, Visitor)
  firstName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  sex: {
    type: DataTypes.ENUM('Male', 'Female'),
    allowNull: true
  },
  nationality: {
    type: DataTypes.STRING,
    allowNull: true
  },
  nationalId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true
  },
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false
  },
  currentJob: {
    type: DataTypes.STRING,
    allowNull: true
  },
  nationalAddress: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // For Entity type
  entityName: {
    type: DataTypes.ENUM(
      'FABLAB AL-Ahsa',
      'Noura Al-Mousa House for Culture and Arts',
      'Al-Ahsa Academy for Crafts',
      'Creativity and Innovation Training Center',
      'Abdulmonem Al-Rashed Foundation'
    ),
    allowNull: true
  },
  // For FABLAB Visit type
  visitingEntity: {
    type: DataTypes.STRING,
    allowNull: true
  },
  personInCharge: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // Common fields
  name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  profilePicture: {
    type: DataTypes.TEXT('long'),
    allowNull: true
  }
}, {
  tableName: 'users',
  timestamps: true,
  hooks: {
    beforeValidate: (user) => {
      // Convert empty strings to null for ENUM fields
      if (user.entityName === '') user.entityName = null;
      if (user.sex === '') user.sex = null;
      if (user.applicationType === '') user.applicationType = null;
    },
    beforeCreate: (user) => {
      // Ensure empty strings are converted to null for all nullable fields
      const nullableFields = [
        'firstName', 'lastName', 'sex', 'nationality', 'nationalId',
        'currentJob', 'nationalAddress', 'entityName', 'visitingEntity',
        'personInCharge', 'name', 'profilePicture'
      ];
      nullableFields.forEach(field => {
        if (user[field] === '') user[field] = null;
      });
    }
  }
});

module.exports = User;
