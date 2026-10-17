import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';
import './PaymentPagesTab.css';

// Admin "صفحات الدفع": create payment links (/pay/:slug), open / close
// them, and review what customers paid — check the transfer receipt,
// confirm (the customer gets the invoice) or reject with a reason.

const API_BASE = String(api.defaults.baseURL || '/api').replace(/\/$/, '');

const fmtSAR = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDateTime = (d, isRTL) => (d ? new Date(d).toLocaleString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {
  timeZone: 'Asia/Riyadh', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'
}) : '—');
// <input type="datetime-local"> works in local time; the server stores UTC.
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const isManager = () => {
  try { return ['manager', 'admin'].includes(JSON.parse(localStorage.getItem('adminData') || '{}').role); } catch { return false; }
};
const errMsg = (err, isRTL, fallback) => {
  const d = err?.response?.data;
  return (isRTL ? d?.messageAr : d?.message) || d?.messageAr || fallback;
};
const copyText = (text, isRTL) => {
  const ok = () => toast.success(isRTL ? 'تم نسخ الرابط' : 'Link copied');
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(ok, () => toast.error(isRTL ? 'تعذّر النسخ' : 'Copy failed'));
};
const compressImage = (file, maxSide = 1600, quality = 0.84) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = reject;
  reader.onload = () => {
    const img = new Image();
    img.onerror = reject;
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.src = String(reader.result);
  };
  reader.readAsDataURL(file);
});

