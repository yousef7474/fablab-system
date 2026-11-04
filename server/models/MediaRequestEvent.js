const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// One step on a media design request's line — the full history the
// employee, the designer, the project manager and the manager all see.
// type: submitted | resubmitted | design_delivered | employee_approved |
//       employee_rejected | pm_approved | pm_returned | manager_approved |
//       manager_returned
const MediaRequestEvent = sequelize.define('MediaRequestEvent', {
  eventId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  requestId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  seq: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING(24),
    allowNull: false
  },
  // employee | designer | pm | manager
  actorRole: {
    type: DataTypes.STRING(12),
    allowNull: false
  },
  actorName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  actorId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  note: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // The design version the step is about (delivered / checked / decided).
  designVersion: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  // PM / manager returns: 'designer' | 'employee'
  returnTo: {
    type: DataTypes.STRING(12),
    allowNull: true
  },
  // Employee submissions: a copy of the form as sent.
  data: {
    type: DataTypes.JSON,
    allowNull: true
  },
  // Design deliveries: [{ fileId, name, size, mime }]
  files: {
    type: DataTypes.JSON,
    allowNull: true
  },
  // Where the request went (status after the step).
  statusAfter: {
    type: DataTypes.STRING(20),
    allowNull: true
  }
}, {
  tableName: 'media_request_events',
  timestamps: true,
  updatedAt: false,
  indexes: [{ fields: ['requestId', 'seq'], unique: true }]
});

module.exports = MediaRequestEvent;
