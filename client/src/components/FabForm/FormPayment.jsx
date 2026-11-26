import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../config/api';
import { groupIban, prepareReceipt } from '../PaymentPage/receiptFile';

// The payment step inside a FabLab form whose admin linked a payment page
// ("صفحات الدفع"): price (with a discount code), bank transfer with the
// receipt or mada at FabLab, and the page's terms. The form is only sent
// together with this payment (server: fabFormController.submitForm).

const T = {
  ar: {
    title: 'الدفع', sub: 'يُرسل تسجيلك مع الدفع — لا يُقبل التسجيل دون دفع.', total: 'المبلغ', sar: 'ر.س',
    base: 'السعر الأساسي', off: 'خصم', code: 'لديك كود خصم؟', codePh: 'أدخل الكود', apply: 'تطبيق', remove: 'إزالة', codeOk: (p) => `تم تطبيق خصم ${p}%`,
    method: 'طريقة الدفع', bank: 'تحويل بنكي', bankSub: 'حوّل المبلغ وارفع الإيصال', mada: 'مدى في فاب لاب', madaSub: 'ادفع بجهاز مدى عند الحضور',
    bankName: 'البنك', holder: 'اسم المستفيد', iban: 'رقم الآيبان', amount: 'المبلغ', copy: 'نسخ', copied: 'تم النسخ',
    bankMissing: 'بيانات الحساب البنكي غير متوفرة حاليًا — تواصل مع فاب لاب.',
    receipt: 'إيصال التحويل', drop: 'اضغط لرفع صورة الإيصال أو ملف PDF', fileHint: 'صورة أو PDF · حتى 10 ميجابايت', replace: 'تغيير',
    madaTitle: 'الدفع بمدى في مقر فاب لاب', madaDefault: 'احضر إلى فاب لاب الأحساء وادفع المبلغ عبر جهاز مدى، ويُؤكَّد تسجيلك فور الدفع.', address: 'العنوان',
    terms: 'شروط الدفع', agree: 'قرأت شروط الدفع وأوافق عليها',
    free: 'مجاني بالكامل', freeNote: 'حصلت على خصم 100% — لا حاجة لأي دفع أو إيصال.',
    errMethod: 'اختر طريقة الدفع', errProof: 'ارفع إيصال التحويل', errFile: 'الملف يجب أن يكون صورة أو PDF حتى 10 ميجابايت', errTerms: 'يجب الموافقة على شروط الدفع'
  },
  en: {
    title: 'Payment', sub: 'Your registration is sent with the payment — no payment, no registration.', total: 'Amount', sar: 'SAR',
    base: 'Base price', off: 'off', code: 'Have a discount code?', codePh: 'Enter the code', apply: 'Apply', remove: 'Remove', codeOk: (p) => `${p}% discount applied`,
    method: 'Payment method', bank: 'Bank transfer', bankSub: 'Transfer and upload the receipt', mada: 'mada at FabLab', madaSub: 'Pay by card when you arrive',
    bankName: 'Bank', holder: 'Beneficiary', iban: 'IBAN', amount: 'Amount', copy: 'Copy', copied: 'Copied',
    bankMissing: 'Bank details are not available right now — contact FabLab.',
    receipt: 'Transfer receipt', drop: 'Tap to upload the receipt photo or PDF', fileHint: 'Image or PDF · up to 10 MB', replace: 'Change',
    madaTitle: 'Pay by mada at FabLab', madaDefault: 'Visit FabLab Al-Ahsa and pay on the mada machine; your registration is confirmed once paid.', address: 'Address',
    terms: 'Payment terms', agree: 'I have read and agree to the payment terms',
    free: 'Completely free', freeNote: 'You got a 100% discount — no payment or receipt needed.',
    errMethod: 'Choose a payment method', errProof: 'Upload the transfer receipt', errFile: 'The file must be an image or PDF up to 10 MB', errTerms: 'Please accept the payment terms'
  }
};
export const PAY_TEXT = T;

export const fmtSar = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

// What the customer pays now: the page price, less an applied code.
export const payAmountOf = (info, value) => (value?.coupon ? Number(value.coupon.amount) : Number(info?.amount || 0));

// The step's problems before sending ({ method?, proof?, terms? }).
export const checkPayment = (info, value, lang) => {
  const t = T[lang] || T.ar;
  const e = {};
  const free = payAmountOf(info, value) <= 0;
  if (!free && !value.method) e.method = t.errMethod;
  if (!free && value.method === 'bank_transfer' && !value.proof) e.proof = t.errProof;
  if (info.terms && !value.agreed) e.terms = t.errTerms;
  return e;
};

