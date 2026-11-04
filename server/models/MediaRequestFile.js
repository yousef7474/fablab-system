const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A file of a media design request: the employee's ad images (kind
// 'image') or the design team's deliverables (kind 'design'). Files are
// immutable and referenced by id from the form / the delivery events, so
// every design version keeps its files.
const MediaRequestFile = sequelize.define('MediaRequestFile', {
  fileId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  requestId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  kind: {
    type: DataTypes.STRING(12), // 'image' | 'design'
    allowNull: false,
    defaultValue: 'image'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  mime: {
    type: DataTypes.STRING,
    allowNull: true
  },
  size: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  content: {
    type: DataTypes.BLOB,
    allowNull: false
  },
  // employee | designer
  uploadedByRole: {
    type: DataTypes.STRING(12),
    allowNull: true
  },
  uploadedBy: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  tableName: 'media_request_files',
  timestamps: true,
  indexes: [{ fields: ['requestId'] }]
});

module.exports = MediaRequestFile;
