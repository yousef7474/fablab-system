const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EliteQuizAttempt = sequelize.define('EliteQuizAttempt', {
  attemptId: {
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
  eliteId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'elite_users',
      key: 'eliteId'
    }
  },
  enrollmentId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'elite_course_enrollments',
      key: 'enrollmentId'
    }
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  submittedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  score: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  totalPoints: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  earnedPoints: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('in_progress', 'submitted', 'graded'),
    allowNull: false,
    defaultValue: 'in_progress'
  },
  answers: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  }
}, {
  tableName: 'elite_quiz_attempts',
  timestamps: true
});

module.exports = EliteQuizAttempt;
