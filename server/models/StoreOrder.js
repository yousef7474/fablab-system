const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A customer's order placed via the public /store page. Payment is
// cash or mada at pickup, or an upfront bank transfer (see the
// payment fields below); admin marks `paidAt` when payment is
// confirmed. Item details are snapshotted in `items` JSON so that
// later edits to a StoreItem don't change historical orders.
const StoreOrder = sequelize.define('StoreOrder', {
  orderId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // Human-friendly sequential number, formatted "INV-2026-001" in UI.
  // Assigned atomically at create-time from MAX(orderNumber)+1.
  orderNumber: { type: DataTypes.INTEGER, allowNull: true, unique: true },

  // Customer
  customerName:    { type: DataTypes.STRING, allowNull: false },
  customerPhone:   { type: DataTypes.STRING, allowNull: false },
  customerEmail:   { type: DataTypes.STRING, allowNull: false, validate: { isEmail: true } },
  customerNationalId: { type: DataTypes.STRING, allowNull: true },
  deliveryAddress: { type: DataTypes.TEXT, allowNull: true },
  notes:           { type: DataTypes.TEXT, allowNull: true },

  // Snapshot of items at the moment the order was placed:
  //   [{ itemId, name, price, quantity, lineTotal, image }]
  items:       { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  subtotal:    { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  // Coupon fields — populated when a valid code is applied at checkout.
  couponCode:      { type: DataTypes.STRING(48), allowNull: true },
  couponPercent:   { type: DataTypes.INTEGER, allowNull: true },
  discountAmount:  { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  taxRate:     { type: DataTypes.DECIMAL(5, 4),  allowNull: false, defaultValue: 0 }, // VAT retired (was 0.15 KSA VAT)
  taxAmount:   { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  total:       { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },

  // 'pending'   → order just placed, awaiting admin review
  // 'confirmed' → admin acknowledged, prepping items
  // 'ready'     → ready for customer pickup
  // 'completed' → picked up + paid
  // 'cancelled' → cancelled by admin (with a note)
  status:      { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'pending' },
  paidAt:      { type: DataTypes.DATE, allowNull: true },

  // Payment — same options as workshop registration:
  //   'cash'          → paid in cash at pickup (original behaviour)
  //   'mada'          → paid by card (mada) at the FabLab store on pickup
  //   'bank_transfer' → paid upfront; customer uploads a transfer proof
  //   'free'          → a coupon covered the whole total
  // paymentStatus: 'pending' | 'verified' | 'rejected' (admin review).
  paymentMethod: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'cash' },
  paymentStatus: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'pending' },
  // Transfer proof — { fileName, fileType, fileSize, fileData(base64) }.
  paymentProof:  { type: DataTypes.JSON, allowNull: true },
  paymentReviewedBy: { type: DataTypes.STRING, allowNull: true },
  paymentReviewedAt: { type: DataTypes.DATE, allowNull: true },
  cancelledAt: { type: DataTypes.DATE, allowNull: true },
  completedAt: { type: DataTypes.DATE, allowNull: true },
  adminNotes:  { type: DataTypes.TEXT, allowNull: true },

  // Email tracking
  customerEmailSentAt: { type: DataTypes.DATE, allowNull: true },
  adminEmailSentAt:    { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'store_orders',
  timestamps: true,
  // The transfer proof can be several MB — never loaded unless asked
  // for explicitly (StoreOrder.unscoped(), the admin proof viewer).
  defaultScope: {
    attributes: { exclude: ['paymentProof'] }
  },
  indexes: [
    { fields: ['status'] },
    { fields: ['orderNumber'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = StoreOrder;
