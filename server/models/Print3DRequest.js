const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// 3D printing service request. The customer uploads a file, picks a
// material + color mode, and agrees to T&Cs. Admin reviews the file,
// enters an estimated weight, and the server computes a quote. The
// customer then accepts or rejects the quote via an emailed token URL.
const Print3DRequest = sequelize.define('Print3DRequest', {
  requestId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // Human-friendly sequential number, formatted "P3D-####" in UI.
  requestNumber: { type: DataTypes.INTEGER, allowNull: true, unique: true },

  // Customer
  customerName:    { type: DataTypes.STRING, allowNull: false },
  customerPhone:   { type: DataTypes.STRING, allowNull: false },
  customerEmail:   { type: DataTypes.STRING, allowNull: false, validate: { isEmail: true } },
  customerNationalId: { type: DataTypes.STRING, allowNull: true },
  deliveryAddress: { type: DataTypes.TEXT, allowNull: true },

  // File
  fileName: { type: DataTypes.STRING(255), allowNull: false },
  fileType: { type: DataTypes.STRING(32), allowNull: false },  // extension: stl, obj, 3mf, step, stp, ply, gcode
  fileSize: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, // bytes
  fileData: { type: DataTypes.TEXT('long'), allowNull: false }, // base64 payload

  // Printing options
  material:  { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'PLA' }, // PLA | PETG | TPU
  colorMode: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'single' }, // single | multi
  singleColor:    { type: DataTypes.STRING(32), allowNull: true }, // hex or name
  multiColorParts: { type: DataTypes.JSON, allowNull: false, defaultValue: [] }, // [{ part, color }]

  notes: { type: DataTypes.TEXT, allowNull: true },
  adminNotes: { type: DataTypes.TEXT, allowNull: true },

  // Terms & conditions acceptance (server-stamped when submitted)
  termsAcceptedAt: { type: DataTypes.DATE, allowNull: true },

  // Quote (filled by admin, computed by server on save)
  estimatedWeight: { type: DataTypes.DECIMAL(10, 2), allowNull: true }, // grams
  materialRate:    { type: DataTypes.DECIMAL(10, 2), allowNull: true }, // SAR/g snapshot at quote time
  setupFee:        { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  multiColorFee:   { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  subtotal:        { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  taxRate:         { type: DataTypes.DECIMAL(5, 4),  allowNull: false, defaultValue: 0.15 },
  taxAmount:       { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  estimatedCost:   { type: DataTypes.DECIMAL(10, 2), allowNull: true }, // grand total

  // Public quote decision link — customer opens /print-quote/:token to accept/reject
  quoteToken:  { type: DataTypes.STRING(64), allowNull: true, unique: true },
  quotedAt:    { type: DataTypes.DATE, allowNull: true },
  acceptedAt:  { type: DataTypes.DATE, allowNull: true },
  rejectedAt:  { type: DataTypes.DATE, allowNull: true },
  customerDecisionMessage: { type: DataTypes.TEXT, allowNull: true },

  // Lifecycle status
  //  submitted → admin sees the request but has not quoted
  //  quoted    → quote sent to customer, awaiting decision
  //  accepted  → customer accepted, printing scheduled
  //  rejected  → customer rejected the quote
  //  printing  → in production
  //  ready     → ready for pickup / delivery
  //  completed → picked up + paid
  //  cancelled → admin-cancelled
  status:      { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'submitted' },
  paidAt:      { type: DataTypes.DATE, allowNull: true },
  completedAt: { type: DataTypes.DATE, allowNull: true },
  cancelledAt: { type: DataTypes.DATE, allowNull: true },

  // Email tracking
  customerEmailSentAt: { type: DataTypes.DATE, allowNull: true },
  adminEmailSentAt:    { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'print3d_requests',
  timestamps: true,
  indexes: [
    { fields: ['status'] },
    { fields: ['requestNumber'] },
    { fields: ['quoteToken'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = Print3DRequest;
