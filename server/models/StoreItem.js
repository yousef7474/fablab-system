const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A single item on sale in the FabLab store. Prices are in SAR.
// `images` is a JSON array of data-URI strings so we can store a few
// small product photos without needing a separate uploads pipeline.
const StoreItem = sequelize.define('StoreItem', {
  itemId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name:         { type: DataTypes.STRING, allowNull: false },
  nameEn:       { type: DataTypes.STRING, allowNull: true },
  description:  { type: DataTypes.TEXT, allowNull: true },
  descriptionEn:{ type: DataTypes.TEXT, allowNull: true },
  // Price in SAR — stored as decimal to avoid float weirdness.
  price:        { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  // Stock on hand. When 0, item still shows as "out of stock" but not
  // added to cart. Admin can set -1 to signal "unlimited stock".
  stock:        { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  // Free-form category so admin can group items ("مطبوعات", "ورش عمل"…).
  category:     { type: DataTypes.STRING, allowNull: true },
  // JSON array of image data URIs (or URLs). First entry is primary.
  images:       { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  // When false the item is hidden from the public store but still
  // available in admin history.
  isActive:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  // Featured items surface at the top of the public grid.
  isFeatured:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  // Optional SKU for the admin's internal tracking.
  sku:          { type: DataTypes.STRING, allowNull: true }
}, {
  tableName: 'store_items',
  timestamps: true,
  indexes: [
    { fields: ['isActive'] },
    { fields: ['category'] }
  ]
});

module.exports = StoreItem;
