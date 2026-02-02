const { EliteUser, EliteRating, EliteCredit, Admin } = require('../models');
const { Op, fn, col, literal } = require('sequelize');

// Weight constants for final percentage calculation
const WEIGHTS = {
  ADMIN_RATING: 0.35,      // 35% from admin ratings
  ENGINEER_RATING: 0.35,   // 35% from engineer ratings
  SYSTEM_CREDITS: 0.30     // 30% from system credits
};

// Maximum possible credits for normalization (can be adjusted)
const MAX_CREDITS_SCORE = 100;

// Helper function to determine category based on percentage
const getCategory = (percentage) => {
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'Below D';
};

// Helper function to get category info in Arabic
const getCategoryInfoAr = (category) => {
  const info = {
    'A': { name: 'الفئة A', range: '90% - 100%', support: 'دعم كامل في جميع المجالات' },
    'B': { name: 'الفئة B', range: '80% - 89%', support: 'دعم عالي مع بعض القيود' },
    'C': { name: 'الفئة C', range: '70% - 79%', support: 'دعم متوسط' },
    'D': { name: 'الفئة D', range: '60% - 69%', support: 'دعم أساسي' },
    'Below D': { name: 'أقل من D', range: 'أقل من 60%', support: 'يحتاج إلى تحسين' }
  };
  return info[category] || info['Below D'];
};

// Calculate elite user's performance percentage
const calculatePerformance = async (eliteId) => {
  // Get average admin rating
  const adminRatings = await EliteRating.findAll({
    where: { eliteId, raterType: 'admin' },
    attributes: [[fn('AVG', col('totalScore')), 'avgScore']],
    raw: true
  });
  const adminAvg = parseFloat(adminRatings[0]?.avgScore) || 0;

  // Get average engineer rating
  const engineerRatings = await EliteRating.findAll({
    where: { eliteId, raterType: 'engineer' },
    attributes: [[fn('AVG', col('totalScore')), 'avgScore']],
    raw: true
  });
  const engineerAvg = parseFloat(engineerRatings[0]?.avgScore) || 0;

  // Get net credits
  const credits = await EliteCredit.findAll({
    where: { eliteId },
    attributes: [
      'type',
      [fn('SUM', col('points')), 'totalPoints']
    ],
    group: ['type'],
    raw: true
  });

  let totalAwards = 0;
  let totalDeductions = 0;
  credits.forEach(c => {
    if (c.type === 'award') totalAwards = parseInt(c.totalPoints) || 0;
    if (c.type === 'deduction') totalDeductions = parseInt(c.totalPoints) || 0;
  });
  const netCredits = totalAwards - totalDeductions;

  // Normalize credits to a 0-100 scale (cap at MAX_CREDITS_SCORE)
  const creditsScore = Math.min(Math.max(netCredits, 0), MAX_CREDITS_SCORE);

  // Check if there are any ratings
  const hasAdminRating = adminAvg > 0;
  const hasEngineerRating = engineerAvg > 0;
  const hasCredits = netCredits !== 0;

  // Calculate final percentage with dynamic weighting
  let finalPercentage = 0;
  let totalWeight = 0;

  if (hasAdminRating) {
    finalPercentage += adminAvg * WEIGHTS.ADMIN_RATING;
    totalWeight += WEIGHTS.ADMIN_RATING;
  }
  if (hasEngineerRating) {
    finalPercentage += engineerAvg * WEIGHTS.ENGINEER_RATING;
    totalWeight += WEIGHTS.ENGINEER_RATING;
  }
  if (hasCredits || hasAdminRating || hasEngineerRating) {
    finalPercentage += creditsScore * WEIGHTS.SYSTEM_CREDITS;
    totalWeight += WEIGHTS.SYSTEM_CREDITS;
  }

  // Normalize to account for missing components
  if (totalWeight > 0) {
    finalPercentage = (finalPercentage / totalWeight) * (WEIGHTS.ADMIN_RATING + WEIGHTS.ENGINEER_RATING + WEIGHTS.SYSTEM_CREDITS);
  }

  // If no data at all, return 0
  if (!hasAdminRating && !hasEngineerRating && !hasCredits) {
    finalPercentage = 0;
  }

  return {
    adminRatingAvg: adminAvg.toFixed(2),
    engineerRatingAvg: engineerAvg.toFixed(2),
    totalAwards,
    totalDeductions,
    netCredits,
    creditsScore: creditsScore.toFixed(2),
    finalPercentage: finalPercentage.toFixed(2),
    category: getCategory(finalPercentage),
    categoryInfo: getCategoryInfoAr(getCategory(finalPercentage))
  };
};

