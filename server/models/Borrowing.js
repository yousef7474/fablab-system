const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Borrowing = sequelize.define('Borrowing', {
  borrowingId: {
    type: DataTypes.STRING,
    primaryKey: true,
    unique: true
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'users',
      key: 'userId'
    }
  },
  section: {
    type: DataTypes.STRING,
    allowNull: false
  },
  purpose: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  componentDescription: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  componentPhotoBefore: {
    type: DataTypes.TEXT('long'),
    allowNull: false
  },
  componentPhotoAfter: {
    type: DataTypes.TEXT('long'),
    allowNull: true
  },
  borrowDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  expectedReturnDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  actualReturnDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'borrowed', 'returned', 'overdue', 'rejected'),
    defaultValue: 'pending'
  },
  signature: {
    type: DataTypes.STRING,
    allowNull: false
  },
  termsAccepted: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  adminNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  approvedById: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'admins',
      key: 'adminId'
    }
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  returnedById: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'admins',
      key: 'adminId'
    }
  },
  warningCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  lastWarningAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'borrowings',
  timestamps: true,
  hooks: {
    beforeCreate: (borrowing) => {
      const nullableFields = [
        'componentPhotoAfter', 'actualReturnDate', 'adminNotes',
        'approvedById', 'approvedAt', 'returnedById', 'lastWarningAt'
      ];
      nullableFields.forEach(field => {
        if (borrowing[field] === '') borrowing[field] = null;
      });
    }
  }
});

module.exports = Borrowing;
