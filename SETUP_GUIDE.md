# FABLAB Registration System - Quick Setup Guide

## Overview

This guide will help you set up and run the FABLAB Al-Ahsa Registration System on your local machine.

## What You'll Need

1. **Node.js** (Download from https://nodejs.org - choose LTS version)
2. **PostgreSQL** (Download from https://www.postgresql.org/download/)
3. **SendGrid Account** (Sign up at https://sendgrid.com for free tier)
4. **Code Editor** (VS Code recommended)

## Step-by-Step Setup

### 1. Install PostgreSQL

1. Download and install PostgreSQL from https://www.postgresql.org/download/
2. During installation, remember the password you set for the postgres user
3. Use default port 5432
4. After installation, open pgAdmin (comes with PostgreSQL)

### 2. Create Database

Open pgAdmin and:
1. Right-click on "Databases"
2. Select "Create" → "Database"
3. Name it: `fablab_db`
4. Click "Save"

### 3. Get SendGrid API Key

1. Go to https://sendgrid.com and sign up (free tier available)
2. Verify your email address
3. Go to Settings → API Keys
4. Click "Create API Key"
5. Give it a name like "FABLAB System"
6. Choose "Full Access"
7. Copy the API key (you'll only see it once!)

### 4. Verify Email Sender

In SendGrid dashboard:
1. Go to Settings → Sender Authentication
2. Click "Verify a Single Sender"
3. Fill in your details
4. Verify the email they send you
5. Use this email as SENDGRID_FROM_EMAIL in .env

### 5. Configure Environment

1. In the project root folder, find `.env.example`
2. Copy it and rename to `.env`
3. Open `.env` and fill in:

```env
# Database (use your PostgreSQL password)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fablab_db
DB_USER=postgres
DB_PASSWORD=YOUR_POSTGRES_PASSWORD_HERE

# JWT (generate a random string)
JWT_SECRET=fablab_secret_key_2025_ahsa_secure

# SendGrid (use your API key and verified email)
SENDGRID_API_KEY=YOUR_SENDGRID_API_KEY_HERE
SENDGRID_FROM_EMAIL=your-verified-email@example.com
SENDGRID_FROM_NAME=FABLAB Al-Ahsa

# Employee Emails (use real emails where you want notifications sent)
EMPLOYEE_ELECTRONICS_EMAIL=electronics@example.com
EMPLOYEE_CNC_LASER_EMAIL=laser@example.com
EMPLOYEE_CNC_WOOD_EMAIL=wood@example.com
EMPLOYEE_3D_EMAIL=3d@example.com
EMPLOYEE_ROBOTIC_AI_EMAIL=robotic@example.com
EMPLOYEE_KIDS_CLUB_EMAIL=kids@example.com
EMPLOYEE_VINYL_CUTTING_EMAIL=vinyl@example.com
```

### 6. Install Dependencies

Open terminal/command prompt in project folder:

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install --legacy-peer-deps
cd ..
```

### 7. Start the System

```bash
# This will start both backend and frontend
npm run dev
```

Wait for both servers to start:
- Backend: http://localhost:5000
- Frontend: http://localhost:3000

Your browser should automatically open to http://localhost:3000

### 8. Create First Admin User

#### Option A: Using Postman/Insomnia

1. Download Postman from https://www.postman.com/downloads/
2. Create a new POST request to: `http://localhost:5000/api/admin/create-admin`
3. Set Headers: `Content-Type: application/json`
4. Set Body (raw JSON):
```json
{
  "username": "admin",
  "email": "admin@fablab.com",
  "password": "Admin@123",
  "fullName": "Administrator"
}
```
5. Click Send

#### Option B: Using curl (in terminal)

```bash
curl -X POST http://localhost:5000/api/admin/create-admin -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"email\":\"admin@fablab.com\",\"password\":\"Admin@123\",\"fullName\":\"Administrator\"}"
```

#### Option C: Create a script

Create file `createAdmin.js` in project root:

```javascript
const axios = require('axios');

async function createAdmin() {
  try {
    const response = await axios.post('http://localhost:5000/api/admin/create-admin', {
      username: 'admin',
      email: 'admin@fablab.com',
      password: 'Admin@123',
      fullName: 'Administrator'
    });
    console.log('✅ Admin created:', response.data);
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

createAdmin();
```

Run it:
```bash
node createAdmin.js
```

### 9. Access the System

#### Customer Registration:
- Open http://localhost:3000
- Fill out the registration form
- Test the multi-step process

#### Admin Dashboard:
- Go to http://localhost:3000/admin/login
- Login with:
  - Username: `admin`
  - Password: `Admin@123` (or what you set)
- Explore the dashboard

## Testing the System

### Test User Registration

1. Go to http://localhost:3000
2. Click through the registration form
3. Fill in sample data:
   - Application Type: Beneficiary
   - Name: Test User
   - Email: your-test-email@example.com
   - Phone: 0500000000
   - Section: 3D
   - Service: In-person consultation
   - Date: Tomorrow
   - Time: 12:00 PM
4. Submit
5. Check your email for confirmation

### Test Admin Functions

1. Login to admin dashboard
2. You should see the test registration
3. Try:
   - Approving the registration
   - Viewing user profile
   - Exporting to CSV
   - Viewing analytics

## Common Issues & Solutions

### Issue: "Cannot connect to database"
**Solution:**
- Check if PostgreSQL is running
- Verify database credentials in .env
- Make sure database `fablab_db` exists

### Issue: "Port 5000 already in use"
**Solution:**
- Change PORT in .env to 5001 or another port
- Update REACT_APP_API_URL in client/.env accordingly

### Issue: "Port 3000 already in use"
**Solution:**
- Kill the process using port 3000
- Or run `cd client && PORT=3001 npm start`

### Issue: "Emails not sending"
**Solution:**
- Verify SendGrid API key is correct
- Check sender email is verified in SendGrid
- Look at SendGrid dashboard for error logs
- Check spam folder

### Issue: "Module not found" errors
**Solution:**
```bash
rm -rf node_modules
rm -rf client/node_modules
npm run install-all
```

### Issue: Database tables not created
**Solution:**
- Check server console for errors
- Database tables are auto-created when server starts
- If issues persist, try:
```bash
# In server/models/index.js, temporarily change:
await sequelize.sync({ force: true }); // This will drop and recreate tables
# Then change back to:
await sequelize.sync({ alter: true });
```

## Next Steps

1. **Customize Employee Emails**: Update .env with real employee emails
2. **Test Email Flow**: Register and verify emails are sent
3. **Customize Branding**: Update colors in `client/src/config/theme.js`
4. **Add Real Data**: Create real admin users for your team
5. **Test Workflow**: Go through complete registration → approval flow

## Production Deployment (When Ready)

1. Get a domain name
2. Set up hosting (DigitalOcean, AWS, Heroku, etc.)
3. Set up production PostgreSQL database
4. Update environment variables for production
5. Build frontend: `cd client && npm run build`
6. Use PM2 to run backend in production
7. Set up nginx as reverse proxy
8. Get SSL certificate (Let's Encrypt)

## Support

If you encounter issues:
1. Check the console logs (both browser and server terminal)
2. Verify all environment variables are set correctly
3. Ensure PostgreSQL and Node.js are running
4. Check the troubleshooting section above

## Directory Structure

```
fablab-register/
├── server/
│   ├── config/         # Database configuration
│   ├── controllers/    # API logic
│   ├── models/         # Database models
│   ├── routes/         # API routes
│   ├── middleware/     # Auth middleware
│   ├── utils/          # Helper functions
│   └── index.js        # Server entry point
├── client/
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── config/     # Frontend config
│   │   ├── i18n.js     # Translations
│   │   └── App.js      # Main app component
│   └── public/         # Static files
├── .env                # Environment variables
├── package.json        # Dependencies
└── README.md           # Documentation
```

---

**Ready to start? Run `npm run dev` and open http://localhost:3000!**
