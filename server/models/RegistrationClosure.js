const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RegistrationClosure = sequelize.define('RegistrationClosure', {
  closureId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
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
    allowNull: false
  },
  reasonAr: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  createdById: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'admins', key: 'adminId' }
  }
}, {
  tableName: 'registration_closures',
  timestamps: true
});

module.exports = RegistrationClosure;
