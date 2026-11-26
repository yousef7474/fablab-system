import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';

// Admin / manager editors for a workspace booking: change the booking and
// its team, or extend it (a new end date / daily time instead of a new
// registration). Both keep a history line on the booking.

const UNITS = Array.from({ length: 8 }, (_, i) => `WS${i + 1}`);
const TIMES = Array.from({ length: 15 }, (_, i) => `${String(10 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
const TYPES = [['Beneficiary', 'مستفيد', 'Beneficiary'], ['Talented', 'موهوب', 'Talented'], ['Visitor', 'زائر', 'Visitor'], ['Entity', 'جهة', 'Organization']];
const addMonth = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d, last))).toISOString().slice(0, 10);
};
const errMsg = (err, isRTL) => (isRTL ? err.response?.data?.messageAr : err.response?.data?.message) || (isRTL ? 'حدث خطأ' : 'Something went wrong');
const blankPerson = { firstName: '', lastName: '', sex: 'Male', nationality: '', nationalId: '', phoneNumber: '', email: '', currentJob: '' };

const Shell = ({ title, sub, isRTL, onClose, children, foot }) => (
  <motion.div className="wsr-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.div
      className="wsr-modal wse"
      dir={isRTL ? 'rtl' : 'ltr'}
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 24, opacity: 0 }}
      onClick={e => e.stopPropagation()}
    >
      <div className="wsl-head">
        <div><h3>{title}</h3>{sub && <p>{sub}</p>}</div>
        <button type="button" className="wsl-x" onClick={onClose} aria-label={isRTL ? 'إغلاق' : 'Close'}>✕</button>
      </div>
      <div className="wse-body">{children}</div>
      <div className="wsr-modal-foot">{foot}</div>
    </motion.div>
  </motion.div>
);

const Field = ({ label, children, wide }) => (
  <label className={`wse-field${wide ? ' wide' : ''}`}><span>{label}</span>{children}</label>
);

// ---------- edit booking + team ----------
export const WorkspaceEditModal = ({ request, isRTL, onClose, onSaved }) => {
  const L = (ar, en) => (isRTL ? ar : en);
  const [form, setForm] = useState(() => ({
    applicantType: request.applicantType, organization: request.organization || '', projectName: request.projectName || '',
    projectDescription: request.projectDescription || '', unitCode: request.unitCode,
    startDate: request.startDate, endDate: request.endDate, startTime: request.startTime, endTime: request.endTime,
    note: '', notify: false
  }));
  const [members, setMembers] = useState(() => (request.members || []).map(m => ({ ...m, keep: true })));
  const [adding, setAdding] = useState(null); // null | 'lookup' | 'new'
  const [lookupId, setLookupId] = useState('');
  const [newPerson, setNewPerson] = useState(blankPerson);
  const [saving, setSaving] = useState(false);
  const [errField, setErrField] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setM = (i, k, v) => setMembers(list => list.map((m, j) => (j === i ? { ...m, [k]: v } : m)));

  const lookup = async () => {
    try {
      const { data } = await api.post('/public/workspace/lookup', { identifier: lookupId });
      if (!data.found) { toast.info(L('لا يوجد مستخدم بهذا الرقم — أضفه كمستخدم جديد', 'No user with that number — add them as a new person')); return; }
      if (members.some(m => m.userId === data.member.userId)) { toast.warning(L('هذا الشخص موجود في الفريق', 'Already in the team')); return; }
      setMembers(list => [...list, { existingUserId: data.member.userId, name: `${data.member.firstName} ${data.member.lastInitial}.`, phoneHint: data.member.phoneHint, linked: true }]);
      setAdding(null);
      setLookupId('');
    } catch (err) { toast.error(errMsg(err, isRTL)); }
  };
  const addNew = () => {
    const missing = ['firstName', 'lastName', 'nationality', 'nationalId', 'phoneNumber', 'email', 'currentJob'].filter(k => !String(newPerson[k] || '').trim());
    if (missing.length) { toast.error(L('أكمل بيانات الشخص الجديد', 'Fill in the new person\'s details')); return; }
    setMembers(list => [...list, { ...newPerson, fresh: true }]);
    setNewPerson(blankPerson);
    setAdding(null);
  };

  const save = async () => {
    setSaving(true);
    setErrField('');
    try {
      const payload = members.map(m => (m.existingUserId ? { existingUserId: m.existingUserId } : m.fresh
        ? { firstName: m.firstName, lastName: m.lastName, sex: m.sex, nationality: m.nationality, nationalId: m.nationalId, phoneNumber: m.phoneNumber, email: m.email, currentJob: m.currentJob }
        : { ...m, keep: true }));
      const { data } = await api.put(`/workspace-requests/${request.requestId}`, { ...form, members: payload });
      toast.success(L('تم حفظ التعديلات', 'Changes saved') + (data.emailSent ? L(' وإبلاغ قائد الفريق', ' — leader emailed') : ''));
      onSaved();
      onClose();
    } catch (err) {
      setErrField(err.response?.data?.field || '');
      toast.error(errMsg(err, isRTL));
    } finally { setSaving(false); }
  };

  const bad = (f) => (errField === f ? ' bad' : '');
  return (
    <Shell
      isRTL={isRTL}
      onClose={onClose}
      title={L(`تعديل الطلب ${request.requestNumber}`, `Edit ${request.requestNumber}`)}
      sub={L('تعديل بيانات الحجز والفريق', 'Change the booking and the team')}
      foot={<>
        <label className="wse-check"><input type="checkbox" checked={form.notify} onChange={e => set('notify', e.target.checked)} />{L('إبلاغ قائد الفريق بالبريد', 'Email the team leader')}</label>
        <button type="button" className="wsr-btn ghost" onClick={onClose} disabled={saving}>{L('إلغاء', 'Cancel')}</button>
        <button type="button" className="wsr-btn ok" onClick={save} disabled={saving}>{saving ? L('جاري الحفظ…', 'Saving…') : L('حفظ التعديلات', 'Save changes')}</button>
      </>}
    >
      <h4>{L('الحجز', 'Booking')}</h4>
      <div className="wse-grid">
        <Field label={L('مساحة العمل', 'Workspace')}>
          <select className={bad('unitCode')} value={form.unitCode} onChange={e => set('unitCode', e.target.value)}>
            {UNITS.map(u => <option key={u} value={u}>{L(`مساحة العمل ${u.slice(2)}`, `Workspace ${u.slice(2)}`)}</option>)}
          </select>
        </Field>
        <Field label={L('صفة المسجّل', 'Applicant type')}>
          <select value={form.applicantType} onChange={e => set('applicantType', e.target.value)}>
            {TYPES.map(([v, ar, en]) => <option key={v} value={v}>{L(ar, en)}</option>)}
          </select>
        </Field>
        <Field label={L('من تاريخ', 'From')}><input type="date" className={bad('startDate')} value={form.startDate} onChange={e => set('startDate', e.target.value)} /></Field>
        <Field label={L('إلى تاريخ', 'To')}><input type="date" className={bad('endDate')} value={form.endDate} min={form.startDate} onChange={e => set('endDate', e.target.value)} /></Field>
        <Field label={L('من الساعة', 'From time')}>
          <select className={bad('startTime')} value={form.startTime} onChange={e => set('startTime', e.target.value)}>{TIMES.slice(0, -1).map(t => <option key={t}>{t}</option>)}</select>
        </Field>
        <Field label={L('إلى الساعة', 'To time')}>
          <select className={bad('endTime')} value={form.endTime} onChange={e => set('endTime', e.target.value)}>{TIMES.slice(1).map(t => <option key={t}>{t}</option>)}</select>
        </Field>
        <Field label={L('اسم المشروع', 'Project name')}><input className={bad('projectName')} value={form.projectName} onChange={e => set('projectName', e.target.value)} /></Field>
        <Field label={L('الجهة', 'Organization')}><input value={form.organization} onChange={e => set('organization', e.target.value)} /></Field>
        <Field label={L('وصف المشروع', 'Description')} wide><textarea rows={2} value={form.projectDescription} onChange={e => set('projectDescription', e.target.value)} /></Field>
      </div>

      <h4>{L('الفريق', 'Team')} <small>({members.length}/4)</small></h4>
      <div className="wse-team">
        {members.map((m, i) => (
          <div key={i} className={`wse-person${errField.startsWith(`members.${i}`) ? ' bad' : ''}`}>
            <div className="wse-person-top">
              <span className="wsr-team-n">{i + 1}</span>
              <b>{i === 0 ? L('قائد الفريق', 'Team leader') : L(`العضو ${i + 1}`, `Member ${i + 1}`)}</b>
              {m.linked && <i className="wse-tag">{L('مستخدم مسجّل', 'Registered user')} · {m.name} {m.phoneHint}</i>}
              {m.fresh && <i className="wse-tag new">{L('مستخدم جديد', 'New user')}</i>}
              {i > 0 && <button type="button" className="wsl-del" onClick={() => setMembers(list => list.filter((_, j) => j !== i))}>{L('إزالة', 'Remove')}</button>}
            </div>
            {!m.linked && (
              <div className="wse-grid">
                <Field label={L('الاسم الأول', 'First name')}><input value={m.firstName || ''} onChange={e => setM(i, 'firstName', e.target.value)} /></Field>
                <Field label={L('اسم العائلة', 'Last name')}><input value={m.lastName || ''} onChange={e => setM(i, 'lastName', e.target.value)} /></Field>
                <Field label={L('رقم الهوية', 'National ID')}><input dir="ltr" value={m.nationalId || ''} onChange={e => setM(i, 'nationalId', e.target.value)} /></Field>
                <Field label={L('الجوال', 'Mobile')}><input dir="ltr" value={m.phoneNumber || ''} onChange={e => setM(i, 'phoneNumber', e.target.value)} /></Field>
                <Field label={L('البريد', 'Email')}><input dir="ltr" value={m.email || ''} onChange={e => setM(i, 'email', e.target.value)} /></Field>
                <Field label={L('الجهة التابع لها', 'Organization')}><input value={m.currentJob || ''} onChange={e => setM(i, 'currentJob', e.target.value)} /></Field>
              </div>
            )}
          </div>
        ))}
        {members.length < 4 && !adding && (
          <div className="wse-add">
            <button type="button" className="wsr-tool" onClick={() => setAdding('lookup')}>{L('+ إضافة مستخدم مسجّل', '+ Add a registered user')}</button>
            <button type="button" className="wsr-tool" onClick={() => setAdding('new')}>{L('+ إضافة شخص جديد', '+ Add a new person')}</button>
          </div>
        )}
        {adding === 'lookup' && (
          <div className="wse-person">
            <div className="wse-inline">
              <input dir="ltr" placeholder={L('رقم الهوية أو الجوال', 'National ID or mobile')} value={lookupId} onChange={e => setLookupId(e.target.value)} />
              <button type="button" className="wsr-btn ok" onClick={lookup}>{L('بحث', 'Look up')}</button>
              <button type="button" className="wsr-btn ghost" onClick={() => setAdding(null)}>{L('إلغاء', 'Cancel')}</button>
            </div>
          </div>
        )}
        {adding === 'new' && (
          <div className="wse-person">
            <div className="wse-grid">
              <Field label={L('الاسم الأول', 'First name')}><input value={newPerson.firstName} onChange={e => setNewPerson(p => ({ ...p, firstName: e.target.value }))} /></Field>
              <Field label={L('اسم العائلة', 'Last name')}><input value={newPerson.lastName} onChange={e => setNewPerson(p => ({ ...p, lastName: e.target.value }))} /></Field>
              <Field label={L('الجنس', 'Gender')}>
                <select value={newPerson.sex} onChange={e => setNewPerson(p => ({ ...p, sex: e.target.value }))}><option value="Male">{L('ذكر', 'Male')}</option><option value="Female">{L('أنثى', 'Female')}</option></select>
              </Field>
              <Field label={L('الجنسية', 'Nationality')}><input value={newPerson.nationality} onChange={e => setNewPerson(p => ({ ...p, nationality: e.target.value }))} /></Field>
              <Field label={L('رقم الهوية', 'National ID')}><input dir="ltr" value={newPerson.nationalId} onChange={e => setNewPerson(p => ({ ...p, nationalId: e.target.value }))} /></Field>
              <Field label={L('الجوال', 'Mobile')}><input dir="ltr" value={newPerson.phoneNumber} onChange={e => setNewPerson(p => ({ ...p, phoneNumber: e.target.value }))} /></Field>
              <Field label={L('البريد', 'Email')}><input dir="ltr" value={newPerson.email} onChange={e => setNewPerson(p => ({ ...p, email: e.target.value }))} /></Field>
              <Field label={L('الجهة التابع لها', 'Organization')}><input value={newPerson.currentJob} onChange={e => setNewPerson(p => ({ ...p, currentJob: e.target.value }))} /></Field>
            </div>
            <div className="wse-inline end">
              <button type="button" className="wsr-btn ghost" onClick={() => setAdding(null)}>{L('إلغاء', 'Cancel')}</button>
              <button type="button" className="wsr-btn ok" onClick={addNew}>{L('إضافة للفريق', 'Add to team')}</button>
            </div>
          </div>
        )}
      </div>
      <Field label={L('ملاحظة على التعديل (اختياري)', 'Note on this change (optional)')} wide>
        <input value={form.note} onChange={e => set('note', e.target.value)} />
      </Field>
    </Shell>
  );
};

// ---------- extend ----------
export const WorkspaceExtendModal = ({ request, isRTL, onClose, onSaved }) => {
  const L = (ar, en) => (isRTL ? ar : en);
  const maxEnd = useMemo(() => addMonth(request.endDate), [request.endDate]);
  const [form, setForm] = useState({ endDate: '', startTime: request.startTime, endTime: request.endTime, note: '', notify: true });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const save = async () => {
    if (!form.endDate) { toast.error(L('اختر تاريخ النهاية الجديد', 'Pick the new end date')); return; }
    setSaving(true);
    try {
      const { data } = await api.post(`/workspace-requests/${request.requestId}/extend`, form);
      toast.success(L(`تم التمديد حتى ${data.request.endDate}`, `Extended to ${data.request.endDate}`) + (data.emailSent ? L(' وإبلاغ قائد الفريق', ' — leader emailed') : ''));
      onSaved();
      onClose();
    } catch (err) { toast.error(errMsg(err, isRTL)); } finally { setSaving(false); }
  };
  return (
    <Shell
      isRTL={isRTL}
      onClose={onClose}
      title={L(`تمديد الطلب ${request.requestNumber}`, `Extend ${request.requestNumber}`)}
      sub={L(`الحالي: ${request.startDate} ← ${request.endDate} · ${request.startTime}–${request.endTime}`, `Now: ${request.startDate} → ${request.endDate} · ${request.startTime}–${request.endTime}`)}
      foot={<>
        <label className="wse-check"><input type="checkbox" checked={form.notify} onChange={e => set('notify', e.target.checked)} />{L('إبلاغ قائد الفريق بالبريد', 'Email the team leader')}</label>
        <button type="button" className="wsr-btn ghost" onClick={onClose} disabled={saving}>{L('إلغاء', 'Cancel')}</button>
        <button type="button" className="wsr-btn ok" onClick={save} disabled={saving}>{saving ? L('جاري الحفظ…', 'Saving…') : L('تمديد الحجز', 'Extend')}</button>
      </>}
    >
      <p className="wse-hint">{L('يُمدَّد الحجز نفسه بدل تسجيل طلب جديد — حتى شهر إضافي في كل مرة، ويُحفظ التمديد في سجل الطلب.', 'The same booking is extended instead of a new request — up to one more month each time; the extension is kept in the booking history.')}</p>
      <div className="wse-grid">
        <Field label={L('تاريخ النهاية الجديد', 'New end date')}>
          <input type="date" value={form.endDate} min={request.endDate} max={maxEnd} onChange={e => set('endDate', e.target.value)} />
        </Field>
        <Field label={L('من الساعة', 'From time')}>
          <select value={form.startTime} onChange={e => set('startTime', e.target.value)}>{TIMES.slice(0, -1).map(t => <option key={t}>{t}</option>)}</select>
        </Field>
        <Field label={L('إلى الساعة', 'To time')}>
          <select value={form.endTime} onChange={e => set('endTime', e.target.value)}>{TIMES.slice(1).map(t => <option key={t}>{t}</option>)}</select>
        </Field>
        <Field label={L('ملاحظة (اختياري)', 'Note (optional)')} wide><input value={form.note} onChange={e => set('note', e.target.value)} /></Field>
      </div>
    </Shell>
  );
};
