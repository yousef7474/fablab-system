// Media design request (طلب تصميم إعلان — «المتطلبات الإعلامية») data model:
// the form (mediaForm.js) plus where the request came from, the line's
// statuses and steps, completeness, and the diff between two sent copies.
import { has, getPath, setPath, fmtDateTime } from '../../TrainingKits/kitModel';
import { makeMedia, normalizeMedia, mediaMissing, MEDIA_FIELDS } from './mediaForm';

export { getPath, setPath, has };

export const fmtMediaNo = (n) => (n == null || n === '' ? 'MR-—' : `MR-${String(n).padStart(3, '0')}`);
export const idOf = (p) => `mrf-${String(p).replace(/\./g, '-')}`;

const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

export const blankSource = () => ({ planId: '', planNo: '', planTitle: '', targetId: '', targetName: '', kitId: '', kitNo: '' });

/**
 * A new request's data. prefill: any form field (activity, implementer,
 * ageMin, ageMax, dateFrom, dateTo, beneficiaries, days, cost, axes, …)
 * plus source fields (planId, planNo, planTitle, targetId, targetName,
 * kitId, kitNo).
 */
export const newMediaData = (prefill = {}) => {
  const p = obj(prefill);
  const src = blankSource();
  Object.keys(src).forEach(k => { if (p[k] != null) src[k] = String(p[k]); });
  const form = makeMedia();
  Object.keys(form).forEach(k => { if (k !== 'images' && p[k] != null && p[k] !== '') form[k] = p[k]; });
  return { v: 1, form: normalizeMedia(form), source: src };
};

export const normalize = (raw) => {
  const d = obj(raw);
  return { v: 1, ...d, form: normalizeMedia(d.form), source: { ...blankSource(), ...obj(d.source) } };
};

// Completion on the same scale as the server (14 checks of the form).
const CHECKS = 14;
export const analyze = (data) => {
  const miss = mediaMissing(data.form, 'form');
  const issues = miss.map(m => ({ text: `أكمل «${m.label}»`, target: idOf(m.path) }));
  return { issues, pct: Math.floor(((CHECKS - Math.min(CHECKS, miss.length)) / CHECKS) * 100) };
};

// ─────────────── The line ───────────────

export const EDITABLE = ['draft', 'returned_employee'];

// Status → label, tone (KitList pill) and who has the request now.
export const STATUS = {
  draft: { label: 'مسودة', tone: 'muted', holder: 'منفذ الطلب' },
  design: { label: 'لدى فريق التصميم', tone: 'cyan', holder: 'فريق التصميم' },
  employee_check: { label: 'بانتظار مراجعة منفذ الطلب', tone: 'amber', holder: 'منفذ الطلب' },
  pm_review: { label: 'لدى مسؤول إدارة المشاريع', tone: 'amber', holder: 'مسؤول إدارة المشاريع' },
  manager_review: { label: 'لدى المدير للاعتماد', tone: 'cyan', holder: 'المدير' },
  returned_employee: { label: 'معاد لمنفذ الطلب للتعديل', tone: 'red', holder: 'منفذ الطلب' },
  approved: { label: 'معتمد', tone: 'mint', holder: '' }
};
export const statusOf = (doc) => STATUS[doc?.status] || STATUS.draft;

// The stages, in order — the progress strip in the review screen.
export const STAGES = [
  { key: 'employee', label: 'منفذ الطلب', icon: '✍', statuses: ['draft', 'returned_employee'] },
  { key: 'designer', label: 'فريق التصميم', icon: '🎨', statuses: ['design'] },
  { key: 'check', label: 'مراجعة منفذ الطلب', icon: '👁', statuses: ['employee_check'] },
  { key: 'pm', label: 'مسؤول إدارة المشاريع', icon: '📋', statuses: ['pm_review'] },
  { key: 'manager', label: 'المدير', icon: '✓', statuses: ['manager_review'] }
];
export const stageIndex = (status) => (status === 'approved' ? STAGES.length : STAGES.findIndex(s => s.statuses.includes(status)));

