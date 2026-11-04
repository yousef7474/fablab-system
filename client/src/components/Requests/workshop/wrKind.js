// The workshop request as a document type for the shared review screens
// (KitList, KitReview, KitHistory) — see TrainingKits/kinds.js.
import { routesFor } from '../../TrainingKits/kinds';
import { fmtWrNo, normalize, diffData } from './wrModel';

export const WR_KIND = {
  key: 'workshop-request',
  m: true, // الطلب — masculine
  routes: routesFor('/workshop-requests', 'requests'),
  fmtNo: fmtWrNo,
  icon: '🛠',
  the: 'الطلب',
  a: 'طلب ورشة',
  untitled: 'طلب ورشة بلا عنوان',
  docTab: '📄 الطلب',
  archive: '«طلبات الورش المعتمدة» وتُنشأ الورشة في نظام الورش',
  approvedMine: ' أُنشئت الورشة في نظام الورش التدريبية.',
  normalize,
  diff: diffData,
  filesOf: () => [],
  // The cover image.
  imagesOf: (s) => (s.cover ? [{ id: s.cover.fileId, fileId: s.cover.fileId, name: s.cover.name, caption: 'صورة غلاف الورشة', code: '' }] : []),
  partsOf: () => []
};
