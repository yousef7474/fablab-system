const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Applications to a co-op training opening (CV + university letter).
const InternshipApplication = sequelize.define('InternshipApplication', {
  applicationId: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  opportunityId: { type: DataTypes.UUID, allowNull: false },
  fullName: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING(30), allowNull: false },
  university: { type: DataTypes.STRING, allowNull: false },
  major: { type: DataTypes.STRING, allowNull: false },
  gpa: { type: DataTypes.DECIMAL(4, 2), allowNull: true },
  motivation: { type: DataTypes.TEXT, allowNull: false },
  experience: { type: DataTypes.TEXT, allowNull: true },
  cvFile: { type: DataTypes.JSON, allowNull: true },
  letterFile: { type: DataTypes.JSON, allowNull: true },
  cvFileName: { type: DataTypes.STRING, allowNull: true },
  letterFileName: { type: DataTypes.STRING, allowNull: true },
  status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'new' }, // new | reviewing | accepted | rejected
  adminNote: { type: DataTypes.TEXT, allowNull: true }
}, {
  tableName: 'internship_applications',
  timestamps: true,
  indexes: [{ fields: ['opportunityId'] }],
  defaultScope: { attributes: { exclude: ['cvFile', 'letterFile'] } }
});

module.exports = InternshipApplication;
