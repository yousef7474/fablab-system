const { sequelize, testConnection } = require('../config/database');
const User = require('./User');
const Registration = require('./Registration');
const Admin = require('./Admin');
const Employee = require('./Employee');
const Task = require('./Task');

// Define relationships
User.hasMany(Registration, { foreignKey: 'userId', as: 'registrations' });
Registration.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Task relationships
Task.belongsTo(Employee, { foreignKey: 'employeeId', as: 'assignee' });
Employee.hasMany(Task, { foreignKey: 'employeeId', as: 'tasks' });

Task.belongsTo(Admin, { foreignKey: 'createdById', as: 'creator' });
Admin.hasMany(Task, { foreignKey: 'createdById', as: 'createdTasks' });

// Sync database
const syncDatabase = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('✅ Database synchronized successfully.');
  } catch (error) {
    console.error('❌ Error synchronizing database:', error);
  }
};

module.exports = {
  sequelize,
  testConnection,
  User,
  Registration,
  Admin,
  Employee,
  Task,
  syncDatabase
};
