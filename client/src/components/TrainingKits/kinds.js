// What the shared review screens (KitList, KitReview, KitHistory) need to
// know about a document type: its routes, number format, wording, how to
// read its data, and which files / printable parts it carries. Training
// kits are defined here; execution plans add their own kind the same way.
import { fmtKitNo, normalize, diffData } from './kitModel';
import { formParts } from './kitForms';

// /<base>/mine/:id, /<base>/pm/<items>/:id, /<base>/admin/<items>/:id
export const routesFor = (base, items) => ({
  mine: {
    list: `${base}/mine`,
    kit: (id) => `${base}/mine/${id}`,
    file: (fid) => `${base}/mine/files/${fid}`,
    doc: (id) => `${base}/mine/${id}/document`,
    zip: (id) => `${base}/mine/${id}/zip`,
    upload: (id) => `${base}/mine/${id}/files`,
    dropFile: (id, fid) => `${base}/mine/${id}/files/${fid}`,
    submit: (id) => `${base}/mine/${id}/submit`
  },
  pm: {
    list: `${base}/pm/${items}`,
    kit: (id) => `${base}/pm/${items}/${id}`,
    file: (fid) => `${base}/pm/files/${fid}`,
    doc: (id) => `${base}/pm/${items}/${id}/document`,
    zip: (id) => `${base}/pm/${items}/${id}/zip`,
    decide: (id) => `${base}/pm/${items}/${id}/decide`
  },
  admin: {
    list: `${base}/admin/${items}`,
    kit: (id) => `${base}/admin/${items}/${id}`,
    file: (fid) => `${base}/admin/files/${fid}`,
    doc: (id) => `${base}/admin/${items}/${id}/document`,
    zip: (id) => `${base}/admin/${items}/${id}/zip`,
    decide: (id) => `${base}/admin/${items}/${id}/decide`,
    remove: (id) => `${base}/admin/${items}/${id}`
  }
});

export const idOfDoc = (d) => d?.id || d?.kitId || d?.planId;
export const numberOfDoc = (d) => (d?.number != null ? d.number : d?.kitNumber != null ? d.kitNumber : d?.planNumber);

export const KIT_KIND = {
  key: 'kit',
  routes: routesFor('/training-kits', 'kits'),
  fmtNo: fmtKitNo,
  icon: '🎒',
  the: 'الحقيبة',
  a: 'حقيبة تدريبية',
  untitled: 'برنامج تدريبي بلا اسم',
  docTab: '📄 الحقيبة',
  archive: '«الحقائب المعتمدة»',
  approvedMine: ' ستتمكن قريبًا من اختيارها عند طلب ورشة جديدة.',
  normalize,
  diff: diffData,
  // Attachment files: [{ fileId, name, size, label }]
  filesOf: (s) => s.attachments.flatMap(a => a.files.map(f => ({ ...f, label: a.label }))),
  // Reference images: [{ id, fileId, name, caption, code }]
  // plus the illustrations added inside the scientific-content form.
  imagesOf: (s) => [
    ...s.images.map(im => {
      const i = s.outputs.findIndex(o => o.id === im.outputId);
      return { ...im, code: i < 0 ? '' : `م${i + 1}` };
    }),
    ...s.plan.flatMap((d, i) => (s.forms?.content?.days?.[d.id]?.images || []).map(im => ({ ...im, code: `اليوم ${i + 1}` })))
  ],
  // Printable parts (the attachment forms): [{ key, label, audiences? }]
  partsOf: formParts
};
