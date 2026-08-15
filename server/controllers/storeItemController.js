const { StoreItem } = require('../models');
const { Op } = require('sequelize');

// -------- PUBLIC --------

// GET /public/store/items — active items only, image URLs OK
exports.publicList = async (req, res) => {
  try {
    const items = await StoreItem.findAll({
      where: { isActive: true },
      order: [
        ['isFeatured', 'DESC'],
        ['createdAt', 'DESC']
      ]
    });
    res.json(items);
  } catch (err) {
    console.error('publicList store items:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /public/store/items/:id
exports.publicGet = async (req, res) => {
  try {
    const item = await StoreItem.findOne({
      where: { itemId: req.params.id, isActive: true }
    });
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json(item);
  } catch (err) {
    console.error('publicGet store item:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// -------- ADMIN --------

exports.list = async (req, res) => {
  try {
    const items = await StoreItem.findAll({ order: [['createdAt', 'DESC']] });
    res.json(items);
  } catch (err) {
    console.error('list store items:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.get = async (req, res) => {
  try {
    const item = await StoreItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json(item);
  } catch (err) {
    console.error('get store item:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const {
      name, nameEn, description, descriptionEn,
      price, stock, category, images, isActive, isFeatured, sku
    } = req.body || {};
    if (!name || price == null) {
      return res.status(400).json({ message: 'name and price are required' });
    }
    const item = await StoreItem.create({
      name: String(name).trim(),
      nameEn: nameEn ? String(nameEn).trim() : null,
      description: description ? String(description).trim() : null,
      descriptionEn: descriptionEn ? String(descriptionEn).trim() : null,
      price: Number(price) || 0,
      stock: Number(stock) || 0,
      category: category ? String(category).trim() : null,
      images: Array.isArray(images) ? images : [],
      isActive: isActive !== false,
      isFeatured: !!isFeatured,
      sku: sku ? String(sku).trim() : null
    });
    res.status(201).json(item);
  } catch (err) {
    console.error('create store item:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const item = await StoreItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    const p = { ...req.body };
    if (p.price != null) p.price = Number(p.price);
    if (p.stock != null) p.stock = Number(p.stock);
    if (p.images && !Array.isArray(p.images)) delete p.images;
    await item.update(p);
    res.json(item);
  } catch (err) {
    console.error('update store item:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.remove = async (req, res) => {
  try {
    const item = await StoreItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    await item.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('remove store item:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
