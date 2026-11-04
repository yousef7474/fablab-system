// The financial request as a document type for the shared review screens
// (KitList, KitReview, KitHistory) — see TrainingKits/kinds.js.
import { routesFor } from '../../TrainingKits/kinds';
import { fmtReqNo, normalize, diffData } from './frModel';

export const FR_KIND = {
  key: 'finance',
  m: true, // طلب — masculine
  routes: routesFor('/financial-requests', 'requests'),
  fmtNo: fmtReqNo,
  icon: '💰',
  the: 'طلب الصرف',
  a: 'طلب صرف مالي',
  untitled: 'طلب صرف بلا عنوان',
  docTab: '📄 طلب الصرف',
  archive: '«طلبات الصرف المعتمدة»',
  approvedMine: ' يطبعه المدير ويوقّعه ثم يُحال للصرف.',
  normalize,
  diff: diffData,
  // Quotations and other documents.
  filesOf: (s) => s.quotes.map(q => ({ ...q, label: 'عروض الأسعار والمستندات' })),
  imagesOf: () => [],
  partsOf: () => []
};
