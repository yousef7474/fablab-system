// Financial requests (طلب صرف مالي — the plan target's «الملف المالي
// التفصيلي»): the employee costs a programme and sends it through the
// shared review flow — project manager, then manager, who prints and
// signs it. See reviewFlow.js.
const { FinancialRequest, FinancialRequestVersion, FinancialRequestFile } = require('../models');
const { renderFinanceDocument, fmtReqNo } = require('../utils/financialRequestDoc');
const { createReviewFlow } = require('./reviewFlow');

const titleOf = (data) => String(data?.header?.title || '').trim().slice(0, 250) || null;

// Every fileId the request refers to (quotations and other documents).
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

const flow = createReviewFlow({
  Doc: FinancialRequest,
  Version: FinancialRequestVersion,
  File: FinancialRequestFile,
  ID: 'requestId',
  NO: 'requestNumber',
  table: 'financial_requests',
  lock: 'financial-request-number',
  fmtNo: fmtReqNo,
  titleOf,
  fileIdsOf,
  validData: (data) => !!data.header && Array.isArray(data.projects),
  readyToSend: (data) => !!titleOf(data),
  // The requested amount, for lists (kept in step with the data).
  meta: (d) => ({ amount: d.totalAmount != null ? Number(d.totalAmount) : null }),
  // A request has no separate parts — ?part= is a 404.
  render: (o) => (o.part ? null : renderFinanceDocument({ ...o, req: o.doc })),
  zip: ({ data, byId, add, safeName }) => {
    (data.quotes || []).forEach(q => {
      const row = byId.get(q.fileId);
      if (row) add(`عروض الأسعار والمستندات/${safeName(row.name)}`, row.content);
    });
  },
  w: {
    m: true,
    the: 'طلب الصرف',
    the_: 'طلب الصرف المالي',
    a: 'طلب صرف مالي',
    one: 'طلب صرف',
    your: 'طلب الصرف الخاص بك',
    tab: 'الطلبات',
    mailTag: 'طلبات الصرف المالي',
    logTag: 'finance',
    zipName: 'finance-request',
    notReady: 'اكتب اسم البرنامج أو النشاط قبل الإرسال',
    approvedNote: '<p>يطبع المدير الطلب ويوقّعه ويختمه، ثم يُحال إلى الإدارة المالية للصرف.</p>'
  }
});

module.exports = flow;
