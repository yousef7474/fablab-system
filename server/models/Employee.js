const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Employee = sequelize.define('Employee', {
  employeeId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  section: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Can be predefined sections or custom sections added by manager'
  },
  isCustomSection: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'True if this is a custom section added by manager'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'employees',
  timestamps: true
});

module.exports = Employee;
