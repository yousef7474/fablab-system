const cron = require('node-cron');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { FabForm, FabFormResponse, PaymentSubmission } = require('../models');
const { sendFormReminder } = require('./fabFormEmail');

// Event reminders for FabLab forms: a form with an event time sends each
// person a reminder `reminderDays` days before it (e.g. a week and two
// days before, as the لقاء form promises), with "I'll attend" / "I can't"
// buttons when the form asks for it.
//
// Who gets one: a response with an email that registered before that
// reminder was due, did not decline, and — on a form that takes payment —
// whose payment was not rejected. When several reminders are due at once
// (the server was down) only the nearest one is sent.

const DAY = 24 * 60 * 60 * 1000;
const _origin = () => process.env.PUBLIC_APP_URL
  || (process.env.NODE_ENV === 'production' ? 'https://fablabsahsa.com' : 'http://localhost:3000');

// One pass: marks what it sends inside a transaction (so a second server
// process can't send it too), then emails after the commit.
async function runFabFormReminders(now = new Date()) {
  const jobs = await sequelize.transaction(async (t) => {
    const [[lock]] = await sequelize.query(
      'SELECT pg_try_advisory_xact_lock(hashtext(:k)) AS ok', { replacements: { k: 'fab-form-reminders' }, transaction: t }
    );
    if (!lock?.ok) return [];
    const forms = await FabForm.findAll({ where: { eventStartsAt: { [Op.gt]: now } }, transaction: t });
    const out = [];
    for (const form of forms) {
      const start = new Date(form.eventStartsAt).getTime();
      const due = (form.reminderDays || []).map(Number).filter(d => d > 0 && start - d * DAY <= now.getTime());
      if (!due.length) continue;
      const responses = await FabFormResponse.findAll({
        where: { formId: form.formId, respondentEmail: { [Op.ne]: null } },
        transaction: t
      });
      // Latest payment per response (a form that takes payment).
      const payStatus = {};
      if (form.paymentPageId && responses.length) {
        const pays = await PaymentSubmission.findAll({
          attributes: ['formResponseId', 'status', 'createdAt'],
          where: { formResponseId: { [Op.in]: responses.map(r => r.responseId) } },
          order: [['createdAt', 'ASC']],
          transaction: t
        });
        pays.forEach(p => { payStatus[p.formResponseId] = p.status; });
      }
      for (const r of responses) {
        const sent = (r.remindersSent || []).map(Number);
        // Due for this person: not sent, and they registered before it was due.
        const mine = due.filter(d => !sent.includes(d) && new Date(r.createdAt).getTime() < start - d * DAY);
        if (!mine.length) continue;
        const skip = r.attendance === 'no'
          || (form.paymentPageId && !['pending', 'verified'].includes(payStatus[r.responseId]));
        const patch = { remindersSent: [...new Set([...sent, ...mine])] };
        if (!r.attendToken) patch.attendToken = crypto.randomUUID();
        await r.update(patch, { transaction: t });
        if (!skip) out.push({ form, response: r, days: Math.min(...mine) });
      }
    }
    return out;
  });

  for (const { form, response, days } of jobs) {
    try {
      await sendFormReminder({
        to: response.respondentEmail,
        name: response.respondentName,
        form,
        response,
        days,
        attendUrl: `${_origin()}/forms/attend/${response.attendToken}`
      });
    } catch (e) {
      console.error(`Form reminder to ${response.reference} failed:`, e.message);
    }
  }
  if (jobs.length) console.log(`🔔 FabLab forms: sent ${jobs.length} event reminder(s)`);
  return jobs.length;
}

const startFabFormReminderScheduler = () => {
  // Every 10 minutes: reminders go out close to "N days before" the event time.
  cron.schedule('*/10 * * * *', () => {
    runFabFormReminders().catch(e => console.error('FabLab form reminders failed:', e.message));
  });
};

module.exports = { startFabFormReminderScheduler, runFabFormReminders };
