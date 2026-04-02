const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EmployeeActivity = sequelize.define('EmployeeActivity', {
  activityId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  employeeId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  totalMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Total active minutes on dashboard for this day'
  },
  loginCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Number of times logged in this day'
  },
  lastHeartbeat: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Last heartbeat timestamp for active session tracking'
  },
  interacted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether employee performed actions (task updates, etc.)'
  }
}, {
  tableName: 'employee_activities',
  timestamps: true,
  indexes: [
    { fields: ['employeeId', 'date'], unique: true }
  ]
});

module.exports = EmployeeActivity;
