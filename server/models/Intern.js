const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Intern = sequelize.define('Intern', {
  internId: {
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
  university: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'University name'
  },
  major: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Field of study/major'
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
  tableName: 'interns',
  timestamps: true,
  hooks: {
    beforeValidate: (intern) => {
      if (intern.email === '') intern.email = null;
      if (intern.university === '') intern.university = null;
      if (intern.major === '') intern.major = null;
    }
  }
});

module.exports = Intern;
