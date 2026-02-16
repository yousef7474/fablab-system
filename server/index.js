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
const internRoutes = require('./routes/internRoutes');
const managerTodoRoutes = require('./routes/managerTodoRoutes');
const workspaceRoutes = require('./routes/workspaceRoutes');
const sectionAvailabilityRoutes = require('./routes/sectionAvailabilityRoutes');
const eliteRoutes = require('./routes/eliteRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const workingHoursOverrideRoutes = require('./routes/workingHoursOverrideRoutes');

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
app.use(express.json({ limit: '10mb' })); // Increased for base64 image uploads (5MB image ≈ 6.7MB base64)
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/registration', registrationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/volunteers', volunteerRoutes);
app.use('/api/interns', internRoutes);
app.use('/api/manager-todos', managerTodoRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/sections', sectionAvailabilityRoutes);
app.use('/api/elite', eliteRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/settings/working-hours-overrides', workingHoursOverrideRoutes);

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
