const cron = require('node-cron');
const { Op } = require('sequelize');
const { Borrowing, User } = require('../models');
const { sendReturnReminder, sendOverdueWarning, sendAdminOverdueAlert } = require('./borrowingEmailService');

const startBorrowingScheduler = () => {
  // Run daily at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('Running borrowing reminder/warning scheduler...');

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      // Calculate date 2 days from now for reminders
      const twoDaysFromNow = new Date(today);
      twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
      const twoDaysStr = twoDaysFromNow.toISOString().split('T')[0];

      // 1. Send reminders for borrowings due in 2 days
      const dueSoon = await Borrowing.findAll({
        where: {
          status: { [Op.in]: ['approved', 'borrowed'] },
          expectedReturnDate: twoDaysStr,
          actualReturnDate: null
        },
        include: [{ model: User, as: 'user' }]
      });

      for (const borrowing of dueSoon) {
        try {
          await sendReturnReminder(borrowing, borrowing.user);
          console.log(`Reminder sent for borrowing ${borrowing.borrowingId}`);
        } catch (err) {
          console.error(`Failed to send reminder for ${borrowing.borrowingId}:`, err);
        }
      }

      // 2. Find overdue borrowings (past due date, not returned)
      const overdue = await Borrowing.findAll({
        where: {
          status: { [Op.in]: ['approved', 'borrowed', 'overdue'] },
          expectedReturnDate: { [Op.lt]: todayStr },
          actualReturnDate: null,
          warningCount: { [Op.lt]: 3 }
        },
        include: [{ model: User, as: 'user' }]
      });

      for (const borrowing of overdue) {
        const expectedDate = new Date(borrowing.expectedReturnDate);
        const daysOverdue = Math.ceil((today - expectedDate) / (1000 * 60 * 60 * 24));

        // Determine which warning to send based on warningCount
        if (borrowing.warningCount === 0 && daysOverdue >= 1) {
          // First warning: 1 day overdue
          try {
            await sendOverdueWarning(borrowing, borrowing.user, 1);
            await borrowing.update({ warningCount: 1, lastWarningAt: new Date(), status: 'overdue' });
            console.log(`Warning #1 sent for borrowing ${borrowing.borrowingId}`);
          } catch (err) {
            console.error(`Failed to send warning #1 for ${borrowing.borrowingId}:`, err);
          }
        } else if (borrowing.warningCount === 1 && daysOverdue >= 2) {
          // Second warning: 2 days overdue
          try {
            await sendOverdueWarning(borrowing, borrowing.user, 2);
            await borrowing.update({ warningCount: 2, lastWarningAt: new Date() });
            console.log(`Warning #2 sent for borrowing ${borrowing.borrowingId}`);
          } catch (err) {
            console.error(`Failed to send warning #2 for ${borrowing.borrowingId}:`, err);
          }
        } else if (borrowing.warningCount === 2 && daysOverdue >= 3) {
          // Third notification: Send to admin
          try {
            await sendAdminOverdueAlert(borrowing, borrowing.user);
            await borrowing.update({ warningCount: 3, lastWarningAt: new Date() });
            console.log(`Admin alert sent for borrowing ${borrowing.borrowingId}`);
          } catch (err) {
            console.error(`Failed to send admin alert for ${borrowing.borrowingId}:`, err);
          }
        }
      }

      console.log(`Borrowing scheduler completed. Reminders: ${dueSoon.length}, Overdue processed: ${overdue.length}`);
    } catch (error) {
      console.error('Error in borrowing scheduler:', error);
    }
  });

  console.log('Borrowing scheduler started (runs daily at 9:00 AM)');
};

module.exports = { startBorrowingScheduler };
