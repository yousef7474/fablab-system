const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Past workshops shown on the public website's workshops page (archive
// imported from the old site, editable in the admin). Live workshops come
// from the Workshop table.
const SiteWorkshopArchive = sequelize.define('SiteWorkshopArchive', {
  archiveId: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  legacyId: { type: DataTypes.INTEGER, allowNull: true, unique: true },
  title: { type: DataTypes.TEXT, allowNull: false },
  titleEn: { type: DataTypes.TEXT, allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  descriptionEn: { type: DataTypes.TEXT, allowNull: true },
  duration: { type: DataTypes.STRING(255), allowNull: true },
  image: { type: DataTypes.TEXT, allowNull: true },
  imageMime: { type: DataTypes.STRING(40), allowNull: true },
  link: { type: DataTypes.TEXT, allowNull: true },
  startDate: { type: DataTypes.DATEONLY, allowNull: true },
  endDate: { type: DataTypes.DATEONLY, allowNull: true },
  isPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, {
  tableName: 'site_workshop_archive',
  timestamps: true,
  defaultScope: { attributes: { exclude: ['image'] } }
});

module.exports = SiteWorkshopArchive;
