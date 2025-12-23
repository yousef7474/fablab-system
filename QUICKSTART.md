# ⚡ Quick Start Guide

## Prerequisites Checklist

Before starting, make sure you have:
- ✅ Node.js installed (v14 or higher) - Download from https://nodejs.org
- ✅ PostgreSQL installed and running - Download from https://www.postgresql.org
- ✅ PostgreSQL database created named `fablab_db`
- ✅ SendGrid API key (optional for testing, required for emails)

## 🚀 5-Minute Setup

### Step 1: Install Dependencies (2 minutes)

Open terminal in project folder and run:

```bash
npm install
```

Then install client dependencies:

```bash
cd client
npm install --legacy-peer-deps
cd ..
```

### Step 2: Configure Database (1 minute)

1. Open `.env` file in the root folder
2. Update these lines with your PostgreSQL password:

```env
DB_PASSWORD=your_postgres_password_here
```

**Default PostgreSQL credentials:**
- Username: `postgres`
- Password: (the one you set during PostgreSQL installation)
- Database: `fablab_db` (create this in pgAdmin if you haven't)

### Step 3: Start the System (30 seconds)

In the terminal, run:

```bash
npm run dev
```

This starts both:
- Backend server on http://localhost:5000
- Frontend website on http://localhost:3000

Your browser should open automatically to http://localhost:3000

### Step 4: Create Admin User (30 seconds)

**Open a NEW terminal** (keep the first one running!) and run:

```bash
node createFirstAdmin.js
```

You should see:
```
✅ SUCCESS! Admin user created:
   Username: admin
   Password: Admin@123
```

## 🎉 You're Done! Test the System

### Test Customer Registration:

1. Go to http://localhost:3000
2. You'll see the user lookup screen
3. Click "New Registration"
4. Fill out the 8-step form
5. Submit and see your registration ID with QR code!

### Test Admin Dashboard:

1. Go to http://localhost:3000/admin/login
2. Login with:
   - Username: `admin`
   - Password: `Admin@123`
3. See the dashboard with statistics

## 📧 Email Setup (Optional for Testing)

The system will work WITHOUT email, but emails won't be sent. To enable emails:

1. Go to https://sendgrid.com and sign up (free tier available)
2. Get your API key from SendGrid dashboard
3. Open `.env` file
4. Update:
```env
SENDGRID_API_KEY=your_actual_sendgrid_api_key
SENDGRID_FROM_EMAIL=your-verified-email@example.com
```

## 🔧 Troubleshooting

### Problem: "Cannot connect to database"

**Solution:**
1. Make sure PostgreSQL is running
2. Open pgAdmin
3. Create database named `fablab_db` if it doesn't exist
4. Check username/password in `.env` file

### Problem: "Port 5000 already in use"

**Solution:**
Change PORT in `.env` to something else like 5001

### Problem: "Port 3000 already in use"

**Solution:**
Kill the process or press `Y` when asked if you want to use a different port

### Problem: Module not found errors

**Solution:**
```bash
rm -rf node_modules
rm -rf client/node_modules
npm install
cd client && npm install --legacy-peer-deps
```

## 📱 Accessing the Website

Once running, you can access from:
- Same computer: http://localhost:3000
- Other devices on same network: http://YOUR_IP_ADDRESS:3000

To find your IP:
- Windows: Run `ipconfig` in terminal
- Mac/Linux: Run `ifconfig` in terminal

## 🎯 What's Working Now

✅ **Customer Side:**
- User registration with 8-step form
- User lookup by National ID/Phone
- Conditional form fields based on user type
- Multi-language support (Arabic/English)
- Success page with QR code
- Animated, colorful UI

✅ **Admin Side:**
- Admin login
- Dashboard with statistics
- Light/Dark theme toggle
- Bilingual interface

✅ **Backend:**
- Complete database with all tables
- User and registration management
- Email service (SendGrid)
- Conflict checking for appointments
- Analytics and reporting
- CSV export

## 🔜 What's Next

We can add:
- Full registration management UI (approve/reject from web)
- Advanced filtering and search
- User profile pages
- PDF generation matching your template
- Employee schedule pages
- Enhanced analytics charts
- And more!

## 🆘 Need Help?

If something doesn't work:

1. Check both terminal windows for error messages
2. Make sure PostgreSQL is running
3. Verify `.env` file settings
4. Try restarting the servers (Ctrl+C then `npm run dev` again)

---

**Ready? Run `npm run dev` and visit http://localhost:3000!** 🚀
