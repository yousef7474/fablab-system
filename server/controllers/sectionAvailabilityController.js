const { SectionAvailability, Admin } = require('../models');
const { Op } = require('sequelize');

// All 7 FABLAB sections
const ALL_SECTIONS = [
  'Electronics and Programming',
  'CNC Laser',
  'CNC Wood',
  '3D',
  'Robotic and AI',
  "Kid's Club",
  'Vinyl Cutting'
];

// Helper: Auto-expire deactivations that have passed their end date
const processExpiredDeactivations = async () => {
  // Get all active deactivations
  const activeDeactivations = await SectionAvailability.findAll({
    where: { isActive: true }
  });

  // Check each one and expire if end date has passed
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const d of activeDeactivations) {
    const endDate = new Date(d.endDate);
    endDate.setHours(23, 59, 59, 999);

    if (endDate < today) {
      await d.update({ isActive: false });
    }
  }
};

// GET /api/sections/availability - Public endpoint for checking all sections status
exports.getAllSectionsStatus = async (req, res) => {
  try {
    // Auto-expire old deactivations
    await processExpiredDeactivations();

    // Get all active deactivations and filter by date in JavaScript
    // This avoids any date comparison issues with different DB dialects
    const allActiveDeactivations = await SectionAvailability.findAll({
      where: {
        isActive: true
      },
      include: [
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
      ]
    });

    // Filter to only include deactivations that are currently in effect
    // Get today's date in local timezone as YYYY-MM-DD string
    const now = new Date();
    const todayStr = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');

    const activeDeactivations = allActiveDeactivations.filter(d => {
      // DATEONLY fields return strings in YYYY-MM-DD format
      const startStr = String(d.startDate).substring(0, 10);
      const endStr = String(d.endDate).substring(0, 10);
      // String comparison works for YYYY-MM-DD format
      return startStr <= todayStr && endStr >= todayStr;
    });

    // Create a map of section -> deactivation info
    const deactivationMap = {};
    activeDeactivations.forEach(d => {
      deactivationMap[d.section] = {
        availabilityId: d.availabilityId,
        reasonEn: d.reasonEn,
        reasonAr: d.reasonAr,
        startDate: d.startDate,
        endDate: d.endDate,
        createdBy: d.creator?.fullName
      };
    });

    // Build response with all sections
    const sectionsStatus = ALL_SECTIONS.map(section => {
      const deactivation = deactivationMap[section];
      return {
        section,
        isAvailable: !deactivation,
        ...(deactivation && {
          availabilityId: deactivation.availabilityId,
          reasonEn: deactivation.reasonEn,
          reasonAr: deactivation.reasonAr,
          startDate: deactivation.startDate,
          endDate: deactivation.endDate,
          createdBy: deactivation.createdBy
        })
      };
    });

    res.json(sectionsStatus);
  } catch (error) {
    console.error('Error getting sections status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /api/sections/availability/history - Admin: Get deactivation history
exports.getDeactivationHistory = async (req, res) => {
  try {
    const { section, includeInactive } = req.query;

    const whereClause = {};
    if (section) whereClause.section = section;
    if (!includeInactive) whereClause.isActive = true;

    const deactivations = await SectionAvailability.findAll({
      where: whereClause,
      include: [
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] },
        { model: Admin, as: 'reactivatedBy', attributes: ['adminId', 'fullName'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(deactivations);
  } catch (error) {
    console.error('Error getting deactivation history:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// POST /api/sections/availability - Admin: Deactivate a section
exports.deactivateSection = async (req, res) => {
  try {
    const { section, startDate, endDate, reasonEn, reasonAr } = req.body;

    // Validation
    if (!section || !ALL_SECTIONS.includes(section)) {
      return res.status(400).json({
        message: 'Invalid section',
        messageAr: 'قسم غير صالح'
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        message: 'Start date and end date are required',
        messageAr: 'تاريخ البدء وتاريخ الانتهاء مطلوبان'
      });
    }

    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({
        message: 'End date must be after start date',
        messageAr: 'يجب أن يكون تاريخ الانتهاء بعد تاريخ البدء'
      });
    }

    if (!reasonEn) {
      return res.status(400).json({
        message: 'Reason is required',
        messageAr: 'السبب مطلوب'
      });
    }

    // Check for overlapping active deactivations
    const overlapping = await SectionAvailability.findOne({
      where: {
        section,
        isActive: true,
        [Op.or]: [
          {
            startDate: { [Op.lte]: endDate },
            endDate: { [Op.gte]: startDate }
          }
        ]
      }
    });

    if (overlapping) {
      return res.status(409).json({
        message: 'There is already an active deactivation for this section that overlaps with the specified dates',
        messageAr: 'يوجد بالفعل تعطيل نشط لهذا القسم يتداخل مع التواريخ المحددة'
      });
    }

    // Always set isActive to true when creating a new deactivation
    // The getAllSectionsStatus query will filter by date range to determine actual availability
    // isActive becomes false only when manually reactivated or when auto-expired
    const deactivation = await SectionAvailability.create({
      section,
      startDate,
      endDate,
      reasonEn,
      reasonAr: reasonAr || null,
      isActive: true,
      createdById: req.admin.adminId
    });

    // Fetch with creator info
    const result = await SectionAvailability.findByPk(deactivation.availabilityId, {
      include: [
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] }
      ]
    });

    res.status(201).json({
      message: 'Section deactivated successfully',
      messageAr: 'تم تعطيل القسم بنجاح',
      deactivation: result
    });
  } catch (error) {
    console.error('Error deactivating section:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// PATCH /api/sections/availability/:id/reactivate - Admin: Manually reactivate
exports.reactivateSection = async (req, res) => {
  try {
    const { id } = req.params;

    const deactivation = await SectionAvailability.findByPk(id);

    if (!deactivation) {
      return res.status(404).json({
        message: 'Deactivation record not found',
        messageAr: 'سجل التعطيل غير موجود'
      });
    }

    if (!deactivation.isActive) {
      return res.status(400).json({
        message: 'This deactivation is already inactive',
        messageAr: 'هذا التعطيل غير نشط بالفعل'
      });
    }

    await deactivation.update({
      isActive: false,
      reactivatedAt: new Date(),
      reactivatedById: req.admin.adminId
    });

    // Fetch with relations
    const result = await SectionAvailability.findByPk(id, {
      include: [
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] },
        { model: Admin, as: 'reactivatedBy', attributes: ['adminId', 'fullName'] }
      ]
    });

    res.json({
      message: 'Section reactivated successfully',
      messageAr: 'تم إعادة تفعيل القسم بنجاح',
      deactivation: result
    });
  } catch (error) {
    console.error('Error reactivating section:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// PUT /api/sections/availability/:id - Admin: Update deactivation details
exports.updateDeactivation = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, reasonEn, reasonAr } = req.body;

    const deactivation = await SectionAvailability.findByPk(id);

    if (!deactivation) {
      return res.status(404).json({
        message: 'Deactivation record not found',
        messageAr: 'سجل التعطيل غير موجود'
      });
    }

    // Validate dates if provided
    const newStartDate = startDate || deactivation.startDate;
    const newEndDate = endDate || deactivation.endDate;

    if (new Date(newStartDate) > new Date(newEndDate)) {
      return res.status(400).json({
        message: 'End date must be after start date',
        messageAr: 'يجب أن يكون تاريخ الانتهاء بعد تاريخ البدء'
      });
    }

    // Keep isActive as true unless it was manually reactivated
    // The date range check in getAllSectionsStatus handles actual availability
    const shouldBeActive = !deactivation.reactivatedAt;

    await deactivation.update({
      startDate: startDate !== undefined ? startDate : deactivation.startDate,
      endDate: endDate !== undefined ? endDate : deactivation.endDate,
      reasonEn: reasonEn !== undefined ? reasonEn : deactivation.reasonEn,
      reasonAr: reasonAr !== undefined ? reasonAr : deactivation.reasonAr,
      isActive: shouldBeActive
    });

    // Fetch with relations
    const result = await SectionAvailability.findByPk(id, {
      include: [
        { model: Admin, as: 'creator', attributes: ['adminId', 'fullName'] },
        { model: Admin, as: 'reactivatedBy', attributes: ['adminId', 'fullName'] }
      ]
    });

    res.json({
      message: 'Deactivation updated successfully',
      messageAr: 'تم تحديث التعطيل بنجاح',
      deactivation: result
    });
  } catch (error) {
    console.error('Error updating deactivation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// DELETE /api/sections/availability/:id - Admin: Delete deactivation record
exports.deleteDeactivation = async (req, res) => {
  try {
    const { id } = req.params;

    const deactivation = await SectionAvailability.findByPk(id);

    if (!deactivation) {
      return res.status(404).json({
        message: 'Deactivation record not found',
        messageAr: 'سجل التعطيل غير موجود'
      });
    }

    await deactivation.destroy();

    res.json({
      message: 'Deactivation deleted successfully',
      messageAr: 'تم حذف التعطيل بنجاح'
    });
  } catch (error) {
    console.error('Error deleting deactivation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
