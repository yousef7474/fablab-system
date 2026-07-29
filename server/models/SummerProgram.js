const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Summer FabLab program — owns its teacher, student headcount, schedule,
// fablab section, and assigned volunteers list. Teacher + volunteers
// stored as free text / JSON strings for now; will be migrated to
// foreign keys when the Summer FabLab teachers/volunteers sub-tabs ship.
const SummerProgram = sequelize.define('SummerProgram', {
  programId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  teacherName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Legacy free-text teacher field (kept for back-compat).'
  },
  teacherId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Legacy single teacher FK — kept in sync with teacherIds[0] for back-compat. New code should read teacherIds.'
  },
  teacherIds: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Multi-teacher assignment — array of SummerTeacher UUIDs. Programs can have multiple assigned teachers.'
  },
  studentCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  startTime: {
    type: DataTypes.TIME,
    allowNull: true
  },
  endTime: {
    type: DataTypes.TIME,
    allowNull: true
  },
  fablabSection: {
    type: DataTypes.ENUM(
      'Electronics and Programming',
      'CNC Laser',
      'CNC Wood',
      '3D',
      'Robotic and AI',
      "Kid's Club",
      'Vinyl Cutting'
    ),
    allowNull: true
  },
  sectionVolunteers: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Array of volunteer names assigned to this program section'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  color: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'Hex color (#rrggbb) — themes the program card + every enrolled student\'s ID card. Overrides the section-derived default when set.'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  createdById: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  tableName: 'summer_programs',
  timestamps: true,
  hooks: {
    beforeValidate: (program) => {
      if (program.fablabSection === '') program.fablabSection = null;
    }
  }
});

module.exports = SummerProgram;
