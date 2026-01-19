const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SectionAvailability = sequelize.define('SectionAvailability', {
  availabilityId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  section: {
    type: DataTypes.ENUM(
      'Electronics and Programming',
      'CNC Laser',
      'CNC Wood',
      '3D',
      'Robotic and AI',
      "Kid's Club",
      'Vinyl Cutting'
    ),
    allowNull: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'true = deactivation is currently in effect (section unavailable)'
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  reasonEn: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: 'Reason for deactivation in English'
  },
  reasonAr: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Reason for deactivation in Arabic'
  },
  createdById: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'admins',
      key: 'adminId'
    }
  },
  reactivatedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the section was manually reactivated'
  },
  reactivatedById: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'admins',
      key: 'adminId'
    }
  }
}, {
  tableName: 'section_availabilities',
  timestamps: true,
  hooks: {
    beforeValidate: (record) => {
      if (record.reasonEn === '') record.reasonEn = null;
      if (record.reasonAr === '') record.reasonAr = null;
    }
  }
});

module.exports = SectionAvailability;
