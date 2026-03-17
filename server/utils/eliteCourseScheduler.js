const cron = require('node-cron');
const { Op } = require('sequelize');
const { EliteCourseEnrollment, EliteCourse, EliteUser } = require('../models');
const { sendCourseInactivityWarning } = require('./emailService');

const startEliteCourseScheduler = () => {
  // Run daily at 8 AM to check for inactive course enrollments
  cron.schedule('0 8 * * *', async () => {
    console.log('📚 Running elite course inactivity checker...');

    try {
      // Get all active enrollments that are not completed/dropped
      const enrollments = await EliteCourseEnrollment.findAll({
        where: {
          status: { [Op.in]: ['enrolled', 'in_progress'] }
        },
        include: [
          {
            model: EliteCourse,
            as: 'course',
            where: { status: 'active' },
            attributes: ['courseId', 'title', 'inactivityDays', 'endDate']
          },
          {
            model: EliteUser,
            as: 'eliteUser',
            attributes: ['eliteId', 'firstName', 'lastName', 'email']
          }
        ]
      });

      if (enrollments.length === 0) {
        console.log('📭 No active course enrollments to check.');
        return;
      }

      let warningsSent = 0;

      for (const enrollment of enrollments) {
        const { course, eliteUser } = enrollment;
        if (!eliteUser || !eliteUser.email || !course) continue;

        const inactivityDays = course.inactivityDays || 7;
        const now = new Date();
        const thresholdDate = new Date(now.getTime() - inactivityDays * 24 * 60 * 60 * 1000);

        // Check if user has been inactive
        const lastAccess = enrollment.lastAccessedAt || enrollment.enrolledAt;
        if (new Date(lastAccess) > thresholdDate) continue;

        // Don't spam warnings - check if we already sent one recently (within inactivityDays)
        if (enrollment.lastWarningSentAt) {
          const lastWarning = new Date(enrollment.lastWarningSentAt);
          if (lastWarning > thresholdDate) continue;
        }

        try {
          await sendCourseInactivityWarning(
            eliteUser.email,
            `${eliteUser.firstName} ${eliteUser.lastName}`,
            course.title,
            inactivityDays,
            enrollment.progressPercent
          );

          await enrollment.update({
            warningsSent: (enrollment.warningsSent || 0) + 1,
            lastWarningSentAt: now
          });

          warningsSent++;
          console.log(`⚠️ Inactivity warning sent to ${eliteUser.email} for course: ${course.title}`);
        } catch (err) {
          console.error(`❌ Failed to send warning for ${eliteUser.email}:`, err.message);
        }
      }

      console.log(`📚 Course inactivity check complete. ${warningsSent} warning(s) sent.`);
    } catch (error) {
      console.error('❌ Elite course scheduler error:', error);
    }
  });

  console.log('📚 Elite course inactivity scheduler started (runs daily at 8 AM).');
};

module.exports = { startEliteCourseScheduler };
