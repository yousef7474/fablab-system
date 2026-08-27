const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A "دعم مؤسسة" project file — one record per institution-supported
// student project. All uploaded assets are stored as base64 inside JSON
// columns so the admin dashboard can round-trip everything without any
// extra file-storage service.
const InstitutionProject = sequelize.define('InstitutionProject', {
  projectId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // Human-friendly sequential number, formatted "ISP-####" in UI.
  projectNumber: { type: DataTypes.INTEGER, allowNull: true, unique: true },

  // ---------- Meta ----------
  projectName:    { type: DataTypes.STRING(500), allowNull: false },
  supervisorName: { type: DataTypes.STRING(255), allowNull: true },
  // Array of student names — flexible so admin can add/remove without a
  // second table.
  studentNames:   { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  // Free-text evaluation of the project (percentage of support, amount
  // of support, notes on how well it went, etc.).
  evaluation:     { type: DataTypes.TEXT, allowNull: true },
  startDate:      { type: DataTypes.DATEONLY, allowNull: true },
  approvedBy:     { type: DataTypes.STRING(255), allowNull: true },
  notes:          { type: DataTypes.TEXT, allowNull: true },

  // ---------- Files ----------
  // Each file: { fileName, fileType, fileSize, fileData (base64) }
  reportAr:   { type: DataTypes.JSON, allowNull: true },
  reportEn:   { type: DataTypes.JSON, allowNull: true },
  patentFile: { type: DataTypes.JSON, allowNull: true },
  // Up to 50 project images, each shaped like the file objects above.
  images:     { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  // Purchase invoices: [{ fileName, fileType, fileSize, fileData,
  //   reason, amount?, invoiceDate? }]
  invoices:   { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  // FabLab registration files (registration paperwork submitted by
  // students when they joined the lab) — array of file objects.
  registrationFiles: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  // Optional screenshots of WhatsApp / email conversations related
  // to the project — array of image / pdf file objects.
  chatScreenshots:   { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  // Google Form results (evaluation form exports / responses) —
  // array of file objects. Usually PDFs or spreadsheets exported
  // from Google Forms; images are also allowed.
  googleFormResults: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },

  createdById: { type: DataTypes.UUID, allowNull: true },
  isActive:    { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, {
  tableName: 'institution_projects',
  timestamps: true,
  indexes: [
    { fields: ['projectNumber'] },
    { fields: ['isActive'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = InstitutionProject;
