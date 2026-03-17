const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EliteCourseLesson = sequelize.define('EliteCourseLesson', {
  lessonId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  courseId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'elite_courses',
      key: 'courseId'
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
  order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  materials: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  }
}, {
  tableName: 'elite_course_lessons',
  timestamps: true
});

module.exports = EliteCourseLesson;
