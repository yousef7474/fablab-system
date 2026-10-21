const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// One person paying through a payment page. `reference` (PAY-0001) is
// also the invoice number; `receiptToken` opens the customer's receipt /
// invoice without a login. The bank-transfer receipt lives in the row
// (base64) and is excluded from lists.
const PaymentSubmission = sequelize.define('PaymentSubmission', {
  submissionId: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  pageId: { type: DataTypes.UUID, allowNull: false },
  reference: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  receiptToken: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
  fullName: { type: DataTypes.STRING(150), allowNull: false },
  phone: { type: DataTypes.STRING(30), allowNull: false },
  email: { type: DataTypes.STRING(150), allowNull: false },
  note: { type: DataTypes.TEXT, allowNull: true },
  method: { type: DataTypes.STRING(20), allowNull: false },          // bank_transfer | mada
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },     // paid, after discount
  // The page's pricing when this person paid (printed on the invoice).
  baseAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  discountPercent: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
  discountAppliedBy: { type: DataTypes.STRING(150), allowNull: true },
  discountApprovedBy: { type: DataTypes.STRING(150), allowNull: true },
  // Discount code the customer used (on top of the page price).
  couponCode: { type: DataTypes.STRING(24), allowNull: true },
  couponPercent: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
  couponDiscount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  couponApprovedBy: { type: DataTypes.STRING(150), allowNull: true },
  proofFile: { type: DataTypes.TEXT, allowNull: true },
  proofType: { type: DataTypes.STRING(10), allowNull: true },
  proofName: { type: DataTypes.STRING(200), allowNull: true },
  status: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'pending' }, // pending | verified | rejected
  reviewNote: { type: DataTypes.TEXT, allowNull: true },
  reviewedBy: { type: DataTypes.STRING(150), allowNull: true },
  reviewedAt: { type: DataTypes.DATE, allowNull: true },
  paidAt: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'payment_submissions',
  timestamps: true,
  indexes: [{ fields: ['pageId'] }, { fields: ['status'] }],
  defaultScope: { attributes: { exclude: ['proofFile'] } }
});

module.exports = PaymentSubmission;
