const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Workspace = sequelize.define('Workspace', {
  workspaceId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  tableNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  numberOfUsers: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  // Person in charge info
  personName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  personPhone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  personEmail: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // Period info
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  startTime: {
    type: DataTypes.TIME,
    allowNull: false
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  endTime: {
    type: DataTypes.TIME,
    allowNull: false
  },
  // Photo before
  photoBefore: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Photo after (optional)
  photoAfter: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Status
  status: {
    type: DataTypes.ENUM('active', 'completed', 'cancelled'),
    defaultValue: 'active'
  },
  // Manager notes
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Total points from ratings
  totalPoints: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // Created by manager
  createdById: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'admins',
      key: 'adminId'
    }
  }
}, {
  tableName: 'workspaces',
  timestamps: true
});

module.exports = Workspace;
