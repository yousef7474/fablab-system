const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EducationStudent = sequelize.define('EducationStudent', {
  studentId: {
    type: DataTypes.STRING,
    primaryKey: true,
    unique: true
  },
  educationId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'educations',
      key: 'educationId'
    }
  },
  fullName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  nationalId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  schoolName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  educationLevel: {
    type: DataTypes.STRING,
    allowNull: false
  },
  parentPhoneNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  personalPhoto: {
    type: DataTypes.TEXT('long'),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: { isEmail: true }
  },
  qrCode: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Unique QR identifier for attendance scanning'
  },
  status: {
    type: DataTypes.ENUM('active', 'removed'),
    defaultValue: 'active'
  }
}, {
  tableName: 'education_students',
  timestamps: true
});

module.exports = EducationStudent;
