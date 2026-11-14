const jwt = require('jsonwebtoken');
const { Op, fn, col, where } = require('sequelize');
const { Admin, Employee } = require('../models');

// One sign-in for every staff board. The same form takes an admin /
// manager username or email, or an employee email; the account the
// password opens decides the board. When it opens both an admin and an
// employee account (the same person holds both), the page lets them pick.
// Tokens and account shapes match /admin/login and /employee/login.

const sign = (payload) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

const adminAccount = (admin) => ({
  kind: 'admin',
  token: sign({ adminId: admin.adminId }),
  admin: {
    adminId: admin.adminId,
    username: admin.username,
    email: admin.email,
    fullName: admin.fullName,
    role: admin.role
  }
});

const employeeAccount = (employee) => ({
  kind: 'employee',
  token: sign({ employeeId: employee.employeeId }),
  employee: {
    employeeId: employee.employeeId,
    name: employee.name,
    email: employee.email,
    section: employee.section,
    isCustomSection: employee.isCustomSection,
    mustChangePassword: employee.mustChangePassword
  }
});

exports.login = async (req, res) => {
  try {
    const identifier = String(req.body.identifier || '').trim();
    const password = String(req.body.password || '');

    if (!identifier || !password) {
      return res.status(400).json({
        message: 'Email or username and password are required',
        messageAr: 'أدخل البريد الإلكتروني أو اسم المستخدم وكلمة المرور'
      });
    }

    const email = identifier.toLowerCase();
    const [admins, employee] = await Promise.all([
      Admin.findAll({
        where: { [Op.or]: [{ username: identifier }, where(fn('lower', col('email')), email)] },
        limit: 2
      }),
      email.includes('@') ? Employee.findOne({ where: { email } }) : null
    ]);

    const accounts = [];
    let inactive = false;
    let notSetUp = false;

    for (const admin of admins) {
      if (!(await admin.comparePassword(password))) continue;
      if (!admin.isActive) { inactive = true; continue; }
      accounts.push(adminAccount(admin));
      break;
    }

    if (employee) {
      if (!employee.password) {
        notSetUp = true;
      } else if (await employee.comparePassword(password)) {
        if (employee.isActive) accounts.push(employeeAccount(employee));
        else inactive = true;
      }
    }

    if (accounts.length) return res.json({ accounts });

    if (inactive) {
      return res.status(403).json({
        message: 'Account is inactive. Contact your manager.',
        messageAr: 'الحساب غير مفعّل. تواصل مع المدير.'
      });
    }
    if (notSetUp && !admins.length) {
      return res.status(403).json({
        message: 'Account not set up. Contact your manager to generate credentials.',
        messageAr: 'لم يُفعّل حسابك بعد. تواصل مع المدير لإنشاء بيانات الدخول.'
      });
    }
    return res.status(401).json({
      message: 'Invalid credentials',
      messageAr: 'بيانات الدخول غير صحيحة'
    });
  } catch (error) {
    console.error('Staff login error:', error);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};
