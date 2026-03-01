const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EducationAttendance = sequelize.define('EducationAttendance', {
  attendanceId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  educationId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'educations',
      key: 'educationId'
    }
  },
  studentId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'education_students',
      key: 'studentId'
    }
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('present', 'absent'),
    allowNull: false,
    defaultValue: 'present'
  }
}, {
  tableName: 'education_attendance',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['educationId', 'studentId', 'date']
    }
  ]
});

module.exports = EducationAttendance;
