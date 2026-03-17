const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EliteQuizQuestion = sequelize.define('EliteQuizQuestion', {
  questionId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  quizId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'elite_course_quizzes',
      key: 'quizId'
    }
  },
  order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  type: {
    type: DataTypes.ENUM('mcq', 'written'),
    allowNull: false
  },
  questionText: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  options: {
    type: DataTypes.JSON,
    allowNull: true
  },
  correctAnswer: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  points: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  }
}, {
  tableName: 'elite_quiz_questions',
  timestamps: true
});

module.exports = EliteQuizQuestion;
