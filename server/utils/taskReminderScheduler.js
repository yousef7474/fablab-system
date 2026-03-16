const cron = require('node-cron');
const { Op } = require('sequelize');
const { Task, Employee, Admin } = require('../models');
const { sendTaskReminderEmail } = require('./emailService');

const startTaskReminderScheduler = () => {
  // Run every hour to check for tasks ending in ~20 hours
  cron.schedule('0 * * * *', async () => {
    console.log('🔔 Running task deadline reminder scheduler...');

    try {
      const now = new Date();
      // Calculate the target time: 20 hours from now
      const reminderTarget = new Date(now.getTime() + 20 * 60 * 60 * 1000);
      const targetDateStr = reminderTarget.toISOString().split('T')[0];

      // Find active tasks where the end date matches and reminder not yet sent
      const tasks = await Task.findAll({
        where: {
          status: { [Op.in]: ['pending', 'in_progress'] },
          reminderSent: false,
          [Op.or]: [
            // Tasks with an end date matching the target
            { dueDateEnd: targetDateStr },
            // Tasks without end date (single day) where dueDate matches
            {
              dueDateEnd: null,
              dueDate: targetDateStr
            }
          ]
        },
        include: [
          { model: Employee, as: 'assignee', attributes: ['employeeId', 'name', 'email'] },
          { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
        ]
      });

      if (tasks.length === 0) {
        console.log('📭 No task reminders to send.');
        return;
      }

      console.log(`📬 Found ${tasks.length} task(s) to send reminders for.`);

      for (const task of tasks) {
        if (!task.assignee || !task.assignee.email) {
          console.log(`⚠️ Skipping task "${task.title}" - no employee email.`);
          continue;
        }

        try {
          const endDate = task.dueDateEnd || task.dueDate;
          await sendTaskReminderEmail(
            task.assignee.email,
            task.assignee.name,
            task.title,
            task.description,
            endDate,
            task.creator?.fullName
          );
          // Mark reminder as sent so it won't be sent again
          await task.update({ reminderSent: true });
          console.log(`✅ Reminder sent to ${task.assignee.email} for task: ${task.title}`);
        } catch (err) {
          console.error(`❌ Failed to send reminder for task "${task.title}":`, err.message);
        }
      }
    } catch (error) {
      console.error('❌ Task reminder scheduler error:', error);
    }
  });

  console.log('⏰ Task deadline reminder scheduler started (runs every hour).');
};

module.exports = { startTaskReminderScheduler };
