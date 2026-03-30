const jwt = require('jsonwebtoken');
const { Employee } = require('../models');

const employeeAuthMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Must have employeeId claim (not adminId)
    if (!decoded.employeeId) {
      return res.status(401).json({ message: 'Invalid token type' });
    }

    const employee = await Employee.findByPk(decoded.employeeId);

    if (!employee || !employee.isActive) {
      return res.status(401).json({ message: 'Employee not found or inactive' });
    }

    req.employee = employee;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = employeeAuthMiddleware;
