import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';
import printVolunteerOpportunity from '../shared/printVolunteerOpportunity';

// Default manager (approver) for volunteer-opportunity requests.
// Admin can still type a different email, but this pre-fills so the
// common case is one click.
const DEFAULT_MANAGER = { name: 'أ. زكي اللويم', email: 'zakiallwoaim@gmail.com' };

const emptyForm = () => ({
  coordinatorName: '',
  coordinatorPhone: '',
  title: '',
  location: '',
  mode: 'onsite',
  description: '',
  responsibilities: '',
  volunteersNeeded: 1,
  genderPreference: 'any',
  minAge: '',
  maxAge: '',
  programStartTime: '',
  programEndTime: '',
  requiredSkills: '',
  educationLevel: '',
  supportProvided: '',
  risksAndChallenges: '',
  startDate: '',
  endDate: ''
});

const fmtRequestNo = (n) => n == null ? '—' : `VOR-${String(n).padStart(3, '0')}`;
const fmtWhen = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return ''; }
};

const STATUS_LABEL = {
  draft:    { ar: 'مسودة',       en: 'Draft',    bg: '#f1f5f9', fg: '#475569', border: '#cbd5e1' },
  pending:  { ar: 'بانتظار الاعتماد', en: 'Pending',  bg: '#fef3c7', fg: '#92400e', border: '#fde68a' },
  approved: { ar: 'معتمد',       en: 'Approved', bg: '#dcfce7', fg: '#166534', border: '#86efac' },
  rejected: { ar: 'مرفوض',       en: 'Rejected', bg: '#fee2e2', fg: '#b91c1c', border: '#fecaca' }
};

