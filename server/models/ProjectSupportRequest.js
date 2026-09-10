const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// User-submitted "طلب دعم للمشروع" — an open-ended request for help
// (funding, tech advice, mentorship, materials) that people used to
// squeeze into the beneficiary form's notes field with no way to
// attach supporting docs. Two-stage flow mirrors FablabVisit:
//   1. Public submit → confirmation email to submitter + heads-up
//      email to ops inbox
//   2. Admin reviews, sends to manager for decision via emailed
//      token link. Manager writes a response → user gets the
//      approve/reject email with the manager's comments.
//
// Files are stored inline as base64 in a JSON array so the flow
// doesn't need an object-store dependency. Client caps at 10 files
// (≤ ~10 MB each). The controller keeps a payload snapshot in the
// approval archive so responses stay printable even after a delete.
const ProjectSupportRequest = sequelize.define('ProjectSupportRequest', {
  requestId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // Human-friendly sequential number, shown as "PSR-###".
  requestNumber: {
    type: DataTypes.INTEGER,
    allowNull: true,
    unique: true
  },

  // ────────── Personal info (mirrors beneficiary form) ──────────
  firstName:      { type: DataTypes.STRING, allowNull: false },
  lastName:       { type: DataTypes.STRING, allowNull: true  },
  sex:            { type: DataTypes.STRING(16), allowNull: true },
  nationality:    { type: DataTypes.STRING, allowNull: true },
  nationalId:     { type: DataTypes.STRING, allowNull: false },
  phoneNumber:    { type: DataTypes.STRING, allowNull: false },
  email:          { type: DataTypes.STRING, allowNull: false, validate: { isEmail: true } },
  age:            { type: DataTypes.INTEGER, allowNull: true },
  city:           { type: DataTypes.STRING, allowNull: true },

  // ────────── Request content ──────────
  projectTitle:   { type: DataTypes.STRING(500), allowNull: true },
  supportType:    { type: DataTypes.STRING(64),  allowNull: true }, // 'funding' | 'tech' | 'materials' | 'mentorship' | 'other'
  description:    { type: DataTypes.TEXT, allowNull: false },
  // [{ fileName, fileType, fileSize, fileData (base64) }, ...] — max 10
  files: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },

  // ────────── Manager approval workflow ──────────
  // draft (initial) → pending (sent to manager) → approved | rejected
  approvalStatus: {
    type: DataTypes.STRING(16),
    allowNull: false,
    defaultValue: 'draft'
  },
  approvalToken:      { type: DataTypes.UUID, allowNull: true, unique: true },
  managerEmail:       { type: DataTypes.STRING, allowNull: true },
  managerName:        { type: DataTypes.STRING, allowNull: true },
  managerResponse:    { type: DataTypes.TEXT, allowNull: true }, // the answer sent to the user
  sentForApprovalAt:  { type: DataTypes.DATE, allowNull: true },
  approvedAt:         { type: DataTypes.DATE, allowNull: true },
  rejectedAt:         { type: DataTypes.DATE, allowNull: true },

  // ────────── User notification tracking ──────────
  userEmailSentAt:    { type: DataTypes.DATE, allowNull: true } // last time the decision email went to the user
}, {
  tableName: 'project_support_requests',
  timestamps: true,
  hooks: {
    beforeValidate: (row) => {
      if (row.email === '') row.email = null;
    }
  },
  indexes: [
    { fields: ['approvalStatus'] },
    { fields: ['requestNumber'] },
    { fields: ['approvalToken'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = ProjectSupportRequest;
