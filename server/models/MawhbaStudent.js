const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MawhbaStudent = sequelize.define('MawhbaStudent', {
  studentId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  nameAr: {
    type: DataTypes.STRING,
    allowNull: false
  },
  nameEn: {
    type: DataTypes.STRING,
    allowNull: true
  },
  nationalId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  nationality: {
    type: DataTypes.STRING,
    allowNull: true
  },
  schoolGrade: {
    type: DataTypes.STRING,
    allowNull: true
  },
  administrativeRegion: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'المنطقة الادارية'
  },
  educationalAdministration: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'الإدارة التعليمية'
  },
  schoolName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  sex: {
    type: DataTypes.ENUM('male', 'female'),
    allowNull: true
  },
  residenceCity: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'مدينة سكن الطالب'
  },
  executingEntity: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'الجهة المنفذة'
  },
  courseName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'اسم الدورة'
  },
  courseNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'رقم البرنامج/الدورة'
  },
  courseAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'مبلغ البرنامج/الدورة'
  },
  registrationDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'تاريخ التسجيل في البرنامج/الدورة'
  },
  studentPhone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  guardianPhone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  seasonId: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  tableName: 'mawhba_students',
  timestamps: true,
  hooks: {
    beforeValidate: (s) => {
      if (s.email === '') s.email = null;
    }
  }
});

module.exports = MawhbaStudent;
