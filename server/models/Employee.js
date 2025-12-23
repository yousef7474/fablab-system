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
    type: DataTypes.ENUM(
      'Electronics and Programming',
      'CNC Laser',
      'CNC Wood',
      '3D',
      'Robotic and AI',
      "Kid's Club",
      'Vinyl Cutting'
    ),
    allowNull: false
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
