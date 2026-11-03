// Training kits (الحقائب التدريبية): the employee fills the kit template
// (with its attachment forms) and sends it through the shared review flow
// — project manager, then manager. See reviewFlow.js.
const { TrainingKit, TrainingKitVersion, TrainingKitFile } = require('../models');
const { renderKitDocument, renderKitPart, fmtKitNo } = require('../utils/trainingKitDoc');
const { createReviewFlow, pmStatus, requirePM, adminSettings, adminSaveSettings } = require('./reviewFlow');

const titleOf = (data) => String(data?.card?.name || '').trim().slice(0, 250) || null;

// Every fileId the kit data refers to — reference images, attachment
// files and anything the attachment forms hold (illustrations, …).
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
  Doc: TrainingKit,
  Version: TrainingKitVersion,
  File: TrainingKitFile,
  ID: 'kitId',
  NO: 'kitNumber',
  table: 'training_kits',
  lock: 'training-kit-number',
  fmtNo: fmtKitNo,
  titleOf,
  fileIdsOf,
  validData: (data) => !!data.card,
  readyToSend: (data) => !!titleOf(data),
  render: (o) => (o.part ? renderKitPart({ ...o, kit: o.doc }) : renderKitDocument({ ...o, kit: o.doc })),
  zip: ({ data, byId, add, safeName, renderPart }) => {
    (data.attachments || []).forEach(a => (a.files || []).forEach(f => {
      const row = byId.get(f.fileId);
      if (row) add(`المرفقات/${safeName(a.label)}/${safeName(row.name)}`, row.content);
    }));
    const outputs = data.outputs || [];
    (data.images || []).forEach(im => {
      const row = byId.get(im.fileId);
      if (!row) return;
      const i = outputs.findIndex(o => o.id === im.outputId);
      add(`الصور المرجعية/${i >= 0 ? `م${i + 1} - ` : ''}${safeName(row.name)}`, row.content);
    });
    // Illustrations added inside the scientific-content form, by day.
    (data.plan || []).forEach((p, i) => (data.forms?.content?.days?.[p.id]?.images || []).forEach(im => {
      const row = byId.get(im.fileId);
      if (row) add(`المرفقات/المحتوى العلمي التدريبي/الصور/اليوم ${i + 1} - ${safeName(row.name)}`, row.content);
    }));
    // Each attachment form as its own printable page (tests twice: the
    // participant's copy without answers and the trainer's key).
    (renderKitPart.partsOf ? renderKitPart.partsOf(data) : []).forEach(p => {
      const html = renderPart(p.key, p.audience || null);
      if (html) add(`المرفقات/${safeName(p.file)}.html`, html);
    });
  },
  w: {
    the: 'الحقيبة',
    the_: 'الحقيبة التدريبية',
    a: 'حقيبة تدريبية',
    one: 'حقيبة',
    your: 'حقيبتك',
    tab: 'الحقائب التدريبية',
    mailTag: 'الحقائب التدريبية',
    logTag: 'kits',
    zipName: 'kit',
    notReady: 'اكتب اسم البرنامج التدريبي قبل الإرسال',
    approvedNote: '<p>أصبحت الحقيبة متاحة في «الحقائب التدريبية» لاستخدامها في طلب ورشة لاحقًا.</p>'
  }
});

module.exports = { ...flow, pmStatus, requirePM, adminSettings, adminSaveSettings };
