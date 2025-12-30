const { Rating, Employee, Admin } = require('../models');
const { Op } = require('sequelize');

// Get all ratings with optional filters
exports.getAllRatings = async (req, res) => {
  try {
    const { employeeId, startDate, endDate } = req.query;

    const where = {};

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (startDate && endDate) {
      where.ratingDate = {
        [Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      where.ratingDate = {
        [Op.gte]: startDate
      };
    } else if (endDate) {
      where.ratingDate = {
        [Op.lte]: endDate
      };
    }

    const ratings = await Rating.findAll({
      where,
      include: [
        { model: Employee, as: 'employee', attributes: ['employeeId', 'name', 'email', 'section'] },
        { model: Admin, as: 'ratedBy', attributes: ['adminId', 'name', 'email'] }
      ],
      order: [['ratingDate', 'DESC'], ['createdAt', 'DESC']]
    });

    res.json(ratings);
  } catch (error) {
    console.error('Error fetching ratings:', error);
    res.status(500).json({ message: 'Error fetching ratings', error: error.message });
  }
};

// Get ratings for a specific employee
exports.getEmployeeRatings = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate } = req.query;

    const where = { employeeId };

    if (startDate && endDate) {
      where.ratingDate = {
        [Op.between]: [startDate, endDate]
      };
    }

    const ratings = await Rating.findAll({
      where,
      include: [
        { model: Admin, as: 'ratedBy', attributes: ['adminId', 'name', 'email'] }
      ],
      order: [['ratingDate', 'DESC']]
    });

    // Calculate summary
    const totalPoints = ratings.reduce((sum, r) => sum + r.points, 0);
    const averagePoints = ratings.length > 0 ? Math.round(totalPoints / ratings.length) : 0;

    res.json({
      ratings,
      summary: {
        totalRatings: ratings.length,
        totalPoints,
        averagePoints
      }
    });
  } catch (error) {
    console.error('Error fetching employee ratings:', error);
    res.status(500).json({ message: 'Error fetching employee ratings', error: error.message });
  }
};

// Export ratings as CSV
exports.exportRatings = async (req, res) => {
  try {
    const { employeeId, startDate, endDate } = req.query;

    const where = {};

    if (employeeId && employeeId !== 'all') {
      where.employeeId = employeeId;
    }

    if (startDate && endDate) {
      where.ratingDate = {
        [Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      where.ratingDate = {
        [Op.gte]: startDate
      };
    } else if (endDate) {
      where.ratingDate = {
        [Op.lte]: endDate
      };
    }

    const ratings = await Rating.findAll({
      where,
      include: [
        { model: Employee, as: 'employee', attributes: ['employeeId', 'name', 'email', 'section'] },
        { model: Admin, as: 'ratedBy', attributes: ['adminId', 'name', 'email'] }
      ],
      order: [['ratingDate', 'DESC'], ['createdAt', 'DESC']]
    });

    // Create CSV content
    const headers = ['Rating Date', 'Employee Name', 'Employee Email', 'Section', 'Points', 'Criteria', 'Notes', 'Rated By'];
    const rows = ratings.map(r => [
      r.ratingDate,
      r.employee?.name || 'N/A',
      r.employee?.email || 'N/A',
      r.employee?.section || 'N/A',
      r.points,
      r.criteria || '',
      r.notes ? r.notes.replace(/"/g, '""') : '',
      r.ratedBy?.name || 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Add BOM for Excel UTF-8 compatibility
    const bom = '\uFEFF';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="employee_ratings_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(bom + csvContent);
  } catch (error) {
    console.error('Error exporting ratings:', error);
    res.status(500).json({ message: 'Error exporting ratings', error: error.message });
  }
};

// Create new rating
exports.createRating = async (req, res) => {
  try {
    const { employeeId, points, criteria, notes, ratingDate } = req.body;

    // Debug logging
    console.log('Creating rating - Request body:', req.body);
    console.log('Creating rating - Admin:', req.admin?.adminId);

    if (!req.admin || !req.admin.adminId) {
      return res.status(401).json({ message: 'Admin authentication required' });
    }

    const createdById = req.admin.adminId;

    if (!employeeId || points === undefined) {
      return res.status(400).json({ message: 'Employee ID and points are required' });
    }

    // Verify employee exists
    const employee = await Employee.findByPk(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    console.log('Creating rating for employee:', employee.name, 'Points:', points);

    const rating = await Rating.create({
      employeeId,
      createdById,
      points: parseInt(points, 10),
      criteria: criteria || null,
      notes: notes || null,
      ratingDate: ratingDate || new Date().toISOString().split('T')[0]
    });

    // Fetch with associations
    const createdRating = await Rating.findByPk(rating.ratingId, {
      include: [
        { model: Employee, as: 'employee', attributes: ['employeeId', 'name', 'email', 'section'] },
        { model: Admin, as: 'ratedBy', attributes: ['adminId', 'name', 'email'] }
      ]
    });

    res.status(201).json(createdRating);
  } catch (error) {
    console.error('Error creating rating:', error);
    console.error('Error details:', error.name, error.parent?.message || error.message);
    res.status(500).json({
      message: 'Error creating rating',
      error: error.message,
      details: error.name === 'SequelizeDatabaseError' ? 'Database table may not exist. Please restart the server.' : undefined
    });
  }
};

// Update rating
exports.updateRating = async (req, res) => {
  try {
    const { id } = req.params;
    const { points, criteria, notes, ratingDate } = req.body;

    const rating = await Rating.findByPk(id);
    if (!rating) {
      return res.status(404).json({ message: 'Rating not found' });
    }

    await rating.update({
      points: points !== undefined ? points : rating.points,
      criteria: criteria !== undefined ? criteria : rating.criteria,
      notes: notes !== undefined ? notes : rating.notes,
      ratingDate: ratingDate || rating.ratingDate
    });

    // Fetch with associations
    const updatedRating = await Rating.findByPk(id, {
      include: [
        { model: Employee, as: 'employee', attributes: ['employeeId', 'name', 'email', 'section'] },
        { model: Admin, as: 'ratedBy', attributes: ['adminId', 'name', 'email'] }
      ]
    });

    res.json(updatedRating);
  } catch (error) {
    console.error('Error updating rating:', error);
    res.status(500).json({ message: 'Error updating rating', error: error.message });
  }
};

// Delete rating
exports.deleteRating = async (req, res) => {
  try {
    const { id } = req.params;

    const rating = await Rating.findByPk(id);
    if (!rating) {
      return res.status(404).json({ message: 'Rating not found' });
    }

    await rating.destroy();

    res.json({ message: 'Rating deleted successfully' });
  } catch (error) {
    console.error('Error deleting rating:', error);
    res.status(500).json({ message: 'Error deleting rating', error: error.message });
  }
};

module.exports = exports;
