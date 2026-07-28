const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Archived contract — one row per saved contract the admin filled in the
// Contracts tab. `templateId` selects which template modal opens on edit
// (e.g. 'technical-trainer'); `data` is the full form snapshot so a
// reprint is byte-identical to the original.
const Contract = sequelize.define('Contract', {
  contractId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  templateId: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  data: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {}
  },
  createdById: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  tableName: 'contracts',
  timestamps: true,
  indexes: [
    { fields: ['templateId'] },
    { fields: ['createdAt'] }
  ],
  hooks: {
    beforeValidate: (c) => {
      if (typeof c.title === 'string') c.title = c.title.trim();
      if (c.title === '') c.title = null;
    }
  }
});

module.exports = Contract;
