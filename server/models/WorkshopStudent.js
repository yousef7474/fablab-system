const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WorkshopStudent = sequelize.define('WorkshopStudent', {
  studentId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  workshopId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'workshops',
      key: 'workshopId'
    }
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true
  },
  nationalId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  gender: {
    type: DataTypes.STRING,
    allowNull: true
  },
  age: {
    type: DataTypes.STRING,
    allowNull: true
  },
  city: {
    type: DataTypes.STRING,
    allowNull: true
  },
  invoiceNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  paymentStatus: {
    type: DataTypes.ENUM('pending', 'verified', 'rejected'),
    defaultValue: 'pending'
  },
  attended: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  performanceRating: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 5
    }
  },
  performanceNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  certificatePrinted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'workshop_students',
  timestamps: true,
  hooks: {
    beforeValidate: (student) => {
      const nullableFields = [
        'lastName', 'email', 'nationalId', 'gender', 'age', 'city',
        'performanceRating', 'performanceNotes', 'notes'
      ];
      nullableFields.forEach(field => {
        if (student[field] === '') student[field] = null;
      });
    }
  }
});

module.exports = WorkshopStudent;
