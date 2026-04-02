const { EmployeeEvaluation, Employee, Admin } = require('../models');

// Weights per criterion (total weights = 100)
// Manager gives 0-100 per criterion, weighted score = (input/100) * weight
const EVALUATION_STRUCTURE = {
  cat1: { criteria: { c1: 2, c2: 2, c3: 2, c4: 2 } },   // 8
  cat2: { criteria: { c1: 4, c2: 4, c3: 4, c4: 4 } },   // 16
  cat3: { criteria: { c1: 2, c2: 2, c3: 2, c4: 2 } },   // 8
  cat4: { criteria: { c1: 6, c2: 6 } },                   // 12
  cat5: { criteria: { c1: 4 } },                           // 4
  cat6: { criteria: { c1: 3, c2: 3, c3: 3, c4: 3 } },   // 12
  cat7: { criteria: { c1: 4, c2: 4, c3: 4, c4: 4 } },   // 16
  cat8: { criteria: { c1: 3, c2: 3, c3: 3, c4: 3 } },   // 12
  cat9: { criteria: { c1: 3, c2: 3, c3: 3, c4: 3 } },   // 12
};

const TOTAL_WEIGHT = 100;

// Calculate weighted total from raw scores (0-100 per criterion)
function calculateTotal(scores) {
  let weightedTotal = 0;
  for (const [catKey, catDef] of Object.entries(EVALUATION_STRUCTURE)) {
    for (const [critKey, weight] of Object.entries(catDef.criteria)) {
      const key = `${catKey}_${critKey}`;
      const raw = Math.min(Math.max(parseFloat(scores[key]) || 0, 0), 100);
      weightedTotal += (raw / 100) * weight;
    }
  }
  return parseFloat(weightedTotal.toFixed(2));
}

