const jwt = require('jsonwebtoken');
const { StoreCustomer, StoreOrder } = require('../models');
const { Op } = require('sequelize');

const _signToken = (customer) => jwt.sign(
  { customerId: customer.customerId, email: customer.email, type: 'store-customer' },
  process.env.JWT_SECRET,
  { expiresIn: '30d' }
);

const _publicCustomer = (c) => ({
  customerId: c.customerId,
  name: c.name,
  email: c.email,
  phone: c.phone,
  nationalId: c.nationalId,
  address: c.address,
  createdAt: c.createdAt
});

// POST /public/store/customer/register
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, nationalId } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email, password required', messageAr: 'الاسم والبريد وكلمة المرور مطلوبة' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password too short', messageAr: 'كلمة المرور قصيرة جداً — 6 أحرف على الأقل' });
    }
    const existing = await StoreCustomer.findOne({ where: { email: String(email).trim().toLowerCase() } });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered', messageAr: 'البريد مسجّل مسبقاً — سجّل دخولك' });
    }
    const customer = await StoreCustomer.create({
      name: String(name).trim(),
      email,
      password,
      phone: phone ? String(phone).trim() : null,
      nationalId: nationalId ? String(nationalId).trim() : null
    });
    const token = _signToken(customer);
    res.status(201).json({ token, customer: _publicCustomer(customer) });
  } catch (err) {
    console.error('customer register:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

// POST /public/store/customer/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password required', messageAr: 'البريد وكلمة المرور مطلوبان' });
    }
    const customer = await StoreCustomer.findOne({ where: { email: String(email).trim().toLowerCase() } });
    if (!customer || !customer.isActive) {
      return res.status(401).json({ message: 'Invalid credentials', messageAr: 'بيانات الدخول غير صحيحة' });
    }
    const ok = await customer.comparePassword(String(password));
    if (!ok) {
      return res.status(401).json({ message: 'Invalid credentials', messageAr: 'بيانات الدخول غير صحيحة' });
    }
    await customer.update({ lastLoginAt: new Date() });
    const token = _signToken(customer);
    res.json({ token, customer: _publicCustomer(customer) });
  } catch (err) {
    console.error('customer login:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /public/store/customer/me — auth required
exports.me = async (req, res) => {
  try {
    res.json({ customer: _publicCustomer(req.storeCustomer) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /public/store/customer/me — update own profile
exports.updateMe = async (req, res) => {
  try {
    const c = req.storeCustomer;
    const { name, phone, nationalId, address, password } = req.body || {};
    const patch = {};
    if (name != null)       patch.name       = String(name).trim();
    if (phone != null)      patch.phone      = phone ? String(phone).trim() : null;
    if (nationalId != null) patch.nationalId = nationalId ? String(nationalId).trim() : null;
    if (address != null)    patch.address    = address ? String(address).trim() : null;
    if (password && String(password).length >= 6) patch.password = password;
    await c.update(patch);
    res.json({ customer: _publicCustomer(c) });
  } catch (err) {
    console.error('customer updateMe:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /public/store/customer/orders — auth required, returns all
// orders whose customerEmail matches the logged-in account (so
// guest orders placed with the same email get claimed too).
exports.myOrders = async (req, res) => {
  try {
    const email = req.storeCustomer.email;
    const orders = await StoreOrder.findAll({
      where: { customerEmail: email },
      order: [['createdAt', 'DESC']],
      attributes: { exclude: ['adminNotes'] }
    });
    res.json(orders);
  } catch (err) {
    console.error('customer myOrders:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
