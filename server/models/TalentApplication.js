const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// "أنا موهوب" registrations from the public website.
const TalentApplication = sequelize.define('TalentApplication', {
  applicationId: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  fullName: { type: DataTypes.STRING, allowNull: false },
  age: { type: DataTypes.INTEGER, allowNull: false },
  educationLevel: { type: DataTypes.STRING(120), allowNull: false },
  nationality: { type: DataTypes.STRING(80), allowNull: false },
  countryCode: { type: DataTypes.STRING(8), allowNull: true },
  phone: { type: DataTypes.STRING(30), allowNull: false },
  email: { type: DataTypes.STRING, allowNull: true },
  talentDescription: { type: DataTypes.TEXT, allowNull: false },
  achievements: { type: DataTypes.TEXT, allowNull: false },
  // [{ fileName, fileType, fileSize, fileData }]
  files: { type: DataTypes.JSON, allowNull: true },
  // [{ fileName, fileType, fileSize }] — for lists without loading the files
  fileList: { type: DataTypes.JSON, allowNull: true },
  status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'new' }, // new | reviewing | accepted | rejected
  adminNote: { type: DataTypes.TEXT, allowNull: true },
  termsAcceptedAt: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'talent_applications',
  timestamps: true,
  defaultScope: { attributes: { exclude: ['files'] } }
});

module.exports = TalentApplication;
