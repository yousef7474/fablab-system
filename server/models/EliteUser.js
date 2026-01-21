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

// Generate unique ID for elite users (ELITE-XXXX format)
EliteUser.generateUniqueId = async () => {
  const prefix = 'ELITE';
  let unique = false;
  let uniqueId;

  while (!unique) {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    uniqueId = `${prefix}-${randomNum}`;

    const existing = await EliteUser.findOne({ where: { uniqueId } });
    if (!existing) {
      unique = true;
    }
  }

  return uniqueId;
};

module.exports = EliteUser;
