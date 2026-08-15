const { Op } = require('sequelize');
const { SummerSeason, SummerProgram, SummerTeacher, SummerStudent } = require('../models');

// Helper — used by the other summer controllers to auto-attach new
// programs / teachers / students to whatever season is active.
const getActiveSeasonId = async () => {
  const active = await SummerSeason.findOne({ where: { isActive: true } });
  return active ? active.seasonId : null;
};
exports.getActiveSeasonId = getActiveSeasonId;

exports.list = async (req, res) => {
  try {
    const seasons = await SummerSeason.findAll({
      order: [['year', 'DESC'], ['createdAt', 'DESC']]
    });
    const withCounts = await Promise.all(seasons.map(async s => {
      const [programCount, teacherCount, studentCount] = await Promise.all([
        SummerProgram.count({ where: { seasonId: s.seasonId } }),
        SummerTeacher.count({ where: { seasonId: s.seasonId } }),
        SummerStudent.count({ where: { seasonId: s.seasonId } })
      ]);
      return { ...s.toJSON(), programCount, teacherCount, studentCount };
    }));
    res.json(withCounts);
  } catch (err) {
    console.error('Summer listSeasons error:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, year, activate } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Season name is required', messageAr: 'اسم الموسم مطلوب' });
    }
    const season = await SummerSeason.create({
      name: String(name).trim(),
      year: year ? Number(year) : null,
      isActive: !!activate
    });
    // Only one active season at a time
    if (activate) {
      await SummerSeason.update(
        { isActive: false },
        { where: { seasonId: { [Op.ne]: season.seasonId } } }
      );
    }
    res.status(201).json(season);
  } catch (err) {
    console.error('Summer createSeason error:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.activate = async (req, res) => {
  try {
    const { id } = req.params;
    const season = await SummerSeason.findByPk(id);
    if (!season) return res.status(404).json({ message: 'Season not found' });
    await SummerSeason.update({ isActive: false }, { where: {} });
    season.isActive = true;
    await season.save();
    res.json(season);
  } catch (err) {
    console.error('Summer activateSeason error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const season = await SummerSeason.findByPk(id);
    if (!season) return res.status(404).json({ message: 'Season not found' });
    const { name, year } = req.body || {};
    if (name !== undefined) season.name = String(name).trim();
    if (year !== undefined) season.year = year ? Number(year) : null;
    await season.save();
    res.json(season);
  } catch (err) {
    console.error('Summer updateSeason error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const season = await SummerSeason.findByPk(id);
    if (!season) return res.status(404).json({ message: 'Season not found' });

    const [programCount, teacherCount, studentCount] = await Promise.all([
      SummerProgram.count({ where: { seasonId: id } }),
      SummerTeacher.count({ where: { seasonId: id } }),
      SummerStudent.count({ where: { seasonId: id } })
    ]);
    if (programCount + teacherCount + studentCount > 0) {
      return res.status(400).json({
        message: 'Cannot delete a season with data. Move or delete its content first.',
        messageAr: 'لا يمكن حذف موسم يحتوي على برامج / معلمين / طلاب. انقلهم أو احذفهم أولاً.',
        programCount, teacherCount, studentCount
      });
    }
    if (season.isActive) {
      return res.status(400).json({
        message: 'Cannot delete the active season. Activate another season first.',
        messageAr: 'لا يمكن حذف الموسم النشط. فعّل موسماً آخر أولاً.'
      });
    }
    await season.destroy();
    res.json({ message: 'Season deleted' });
  } catch (err) {
    console.error('Summer deleteSeason error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
