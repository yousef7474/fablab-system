const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EliteCourse = sequelize.define('EliteCourse', {
  courseId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  createdById: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'admins',
      key: 'adminId'
    }
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  thumbnail: {
    type: DataTypes.TEXT('long'),
    allowNull: true
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('draft', 'active', 'completed', 'archived'),
    allowNull: false,
    defaultValue: 'active'
  },
  inactivityDays: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 7
  },
  passingScore: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 60
  }
}, {
  tableName: 'elite_courses',
  timestamps: true
});

module.exports = EliteCourse;
