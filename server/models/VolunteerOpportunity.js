const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const VolunteerOpportunity = sequelize.define('VolunteerOpportunity', {
  opportunityId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  volunteerId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  dailyHours: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 8,
    comment: 'Hours worked per day'
  },
  // Optional daily time window (HH:MM, 24h) for the chance. When both
  // are set, the QR check-out auto-marks the volunteer present in this
  // chance if their [checkInAt, checkOutAt] overlaps the window, with
  // hours = actual overlap duration. Old chances without times remain
  // fully manual — no change in behaviour.
  dailyStartTime: {
    type: DataTypes.STRING(5),
    allowNull: true
  },
  dailyEndTime: {
    type: DataTypes.STRING(5),
    allowNull: true
  },
  totalHours: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Auto-calculated total hours'
  },
  hoursAdjustment: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0,
    comment: 'Manual hours adjustment (+/-)'
  },
  adjustmentReason: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Reason for hours adjustment'
  },
  // Per-day attendance log. Same shape as the worker variant —
  // [{ date: 'YYYY-MM-DD', attended: true, hours: 8 }, ...] — but used
  // only for hours tracking (no cost calculation; volunteers are unpaid).
  attendanceDays: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 1
    },
    comment: 'Simple 1 point rating - same as employee rating'
  },
  ratingCriteria: {
    type: DataTypes.STRING,
    allowNull: true
  },
  ratingNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  createdById: {
    type: DataTypes.UUID,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('active', 'completed', 'cancelled'),
    defaultValue: 'active'
  }
}, {
  tableName: 'volunteer_opportunities',
  timestamps: true,
  hooks: {
    beforeValidate: (opportunity) => {
      if (opportunity.description === '') opportunity.description = null;
      if (opportunity.ratingCriteria === '') opportunity.ratingCriteria = null;
      if (opportunity.ratingNotes === '') opportunity.ratingNotes = null;
    },
    beforeCreate: (opportunity) => {
      if (opportunity.startDate && opportunity.endDate && opportunity.dailyHours) {
        const days = countWorkingDays(opportunity.startDate, opportunity.endDate);
        opportunity.totalHours = days * opportunity.dailyHours;
      }
    },
    beforeUpdate: (opportunity) => {
      if (opportunity.changed('startDate') || opportunity.changed('endDate') || opportunity.changed('dailyHours')) {
        const days = countWorkingDays(opportunity.startDate, opportunity.endDate);
        opportunity.totalHours = days * opportunity.dailyHours;
      }
    }
  }
});

// Weekend in Saudi Arabia is Fri (5) + Sat (6) — Sun–Thu are the
// operating days at FabLab, so an opportunity spanning a full week
// only has 5 working days, not 7. Counting the full calendar span
// makes attended-days / expected-days look artificially bad because
// nobody scans on Fri/Sat.
function countWorkingDays(start, end) {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const dow = cur.getDay(); // 0=Sun ... 5=Fri, 6=Sat
    if (dow !== 5 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// Exported so a boot-time backfill can recompute totalHours on
// existing rows without duplicating the logic.
VolunteerOpportunity.countWorkingDays = countWorkingDays;

module.exports = VolunteerOpportunity;
