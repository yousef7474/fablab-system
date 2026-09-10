const { EmployeeActivity, Employee, Rating, EmployeeEvaluation } = require('../models');
const { Op } = require('sequelize');

// Auto-update the "متابعة المنصة والجدول اليومي" criterion (cat9_c1) in evaluation
// Increments by 1 (preserves manual edits if higher)
async function syncEvaluationCriterion(employeeId) {
  try {
    let evaluation = await EmployeeEvaluation.findOne({ where: { employeeId } });

    if (evaluation) {
      const scores = { ...(evaluation.scores || {}) };
      const currentScore = parseFloat(scores.cat9_c1) || 0;
      // Increment by 1, capped at 50 (preserves higher manual values)
      scores.cat9_c1 = Math.min(50, currentScore + 1);
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
      // Create a new evaluation with just this criterion = 1 (first credit)
      const total = (1 / 50) * 3; // weight=3, score=1
      await EmployeeEvaluation.create({
        employeeId,
        createdById: null,
        scores: { cat9_c1: 1 },
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
// Get current calendar week (Sunday-Saturday)
function getWeekBounds() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    daysRemaining: 6 - day
  };
}

exports.getMyWeeklyStats = async (req, res) => {
  try {
    const employee = req.employee;
    const week = getWeekBounds();

    // Get total credits ever
    const totalCredits = await Rating.count({
      where: { employeeId: employee.employeeId, criteria: 'Weekly Dashboard Activity', type: 'award' }
    });

    // Check if already credited THIS week
    const creditedThisWeek = await Rating.findOne({
      where: {
        employeeId: employee.employeeId,
        criteria: 'Weekly Dashboard Activity',
        type: 'award',
        ratingDate: { [Op.between]: [week.start, week.end] }
      }
    });

    // Get activity for this week
    const activities = await EmployeeActivity.findAll({
      where: {
        employeeId: employee.employeeId,
        date: { [Op.between]: [week.start, week.end] }
      },
      order: [['date', 'ASC']]
    });

    const totalMinutes = activities.reduce((sum, a) => sum + a.totalMinutes, 0);
    const totalHours = (totalMinutes / 60).toFixed(1);
    const percentage = Math.min(((totalMinutes / WEEKLY_TARGET_MINUTES) * 100), 100).toFixed(1);
    const daysActive = activities.filter(a => a.totalMinutes > 0).length;
    const daysInteracted = activities.filter(a => a.interacted).length;
    const passed = totalMinutes >= WEEKLY_TARGET_MINUTES;

    // Auto-credit if passed AND not already credited this week
    let creditedNow = false;
    if (passed && !creditedThisWeek) {
      try {
        await Rating.create({
          employeeId: employee.employeeId,
          createdById: null,
          type: 'award',
          points: 1,
          criteria: 'Weekly Dashboard Activity',
          notes: `Auto-awarded: ${totalHours}h on dashboard (week: ${week.start} to ${week.end})`,
          ratingDate: new Date()
        });
        creditedNow = true;
        console.log(`Auto-credited 1 point to ${employee.name} for weekly activity (${totalHours}h)`);
        await syncEvaluationCriterion(employee.employeeId);
      } catch (e) {
        console.error('Auto-credit error:', e);
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
      creditedThisWeek: !!creditedThisWeek,
      successfulWeeks: totalCredits + (creditedNow ? 1 : 0),
      cycleStart: week.start,
      cycleEnd: week.end,
      daysRemaining: week.daysRemaining,
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
    const week = getWeekBounds();

    const employees = await Employee.findAll({
      where: { isActive: true },
      attributes: ['employeeId', 'name', 'email', 'section'],
      order: [['name', 'ASC']]
    });

    const allCredits = await Rating.findAll({
      where: { criteria: 'Weekly Dashboard Activity', type: 'award' },
      order: [['ratingDate', 'DESC']]
    });

    const allActivities = await EmployeeActivity.findAll({
      where: { date: { [Op.between]: [week.start, week.end] } }
    });

    const stats = employees.map(emp => {
      const empCredits = allCredits.filter(c => c.employeeId === emp.employeeId);
      const lastCredit = empCredits[0] || null;
      const empActivities = allActivities.filter(a => a.employeeId === emp.employeeId);

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
        successfulWeeks: empCredits.length,
        lastCreditDate: lastCredit ? lastCredit.ratingDate : null,
        cycleStart: week.start,
        cycleEnd: week.end,
        daysRemaining: week.daysRemaining
      };
    });

    res.json({
      targetHours: WEEKLY_TARGET_HOURS,
      weekStart: week.start,
      weekEnd: week.end,
      employees: stats
    });
  } catch (error) {
    console.error('Get all employee stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Weekly auto-credit: award 1 point to employees who reached the
// weekly target hours. Called by the Sunday-23:00 scheduler AND at
// boot (to catch up any weeks the server was down). Also mirrors
// each credit into the evaluation's cat9_c1 criterion — that used to
// only happen when the employee visited their dashboard, so credits
// awarded here would silently miss the evaluation update.
exports.processWeeklyCredits = async ({ weeksBack = 4 } = {}) => {
  try {
    const employees = await Employee.findAll({ where: { isActive: true } });
    const today = new Date();
    let totalCredited = 0;

    // Walk the last `weeksBack` calendar weeks (Sun→Sat). Each iter
    // computes bounds independently so a downed server can catch up.
    for (let offset = 0; offset < weeksBack; offset++) {
      const anchor = new Date(today);
      anchor.setDate(today.getDate() - offset * 7);
      const day = anchor.getDay();          // 0=Sun
      const start = new Date(anchor);
      start.setDate(anchor.getDate() - day);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const weekStart = start.toISOString().split('T')[0];
      const weekEnd = end.toISOString().split('T')[0];

      for (const emp of employees) {
        const activities = await EmployeeActivity.findAll({
          where: {
            employeeId: emp.employeeId,
            date: { [Op.between]: [weekStart, weekEnd] }
          }
        });
        const totalMinutes = activities.reduce((sum, a) => sum + a.totalMinutes, 0);
        if (totalMinutes < WEEKLY_TARGET_MINUTES) continue;

        const existingCredit = await Rating.findOne({
          where: {
            employeeId: emp.employeeId,
            criteria: 'Weekly Dashboard Activity',
            ratingDate: { [Op.between]: [weekStart, weekEnd] }
          }
        });
        if (existingCredit) continue;

        await Rating.create({
          employeeId: emp.employeeId,
          createdById: null,
          type: 'award',
          points: 1,
          criteria: 'Weekly Dashboard Activity',
          notes: `Auto-awarded: ${(totalMinutes / 60).toFixed(1)} hours on dashboard (target: ${WEEKLY_TARGET_HOURS}h, week: ${weekStart}→${weekEnd})`,
          ratingDate: end  // stamp to the end of the credited week
        });
        // Mirror into the evaluation criterion. Skipped previously —
        // that was the whole reason cat9_c1 stayed at 0 for people
        // getting credited by the scheduler.
        await syncEvaluationCriterion(emp.employeeId);
        totalCredited++;
        console.log(`Auto-credited 1 point to ${emp.name} for weekly dashboard activity (${(totalMinutes / 60).toFixed(1)}h, week ${weekStart}→${weekEnd})`);
      }
    }

    if (totalCredited > 0) {
      console.log(`📊 Weekly activity credits processed: ${totalCredited} credited (looked back ${weeksBack} weeks)`);
    }
    return totalCredited;
  } catch (error) {
    console.error('Process weekly credits error:', error);
    return 0;
  }
};

// Boot-time reconciliation: make sure every employee's cat9_c1
// evaluation score is at least equal to their earned
// "Weekly Dashboard Activity" credit count. Fixes historical rows
// where the credit was created (via the old scheduler path) but the
// evaluation criterion was never incremented.
exports.reconcileEvaluationCriterion = async () => {
  try {
    const employees = await Employee.findAll({ where: { isActive: true } });
    let updated = 0;
    for (const emp of employees) {
      const creditCount = await Rating.count({
        where: {
          employeeId: emp.employeeId,
          criteria: 'Weekly Dashboard Activity',
          type: 'award'
        }
      });
      if (creditCount === 0) continue;

      const evaluation = await EmployeeEvaluation.findOne({ where: { employeeId: emp.employeeId } });
      const currentScore = evaluation ? (parseFloat(evaluation.scores?.cat9_c1) || 0) : 0;
      if (creditCount <= currentScore) continue;

      if (evaluation) {
        const scores = { ...(evaluation.scores || {}) };
        scores.cat9_c1 = Math.min(50, creditCount);
        evaluation.scores = scores;
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
        const capped = Math.min(50, creditCount);
        const total = (Math.min(capped, 50) / 50) * 3;
        await EmployeeEvaluation.create({
          employeeId: emp.employeeId,
          createdById: null,
          scores: { cat9_c1: capped },
          qualitative: {},
          totalScore: parseFloat(total.toFixed(2)),
          grade: parseFloat(((total / 100) * 5).toFixed(2)),
          bonusPoints: 0,
          period: null,
          notes: 'Auto-generated from weekly activity backfill',
          evaluationDate: new Date()
        });
      }
      updated++;
    }
    if (updated > 0) {
      console.log(`🔁 Evaluation cat9_c1 reconciled for ${updated} employee(s)`);
    }
    return updated;
  } catch (error) {
    console.error('Reconcile evaluation criterion error:', error);
    return 0;
  }
};
