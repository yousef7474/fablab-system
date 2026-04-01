const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EmployeeEvaluation = sequelize.define('EmployeeEvaluation', {
  evaluationId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  employeeId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  createdById: {
    type: DataTypes.UUID,
    allowNull: false
  },
  scores: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: 'JSON object with criterion keys and their scores'
  },
  qualitative: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'JSON object for categories 8-9 (checkbox criteria without points)'
  },
  totalScore: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0
  },
  grade: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
    comment: 'Score out of 5 (totalScore / 20)'
  },
  bonusPoints: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
    comment: 'Every 100 excess points over 100 = 1 bonus point'
  },
  period: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Evaluation period label e.g. Q1 2026'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  evaluationDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'employee_evaluations',
  timestamps: true
});

module.exports = EmployeeEvaluation;
