// Simple script to create first admin user
// Run this after starting the server with: node createFirstAdmin.js

const axios = require('axios');

async function createFirstAdmin() {
  console.log('🔧 Creating first admin user...\n');

  try {
    const response = await axios.post('http://localhost:5000/api/admin/create-admin', {
      username: 'admin',
      email: 'admin@fablab.com',
      password: 'Admin@123',
      fullName: 'System Administrator'
    });

    console.log('✅ SUCCESS! Admin user created:');
    console.log('   Username:', response.data.admin.username);
    console.log('   Email:', response.data.admin.email);
    console.log('   Password: Admin@123');
    console.log('\n📝 Login at: http://localhost:3000/admin/login');
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('⚠️  Admin user already exists!');
      console.log('   Username: admin');
      console.log('   Password: Admin@123');
      console.log('\n📝 Login at: http://localhost:3000/admin/login');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('❌ ERROR: Cannot connect to server!');
      console.log('   Make sure the server is running with: npm run server');
    } else {
      console.log('❌ ERROR:', error.response?.data?.message || error.message);
    }
  }
}

createFirstAdmin();
