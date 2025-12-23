const jwt = require('jsonwebtoken');
const { Admin } = require('../models');

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get admin from database
    const admin = await Admin.findByPk(decoded.adminId);

    if (!admin || !admin.isActive) {
      return res.status(401).json({ message: 'Admin not found or inactive' });
    }

    req.admin = admin;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = authMiddleware;