const VolunteerOpportunityRequestModal = ({ onClose }) => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [tab, setTab] = useState('new'); // 'new' | 'list'
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [managerEmail, setManagerEmail] = useState(DEFAULT_MANAGER.email);
  const [sendingId, setSendingId] = useState(null);

  const patch = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const loadList = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/volunteer-opportunity-requests');
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(isRTL ? 'تعذّر تحميل الطلبات' : 'Failed to load requests');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (tab === 'list') loadList(); }, [tab]); // eslint-disable-line

  const canSave = useMemo(() => (
    form.coordinatorName.trim() && form.coordinatorPhone.trim() && form.title.trim()
  ), [form]);

  const save = async ({ thenSend } = {}) => {
    if (!canSave) return toast.error(isRTL ? 'الحقول الأساسية مطلوبة' : 'Core fields required');
    setSaving(true);
    try {
      const { data } = await api.post('/volunteer-opportunity-requests', form);
      toast.success(isRTL ? '✅ تم حفظ الطلب' : '✅ Request saved');
      if (thenSend) {
        await sendForApproval(data.requestId, false);
      }
      setForm(emptyForm());
      setTab('list');
      await loadList();
    } catch (err) {
      toast.error(err?.response?.data?.messageAr || err?.response?.data?.message || (isRTL ? 'تعذّر الحفظ' : 'Save failed'));
    } finally { setSaving(false); }
  };

  const sendForApproval = async (id, refresh = true) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(managerEmail)) {
      return toast.error(isRTL ? 'بريد المدير غير صحيح' : 'Invalid manager email');
    }
    setSendingId(id);
    try {
      const { data } = await api.post(`/volunteer-opportunity-requests/${id}/send-for-approval`, { managerEmail });
      if (data?.emailFailed) {
        toast.warning(isRTL ? 'تم تحديث الحالة — فشل البريد، جرّب إعادة الإرسال' : 'Status updated — email failed, try resending');
      } else {
        toast.success(isRTL ? `📧 أُرسلت إلى ${managerEmail}` : `📧 Sent to ${managerEmail}`);
      }
      if (refresh) await loadList();
    } catch (err) {
      toast.error(err?.response?.data?.messageAr || err?.response?.data?.message || (isRTL ? 'تعذّر الإرسال' : 'Send failed'));
    } finally { setSendingId(null); }
  };

  const deleteRow = async (id) => {
    if (!window.confirm(isRTL ? 'حذف هذا الطلب نهائياً؟' : 'Delete this request permanently?')) return;
    try {
      await api.delete(`/volunteer-opportunity-requests/${id}`);
      toast.success(isRTL ? '🗑️ تم الحذف' : '🗑️ Deleted');
      await loadList();
    } catch (err) {
      toast.error(err?.response?.data?.message || (isRTL ? 'تعذّر الحذف' : 'Delete failed'));
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="vor-overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15,23,42,0.6)',
          backdropFilter: 'blur(6px)',
          display: 'grid', placeItems: 'center',
          padding: 20, zIndex: 300
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 900, maxHeight: '94vh',
            background: '#fff', borderRadius: 18,
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
            boxShadow: '0 40px 80px -20px rgba(15,23,42,0.4)',
            fontFamily: 'Cairo, Inter, system-ui, sans-serif',
            direction: isRTL ? 'rtl' : 'ltr'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '20px 26px',
            background: 'linear-gradient(135deg, #16a34a, #0d9488)',
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, flexWrap: 'wrap'
          }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 1.4, opacity: 0.85, textTransform: 'uppercase', fontWeight: 700 }}>
                FABLAB · {isRTL ? 'تطوع' : 'Volunteer'}
              </div>
              <h3 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800 }}>
                {isRTL ? '🤝 طلب فرصة تطوعية' : '🤝 Volunteer Opportunity Request'}
              </h3>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff', cursor: 'pointer', fontSize: 16
              }}
            >✕</button>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex', borderBottom: '1px solid #e5e7eb',
            background: '#f8fafc'
          }}>
            <button
              onClick={() => setTab('new')}
              style={{
                flex: 1, padding: '12px 16px', border: 'none',
                background: tab === 'new' ? '#fff' : 'transparent',
                color: tab === 'new' ? '#16a34a' : '#64748b',
                fontFamily: 'inherit', fontWeight: 800, fontSize: 13,
                cursor: 'pointer',
                borderBottom: tab === 'new' ? '3px solid #16a34a' : '3px solid transparent'
              }}
            >➕ {isRTL ? 'طلب جديد' : 'New request'}</button>
            <button
              onClick={() => setTab('list')}
              style={{
                flex: 1, padding: '12px 16px', border: 'none',
                background: tab === 'list' ? '#fff' : 'transparent',
                color: tab === 'list' ? '#16a34a' : '#64748b',
                fontFamily: 'inherit', fontWeight: 800, fontSize: 13,
                cursor: 'pointer',
                borderBottom: tab === 'list' ? '3px solid #16a34a' : '3px solid transparent'
              }}
            >📋 {isRTL ? 'طلبات سابقة' : 'Past requests'}</button>
          </div>

          {/* Body */}
          <div style={{ overflowY: 'auto', padding: 22, flex: 1 }}>
            {tab === 'new' ? (
              <FormBody form={form} patch={patch} isRTL={isRTL} />
            ) : (
              <ListBody
                rows={rows} loading={loading} isRTL={isRTL}
                managerEmail={managerEmail} setManagerEmail={setManagerEmail}
                onSend={sendForApproval} sendingId={sendingId}
                onDelete={deleteRow}
              />
            )}
          </div>

          {/* Footer — only for the New form */}
          {tab === 'new' && (
            <div style={{
              padding: '14px 22px',
              borderTop: '1px solid #e5e7eb',
              background: '#f8fafc',
              display: 'flex', gap: 10, justifyContent: 'space-between',
              flexWrap: 'wrap', alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#475569' }}>
                <span>📧 {isRTL ? 'يُرسل إلى:' : 'Sends to:'}</span>
                <input
                  type="email"
                  value={managerEmail}
                  dir="ltr"
                  onChange={(e) => setManagerEmail(e.target.value)}
                  style={{
                    padding: '7px 12px', border: '1px solid #cbd5e1',
                    borderRadius: 8, fontFamily: 'monospace', fontSize: 12,
                    minWidth: 220
                  }}
                />
                <span style={{ fontSize: 11, color: '#94a3b8' }}>({DEFAULT_MANAGER.name})</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => save({ thenSend: false })}
                  disabled={saving || !canSave}
                  style={{
                    padding: '11px 18px', borderRadius: 10, border: '1px solid #cbd5e1',
                    background: '#fff', color: '#0f172a',
                    fontFamily: 'inherit', fontWeight: 700, fontSize: 13.5,
                    cursor: (saving || !canSave) ? 'not-allowed' : 'pointer',
                    opacity: (saving || !canSave) ? 0.5 : 1
                  }}
                >💾 {isRTL ? 'حفظ كمسودة' : 'Save draft'}</button>
                <button
                  onClick={() => save({ thenSend: true })}
                  disabled={saving || !canSave}
                  style={{
                    padding: '11px 22px', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg, #16a34a, #15803d)',
                    color: '#fff', fontFamily: 'inherit', fontWeight: 800, fontSize: 14,
                    cursor: (saving || !canSave) ? 'not-allowed' : 'pointer',
                    opacity: (saving || !canSave) ? 0.5 : 1,
                    boxShadow: '0 8px 22px -8px rgba(22,163,74,0.5)'
                  }}
                >{saving
                  ? (isRTL ? 'جاري الإرسال...' : 'Sending...')
                  : (isRTL ? '📧 حفظ وإرسال للمدير' : '📧 Save & send to manager')}</button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ---------- Form body ----------
const Field = ({ label, hint, children, span = 1 }) => (
  <label style={{
    display: 'flex', flexDirection: 'column', gap: 4,
    gridColumn: `span ${span}`
  }}>
    <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>{label}</span>
    {children}
    {hint && <small style={{ fontSize: 11, color: '#94a3b8' }}>{hint}</small>}
  </label>
);

const inputStyle = {
  padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8,
  fontFamily: 'inherit', fontSize: 14, background: '#fff', color: '#0f172a',
  outline: 'none'
};

const FormBody = ({ form, patch, isRTL }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
    <SectionHeader color="#16a34a" step="1" title={isRTL ? 'منسق الفرصة' : 'Coordinator'} />
    <Field label={isRTL ? 'اسم منسق الفرصة *' : 'Coordinator name *'}>
      <input type="text" value={form.coordinatorName} onChange={e => patch('coordinatorName', e.target.value)} style={inputStyle} />
    </Field>
    <Field label={isRTL ? 'رقم جوال منسق الفرصة *' : 'Coordinator phone *'}>
      <input type="tel" dir="ltr" value={form.coordinatorPhone} onChange={e => patch('coordinatorPhone', e.target.value)} style={inputStyle} placeholder="05XXXXXXXX" />
    </Field>

    <SectionHeader color="#0d9488" step="2" title={isRTL ? 'تفاصيل الفرصة' : 'Opportunity details'} />
    <Field label={isRTL ? 'مسمى الفرصة التطوعية * (محدد وواضح)' : 'Opportunity title * (specific and clear)'} span={2}>
      <input type="text" value={form.title} onChange={e => patch('title', e.target.value)} style={inputStyle} />
    </Field>
    <Field label={isRTL ? 'مكان الفرصة' : 'Location'}>
      <input type="text" value={form.location} onChange={e => patch('location', e.target.value)} style={inputStyle} />
    </Field>
    <Field label={isRTL ? 'طبيعة الفرصة' : 'Mode'}>
      <select value={form.mode} onChange={e => patch('mode', e.target.value)} style={inputStyle}>
        <option value="onsite">{isRTL ? 'حضوري' : 'On-site'}</option>
        <option value="remote">{isRTL ? 'عن بُعد' : 'Remote'}</option>
        <option value="hybrid">{isRTL ? 'هجين' : 'Hybrid'}</option>
      </select>
    </Field>
    <Field label={isRTL ? 'وصف الفرصة' : 'Description'} span={2}>
      <textarea rows={3} value={form.description} onChange={e => patch('description', e.target.value)} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
    </Field>
    <Field label={isRTL ? 'مهام ومسؤوليات المتطوع' : 'Volunteer duties and responsibilities'} span={2}>
      <textarea rows={3} value={form.responsibilities} onChange={e => patch('responsibilities', e.target.value)} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
    </Field>

    <SectionHeader color="#0284c7" step="3" title={isRTL ? 'الفئة المستهدفة' : 'Target volunteers'} />
    <Field label={isRTL ? 'عدد المتطوعين المطلوب' : 'Volunteers needed'}>
      <input type="number" min="1" value={form.volunteersNeeded} onChange={e => patch('volunteersNeeded', e.target.value)} style={inputStyle} />
    </Field>
    <Field label={isRTL ? 'الجنس' : 'Gender'}>
      <select value={form.genderPreference} onChange={e => patch('genderPreference', e.target.value)} style={inputStyle}>
        <option value="any">{isRTL ? 'الجميع' : 'Any'}</option>
        <option value="male">{isRTL ? 'ذكور فقط' : 'Male only'}</option>
        <option value="female">{isRTL ? 'إناث فقط' : 'Female only'}</option>
      </select>
    </Field>
    <Field label={isRTL ? 'العمر الأدنى' : 'Min age'}>
      <input type="number" min="0" max="100" value={form.minAge} onChange={e => patch('minAge', e.target.value)} style={inputStyle} placeholder="18" />
    </Field>
    <Field label={isRTL ? 'العمر الأعلى' : 'Max age'}>
      <input type="number" min="0" max="100" value={form.maxAge} onChange={e => patch('maxAge', e.target.value)} style={inputStyle} placeholder="30" />
    </Field>
    <Field label={isRTL ? 'المؤهل العلمي' : 'Education level'} span={2}>
      <input type="text" value={form.educationLevel} onChange={e => patch('educationLevel', e.target.value)} style={inputStyle} placeholder={isRTL ? 'مثال: طالب جامعي، ثانوي، بكالوريوس' : 'e.g., University student, high school, bachelor'} />
    </Field>
    <Field label={isRTL ? 'المهارات المطلوبة' : 'Required skills'} span={2}>
      <textarea rows={2} value={form.requiredSkills} onChange={e => patch('requiredSkills', e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
    </Field>

    <SectionHeader color="#7c3aed" step="4" title={isRTL ? 'التوقيت' : 'Timing'} />
    <Field label={isRTL ? 'وقت بداية البرنامج (يومياً)' : 'Program start time (daily)'}>
      <input type="time" dir="ltr" value={form.programStartTime} onChange={e => patch('programStartTime', e.target.value)} style={inputStyle} />
    </Field>
    <Field label={isRTL ? 'وقت نهاية البرنامج (يومياً)' : 'Program end time (daily)'}>
      <input type="time" dir="ltr" value={form.programEndTime} onChange={e => patch('programEndTime', e.target.value)} style={inputStyle} />
    </Field>
    <Field label={isRTL ? 'تاريخ بداية الفرصة' : 'Opportunity start date'}>
      <input type="date" value={form.startDate} onChange={e => patch('startDate', e.target.value)} style={inputStyle} />
    </Field>
    <Field label={isRTL ? 'تاريخ نهاية الفرصة' : 'Opportunity end date'}>
      <input type="date" value={form.endDate} onChange={e => patch('endDate', e.target.value)} style={inputStyle} />
    </Field>

    <SectionHeader color="#b45309" step="5" title={isRTL ? 'الدعم والمخاطر' : 'Support & risks'} />
    <Field label={isRTL ? 'الدعم المقدم للمتطوع' : 'Support provided to volunteer'} span={2}>
      <textarea rows={2} value={form.supportProvided} onChange={e => patch('supportProvided', e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} placeholder={isRTL ? 'شهادة، ساعات تطوعية، وجبات، مواصلات، ...' : 'Certificate, volunteer hours, meals, transport, ...'} />
    </Field>
    <Field label={isRTL ? 'المخاطر والتحديات' : 'Risks and challenges'} span={2}>
      <textarea rows={2} value={form.risksAndChallenges} onChange={e => patch('risksAndChallenges', e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
    </Field>
  </div>
);

const SectionHeader = ({ color, step, title }) => (
  <div style={{
    gridColumn: '1 / -1',
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 0 4px', borderBottom: `2px dashed ${color}44`,
    marginTop: 6, marginBottom: 4
  }}>
    <span style={{
      width: 28, height: 28, borderRadius: 8,
      background: color, color: '#fff',
      display: 'grid', placeItems: 'center',
      fontWeight: 800, fontSize: 13,
      fontFamily: 'JetBrains Mono, monospace'
    }}>{step}</span>
    <b style={{ color, fontSize: 14, fontWeight: 800 }}>{title}</b>
  </div>
);

// ---------- List body ----------
const ListBody = ({ rows, loading, isRTL, managerEmail, setManagerEmail, onSend, sendingId, onDelete }) => {
  if (loading) return <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>{isRTL ? 'جارٍ التحميل...' : 'Loading...'}</div>;
  if (rows.length === 0) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', border: '1px dashed #e2e8f0', borderRadius: 12 }}>
      {isRTL ? 'لا توجد طلبات بعد. ابدأ من تبويب "طلب جديد".' : 'No requests yet. Start from the "New request" tab.'}
    </div>
  );

  return (
    <>
      <div style={{
        padding: '10px 14px', background: '#f8fafc',
        border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 14,
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap'
      }}>
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>
          {isRTL ? 'بريد المدير للإرسال:' : 'Manager email for send:'}
        </span>
        <input
          type="email" dir="ltr" value={managerEmail}
          onChange={(e) => setManagerEmail(e.target.value)}
          style={{
            flex: 1, minWidth: 200,
            padding: '7px 12px', border: '1px solid #cbd5e1',
            borderRadius: 8, fontFamily: 'monospace', fontSize: 12
          }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map(r => {
          const st = STATUS_LABEL[r.approvalStatus] || STATUS_LABEL.draft;
          const isSending = sendingId === r.requestId;
          return (
            <div key={r.requestId} style={{
              padding: 14, background: '#fff',
              border: '1px solid #e5e7eb', borderRadius: 12,
              borderInlineStart: `4px solid ${st.border}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', color: '#16a34a', fontWeight: 800, fontSize: 12, letterSpacing: 1 }}>
                    {fmtRequestNo(r.requestNumber)}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                    {isRTL ? 'المنسق:' : 'Coordinator:'} <b>{r.coordinatorName}</b>
                    {' · '}
                    <span dir="ltr">{r.coordinatorPhone}</span>
                    {r.sentForApprovalAt && <>{' · '}<span>📤 {fmtWhen(r.sentForApprovalAt)}</span></>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    padding: '5px 12px', borderRadius: 999,
                    background: st.bg, color: st.fg, border: `1px solid ${st.border}`,
                    fontSize: 12, fontWeight: 800
                  }}>
                    {isRTL ? st.ar : st.en}
                  </span>
                </div>
              </div>

              {r.managerNote && (
                <div style={{
                  marginTop: 10, padding: '8px 12px',
                  background: r.approvalStatus === 'rejected' ? '#fef2f2' : '#f0fdf4',
                  border: `1px solid ${r.approvalStatus === 'rejected' ? '#fecaca' : '#86efac'}`,
                  borderRadius: 8, fontSize: 12.5, color: '#334155'
                }}>
                  <b>{isRTL ? 'ملاحظة المدير:' : 'Manager note:'}</b> {r.managerNote}
                  {r.managerName && <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>— {r.managerName}</div>}
                </div>
              )}

              <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                {r.approvalStatus === 'approved' && (
                  <button
                    onClick={() => printVolunteerOpportunity(r)}
                    style={{
                      padding: '8px 16px', borderRadius: 8, border: 'none',
                      background: 'linear-gradient(135deg, #16a34a, #15803d)',
                      color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: 12.5,
                      cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 6
                    }}
                    title={isRTL ? 'طباعة وثيقة الاعتماد مع مساحة توقيع المدير' : 'Print the approval document with manager signature space'}
                  >
                    🖨️ {isRTL ? 'طباعة وثيقة الاعتماد' : 'Print approval doc'}
                  </button>
                )}
                {(r.approvalStatus === 'draft' || r.approvalStatus === 'rejected') && (
                  <button
                    onClick={() => onSend(r.requestId)}
                    disabled={isSending}
                    style={{
                      padding: '8px 16px', borderRadius: 8, border: 'none',
                      background: 'linear-gradient(135deg, #16a34a, #15803d)',
                      color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: 12.5,
                      cursor: isSending ? 'not-allowed' : 'pointer', opacity: isSending ? 0.6 : 1
                    }}
                  >{isSending ? '…' : (isRTL ? '📧 إرسال للمدير' : '📧 Send to manager')}</button>
                )}
                {r.approvalStatus === 'pending' && (
                  <button
                    onClick={() => onSend(r.requestId)}
                    disabled={isSending}
                    style={{
                      padding: '8px 16px', borderRadius: 8, border: '1px solid #fde68a',
                      background: '#fef3c7', color: '#92400e',
                      fontFamily: 'inherit', fontWeight: 700, fontSize: 12.5, cursor: 'pointer'
                    }}
                  >{isSending ? '…' : (isRTL ? '🔁 إعادة الإرسال' : '🔁 Resend')}</button>
                )}
                {r.approvalStatus !== 'approved' && (
                  <button
                    onClick={() => onDelete(r.requestId)}
                    style={{
                      padding: '8px 14px', borderRadius: 8, border: '1px solid #fecaca',
                      background: '#fff', color: '#dc2626',
                      fontFamily: 'inherit', fontWeight: 700, fontSize: 12.5, cursor: 'pointer'
                    }}
                  >🗑️ {isRTL ? 'حذف' : 'Delete'}</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default VolunteerOpportunityRequestModal;
