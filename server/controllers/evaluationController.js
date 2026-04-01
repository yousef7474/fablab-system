const { EmployeeEvaluation, Employee, Admin } = require('../models');

// All 9 categories are scored, total = 100
const EVALUATION_STRUCTURE = {
  cat1: { maxTotal: 12, criteria: { c1: 3, c2: 3, c3: 3, c4: 3 } },
  cat2: { maxTotal: 18, criteria: { c1: 5, c2: 5, c3: 4, c4: 4 } },
  cat3: { maxTotal: 10, criteria: { c1: 3, c2: 3, c3: 2, c4: 2 } },
  cat4: { maxTotal: 12, criteria: { c1: 6, c2: 6 } },
  cat5: { maxTotal: 4, criteria: { c1: 4 } },
  cat6: { maxTotal: 12, criteria: { c1: 3, c2: 3, c3: 3, c4: 3 } },
  cat7: { maxTotal: 8, criteria: { c1: 2, c2: 2, c3: 2, c4: 2 } },
  cat8: { maxTotal: 12, criteria: { c1: 3, c2: 3, c3: 3, c4: 3 } },
  cat9: { maxTotal: 12, criteria: { c1: 3, c2: 3, c3: 3, c4: 3 } },
};

const TOTAL_MAX = 100;

exports.createEvaluation = async (req, res) => {
  try {
    const { employeeId, scores, qualitative, period, notes, evaluationDate } = req.body;

    if (!employeeId || !scores) {
      return res.status(400).json({ message: 'Employee and scores are required' });
    }

    const employee = await Employee.findByPk(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Calculate total score from scored categories (1-7)
    let totalScore = 0;
    for (const [catKey, catDef] of Object.entries(EVALUATION_STRUCTURE)) {
      for (const [critKey, maxPts] of Object.entries(catDef.criteria)) {
        const key = `${catKey}_${critKey}`;
        const val = parseFloat(scores[key]) || 0;
        totalScore += Math.max(0, val); // allow any positive value
      }
    }

    // Grade: scale to 5 (based on base 100)
    const baseScore = Math.min(totalScore, TOTAL_MAX);
    const grade = parseFloat(((baseScore / TOTAL_MAX) * 5).toFixed(2));

    // Bonus: every 100 excess points = 1 bonus point
    const excess = Math.max(0, totalScore - TOTAL_MAX);
    const bonusPoints = parseFloat((excess / TOTAL_MAX).toFixed(2));

    const evaluation = await EmployeeEvaluation.create({
      employeeId,
      createdById: req.admin.adminId,
      scores,
      qualitative: qualitative || {},
      totalScore: parseFloat(totalScore.toFixed(2)),
      grade,
      bonusPoints,
      period: period || null,
      notes: notes || null,
      evaluationDate: evaluationDate || new Date()
    });

    const result = await EmployeeEvaluation.findByPk(evaluation.evaluationId, {
      include: [
        { model: Employee, as: 'employee', attributes: ['employeeId', 'name', 'email', 'section'] },
        { model: Admin, as: 'evaluator', attributes: ['adminId', 'fullName', 'role'] }
      ]
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Create evaluation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getEmployeeEvaluations = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const evaluations = await EmployeeEvaluation.findAll({
      where: { employeeId },
      include: [
        { model: Employee, as: 'employee', attributes: ['employeeId', 'name', 'email', 'section'] },
        { model: Admin, as: 'evaluator', attributes: ['adminId', 'fullName', 'role'] }
      ],
      order: [['evaluationDate', 'DESC']]
    });

    // Calculate averages across all evaluations
    let avgGrade = 0;
    let avgScore = 0;
    let totalBonus = 0;
    if (evaluations.length > 0) {
      avgScore = evaluations.reduce((s, e) => s + Math.min(e.totalScore, TOTAL_MAX), 0) / evaluations.length;
      avgGrade = evaluations.reduce((s, e) => s + e.grade, 0) / evaluations.length;
      totalBonus = evaluations.reduce((s, e) => s + e.bonusPoints, 0);
    }

    res.json({
      evaluations,
      summary: {
        count: evaluations.length,
        avgScore: parseFloat(avgScore.toFixed(2)),
        avgGrade: parseFloat(avgGrade.toFixed(2)),
        totalBonus: parseFloat(totalBonus.toFixed(2))
      }
    });
  } catch (error) {
    console.error('Get evaluations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAllEvaluations = async (req, res) => {
  try {
    const { employeeId } = req.query;
    const where = {};
    if (employeeId) where.employeeId = employeeId;

    const evaluations = await EmployeeEvaluation.findAll({
      where,
      include: [
        { model: Employee, as: 'employee', attributes: ['employeeId', 'name', 'email', 'section'] },
        { model: Admin, as: 'evaluator', attributes: ['adminId', 'fullName', 'role'] }
      ],
      order: [['evaluationDate', 'DESC']]
    });

    res.json(evaluations);
  } catch (error) {
    console.error('Get all evaluations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteEvaluation = async (req, res) => {
  try {
    const { id } = req.params;
    const evaluation = await EmployeeEvaluation.findByPk(id);
    if (!evaluation) {
      return res.status(404).json({ message: 'Evaluation not found' });
    }
    await evaluation.destroy();
    res.json({ message: 'Evaluation deleted' });
  } catch (error) {
    console.error('Delete evaluation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getStructure = (req, res) => {
  res.json({ structure: EVALUATION_STRUCTURE, totalMax: TOTAL_MAX });
};