// Upsert: create or update evaluation for an employee
exports.upsertEvaluation = async (req, res) => {
  try {
    const { employeeId, scores, period, notes } = req.body;

    if (!employeeId || !scores) {
      return res.status(400).json({ message: 'Employee and scores are required' });
    }

    const employee = await Employee.findByPk(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const totalScore = calculateTotal(scores);
    const grade = parseFloat(((totalScore / TOTAL_WEIGHT) * 5).toFixed(2));

    // Find existing evaluation for this employee (one per employee)
    let evaluation = await EmployeeEvaluation.findOne({ where: { employeeId } });

    if (evaluation) {
      evaluation.scores = scores;
      evaluation.totalScore = totalScore;
      evaluation.grade = grade;
      evaluation.bonusPoints = 0;
      evaluation.period = period || evaluation.period;
      evaluation.notes = notes !== undefined ? notes : evaluation.notes;
      evaluation.createdById = req.admin.adminId;
      evaluation.evaluationDate = new Date();
      await evaluation.save();
    } else {
      evaluation = await EmployeeEvaluation.create({
        employeeId,
        createdById: req.admin.adminId,
        scores,
        qualitative: {},
        totalScore,
        grade,
        bonusPoints: 0,
        period: period || null,
        notes: notes || null,
        evaluationDate: new Date()
      });
    }

    const result = await EmployeeEvaluation.findByPk(evaluation.evaluationId, {
      include: [
        { model: Employee, as: 'employee', attributes: ['employeeId', 'name', 'email', 'section'] },
        { model: Admin, as: 'evaluator', attributes: ['adminId', 'fullName', 'role'] }
      ]
    });

    res.json(result);
  } catch (error) {
    console.error('Upsert evaluation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all evaluations (one per employee) with employee info
exports.getAllEvaluations = async (req, res) => {
  try {
    const evaluations = await EmployeeEvaluation.findAll({
      include: [
        { model: Employee, as: 'employee', attributes: ['employeeId', 'name', 'email', 'section'] },
        { model: Admin, as: 'evaluator', attributes: ['adminId', 'fullName', 'role'] }
      ],
      order: [['updatedAt', 'DESC']]
    });

    res.json(evaluations);
  } catch (error) {
    console.error('Get all evaluations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get single employee evaluation
exports.getEmployeeEvaluation = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const evaluation = await EmployeeEvaluation.findOne({
      where: { employeeId },
      include: [
        { model: Employee, as: 'employee', attributes: ['employeeId', 'name', 'email', 'section'] },
        { model: Admin, as: 'evaluator', attributes: ['adminId', 'fullName', 'role'] }
      ]
    });

    res.json(evaluation || null);
  } catch (error) {
    console.error('Get evaluation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete evaluation
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

// Export CSV - single employee or all
exports.exportCSV = async (req, res) => {
  try {
    const { employeeId } = req.query;
    const where = {};
    if (employeeId) where.employeeId = employeeId;

    const evaluations = await EmployeeEvaluation.findAll({
      where,
      include: [
        { model: Employee, as: 'employee', attributes: ['employeeId', 'name', 'email', 'section'] },
        { model: Admin, as: 'evaluator', attributes: ['fullName'] }
      ],
      order: [['updatedAt', 'DESC']]
    });

    // Category/criteria labels
    const LABELS = {
      cat1: { name: 'الكفاءة المهنية', criteria: { c1: 'القدرة على تطوير أساليب العمل', c2: 'المعرفة بالأسس الفنية', c3: 'التطوير المهني المستمر', c4: 'المعرفة بنظم العمل' } },
      cat2: { name: 'الإنتاجية وجودة العمل', criteria: { c1: 'إنجاز الأعمال بكفاءة', c2: 'تحديد خطوات العمل', c3: 'المهارة في التنفيذ', c4: 'إنجاز العمل في الوقت المحدد' } },
      cat3: { name: 'العمل الجماعي', criteria: { c1: 'المرونة والاستجابة', c2: 'المشاركة في الاجتماعات', c3: 'روح الفريق', c4: 'المشاركة في المبادرات' } },
      cat4: { name: 'الالتزام والانضباط', criteria: { c1: 'المحافظة على أوقات العمل', c2: 'الالتزام بالتعليمات' } },
      cat5: { name: 'الولاء المؤسسي', criteria: { c1: 'الالتزام برسالة المؤسسة' } },
      cat6: { name: 'الصفات الشخصية', criteria: { c1: 'القدرة على الحوار', c2: 'تقدير المسؤولية', c3: 'الاهتمام بالمظهر', c4: 'حسن التصرف' } },
      cat7: { name: 'العلاقات', criteria: { c1: 'مع الرؤساء', c2: 'مع الزملاء', c3: 'مع المرؤوسين', c4: 'مع المستفيدين' } },
      cat8: { name: 'التصنيع', criteria: { c1: 'إنتاج وتصنيع منتجات', c2: 'تحويل لحقائب تدريبية', c3: 'تشغيل الأجهزة', c4: 'تجهيز منتج عند الطلب' } },
      cat9: { name: 'متابعة الأعمال', criteria: { c1: 'متابعة المنصة', c2: 'تعبئة الجدول', c3: 'إتمام المهام اليومية', c4: 'متابعة طلبات التسجيل' } },
    };

    // Build CSV header
    const BOM = '\uFEFF';
    let csvRows = [];

    // Header row
    let header = ['الموظف', 'القسم', 'البريد'];
    for (const [catKey, catLabel] of Object.entries(LABELS)) {
      for (const [critKey, critLabel] of Object.entries(catLabel.criteria)) {
        const weight = EVALUATION_STRUCTURE[catKey]?.criteria[critKey] || 0;
        header.push(`${catLabel.name} - ${critLabel} (الوزن: ${weight})`);
      }
    }
    header.push('المجموع (/100)', 'التقدير (/5)', 'الفترة', 'التاريخ', 'المقيّم');
    csvRows.push(header.map(h => `"${h}"`).join(','));

    // Data rows
    for (const ev of evaluations) {
      let row = [ev.employee?.name || '', ev.employee?.section || '', ev.employee?.email || ''];
      for (const [catKey, catLabel] of Object.entries(LABELS)) {
        for (const critKey of Object.keys(catLabel.criteria)) {
          const raw = ev.scores?.[`${catKey}_${critKey}`] || 0;
          const weight = EVALUATION_STRUCTURE[catKey]?.criteria[critKey] || 0;
          const weighted = ((raw / 100) * weight).toFixed(2);
          row.push(`${raw}/100 (${weighted})`);
        }
      }
      row.push(ev.totalScore, ev.grade, ev.period || '', ev.evaluationDate || '', ev.evaluator?.fullName || '');
      csvRows.push(row.map(v => `"${v}"`).join(','));
    }

    const csv = BOM + csvRows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=evaluations.csv');
    res.send(csv);
  } catch (error) {
    console.error('Export CSV error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getStructure = (req, res) => {
  res.json({ structure: EVALUATION_STRUCTURE, totalWeight: TOTAL_WEIGHT });
};
