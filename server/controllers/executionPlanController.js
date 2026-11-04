// Execution plans (الخطة التنفيذية): each employee fills the plan template
// for a month or a quarter and sends it through the shared review flow —
// project manager, then manager. See reviewFlow.js.
const models = require('../models');
const { renderPlanDocument, renderPlanPart, planParts, fmtPlanNo, periodLabel } = require('../utils/executionPlanDoc');

const { ExecutionPlan, ExecutionPlanVersion, ExecutionPlanFile, TrainingKit } = models;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const { createReviewFlow } = require('./reviewFlow');

const hasPeriod = (data) => !!periodLabel(data?.header) && /\d{4}/.test(String(data?.header?.year || ''));

const titleOf = (data) => {
  if (!hasPeriod(data)) return null;
  const section = String(data.header.section || '').trim();
  return `الخطة التنفيذية — ${periodLabel(data.header)}${section ? ` · ${section}` : ''}`.slice(0, 250);
};

// Every fileId the plan refers to (each target's content / financial /
// media / volunteer files).
const fileIdsOf = (data) => {
  const ids = new Set();
  const walk = (v) => {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (!v || typeof v !== 'object') return;
    if (typeof v.fileId === 'string' && v.fileId) ids.add(v.fileId);
    Object.values(v).forEach(walk);
  };
  walk(data);
  return ids;
};

const BLOCKS = [['content', 'المحتوى المعتمد'], ['finance', 'الملف المالي التفصيلي'], ['media', 'المتطلبات الإعلامية'], ['volunteer', 'تصاميم الفرص التطوعية']];

// Live status of the documents the targets link — the content's training
// kit, the financial request and the media design request each move on
// their own path, so the plan document shows where they are now. A deleted
// one is simply absent.
const prepare = async (data) => {
  const targets = Array.isArray(data?.targets) ? data.targets : [];
  const ids = (key, field) => [...new Set(targets.map(t => t?.[key]?.[field]).filter(v => typeof v === 'string' && UUID.test(v)))];
  const kitIds = ids('content', 'kitId');
  const reqIds = ids('finance', 'requestId');
  const mediaIds = ids('media', 'requestId');
  const kits = {}; const finance = {}; const media = {};
  if (kitIds.length) {
    (await TrainingKit.findAll({ where: { kitId: kitIds }, attributes: ['kitId', 'kitNumber', 'title', 'status', 'approvedAt'] }))
      .forEach(k => { kits[k.kitId] = { number: k.kitNumber, title: k.title, status: k.status, approvedAt: k.approvedAt }; });
  }
  // FinancialRequest comes with the financial-requests module.
  const FR = models.FinancialRequest;
  if (reqIds.length && FR) {
    (await FR.findAll({ where: { requestId: reqIds }, attributes: ['requestId', 'requestNumber', 'title', 'status', 'approvedAt'] }))
      .forEach(r => { finance[r.requestId] = { number: r.requestNumber, title: r.title, status: r.status, approvedAt: r.approvedAt }; });
  }
  // MediaRequest comes with the media design-request module.
  const MR = models.MediaRequest;
  if (mediaIds.length && MR) {
    (await MR.findAll({ where: { requestId: mediaIds }, attributes: ['requestId', 'requestNumber', 'title', 'status', 'approvedAt', 'designVersion'] }))
      .forEach(r => { media[r.requestId] = { number: r.requestNumber, title: r.title, status: r.status, approvedAt: r.approvedAt, designVersion: r.designVersion }; });
  }
  return { live: { kits, finance: FR ? finance : undefined, media: MR ? media : undefined } };
};

const flow = createReviewFlow({
  Doc: ExecutionPlan,
  Version: ExecutionPlanVersion,
  File: ExecutionPlanFile,
  ID: 'planId',
  NO: 'planNumber',
  table: 'execution_plans',
  lock: 'execution-plan-number',
  fmtNo: fmtPlanNo,
  titleOf,
  fileIdsOf,
  validData: (data) => !!data.header && Array.isArray(data.targets),
  readyToSend: hasPeriod,
  prepare,
  // ?part=media-<targetId> / volunteer-<targetId> prints one form alone.
  render: (o) => (o.part ? renderPlanPart({ ...o, plan: o.doc }) : renderPlanDocument({ ...o, plan: o.doc })),
  zip: ({ data, byId, add, safeName, renderPart }) => {
    (data.targets || []).forEach((t, i) => {
      const dir = `المستهدف ${i + 1} - ${safeName(t.name || 'بلا اسم')}`;
      BLOCKS.forEach(([key, label]) => (t[key]?.files || []).forEach(f => {
        const row = byId.get(f.fileId);
        if (row) add(`${dir}/${label}/${safeName(row.name)}`, row.content);
      }));
      // Ad images of an embedded media form (older plans); a linked design
      // request carries its own files.
      (t.media?.status === 'لا يتطلب' || t.media?.requestId ? [] : (t.media?.form?.images || [])).forEach(im => {
        const row = byId.get(im.fileId);
        if (row) add(`${dir}/المتطلبات الإعلامية/صور الإعلان/${safeName(row.name)}`, row.content);
      });
    });
    planParts(data).forEach(p => {
      const html = renderPart(p.key);
      if (html) add(`النماذج/${safeName(p.file)}.html`, html);
    });
  },
  w: {
    the: 'الخطة',
    the_: 'الخطة التنفيذية',
    a: 'خطة تنفيذية',
    one: 'خطة',
    your: 'خطتك التنفيذية',
    tab: 'الخطة التنفيذية',
    mailTag: 'الخطة التنفيذية',
    logTag: 'plans',
    zipName: 'plan',
    notReady: 'حدد فترة الخطة (الشهر أو الربع، والسنة) قبل الإرسال',
    approvedNote: '<p>حُفظت الخطة المعتمدة في «الخطط التنفيذية» بلوحة المدير، وتبقى متاحة لك في «الخطة التنفيذية» بلوحة الموظف.</p>'
  }
});

module.exports = flow;