// GET /api/elite/performance/:eliteId - Get elite user's performance metrics
exports.getElitePerformance = async (req, res) => {
  try {
    const { eliteId } = req.params;

    const eliteUser = await EliteUser.findByPk(eliteId);
    if (!eliteUser) {
      return res.status(404).json({
        message: 'Elite user not found',
        messageAr: 'المستخدم غير موجود'
      });
    }

    const performance = await calculatePerformance(eliteId);

    res.json({
      eliteId,
      userName: `${eliteUser.firstName} ${eliteUser.lastName}`,
      ...performance
    });
  } catch (error) {
    console.error('Error getting elite performance:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /api/elite/ratings/:eliteId - Get all ratings for an elite user
exports.getEliteRatings = async (req, res) => {
  try {
    const { eliteId } = req.params;
    const { raterType } = req.query;

    const whereClause = { eliteId };
    if (raterType && ['admin', 'engineer'].includes(raterType)) {
      whereClause.raterType = raterType;
    }

    const ratings = await EliteRating.findAll({
      where: whereClause,
      include: [
        { model: Admin, as: 'ratedBy', attributes: ['adminId', 'fullName', 'role'] }
      ],
      order: [['ratingDate', 'DESC']]
    });

    const performance = await calculatePerformance(eliteId);

    res.json({
      ratings,
      performance
    });
  } catch (error) {
    console.error('Error getting elite ratings:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// POST /api/elite/ratings - Create a new rating for elite user
exports.createEliteRating = async (req, res) => {
  try {
    const {
      eliteId,
      raterType,
      period,
      attendanceScore,
      projectQualityScore,
      developmentScore,
      participationScore,
      teamworkScore,
      behaviorScore,
      notes
    } = req.body;

    // Validation
    if (!eliteId || !raterType || !period) {
      return res.status(400).json({
        message: 'Elite ID, rater type, and period are required',
        messageAr: 'معرف المستخدم ونوع المقيّم والفترة مطلوبة'
      });
    }

    if (!['admin', 'engineer'].includes(raterType)) {
      return res.status(400).json({
        message: 'Invalid rater type',
        messageAr: 'نوع المقيّم غير صالح'
      });
    }

    const eliteUser = await EliteUser.findByPk(eliteId);
    if (!eliteUser) {
      return res.status(404).json({
        message: 'Elite user not found',
        messageAr: 'المستخدم غير موجود'
      });
    }

    // Check for existing rating for same period and rater type
    const existingRating = await EliteRating.findOne({
      where: { eliteId, raterType, period }
    });

    if (existingRating) {
      return res.status(409).json({
        message: `A ${raterType} rating already exists for this period`,
        messageAr: `يوجد تقييم ${raterType === 'admin' ? 'إداري' : 'مهندس'} لهذه الفترة بالفعل`
      });
    }

    const rating = await EliteRating.create({
      eliteId,
      ratedById: req.admin.adminId,
      raterType,
      period,
      attendanceScore: attendanceScore || 0,
      projectQualityScore: projectQualityScore || 0,
      developmentScore: developmentScore || 0,
      participationScore: participationScore || 0,
      teamworkScore: teamworkScore || 0,
      behaviorScore: behaviorScore || 0,
      notes
    });

    // Fetch with rater info
    const createdRating = await EliteRating.findByPk(rating.ratingId, {
      include: [{ model: Admin, as: 'ratedBy', attributes: ['adminId', 'fullName', 'role'] }]
    });

    const performance = await calculatePerformance(eliteId);

    res.status(201).json({
      message: 'Rating created successfully',
      messageAr: 'تم إنشاء التقييم بنجاح',
      rating: createdRating,
      performance
    });
  } catch (error) {
    console.error('Error creating elite rating:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// PUT /api/elite/ratings/:ratingId - Update a rating
exports.updateEliteRating = async (req, res) => {
  try {
    const { ratingId } = req.params;
    const {
      attendanceScore,
      projectQualityScore,
      developmentScore,
      participationScore,
      teamworkScore,
      behaviorScore,
      notes
    } = req.body;

    const rating = await EliteRating.findByPk(ratingId);
    if (!rating) {
      return res.status(404).json({
        message: 'Rating not found',
        messageAr: 'التقييم غير موجود'
      });
    }

    await rating.update({
      attendanceScore: attendanceScore !== undefined ? attendanceScore : rating.attendanceScore,
      projectQualityScore: projectQualityScore !== undefined ? projectQualityScore : rating.projectQualityScore,
      developmentScore: developmentScore !== undefined ? developmentScore : rating.developmentScore,
      participationScore: participationScore !== undefined ? participationScore : rating.participationScore,
      teamworkScore: teamworkScore !== undefined ? teamworkScore : rating.teamworkScore,
      behaviorScore: behaviorScore !== undefined ? behaviorScore : rating.behaviorScore,
      notes: notes !== undefined ? notes : rating.notes
    });

    const updatedRating = await EliteRating.findByPk(ratingId, {
      include: [{ model: Admin, as: 'ratedBy', attributes: ['adminId', 'fullName', 'role'] }]
    });

    const performance = await calculatePerformance(rating.eliteId);

    res.json({
      message: 'Rating updated successfully',
      messageAr: 'تم تحديث التقييم بنجاح',
      rating: updatedRating,
      performance
    });
  } catch (error) {
    console.error('Error updating elite rating:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// DELETE /api/elite/ratings/:ratingId - Delete a rating
exports.deleteEliteRating = async (req, res) => {
  try {
    const { ratingId } = req.params;

    const rating = await EliteRating.findByPk(ratingId);
    if (!rating) {
      return res.status(404).json({
        message: 'Rating not found',
        messageAr: 'التقييم غير موجود'
      });
    }

    const eliteId = rating.eliteId;
    await rating.destroy();

    const performance = await calculatePerformance(eliteId);

    res.json({
      message: 'Rating deleted successfully',
      messageAr: 'تم حذف التقييم بنجاح',
      performance
    });
  } catch (error) {
    console.error('Error deleting elite rating:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /api/elite/credits/:eliteId - Get all credits for an elite user
exports.getEliteCredits = async (req, res) => {
  try {
    const { eliteId } = req.params;

    const credits = await EliteCredit.findAll({
      where: { eliteId },
      include: [
        { model: Admin, as: 'createdBy', attributes: ['adminId', 'fullName', 'role'] }
      ],
      order: [['creditDate', 'DESC']]
    });

    // Calculate totals
    let totalAwards = 0;
    let totalDeductions = 0;
    credits.forEach(c => {
      if (c.type === 'award') totalAwards += c.points;
      else totalDeductions += c.points;
    });

    res.json({
      credits,
      summary: {
        totalAwards,
        totalDeductions,
        netCredits: totalAwards - totalDeductions
      }
    });
  } catch (error) {
    console.error('Error getting elite credits:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// POST /api/elite/credits - Add credit for elite user
exports.addEliteCredit = async (req, res) => {
  try {
    const { eliteId, type, source, points, reason } = req.body;

    if (!eliteId || !type || !source || !points || !reason) {
      return res.status(400).json({
        message: 'All fields are required',
        messageAr: 'جميع الحقول مطلوبة'
      });
    }

    if (!['award', 'deduction'].includes(type)) {
      return res.status(400).json({
        message: 'Invalid type. Must be award or deduction',
        messageAr: 'نوع غير صالح. يجب أن يكون منحة أو خصم'
      });
    }

    if (!['admin', 'engineer', 'system', 'task', 'course'].includes(source)) {
      return res.status(400).json({
        message: 'Invalid source',
        messageAr: 'مصدر غير صالح'
      });
    }

    const eliteUser = await EliteUser.findByPk(eliteId);
    if (!eliteUser) {
      return res.status(404).json({
        message: 'Elite user not found',
        messageAr: 'المستخدم غير موجود'
      });
    }

    const credit = await EliteCredit.create({
      eliteId,
      createdById: req.admin?.adminId || null,
      type,
      source,
      points,
      reason
    });

    const createdCredit = await EliteCredit.findByPk(credit.creditId, {
      include: [{ model: Admin, as: 'createdBy', attributes: ['adminId', 'fullName', 'role'] }]
    });

    const performance = await calculatePerformance(eliteId);

    res.status(201).json({
      message: type === 'award' ? 'Credit awarded successfully' : 'Credit deducted successfully',
      messageAr: type === 'award' ? 'تم منح النقاط بنجاح' : 'تم خصم النقاط بنجاح',
      credit: createdCredit,
      performance
    });
  } catch (error) {
    console.error('Error adding elite credit:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// DELETE /api/elite/credits/:creditId - Delete a credit
exports.deleteEliteCredit = async (req, res) => {
  try {
    const { creditId } = req.params;

    const credit = await EliteCredit.findByPk(creditId);
    if (!credit) {
      return res.status(404).json({
        message: 'Credit not found',
        messageAr: 'النقاط غير موجودة'
      });
    }

    const eliteId = credit.eliteId;
    await credit.destroy();

    const performance = await calculatePerformance(eliteId);

    res.json({
      message: 'Credit deleted successfully',
      messageAr: 'تم حذف النقاط بنجاح',
      performance
    });
  } catch (error) {
    console.error('Error deleting elite credit:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /api/elite/all-performance - Get performance for all elite users
exports.getAllElitePerformance = async (req, res) => {
  try {
    const eliteUsers = await EliteUser.findAll({
      where: { status: 'active' },
      attributes: ['eliteId', 'firstName', 'lastName', 'uniqueId', 'email', 'status']
    });

    const performances = await Promise.all(
      eliteUsers.map(async (user) => {
        const performance = await calculatePerformance(user.eliteId);
        return {
          eliteId: user.eliteId,
          uniqueId: user.uniqueId,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          status: user.status,
          ...performance
        };
      })
    );

    // Sort by percentage descending
    performances.sort((a, b) => parseFloat(b.finalPercentage) - parseFloat(a.finalPercentage));

    res.json(performances);
  } catch (error) {
    console.error('Error getting all elite performance:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = exports;
