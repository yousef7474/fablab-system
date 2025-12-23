const { sequelize } = require('../config/database');
const User = require('./User');
const Registration = require('./Registration');
const Admin = require('./Admin');
const Employee = require('./Employee');

// Define relationships
User.hasMany(Registration, { foreignKey: 'userId', as: 'registrations' });
Registration.belongsTo(User, { foreignKey: 'userId', as: 'user' });

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
  User,
  Registration,
  Admin,
  Employee,
  syncDatabase
};
