const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');

// Public store customer accounts — email/password with hashed
// storage. Orders are looked up by matching `customerEmail` so no
// hard FK is needed; that also means an account can claim historical
// guest orders that used the same email.
const StoreCustomer = sequelize.define('StoreCustomer', {
  customerId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name:         { type: DataTypes.STRING, allowNull: false },
  email:        { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
  password:     { type: DataTypes.STRING, allowNull: false },
  phone:        { type: DataTypes.STRING, allowNull: true },
  nationalId:   { type: DataTypes.STRING, allowNull: true },
  address:      { type: DataTypes.TEXT, allowNull: true },
  isActive:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  lastLoginAt:  { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'store_customers',
  timestamps: true,
  hooks: {
    beforeValidate: (c) => {
      if (c.email) c.email = String(c.email).trim().toLowerCase();
    },
    beforeCreate: async (c) => {
      if (c.password) {
        const salt = await bcrypt.genSalt(10);
        c.password = await bcrypt.hash(c.password, salt);
      }
    },
    beforeUpdate: async (c) => {
      if (c.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        c.password = await bcrypt.hash(c.password, salt);
      }
    }
  }
});

StoreCustomer.prototype.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = StoreCustomer;
