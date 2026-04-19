const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Workshop = sequelize.define('Workshop', {
  workshopId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  presenter: {
    type: DataTypes.STRING,
    allowNull: false
  },
  assignedEmployeeId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'employees',
      key: 'employeeId'
    }
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
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
  totalHours: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  objectives: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  photo: {
    type: DataTypes.TEXT('long'),
    allowNull: true
  },
  maxParticipants: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  price: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('upcoming', 'in_progress', 'completed', 'cancelled'),
    defaultValue: 'upcoming'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  color: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: '#1a56db',
    comment: 'Workshop theme color for attendance ID cards'
  },
  createdById: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'admins',
      key: 'adminId'
    }
  }
}, {
  tableName: 'workshops',
  timestamps: true,
  hooks: {
    beforeValidate: (workshop) => {
      const nullableFields = [
        'description', 'assignedEmployeeId', 'endDate', 'startTime', 'endTime',
        'totalHours', 'content', 'objectives', 'photo', 'maxParticipants',
        'price', 'notes', 'createdById'
      ];
      nullableFields.forEach(field => {
        if (workshop[field] === '') workshop[field] = null;
      });
    }
  }
});

module.exports = Workshop;
