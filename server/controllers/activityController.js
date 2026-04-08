const { EmployeeActivity, Employee, Rating } = require('../models');
const { Op } = require('sequelize');

const HEARTBEAT_INTERVAL_MINUTES = 5;
const WEEKLY_TARGET_HOURS = 14; // 2 hours/day × 7 days
const WEEKLY_TARGET_MINUTES = WEEKLY_TARGET_HOURS * 60; // 840 minutes

// Record login (called when employee logs in)
exports.recordLogin = async (req, res) => {
  try {
    const employee = req.employee;
    const today = new Date().toISOString().split('T')[0];

    const [activity] = await EmployeeActivity.findOrCreate({
      where: { employeeId: employee.employeeId, date: today },
      defaults: { employeeId: employee.employeeId, date: today, loginCount: 0, totalMinutes: 0 }
    });

    activity.loginCount += 1;
    activity.lastHeartbeat = new Date();
    await activity.save();

    res.json({ message: 'Login recorded' });
  } catch (error) {
    console.error('Record login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Heartbeat (called every 5 min while dashboard is open)
exports.heartbeat = async (req, res) => {
  try {
    const employee = req.employee;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    const [activity] = await EmployeeActivity.findOrCreate({
      where: { employeeId: employee.employeeId, date: today },
      defaults: { employeeId: employee.employeeId, date: today, loginCount: 1, totalMinutes: 0 }
    });

    // Only add minutes if last heartbeat was recent (within 2x interval)
    if (activity.lastHeartbeat) {
      const lastBeat = new Date(activity.lastHeartbeat);
      const diffMinutes = (now - lastBeat) / (1000 * 60);
      if (diffMinutes <= HEARTBEAT_INTERVAL_MINUTES * 2) {
        activity.totalMinutes += Math.min(Math.round(diffMinutes), HEARTBEAT_INTERVAL_MINUTES);
      }
    }

    activity.lastHeartbeat = now;
    await activity.save();

    res.json({ totalMinutes: activity.totalMinutes });
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Record interaction (called when employee does something meaningful)
exports.recordInteraction = async (req, res) => {
  try {
    const employee = req.employee;
    const today = new Date().toISOString().split('T')[0];

    const [activity] = await EmployeeActivity.findOrCreate({
      where: { employeeId: employee.employeeId, date: today },
      defaults: { employeeId: employee.employeeId, date: today, loginCount: 1, totalMinutes: 0 }
    });

    activity.interacted = true;
    await activity.save();

    res.json({ message: 'Interaction recorded' });
  } catch (error) {
    console.error('Record interaction error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get own weekly stats (for employee dashboard)
exports.getMyWeeklyStats = async (req, res) => {
  try {
    const employee = req.employee;
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);

    const activities = await EmployeeActivity.findAll({
      where: {
        employeeId: employee.employeeId,
        date: { [Op.between]: [weekAgo.toISOString().split('T')[0], today.toISOString().split('T')[0]] }
      },
      order: [['date', 'ASC']]
    });

    const totalMinutes = activities.reduce((sum, a) => sum + a.totalMinutes, 0);
    const totalHours = (totalMinutes / 60).toFixed(1);
    const percentage = Math.min(((totalMinutes / WEEKLY_TARGET_MINUTES) * 100), 100).toFixed(1);
    const daysActive = activities.filter(a => a.totalMinutes > 0).length;
    const daysInteracted = activities.filter(a => a.interacted).length;
    const passed = totalMinutes >= WEEKLY_TARGET_MINUTES;

    // Auto-credit immediately if threshold reached and not already credited this week
    let creditedNow = false;
    if (passed) {
      const weekStart = weekAgo.toISOString().split('T')[0];
      const weekEnd = today.toISOString().split('T')[0];
      const existingCredit = await Rating.findOne({
        where: {
          employeeId: employee.employeeId,
          criteria: 'Weekly Dashboard Activity',
          ratingDate: { [Op.between]: [weekStart, weekEnd] }
        }
      });

      if (!existingCredit) {
        try {
          await Rating.create({
            employeeId: employee.employeeId,
            createdById: null,
            type: 'award',
            points: 1,
            criteria: 'Weekly Dashboard Activity',
            notes: `Auto-awarded: ${totalHours} hours on dashboard (target: ${WEEKLY_TARGET_HOURS}h)`,
            ratingDate: today
          });
          creditedNow = true;
          console.log(`Auto-credited 1 point to ${employee.name} for weekly dashboard activity (${totalHours}h)`);
        } catch (e) {
          console.error('Auto-credit error:', e);
        }
      }
    }

    res.json({
      totalMinutes,
      totalHours: parseFloat(totalHours),
      percentage: parseFloat(percentage),
      targetHours: WEEKLY_TARGET_HOURS,
      daysActive,
      daysInteracted,
      passed,
      creditedNow,
      dailyBreakdown: activities.map(a => ({
        date: a.date,
        minutes: a.totalMinutes,
        hours: (a.totalMinutes / 60).toFixed(1),
        logins: a.loginCount,
        interacted: a.interacted
      }))
    });
  } catch (error) {
    console.error('Get my weekly stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all employees activity stats (for manager)
exports.getAllEmployeeStats = async (req, res) => {
  try {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);
    const weekStart = weekAgo.toISOString().split('T')[0];
    const weekEnd = today.toISOString().split('T')[0];

    const employees = await Employee.findAll({
      where: { isActive: true },
      attributes: ['employeeId', 'name', 'email', 'section'],
      order: [['name', 'ASC']]
    });

    const activities = await EmployeeActivity.findAll({
      where: {
        date: { [Op.between]: [weekStart, weekEnd] }
      }
    });

    const stats = employees.map(emp => {
      const empActivities = activities.filter(a => a.employeeId === emp.employeeId);
      const totalMinutes = empActivities.reduce((sum, a) => sum + a.totalMinutes, 0);
      const totalLogins = empActivities.reduce((sum, a) => sum + a.loginCount, 0);
      const daysActive = empActivities.filter(a => a.totalMinutes > 0).length;
      const daysInteracted = empActivities.filter(a => a.interacted).length;
      const percentage = Math.min(((totalMinutes / WEEKLY_TARGET_MINUTES) * 100), 100);

      return {
        employeeId: emp.employeeId,
        name: emp.name,
        email: emp.email,
        section: emp.section,
        totalMinutes,
        totalHours: parseFloat((totalMinutes / 60).toFixed(1)),
        totalLogins,
        daysActive,
        daysInteracted,
        percentage: parseFloat(percentage.toFixed(1)),
        passed: totalMinutes >= WEEKLY_TARGET_MINUTES,
        dailyBreakdown: empActivities.map(a => ({
          date: a.date,
          minutes: a.totalMinutes,
          logins: a.loginCount,
          interacted: a.interacted
        }))
      };
    });

    res.json({
      weekStart,
      weekEnd,
      targetHours: WEEKLY_TARGET_HOURS,
      employees: stats
    });
  } catch (error) {
    console.error('Get all employee stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Weekly auto-credit: award 1 point to employees who reached 60% (14 hours)
// Called by scheduler every Sunday
exports.processWeeklyCredits = async () => {
  try {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);
    const weekStart = weekAgo.toISOString().split('T')[0];
    const weekEnd = today.toISOString().split('T')[0];

    const employees = await Employee.findAll({ where: { isActive: true } });

    let credited = 0;
    for (const emp of employees) {
      const activities = await EmployeeActivity.findAll({
        where: {
          employeeId: emp.employeeId,
          date: { [Op.between]: [weekStart, weekEnd] }
        }
      });

      const totalMinutes = activities.reduce((sum, a) => sum + a.totalMinutes, 0);

      if (totalMinutes >= WEEKLY_TARGET_MINUTES) {
        // Check if already credited this week
        const existingCredit = await Rating.findOne({
          where: {
            employeeId: emp.employeeId,
            criteria: 'Weekly Dashboard Activity',
            ratingDate: { [Op.between]: [weekStart, weekEnd] }
          }
        });

        if (!existingCredit) {
          await Rating.create({
            employeeId: emp.employeeId,
            createdById: null,
            type: 'award',
            points: 1,
            criteria: 'Weekly Dashboard Activity',
            notes: `Auto-awarded: ${(totalMinutes / 60).toFixed(1)} hours on dashboard (target: ${WEEKLY_TARGET_HOURS}h)`,
            ratingDate: today
          });
          credited++;
          console.log(`Auto-credited 1 point to ${emp.name} for weekly dashboard activity (${(totalMinutes / 60).toFixed(1)}h)`);
        }
      }
    }

    console.log(`Weekly activity credits processed: ${credited} employees credited`);
    return credited;
  } catch (error) {
    console.error('Process weekly credits error:', error);
    return 0;
  }
};
