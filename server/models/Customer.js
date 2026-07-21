const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Marketing / mailing-list contact — a person the fab lab wants to be
// able to email in bulk (announcements, workshops, program launches).
// Not tied to a Registration or User account; kept intentionally simple
// so the manager can paste names/emails/phones without ceremony.
const Customer = sequelize.define('Customer', {
  customerId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name:  { type: DataTypes.STRING(255), allowNull: false },
  email: { type: DataTypes.STRING(255), allowNull: true },
  phone: { type: DataTypes.STRING(50),  allowNull: true },
  isActive:    { type: DataTypes.BOOLEAN, defaultValue: true },
  createdById: { type: DataTypes.UUID,    allowNull: true }
}, {
  tableName: 'customers',
  timestamps: true,
  indexes: [
    { fields: ['email'] },
    { fields: ['isActive'] }
  ],
  hooks: {
    beforeValidate: (c) => {
      if (c.email === '') c.email = null;
      if (c.phone === '') c.phone = null;
      if (typeof c.email === 'string') c.email = c.email.trim().toLowerCase();
      if (typeof c.name  === 'string') c.name  = c.name.trim();
      if (typeof c.phone === 'string') c.phone = c.phone.trim();
    }
  }
});

module.exports = Customer;
