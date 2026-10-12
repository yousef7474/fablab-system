import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';
import {
  listOf, errMsg, fmtDate, fmtDateTime, fmtSize, fileUrl, StatusPill, SmModal, FieldGrid, EmptyState
} from './SiteShared';

const APP_STATUSES = [
  { v: 'new', ar: 'جديد', en: 'New' },
  { v: 'reviewing', ar: 'قيد المراجعة', en: 'Reviewing' },
  { v: 'accepted', ar: 'مقبول', en: 'Accepted' },
  { v: 'rejected', ar: 'مرفوض', en: 'Rejected' }
];

const StatusChips = ({ isRTL, value, onChange, items = APP_STATUSES }) => (
  <div className="sm-chips">
    {[{ v: '', ar: 'الكل', en: 'All' }, ...items].map(s => (
      <button key={s.v || 'all'} type="button" className={`sm-chip ${value === s.v ? 'on' : ''}`} onClick={() => onChange(s.v)}>
        {isRTL ? s.ar : s.en}
      </button>
    ))}
  </div>
);

// Side drawer for an application's details + review.
const Drawer = ({ isRTL, title, subtitle, onClose, children, footer }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sm-drawer-backdrop" onClick={onClose}>
      <motion.aside
        className="sm-drawer"
        dir={isRTL ? 'rtl' : 'ltr'}
        onClick={e => e.stopPropagation()}
        initial={{ x: isRTL ? -40 : 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: isRTL ? -40 : 40, opacity: 0 }}
        role="dialog"
        aria-modal="true"
      >
        <div className="sm-drawer-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <div className="sm-drawer-sub">{subtitle}</div>}
          </div>
          <button type="button" className="wsr-close" onClick={onClose} aria-label="✕">✕</button>
        </div>
        <div className="sm-drawer-body">{children}</div>
        {footer && <div className="sm-drawer-foot">{footer}</div>}
      </motion.aside>
    </div>
  );
};

const DL = ({ items }) => (
  <dl className="sm-dl">
    {items.filter(Boolean).map(([k, v, opts = {}]) => (
      <div key={k} className={opts.full ? 'full' : ''}>
        <dt>{k}</dt>
        <dd dir={opts.dir} className={opts.pre ? 'pre' : ''}>{v === undefined || v === null || v === '' ? '—' : v}</dd>
      </div>
    ))}
  </dl>
);

const ReviewBox = ({ isRTL, status, note, onStatus, onNote }) => (
  <div className="sm-review">
    <div className="sm-review-title">{isRTL ? 'المراجعة' : 'Review'}</div>
    <div className="sm-chips">
      {APP_STATUSES.map(s => (
        <button key={s.v} type="button" className={`sm-chip st-${s.v} ${status === s.v ? 'on' : ''}`} onClick={() => onStatus(s.v)}>
          {isRTL ? s.ar : s.en}
        </button>
      ))}
    </div>
    <textarea rows={3} value={note || ''} onChange={e => onNote(e.target.value)} placeholder={isRTL ? 'ملاحظة داخلية (لا تظهر للمتقدم)' : 'Internal note (not shown to the applicant)'} />
  </div>
);

