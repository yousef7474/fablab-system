const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Volunteer = sequelize.define('Volunteer', {
  volunteerId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  nationalId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  nationalIdPhoto: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Base64 encoded image or file path'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  // Optional link to a Summer FabLab program. Volunteers added via the
  // Summer Volunteers sub-tab carry this; they otherwise behave like
  // any other volunteer and show up in the main Volunteers tab too.
  summerProgramId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  // Google Drive folder URL that the volunteer uploads their content
  // into. Rendered on the public share page as an "Open Folder" button
  // so an external reviewer can jump straight into their submissions.
  driveUrl: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Per-volunteer opaque token used in the public URL
  // (/public/volunteer/:token). Populated by the model default so any
  // volunteer created before the admin flips the toggle already has a
  // rotatable link ready to hand out.
  shareToken: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    allowNull: false,
    unique: true
  },
  shareEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  }
}, {
  tableName: 'volunteers',
  timestamps: true,
  hooks: {
    beforeValidate: (volunteer) => {
      if (volunteer.email === '') volunteer.email = null;
    }
  }
});

module.exports = Volunteer;
