# FABLAB Al-Ahsa Registration and Appointment Management System

A comprehensive full-stack registration and appointment management system for FABLAB Al-Ahsa.

## Features

### Customer Registration
- Multi-step registration form with 8 sections
- Returning user quick lookup (National ID/Phone)
- Real-time appointment conflict checking
- 6 application types: Beneficiary, Visitor, Volunteer, Talented, Entity, FABLAB Visit
- 7 FABLAB sections with dedicated scheduling
- Barcode generation upon successful registration
- Bilingual support (Arabic/English)
- Modern, animated UI with color-coded sections

### Admin Dashboard
- Complete registration management (view/approve/reject/edit/delete)
- Advanced filtering system
- User profiles with complete registration history
- PDF generation matching official template
- CSV bulk export
- Auto-generated employee schedules (daily/weekly/monthly)
- Analytics and statistics
- Light/Dark theme
- Bilingual interface

### Email Notifications
- Registration confirmation to users
- Section engineer notifications
- Approval/rejection notifications

## Tech Stack

**Backend:**
- Node.js & Express.js
- PostgreSQL (via Sequelize ORM)
- JWT Authentication
- SendGrid for email
- QRCode & PDFKit for document generation

**Frontend:**
- React
- Material-UI (MUI)
- Framer Motion for animations
- React Router
- i18next for internationalization
- Axios for API calls

## Installation

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- SendGrid API Key

### Step 1: Clone and Install Dependencies

```bash
# Install root dependencies
npm run install-all
```

### Step 2: Database Setup

1. Create a PostgreSQL database named `fablab_db`
2. Update database credentials in `.env` file

### Step 3: Environment Configuration

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and fill in your configuration:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fablab_db
DB_USER=your_postgres_username
DB_PASSWORD=your_postgres_password

# JWT Secret
JWT_SECRET=your_super_secret_jwt_key_here

# SendGrid Configuration
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@fablab-ahsa.com
SENDGRID_FROM_NAME=FABLAB Al-Ahsa

# Employee Email Mapping
EMPLOYEE_ELECTRONICS_EMAIL=electronics.engineer@fablab-ahsa.com
EMPLOYEE_CNC_LASER_EMAIL=cnc.laser@fablab-ahsa.com
EMPLOYEE_CNC_WOOD_EMAIL=cnc.wood@fablab-ahsa.com
EMPLOYEE_3D_EMAIL=3d.engineer@fablab-ahsa.com
EMPLOYEE_ROBOTIC_AI_EMAIL=robotic.ai@fablab-ahsa.com
EMPLOYEE_KIDS_CLUB_EMAIL=kids.club@fablab-ahsa.com
EMPLOYEE_VINYL_CUTTING_EMAIL=vinyl@fablab-ahsa.com

# Frontend URL
CLIENT_URL=http://localhost:3000
```

### Step 4: Create Frontend Environment File

Create `client/.env`:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

### Step 5: Run the Application

```bash
# Development mode (runs both backend and frontend)
npm run dev

# Or run separately:
# Backend only
npm run server

# Frontend only
npm run client
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api

## Creating the First Admin User

After starting the server, you need to create an admin user. You can do this using a REST client (Postman, Insomnia, etc.) or curl:

```bash
curl -X POST http://localhost:5000/api/admin/create-admin \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@fablab-ahsa.com",
    "password": "YourSecurePassword123",
    "fullName": "Admin User"
  }'
```

Or use the Node.js script (recommended):

Create a file `scripts/createAdmin.js`:

```javascript
const { Admin } = require('../server/models');

async function createAdmin() {
  try {
    const admin = await Admin.create({
      username: 'admin',
      email: 'admin@fablab-ahsa.com',
      password: 'YourSecurePassword123',
      fullName: 'Admin User'
    });
    console.log('✅ Admin created successfully:', admin.username);
  } catch (error) {
    console.error('❌ Error creating admin:', error);
  }
  process.exit();
}

createAdmin();
```

Run it:
```bash
node scripts/createAdmin.js
```

## API Endpoints

### Public Endpoints

**Registration:**
- `POST /api/registration/check-user` - Check if user exists
- `GET /api/registration/available-slots` - Get available time slots
- `POST /api/registration/create` - Create new registration

**Admin:**
- `POST /api/admin/login` - Admin login

### Protected Endpoints (Require Authentication)

**Admin Management:**
- `POST /api/admin/create-admin` - Create new admin user
- `GET /api/admin/registrations` - Get all registrations with filters
- `GET /api/admin/registrations/:id` - Get registration by ID
- `PUT /api/admin/registrations/:id/status` - Update registration status
- `PUT /api/admin/registrations/:id` - Update registration
- `DELETE /api/admin/registrations/:id` - Delete registration
- `GET /api/admin/users/:userId` - Get user profile
- `GET /api/admin/analytics` - Get analytics
- `POST /api/admin/export-csv` - Export registrations to CSV

## System Workflow

1. **User Registration:**
   - User checks if they're already registered (by National ID or Phone)
   - If new, completes 8-section form
   - System checks appointment availability
   - Upon submission, user receives confirmation email
   - Section engineer receives notification email

2. **Admin Review:**
   - Admin logs in to dashboard
   - Reviews pending registrations
   - Approves, rejects, or puts on hold
   - User receives status update email

3. **Employee Schedule:**
   - System auto-generates daily/weekly/monthly schedules
   - Employees see their appointments per section
   - Can print registration details

## Working Hours

- **Days:** Sunday to Thursday
- **Hours:** 11:00 AM to 7:00 PM
- **Note:** Friday and Saturday are not working days

## Application Types

1. **Beneficiary** - Standard user needing services
2. **Visitor** - Temporary visitor
3. **Volunteer** - Long-term volunteer (date range scheduling)
4. **Talented** - Talented individual
5. **Entity** - Official entity (5 predefined entities)
6. **FABLAB Visit** - Group visit scheduling

## FABLAB Sections

1. Electronics and Programming
2. CNC Laser
3. CNC Wood
4. 3D Printing
5. Robotic and AI
6. Kid's Club
7. Vinyl Cutting

## Customization

### Adding Employee Emails

Update `.env` file with employee email addresses for each section. When a registration is made, the corresponding engineer receives an email notification.

### Modifying Color Scheme

Colors are defined in `client/src/config/theme.js`. The current color palette:
- Racing Red: #EE2329
- Light Blue: #C2E0E1
- Sky Reflection: #81AED6
- Baby Blue Ice: #92B9E1
- Mint Leaf: #48BF85

### Translation

Add or modify translations in `client/src/i18n.js`. The system supports Arabic and English.

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running
- Check database credentials in `.env`
- Ensure database `fablab_db` exists

### Email Not Sending
- Verify SendGrid API key is valid
- Check SendGrid sender email is verified
- Review SendGrid dashboard for errors

### Port Already in Use
- Change `PORT` in `.env` for backend
- Change port in `client/package.json` for frontend

## Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Build frontend: `cd client && npm run build`
3. Serve built files using Express static middleware or nginx
4. Use process manager (PM2) for backend
5. Set up SSL certificate
6. Configure firewall rules
7. Set up database backups

## Security Notes

- Change default JWT_SECRET in production
- Use strong admin passwords
- Enable HTTPS in production
- Keep dependencies updated
- Regularly backup database
- Monitor SendGrid quota

## Support

For issues, please contact the development team or check the system logs.

## License

Proprietary - FABLAB Al-Ahsa

---

Built with ❤️ for FABLAB Al-Ahsa