export const ROLE_LABEL = { employee: 'منفذ الطلب', designer: 'فريق التصميم', pm: 'مسؤول إدارة المشاريع', manager: 'المدير' };

// Each step of the line — label, icon and tone.
export const eventInfo = (e) => {
  switch (e.type) {
    case 'submitted': return { label: 'أرسل الطلب لفريق التصميم', icon: '📨', tone: 'cyan' };
    case 'resubmitted': return { label: 'عدّل الطلب وأعاد إرساله لفريق التصميم', icon: '✎', tone: 'cyan' };
    case 'design_delivered': return { label: `سلّم التصميم — الإصدار ${e.designVersion}`, icon: '🎨', tone: 'violet' };
    case 'employee_approved': return { label: `اعتمد التصميم (الإصدار ${e.designVersion}) وأرسله لمسؤول إدارة المشاريع`, icon: '✓', tone: 'mint' };
    case 'employee_rejected': return { label: `رفض التصميم (الإصدار ${e.designVersion}) وأعاده للمصمم`, icon: '↩', tone: 'red' };
    case 'pm_approved': return { label: 'اعتماد مسؤول إدارة المشاريع — أُرسل للمدير', icon: '✓', tone: 'mint' };
    case 'manager_approved': return { label: 'الاعتماد النهائي من المدير', icon: '★', tone: 'mint' };
    case 'pm_returned':
    case 'manager_returned':
      return { label: `${e.type === 'pm_returned' ? 'إعادة من مسؤول إدارة المشاريع' : 'إعادة من المدير'} ${e.returnTo === 'employee' ? 'إلى منفذ الطلب لتعديل البيانات' : 'إلى المصمم لتعديل التصميم'}`, icon: '↩', tone: 'red' };
    default: return { label: e.type, icon: '•', tone: 'muted' };
  }
};

export const deliveries = (events = []) => events.filter(e => e.type === 'design_delivered');
export const currentDelivery = (doc) => deliveries(doc?.events).filter(e => e.designVersion === doc?.designVersion).pop() || null;
// The latest return note addressed to someone (designer / employee).
export const lastReturn = (events = [], to) => [...events].reverse().find(e => (to === 'designer'
  ? ['employee_rejected', 'pm_returned', 'manager_returned'].includes(e.type) && (e.type === 'employee_rejected' || e.returnTo === 'designer')
  : ['pm_returned', 'manager_returned'].includes(e.type) && e.returnTo === 'employee')) || null;

export { fmtDateTime };

// ─────────────── Changes between two sent copies of the form ───────────────

const short = (v) => (Array.isArray(v) ? v.join('، ') : String(v == null ? '' : v));
export const flatten = (raw) => {
  const f = normalizeMedia(obj(raw).form || raw);
  const out = MEDIA_FIELDS.map(([k, l]) => [k, l, short(f[k])]);
  f.axes.forEach((a, i) => out.push([`axis.${a.id}`, `المحور ${i + 1}`, `${a.title || ''}${has(a.desc) ? ` — ${a.desc}` : ''}`.trim()]));
  out.push(['images', 'صور الإعلان', f.images.map(im => im.caption || im.name).join('، ')]);
  return out;
};
export const diffData = (prev, next) => {
  const a = new Map(flatten(prev).map(([k, l, v]) => [k, { l, v }]));
  const b = flatten(next);
  const seen = new Set();
  const changes = [];
  b.forEach(([k, l, v]) => {
    seen.add(k);
    const old = a.get(k);
    if (!old) { if (v.trim()) changes.push({ label: l, before: '', after: v, kind: 'added' }); return; }
    if (old.v !== v) changes.push({ label: l, before: old.v, after: v, kind: old.v.trim() ? (v.trim() ? 'changed' : 'removed') : 'added' });
  });
  a.forEach((o, k) => { if (!seen.has(k) && o.v.trim()) changes.push({ label: o.l, before: o.v, after: '', kind: 'removed' }); });
  return changes;
};
