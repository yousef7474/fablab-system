// Execution plans (الخطة التنفيذية): each employee fills the plan template
// for a month or a quarter and sends it through the shared review flow —
// project manager, then manager. See reviewFlow.js.
const { ExecutionPlan, ExecutionPlanVersion, ExecutionPlanFile } = require('../models');
const { renderPlanDocument, fmtPlanNo, periodLabel } = require('../utils/executionPlanDoc');
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
  // A plan has no separate parts — ?part= is a 404.
  render: (o) => (o.part ? null : renderPlanDocument({ ...o, plan: o.doc })),
  zip: ({ data, byId, add, safeName }) => {
    (data.targets || []).forEach((t, i) => {
      const dir = `المستهدف ${i + 1} - ${safeName(t.name || 'بلا اسم')}`;
      BLOCKS.forEach(([key, label]) => (t[key]?.files || []).forEach(f => {
        const row = byId.get(f.fileId);
        if (row) add(`${dir}/${label}/${safeName(row.name)}`, row.content);
      }));
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
