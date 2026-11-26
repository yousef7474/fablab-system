import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';
import WorkspaceDayLogs from './WorkspaceDayLogs';
import WorkspaceArchive from './WorkspaceArchive';
import { WorkspaceEditModal, WorkspaceExtendModal } from './WorkspaceEditors';
import { printWorkspaceBanner, printWorkspaceCards } from './workspacePrint';
import './WorkspaceRequests.css';

// Requests from the public /workspace page, at the top of the workspaces
// tab on the admin and manager boards: who asked for which of the 8
// workspaces, for which period and daily time. A pending request holds its
// workspace; accepting or rejecting it emails the applicant.

const TYPES = {
  Beneficiary: ['مستفيد', 'Beneficiary'],
  Talented: ['موهوب', 'Talented'],
  Visitor: ['زائر', 'Visitor'],
  Entity: ['جهة', 'Organization']
};
const STATUS = {
  pending: ['بانتظار المراجعة', 'Pending'],
  approved: ['مقبول', 'Accepted'],
  rejected: ['مرفوض', 'Rejected']
};
const WORKING_DAYS = [0, 1, 2, 3, 4];

const utc = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const addDays = (ymd, n) => { const d = utc(ymd); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const workingDaysIn = (from, to) => {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (WORKING_DAYS.includes(utc(d).getUTCDay())) n += 1;
  return n;
};
const overlaps = (a, b) => {
  if (a.startTime >= b.endTime || b.startTime >= a.endTime) return false;
  const from = a.startDate > b.startDate ? a.startDate : b.startDate;
  const to = a.endDate < b.endDate ? a.endDate : b.endDate;
  return from <= to && workingDaysIn(from, to) > 0;
};
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date());
const fmtDate = (ymd, isRTL) => utc(ymd).toLocaleDateString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
// "10 أيام عمل" / "11 يوم عمل" — Arabic plural with the count.
const workDaysText = (n, isRTL) => {
  if (!isRTL) return `${n} working day${n === 1 ? '' : 's'}`;
  if (n === 1) return 'يوم عمل واحد';
  if (n === 2) return 'يوما عمل';
  return `${n} ${n <= 10 ? 'أيام' : 'يوم'} عمل`;
};
const errMsg = (err, isRTL) => (isRTL ? err.response?.data?.messageAr : err.response?.data?.message) || (isRTL ? 'حدث خطأ' : 'Something went wrong');

