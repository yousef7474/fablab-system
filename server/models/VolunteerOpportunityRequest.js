const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A formal request to open a new volunteer opportunity. Admin fills
// the form and sends it to a manager for approval — mirrors the
// overtime and fablab-visit approval flows: draft → pending →
// approved | rejected, with an emailed token link + a dashboard
// approvals card for the manager.
//
// This model is intentionally separate from VolunteerOpportunity
// (which represents an ALREADY-ASSIGNED volunteer's placement with
// attendance and hours). This one is the paper trail before that
// exists.
const VolunteerOpportunityRequest = sequelize.define('VolunteerOpportunityRequest', {
  requestId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // Human-friendly sequential number, formatted "VOR-###" in UI.
  requestNumber: { type: DataTypes.INTEGER, allowNull: true, unique: true },

  // ---------- Coordinator (منسق الفرصة) ----------
  coordinatorName:  { type: DataTypes.STRING, allowNull: false },
  coordinatorPhone: { type: DataTypes.STRING, allowNull: false },

  // ---------- Opportunity core ----------
  title:       { type: DataTypes.STRING(500), allowNull: false }, // مسمى الفرصة
  location:    { type: DataTypes.STRING(500), allowNull: true },  // مكان الفرصة
  // 'onsite' | 'remote' | 'hybrid'
  mode:        { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'onsite' },
  description: { type: DataTypes.TEXT, allowNull: true },
  responsibilities: { type: DataTypes.TEXT, allowNull: true }, // مهام ومسؤوليات المتطوع
  volunteersNeeded: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 1 },
  // 'male' | 'female' | 'any'
  genderPreference: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'any' },

  // Age range (both optional; admin may specify one, the other, or neither)
  minAge: { type: DataTypes.INTEGER, allowNull: true },
  maxAge: { type: DataTypes.INTEGER, allowNull: true },

  // Program times (per-day window, HH:MM 24h)
  programStartTime: { type: DataTypes.STRING(5), allowNull: true },
  programEndTime:   { type: DataTypes.STRING(5), allowNull: true },

  // Skills + qualification
  requiredSkills:      { type: DataTypes.TEXT, allowNull: true },
  educationLevel:      { type: DataTypes.STRING(255), allowNull: true }, // المؤهل العلمي
  supportProvided:     { type: DataTypes.TEXT, allowNull: true },        // الدعم المقدم للمتطوع
  risksAndChallenges:  { type: DataTypes.TEXT, allowNull: true },        // المخاطر والتحديات

  // Overall opportunity date range
  startDate: { type: DataTypes.DATEONLY, allowNull: true },
  endDate:   { type: DataTypes.DATEONLY, allowNull: true },

  // Admin trace
  createdById: { type: DataTypes.UUID, allowNull: true },

  // ---------- Approval workflow ----------
  // 'draft' → 'pending' → 'approved' | 'rejected'
  approvalStatus: {
    type: DataTypes.STRING(16),
    allowNull: false,
    defaultValue: 'draft'
  },
  approvalToken:     { type: DataTypes.UUID, allowNull: true, unique: true },
  managerEmail:      { type: DataTypes.STRING, allowNull: true },
  managerName:       { type: DataTypes.STRING, allowNull: true },
  managerNote:       { type: DataTypes.TEXT, allowNull: true },
  sentForApprovalAt: { type: DataTypes.DATE, allowNull: true },
  approvedAt:        { type: DataTypes.DATE, allowNull: true },
  rejectedAt:        { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'volunteer_opportunity_requests',
  timestamps: true,
  indexes: [
    { fields: ['approvalStatus'] },
    { fields: ['requestNumber'] },
    { fields: ['approvalToken'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = VolunteerOpportunityRequest;
