const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A file uploaded into a financial request — supplier quotations and
// other supporting documents. Files are immutable and referenced by id
// from the request data, so versions that keep the same file don't store
// it twice.
const FinancialRequestFile = sequelize.define('FinancialRequestFile', {
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
  tableName: 'financial_request_files',
  timestamps: true,
  indexes: [{ fields: ['requestId'] }]
});

module.exports = FinancialRequestFile;
