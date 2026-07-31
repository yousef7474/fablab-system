const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

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
  password: {
    type: DataTypes.STRING,
    allowNull: true
  },
  mustChangePassword: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  section: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Legacy primary section — kept in sync with sections[0] for back-compat. New code should read the sections[] array.'
  },
  sections: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Every FabLab section the employee works in. One employee = one row (unique email), but they can span multiple sections.'
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
  timestamps: true,
  hooks: {
    beforeCreate: async (employee) => {
      if (employee.password) {
        const salt = await bcrypt.genSalt(10);
        employee.password = await bcrypt.hash(employee.password, salt);
      }
    },
    beforeUpdate: async (employee) => {
      if (employee.changed('password') && employee.password) {
        const salt = await bcrypt.genSalt(10);
        employee.password = await bcrypt.hash(employee.password, salt);
      }
    }
  }
});

Employee.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = Employee;
