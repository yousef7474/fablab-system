const jwt = require('jsonwebtoken');
const { StoreCustomer } = require('../models');

// Lightweight JWT check for public store customer endpoints. Token
// payload = { customerId, email, type: 'store-customer' }.
module.exports = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token) return res.status(401).json({ message: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded?.type !== 'store-customer') {
      return res.status(401).json({ message: 'Wrong token type' });
    }
    const customer = await StoreCustomer.findByPk(decoded.customerId);
    if (!customer || !customer.isActive) {
      return res.status(401).json({ message: 'Account not found or disabled' });
    }
    req.storeCustomer = customer;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};
