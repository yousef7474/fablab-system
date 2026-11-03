const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Training kit (الحقيبة التدريبية) an employee prepares and sends for
// approval: employee → project manager (مسؤول إدارة المشاريع) → manager.
// `data` is the working draft in the shape of the kit template
// (client/src/components/TrainingKits/kitModel.js); every submission
// freezes a copy in TrainingKitVersion, which is what reviewers see.
const TrainingKit = sequelize.define('TrainingKit', {
  kitId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  kitNumber: {
    type: DataTypes.INTEGER,
    allowNull: true,
    unique: true
  },
  employeeId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: true
  },
  data: {
    type: DataTypes.JSON,
    allowNull: true
  },
  // Completion % of the draft (the template's checks), saved by the editor.
  completion: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // draft → pm_review → manager_review → approved; a reviewer can send
  // it back (returned, with returnedBy = 'pm' | 'manager').
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'draft'
  },
  returnedBy: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  currentVersion: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  submittedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  approvedVersion: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'training_kits',
  timestamps: true,
  // The manager's delete is a soft delete (deletedAt) — gone from every
  // screen, still recoverable in the database.
  paranoid: true
});

module.exports = TrainingKit;
