const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MawhbaCourseColor = sequelize.define('MawhbaCourseColor', {
  courseColorId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  courseName: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  color: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: '#8b5cf6'
  }
}, {
  tableName: 'mawhba_course_colors',
  timestamps: true
});

module.exports = MawhbaCourseColor;
