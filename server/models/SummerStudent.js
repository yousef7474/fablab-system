const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Student enrolled in a Summer FabLab program. Attendance is logged
// per-day in the same shape as worker/volunteer opportunities — but
// without hours: just a present/absent flag.
//   attendanceDays: [{ date: 'YYYY-MM-DD', attended: true }, ...]
const SummerStudent = sequelize.define('SummerStudent', {
  studentId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  programId: { type: DataTypes.UUID, allowNull: false },
  name:       { type: DataTypes.STRING, allowNull: false },
  nationalId: { type: DataTypes.STRING, allowNull: true },
  phone:      { type: DataTypes.STRING, allowNull: true },
  email:      { type: DataTypes.STRING, allowNull: true, validate: { isEmail: true } },
  age:        { type: DataTypes.INTEGER, allowNull: true },
  gender:     {
    type: DataTypes.ENUM('Male', 'Female'),
    allowNull: true
  },
  notes:      { type: DataTypes.TEXT, allowNull: true },
  attendanceDays: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
  isActive:   { type: DataTypes.BOOLEAN, defaultValue: true },
  createdById:{ type: DataTypes.UUID, allowNull: true }
}, {
  tableName: 'summer_students',
  timestamps: true,
  hooks: {
    beforeValidate: (s) => {
      if (s.email === '') s.email = null;
      if (s.gender === '') s.gender = null;
    }
  }
});

module.exports = SummerStudent;
