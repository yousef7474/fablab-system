// One-shot boot-time backfill for the ApprovalArchive table.
//
// The archive was introduced after production had already accumulated
// approved / rejected / pending manager-approval requests. Those rows
// don't have an archive entry, so the manager's Archive tab showed an
// empty list. This helper walks each source table (volunteer opportunity
// requests, overtime requests, fablab visits) and creates a missing
// archive row for every request that has ever been sent to a manager.
//
// Idempotent: if an archive row already exists for a given (type,
// sourceId) it's skipped. Safe to run on every boot — after the first
// run it's essentially a no-op.
//
// Runs after sequelize.sync so the archive table definitely exists.

const { Op } = require('sequelize');

const buildOvertimeEntry = (row, otCtrl) => {
  const token = row.approvalToken || 'legacy';
  const origin = otCtrl._publicOrigin();
  const mail = otCtrl._buildApprovalEmail({ row, token, origin });
  return {
    requestNumber: otCtrl._overtimeRef(row),
    title: row.employeeName || 'Overtime request',
    subject: mail.subject,
    emailHtml: mail.html
  };
};

const buildVorEntry = (row, vorCtrl) => {
  const token = row.approvalToken || 'legacy';
  const origin = vorCtrl._publicOrigin();
  const mail = vorCtrl._buildApprovalEmail({ row, token, origin });
  return {
    requestNumber: vorCtrl._fmtRequestNumber(row.requestNumber),
    title: row.title || 'Volunteer opportunity request',
    subject: mail.subject,
    emailHtml: mail.html
  };
};

const buildVisitEntry = (row, visitCtrl) => {
  const token = row.approvalToken || 'legacy';
  const origin = visitCtrl._publicOrigin();
  const mail = visitCtrl._buildManagerEmail({ row, token, origin });
  return {
    requestNumber: row.visitNumber != null
      ? visitCtrl._formatVisitNumber(row.visitNumber)
      : null,
    title: row.entityName || row.personInCharge || 'FabLab Visit',
    subject: mail.subject,
    emailHtml: mail.html
  };
};

const backfillApprovalArchive = async () => {
  let ApprovalArchive, VolunteerOpportunityRequest, OvertimeRequest, FablabVisit;
  try {
    // Late-require so this file has no import-time coupling to model
    // load order.
    ({ ApprovalArchive, VolunteerOpportunityRequest, OvertimeRequest, FablabVisit } = require('../models'));
  } catch (err) {
    console.log('backfillApprovalArchive: models not ready —', err.message);
    return { inserted: 0, skipped: 0 };
  }
  if (!ApprovalArchive) return { inserted: 0, skipped: 0 };

  const otCtrl = require('../controllers/overtimeController');
  const vorCtrl = require('../controllers/volunteerOpportunityRequestController');
  const visitCtrl = require('../controllers/fablabVisitController');

  let inserted = 0;
  let skipped = 0;

  // ---- Volunteer opportunity requests ----
  try {
    const rows = await VolunteerOpportunityRequest.findAll({
      where: { approvalStatus: { [Op.in]: ['pending', 'approved', 'rejected'] } },
      order: [['createdAt', 'ASC']]
    });
    for (const row of rows) {
      const existing = await ApprovalArchive.findOne({
        where: { type: 'volunteer_opportunity', sourceId: row.requestId }
      });
      if (existing) { skipped++; continue; }
      try {
        const entry = buildVorEntry(row, vorCtrl);
        await ApprovalArchive.create({
          type: 'volunteer_opportunity',
          sourceId: row.requestId,
          requestNumber: entry.requestNumber,
          title: entry.title,
          managerEmail: row.managerEmail || 'legacy@fablabsahsa.com',
          managerName: row.managerName || null,
          subject: entry.subject,
          emailHtml: entry.emailHtml,
          payloadSnapshot: row.toJSON(),
          status: row.approvalStatus,
          sentAt: row.sentForApprovalAt || row.createdAt || new Date(),
          decidedAt: row.approvedAt || row.rejectedAt || null,
          sentById: row.createdById || null
        });
        inserted++;
      } catch (err) {
        console.log('backfill VOR row failed:', row.requestId, err.message);
      }
    }
  } catch (err) {
    console.log('backfill VOR pass failed:', err.message);
  }

  // ---- Overtime requests ----
  try {
    const rows = await OvertimeRequest.findAll({
      where: { approvalStatus: { [Op.in]: ['pending', 'approved', 'rejected'] } },
      order: [['createdAt', 'ASC']]
    });
    for (const row of rows) {
      const existing = await ApprovalArchive.findOne({
        where: { type: 'overtime', sourceId: row.overtimeId }
      });
      if (existing) { skipped++; continue; }
      try {
        const entry = buildOvertimeEntry(row, otCtrl);
        await ApprovalArchive.create({
          type: 'overtime',
          sourceId: row.overtimeId,
          requestNumber: entry.requestNumber,
          title: entry.title,
          managerEmail: row.managerEmail || 'legacy@fablabsahsa.com',
          managerName: row.approvedBy || null,
          subject: entry.subject,
          emailHtml: entry.emailHtml,
          payloadSnapshot: row.toJSON(),
          status: row.approvalStatus,
          sentAt: row.sentForApprovalAt || row.createdAt || new Date(),
          decidedAt: row.approvedAt || row.rejectedAt || null,
          sentById: null
        });
        inserted++;
      } catch (err) {
        console.log('backfill overtime row failed:', row.overtimeId, err.message);
      }
    }
  } catch (err) {
    console.log('backfill overtime pass failed:', err.message);
  }

  // ---- FabLab visits ----
  // Only walk rows that were ever pushed to a manager. Draft rows
  // (never sent) don't belong in the archive.
  if (FablabVisit) {
    try {
      const rows = await FablabVisit.findAll({
        where: { approvalStatus: { [Op.in]: ['pending', 'approved', 'rejected'] } },
        order: [['createdAt', 'ASC']]
      });
      for (const row of rows) {
        const existing = await ApprovalArchive.findOne({
          where: { type: 'fablab_visit', sourceId: row.visitId }
        });
        if (existing) { skipped++; continue; }
        try {
          const entry = buildVisitEntry(row, visitCtrl);
          await ApprovalArchive.create({
            type: 'fablab_visit',
            sourceId: row.visitId,
            requestNumber: entry.requestNumber,
            title: entry.title,
            managerEmail: row.managerEmail || 'legacy@fablabsahsa.com',
            managerName: row.managerName || null,
            subject: entry.subject,
            emailHtml: entry.emailHtml,
            payloadSnapshot: row.toJSON(),
            status: row.approvalStatus,
            sentAt: row.sentForApprovalAt || row.createdAt || new Date(),
            decidedAt: row.approvedAt || row.rejectedAt || null,
            sentById: null
          });
          inserted++;
        } catch (err) {
          console.log('backfill visit row failed:', row.visitId, err.message);
        }
      }
    } catch (err) {
      console.log('backfill visit pass failed:', err.message);
    }
  }

  if (inserted > 0) {
    console.log(`📚 ApprovalArchive backfill: inserted ${inserted}, skipped ${skipped}.`);
  }
  return { inserted, skipped };
};

module.exports = { backfillApprovalArchive };
