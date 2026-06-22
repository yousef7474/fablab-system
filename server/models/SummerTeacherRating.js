const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Awards/deductions for a teacher's performance. Mirrors VolunteerRating
// so the same scoring conventions apply.
const SummerTeacherRating = sequelize.define('SummerTeacherRating', {
  ratingId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  teacherId: { type: DataTypes.UUID, allowNull: false },
  programId: { type: DataTypes.UUID, allowNull: true },
  type:      {
    type: DataTypes.STRING(20), allowNull: false, defaultValue: 'award',
    validate: { isIn: [['award', 'deduction']] }
  },
  points:    {
    type: DataTypes.INTEGER, allowNull: false, defaultValue: 1,
    validate: { min: 1, max: 5 }
  },
  criteria:  { type: DataTypes.STRING, allowNull: true },
  notes:     { type: DataTypes.TEXT, allowNull: true },
  ratingDate:{ type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
  createdById: { type: DataTypes.UUID, allowNull: true }
}, {
  tableName: 'summer_teacher_ratings',
  timestamps: true,
  hooks: {
    beforeValidate: (r) => {
      if (r.criteria === '') r.criteria = null;
      if (r.notes === '') r.notes = null;
    }
  }
});

module.exports = SummerTeacherRating;
