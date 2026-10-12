const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Success stories: submitted from the public site ("شارك قصتك") and shown
// once an admin approves them.
const SiteStory = sequelize.define('SiteStory', {
  storyId: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  legacyId: { type: DataTypes.INTEGER, allowNull: true, unique: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: true },
  phone: { type: DataTypes.STRING(30), allowNull: true },
  title: { type: DataTypes.TEXT, allowNull: false },
  titleEn: { type: DataTypes.TEXT, allowNull: true },
  story: { type: DataTypes.TEXT, allowNull: false },
  storyEn: { type: DataTypes.TEXT, allowNull: true },
  image: { type: DataTypes.TEXT, allowNull: true },
  imageMime: { type: DataTypes.STRING(40), allowNull: true },
  status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'pending' } // pending | approved | rejected
}, {
  tableName: 'site_stories',
  timestamps: true,
  defaultScope: { attributes: { exclude: ['image'] } }
});

module.exports = SiteStory;
