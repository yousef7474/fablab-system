const { EmployeeActivity, Employee, Rating, EmployeeEvaluation } = require('../models');
const { Op } = require('sequelize');

// Auto-update the "متابعة المنصة والجدول اليومي" criterion (cat9_c1) in evaluation
// Score = number of weeks the employee passed 14h target (capped at 50)
async function syncEvaluationCriterion(employeeId) {
  try {
    // Count how many Weekly Dashboard Activity awards this employee has
    const weeklyAwards = await Rating.count({
      where: {
        employeeId,
        criteria: 'Weekly Dashboard Activity',
        type: 'award'
      }
    });
    const score = Math.min(50, weeklyAwards);

    let evaluation = await EmployeeEvaluation.findOne({ where: { employeeId } });

    if (evaluation) {
      const scores = { ...(evaluation.scores || {}) };
      scores.cat9_c1 = score;
      evaluation.scores = scores;
      // Recalculate total
      const WEIGHTS = {
        cat1: { c1: 2, c2: 2, c3: 2, c4: 2 },
        cat2: { c1: 4, c2: 4, c3: 4, c4: 4 },
        cat3: { c1: 2, c2: 2, c3: 2, c4: 2 },
        cat4: { c1: 6, c2: 6 },
        cat5: { c1: 4 },
        cat6: { c1: 3, c2: 3, c3: 3, c4: 3 },
        cat7: { c1: 4, c2: 4, c3: 4, c4: 4 },
        cat8: { c1: 3, c2: 3, c3: 3, c4: 3 },
        cat9: { c1: 3, c2: 3, c3: 3, c4: 3 },
      };
      let total = 0, bonus = 0;
      for (const [catKey, criteria] of Object.entries(WEIGHTS)) {
        for (const [critKey, weight] of Object.entries(criteria)) {
          const raw = parseFloat(scores[`${catKey}_${critKey}`]) || 0;
          total += (Math.min(raw, 50) / 50) * weight;
          if (raw > 50) bonus += raw - 50;
        }
      }
      evaluation.totalScore = parseFloat(total.toFixed(2));
      evaluation.grade = parseFloat(((total / 100) * 5).toFixed(2));
      evaluation.bonusPoints = parseFloat(bonus.toFixed(2));
      await evaluation.save();
    } else {
      // Create a new evaluation with just this criterion
      const total = (Math.min(score, 50) / 50) * 3; // weight=3
      await EmployeeEvaluation.create({
        employeeId,
        createdById: null,
        scores: { cat9_c1: score },
        qualitative: {},
        totalScore: parseFloat(total.toFixed(2)),
        grade: parseFloat(((total / 100) * 5).toFixed(2)),
        bonusPoints: 0,
        period: null,
        notes: 'Auto-generated from dashboard activity',
        evaluationDate: new Date()
      });
    }
  } catch (e) {
    console.error('Sync evaluation criterion error:', e);
  }
}

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
    const todayStr = today.toISOString().split('T')[0];

    // Get all credit history
    const credits = await Rating.findAll({
      where: {
        employeeId: employee.employeeId,
        criteria: 'Weekly Dashboard Activity',
        type: 'award'
      },
      order: [['ratingDate', 'DESC']]
    });
    const successfulWeeks = credits.length;
    const lastCredit = credits[0] || null;

    // Determine cycle start: day after last credit, or 6 days ago if no credit yet
    let cycleStartDate;
    if (lastCredit) {
      cycleStartDate = new Date(lastCredit.ratingDate);
      cycleStartDate.setDate(cycleStartDate.getDate() + 1);
    } else {
      cycleStartDate = new Date(today);
      cycleStartDate.setDate(cycleStartDate.getDate() - 6);
    }
    const cycleStart = cycleStartDate.toISOString().split('T')[0];

    const cycleEndDate = new Date(cycleStartDate);
    cycleEndDate.setDate(cycleEndDate.getDate() + 6);
    const daysRemaining = Math.max(0, Math.ceil((cycleEndDate - today) / (1000 * 60 * 60 * 24)));

    const activities = await EmployeeActivity.findAll({
      where: {
        employeeId: employee.employeeId,
        date: { [Op.between]: [cycleStart, todayStr] }
      },
      order: [['date', 'ASC']]
    });

    const totalMinutes = activities.reduce((sum, a) => sum + a.totalMinutes, 0);
    const totalHours = (totalMinutes / 60).toFixed(1);
    const percentage = Math.min(((totalMinutes / WEEKLY_TARGET_MINUTES) * 100), 100).toFixed(1);
    const daysActive = activities.filter(a => a.totalMinutes > 0).length;
    const daysInteracted = activities.filter(a => a.interacted).length;
    const passed = totalMinutes >= WEEKLY_TARGET_MINUTES;

    // Auto-credit immediately if threshold reached in current cycle
    let creditedNow = false;
    if (passed) {
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

    // Sync the evaluation criterion based on total weekly awards
    await syncEvaluationCriterion(employee.employeeId);

    res.json({
      totalMinutes,
      totalHours: parseFloat(totalHours),
      percentage: parseFloat(percentage),
      targetHours: WEEKLY_TARGET_HOURS,
      daysActive,
      daysInteracted,
      passed,
      creditedNow,
      successfulWeeks,
      lastCreditDate: lastCredit ? lastCredit.ratingDate : null,
      cycleStart,
      cycleEnd: cycleEndDate.toISOString().split('T')[0],
      daysRemaining,
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
    const todayStr = today.toISOString().split('T')[0];

    const employees = await Employee.findAll({
      where: { isActive: true },
      attributes: ['employeeId', 'name', 'email', 'section'],
      order: [['name', 'ASC']]
    });

    // Get all weekly activity credits (for "successful weeks" count + last credit date)
    const allCredits = await Rating.findAll({
      where: {
        criteria: 'Weekly Dashboard Activity',
        type: 'award'
      },
      order: [['ratingDate', 'DESC']]
    });

    // Pre-fetch ALL activities to avoid N+1 queries
    const allActivities = await EmployeeActivity.findAll();

    const stats = employees.map(emp => {
      const empCredits = allCredits.filter(c => c.employeeId === emp.employeeId);
      const successfulWeeks = empCredits.length;
      const lastCredit = empCredits[0] || null;

      // Determine cycle start: day after last credit, or 6 days ago if no credit yet
      let cycleStart;
      if (lastCredit) {
        const d = new Date(lastCredit.ratingDate);
        d.setDate(d.getDate() + 1);
        cycleStart = d.toISOString().split('T')[0];
      } else {
        const d = new Date(today);
        d.setDate(d.getDate() - 6);
        cycleStart = d.toISOString().split('T')[0];
      }

      // Filter activities for this employee within the current cycle
      const empActivities = allActivities.filter(a =>
        a.employeeId === emp.employeeId && a.date >= cycleStart && a.date <= todayStr
      );

      const totalMinutes = empActivities.reduce((sum, a) => sum + a.totalMinutes, 0);
      const totalLogins = empActivities.reduce((sum, a) => sum + a.loginCount, 0);
      const daysActive = empActivities.filter(a => a.totalMinutes > 0).length;
      const daysInteracted = empActivities.filter(a => a.interacted).length;
      const percentage = Math.min(((totalMinutes / WEEKLY_TARGET_MINUTES) * 100), 100);

      // Calculate days remaining in current cycle (cycleStart + 7 days)
      const cycleStartDate = new Date(cycleStart);
      const cycleEndDate = new Date(cycleStartDate);
      cycleEndDate.setDate(cycleEndDate.getDate() + 6);
      const daysRemaining = Math.max(0, Math.ceil((cycleEndDate - today) / (1000 * 60 * 60 * 24)));

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
        successfulWeeks,
        lastCreditDate: lastCredit ? lastCredit.ratingDate : null,
        cycleStart,
        cycleEnd: cycleEndDate.toISOString().split('T')[0],
        daysRemaining,
        dailyBreakdown: empActivities.map(a => ({
          date: a.date,
          minutes: a.totalMinutes,
          logins: a.loginCount,
          interacted: a.interacted
        }))
      };
    });

    res.json({
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
