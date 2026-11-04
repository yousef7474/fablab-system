// Workshop requests (طلب ورشة): the employee picks one of their approved
// training kits, fills the workshop's schedule / registration details and
// sends it through the shared review flow — project manager, then
// manager. The manager's approval creates the real Workshop in the
// workshops system. See reviewFlow.js.
const { WorkshopRequest, WorkshopRequestVersion, WorkshopRequestFile, TrainingKit, TrainingKitVersion, Workshop } = require('../models');
const { renderWorkshopRequestDocument, fmtWrNo, fmtKitNo } = require('../utils/workshopRequestDoc');
const { createReviewFlow } = require('./reviewFlow');

const has = (v) => String(v == null ? '' : v).trim() !== '';
const num = (v) => (v === '' || v == null || !isFinite(+v) ? null : +v);
const int = (v) => { const n = num(v); return n == null ? null : Math.round(n); };

const titleOf = (data) => {
  const t = String(data?.title || '').trim();
  if (t) return t.slice(0, 250);
  const k = String(data?.kit?.kitTitle || '').trim();
  return k ? `ورشة من الحقيبة «${k}»`.slice(0, 250) : null;
};

// What the workshop needs to exist: a kit, a title, a presenter and a
// start date (the Workshop model's required columns).
const readyToSend = (data) => has(data?.kit?.kitId) && has(data?.title) && has(data?.presenter) && has(data?.startDate);

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

// The approved kit the request comes from (even if deleted since), and
// the workshop the approval created — for the printable document.
const prepare = async (data, doc) => {
  let kit = null;
  const kitId = data?.kit?.kitId;
  if (kitId) {
    const k = await TrainingKit.findByPk(kitId, { paranoid: false });
    if (k) {
      const v = k.approvedVersion ? await TrainingKitVersion.findOne({ where: { kitId, versionNumber: k.approvedVersion } }) : null;
      const d = (v && v.data) || k.data || {};
      const c = d.card || {};
      kit = {
        number: k.kitNumber,
        title: k.title,
        status: k.status,
        deleted: !!k.deletedAt,
        approvedAt: k.approvedAt,
        approvedVersion: k.approvedVersion,
        level: c.level,
        days: c.days,
        hours: c.hours,
        partMin: c.partMin,
        partMax: c.partMax,
        outputs: (d.outputs || []).map(o => o && o.name).filter(has)
      };
    }
  }
  let workshop = null;
  if (doc?.workshopId) {
    const w = await Workshop.findByPk(doc.workshopId, { attributes: ['workshopId', 'title', 'startDate', 'status', 'isPublic', 'isActive'] });
    if (w) workshop = w.toJSON();
  }
  return { kit, workshop };
};

// Only the author's own kit, and only while it is approved.
const checkSubmit = async (doc, req) => {
  const kitId = doc.data?.kit?.kitId;
  const kit = kitId ? await TrainingKit.findOne({ where: { kitId, employeeId: req.employee.employeeId } }) : null;
  if (!kit) {
    return { status: 400, message: 'Choose one of your approved kits', messageAr: 'اختر حقيبة تدريبية معتمدة من حقائبك قبل إرسال الطلب' };
  }
  if (kit.status !== 'approved') {
    return { status: 409, message: 'The kit is not approved', messageAr: `الحقيبة ${fmtKitNo(kit.kitNumber)} غير معتمدة — لا يمكن طلب ورشة منها قبل اعتمادها` };
  }
  return null;
};

// The manager's approval creates the workshop from the approved version,
// inside the same transaction (a failure leaves the request unapproved).
const onApproved = async ({ doc, version, reviewer, transaction }) => {
  const d = version.data || {};
  if (!readyToSend(d)) {
    const e = new Error('Workshop data incomplete');
    e.status = 400;
    e.messageAr = 'بيانات الورشة ناقصة (العنوان أو المقدم أو تاريخ البداية) — أعد الطلب للموظف لاستكمالها';
    throw e;
  }
  let photo = null;
  if (d.cover?.fileId) {
    const f = await WorkshopRequestFile.findOne({ where: { requestId: doc.requestId, fileId: d.cover.fileId }, transaction });
    if (f) photo = `data:${f.mime || 'image/jpeg'};base64,${Buffer.from(f.content).toString('base64')}`;
  }
  const origin = `أُنشئت من طلب الورشة ${fmtWrNo(doc.requestNumber)}${has(d.kit?.kitNo) ? ` — الحقيبة ${d.kit.kitNo}` : ''}`;
  const price = num(d.price);
  const workshop = await Workshop.create({
    title: String(d.title).trim(),
    description: has(d.description) ? d.description : null,
    presenter: String(d.presenter).trim(),
    assignedEmployeeId: doc.employeeId,
    startDate: d.startDate,
    endDate: has(d.endDate) ? d.endDate : null,
    startTime: has(d.startTime) ? d.startTime : null,
    endTime: has(d.endTime) ? d.endTime : null,
    totalHours: num(d.totalHours),
    content: has(d.content) ? d.content : null,
    objectives: has(d.objectives) ? d.objectives : null,
    photo,
    maxParticipants: int(d.maxParticipants),
    price: price == null ? 0 : price,
    status: 'upcoming',
    isActive: true,
    isPublic: d.isPublic !== false,
    isEducation: false,
    room: has(d.room) ? String(d.room).trim().slice(0, 120) : null,
    registrationEnabled: true,
    registrationForceOpen: false,
    notes: [origin, has(d.notes) ? String(d.notes).trim() : ''].filter(Boolean).join('\n'),
    color: '#1a56db',
    minAge: int(d.minAge),
    maxAge: int(d.maxAge),
    createdById: reviewer.id
  }, { transaction });
  await doc.update({ workshopId: workshop.workshopId }, { transaction });
};

const flow = createReviewFlow({
  Doc: WorkshopRequest,
  Version: WorkshopRequestVersion,
  File: WorkshopRequestFile,
  ID: 'requestId',
  NO: 'requestNumber',
  table: 'workshop_requests',
  lock: 'workshop-request-number',
  fmtNo: fmtWrNo,
  titleOf,
  fileIdsOf,
  validData: (data) => !!data.kit && typeof data.kit === 'object',
  readyToSend,
  checkSubmit,
  prepare,
  onApproved,
  meta: (doc) => ({ workshopId: doc.workshopId || null }),
  // A workshop request has no separate parts — ?part= is a 404.
  render: (o) => (o.part ? null : renderWorkshopRequestDocument({ ...o, request: o.doc })),
  zip: ({ data, byId, add, safeName }) => {
    const row = data.cover?.fileId && byId.get(data.cover.fileId);
    if (row) add(`صورة الغلاف/${safeName(row.name)}`, row.content);
  },
  w: {
    m: true,
    the: 'الطلب',
    the_: 'طلب الورشة',
    a: 'طلب ورشة',
    one: 'طلب',
    your: 'طلبك لورشة',
    tab: 'الطلبات',
    mailTag: 'طلبات الورش',
    logTag: 'workshop-requests',
    zipName: 'workshop-request',
    notReady: 'اختر الحقيبة المعتمدة وأكمل عنوان الورشة والمقدم وتاريخ البداية قبل الإرسال',
    approvedNote: '<p>أُنشئت الورشة في نظام الورش التدريبية بفاب لاب، وتظهر للتسجيل حسب إعداد الظهور في الطلب.</p>'
  }
});

module.exports = flow;
