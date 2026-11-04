// The execution plan as a document type for the shared review screens
// (KitList, KitReview, KitHistory) — see TrainingKits/kinds.js.
import { routesFor } from '../TrainingKits/kinds';
import { fmtPlanNo, normalize, diffData, has } from './planModel';
import { FILE_BLOCKS, NA, mediaStarted, volunteerStarted } from './planFiles';

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
  // Files uploaded to a target (older plans), labelled by target and column.
  filesOf: (s) => s.targets.flatMap((t, i) => FILE_BLOCKS
    .flatMap(b => (t[b.key]?.files || []).map(f => ({ ...f, label: `المستهدف ${i + 1} › ${b.label}` })))),
  // The ad images of each target's media form (older plans — a linked
  // design request carries its own images).
  imagesOf: (s) => s.targets.flatMap((t, i) => (t.media.status === NA || has(t.media.requestId) ? [] : t.media.form.images)
    .map(im => ({ ...im, id: im.fileId, code: `م${i + 1}`, caption: im.caption || `المستهدف ${i + 1} — صورة الإعلان` }))),
  // Each filled media / volunteer form prints on its own (the media form
  // only on older plans; a design request prints from its own screen).
  partsOf: (s) => s.targets.flatMap((t, i) => [
    t.media.status !== NA && !has(t.media.requestId) && mediaStarted(t.media.form) && { key: `media-${t.id}`, label: `المستهدف ${i + 1} › نموذج طلب تصميم الإعلان` },
    t.volunteer.status !== NA && volunteerStarted(t.volunteer.form) && { key: `volunteer-${t.id}`, label: `المستهدف ${i + 1} › الفرص التطوعية` }
  ].filter(Boolean))
};
