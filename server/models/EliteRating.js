const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const EliteRating = sequelize.define('EliteRating', {
  ratingId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  eliteId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'elite_users',
      key: 'eliteId'
    }
  },
  ratedById: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'admins',
      key: 'adminId'
    }
  },
  // Type of rater: 'admin' or 'engineer'
  raterType: {
    type: DataTypes.ENUM('admin', 'engineer'),
    allowNull: false
  },
  // Rating period (e.g., 'January 2026', 'Q1 2026')
  period: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  // Individual criteria ratings (0-100 each)
  // الحضور والالتزام - Attendance & Commitment (20% weight)
  attendanceScore: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: { min: 0, max: 100 }
  },
  // جودة المشاريع - Project Quality (25% weight)
  projectQualityScore: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: { min: 0, max: 100 }
  },
  // التطور والتعلم - Development & Learning (20% weight)
  developmentScore: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: { min: 0, max: 100 }
  },
  // المشاركة الفعالة - Active Participation (15% weight)
  participationScore: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: { min: 0, max: 100 }
  },
  // العمل الجماعي - Teamwork (10% weight)
  teamworkScore: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: { min: 0, max: 100 }
  },
  // السلوك والأخلاق - Behavior & Ethics (10% weight)
  behaviorScore: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: { min: 0, max: 100 }
  },
  // Calculated weighted total for this rating (auto-calculated)
  totalScore: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0
  },
  // Optional notes
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  ratingDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'elite_ratings',
  timestamps: true,
  hooks: {
    beforeSave: (rating) => {
      // Calculate weighted total score
      // Weights: Attendance 20%, Project Quality 25%, Development 20%,
      // Participation 15%, Teamwork 10%, Behavior 10%
      rating.totalScore = (
        (rating.attendanceScore * 0.20) +
        (rating.projectQualityScore * 0.25) +
        (rating.developmentScore * 0.20) +
        (rating.participationScore * 0.15) +
        (rating.teamworkScore * 0.10) +
        (rating.behaviorScore * 0.10)
      ).toFixed(2);
    }
  }
});

module.exports = EliteRating;
