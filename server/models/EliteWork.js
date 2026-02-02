const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EliteWork = sequelize.define('EliteWork', {
  workId: {
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
  // Optional link to assigned task
  taskId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'elite_tasks',
      key: 'taskId'
    }
  },
  // Work Details
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  // Media/Files (JSON array of files)
  files: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
    // Format: [{name: 'photo.jpg', type: 'image/jpeg', data: 'base64...', uploadedAt: 'date'}]
  },
  // Thumbnail for preview (base64 image)
  thumbnail: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Documentation (rich text/markdown)
  documentation: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Status
  status: {
    type: DataTypes.ENUM('draft', 'submitted', 'reviewed', 'approved', 'rejected'),
    allowNull: false,
    defaultValue: 'draft'
  },
  // Admin Review
  reviewedById: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'admins',
      key: 'adminId'
    }
  },
  reviewDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  reviewNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Visibility
  isPublic: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
}, {
  tableName: 'elite_works',
  timestamps: true
});

module.exports = EliteWork;