const WorkspaceRequests = ({ isRTL }) => {
  const [data, setData] = useState({ requests: [], counts: { pending: 0, approved: 0, rejected: 0 }, units: [] });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [query, setQuery] = useState('');
  const [deciding, setDeciding] = useState(null); // { request, decision }
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);
  const [logsFor, setLogsFor] = useState(null);
  const [editing, setEditing] = useState(null);
  const [extending, setExtending] = useState(null);
  const [view, setView] = useState('requests'); // requests | archive
  const L = (pair) => (isRTL ? pair[0] : pair[1]);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/workspace-requests');
      setData(res.data);
    } catch (err) {
      toast.error(errMsg(err, isRTL));
    } finally {
      setLoading(false);
    }
  }, [isRTL]);
  useEffect(() => { load(); }, [load]);

  const unitLabel = useCallback((code) => {
    const u = data.units.find(x => x.code === code);
    return u ? (isRTL ? u.label : u.labelEn) : code;
  }, [data.units, isRTL]);

  const approved = useMemo(() => data.requests.filter(r => r.status === 'approved'), [data.requests]);

  // Today on each workspace: the accepted booking covering today, if any.
  const board = useMemo(() => {
    const t = today();
    return data.units.map(u => ({
      ...u,
      now: approved.find(r => r.unitCode === u.code && r.startDate <= t && r.endDate >= t && WORKING_DAYS.includes(utc(t).getUTCDay())) || null,
      next: approved.filter(r => r.unitCode === u.code && r.startDate > t).sort((a, b) => a.startDate.localeCompare(b.startDate))[0] || null
    }));
  }, [data.units, approved]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.requests
      .filter(r => filter === 'all' || r.status === filter)
      .filter(r => !q || [r.requestNumber, r.fullName, r.phone, r.email, r.projectName, r.organization]
        .some(v => String(v || '').toLowerCase().includes(q)));
  }, [data.requests, filter, query]);

  const clashOf = (r) => (r.status === 'pending'
    ? approved.find(a => a.requestId !== r.requestId && a.unitCode === r.unitCode && overlaps(a, r))
    : null);

  const decide = async () => {
    if (!deciding) return;
    if (deciding.decision === 'reject' && !note.trim()) {
      toast.error(isRTL ? 'اكتب سبب الرفض' : 'Write the reason for rejecting');
      return;
    }
    setBusy(true);
    try {
      const res = await api.patch(`/workspace-requests/${deciding.request.requestId}/decision`, { decision: deciding.decision, note });
      const ok = deciding.decision === 'approve';
      toast.success(isRTL
        ? `${ok ? 'تم قبول' : 'تم رفض'} الطلب ${deciding.request.requestNumber}${res.data.emailSent ? ' وإبلاغ المسجّل بالبريد' : ''}`
        : `Request ${deciding.request.requestNumber} ${ok ? 'accepted' : 'rejected'}${res.data.emailSent ? ' — applicant emailed' : ''}`);
      if (!res.data.emailSent) toast.warning(isRTL ? 'تعذّر إرسال البريد للمسجّل — تواصل معه هاتفيًا' : 'The email could not be sent — call the applicant');
      setDeciding(null);
      setNote('');
      load();
    } catch (err) {
      toast.error(errMsg(err, isRTL));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r) => {
    if (!window.confirm(isRTL
      ? `حذف الطلب ${r.requestNumber}؟ سيختفي من القائمة وتتحرر المساحة، ويبقى في أرشيف الأشخاص.`
      : `Delete request ${r.requestNumber}? It leaves the list and frees the workspace, but stays in the people archive.`)) return;
    try {
      await api.delete(`/workspace-requests/${r.requestId}`);
      toast.success(isRTL ? 'تم حذف الطلب' : 'Request deleted');
      load();
    } catch (err) {
      toast.error(errMsg(err, isRTL));
    }
  };

  // ID cards: open the window on the click (popup blockers), fill it once the QR codes load.
  const printCards = async (r) => {
    const w = window.open('', '_blank');
    if (w) w.document.write(`<p style="font-family:sans-serif;padding:24px">${isRTL ? 'جاري تجهيز البطاقات…' : 'Preparing the cards…'}</p>`);
    try {
      const { data } = await api.get(`/workspace-requests/${r.requestId}/cards`);
      printWorkspaceCards(data.request, data.cards, w);
    } catch (err) {
      if (w) w.close();
      toast.error(errMsg(err, isRTL));
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/workspace`;
    navigator.clipboard?.writeText(url).then(
      () => toast.success(isRTL ? 'تم نسخ رابط صفحة التسجيل' : 'Registration link copied'),
      () => toast.info(url)
    );
  };

  return (
    <section className="wsr" dir={isRTL ? 'rtl' : 'ltr'}>
      <header className="wsr-head">
        <button type="button" className="wsr-title" onClick={() => setOpen(o => !o)} aria-expanded={open}>
          <span className="wsr-title-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>
          </span>
          <span>
            <small>{isRTL ? 'من صفحة تسجيل مساحات العمل · 8 مساحات مجانية' : 'From the workspace registration page · 8 free workspaces'}</small>
            <strong>{isRTL ? 'طلبات تسجيل مساحات العمل' : 'Workspace registration requests'}</strong>
          </span>
          {data.counts.pending > 0 && <em className="wsr-badge">{data.counts.pending}</em>}
          <svg className={`wsr-chev${open ? ' open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        <button type="button" className="wsr-link" onClick={copyLink}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
          {isRTL ? 'نسخ رابط التسجيل' : 'Copy registration link'}
        </button>
      </header>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="wsr-body"
          >
            <div className="wsr-views" role="tablist">
              <button type="button" role="tab" aria-selected={view === 'requests'} className={view === 'requests' ? 'on' : ''} onClick={() => setView('requests')}>
                {isRTL ? 'الطلبات' : 'Requests'}
              </button>
              <button type="button" role="tab" aria-selected={view === 'archive'} className={view === 'archive' ? 'on' : ''} onClick={() => setView('archive')}>
                {isRTL ? 'أرشيف الأشخاص' : 'People archive'}
              </button>
            </div>

            {view === 'archive' ? <WorkspaceArchive isRTL={isRTL} /> : (<>
            {/* the 8 workspaces today */}
            <div className="wsr-board">
              {board.map(u => (
                <div key={u.code} className={`wsr-unit${u.now ? ' busy' : ''}`}>
                  <span className="wsr-unit-no">{u.code.replace('WS', '')}</span>
                  <span className="wsr-unit-text">
                    <strong>{u.now ? u.now.fullName : (isRTL ? 'متاحة اليوم' : 'Free today')}</strong>
                    <small>
                      {u.now
                        ? <span dir="ltr">{u.now.startTime}–{u.now.endTime}</span>
                        : u.next
                          ? <>{isRTL ? 'التالي: ' : 'Next: '}{fmtDate(u.next.startDate, isRTL)}</>
                          : (isRTL ? 'لا حجوزات قادمة' : 'No upcoming bookings')}
                    </small>
                  </span>
                </div>
              ))}
            </div>

            <div className="wsr-tools">
              <div className="wsr-seg" role="tablist">
                {['pending', 'approved', 'rejected', 'all'].map(k => (
                  <button key={k} type="button" role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
                    {k === 'all' ? (isRTL ? 'الكل' : 'All') : L(STATUS[k])}
                    {k !== 'all' && <i>{data.counts[k] || 0}</i>}
                  </button>
                ))}
              </div>
              <input
                className="wsr-search"
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={isRTL ? 'بحث بالاسم أو الجوال أو رقم الطلب…' : 'Search name, phone or number…'}
              />
            </div>

            {loading ? (
              <div className="wsr-empty">{isRTL ? 'جاري التحميل…' : 'Loading…'}</div>
            ) : list.length === 0 ? (
              <div className="wsr-empty">{filter === 'pending' ? (isRTL ? 'لا توجد طلبات بانتظار المراجعة' : 'No requests waiting') : (isRTL ? 'لا توجد طلبات' : 'No requests')}</div>
            ) : (
              <div className="wsr-list">
                {list.map(r => {
                  const clash = clashOf(r);
                  const days = workingDaysIn(r.startDate, r.endDate);
                  return (
                    <article key={r.requestId} className={`wsr-card is-${r.status}`}>
                      <div className="wsr-card-top">
                        <span className="wsr-no">{r.requestNumber}</span>
                        <span className={`wsr-chip ${r.status}`}>{L(STATUS[r.status] || [r.status, r.status])}</span>
                        <span className="wsr-unit-chip">{unitLabel(r.unitCode)}</span>
                      </div>
                      <h4>{r.fullName}</h4>
                      <p className="wsr-sub">
                        {L(TYPES[r.applicantType] || [r.applicantType, r.applicantType])}
                        {r.organization ? ` · ${r.organization}` : ''}
                        {' · '}{isRTL ? `${r.peopleCount} أشخاص` : `${r.peopleCount} people`}
                      </p>
                      <dl className="wsr-facts">
                        <div><dt>{isRTL ? 'الفترة' : 'Period'}</dt><dd>{fmtDate(r.startDate, isRTL)} ← {fmtDate(r.endDate, isRTL)} <small>· {workDaysText(days, isRTL)}</small></dd></div>
                        <div><dt>{isRTL ? 'الوقت اليومي' : 'Daily time'}</dt><dd dir="ltr">{r.startTime} – {r.endTime}</dd></div>
                        <div><dt>{isRTL ? 'المشروع' : 'Project'}</dt><dd>{r.projectName}</dd></div>
                        <div><dt>{isRTL ? 'التواصل' : 'Contact'}</dt><dd><a href={`tel:${r.phone}`} dir="ltr">{r.phone}</a> · <a href={`mailto:${r.email}`} dir="ltr">{r.email}</a></dd></div>
                      </dl>
                      {Array.isArray(r.members) && r.members.length > 0 && (
                        <ul className="wsr-team">
                          {r.members.map((m, i) => (
                            <li key={`${m.userId || m.nationalId || i}`}>
                              <span className="wsr-team-n">{i + 1}</span>
                              <b>{m.name}</b>
                              {i === 0 && <em>{isRTL ? 'القائد' : 'Leader'}</em>}
                              {m.isNew && <i>{isRTL ? 'مستخدم جديد' : 'New user'}</i>}
                              {m.nationalId && <small dir="ltr">{m.nationalId}</small>}
                            </li>
                          ))}
                        </ul>
                      )}
                      {r.projectDescription && <p className="wsr-desc">{r.projectDescription}</p>}
                      {clash && (
                        <p className="wsr-warn">
                          {isRTL
                            ? `تنبيه: يتعارض مع الطلب المقبول ${clash.requestNumber} (${clash.fullName}) على نفس المساحة`
                            : `Clashes with accepted request ${clash.requestNumber} (${clash.fullName}) on the same workspace`}
                        </p>
                      )}
                      {Array.isArray(r.history) && r.history.filter(h => h.action !== 'deleted').length > 0 && (
                        <ul className="wsr-history">
                          {r.history.filter(h => h.action !== 'deleted').slice(-3).map((h, k) => (
                            <li key={k}>
                              {h.action === 'extended'
                                ? (isRTL ? `مُدّد حتى ${h.to?.endDate} (${h.to?.startTime}–${h.to?.endTime})` : `Extended to ${h.to?.endDate} (${h.to?.startTime}–${h.to?.endTime})`)
                                : (isRTL ? 'عُدّلت البيانات' : 'Details edited')}
                              {' · '}{h.by || '—'}{' · '}{new Date(h.at).toLocaleDateString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB')}
                              {h.note ? ` — ${h.note}` : ''}
                            </li>
                          ))}
                        </ul>
                      )}
                      {r.status !== 'pending' && (
                        <p className="wsr-decided">
                          {isRTL ? 'القرار: ' : 'Decision: '}{r.decidedBy || '—'}
                          {r.decidedAt ? ` · ${new Date(r.decidedAt).toLocaleDateString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB')}` : ''}
                          {r.decisionNote ? <><br />{r.decisionNote}</> : null}
                        </p>
                      )}
                      {r.status === 'approved' && (
                        <div className="wsr-booktools">
                          <button type="button" className="wsr-tool" onClick={() => printWorkspaceBanner(r)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v8H6z" /></svg>
                            {isRTL ? 'طباعة اللوحة' : 'Print banner'}
                          </button>
                          <button type="button" className="wsr-tool" onClick={() => printCards(r)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="11" r="2.5" /><path d="M14 10h4M14 14h4M6 17c.6-1.6 1.8-2.5 3-2.5s2.4.9 3 2.5" /></svg>
                            {isRTL ? 'بطاقات الأعضاء' : 'Member cards'}
                          </button>
                          <button type="button" className="wsr-tool" onClick={() => setLogsFor(r)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                            {isRTL ? 'التقييم اليومي' : 'Daily rating'}
                            {r.dayLogs?.count > 0 && <span>{r.dayLogs.count} · {r.dayLogs.avg}★</span>}
                          </button>
                        </div>
                      )}
                      <div className="wsr-actions">
                        {r.status !== 'approved' && (
                          <button type="button" className="wsr-btn ok" disabled={!!clash} onClick={() => { setDeciding({ request: r, decision: 'approve' }); setNote(''); }}>
                            {isRTL ? 'قبول' : 'Accept'}
                          </button>
                        )}
                        {r.status !== 'rejected' && (
                          <button type="button" className="wsr-btn no" onClick={() => { setDeciding({ request: r, decision: 'reject' }); setNote(''); }}>
                            {isRTL ? 'رفض' : 'Reject'}
                          </button>
                        )}
                        <button type="button" className="wsr-btn ghost" onClick={() => setEditing(r)}>{isRTL ? 'تعديل' : 'Edit'}</button>
                        {r.status !== 'rejected' && (
                          <button type="button" className="wsr-btn ghost" onClick={() => setExtending(r)}>{isRTL ? 'تمديد' : 'Extend'}</button>
                        )}
                        <button type="button" className="wsr-btn ghost danger" onClick={() => remove(r)}>{isRTL ? 'حذف' : 'Delete'}</button>
                        <span className="wsr-when">{new Date(r.createdAt).toLocaleString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            </>)}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editing && <WorkspaceEditModal request={editing} isRTL={isRTL} onClose={() => setEditing(null)} onSaved={load} />}
      </AnimatePresence>
      <AnimatePresence>
        {extending && <WorkspaceExtendModal request={extending} isRTL={isRTL} onClose={() => setExtending(null)} onSaved={load} />}
      </AnimatePresence>

      <AnimatePresence>
        {logsFor && <WorkspaceDayLogs request={logsFor} isRTL={isRTL} onClose={() => setLogsFor(null)} onChanged={load} />}
      </AnimatePresence>

      <AnimatePresence>
        {deciding && (
          <motion.div className="wsr-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !busy && setDeciding(null)}>
            <motion.div
              className="wsr-modal"
              dir={isRTL ? 'rtl' : 'ltr'}
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <h3>
                {deciding.decision === 'approve'
                  ? (isRTL ? `قبول الطلب ${deciding.request.requestNumber}` : `Accept ${deciding.request.requestNumber}`)
                  : (isRTL ? `رفض الطلب ${deciding.request.requestNumber}` : `Reject ${deciding.request.requestNumber}`)}
              </h3>
              <p>
                {deciding.request.fullName} · {unitLabel(deciding.request.unitCode)} · <span dir="ltr">{deciding.request.startTime}–{deciding.request.endTime}</span>
              </p>
              <label>
                {deciding.decision === 'approve'
                  ? (isRTL ? 'ملاحظة للمسجّل (اختياري)' : 'Note to the applicant (optional)')
                  : (isRTL ? 'سبب الرفض (يُرسل للمسجّل)' : 'Reason (sent to the applicant)')}
                <textarea rows={4} value={note} onChange={e => setNote(e.target.value)} autoFocus />
              </label>
              <p className="wsr-hint">{isRTL ? 'سيصل المسجّلَ بريدٌ بالقرار.' : 'The applicant gets an email with the decision.'}</p>
              <div className="wsr-modal-foot">
                <button type="button" className="wsr-btn ghost" onClick={() => setDeciding(null)} disabled={busy}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
                <button type="button" className={`wsr-btn ${deciding.decision === 'approve' ? 'ok' : 'no'}`} onClick={decide} disabled={busy}>
                  {busy ? (isRTL ? 'جاري الحفظ…' : 'Saving…') : deciding.decision === 'approve' ? (isRTL ? 'تأكيد القبول' : 'Accept') : (isRTL ? 'تأكيد الرفض' : 'Reject')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default WorkspaceRequests;
