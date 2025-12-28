// Run this script with: node create-manager.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { sequelize } = require('./config/database');
const Admin = require('./models/Admin');

async function createManager() {
  try {
    console.log('Connecting to database...');
    console.log('DB Host:', process.env.DB_HOST);
    console.log('DB Name:', process.env.DB_NAME);

    await sequelize.authenticate();
    console.log('Connected to database successfully!\n');

    // Sync the Admin model (in case table doesn't exist)
    await Admin.sync();

    // Check if manager already exists
    const existing = await Admin.findOne({ where: { username: 'manager' } });
    if (existing) {
      console.log('Manager account already exists!');
      console.log('Username:', existing.username);
      console.log('Role:', existing.role);
      await sequelize.close();
      process.exit(0);
    }

    // Create manager account
    const manager = await Admin.create({
      username: 'manager',
      email: 'manager@fablab.com',
      password: 'manager123',
      fullName: 'FABLAB Manager',
      role: 'manager'
    });

    console.log('Manager account created successfully!');
    console.log('================================');
    console.log('Username: manager');
    console.log('Password: manager123');
    console.log('Role:', manager.role);
    console.log('================================');
    console.log('\nPlease change the password after first login!');

  } catch (error) {
    console.error('Error details:', error.message);
    if (error.original) {
      console.error('Original error:', error.original.message);
    }
    console.error('Full error:', error);
  } finally {
    try {
      await sequelize.close();
    } catch (e) {}
    process.exit(0);
  }
}

createManager();
