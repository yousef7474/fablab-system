const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Registration = sequelize.define('Registration', {
  registrationId: {
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
  // Section 3: FABLAB Section
  fablabSection: {
    type: DataTypes.ENUM(
      'Electronics and Programming',
      'CNC Laser',
      'CNC Wood',
      '3D',
      'Robotic and AI',
      "Kid's Club",
      'Vinyl Cutting'
    ),
    allowNull: false
  },
  // Section 4: Required Services (stored as JSON array, max 2)
  requiredServices: {
    type: DataTypes.JSON,
    allowNull: false,
    validate: {
      isValidServices(value) {
        if (!Array.isArray(value) || value.length === 0 || value.length > 2) {
          throw new Error('Required services must be an array with 1-2 items');
        }
      }
    }
  },
  otherServiceDetails: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Section 5: Date and Time (conditional based on application type)
  appointmentDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  appointmentTime: {
    type: DataTypes.TIME,
    allowNull: true
  },
  appointmentDuration: {
    type: DataTypes.INTEGER, // in minutes
    allowNull: true
  },
  // For volunteers
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  startTime: {
    type: DataTypes.TIME,
    allowNull: true
  },
  endTime: {
    type: DataTypes.TIME,
    allowNull: true
  },
  // For visits
  visitDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  visitStartTime: {
    type: DataTypes.TIME,
    allowNull: true
  },
  visitEndTime: {
    type: DataTypes.TIME,
    allowNull: true
  },
  // Section 6: Details
  serviceDetails: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  // Section 7: Type of Service
  serviceType: {
    type: DataTypes.ENUM(
      'From official partners',
      'Free',
      'Partial Financial compensation',
      'Full Financial compensation'
    ),
    allowNull: false
  },
  // Section 8: Commitment
  commitmentName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // Status
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'on-hold'),
    defaultValue: 'pending'
  },
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Admin notes
  adminNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  approvedBy: {
    type: DataTypes.STRING,
    allowNull: true
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'registrations',
  timestamps: true,
  hooks: {
    beforeValidate: (registration) => {
      // Convert empty strings to null for ENUM fields
      if (registration.fablabSection === '') registration.fablabSection = null;
      if (registration.serviceType === '') registration.serviceType = null;
      if (registration.status === '') registration.status = null;
    },
    beforeCreate: (registration) => {
      // Ensure empty strings are converted to null for all nullable fields
      const nullableFields = [
        'otherServiceDetails', 'appointmentDate', 'appointmentTime', 'appointmentDuration',
        'startDate', 'endDate', 'startTime', 'endTime', 'visitDate', 'visitStartTime',
        'visitEndTime', 'rejectionReason', 'adminNotes', 'approvedBy', 'approvedAt'
      ];
      nullableFields.forEach(field => {
        if (registration[field] === '') registration[field] = null;
      });
    }
  }
});

module.exports = Registration;
