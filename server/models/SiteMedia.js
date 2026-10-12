const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Public website media center: news, media coverage and reports
// (managed from the admin "الموقع الإلكتروني" tab; first imported from
// the old main.fablabsahsa.com). Images live in the row (base64) and are
// served by /api/site/media/:id/image; lists never load them.
const SiteMedia = sequelize.define('SiteMedia', {
  mediaId: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  legacyId: { type: DataTypes.INTEGER, allowNull: true, unique: true },
  kind: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'news' },        // news | coverage | report
  mediaType: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'image' },  // image | video | text
  title: { type: DataTypes.TEXT, allowNull: false },
  titleEn: { type: DataTypes.TEXT, allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  descriptionEn: { type: DataTypes.TEXT, allowNull: true },
  image: { type: DataTypes.TEXT, allowNull: true },          // base64 (no data: prefix)
  imageMime: { type: DataTypes.STRING(40), allowNull: true },
  videoUrl: { type: DataTypes.TEXT, allowNull: true },
  link: { type: DataTypes.TEXT, allowNull: true },
  date: { type: DataTypes.DATEONLY, allowNull: true },
  duration: { type: DataTypes.STRING(255), allowNull: true },
  views: { type: DataTypes.INTEGER, allowNull: true },
  category: { type: DataTypes.STRING(255), allowNull: true },
  isPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, {
  tableName: 'site_media',
  timestamps: true,
  indexes: [{ fields: ['kind'] }, { fields: ['date'] }],
  defaultScope: { attributes: { exclude: ['image'] } }
});

module.exports = SiteMedia;
