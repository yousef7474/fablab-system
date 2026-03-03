const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ManagerTodoHistory = sequelize.define('ManagerTodoHistory', {
  historyId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  todoId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'manager_todos',
      key: 'todoId'
    }
  },
  previousStatus: {
    type: DataTypes.STRING,
    allowNull: false
  },
  newStatus: {
    type: DataTypes.STRING,
    allowNull: false
  },
  changedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'manager_todo_history',
  timestamps: true
});

module.exports = ManagerTodoHistory;
