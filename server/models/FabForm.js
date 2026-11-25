const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A FabLab form (admin "نماذج فاب لاب"): our own replacement for Google
// Forms. The admin builds the questions (`fields`, see utils/fabForms.js),
// shares /forms/:slug, and turns it on / off by hand or with an open and
// close time. Answers are FabFormResponse rows.
const FabForm = sequelize.define('FabForm', {
  formId: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  slug: { type: DataTypes.STRING(40), allowNull: false, unique: true },
  title: { type: DataTypes.STRING(200), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  // Optional English (the public page offers an English toggle when set).
  titleEn: { type: DataTypes.STRING(200), allowNull: true },
  descriptionEn: { type: DataTypes.TEXT, allowNull: true },
  fields: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  opensAt: { type: DataTypes.DATE, allowNull: true },
  closesAt: { type: DataTypes.DATE, allowNull: true },
  // Shown on the public page while the form is not taking answers.
  closedMessage: { type: DataTypes.TEXT, allowNull: true },
  closedMessageEn: { type: DataTypes.TEXT, allowNull: true },
  // Shown after a successful submission.
  successMessage: { type: DataTypes.TEXT, allowNull: true },
  successMessageEn: { type: DataTypes.TEXT, allowNull: true },
  // null = no limit.
  maxResponses: { type: DataTypes.INTEGER, allowNull: true },
  // Email the respondent a copy of their answers (needs an email field).
  sendConfirmation: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  createdBy: { type: DataTypes.STRING(150), allowNull: true },
  updatedBy: { type: DataTypes.STRING(150), allowNull: true }
}, {
  tableName: 'fab_forms',
  timestamps: true
});

module.exports = FabForm;
