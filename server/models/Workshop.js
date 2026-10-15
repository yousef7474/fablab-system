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
  minAge: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Minimum age for registration'
  },
  maxAge: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Maximum age for registration'
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
    comment: 'True = shown to public in /workshop registration page; false = admin-only (admin can still add students + issue QR codes)'
  },
  // Education workshops are for education-tab students. They are
  // NEVER listed in the public /workshop picker; the admin shares a
  // unique URL (/workshop/:workshopId) with each customer to register.
  // Students still land in workshop_students so global attendance,
  // ratings, export, and certificates work identically.
  isEducation: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  // Which program a link-only (isEducation) workshop belongs to: null =
  // Education, 'future_scientists' = علماء المستقبل. Both share the same
  // mechanics (shareable URL, students + teachers, rooms, 24h cut-off);
  // the admin lists them in separate sections.
  track: {
    type: DataTypes.STRING(32),
    allowNull: true
  },
  // Physical room where the workshop is held (education workshops
  // rely on this — printed on invoices + confirmation email).
  room: {
    type: DataTypes.STRING(120),
    allowNull: true
  },
  // Admin can pause registrations on an education workshop without
  // deleting it — the shareable URL then shows a "registration
  // temporarily closed" message.
  registrationEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  // Admin exception: keep registration open past the automatic cut-off
  // (education: 24h before the start; others: the start day).
  registrationForceOpen: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
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
