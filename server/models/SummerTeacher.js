const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Summer FabLab teacher / engineer. fablabSection is plain STRING (not
// ENUM) so admins can type a custom section that isn't in the standard
// FabLab list.
const SummerTeacher = sequelize.define('SummerTeacher', {
  teacherId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name:       { type: DataTypes.STRING, allowNull: false },
  nationalId: { type: DataTypes.STRING, allowNull: true },
  phone:      { type: DataTypes.STRING, allowNull: true },
  email:      { type: DataTypes.STRING, allowNull: true, validate: { isEmail: true } },
  fablabSection: { type: DataTypes.STRING, allowNull: true },
  bio:        { type: DataTypes.TEXT,   allowNull: true },
  isActive:   { type: DataTypes.BOOLEAN, defaultValue: true },
  createdById:{ type: DataTypes.UUID,   allowNull: true }
}, {
  tableName: 'summer_teachers',
  timestamps: true,
  hooks: {
    beforeValidate: (t) => {
      if (t.email === '') t.email = null;
      if (t.fablabSection === '') t.fablabSection = null;
    }
  }
});

module.exports = SummerTeacher;
