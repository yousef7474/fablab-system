const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A teacher / instructor who registers through an education workshop's
// shareable link (next to the students). Picks one of the FabLab rooms
// (utils/eduRooms.js) and lists what they need prepared — written
// and/or as an uploaded file. Several teachers may join one workshop.
const WorkshopTeacher = sequelize.define('WorkshopTeacher', {
  teacherId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  workshopId: { type: DataTypes.UUID, allowNull: false },
  fullName:   { type: DataTypes.STRING, allowNull: false },
  phone:      { type: DataTypes.STRING, allowNull: false },
  email:      { type: DataTypes.STRING, allowNull: false },
  jobTitle:   { type: DataTypes.STRING, allowNull: false },   // الوظيفة / التخصص
  nationalId: { type: DataTypes.STRING, allowNull: true },
  room:       { type: DataTypes.STRING(32), allowNull: false }, // eduRooms id
  requirements: { type: DataTypes.TEXT, allowNull: true },
  // { fileName, fileType, fileSize, fileData (base64) }
  requirementsFile: { type: DataTypes.JSON, allowNull: true },
  // Name/size kept beside it so lists don't load the file itself.
  requirementsFileName: { type: DataTypes.STRING, allowNull: true },
  requirementsFileSize: { type: DataTypes.INTEGER, allowNull: true },
  confirmationSentAt: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'workshop_teachers',
  timestamps: true,
  indexes: [{ fields: ['workshopId'] }, { fields: ['room'] }],
  // The requirements file can be several MB — loaded only for download.
  defaultScope: {
    attributes: { exclude: ['requirementsFile'] }
  }
});

module.exports = WorkshopTeacher;
