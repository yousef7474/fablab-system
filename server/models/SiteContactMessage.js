const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// "أرسل لنا رسالة" from the public website footer.
const SiteContactMessage = sequelize.define('SiteContactMessage', {
  messageId: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
}, {
  tableName: 'site_contact_messages',
  timestamps: true
});

module.exports = SiteContactMessage;
