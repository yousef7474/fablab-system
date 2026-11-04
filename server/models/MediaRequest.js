const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Media design request (طلب تصميم إعلان — «المتطلبات الإعلامية»). Its own
// line, not the kits' review flow: the employee fills the form → the
// design team (admin dashboard) delivers a design → the employee checks it
// (reject sends it back to the designer) → project manager → manager; a
// reviewer's return goes to the designer or to the employee. Every step is
// a MediaRequestEvent; `data` is the employee's form
// (client/src/components/Requests/media/mediaModel.js).
const MediaRequest = sequelize.define('MediaRequest', {
  requestId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  requestNumber: {
    type: DataTypes.INTEGER,
    allowNull: true,
    unique: true
  },
  employeeId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: true
  },
  data: {
    type: DataTypes.JSON,
    allowNull: true
  },
  // Completion % of the form (its checks), saved by the editor.
  completion: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // draft → design → employee_check → pm_review → manager_review →
  // approved; employee_check —reject→ design; a PM / manager return goes
  // to design or returned_employee (→ design again once re-sent).
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'draft'
  },
  // Number of designs delivered so far (the latest is the current one).
  designVersion: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  submittedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Latest note on the line (shown on list cards).
  lastNote: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  lastEventType: {
    type: DataTypes.STRING(24),
    allowNull: true
  }
}, {
  tableName: 'media_requests',
  timestamps: true,
  // The manager's delete is a soft delete (deletedAt).
  paranoid: true
});

module.exports = MediaRequest;
