const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A discount code for one payment page, made in the admin "صفحات الدفع"
// tab and shared with a customer: a % off the page price, who approved
// it, how many times it can be used and until when. Pending + verified
// payments count as uses; a rejected one gives the use back.
const PaymentCoupon = sequelize.define('PaymentCoupon', {
  couponId: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  pageId: { type: DataTypes.UUID, allowNull: false },
  code: { type: DataTypes.STRING(24), allowNull: false },          // stored upper-case
  discountPercent: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
  approvedBy: { type: DataTypes.STRING(150), allowNull: false },
  createdBy: { type: DataTypes.STRING(150), allowNull: true },
  maxUses: { type: DataTypes.INTEGER, allowNull: true },           // null = no limit
  expiresAt: { type: DataTypes.DATE, allowNull: true },
  note: { type: DataTypes.STRING(300), allowNull: true },          // e.g. who it is for
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, {
  tableName: 'payment_coupons',
  timestamps: true,
  indexes: [{ unique: true, fields: ['pageId', 'code'] }]
});

module.exports = PaymentCoupon;
