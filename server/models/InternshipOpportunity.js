const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Co-op training (التدريب التعاوني) openings listed on the public site.
const InternshipOpportunity = sequelize.define('InternshipOpportunity', {
  opportunityId: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  titleEn: { type: DataTypes.STRING, allowNull: true },
  department: { type: DataTypes.STRING, allowNull: true },
  departmentEn: { type: DataTypes.STRING, allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  descriptionEn: { type: DataTypes.TEXT, allowNull: true },
  requirements: { type: DataTypes.TEXT, allowNull: true },
  requirementsEn: { type: DataTypes.TEXT, allowNull: true },
  duration: { type: DataTypes.STRING(80), allowNull: true },
  durationEn: { type: DataTypes.STRING(80), allowNull: true },
  seats: { type: DataTypes.INTEGER, allowNull: true },
  deadline: { type: DataTypes.DATEONLY, allowNull: true },
  isOpen: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  isPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
  tableName: 'internship_opportunities',
  timestamps: true
});

module.exports = InternshipOpportunity;
