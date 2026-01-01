const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Volunteer = sequelize.define('Volunteer', {
  volunteerId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  nationalId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  nationalIdPhoto: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Base64 encoded image or file path'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'volunteers',
  timestamps: true,
  hooks: {
    beforeValidate: (volunteer) => {
      if (volunteer.email === '') volunteer.email = null;
    }
  }
});

module.exports = Volunteer;
