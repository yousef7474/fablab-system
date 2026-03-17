const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EliteLessonProgress = sequelize.define('EliteLessonProgress', {
  progressId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  enrollmentId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'elite_course_enrollments',
      key: 'enrollmentId'
    }
  },
  lessonId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'elite_course_lessons',
      key: 'lessonId'
    }
  },
  completed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  accessedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'elite_lesson_progress',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['enrollmentId', 'lessonId']
    }
  ]
});

module.exports = EliteLessonProgress;
