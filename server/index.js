const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { testConnection, syncDatabase } = require('./models');
const registrationRoutes = require('./routes/registrationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const taskRoutes = require('./routes/taskRoutes');
const ratingRoutes = require('./routes/ratingRoutes');
const volunteerRoutes = require('./routes/volunteerRoutes');
const workerRoutes = require('./routes/workerRoutes');
const internRoutes = require('./routes/internRoutes');
const managerTodoRoutes = require('./routes/managerTodoRoutes');
const workspaceRoutes = require('./routes/workspaceRoutes');
const sectionAvailabilityRoutes = require('./routes/sectionAvailabilityRoutes');
const eliteRoutes = require('./routes/eliteRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const workingHoursOverrideRoutes = require('./routes/workingHoursOverrideRoutes');
const borrowingRoutes = require('./routes/borrowingRoutes');
const educationRoutes = require('./routes/educationRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const evaluationRoutes = require('./routes/evaluationRoutes');
const workshopMgmtRoutes = require('./routes/workshopMgmtRoutes');
const userHistoryRoutes = require('./routes/userHistoryRoutes');
const registrationClosureRoutes = require('./routes/registrationClosureRoutes');
const summerRoutes = require('./routes/summerRoutes');
const mawhbaRoutes = require('./routes/mawhbaRoutes');
const fablabStaffRoutes = require('./routes/fablabStaffRoutes');
const overtimeRoutes = require('./routes/overtimeRoutes');
const fablabVisitRoutes = require('./routes/fablabVisitRoutes');
const calendarEventRoutes = require('./routes/calendarEventRoutes');
const storeRoutes = require('./routes/storeRoutes');
const print3DRoutes = require('./routes/print3DRoutes');
const institutionSupportRoutes = require('./routes/institutionSupportRoutes');
const aiRoutes = require('./routes/aiRoutes');
const volunteerOpportunityRequestRoutes = require('./routes/volunteerOpportunityRequestRoutes');
const approvalArchiveRoutes = require('./routes/approvalArchiveRoutes');
const trainerAssistantRoutes = require('./routes/trainerAssistantRoutes');
const customerRoutes = require('./routes/customerRoutes');
const contractRoutes = require('./routes/contractRoutes');
const publicRoutes = require('./routes/publicRoutes');
const attendanceReportRoutes = require('./routes/attendanceReportRoutes');
const { startBorrowingScheduler } = require('./utils/borrowingScheduler');
const { seedInitialCustomers } = require('./utils/seedCustomers');
const { backfillApprovalArchive } = require('./utils/backfillApprovalArchive');
const { startTaskReminderScheduler } = require('./utils/taskReminderScheduler');
const { startEliteCourseScheduler } = require('./utils/eliteCourseScheduler');
const { processWeeklyCredits } = require('./controllers/activityController');

const app = express();

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://fablabsahsa.com', 'https://www.fablabsahsa.com']
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
// 50mb ceiling accommodates 3D-print files (STL/OBJ/3MF) base64-encoded
// alongside the existing base64 image uploads.
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/registration', registrationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/volunteers', volunteerRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/interns', internRoutes);
app.use('/api/manager-todos', managerTodoRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/sections', sectionAvailabilityRoutes);
app.use('/api/closures', registrationClosureRoutes);
app.use('/api/summer', summerRoutes);
app.use('/api/mawhba', mawhbaRoutes);
app.use('/api/fablab-staff', fablabStaffRoutes);
app.use('/api/overtime', overtimeRoutes);
app.use('/api/fablab-visits', fablabVisitRoutes);
app.use('/api/calendar-events', calendarEventRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/print3d', print3DRoutes);
app.use('/api/institution-support', institutionSupportRoutes);
// AI-facing read-only API — protected by a long-lived AI_API_KEY.
// Give the key to your AI model; it can then read (but never mutate)
// every resource in the system to answer questions.
app.use('/api/ai', aiRoutes);
app.use('/api/volunteer-opportunity-requests', volunteerOpportunityRequestRoutes);
app.use('/api/approval-archive', approvalArchiveRoutes);
app.use('/api/trainer-assistants', trainerAssistantRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/elite', eliteRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/settings/working-hours-overrides', workingHoursOverrideRoutes);
app.use('/api/borrowing', borrowingRoutes);
app.use('/api/education', educationRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/workshops', workshopMgmtRoutes);
app.use('/api/user-history', userHistoryRoutes);
// Public, no-auth endpoints for external volunteer report share links.
// Anything under /api/public/* is unauthenticated — protect the tokens.
app.use('/api/public', publicRoutes);
// Unified attendance export — aggregates every attendance source
// (volunteers, staff, trainers, interns, mawhba, summer, workshops)
// for a date range and streams as an Excel-friendly TSV.
app.use('/api/attendance', attendanceReportRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'FABLAB Registration System API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  console.error(err.stack);

  // Handle specific error types with bilingual messages
  let message = 'Something went wrong';
  let messageAr = 'حدث خطأ ما';
  let statusCode = 500;

  if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'File size is too large. Maximum allowed is 5MB.';
    messageAr = 'حجم الملف كبير جداً. الحد الأقصى المسموح به هو 5 ميجابايت.';
  } else if (err.name === 'SequelizeValidationError') {
    statusCode = 400;
    message = 'Invalid data provided: ' + err.errors.map(e => e.message).join(', ');
    messageAr = 'بيانات غير صالحة: ' + err.errors.map(e => e.message).join(', ');
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409;
    message = 'This record already exists.';
    messageAr = 'هذا السجل موجود بالفعل.';
  } else if (err.name === 'SequelizeDatabaseError') {
    statusCode = 500;
    message = 'Database error occurred. Please try again.';
    messageAr = 'حدث خطأ في قاعدة البيانات. يرجى المحاولة مرة أخرى.';
  } else if (err.message) {
    message = err.message;
    messageAr = err.messageAr || err.message;
  }

  res.status(statusCode).json({
    message,
    messageAr,
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Test database connection
    await testConnection();

    // Sync database
    await syncDatabase();

    // Seed initial mailing-list customers (idempotent — no-op if table
    // already has rows). Runs after sync so the customers table exists.
    await seedInitialCustomers();

    // Backfill the approval archive from historical rows (idempotent —
    // skips anything already archived). Existing pending / approved /
    // rejected volunteer opportunity + overtime requests get an
    // archive entry so the manager's Archive tab shows history from
    // before the archive feature existed.
    try {
      await backfillApprovalArchive();
    } catch (err) {
      console.log('backfillApprovalArchive skipped:', err.message);
    }

    // Start schedulers
    startBorrowingScheduler();
    startTaskReminderScheduler();
    startEliteCourseScheduler();

    // Weekly activity credit scheduler - runs every Sunday at 23:00
    const scheduleWeeklyCredits = () => {
      const now = new Date();
      const nextSunday = new Date(now);
      nextSunday.setDate(now.getDate() + (7 - now.getDay()));
      nextSunday.setHours(23, 0, 0, 0);
      if (nextSunday <= now) nextSunday.setDate(nextSunday.getDate() + 7);
      const delay = nextSunday - now;
      setTimeout(() => {
        processWeeklyCredits();
        setInterval(processWeeklyCredits, 7 * 24 * 60 * 60 * 1000);
      }, delay);
      console.log(`📊 Weekly activity credit scheduler set for Sunday 23:00`);
    };
    scheduleWeeklyCredits();

    // Start listening
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📍 API: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
