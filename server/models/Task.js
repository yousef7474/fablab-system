const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Task = sequelize.define('Task', {
  taskId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  employeeId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  createdById: {
    type: DataTypes.UUID,
    allowNull: true
  },
  createdByEmployeeId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Set when employee creates task for themselves'
  },
  dueDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  dueDateEnd: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'End date for multi-day assignments'
  },
  dueTime: {
    type: DataTypes.TIME,
    allowNull: true
  },
  dueTimeEnd: {
    type: DataTypes.TIME,
    allowNull: true,
    comment: 'End time for task (blocks calendar slot)'
  },
  blocksCalendar: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether this task blocks the calendar slot for customers'
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high'),
    defaultValue: 'medium'
  },
  status: {
    type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'cancelled', 'uncompleted', 'pending_review'),
    defaultValue: 'pending'
  },
  section: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Section can be predefined or custom'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  reminderSent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether the deadline reminder email has been sent'
  }
}, {
  tableName: 'tasks',
  timestamps: true,
  hooks: {
    beforeValidate: (task) => {
      // Convert empty strings to null
      if (task.description === '') task.description = null;
      if (task.dueTime === '') task.dueTime = null;
      if (task.section === '') task.section = null;
      if (task.notes === '') task.notes = null;
    }
  }
});

module.exports = Task;
