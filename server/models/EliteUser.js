const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const EliteUser = sequelize.define('EliteUser', {
  eliteId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  uniqueId: {
    type: DataTypes.STRING(20),
    unique: true,
    allowNull: false
  },
  firstName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  lastName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  phoneNumber: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  nationalId: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  nationality: {
    type: DataTypes.STRING(100),
    defaultValue: 'Saudi'
  },
  sex: {
    type: DataTypes.ENUM('male', 'female'),
    allowNull: false
  },
  dateOfBirth: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  organization: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  specialization: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  profilePicture: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'suspended'),
    defaultValue: 'active'
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'elite_users',
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

// Instance method to check password
EliteUser.prototype.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate unique ID for elite users (ELITE-0001 format, sequential)
EliteUser.generateUniqueId = async () => {
  const prefix = 'ELITE';

  // Find the highest existing ID number
  const lastUser = await EliteUser.findOne({
    where: {
      uniqueId: {
        [require('sequelize').Op.like]: `${prefix}-%`
      }
    },
    order: [['uniqueId', 'DESC']]
  });

  let nextNumber = 1;

  if (lastUser && lastUser.uniqueId) {
    // Extract number from last ID (e.g., "ELITE-0042" -> 42)
    const match = lastUser.uniqueId.match(/ELITE-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  // Format with leading zeros (4 digits: 0001, 0002, etc.)
  const paddedNumber = String(nextNumber).padStart(4, '0');
  return `${prefix}-${paddedNumber}`;
};

module.exports = EliteUser;
