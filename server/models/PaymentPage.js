const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A payment landing page the admin creates and shares as a unique link
// (/pay/:slug). Up to `maxPayers` people pay `amount` through it by bank
// transfer (with a receipt) or mada at FabLab; the admin verifies each
// payment and the customer gets an invoice. Managed from the admin
// "صفحات الدفع" tab.
const PaymentPage = sequelize.define('PaymentPage', {
  pageId: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  slug: { type: DataTypes.STRING(24), allowNull: false, unique: true },
  title: { type: DataTypes.STRING(200), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  // null = no limit. Pending + verified payments take a place; a
  // rejected one frees it.
  maxPayers: { type: DataTypes.INTEGER, allowNull: true },
  isOpen: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  closesAt: { type: DataTypes.DATE, allowNull: true },
  methods: { type: DataTypes.JSON, allowNull: false, defaultValue: ['bank_transfer', 'mada'] },
  terms: { type: DataTypes.TEXT, allowNull: true },
  coverImage: { type: DataTypes.TEXT, allowNull: true },   // base64 (no data: prefix)
  coverMime: { type: DataTypes.STRING(40), allowNull: true },
  createdBy: { type: DataTypes.STRING(150), allowNull: true }
}, {
  tableName: 'payment_pages',
  timestamps: true,
  defaultScope: { attributes: { exclude: ['coverImage'] } }
});

module.exports = PaymentPage;
