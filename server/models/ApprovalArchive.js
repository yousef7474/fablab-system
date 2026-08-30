const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A snapshot of every request that was sent to a manager for approval.
// Written at the moment the admin clicks "Send for approval" so the
// original email HTML and the request payload can be re-viewed and
// re-printed later even if the source row has been edited.
//
// One row per send-event. If a request is sent, rejected, and resent,
// the archive gets two rows so the audit trail is preserved.
const ApprovalArchive = sequelize.define('ApprovalArchive', {
  archiveId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // 'volunteer_opportunity' | 'overtime' | (future: 'fablab_visit' | ...)
  type: {
    type: DataTypes.STRING(48),
    allowNull: false
  },
  // Loose FK — deliberately not a hard FK so deleting the source row
  // never orphans the archive.
  sourceId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  // Human-friendly reference number (e.g. VOR-014, OT-032). Whatever
  // the source uses in its printed docs.
  requestNumber: {
    type: DataTypes.STRING(48),
    allowNull: true
  },
  // Short label — printed in the archive list. Usually the request
  // title / employee name.
  title: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  // The exact email fields sent. `emailHtml` is what the print-copy
  // action re-opens in a new tab.
  managerEmail: { type: DataTypes.STRING(255), allowNull: false },
  managerName:  { type: DataTypes.STRING(255), allowNull: true },
  subject:      { type: DataTypes.STRING(500), allowNull: true },
  emailHtml:    { type: DataTypes.TEXT, allowNull: false },
  // Full snapshot of the source row at send-time. Serves as the
  // "source of truth" for the archive — the source table may drift.
  payloadSnapshot: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  // Mirrors the source status. Set at insert to 'pending' and updated
  // when the manager decides. Kept in the archive so the list can be
  // filtered without a join.
  status: {
    type: DataTypes.STRING(16),
    allowNull: false,
    defaultValue: 'pending'
  },
  sentAt:    { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  decidedAt: { type: DataTypes.DATE, allowNull: true },
  // Which admin clicked "send". Loose reference — no cascade.
  sentById:  { type: DataTypes.UUID, allowNull: true }
}, {
  tableName: 'approval_archive',
  timestamps: true,
  indexes: [
    { fields: ['type'] },
    { fields: ['status'] },
    { fields: ['sourceId'] },
    { fields: ['sentAt'] }
  ]
});

module.exports = ApprovalArchive;