// ───────────── طلبات المواهب ─────────────
export const SiteTalentSection = ({ isRTL, onChanged }) => {
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null); // row with draft status/note
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/site-admin/talent', { params: status ? { status } : {} });
      setRows(listOf(data));
    } catch (err) { toast.error(errMsg(err, isRTL, 'تعذّر تحميل الطلبات', 'Could not load applications')); }
    finally { setLoading(false); }
  }, [status, isRTL]);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(r => [r.fullName, r.phone, r.email, r.nationality].some(v => String(v || '').toLowerCase().includes(t)));
  }, [rows, q]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/site-admin/talent/${open.id}`, { status: open.draftStatus, adminNote: open.draftNote });
      toast.success(isRTL ? 'تم حفظ المراجعة' : 'Review saved');
      setOpen(null); load(); onChanged && onChanged();
    } catch (err) { toast.error(errMsg(err, isRTL, 'تعذّر الحفظ', 'Could not save')); }
    finally { setSaving(false); }
  };

  const remove = async (row) => {
    if (!window.confirm(isRTL ? `حذف طلب «${row.fullName}» وملفاته؟` : `Delete ${row.fullName}'s application and files?`)) return;
    try { await api.delete(`/site-admin/talent/${row.id}`); toast.success(isRTL ? 'تم الحذف' : 'Deleted'); setOpen(null); load(); onChanged && onChanged(); }
    catch (err) { toast.error(errMsg(err, isRTL)); }
  };

  const phoneOf = (r) => [r.countryCode, r.phone].filter(Boolean).join(' ');

  return (
    <div className="sm-section">
      <div className="sm-toolbar">
        <h3>{isRTL ? 'طلبات «أنا موهوب»' : '“I am talented” applications'} <span className="sm-count">{shown.length}</span></h3>
        <div className="sm-toolbar-actions">
          <StatusChips isRTL={isRTL} value={status} onChange={setStatus} />
          <input className="sm-search" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={isRTL ? 'بحث بالاسم أو الجوال…' : 'Search name / phone…'} />
        </div>
      </div>
      {loading ? <div className="sm-loading">{isRTL ? 'جارٍ التحميل…' : 'Loading…'}</div>
        : shown.length === 0 ? <EmptyState icon="🎨" text={isRTL ? 'لا توجد طلبات هنا. تصل الطلبات من صفحة «أنا موهوب» على الموقع.' : 'No applications here. They arrive from the “I am talented” page.'} />
        : (
          <div className="sm-table-wrap">
            <table className="sm-table">
              <thead><tr>
                <th>{isRTL ? 'الاسم' : 'Name'}</th>
                <th>{isRTL ? 'العمر' : 'Age'}</th>
                <th>{isRTL ? 'المرحلة الدراسية' : 'Education'}</th>
                <th>{isRTL ? 'الجوال' : 'Phone'}</th>
                <th>{isRTL ? 'الملفات' : 'Files'}</th>
                <th>{isRTL ? 'التاريخ' : 'Date'}</th>
                <th>{isRTL ? 'الحالة' : 'Status'}</th>
              </tr></thead>
              <tbody>
                {shown.map(r => (
                  <tr key={r.id} onClick={() => setOpen({ ...r, draftStatus: r.status, draftNote: r.adminNote || '' })} className={r.status === 'new' ? 'is-new' : ''}>
                    <td className="strong">{r.fullName}</td>
                    <td>{r.age || '—'}</td>
                    <td>{r.educationLevel || '—'}</td>
                    <td dir="ltr">{phoneOf(r) || '—'}</td>
                    <td>{(r.files || []).length ? `📎 ${(r.files || []).length}` : '—'}</td>
                    <td>{fmtDate(r.createdAt, isRTL)}</td>
                    <td><StatusPill status={r.status} isRTL={isRTL} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      <AnimatePresence>
        {open && (
          <Drawer
            isRTL={isRTL}
            title={open.fullName}
            subtitle={`${isRTL ? 'أُرسل' : 'Sent'} ${fmtDateTime(open.createdAt, isRTL)}`}
            onClose={() => setOpen(null)}
            footer={<>
              <button type="button" className="sm-btn ghost danger" onClick={() => remove(open)}>🗑 {isRTL ? 'حذف' : 'Delete'}</button>
              <button type="button" className="sm-btn primary" onClick={save} disabled={saving}>{saving ? (isRTL ? 'جارٍ الحفظ…' : 'Saving…') : (isRTL ? 'حفظ المراجعة' : 'Save review')}</button>
            </>}
          >
            <DL items={[
              [isRTL ? 'العمر' : 'Age', open.age],
              [isRTL ? 'المرحلة الدراسية / المؤهل' : 'Education level', open.educationLevel],
              [isRTL ? 'الجنسية' : 'Nationality', open.nationality],
              [isRTL ? 'الجوال' : 'Phone', phoneOf(open) ? <a href={`tel:${phoneOf(open).replace(/\s+/g, '')}`}>{phoneOf(open)}</a> : '', { dir: 'ltr' }],
              [isRTL ? 'البريد' : 'Email', open.email ? <a href={`mailto:${open.email}`}>{open.email}</a> : '', { dir: 'ltr' }],
              [isRTL ? 'نبذة عن الموهبة' : 'About the talent', open.talentDescription, { full: true, pre: true }],
              [isRTL ? 'أهم المنجزات' : 'Achievements', open.achievements, { full: true, pre: true }]
            ]} />
            <div className="sm-files">
              <div className="sm-review-title">{isRTL ? 'الملفات المرفقة' : 'Attached files'}</div>
              {(open.files || []).length === 0 ? <div className="sm-muted">{isRTL ? 'لا توجد ملفات' : 'No files'}</div>
                : (open.files || []).map((f, i) => (
                  <a key={i} className="sm-file" href={fileUrl(`/site-admin/talent/${open.id}/files/${i}`)} target="_blank" rel="noopener noreferrer">
                    <span>📎 {f.fileName || `${isRTL ? 'ملف' : 'File'} ${i + 1}`}</span>
                    <small dir="ltr">{fmtSize(f.fileSize)}</small>
                  </a>
                ))}
            </div>
            <ReviewBox isRTL={isRTL} status={open.draftStatus} note={open.draftNote}
              onStatus={s => setOpen(o => ({ ...o, draftStatus: s }))} onNote={n => setOpen(o => ({ ...o, draftNote: n }))} />
          </Drawer>
        )}
      </AnimatePresence>
    </div>
  );
};

// ───────────── التدريب التعاوني ─────────────
const OPP_FIELDS = [
  { key: 'title', ar: 'اسم البرنامج (عربي)', en: 'Program (Arabic)', required: true, full: true, dir: 'rtl' },
  { key: 'titleEn', ar: 'اسم البرنامج (إنجليزي)', en: 'Program (English)', full: true, dir: 'ltr' },
  { key: 'department', ar: 'القسم (عربي)', en: 'Department (Arabic)', dir: 'rtl' },
  { key: 'departmentEn', ar: 'القسم (إنجليزي)', en: 'Department (English)', dir: 'ltr' },
  { key: 'description', ar: 'الوصف (عربي)', en: 'Description (Arabic)', type: 'textarea', full: true, dir: 'rtl' },
  { key: 'descriptionEn', ar: 'الوصف (إنجليزي)', en: 'Description (English)', type: 'textarea', full: true, dir: 'ltr' },
  { key: 'requirements', ar: 'المتطلبات (عربي)', en: 'Requirements (Arabic)', type: 'textarea', full: true, dir: 'rtl', rows: 3 },
  { key: 'requirementsEn', ar: 'المتطلبات (إنجليزي)', en: 'Requirements (English)', type: 'textarea', full: true, dir: 'ltr', rows: 3 },
  { key: 'duration', ar: 'المدة (عربي)', en: 'Duration (Arabic)', dir: 'rtl' },
  { key: 'durationEn', ar: 'المدة (إنجليزي)', en: 'Duration (English)', dir: 'ltr' },
  { key: 'seats', ar: 'عدد المقاعد', en: 'Seats', type: 'number', min: 0 },
  { key: 'deadline', ar: 'آخر موعد للتقديم', en: 'Application deadline', type: 'date' },
  { key: 'sortOrder', ar: 'ترتيب العرض', en: 'Sort order', type: 'number' },
  { key: 'isOpen', ar: 'مفتوح', en: 'Open', type: 'checkbox', hintAr: 'التقديم مفتوح', hintEn: 'Accepting applications' },
  { key: 'isPublished', ar: 'منشور', en: 'Published', type: 'checkbox', hintAr: 'يظهر على الموقع', hintEn: 'Shown on the site' }
];
const OPP_DEFAULTS = { title: '', titleEn: '', department: '', departmentEn: '', description: '', descriptionEn: '', requirements: '', requirementsEn: '', duration: '', durationEn: '', seats: '', deadline: '', sortOrder: 0, isOpen: true, isPublished: true };

export const SiteInternshipSection = ({ isRTL, onChanged }) => {
  const [view, setView] = useState('applications');
  const [opps, setOpps] = useState([]);
  const [apps, setApps] = useState([]);
  const [loadingOpps, setLoadingOpps] = useState(true);
  const [loadingApps, setLoadingApps] = useState(true);
  const [oppFilter, setOppFilter] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [open, setOpen] = useState(null);

  const loadOpps = useCallback(async () => {
    setLoadingOpps(true);
    try { const { data } = await api.get('/site-admin/internships'); setOpps(listOf(data)); }
    catch (err) { toast.error(errMsg(err, isRTL, 'تعذّر تحميل البرامج', 'Could not load programs')); }
    finally { setLoadingOpps(false); }
  }, [isRTL]);
  const loadApps = useCallback(async () => {
    setLoadingApps(true);
    try {
      const params = {};
      if (oppFilter) params.opportunityId = oppFilter;
      if (status) params.status = status;
      const { data } = await api.get('/site-admin/internship-applications', { params });
      setApps(listOf(data));
    } catch (err) { toast.error(errMsg(err, isRTL, 'تعذّر تحميل الطلبات', 'Could not load applications')); }
    finally { setLoadingApps(false); }
  }, [oppFilter, status, isRTL]);
  useEffect(() => { loadOpps(); }, [loadOpps]);
  useEffect(() => { loadApps(); }, [loadApps]);

  const oppTitle = useCallback((a) => {
    const o = a.opportunity || opps.find(x => x.id === a.opportunityId);
    if (a.opportunityTitle) return a.opportunityTitle;
    return o ? (isRTL ? (o.title || o.titleEn) : (o.titleEn || o.title)) : '—';
  }, [opps, isRTL]);

  const saveOpp = async () => {
    const f = editing.form;
    if (!String(f.title || '').trim() && !String(f.titleEn || '').trim()) { setErrors({ title: isRTL ? 'اكتب اسم البرنامج' : 'Enter the program name' }); return; }
    setErrors({});
    setSaving(true);
    try {
      const body = { ...f, seats: f.seats === '' ? null : Number(f.seats), sortOrder: Number(f.sortOrder) || 0, deadline: f.deadline || null };
      if (editing.id) await api.put(`/site-admin/internships/${editing.id}`, body);
      else await api.post('/site-admin/internships', body);
      toast.success(isRTL ? 'تم الحفظ' : 'Saved');
      setEditing(null); loadOpps();
    } catch (err) { toast.error(errMsg(err, isRTL, 'تعذّر الحفظ', 'Could not save')); }
    finally { setSaving(false); }
  };
  const removeOpp = async (o) => {
    if (!window.confirm(isRTL ? `حذف برنامج «${o.title}»؟` : `Delete program “${o.titleEn || o.title}”?`)) return;
    try { await api.delete(`/site-admin/internships/${o.id}`); toast.success(isRTL ? 'تم الحذف' : 'Deleted'); loadOpps(); }
    catch (err) { toast.error(errMsg(err, isRTL)); }
  };
  const toggleOpp = async (o, key) => {
    try { await api.put(`/site-admin/internships/${o.id}`, { [key]: !o[key] }); setOpps(list => list.map(x => (x.id === o.id ? { ...x, [key]: !o[key] } : x))); }
    catch (err) { toast.error(errMsg(err, isRTL)); }
  };

  const saveApp = async () => {
    setSaving(true);
    try {
      await api.put(`/site-admin/internship-applications/${open.id}`, { status: open.draftStatus, adminNote: open.draftNote });
      toast.success(isRTL ? 'تم حفظ المراجعة' : 'Review saved');
      setOpen(null); loadApps(); onChanged && onChanged();
    } catch (err) { toast.error(errMsg(err, isRTL, 'تعذّر الحفظ', 'Could not save')); }
    finally { setSaving(false); }
  };
  const removeApp = async (a) => {
    if (!window.confirm(isRTL ? `حذف طلب «${a.fullName}» وملفاته؟` : `Delete ${a.fullName}'s application?`)) return;
    try { await api.delete(`/site-admin/internship-applications/${a.id}`); toast.success(isRTL ? 'تم الحذف' : 'Deleted'); setOpen(null); loadApps(); onChanged && onChanged(); }
    catch (err) { toast.error(errMsg(err, isRTL)); }
  };

  return (
    <div className="sm-section">
      <div className="sm-toolbar">
        <div className="sm-seg">
          <button type="button" className={view === 'applications' ? 'on' : ''} onClick={() => setView('applications')}>📥 {isRTL ? 'الطلبات' : 'Applications'}</button>
          <button type="button" className={view === 'programs' ? 'on' : ''} onClick={() => setView('programs')}>🎓 {isRTL ? 'البرامج المتاحة' : 'Programs'} <span className="sm-count">{opps.length}</span></button>
        </div>
        {view === 'programs' && (
          <button type="button" className="sm-btn primary" onClick={() => { setErrors({}); setEditing({ form: { ...OPP_DEFAULTS } }); }}>＋ {isRTL ? 'إضافة برنامج' : 'Add program'}</button>
        )}
      </div>

      {view === 'programs' ? (
        loadingOpps ? <div className="sm-loading">{isRTL ? 'جارٍ التحميل…' : 'Loading…'}</div>
          : opps.length === 0 ? <EmptyState icon="🎓" text={isRTL ? 'لا توجد برامج تدريب بعد — أضف برنامجاً ليظهر في صفحة التدريب التعاوني.' : 'No programs yet — add one to show it on the internship page.'} />
          : (
            <div className="sm-opps">
              {opps.map(o => (
                <div key={o.id} className={`sm-opp ${o.isPublished === false ? 'is-hidden' : ''}`}>
                  <div className="sm-opp-main">
                    <div className="sm-card-title">{isRTL ? (o.title || o.titleEn) : (o.titleEn || o.title)}</div>
                    <div className="sm-card-sub">
                      {[isRTL ? o.department : (o.departmentEn || o.department), isRTL ? o.duration : (o.durationEn || o.duration),
                        o.seats ? (isRTL ? `${o.seats} مقاعد` : `${o.seats} seats`) : null,
                        o.deadline ? `${isRTL ? 'آخر موعد' : 'Deadline'} ${fmtDate(o.deadline, isRTL)}` : null].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="sm-card-actions">
                    <label className="sm-switch"><input type="checkbox" checked={!!o.isOpen} onChange={() => toggleOpp(o, 'isOpen')} /><span>{o.isOpen ? (isRTL ? 'مفتوح' : 'Open') : (isRTL ? 'مغلق' : 'Closed')}</span></label>
                    <label className="sm-switch"><input type="checkbox" checked={o.isPublished !== false} onChange={() => toggleOpp(o, 'isPublished')} /><span>{o.isPublished !== false ? (isRTL ? 'منشور' : 'Live') : (isRTL ? 'مخفي' : 'Hidden')}</span></label>
                    <button type="button" className="sm-icon-btn" title={isRTL ? 'تعديل' : 'Edit'} onClick={() => {
                      const form = {}; OPP_FIELDS.forEach(f => { form[f.key] = o[f.key] ?? (f.type === 'checkbox' ? false : ''); });
                      if (form.deadline) form.deadline = String(form.deadline).slice(0, 10);
                      setErrors({}); setEditing({ id: o.id, form });
                    }}>✎</button>
                    <button type="button" className="sm-icon-btn danger" title={isRTL ? 'حذف' : 'Delete'} onClick={() => removeOpp(o)}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )
      ) : (
        <>
          <div className="sm-filters">
            <select value={oppFilter} onChange={e => setOppFilter(e.target.value)} className="sm-select">
              <option value="">{isRTL ? 'كل البرامج' : 'All programs'}</option>
              {opps.map(o => <option key={o.id} value={o.id}>{isRTL ? (o.title || o.titleEn) : (o.titleEn || o.title)}</option>)}
            </select>
            <StatusChips isRTL={isRTL} value={status} onChange={setStatus} />
          </div>
          {loadingApps ? <div className="sm-loading">{isRTL ? 'جارٍ التحميل…' : 'Loading…'}</div>
            : apps.length === 0 ? <EmptyState icon="📥" text={isRTL ? 'لا توجد طلبات تدريب هنا.' : 'No internship applications here.'} />
            : (
              <div className="sm-table-wrap">
                <table className="sm-table">
                  <thead><tr>
                    <th>{isRTL ? 'الاسم' : 'Name'}</th>
                    <th>{isRTL ? 'البرنامج' : 'Program'}</th>
                    <th>{isRTL ? 'الجامعة / التخصص' : 'University / major'}</th>
                    <th>{isRTL ? 'المعدل' : 'GPA'}</th>
                    <th>{isRTL ? 'التاريخ' : 'Date'}</th>
                    <th>{isRTL ? 'الحالة' : 'Status'}</th>
                  </tr></thead>
                  <tbody>
                    {apps.map(a => (
                      <tr key={a.id} className={a.status === 'new' ? 'is-new' : ''} onClick={() => setOpen({ ...a, draftStatus: a.status, draftNote: a.adminNote || '' })}>
                        <td className="strong">{a.fullName}</td>
                        <td>{oppTitle(a)}</td>
                        <td>{[a.university, a.major].filter(Boolean).join(' · ') || '—'}</td>
                        <td dir="ltr">{a.gpa ?? '—'}</td>
                        <td>{fmtDate(a.createdAt, isRTL)}</td>
                        <td><StatusPill status={a.status} isRTL={isRTL} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </>
      )}

      {editing && (
        <SmModal wide busy={saving} kicker={isRTL ? 'التدريب التعاوني' : 'Internship'} title={editing.id ? (isRTL ? 'تعديل البرنامج' : 'Edit program') : (isRTL ? 'برنامج تدريب جديد' : 'New program')}
          onClose={() => setEditing(null)}
          footer={<>
            <button type="button" className="wsr-btn ghost" onClick={() => setEditing(null)} disabled={saving}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
            <button type="button" className="wsr-btn" onClick={saveOpp} disabled={saving}>{saving ? (isRTL ? 'جارٍ الحفظ…' : 'Saving…') : (isRTL ? 'حفظ' : 'Save')}</button>
          </>}>
          <FieldGrid fields={OPP_FIELDS} value={editing.form} isRTL={isRTL} errors={errors} onChange={form => setEditing(ed => ({ ...ed, form }))} />
        </SmModal>
      )}

      <AnimatePresence>
        {open && (
          <Drawer isRTL={isRTL} title={open.fullName} subtitle={`${oppTitle(open)} · ${fmtDateTime(open.createdAt, isRTL)}`} onClose={() => setOpen(null)}
            footer={<>
              <button type="button" className="sm-btn ghost danger" onClick={() => removeApp(open)}>🗑 {isRTL ? 'حذف' : 'Delete'}</button>
              <button type="button" className="sm-btn primary" onClick={saveApp} disabled={saving}>{saving ? (isRTL ? 'جارٍ الحفظ…' : 'Saving…') : (isRTL ? 'حفظ المراجعة' : 'Save review')}</button>
            </>}>
            <DL items={[
              [isRTL ? 'البريد' : 'Email', open.email ? <a href={`mailto:${open.email}`}>{open.email}</a> : '', { dir: 'ltr' }],
              [isRTL ? 'الجوال' : 'Phone', open.phone ? <a href={`tel:${open.phone}`}>{open.phone}</a> : '', { dir: 'ltr' }],
              [isRTL ? 'الجامعة' : 'University', open.university],
              [isRTL ? 'التخصص' : 'Major', open.major],
              [isRTL ? 'المعدل' : 'GPA', open.gpa, { dir: 'ltr' }],
              [isRTL ? 'سبب الرغبة في الانضمام' : 'Motivation', open.motivation, { full: true, pre: true }],
              [isRTL ? 'الخبرات السابقة' : 'Experience', open.experience, { full: true, pre: true }]
            ]} />
            <div className="sm-files">
              <div className="sm-review-title">{isRTL ? 'المرفقات' : 'Attachments'}</div>
              <a className="sm-file" href={fileUrl(`/site-admin/internship-applications/${open.id}/file/cv`)} target="_blank" rel="noopener noreferrer">
                <span>📄 {isRTL ? 'السيرة الذاتية' : 'CV'}{open.cvFileName ? ` — ${open.cvFileName}` : ''}</span>
              </a>
              <a className="sm-file" href={fileUrl(`/site-admin/internship-applications/${open.id}/file/letter`)} target="_blank" rel="noopener noreferrer">
                <span>📄 {isRTL ? 'خطاب الجامعة' : 'University letter'}{open.letterFileName ? ` — ${open.letterFileName}` : ''}</span>
              </a>
            </div>
            <ReviewBox isRTL={isRTL} status={open.draftStatus} note={open.draftNote}
              onStatus={s => setOpen(o => ({ ...o, draftStatus: s }))} onNote={n => setOpen(o => ({ ...o, draftNote: n }))} />
          </Drawer>
        )}
      </AnimatePresence>
    </div>
  );
};

// ───────────── رسائل التواصل ─────────────
export const SiteMessagesSection = ({ isRTL, onChanged }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get('/site-admin/contact-messages'); setRows(listOf(data)); }
    catch (err) { toast.error(errMsg(err, isRTL, 'تعذّر تحميل الرسائل', 'Could not load messages')); }
    finally { setLoading(false); }
  }, [isRTL]);
  useEffect(() => { load(); }, [load]);

  const setRead = async (m, isRead) => {
    try {
      await api.put(`/site-admin/contact-messages/${m.id}`, { isRead });
      setRows(list => list.map(x => (x.id === m.id ? { ...x, isRead } : x)));
      onChanged && onChanged();
    } catch (err) { toast.error(errMsg(err, isRTL)); }
  };
  const remove = async (m) => {
    if (!window.confirm(isRTL ? `حذف رسالة «${m.name}»؟` : `Delete the message from ${m.name}?`)) return;
    try { await api.delete(`/site-admin/contact-messages/${m.id}`); toast.success(isRTL ? 'تم الحذف' : 'Deleted'); load(); onChanged && onChanged(); }
    catch (err) { toast.error(errMsg(err, isRTL)); }
  };

  const unread = rows.filter(r => !r.isRead).length;
  const shown = filter === 'unread' ? rows.filter(r => !r.isRead) : rows;

  return (
    <div className="sm-section">
      <div className="sm-toolbar">
        <h3>{isRTL ? 'رسائل التواصل' : 'Contact messages'} {unread > 0 && <span className="sm-count hot">{unread} {isRTL ? 'غير مقروءة' : 'unread'}</span>}</h3>
        <div className="sm-chips">
          <button type="button" className={`sm-chip ${filter === '' ? 'on' : ''}`} onClick={() => setFilter('')}>{isRTL ? 'الكل' : 'All'}</button>
          <button type="button" className={`sm-chip ${filter === 'unread' ? 'on' : ''}`} onClick={() => setFilter('unread')}>{isRTL ? 'غير المقروءة' : 'Unread'}</button>
        </div>
      </div>
      {loading ? <div className="sm-loading">{isRTL ? 'جارٍ التحميل…' : 'Loading…'}</div>
        : shown.length === 0 ? <EmptyState icon="✉️" text={isRTL ? 'لا توجد رسائل. تصل الرسائل من نموذج «أرسل لنا رسالة» أسفل صفحات الموقع.' : 'No messages. They arrive from the “Send us a message” form at the bottom of the site.'} />
        : (
          <div className="sm-msgs">
            {shown.map(m => (
              <div key={m.id} className={`sm-msg ${m.isRead ? '' : 'unread'}`}>
                <button type="button" className="sm-msg-head" onClick={() => { setExpanded(expanded === m.id ? null : m.id); if (!m.isRead) setRead(m, true); }}>
                  {!m.isRead && <span className="sm-dot" aria-label={isRTL ? 'غير مقروءة' : 'unread'} />}
                  <span className="sm-msg-name">{m.name}</span>
                  <span className="sm-msg-mail" dir="ltr">{m.email}</span>
                  <span className="sm-card-date">{fmtDateTime(m.createdAt, isRTL)}</span>
                </button>
                <p className={`sm-msg-text ${expanded === m.id ? 'open' : ''}`}>{m.message}</p>
                <div className="sm-msg-actions">
                  {m.email && <a className="sm-btn ghost" href={`mailto:${m.email}?subject=${encodeURIComponent(isRTL ? 'رد من فاب لاب الأحساء' : 'Reply from FabLab Al-Ahsa')}`}>↩ {isRTL ? 'رد بالبريد' : 'Reply'}</a>}
                  <button type="button" className="sm-btn ghost" onClick={() => setRead(m, !m.isRead)}>{m.isRead ? (isRTL ? 'تعليم كغير مقروءة' : 'Mark unread') : (isRTL ? 'تعليم كمقروءة' : 'Mark read')}</button>
                  <button type="button" className="sm-icon-btn danger" onClick={() => remove(m)} title={isRTL ? 'حذف' : 'Delete'}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
};