const Svg = ({ children, w = 2 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const ICON = {
  card: <Svg><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19M6.5 15h4" /></Svg>,
  bank: <Svg w={1.8}><path d="M3 10h18L12 4 3 10z" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" /></Svg>,
  pos: <Svg w={1.8}><rect x="5" y="2.5" width="14" height="19" rx="2.5" /><rect x="8" y="5.5" width="8" height="5" rx="1" /><path d="M8.5 14h.01M12 14h.01M15.5 14h.01M8.5 17.5h.01M12 17.5h.01M15.5 17.5h.01" /></Svg>,
  upload: <Svg w={1.8}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></Svg>,
  file: <Svg w={1.8}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></Svg>,
  tick: <Svg w={3}><path d="M20 6 9 17l-5-5" /></Svg>,
  tag: <Svg><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><path d="M7.5 7.5h.01" /></Svg>
};

const CopyRow = ({ label, value, display, t, mono = true }) => {
  const [done, setDone] = useState(false);
  const copy = () => {
    const finish = () => { setDone(true); setTimeout(() => setDone(false), 1500); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(String(value)).then(finish, finish);
    else finish();
  };
  return (
    <div className="ffp-pay-row">
      <span>{label}</span>
      <b dir={mono ? 'ltr' : undefined} className={mono ? 'mono' : ''}>{display || value}</b>
      <button type="button" className={done ? 'done' : ''} onClick={copy}>{done ? t.copied : t.copy}</button>
    </div>
  );
};

const FormPayment = ({ info, value, onChange, errors = {}, lang = 'ar', disabled = false, serverError = '' }) => {
  const t = T[lang] || T.ar;
  const fileRef = useRef(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [fileError, setFileError] = useState('');

  const amount = payAmountOf(info, value);
  const free = amount <= 0;
  const base = Number(info.baseAmount || info.amount || 0);
  const pagePct = Number(info.discountPercent) || 0;
  const struck = (value.coupon || pagePct > 0) && base > amount;
  const methods = info.methods || [];

  const applyCode = async () => {
    const code = codeInput.trim();
    if (!code) return;
    setCodeBusy(true); setCodeError('');
    try {
      const { data } = await api.post(`/pay/${encodeURIComponent(info.slug)}/coupon`, { code });
      onChange({ coupon: data });
      setCodeInput(data.code);
    } catch (err) {
      const d = err?.response?.data;
      onChange({ coupon: null });
      setCodeError((lang === 'ar' ? d?.messageAr : d?.message) || d?.messageAr || '');
    } finally { setCodeBusy(false); }
  };

  const pick = async (file) => {
    if (!file) return;
    const proof = await prepareReceipt(file);
    if (!proof) { setFileError(t.errFile); return; }
    setFileError('');
    onChange({ proof });
  };

  return (
    <section id="ffp-pay" className={`ffp-pay${Object.keys(errors).length || serverError ? ' has-error' : ''}`}>
      <header className="ffp-pay-head">
        <span className="ffp-pay-ico">{ICON.card}</span>
        <div className="ffp-pay-titles">
          <h2>{t.title}</h2>
          <p>{t.sub}</p>
        </div>
        <div className="ffp-pay-total">
          <small>{t.total}</small>
          {free ? <b className="free">{t.free}</b> : <b><span dir="ltr">{fmtSar(amount)}</span> <em>{t.sar}</em></b>}
          {struck && <s dir="ltr">{fmtSar(base)} {t.sar}</s>}
        </div>
      </header>
      <p className="ffp-pay-for">{info.title}</p>

      {/* discount code */}
      <div className="ffp-pay-code">
        {value.coupon ? (
          <div className="ffp-pay-code-ok">
            {ICON.tag}<b dir="ltr">{value.coupon.code}</b><span>{t.codeOk(value.coupon.percent)}</span>
            <button type="button" onClick={() => { onChange({ coupon: null }); setCodeInput(''); }} disabled={disabled}>{t.remove}</button>
          </div>
        ) : codeOpen ? (
          <div className="ffp-pay-code-row">
            <input className="ffp-input" dir="ltr" value={codeInput} onChange={(e) => { setCodeInput(e.target.value.toUpperCase()); setCodeError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCode(); } }} placeholder={t.codePh} disabled={disabled || codeBusy} />
            <button type="button" className="ffp-btn ghost" onClick={applyCode} disabled={disabled || codeBusy || !codeInput.trim()}>{t.apply}</button>
          </div>
        ) : (
          <button type="button" className="ffp-pay-link" onClick={() => setCodeOpen(true)}>{ICON.tag}{t.code}</button>
        )}
        {codeError && <p className="ffp-error" role="alert">{codeError}</p>}
      </div>

      {free ? (
        <div className="ffp-pay-free">{ICON.tick}<span>{t.freeNote}</span></div>
      ) : (
        <>
          <span className="ffp-pay-label">{t.method}</span>
          <div className={`ffp-pay-methods${errors.method ? ' bad' : ''}`} role="radiogroup" aria-label={t.method}>
            {methods.map(m => {
              const on = value.method === m;
              return (
                <button key={m} type="button" role="radio" aria-checked={on} className={`ffp-pay-method${on ? ' on' : ''}`}
                  onClick={() => onChange({ method: m })} disabled={disabled}>
                  <span className="ffp-pay-method-ico">{m === 'mada' ? ICON.pos : ICON.bank}</span>
                  <span className="ffp-pay-method-text"><b>{m === 'mada' ? t.mada : t.bank}</b><small>{m === 'mada' ? t.madaSub : t.bankSub}</small></span>
                  <i className="ffp-dot" aria-hidden="true" />
                </button>
              );
            })}
          </div>
          {errors.method && <p className="ffp-error" role="alert">{errors.method}</p>}

          <AnimatePresence initial={false} mode="wait">
            {value.method === 'bank_transfer' && (
              <motion.div key="bank" className="ffp-pay-panel" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {info.bank?.iban ? (
                  <div className="ffp-pay-slip">
                    {info.bank.bankName && <CopyRow label={t.bankName} value={info.bank.bankName} t={t} mono={false} />}
                    {info.bank.accountHolder && <CopyRow label={t.holder} value={info.bank.accountHolder} t={t} mono={false} />}
                    <CopyRow label={t.iban} value={String(info.bank.iban).replace(/\s+/g, '')} display={groupIban(info.bank.iban)} t={t} />
                    <CopyRow label={t.amount} value={fmtSar(amount)} display={`${fmtSar(amount)} ${t.sar}`} t={t} />
                    {info.bank.additionalInfo && <p className="ffp-pay-note">{info.bank.additionalInfo}</p>}
                  </div>
                ) : <p className="ffp-pay-note warn">{t.bankMissing}</p>}

                <span className="ffp-pay-label">{t.receipt} <b className="ffp-req">*</b></span>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" hidden
                  onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
                {value.proof ? (
                  <div className="ffp-pay-file">
                    {value.proof.isImage ? <img src={value.proof.dataUrl} alt="" /> : <span className="ffp-pay-file-ico">{ICON.file}</span>}
                    <span className="ffp-pay-file-name"><b>{value.proof.name}</b><small>{Math.max(1, Math.round(value.proof.size / 1024))} KB</small></span>
                    <button type="button" className="ffp-btn ghost" onClick={() => fileRef.current?.click()} disabled={disabled}>{t.replace}</button>
                  </div>
                ) : (
                  <button type="button" className={`ffp-pay-drop${errors.proof || fileError ? ' bad' : ''}`} onClick={() => fileRef.current?.click()} disabled={disabled}
                    onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}>
                    {ICON.upload}<b>{t.drop}</b><small>{t.fileHint}</small>
                  </button>
                )}
                {(fileError || errors.proof) && <p className="ffp-error" role="alert">{fileError || errors.proof}</p>}
              </motion.div>
            )}
            {value.method === 'mada' && (
              <motion.div key="mada" className="ffp-pay-panel ffp-pay-mada" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <b>{info.mada?.title || t.madaTitle}</b>
                <p>{info.mada?.instructions || t.madaDefault}</p>
                {info.mada?.address && <p className="ffp-pay-addr"><span>{t.address}:</span> {info.mada.address}</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {info.terms && (
        <div className="ffp-pay-terms">
          <span className="ffp-pay-label">{t.terms}</span>
          <div className="ffp-terms-box" tabIndex={0}>{info.terms}</div>
          <label className={`ffp-consent ffp-terms-agree${value.agreed ? ' on' : ''}`}>
            <input type="checkbox" checked={!!value.agreed} onChange={() => onChange({ agreed: !value.agreed })} disabled={disabled} />
            <i className="ffp-box" aria-hidden="true">{ICON.tick}</i>
            <span className="ffp-consent-text"><strong>{t.agree}</strong></span>
          </label>
          {errors.terms && <p className="ffp-error" role="alert">{errors.terms}</p>}
        </div>
      )}

      {serverError && <div className="ffp-banner" role="alert">{serverError}</div>}
    </section>
  );
};

export default FormPayment;
