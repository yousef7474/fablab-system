const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Settings = sequelize.define('Settings', {
  key: {
    type: DataTypes.STRING(255),
    primaryKey: true,
    allowNull: false,
    unique: true
  },
  value: {
    type: DataTypes.JSON,
    allowNull: false
  }
}, {
  tableName: 'settings',
  timestamps: true
});

// Seed default working hours if they don't exist
Settings.seedDefaults = async () => {
  const defaults = [
    { key: 'working_hours_start', value: '11:00' },
    { key: 'working_hours_end', value: '19:00' },
    { key: 'working_days', value: [0, 1, 2, 3, 4] } // Sunday=0 through Thursday=4
  ];

  for (const setting of defaults) {
    await Settings.findOrCreate({
      where: { key: setting.key },
      defaults: { value: setting.value }
    });
  }
};

module.exports = Settings;
