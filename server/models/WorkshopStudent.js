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
  // Which channel the customer used to pay. `free` covers workshops
  // with price = 0; otherwise bank_transfer needs a proof upload,
  // mada is paid in-person at the FabLab store and the admin
  // confirms it manually.
  paymentMethod: {
    type: DataTypes.STRING(24),
    allowNull: true
  },
  paymentAmount:  { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  // Uploaded transfer/receipt proof — { fileName, fileType, fileSize, fileData(base64) }.
  paymentProof:   { type: DataTypes.JSON, allowNull: true },
  paidAt:         { type: DataTypes.DATE, allowNull: true },
  paymentReviewedBy:   { type: DataTypes.STRING, allowNull: true },
  paymentReviewedAt:   { type: DataTypes.DATE, allowNull: true },
  paymentReviewNote:   { type: DataTypes.TEXT, allowNull: true },
  attended: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  attendanceDates: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array of date strings the student attended, e.g. ["2026-04-14","2026-04-15"]'
  },
  // Per-scan timestamps so the unified attendance board can show the
  // actual "when" for each day, not just the date. Shape:
  // [{ date: 'YYYY-MM-DD', scannedAt: ISO }]. Kept alongside
  // attendanceDates (which stays the source of truth for
  // day-attended) to avoid touching downstream cert/PDF logic.
  attendanceScans: {
    type: DataTypes.JSON,
    defaultValue: []
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
