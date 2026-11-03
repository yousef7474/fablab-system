// The execution plan as a document type for the shared review screens
// (KitList, KitReview, KitHistory) — see TrainingKits/kinds.js.
import { routesFor } from '../TrainingKits/kinds';
import { fmtPlanNo, normalize, diffData, BLOCKS, VOLUNTEER_LABEL } from './planModel';

export const PLAN_KIND = {
  key: 'plan',
  routes: routesFor('/execution-plans', 'plans'),
  fmtNo: fmtPlanNo,
  icon: '🗓',
  the: 'الخطة',
  a: 'خطة تنفيذية',
  untitled: 'خطة تنفيذية بلا فترة',
  docTab: '📄 الخطة',
  archive: '«الخطط التنفيذية المعتمدة»',
  approvedMine: ' تبقى هنا للرجوع إليها، ونسخة منها في أرشيف المدير.',
  normalize,
  diff: diffData,
  // Each target's attached files, labelled by target and column.
  filesOf: (s) => s.targets.flatMap((t, i) => [...BLOCKS, { key: 'volunteer', label: VOLUNTEER_LABEL }]
    .flatMap(b => (t[b.key]?.files || []).map(f => ({ ...f, label: `المستهدف ${i + 1} › ${b.label}` })))),
  imagesOf: () => [],
  partsOf: () => []
};
