// The media design request as a "kind" for the shared list (KitList):
// number format, wording, its own status labels and card meta. Its review
// screen is MediaReview (the line differs from the kits' review flow).
import React from 'react';
import { fmtMediaNo, statusOf } from './mediaModel';

const BASE = '/media-requests';

// Per-role routes (`kit(id)` keeps the shared helpers' naming).
export const MEDIA_ROUTES = {
  employee: {
    list: `${BASE}/mine`,
    kit: (id) => `${BASE}/mine/${id}`,
    file: (fid) => `${BASE}/mine/files/${fid}`,
    doc: (id) => `${BASE}/mine/${id}/document`,
    upload: (id) => `${BASE}/mine/${id}/files`,
    dropFile: (id, fid) => `${BASE}/mine/${id}/files/${fid}`,
    submit: (id) => `${BASE}/mine/${id}/submit`,
    check: (id) => `${BASE}/mine/${id}/check`,
    fromPlan: `${BASE}/mine/from-plan`
  },
  designer: {
    list: `${BASE}/design/requests`,
    kit: (id) => `${BASE}/design/requests/${id}`,
    file: (fid) => `${BASE}/design/files/${fid}`,
    doc: (id) => `${BASE}/design/requests/${id}/document`,
    upload: (id) => `${BASE}/design/requests/${id}/files`,
    dropFile: (id, fid) => `${BASE}/design/requests/${id}/files/${fid}`,
    deliver: (id) => `${BASE}/design/requests/${id}/deliver`
  },
  pm: {
    list: `${BASE}/pm/requests`,
    kit: (id) => `${BASE}/pm/requests/${id}`,
    file: (fid) => `${BASE}/pm/files/${fid}`,
    doc: (id) => `${BASE}/pm/requests/${id}/document`,
    decide: (id) => `${BASE}/pm/requests/${id}/decide`
  },
  manager: {
    list: `${BASE}/admin/requests`,
    kit: (id) => `${BASE}/admin/requests/${id}`,
    file: (fid) => `${BASE}/admin/files/${fid}`,
    doc: (id) => `${BASE}/admin/requests/${id}/document`,
    decide: (id) => `${BASE}/admin/requests/${id}/decide`,
    remove: (id) => `${BASE}/admin/requests/${id}`
  }
};

export const MEDIA_KIND = {
  key: 'media',
  m: true, // الطلب — masculine
  routes: MEDIA_ROUTES,
  fmtNo: fmtMediaNo,
  icon: '📣',
  the: 'الطلب',
  a: 'طلب تصميم إعلان',
  untitled: 'طلب تصميم بلا عنوان',
  // KitList hooks: the line's own statuses, and the design version on cards.
  statusOf: (doc) => { const s = statusOf(doc); return { label: s.label, tone: s.tone }; },
  cardMeta: (doc) => (doc.designVersion > 0
    ? <span>🎨 التصميم الإصدار {doc.designVersion}</span>
    : <span>لم يُسلَّم تصميم بعد</span>)
};
