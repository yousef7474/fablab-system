const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WorkspaceRating = sequelize.define('WorkspaceRating', {
  ratingId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  workspaceId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'workspaces',
      key: 'workspaceId'
    }
  },
  // Rating type: award (positive) or deduct (negative)
  type: {
    type: DataTypes.ENUM('award', 'deduct'),
    allowNull: false,
    defaultValue: 'award'
  },
  // Points (always positive, type determines if added or subtracted)
  points: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  // Rating criteria
  criteria: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // Additional notes
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Rating date
  ratingDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  // Rated by manager
  createdById: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'admins',
      key: 'adminId'
    }
  }
}, {
  tableName: 'workspace_ratings',
  timestamps: true
});

module.exports = WorkspaceRating;
