const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Execution plan (الخطة التنفيذية) an employee prepares for a month or a
// quarter and sends for approval: employee → project manager (مسؤول إدارة
// المشاريع) → manager — the same flow as the training kits.
// `data` is the working draft in the shape of the plan template
// (client/src/components/ExecutionPlans/planModel.js); every submission
// freezes a copy in ExecutionPlanVersion, which is what reviewers see.
const ExecutionPlan = sequelize.define('ExecutionPlan', {
  planId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  planNumber: {
    type: DataTypes.INTEGER,
    allowNull: true,
    unique: true
  },
  employeeId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: true
  },
  data: {
    type: DataTypes.JSON,
    allowNull: true
  },
  // Completion % of the draft (the template's checks), saved by the editor.
  completion: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // draft → pm_review → manager_review → approved; a reviewer can send
  // it back (returned, with returnedBy = 'pm' | 'manager').
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'draft'
  },
  returnedBy: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  currentVersion: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  submittedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  approvedVersion: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'execution_plans',
  timestamps: true,
  // The manager's delete is a soft delete (deletedAt) — gone from every
  // screen, still recoverable in the database.
  paranoid: true
});

module.exports = ExecutionPlan;
