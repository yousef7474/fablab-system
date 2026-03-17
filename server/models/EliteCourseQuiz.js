const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EliteCourseQuiz = sequelize.define('EliteCourseQuiz', {
  quizId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  courseId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
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
  timeLimit: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  maxAttempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  }
}, {
  tableName: 'elite_course_quizzes',
  timestamps: true
});

module.exports = EliteCourseQuiz;
