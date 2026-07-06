const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FablabStaff = sequelize.define('FablabStaff', {
  staffId: {
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
    allowNull: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  position: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Job title / role (e.g. Trainer, Manager)'
  },
  nationalIdPhoto: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Base64 encoded image'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'fablab_staff',
  timestamps: true,
  hooks: {
    beforeValidate: (row) => {
      if (row.email === '') row.email = null;
      if (row.phone === '') row.phone = null;
      if (row.position === '') row.position = null;
    }
  }
});

module.exports = FablabStaff;
