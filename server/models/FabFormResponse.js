const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// One submission of a FabLab form. `answers` is keyed by field id;
// `fieldsSnapshot` keeps the questions as they were when answered, so
// later edits to the form don't relabel old answers.
const FabFormResponse = sequelize.define('FabFormResponse', {
  responseId: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  formId: { type: DataTypes.UUID, allowNull: false },
  reference: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  answers: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
  fieldsSnapshot: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  // The first name / email field's answer, for lists and the confirmation email.
  respondentName: { type: DataTypes.STRING(200), allowNull: true },
  respondentEmail: { type: DataTypes.STRING(200), allowNull: true },
  // When the form has a payment page: opens that page pre-filled and ties
  // the payment to this response (/pay/:slug?fr=<payToken>).
  payToken: { type: DataTypes.UUID, allowNull: true },
  // Event reminders: the "days before" already sent, and the person's
  // answer from the reminder link (yes | no) behind `attendToken`.
  remindersSent: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  attendance: { type: DataTypes.STRING(10), allowNull: true },
  attendanceAt: { type: DataTypes.DATE, allowNull: true },
  attendToken: { type: DataTypes.UUID, allowNull: true }
}, {
  tableName: 'fab_form_responses',
  timestamps: true,
  indexes: [{ fields: ['formId'] }]
});

module.exports = FabFormResponse;
