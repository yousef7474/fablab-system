const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EliteTask = sequelize.define('EliteTask', {
  taskId: {
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
  createdById: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'admins',
      key: 'adminId'
    }
  },
  // Task Details
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('task', 'course', 'project', 'assignment'),
    allowNull: false,
    defaultValue: 'task'
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  // Dates
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  // Status & Progress
  status: {
    type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending'
  },
  progress: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: { min: 0, max: 100 }
  },
  // Content/Resources (JSON array of attachments)
  attachments: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
    // Format: [{name: 'file.pdf', type: 'application/pdf', data: 'base64...', url: 'optional'}]
  },
  // Rating when completed
  rating: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: { min: 0, max: 100 }
  },
  feedback: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Credits awarded on completion
  creditsAwarded: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  // Priority
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high'),
    allowNull: false,
    defaultValue: 'medium'
  }
}, {
  tableName: 'elite_tasks',
  timestamps: true,
  hooks: {
    beforeUpdate: (task) => {
      // Auto-set status to in_progress if progress > 0 and status is pending
      if (task.progress > 0 && task.status === 'pending') {
        task.status = 'in_progress';
      }
      // Auto-set status to completed if progress reaches 100
      if (task.progress === 100 && task.status !== 'completed') {
        task.status = 'completed';
      }
    }
  }
});

module.exports = EliteTask;
