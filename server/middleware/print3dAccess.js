const jwt = require('jsonwebtoken');
const { Employee } = require('../models');
const authMiddleware = require('./auth');
const { requireManager } = require('./roleMiddleware');
const { isPrint3dStaff } = require('../utils/print3dStaff');

// 3D printing routes: an admin token (as before), or the token of an
// employee on the 3D printing staff list (utils/print3dStaff.js), who then
// manages the service from the employee board.
const print3dAuth = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '') || req.query.token;
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Token is not valid' });
  }
  if (decoded.adminId) return authMiddleware(req, res, next);
  if (!decoded.employeeId) return res.status(401).json({ message: 'Invalid token type' });
  const employee = await Employee.findByPk(decoded.employeeId);
  if (!employee || !employee.isActive) return res.status(401).json({ message: 'Employee not found or inactive' });
  // 403 (not 401): a 401 would sign the employee out of their board.
  if (!(await isPrint3dStaff(employee))) {
    return res.status(403).json({ message: 'No access to the 3D printing service', messageAr: 'ليست لديك صلاحية خدمة الطباعة ثلاثية الأبعاد' });
  }
  req.employee = employee;
  req.print3dStaff = true;
  return next();
};

// Manager-only admin actions are open to the 3D printing staff too.
const managerOrPrint3dStaff = (req, res, next) => (req.print3dStaff ? next() : requireManager(req, res, next));

// Admin-only (e.g. choosing who the staff are) — never the staff themselves.
const adminManagerOnly = (req, res, next) => (req.print3dStaff
  ? res.status(403).json({ message: 'Admins only', messageAr: 'للإدارة فقط' })
  : requireManager(req, res, next));

module.exports = { print3dAuth, managerOrPrint3dStaff, adminManagerOnly };
