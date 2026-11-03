const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A file uploaded into a training kit — an attachment (الاختبار القبلي،
// العرض التقديمي، ملفات المخرجات…) or an output reference image. Files
// are immutable and referenced by id from the kit data, so versions that
// keep the same file don't store it twice.
const TrainingKitFile = sequelize.define('TrainingKitFile', {
  fileId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  kitId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  kind: {
    type: DataTypes.STRING(12), // 'attachment' | 'image'
    allowNull: false,
    defaultValue: 'attachment'
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
  uploadedBy: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  tableName: 'training_kit_files',
  timestamps: true,
  indexes: [{ fields: ['kitId'] }]
});

module.exports = TrainingKitFile;
