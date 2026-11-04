const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { computeFinance } = require('../utils/financialRequestDoc');

// Financial request (طلب صرف مالي — «الملف المالي التفصيلي» of a plan
// target): the costed breakdown of a programme (materials per project,
// staff, hospitality), its pricing and how it is funded. The employee
// fills it and sends it for approval: employee → project manager (مسؤول
// إدارة المشاريع) → manager, who prints and signs it.
// `data` is the working draft in the shape of the form
// (client/src/components/Requests/finance/frModel.js); every submission
// freezes a copy in FinancialRequestVersion, which is what reviewers see.
const FinancialRequest = sequelize.define('FinancialRequest', {
  requestId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  requestNumber: {
    type: DataTypes.INTEGER,
    allowNull: true,
    unique: true
  },
  employeeId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: true
  },
  data: {
    type: DataTypes.JSON,
    allowNull: true,
    // Keep totalAmount in step with the draft, so lists can show the
    // requested amount without loading every request's data.
    set(value) {
      this.setDataValue('data', value);
      this.setDataValue('totalAmount', value ? Math.round(computeFinance(value).amount * 100) / 100 : null);
    }
  },
  // المبلغ المطلوب صرفه (from the data — see computeFinance).
  totalAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true
  },
  // Completion % of the draft (the template's checks), saved by the editor.
  completion: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // draft → pm_review → manager_review → approved; a reviewer can send
  // it back (returned, with returnedBy = 'pm' | 'manager').
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'draft'
  },
  returnedBy: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  currentVersion: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  submittedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  approvedVersion: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'financial_requests',
  timestamps: true,
  // The manager's delete is a soft delete (deletedAt) — gone from every
  // screen, still recoverable in the database.
  paranoid: true
});

module.exports = FinancialRequest;
