const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Discount codes admin can generate + share with customers to apply
// against a paid workshop's price. Kept intentionally simple: a code,
// a % off, a reason, and who approved it (managers who can waive).
// Universal (applies to any paid workshop); we can scope by workshopId
// later if needed.
const WorkshopCoupon = sequelize.define('WorkshopCoupon', {
  code: {
    type: DataTypes.STRING(64),
    primaryKey: true,
    allowNull: false
  },
  percent: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1, max: 100 }
  },
  reason: { type: DataTypes.TEXT, allowNull: true },
  // Manager who authorised the discount — matches the same
  // approver list used by overtime requests.
  approvedBy: { type: DataTypes.STRING(120), allowNull: false },
  isActive:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  // Usage tracking. Not a hard cap unless maxUses is set.
  usageCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  maxUses:    { type: DataTypes.INTEGER, allowNull: true },
  createdById: { type: DataTypes.UUID, allowNull: true }
}, {
  tableName: 'workshop_coupons',
  timestamps: true,
  hooks: {
    beforeValidate: (row) => {
      if (row.code) row.code = String(row.code).trim().toUpperCase();
    }
  }
});

module.exports = WorkshopCoupon;
