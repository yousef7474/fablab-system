const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EliteCourseEnrollment = sequelize.define('EliteCourseEnrollment', {
  enrollmentId: {
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
  eliteId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'elite_users',
      key: 'eliteId'
    }
  },
  status: {
    type: DataTypes.ENUM('enrolled', 'in_progress', 'completed', 'dropped'),
    allowNull: false,
    defaultValue: 'enrolled'
  },
  enrolledAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  lastAccessedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  progressPercent: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: { min: 0, max: 100 }
  },
  warningsSent: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  lastWarningSentAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  quizScore: {
    type: DataTypes.FLOAT,
    allowNull: true
  }
}, {
  tableName: 'elite_course_enrollments',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['courseId', 'eliteId']
    }
  ]
});

module.exports = EliteCourseEnrollment;
