const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A file uploaded into an execution plan — a target's approved content,
// detailed financial file, media requirements or volunteer designs.
// Files are immutable and referenced by id from the plan data, so
// versions that keep the same file don't store it twice.
const ExecutionPlanFile = sequelize.define('ExecutionPlanFile', {
  fileId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  planId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  kind: {
    type: DataTypes.STRING(12), // 'attachment' | 'image'
    allowNull: false,
    defaultValue: 'attachment'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  mime: {
    type: DataTypes.STRING,
    allowNull: true
  },
  size: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  content: {
    type: DataTypes.BLOB,
    allowNull: false
  },
  uploadedBy: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  tableName: 'execution_plan_files',
  timestamps: true,
  indexes: [{ fields: ['planId'] }]
});

module.exports = ExecutionPlanFile;
