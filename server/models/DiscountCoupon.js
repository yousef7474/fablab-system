const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Store discount codes. `percent` is an integer 1..100. Coupons are
// consumed via `usedCount` — admin can set `maxUses` to null for
// unlimited. Validity is bounded by validFrom / validUntil; both
// optional so a coupon can be permanently valid.
const DiscountCoupon = sequelize.define('DiscountCoupon', {
  couponId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  code:        { type: DataTypes.STRING(48), allowNull: false, unique: true },
  description: { type: DataTypes.STRING(255), allowNull: true },
  percent:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
  isActive:    { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  maxUses:     { type: DataTypes.INTEGER, allowNull: true },
  usedCount:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  validFrom:   { type: DataTypes.DATEONLY, allowNull: true },
  validUntil:  { type: DataTypes.DATEONLY, allowNull: true },
  minOrderTotal:{ type: DataTypes.DECIMAL(10, 2), allowNull: true }
}, {
  tableName: 'discount_coupons',
  timestamps: true,
  hooks: {
    beforeValidate: (row) => {
      if (row.code) row.code = String(row.code).trim().toUpperCase();
    }
  }
});

module.exports = DiscountCoupon;