const STATE = {
  open: { ar: 'مفتوحة', en: 'Open', cls: 'open' },
  closed: { ar: 'مغلقة', en: 'Closed', cls: 'closed' },
  expired: { ar: 'انتهى الموعد', en: 'Expired', cls: 'expired' },
  full: { ar: 'مكتملة', en: 'Full', cls: 'full' }
};
const SUB_STATUS = {
  pending: { ar: 'بانتظار التحقق', en: 'Pending', cls: 'pending' },
  verified: { ar: 'مؤكد', en: 'Verified', cls: 'verified' },
  rejected: { ar: 'مرفوض', en: 'Rejected', cls: 'rejected' }
};
const METHOD = { bank_transfer: { ar: 'تحويل بنكي', en: 'Bank transfer', icon: '🏦' }, mada: { ar: 'مدى', en: 'mada', icon: '💳' } };
// Same people as the other discount / approval lists (shared setting
// "workshop_approvers", editable); used when the setting is empty.
const DEFAULT_APPROVERS = ['أ. زكي اللويم', 'م. نوف البوعبيد', 'أ. عبدالله الصفي', 'أ. عبدالمحسن السلطان'];
const round2 = (n) => Math.round(n * 100) / 100;
const finalAmount = (base, pct) => {
  const b = Number(base); const p = Number(pct) || 0;
  return Number.isFinite(b) && b > 0 && p >= 0 && p < 100 ? round2(b * (1 - p / 100)) : 0;
};
const fmtPct = (p) => `${Number(p).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;

const REJECT_REASONS = ['المبلغ المحوّل غير مطابق', 'الإيصال غير واضح', 'لم يصل التحويل إلى الحساب', 'الإيصال لا يخص هذه الصفحة'];

const EMPTY_FORM = { title: '', description: '', baseAmount: '', discountPercent: '', discountAppliedBy: '', discountApprovedBy: '', maxPayers: '', closesAt: '', methods: ['bank_transfer', 'mada'], terms: '', isOpen: true, cover: null, coverPreview: null, removeCover: false };

// ─────────────────────────── Person picker ───────────────────────────
const PersonPicker = ({ isRTL, label, value, onChange, people, onAddPerson, canAdd }) => {
  const known = !value || people.includes(value);
  const [custom, setCustom] = useState(!known);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (value && !people.includes(value)) setCustom(true); }, [value, people]);
  const add = async () => {
    const name = value.trim();
    if (!name) return;
    setSaving(true);
    try { await onAddPerson(name); setCustom(false); } finally { setSaving(false); }
  };
  return (
    <div className="ppa-field">
      <span>{label} *</span>
      <select
        value={custom ? '__custom__' : (value || '')}
        onChange={e => {
          if (e.target.value === '__custom__') { setCustom(true); onChange(''); }
          else { setCustom(false); onChange(e.target.value); }
        }}
      >
        <option value="">{isRTL ? '— اختر الاسم —' : '— Choose —'}</option>
        {people.map(n => <option key={n} value={n}>{n}</option>)}
        <option value="__custom__">{isRTL ? '✏️ شخص آخر…' : '✏️ Someone else…'}</option>
      </select>
      {custom && (
        <div className="ppa-person-new">
          <input value={value} onChange={e => onChange(e.target.value)} maxLength={150} placeholder={isRTL ? 'الاسم الكامل' : 'Full name'} autoFocus />
          {canAdd && (
            <button type="button" className="ppa-btn" onClick={add} disabled={saving || !value.trim()} title={isRTL ? 'يُحفظ في قائمة المعتمدين ويظهر في المرات القادمة' : 'Saved to the approvers list for next time'}>
              {saving ? '…' : (isRTL ? '＋ حفظ في القائمة' : '＋ Save to list')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────── Page editor ───────────────────────────
const PageEditor = ({ isRTL, page, onClose, onSaved }) => {
  const [form, setForm] = useState(() => page ? {
    ...EMPTY_FORM,
    title: page.title, description: page.description || '',
    baseAmount: String(page.baseAmount ?? page.amount), discountPercent: Number(page.discountPercent) > 0 ? String(Number(page.discountPercent)) : '',
    discountAppliedBy: page.discountAppliedBy || '', discountApprovedBy: page.discountApprovedBy || '',
    maxPayers: page.maxPayers ? String(page.maxPayers) : '', closesAt: toLocalInput(page.closesAt),
    methods: page.methods || ['bank_transfer', 'mada'], terms: page.terms || '', isOpen: page.isOpen,
    coverPreview: page.hasCover ? `${API_BASE}/pay/${page.slug}/cover?v=${new Date(page.updatedAt).getTime()}` : null
  } : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [bank, setBank] = useState(null);
  const [people, setPeople] = useState(DEFAULT_APPROVERS);
  const set = (patch) => setForm(f => ({ ...f, ...patch }));
  const manager = isManager();

  useEffect(() => {
    api.get('/workshops/admin/payment-settings').then(r => setBank(r.data?.bank || {})).catch(() => setBank({}));
    api.get('/workshops/admin/terms')
      .then(r => { if (Array.isArray(r.data?.approvers) && r.data.approvers.length) setPeople(r.data.approvers); })
      .catch(() => {});
  }, []);
  const addPerson = async (name) => {
    if (people.includes(name)) return;
    const next = [...people, name];
    try {
      const { data } = await api.put('/workshops/admin/terms', { approvers: next });
      setPeople(Array.isArray(data?.approvers) && data.approvers.length ? data.approvers : next);
      toast.success(isRTL ? `أُضيف «${name}» إلى القائمة` : `Added "${name}" to the list`);
    } catch (err) {
      toast.error(errMsg(err, isRTL, isRTL ? 'تعذّر حفظ الاسم في القائمة' : 'Could not save the name'));
    }
  };
  const pct = Number(form.discountPercent) || 0;
  const hasDiscount = pct > 0;
  const finalPrice = finalAmount(form.baseAmount, form.discountPercent);
  const discountValue = hasDiscount && Number(form.baseAmount) > 0 ? round2(Number(form.baseAmount) - finalPrice) : 0;
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggleMethod = (m) => set({ methods: form.methods.includes(m) ? form.methods.filter(x => x !== m) : [...form.methods, m] });
  const pickCover = async (file) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) { toast.error(isRTL ? 'اختر صورة PNG أو JPG أو WEBP' : 'Choose a PNG, JPG or WEBP image'); return; }
    try {
      const dataUrl = await compressImage(file);
      set({ cover: dataUrl, coverPreview: dataUrl, removeCover: false });
    } catch { toast.error(isRTL ? 'تعذّر قراءة الصورة' : 'Could not read the image'); }
  };

  const save = async () => {
    if (!form.title.trim()) return toast.error(isRTL ? 'اكتب عنوان الصفحة' : 'Enter a title');
    if (!(Number(form.baseAmount) > 0)) return toast.error(isRTL ? 'أدخل التكلفة الأساسية' : 'Enter the main cost');
    if (pct < 0 || pct >= 100) return toast.error(isRTL ? 'نسبة الخصم يجب أن تكون بين 0 و 99.99' : 'Discount must be 0–99.99%');
    if (hasDiscount && !form.discountAppliedBy.trim()) return toast.error(isRTL ? 'اختر من طبّق الخصم' : 'Choose who applied the discount');
    if (hasDiscount && !form.discountApprovedBy.trim()) return toast.error(isRTL ? 'اختر من اعتمد الخصم' : 'Choose who approved the discount');
    if (!form.methods.length) return toast.error(isRTL ? 'اختر طريقة دفع واحدة على الأقل' : 'Choose at least one payment method');
    setSaving(true);
    const body = {
      title: form.title, description: form.description,
      baseAmount: form.baseAmount, discountPercent: hasDiscount ? form.discountPercent : 0,
      discountAppliedBy: hasDiscount ? form.discountAppliedBy.trim() : '', discountApprovedBy: hasDiscount ? form.discountApprovedBy.trim() : '',
      maxPayers: form.maxPayers, closesAt: form.closesAt ? new Date(form.closesAt).toISOString() : null,
      methods: form.methods, terms: form.terms, isOpen: form.isOpen,
      ...(form.cover ? { cover: form.cover } : {}),
      ...(form.removeCover ? { removeCover: true } : {})
    };
    try {
      const { data } = page ? await api.put(`/payment-pages/${page.pageId}`, body) : await api.post('/payment-pages', body);
      toast.success(page ? (isRTL ? 'تم حفظ التعديلات' : 'Saved') : (isRTL ? 'تم إنشاء صفحة الدفع' : 'Payment page created'));
      onSaved(data, !page);
    } catch (err) {
      toast.error(errMsg(err, isRTL, isRTL ? 'تعذّر الحفظ' : 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ppa-overlay" onClick={onClose}>
      <motion.div className="ppa-modal" dir={isRTL ? 'rtl' : 'ltr'} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
        initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.25 }}>
        <div className="ppa-modal-head">
          <div>
            <span className="ppa-kicker">💳 {isRTL ? 'صفحة دفع' : 'Payment page'}</span>
            <h3>{page ? (isRTL ? 'تعديل صفحة الدفع' : 'Edit payment page') : (isRTL ? 'صفحة دفع جديدة' : 'New payment page')}</h3>
          </div>
          <button type="button" className="ppa-x" onClick={onClose} aria-label={isRTL ? 'إغلاق' : 'Close'}>✕</button>
        </div>

        <div className="ppa-modal-body">
          <div className="ppa-cover-pick">
            {form.coverPreview ? <img src={form.coverPreview} alt="" /> : <div className="ppa-cover-empty"><span>🖼️</span>{isRTL ? 'صورة الغلاف (اختياري)' : 'Cover image (optional)'}</div>}
            <div className="ppa-cover-actions">
              <label className="ppa-btn">
                {form.coverPreview ? (isRTL ? 'تغيير الصورة' : 'Change') : (isRTL ? 'رفع صورة' : 'Upload')}
                <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => { pickCover(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              {form.coverPreview && (
                <button type="button" className="ppa-btn ghost danger" onClick={() => set({ cover: null, coverPreview: null, removeCover: !!page?.hasCover })}>{isRTL ? 'إزالة' : 'Remove'}</button>
              )}
            </div>
          </div>

          <div className="ppa-grid">
            <label className="ppa-field ppa-span">
              <span>{isRTL ? 'العنوان' : 'Title'} *</span>
              <input value={form.title} onChange={e => set({ title: e.target.value })} maxLength={200} placeholder={isRTL ? 'مثال: رسوم معسكر الروبوتات الشتوي' : 'e.g. Winter robotics camp fee'} />
            </label>
            <label className="ppa-field ppa-span">
              <span>{isRTL ? 'الوصف' : 'Description'}</span>
              <textarea rows={3} value={form.description} onChange={e => set({ description: e.target.value })} maxLength={4000} placeholder={isRTL ? 'ما الذي يدفع العميل مقابله؟ التواريخ، المحتوى، أي تفاصيل مهمة…' : 'What is the customer paying for?'} />
            </label>
            <div className="ppa-price ppa-span">
              <div className="ppa-price-head">💰 {isRTL ? 'التكلفة' : 'Cost'}</div>
              <div className="ppa-price-grid">
                <label className="ppa-field">
                  <span>{isRTL ? 'التكلفة الأساسية (ر.س)' : 'Main cost (SAR)'} *</span>
                  <input type="number" min="1" step="0.01" dir="ltr" value={form.baseAmount} onChange={e => set({ baseAmount: e.target.value })} placeholder="450" />
                </label>
                <label className="ppa-field">
                  <span>{isRTL ? 'الخصم (%)' : 'Discount (%)'}</span>
                  <input type="number" min="0" max="99.99" step="0.01" dir="ltr" value={form.discountPercent} onChange={e => set({ discountPercent: e.target.value })} placeholder="0" />
                </label>
                <div className={`ppa-field ppa-final ${hasDiscount ? 'on' : ''}`}>
                  <span>{isRTL ? 'التكلفة بعد الخصم' : 'Cost after discount'}</span>
                  <output dir="ltr">{finalPrice ? fmtSAR(finalPrice) : '—'} <em>SAR</em></output>
                  {hasDiscount && finalPrice > 0 && <small>{isRTL ? <>خصم <bdi dir="ltr">{fmtPct(pct)}</bdi> = {fmtSAR(discountValue)} ر.س — يدفع العميل هذا المبلغ</> : `${fmtPct(pct)} off = ${fmtSAR(discountValue)} SAR — the customer pays this`}</small>}
                </div>
              </div>
              {hasDiscount && (
                <div className="ppa-price-grid two">
                  <PersonPicker isRTL={isRTL} label={isRTL ? 'طبّق الخصم' : 'Discount applied by'} value={form.discountAppliedBy}
                    onChange={v => set({ discountAppliedBy: v })} people={people} onAddPerson={addPerson} canAdd={manager} />
                  <PersonPicker isRTL={isRTL} label={isRTL ? 'اعتمد الخصم' : 'Approved by'} value={form.discountApprovedBy}
                    onChange={v => set({ discountApprovedBy: v })} people={people} onAddPerson={addPerson} canAdd={manager} />
                </div>
              )}
            </div>
            <label className="ppa-field">
              <span>{isRTL ? 'عدد الأشخاص المسموح لهم' : 'People allowed'}</span>
              <input type="number" min="1" step="1" dir="ltr" value={form.maxPayers} onChange={e => set({ maxPayers: e.target.value })} placeholder={isRTL ? 'بدون حد' : 'No limit'} />
              <small>{isRTL ? 'مثال 10 — تُغلق الصفحة تلقائياً عند اكتماله. اتركه فارغاً بلا حد.' : 'e.g. 10 — the page closes itself when reached. Empty = no limit.'}</small>
            </label>
            <label className="ppa-field">
              <span>{isRTL ? 'آخر موعد للدفع (اختياري)' : 'Deadline (optional)'}</span>
              <input type="datetime-local" dir="ltr" value={form.closesAt} onChange={e => set({ closesAt: e.target.value })} />
            </label>
            <div className="ppa-field">
              <span>{isRTL ? 'حالة الصفحة' : 'Page status'}</span>
              <button type="button" className={`ppa-switch ${form.isOpen ? 'on' : ''}`} onClick={() => set({ isOpen: !form.isOpen })} aria-pressed={form.isOpen}>
                <i />{form.isOpen ? (isRTL ? 'مفتوحة — تستقبل المدفوعات' : 'Open — taking payments') : (isRTL ? 'مغلقة' : 'Closed')}
              </button>
            </div>
            <div className="ppa-field ppa-span">
              <span>{isRTL ? 'طرق الدفع' : 'Payment methods'}</span>
              <div className="ppa-methods">
                {['bank_transfer', 'mada'].map(m => (
                  <button key={m} type="button" className={`ppa-method ${form.methods.includes(m) ? 'on' : ''}`} onClick={() => toggleMethod(m)} aria-pressed={form.methods.includes(m)}>
                    <span>{METHOD[m].icon}</span>
                    <b>{m === 'bank_transfer' ? (isRTL ? 'تحويل بنكي + إيصال' : 'Bank transfer + receipt') : (isRTL ? 'مدى في فاب لاب' : 'mada at FabLab')}</b>
                    <i>{form.methods.includes(m) ? '✓' : ''}</i>
                  </button>
                ))}
              </div>
              <small className="ppa-bankline">
                {bank === null ? '…' : bank?.iban
                  ? <>{isRTL ? 'الحساب المستخدم:' : 'Account used:'} <b>{bank.bankName}</b> · <span dir="ltr">{bank.iban}</span> — {isRTL ? 'يُعدَّل من «حساب الدفع» في تبويب الورش.' : 'edit it from "Payment Info" in Workshops.'}</>
                  : <span className="warn">{isRTL ? '⚠️ لم تُضبط بيانات الحساب البنكي بعد — اضبطها من «حساب الدفع» في تبويب الورش.' : '⚠️ No bank account set — set it from "Payment Info" in Workshops.'}</span>}
              </small>
            </div>
            <label className="ppa-field ppa-span">
              <span>{isRTL ? 'الشروط والأحكام (اختياري)' : 'Terms (optional)'}</span>
              <textarea rows={3} value={form.terms} onChange={e => set({ terms: e.target.value })} maxLength={4000} placeholder={isRTL ? 'إن كتبتها يجب على العميل الموافقة عليها قبل الدفع' : 'If set, the customer must accept them before paying'} />
            </label>
          </div>
        </div>

        <div className="ppa-modal-foot">
          <button type="button" className="ppa-btn ghost" onClick={onClose}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
          <button type="button" className="ppa-btn primary" onClick={save} disabled={saving}>
            {saving ? '…' : page ? (isRTL ? 'حفظ' : 'Save') : (isRTL ? 'إنشاء الصفحة' : 'Create page')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─────────────────────────── Review modal ───────────────────────────
const ReviewModal = ({ isRTL, sub, action, onClose, onDone }) => {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const verify = action === 'verified';
  const submit = async () => {
    if (!verify && !note.trim()) return toast.error(isRTL ? 'اكتب سبب الرفض' : 'Write the reason');
    setBusy(true);
    try {
      const { data } = await api.patch(`/payment-pages/submissions/${sub.submissionId}`, { status: action, note: note.trim() || undefined });
      toast.success(verify
        ? (isRTL ? 'تم تأكيد الدفع — أُرسلت الفاتورة للعميل' : 'Payment verified — invoice sent')
        : (isRTL ? 'تم رفض الدفع وإبلاغ العميل' : 'Payment rejected — customer notified'));
      onDone(data);
    } catch (err) {
      toast.error(errMsg(err, isRTL, isRTL ? 'تعذّر الحفظ' : 'Could not save'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ppa-overlay" onClick={onClose}>
      <motion.div className="ppa-modal ppa-modal--sm" dir={isRTL ? 'rtl' : 'ltr'} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
        initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="ppa-modal-head">
          <div>
            <span className="ppa-kicker">{sub.reference}</span>
            <h3>{verify ? (isRTL ? 'تأكيد استلام الدفع' : 'Confirm payment') : (isRTL ? 'رفض الدفع' : 'Reject payment')}</h3>
          </div>
          <button type="button" className="ppa-x" onClick={onClose}>✕</button>
        </div>
        <div className="ppa-modal-body">
          <div className={`ppa-review-sum ${verify ? 'ok' : 'bad'}`}>
            <b>{sub.fullName}</b>
            <span dir="ltr">{fmtSAR(sub.amount)} SAR</span>
            <small>{METHOD[sub.method]?.icon} {isRTL ? METHOD[sub.method]?.ar : METHOD[sub.method]?.en}</small>
          </div>
          {verify ? (
            <p className="ppa-review-text">{isRTL ? 'سيُرسل للعميل بريد تأكيد مع الفاتورة (PDF). تأكد من وصول المبلغ قبل التأكيد.' : 'The customer is emailed a confirmation with the PDF invoice. Make sure the money arrived first.'}</p>
          ) : (
            <>
              <div className="ppa-chips">
                {REJECT_REASONS.map(r => <button key={r} type="button" className={`ppa-chip ${note === r ? 'on' : ''}`} onClick={() => setNote(r)}>{r}</button>)}
              </div>
              <label className="ppa-field">
                <span>{isRTL ? 'سبب الرفض — يصل للعميل' : 'Reason — sent to the customer'} *</span>
                <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} maxLength={1000} />
              </label>
            </>
          )}
        </div>
        <div className="ppa-modal-foot">
          <button type="button" className="ppa-btn ghost" onClick={onClose}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
          <button type="button" className={`ppa-btn ${verify ? 'ok-solid' : 'danger-solid'}`} onClick={submit} disabled={busy}>
            {busy ? '…' : verify ? (isRTL ? '✓ تأكيد وإرسال الفاتورة' : '✓ Confirm & send invoice') : (isRTL ? 'رفض وإبلاغ العميل' : 'Reject & notify')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ─────────────────────────── Payments of one page ───────────────────────────
const Submissions = ({ isRTL, pageId, onBack, onChanged, manager }) => {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [review, setReview] = useState(null); // { sub, action }

  const load = useCallback(async () => {
    try { const { data: d } = await api.get(`/payment-pages/${pageId}/submissions`); setData(d); }
    catch (err) { toast.error(errMsg(err, isRTL, isRTL ? 'تعذّر تحميل المدفوعات' : 'Could not load payments')); }
  }, [pageId, isRTL]);
  useEffect(() => { load(); }, [load]);

  const subs = useMemo(() => data?.submissions || [], [data]);
  const counts = useMemo(() => subs.reduce((m, s) => ({ ...m, [s.status]: (m[s.status] || 0) + 1 }), {}), [subs]);
  const shown = subs.filter(s => (filter === 'all' || s.status === filter)
    && (!q.trim() || `${s.fullName} ${s.phone} ${s.email} ${s.reference}`.toLowerCase().includes(q.trim().toLowerCase())));

  const token = () => { try { return localStorage.getItem('adminToken') || ''; } catch { return ''; } };
  const openProof = (s) => window.open(`${API_BASE}/payment-pages/submissions/${s.submissionId}/proof?token=${encodeURIComponent(token())}`, '_blank', 'noopener');
  const downloadInvoice = async (s) => {
    try {
      const res = await api.get(`/payment-pages/submissions/${s.submissionId}/invoice-pdf`, { responseType: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      a.download = `invoice-${s.reference}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (err) {
      let msg = isRTL ? 'خطأ في إنشاء الفاتورة' : 'Error generating invoice';
      if (err?.response?.data instanceof Blob) {
        try { const j = JSON.parse(await err.response.data.text()); msg = (isRTL ? j.messageAr : j.message) || msg; if (j.detail) msg += ` — ${j.detail}`; } catch { /* keep */ }
      }
      toast.error(msg);
    }
  };
  const reopen = async (s) => {
    try { await api.patch(`/payment-pages/submissions/${s.submissionId}`, { status: 'pending' }); toast.success(isRTL ? 'أُعيد للمراجعة' : 'Back to pending'); load(); onChanged(); }
    catch (err) { toast.error(errMsg(err, isRTL, 'Error')); }
  };
  const remove = async (s) => {
    if (!window.confirm(isRTL ? `حذف طلب ${s.reference} نهائياً؟` : `Delete ${s.reference}?`)) return;
    try { await api.delete(`/payment-pages/submissions/${s.submissionId}`); toast.success(isRTL ? 'تم الحذف' : 'Deleted'); load(); onChanged(); }
    catch (err) { toast.error(errMsg(err, isRTL, 'Error')); }
  };
  const exportCsv = () => {
    const f = (v) => { const s = String(v == null ? '' : v).replace(/"/g, '""'); return /[",\n\r]/.test(s) ? `"${s}"` : s; };
    const header = ['المرجع', 'الاسم', 'الجوال', 'البريد', 'طريقة الدفع', 'التكلفة الأساسية', 'نسبة الخصم', 'طبّق الخصم', 'اعتمد الخصم', 'المبلغ المدفوع', 'الحالة', 'تاريخ الطلب', 'تاريخ التأكيد', 'ملاحظة العميل', 'ملاحظة المراجعة'];
    const rows = shown.map(s => [s.reference, s.fullName, s.phone, s.email, METHOD[s.method]?.ar || s.method,
      Number(s.baseAmount).toFixed(2), s.discountPercent ? fmtPct(s.discountPercent) : '', s.discountAppliedBy || '', s.discountApprovedBy || '',
      Number(s.amount).toFixed(2), SUB_STATUS[s.status]?.ar || s.status,
      String(s.createdAt).slice(0, 16).replace('T', ' '), s.paidAt ? String(s.paidAt).slice(0, 10) : '', s.note || '', s.reviewNote || '']);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + [header, ...rows].map(r => r.map(f).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
    a.download = `payments-${data?.page?.slug || 'page'}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const page = data?.page;
  return (
    <div className="ppa-subs">
      <div className="ppa-subs-head">
        <button type="button" className="ppa-btn ghost" onClick={onBack}>{isRTL ? '→ كل الصفحات' : '← All pages'}</button>
        {page && (
          <div className="ppa-subs-title">
            <h3>{page.title}</h3>
            <span dir="ltr">{fmtSAR(page.amount)} SAR{page.discountPercent > 0 ? ` (-${fmtPct(page.discountPercent)})` : ''} · {page.stats.taken}{page.maxPayers ? ` / ${page.maxPayers}` : ''} {isRTL ? 'شخص' : 'people'}</span>
          </div>
        )}
        {page && <button type="button" className="ppa-btn" onClick={() => copyText(page.url, isRTL)}>🔗 {isRTL ? 'نسخ الرابط' : 'Copy link'}</button>}
      </div>

      {page && (
        <div className="ppa-kpis">
          <div className="ppa-kpi amber"><b>{counts.pending || 0}</b><span>{isRTL ? 'بانتظار التحقق' : 'Pending'}</span></div>
          <div className="ppa-kpi green"><b>{counts.verified || 0}</b><span>{isRTL ? 'مؤكد' : 'Verified'}</span></div>
          <div className="ppa-kpi"><b dir="ltr">{fmtSAR(page.stats.collected)}</b><span>{isRTL ? 'ر.س محصّلة' : 'SAR collected'}</span></div>
          <div className="ppa-kpi"><b>{page.maxPayers ? page.stats.seatsLeft : '∞'}</b><span>{isRTL ? 'أماكن متبقية' : 'Places left'}</span></div>
        </div>
      )}

      <div className="ppa-filterbar">
        <div className="ppa-tabs">
          {['all', 'pending', 'verified', 'rejected'].map(k => (
            <button key={k} type="button" className={`ppa-tab ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>
              {k === 'all' ? (isRTL ? 'الكل' : 'All') : (isRTL ? SUB_STATUS[k].ar : SUB_STATUS[k].en)}
              <i>{k === 'all' ? subs.length : (counts[k] || 0)}</i>
            </button>
          ))}
        </div>
        <div className="ppa-filter-right">
          <input className="ppa-search" value={q} onChange={e => setQ(e.target.value)} placeholder={isRTL ? 'بحث بالاسم، الجوال، المرجع…' : 'Search name, phone, reference…'} />
          <button type="button" className="ppa-btn" onClick={exportCsv} disabled={!shown.length}>📥 CSV</button>
        </div>
      </div>

      {!data ? <div className="ppa-loading">{isRTL ? 'جارٍ التحميل…' : 'Loading…'}</div>
        : !shown.length ? (
          <div className="ppa-empty"><span>🧾</span>{subs.length ? (isRTL ? 'لا نتائج مطابقة' : 'No matches') : (isRTL ? 'لم يدفع أحد عبر هذه الصفحة بعد. شارك الرابط مع العملاء.' : 'No payments yet — share the link.')}</div>
        ) : (
          <div className="ppa-rows">
            {shown.map(s => {
              const st = SUB_STATUS[s.status] || SUB_STATUS.pending;
              return (
                <motion.div key={s.submissionId} className={`ppa-row ${st.cls}`} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="ppa-row-main">
                    <div className="ppa-row-top">
                      <span className="ppa-ref" dir="ltr">{s.reference}</span>
                      <span className={`ppa-status ${st.cls}`}>{isRTL ? st.ar : st.en}</span>
                      <span className="ppa-method-tag">{METHOD[s.method]?.icon} {isRTL ? METHOD[s.method]?.ar : METHOD[s.method]?.en}</span>
                    </div>
                    <b className="ppa-name">{s.fullName}</b>
                    <div className="ppa-contact">
                      <a href={`tel:${s.phone}`} dir="ltr">{s.phone}</a>
                      <a href={`mailto:${s.email}`} dir="ltr">{s.email}</a>
                      <span>{fmtDateTime(s.createdAt, isRTL)}</span>
                    </div>
                    {s.note && <p className="ppa-note">💬 {s.note}</p>}
                    {s.reviewNote && <p className={`ppa-note ${s.status === 'rejected' ? 'bad' : ''}`}>📝 {s.reviewNote}{s.reviewedBy ? ` — ${s.reviewedBy}` : ''}</p>}
                  </div>
                  <div className="ppa-row-side">
                    <strong dir="ltr">{fmtSAR(s.amount)} <em>SAR</em></strong>
                    {s.discountPercent > 0 && (
                      <span className="ppa-row-disc" title={`${isRTL ? 'طبّق الخصم' : 'Applied by'}: ${s.discountAppliedBy || '—'} · ${isRTL ? 'اعتمده' : 'Approved by'}: ${s.discountApprovedBy || '—'}`}>
                        <s dir="ltr">{fmtSAR(s.baseAmount)}</s> <span className="ppa-off">-{fmtPct(s.discountPercent)}</span>
                      </span>
                    )}
                    <div className="ppa-row-actions">
                      {s.hasProof && <button type="button" className="ppa-btn" onClick={() => openProof(s)}>🧾 {isRTL ? 'الإيصال' : 'Receipt'}</button>}
                      {s.status !== 'verified' && <button type="button" className="ppa-btn ok" onClick={() => setReview({ sub: s, action: 'verified' })}>✓ {isRTL ? 'تأكيد' : 'Verify'}</button>}
                      {s.status === 'pending' && <button type="button" className="ppa-btn danger" onClick={() => setReview({ sub: s, action: 'rejected' })}>✕ {isRTL ? 'رفض' : 'Reject'}</button>}
                      {s.status === 'verified' && <button type="button" className="ppa-btn" onClick={() => downloadInvoice(s)}>📄 {isRTL ? 'الفاتورة' : 'Invoice'}</button>}
                      {s.status !== 'pending' && <button type="button" className="ppa-btn ghost" onClick={() => reopen(s)} title={isRTL ? 'إعادته إلى «بانتظار التحقق»' : 'Back to pending'}>↺</button>}
                      <button type="button" className="ppa-btn ghost" onClick={() => copyText(s.receiptUrl, isRTL)} title={isRTL ? 'نسخ رابط إيصال العميل' : "Copy the customer's receipt link"}>🔗</button>
                      {manager && s.status !== 'verified' && <button type="button" className="ppa-btn ghost danger" onClick={() => remove(s)} title={isRTL ? 'حذف' : 'Delete'}>🗑</button>}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

      <AnimatePresence>
        {review && (
          <ReviewModal isRTL={isRTL} sub={review.sub} action={review.action} onClose={() => setReview(null)}
            onDone={() => { setReview(null); load(); onChanged(); }} />
        )}
      </AnimatePresence>
    </div>
  );
};

// ─────────────────────────── Tab ───────────────────────────
const PaymentPagesTab = ({ isRTL }) => {
  const [pages, setPages] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | page
  const [viewing, setViewing] = useState(null);  // pageId
  const manager = isManager();

  const load = useCallback(async () => {
    try { const { data } = await api.get('/payment-pages'); setPages(data || []); }
    catch (err) { setPages(p => p || []); toast.error(errMsg(err, isRTL, isRTL ? 'تعذّر تحميل صفحات الدفع' : 'Could not load payment pages')); }
  }, [isRTL]);
  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => (pages || []).reduce((t, p) => ({
    open: t.open + (p.closedReason ? 0 : 1),
    pending: t.pending + p.stats.pending,
    collected: t.collected + p.stats.collected
  }), { open: 0, pending: 0, collected: 0 }), [pages]);

  const toggleOpen = async (p) => {
    try {
      const { data } = await api.patch(`/payment-pages/${p.pageId}/open`, { isOpen: !p.isOpen });
      setPages(list => list.map(x => (x.pageId === p.pageId ? data : x)));
      toast.success(data.isOpen ? (isRTL ? 'الصفحة مفتوحة الآن' : 'Page opened') : (isRTL ? 'تم إغلاق الصفحة' : 'Page closed'));
    } catch (err) { toast.error(errMsg(err, isRTL, 'Error')); }
  };
  const remove = async (p) => {
    if (!window.confirm(isRTL ? `حذف صفحة «${p.title}» وكل طلباتها؟` : `Delete "${p.title}" and its requests?`)) return;
    try { await api.delete(`/payment-pages/${p.pageId}`); toast.success(isRTL ? 'تم الحذف' : 'Deleted'); load(); }
    catch (err) { toast.error(errMsg(err, isRTL, 'Error')); }
  };

  return (
    <motion.div className="ppa" dir={isRTL ? 'rtl' : 'ltr'} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="ppa-header">
        <div>
          <span className="ppa-kicker">{isRTL ? 'روابط الدفع · PAYMENT LINKS' : 'PAYMENT LINKS'}</span>
          <h2>{isRTL ? 'صفحات الدفع' : 'Payment pages'}</h2>
          <p>{isRTL ? 'أنشئ صفحة دفع، شارك رابطها الفريد، واستلم الإيصالات وأكّد المدفوعات لتصل الفاتورة للعميل.' : 'Create a payment page, share its unique link, receive receipts and confirm payments — the customer gets the invoice.'}</p>
        </div>
        {manager && !viewing && (
          <button type="button" className="ppa-btn primary big" onClick={() => setEditing('new')}>＋ {isRTL ? 'صفحة دفع جديدة' : 'New payment page'}</button>
        )}
      </div>

      {viewing ? (
        <Submissions isRTL={isRTL} pageId={viewing} manager={manager} onBack={() => { setViewing(null); load(); }} onChanged={load} />
      ) : (
        <>
          <div className="ppa-kpis">
            <div className="ppa-kpi"><b>{pages ? pages.length : '—'}</b><span>{isRTL ? 'صفحة' : 'Pages'}</span></div>
            <div className="ppa-kpi green"><b>{totals.open}</b><span>{isRTL ? 'مفتوحة الآن' : 'Open now'}</span></div>
            <div className={`ppa-kpi amber ${totals.pending ? 'hot' : ''}`}><b>{totals.pending}</b><span>{isRTL ? 'بانتظار التحقق' : 'To review'}</span></div>
            <div className="ppa-kpi"><b dir="ltr">{fmtSAR(totals.collected)}</b><span>{isRTL ? 'ر.س محصّلة' : 'SAR collected'}</span></div>
          </div>

          {!pages ? <div className="ppa-loading">{isRTL ? 'جارٍ التحميل…' : 'Loading…'}</div>
            : !pages.length ? (
              <div className="ppa-empty">
                <span>💳</span>
                <b>{isRTL ? 'لا توجد صفحات دفع بعد' : 'No payment pages yet'}</b>
                {isRTL ? 'أنشئ أول صفحة: العنوان، المبلغ، وعدد الأشخاص — ثم شارك الرابط.' : 'Create one: title, amount and how many people — then share the link.'}
                {manager && <button type="button" className="ppa-btn primary" onClick={() => setEditing('new')}>＋ {isRTL ? 'صفحة دفع جديدة' : 'New payment page'}</button>}
              </div>
            ) : (
              <div className="ppa-cards">
                {pages.map((p, i) => {
                  const state = STATE[p.closedReason || 'open'];
                  const pct = p.maxPayers ? Math.min(100, (p.stats.taken / p.maxPayers) * 100) : 0;
                  return (
                    <motion.article key={p.pageId} className={`ppa-card ${state.cls}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                      <div className="ppa-card-cover">
                        {p.hasCover ? <img src={`${API_BASE}/pay/${p.slug}/cover?v=${new Date(p.updatedAt).getTime()}`} alt="" loading="lazy" /> : <div className="ppa-card-pattern" />}
                        <span className={`ppa-state ${state.cls}`}><i />{isRTL ? state.ar : state.en}</span>
                        {p.stats.pending > 0 && <span className="ppa-pending-badge">{p.stats.pending} {isRTL ? 'بانتظار التحقق' : 'to review'}</span>}
                      </div>
                      <div className="ppa-card-body">
                        <h4>{p.title}</h4>
                        <div className="ppa-card-amount" dir="ltr">
                          <strong>{fmtSAR(p.amount)}</strong> <em>SAR</em>
                          {p.discountPercent > 0 && <><s>{fmtSAR(p.baseAmount)}</s><span className="ppa-off">-{fmtPct(p.discountPercent)}</span></>}
                        </div>
                        <div className="ppa-card-meter">
                          <div className="ppa-card-meter-top">
                            <span>{p.stats.taken}{p.maxPayers ? ` / ${p.maxPayers}` : ''} {isRTL ? 'شخص' : 'people'}</span>
                            <span>{p.stats.verified} {isRTL ? 'مؤكد' : 'verified'} · <b dir="ltr">{fmtSAR(p.stats.collected)}</b></span>
                          </div>
                          {p.maxPayers ? <div className="ppa-meter"><i style={{ width: `${pct}%` }} /></div> : null}
                        </div>
                        {p.closesAt && <div className="ppa-card-deadline">⏰ {isRTL ? 'آخر موعد:' : 'Deadline:'} {fmtDateTime(p.closesAt, isRTL)}</div>}
                        <div className="ppa-link">
                          <span dir="ltr">{p.url.replace(/^https?:\/\//, '')}</span>
                          <button type="button" onClick={() => copyText(p.url, isRTL)} title={isRTL ? 'نسخ' : 'Copy'}>⧉</button>
                          <a href={p.url} target="_blank" rel="noopener noreferrer" title={isRTL ? 'فتح' : 'Open'}>↗</a>
                        </div>
                      </div>
                      <div className="ppa-card-foot">
                        <button type="button" className="ppa-btn primary" onClick={() => setViewing(p.pageId)}>🧾 {isRTL ? 'المدفوعات' : 'Payments'} <i className="ppa-count">{p.stats.taken + p.stats.rejected}</i></button>
                        {manager && (
                          <>
                            <button type="button" className={`ppa-switch small ${p.isOpen ? 'on' : ''}`} onClick={() => toggleOpen(p)} aria-pressed={p.isOpen} title={p.isOpen ? (isRTL ? 'إغلاق الصفحة' : 'Close the page') : (isRTL ? 'فتح الصفحة' : 'Open the page')}>
                              <i />{p.isOpen ? (isRTL ? 'مفتوحة' : 'Open') : (isRTL ? 'مغلقة' : 'Closed')}
                            </button>
                            <button type="button" className="ppa-btn ghost" onClick={() => setEditing(p)} title={isRTL ? 'تعديل' : 'Edit'}>✎</button>
                            <button type="button" className="ppa-btn ghost danger" onClick={() => remove(p)} title={isRTL ? 'حذف' : 'Delete'}>🗑</button>
                          </>
                        )}
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            )}
        </>
      )}

      <AnimatePresence>
        {editing && (
          <PageEditor isRTL={isRTL} page={editing === 'new' ? null : editing} onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); load(); }} />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default PaymentPagesTab;
