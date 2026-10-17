import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../config/api';
import './PaymentPage.css';

// Public checkout behind a payment link (/pay/:slug): a "ticket" with the
// amount + availability, and a one-page checkout — details, payment
// method (bank transfer with the receipt, or mada at FabLab), confirm.

const API_BASE = String(api.defaults.baseURL || '/api').replace(/\/$/, '');
const API_ORIGIN = API_BASE.replace(/\/api$/, '');
const MAX_FILE = 10 * 1024 * 1024;

const T = {
  ar: {
    secure: 'دفع آمن', kicker: 'صفحة دفع', amountDue: 'المبلغ المطلوب', sar: 'ر.س',
    seatsLeft: (n, m) => `${n} من ${m} مقاعد متبقية`, unlimited: 'متاح للجميع', closesAt: 'يُغلق', readMore: 'عرض المزيد', readLess: 'عرض أقل',
    trust1: 'تحقق يدوي من فريق فاب لاب', trust2: 'فاتورة رسمية بعد التأكيد',
    s1: 'بياناتك', s2: 'طريقة الدفع', s3: 'التأكيد',
    name: 'الاسم الكامل', namePh: 'كما يظهر في الهوية', phone: 'رقم الجوال', email: 'البريد الإلكتروني', emailHint: 'تصلك عليه الفاتورة',
    addNote: '+ إضافة ملاحظة', note: 'ملاحظة (اختياري)',
    bank: 'تحويل بنكي', bankSub: 'حوّل المبلغ وارفع الإيصال', mada: 'مدى في فاب لاب', madaSub: 'ادفع بجهاز مدى عند الحضور',
    bankName: 'البنك', holder: 'اسم المستفيد', iban: 'رقم الآيبان', amount: 'المبلغ', copy: 'نسخ', copied: 'تم النسخ',
    bankMissing: 'بيانات الحساب البنكي غير متوفرة حالياً — تواصل مع فاب لاب.',
    upload: 'إيصال التحويل', drop: 'اسحب الإيصال هنا أو', choose: 'اختر ملفاً', fileHint: 'صورة أو PDF · حتى 10 ميجابايت', replace: 'تغيير', remove: 'إزالة',
    madaTitle: 'الدفع بمدى في مقر فاب لاب', madaDefault: 'احضر إلى فاب لاب الأحساء وادفع المبلغ عبر جهاز مدى. يتم تأكيد طلبك فور الدفع.', address: 'العنوان',
    terms: 'الشروط والأحكام', agree: 'قرأت الشروط وأوافق عليها', total: 'الإجمالي', totalAfter: 'الإجمالي بعد الخصم',
    base: 'التكلفة الأساسية', discount: 'الخصم', off: 'خصم',
    payBank: (a) => `إرسال الإيصال · ${a} ر.س`, payMada: 'تأكيد الطلب والدفع بمدى', sending: 'جارٍ الإرسال…',
    footnote: 'تُراجع كل دفعة يدوياً من فريق فاب لاب الأحساء، وتصلك الفاتورة على بريدك بعد التأكيد.',
    errName: 'اكتب اسمك الكامل', errPhone: 'رقم جوال غير صحيح', errEmail: 'بريد إلكتروني غير صحيح', errMethod: 'اختر طريقة الدفع', errProof: 'ارفع إيصال التحويل', errTerms: 'يرجى الموافقة على الشروط',
    errFile: 'الملف يجب أن يكون صورة أو PDF بحجم لا يتجاوز 10 ميجابايت', errGeneric: 'تعذّر إرسال الطلب — حاول مرة أخرى',
    okTitle: 'تم استلام طلبك', okBank: 'استلمنا إيصال التحويل وسيتحقق منه فريق فاب لاب. تصلك الفاتورة على بريدك بعد التأكيد.',
    okMada: 'احضر إلى فاب لاب الأحساء وادفع المبلغ عبر جهاز مدى مع ذكر رقم المرجع. تصلك الفاتورة بعد الدفع.',
    reference: 'رقم المرجع', status: 'الحالة', pending: 'بانتظار التحقق', method: 'طريقة الدفع', viewReceipt: 'عرض الإيصال', saveRef: 'احتفظ برقم المرجع لأي استفسار',
    closed: { closed: ['الصفحة مغلقة حالياً', 'أوقفت إدارة فاب لاب استقبال المدفوعات على هذه الصفحة.'], expired: ['انتهى موعد الدفع', 'لم تعد هذه الصفحة تستقبل مدفوعات.'], full: ['اكتمل العدد', 'تم حجز جميع المقاعد المتاحة لهذه الصفحة.'] },
    stamp: { closed: 'مغلقة', expired: 'منتهية', full: 'مكتملة' }, contact: 'للاستفسار تواصل مع فاب لاب الأحساء',
    notFound: 'رابط الدفع غير صحيح', notFoundSub: 'تأكد من الرابط أو تواصل مع فاب لاب الأحساء.', loadError: 'تعذّر تحميل صفحة الدفع',
    lang: 'English', footer: 'فاب لاب الأحساء · مؤسسة عبدالمنعم الراشد الإنسانية'
  },
  en: {
    secure: 'Secure payment', kicker: 'Payment page', amountDue: 'Amount due', sar: 'SAR',
    seatsLeft: (n, m) => `${n} of ${m} places left`, unlimited: 'Open to everyone', closesAt: 'Closes', readMore: 'Read more', readLess: 'Show less',
    trust1: 'Verified by the FabLab team', trust2: 'Official invoice after confirmation',
    s1: 'Your details', s2: 'Payment method', s3: 'Confirm',
    name: 'Full name', namePh: 'As on your ID', phone: 'Mobile number', email: 'Email', emailHint: 'Your invoice is sent here',
    addNote: '+ Add a note', note: 'Note (optional)',
    bank: 'Bank transfer', bankSub: 'Transfer, then upload the receipt', mada: 'mada at FabLab', madaSub: 'Pay by card machine on site',
    bankName: 'Bank', holder: 'Beneficiary', iban: 'IBAN', amount: 'Amount', copy: 'Copy', copied: 'Copied',
    bankMissing: 'Bank details are not available right now — please contact FabLab.',
    upload: 'Transfer receipt', drop: 'Drop the receipt here or', choose: 'choose a file', fileHint: 'Image or PDF · up to 10 MB', replace: 'Change', remove: 'Remove',
    madaTitle: 'Pay by mada at FabLab', madaDefault: 'Visit FabLab Al-Ahsa and pay the amount on the mada machine. Your payment is confirmed right away.', address: 'Address',
    terms: 'Terms & conditions', agree: 'I have read and accept the terms', total: 'Total', totalAfter: 'Total after discount',
    base: 'Main cost', discount: 'Discount', off: 'off',
    payBank: (a) => `Send receipt · ${a} SAR`, payMada: 'Confirm & pay by mada', sending: 'Sending…',
    footnote: 'Every payment is reviewed by the FabLab Al-Ahsa team; your invoice is emailed once it is confirmed.',
    errName: 'Enter your full name', errPhone: 'Invalid mobile number', errEmail: 'Invalid email', errMethod: 'Choose a payment method', errProof: 'Upload the transfer receipt', errTerms: 'Please accept the terms',
    errFile: 'The file must be an image or PDF up to 10 MB', errGeneric: 'Could not send — please try again',
    okTitle: 'Request received', okBank: 'We received your transfer receipt; the FabLab team will verify it and email your invoice.',
    okMada: 'Visit FabLab Al-Ahsa and pay on the mada machine, quoting your reference. Your invoice follows the payment.',
    reference: 'Reference', status: 'Status', pending: 'Pending review', method: 'Method', viewReceipt: 'View receipt', saveRef: 'Keep your reference for any enquiry',
    closed: { closed: ['This page is closed', 'FabLab has stopped taking payments on this page.'], expired: ['The deadline has passed', 'This page no longer takes payments.'], full: ['All places are taken', 'Every available place on this page has been booked.'] },
    stamp: { closed: 'CLOSED', expired: 'EXPIRED', full: 'FULL' }, contact: 'For enquiries contact FabLab Al-Ahsa',
    notFound: 'Invalid payment link', notFoundSub: 'Check the link or contact FabLab Al-Ahsa.', loadError: 'Could not load the payment page',
    lang: 'العربية', footer: 'FABLAB Al-Ahsa · Abdulmonem Al-Rashed Humanitarian Foundation'
  }
};

const fmtAmount = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (p) => `${Number(p).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
const groupIban = (iban) => String(iban || '').replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();

// Phone photos of receipts are big — shrink images before upload.
const readFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = reject;
  reader.readAsDataURL(file);
});
const compressImage = (dataUrl, maxSide = 1800, quality = 0.85) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    resolve(canvas.toDataURL('image/jpeg', quality));
  };
  img.onerror = () => resolve(dataUrl);
  img.src = dataUrl;
});

const Icon = {
  lock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>,
  bank: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10h18L12 4 3 10z"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 20h18"/></svg>,
  card: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2.5" width="14" height="19" rx="2.5"/><rect x="8" y="5.5" width="8" height="5" rx="1"/><path d="M8.5 14h.01M12 14h.01M15.5 14h.01M8.5 17.5h.01M12 17.5h.01M15.5 17.5h.01"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>,
  upload: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>,
  file: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>,
  clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>,
  receipt: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2.5h12v19l-3-2-3 2-3-2-3 2z"/><path d="M9 7.5h6M9 11.5h6M9 15.5h4"/></svg>,
  arrow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
};

const CopyRow = ({ label, value, display, t, mono = true }) => {
  const [done, setDone] = useState(false);
  const copy = () => {
    const finish = () => { setDone(true); setTimeout(() => setDone(false), 1600); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(String(value)).then(finish, finish);
    else finish();
  };
  return (
    <div className="pp-slip-row">
      <span className="pp-slip-label">{label}</span>
      <span className={`pp-slip-value ${mono ? 'mono' : ''}`} dir={mono ? 'ltr' : undefined}>{display || value}</span>
      <button type="button" className={`pp-copy ${done ? 'done' : ''}`} onClick={copy} aria-label={`${t.copy} ${label}`}>
        {done ? <>{Icon.check}<span>{t.copied}</span></> : <span>{t.copy}</span>}
      </button>
    </div>
  );
};

const Section = ({ n, title, children, delay = 0 }) => (
  <motion.section className="pp-step" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}>
    <header className="pp-step-head"><span className="pp-step-n">{n}</span><h2>{title}</h2></header>
    {children}
  </motion.section>
);

const PaymentPage = () => {
  const { slug } = useParams();
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ar';
  const t = T[lang];
  const isRTL = lang === 'ar';

  const [page, setPage] = useState(null);
  const [loadState, setLoadState] = useState('loading'); // loading | ready | notfound | error
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', note: '' });
  const [showNote, setShowNote] = useState(false);
  const [method, setMethod] = useState('');
  const [proof, setProof] = useState(null); // { name, type, size, dataUrl, isImage }
  const [dragging, setDragging] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [result, setResult] = useState(null);
  const [descOpen, setDescOpen] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    let alive = true;
    setLoadState('loading');
    api.get(`/pay/${encodeURIComponent(slug)}`)
      .then(({ data }) => {
        if (!alive) return;
        setPage(data);
        setLoadState('ready');
        if (data.methods?.length === 1) setMethod(data.methods[0]);
        document.title = `${data.title} · FABLAB Al-Ahsa`;
      })
      .catch(err => { if (alive) setLoadState(err?.response?.status === 404 ? 'notfound' : 'error'); });
    return () => { alive = false; };
  }, [slug]);

  const closed = page && !page.isOpen ? page.closedReason || 'closed' : null;
  const amountStr = page ? fmtAmount(page.amount) : '';
  const hasDiscount = !!page && Number(page.discountPercent) > 0 && Number(page.baseAmount) > Number(page.amount);
  const pctStr = hasDiscount ? fmtPct(page.discountPercent) : '';
  const taken = page?.maxPayers ? page.maxPayers - (page.seatsLeft ?? 0) : 0;
  const deadline = useMemo(() => {
    if (!page?.closesAt) return '';
    return new Date(page.closesAt).toLocaleString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {
      timeZone: 'Asia/Riyadh', weekday: 'short', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit'
    });
  }, [page, isRTL]);
  const longDesc = (page?.description || '').length > 220;

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); };

  const pickFile = async (file) => {
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const isImage = /^image\/(png|jpe?g|webp)$/.test(file.type) || ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
    const isPdf = file.type === 'application/pdf' || ext === 'pdf';
    if ((!isImage && !isPdf) || (isPdf && file.size > MAX_FILE)) {
      setErrors(e => ({ ...e, proof: t.errFile }));
      return;
    }
    let dataUrl = await readFile(file);
    let type = isPdf ? 'pdf' : (ext === 'png' ? 'png' : ext === 'webp' ? 'webp' : 'jpg');
    if (isImage && file.size > 1.2 * 1024 * 1024) { dataUrl = await compressImage(dataUrl); type = 'jpg'; }
    if (dataUrl.length * 0.75 > MAX_FILE) { setErrors(e => ({ ...e, proof: t.errFile })); return; }
    setProof({ name: file.name, type, size: Math.round(dataUrl.length * 0.75), dataUrl, isImage });
    setErrors(e => ({ ...e, proof: undefined }));
  };

  const validate = () => {
    const e = {};
    if (form.fullName.trim().length < 3) e.fullName = t.errName;
    if (form.phone.replace(/\D/g, '').length < 9) e.phone = t.errPhone;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = t.errEmail;
    if (!method) e.method = t.errMethod;
    if (method === 'bank_transfer' && !proof) e.proof = t.errProof;
    if (page?.terms && !agreed) e.terms = t.errTerms;
    setErrors(e);
    if (Object.keys(e).length) {
      const first = document.querySelector(`[data-field="${Object.keys(e)[0]}"]`);
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return !Object.keys(e).length;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setServerError('');
    if (!validate()) return;
    setSubmitting(true);
    try {
      const { data } = await api.post(`/pay/${encodeURIComponent(slug)}`, {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        note: form.note.trim() || undefined,
        method,
        termsAccepted: agreed,
        proof: method === 'bank_transfer' && proof
          ? { fileName: proof.name.replace(/\.[^.]+$/, '') + '.' + proof.type, fileType: proof.type, fileData: proof.dataUrl }
          : undefined
      });
      setResult(data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const d = err?.response?.data;
      if (d?.code === 'CLOSED') setPage(p => ({ ...p, isOpen: false, closedReason: d.closedReason }));
      setServerError((isRTL ? d?.messageAr : d?.message) || t.errGeneric);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleLang = () => i18n.changeLanguage(lang === 'ar' ? 'en' : 'ar');

  const shell = (children) => (
    <div className="pp" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="pp-bg" aria-hidden="true"><div className="pp-bg-band" /><div className="pp-bg-grid" /></div>
      <header className="pp-top">
        <div className="pp-brand">
          <img src="/fablab.png" alt="FabLab Al-Ahsa" />
          <span className="pp-brand-sep" />
          <img src="/found.png" alt="" />
        </div>
        <div className="pp-top-actions">
          <span className="pp-secure">{Icon.lock}{t.secure}</span>
          <button type="button" className="pp-lang" onClick={toggleLang}>{t.lang}</button>
        </div>
      </header>
      {children}
      <footer className="pp-foot">{t.footer}</footer>
    </div>
  );

  if (loadState === 'loading') {
    return shell(
      <main className="pp-main">
        <div className="pp-ticket pp-skel" />
        <div className="pp-checkout pp-skel-light"><div /><div /><div /></div>
      </main>
    );
  }
  if (loadState !== 'ready') {
    return shell(
      <main className="pp-main pp-main--single">
        <motion.div className="pp-empty" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="pp-empty-icon">{Icon.receipt}</div>
          <h1>{loadState === 'notfound' ? t.notFound : t.loadError}</h1>
          <p>{t.notFoundSub}</p>
        </motion.div>
      </main>
    );
  }

  const coverSrc = page.cover ? `${API_BASE}${page.cover}` : null;

  return shell(
    <main className="pp-main">
      {/* ─────────── Ticket: what you pay for ─────────── */}
      <motion.aside
        className={`pp-ticket ${coverSrc ? 'has-cover' : ''}`}
        initial={{ opacity: 0, y: 24, rotate: isRTL ? 1.2 : -1.2 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        {coverSrc && (
          <div className="pp-cover">
            <img src={coverSrc} alt="" />
          </div>
        )}
        <div className="pp-ticket-body">
          <span className="pp-kicker"><i />{t.kicker} · FABLAB {isRTL ? 'الأحساء' : 'Al-Ahsa'}</span>
          <h1 className="pp-title">{page.title}</h1>
          {page.description && (
            <div className={`pp-desc ${longDesc && !descOpen ? 'clamped' : ''}`}>
              <p>{page.description}</p>
            </div>
          )}
          {longDesc && (
            <button type="button" className="pp-more" onClick={() => setDescOpen(o => !o)}>{descOpen ? t.readLess : t.readMore}</button>
          )}

          <div className="pp-facts">
            {page.maxPayers ? (
              <div className="pp-fact">
                <span className="pp-fact-ico">{Icon.users}</span>
                <div className="pp-fact-main">
                  <span>{t.seatsLeft(page.seatsLeft, page.maxPayers)}</span>
                  <div className="pp-meter" role="progressbar" aria-valuemin={0} aria-valuemax={page.maxPayers} aria-valuenow={taken}>
                    <motion.i initial={{ width: 0 }} animate={{ width: `${Math.min(100, (taken / page.maxPayers) * 100)}%` }} transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="pp-fact"><span className="pp-fact-ico">{Icon.users}</span><span>{t.unlimited}</span></div>
            )}
            {deadline && (
              <div className="pp-fact"><span className="pp-fact-ico">{Icon.clock}</span><span>{t.closesAt}: <b>{deadline}</b></span></div>
            )}
          </div>
        </div>

        <div className="pp-perf" aria-hidden="true" />

        <div className="pp-amount">
          <span className="pp-amount-label">{t.amountDue}</span>
          {hasDiscount && (
            <div className="pp-was">
              <s dir="ltr">{fmtAmount(page.baseAmount)} {t.sar}</s>
              <span className="pp-off-badge">{isRTL ? <>{t.off} <bdi dir="ltr">{pctStr}</bdi></> : <><bdi dir="ltr">{pctStr}</bdi> {t.off}</>}</span>
            </div>
          )}
          <div className="pp-amount-value">
            <strong dir="ltr">{amountStr}</strong>
            <em>{t.sar}</em>
          </div>
          <ul className="pp-trust">
            <li>{Icon.shield}{t.trust1}</li>
            <li>{Icon.receipt}{t.trust2}</li>
          </ul>
        </div>

        {closed && (
          <motion.div className="pp-stamp" initial={{ scale: 1.6, opacity: 0, rotate: -24 }} animate={{ scale: 1, opacity: 1, rotate: -14 }} transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.3 }}>
            {t.stamp[closed] || t.stamp.closed}
          </motion.div>
        )}
      </motion.aside>

      {/* ─────────── Checkout ─────────── */}
      <div className="pp-checkout">
        <AnimatePresence mode="wait">
          {result ? (
            <motion.div key="done" className="pp-done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="pp-done-mark">
                <svg viewBox="0 0 52 52" aria-hidden="true">
                  <motion.circle cx="26" cy="26" r="23" fill="none" strokeWidth="3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6 }} />
                  <motion.path d="M15 27l7 7 15-15" fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.5 }} />
                </svg>
              </div>
              <motion.h2 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>{t.okTitle}</motion.h2>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="pp-done-text">
                {result.method === 'mada' ? t.okMada : t.okBank}
              </motion.p>

              <div className="pp-slot">
                <motion.div className="pp-receipt" initial={{ y: '-105%' }} animate={{ y: 0 }} transition={{ duration: 1.1, delay: 0.75, ease: [0.22, 1, 0.36, 1] }}>
                  <div className="pp-receipt-ref">
                    <span>{t.reference}</span>
                    <strong dir="ltr">{result.reference}</strong>
                  </div>
                  <div className="pp-receipt-rows">
                    <div><span>{t.amount}</span><b dir="ltr">{fmtAmount(result.amount)} {t.sar}</b></div>
                    <div><span>{t.method}</span><b>{result.method === 'mada' ? t.mada : t.bank}</b></div>
                    <div><span>{t.status}</span><b className="pp-chip">{t.pending}</b></div>
                  </div>
                  <div className="pp-receipt-edge" aria-hidden="true" />
                </motion.div>
              </div>

              <motion.div className="pp-done-actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}>
                <a className="pp-btn-ghost" href={`${API_ORIGIN}${result.receiptUrl}`} target="_blank" rel="noopener noreferrer">{Icon.receipt}{t.viewReceipt}</a>
                <span>{t.saveRef}</span>
              </motion.div>
            </motion.div>
          ) : closed ? (
            <motion.div key="closed" className="pp-closed" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <div className="pp-closed-icon">{Icon.lock}</div>
              <h2>{(t.closed[closed] || t.closed.closed)[0]}</h2>
              <p>{(t.closed[closed] || t.closed.closed)[1]}</p>
              <small>{t.contact}</small>
            </motion.div>
          ) : (
            <motion.form key="form" className="pp-form" onSubmit={submit} noValidate initial={{ opacity: 1 }} exit={{ opacity: 0, y: -10 }}>
              <Section n="01" title={t.s1} delay={0.15}>
                <div className="pp-fields">
                  <label className={`pp-field pp-span ${errors.fullName ? 'bad' : ''}`} data-field="fullName">
                    <span>{t.name}</span>
                    <input value={form.fullName} onChange={e => set('fullName', e.target.value)} placeholder={t.namePh} autoComplete="name" maxLength={150} />
                    {errors.fullName && <em>{errors.fullName}</em>}
                  </label>
                  <label className={`pp-field ${errors.phone ? 'bad' : ''}`} data-field="phone">
                    <span>{t.phone}</span>
                    <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="05XXXXXXXX" inputMode="tel" autoComplete="tel" dir="ltr" maxLength={20} />
                    {errors.phone && <em>{errors.phone}</em>}
                  </label>
                  <label className={`pp-field ${errors.email ? 'bad' : ''}`} data-field="email">
                    <span>{t.email}</span>
                    <input value={form.email} onChange={e => set('email', e.target.value)} placeholder="name@example.com" inputMode="email" autoComplete="email" dir="ltr" maxLength={150} />
                    {errors.email ? <em>{errors.email}</em> : <small>{t.emailHint}</small>}
                  </label>
                  {showNote ? (
                    <label className="pp-field pp-span">
                      <span>{t.note}</span>
                      <textarea rows={2} value={form.note} onChange={e => set('note', e.target.value)} maxLength={1000} />
                    </label>
                  ) : (
                    <button type="button" className="pp-link pp-span" onClick={() => setShowNote(true)}>{t.addNote}</button>
                  )}
                </div>
              </Section>

              <Section n="02" title={t.s2} delay={0.25}>
                <div className={`pp-methods ${page.methods.length === 1 ? 'single' : ''}`} data-field="method" role="radiogroup" aria-label={t.s2}>
                  {page.methods.includes('bank_transfer') && (
                    <button type="button" role="radio" aria-checked={method === 'bank_transfer'} className={`pp-method ${method === 'bank_transfer' ? 'on' : ''}`} onClick={() => { setMethod('bank_transfer'); setErrors(e => ({ ...e, method: undefined })); }}>
                      <span className="pp-method-ico">{Icon.bank}</span>
                      <span className="pp-method-txt"><b>{t.bank}</b><small>{t.bankSub}</small></span>
                      <span className="pp-radio">{Icon.check}</span>
                    </button>
                  )}
                  {page.methods.includes('mada') && (
                    <button type="button" role="radio" aria-checked={method === 'mada'} className={`pp-method ${method === 'mada' ? 'on' : ''}`} onClick={() => { setMethod('mada'); setErrors(e => ({ ...e, method: undefined })); }}>
                      <span className="pp-method-ico">{Icon.card}</span>
                      <span className="pp-method-txt"><b>{t.mada}</b><small>{t.madaSub}</small></span>
                      <span className="pp-radio">{Icon.check}</span>
                    </button>
                  )}
                </div>
                {errors.method && <p className="pp-err">{errors.method}</p>}

                <AnimatePresence initial={false} mode="wait">
                  {method === 'bank_transfer' && (
                    <motion.div key="bank" className="pp-panel" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
                      {page.bank?.iban ? (
                        <div className="pp-slip">
                          {page.bank.bankName && <CopyRow label={t.bankName} value={page.bank.bankName} t={t} mono={false} />}
                          {page.bank.accountHolder && <CopyRow label={t.holder} value={page.bank.accountHolder} t={t} mono={false} />}
                          <CopyRow label={t.iban} value={String(page.bank.iban).replace(/\s+/g, '')} display={groupIban(page.bank.iban)} t={t} />
                          <CopyRow label={t.amount} value={Number(page.amount).toFixed(2)} display={`${amountStr} ${t.sar}`} t={t} />
                          {page.bank.additionalInfo && <p className="pp-slip-note">{page.bank.additionalInfo}</p>}
                        </div>
                      ) : (
                        <p className="pp-warn">{t.bankMissing}</p>
                      )}

                      <div className="pp-upload-label" data-field="proof">{t.upload}</div>
                      {proof ? (
                        <div className="pp-file">
                          {proof.isImage ? <img src={proof.dataUrl} alt="" /> : <span className="pp-file-ico">{Icon.file}</span>}
                          <div className="pp-file-meta">
                            <b>{proof.name}</b>
                            <small dir="ltr">{(proof.size / 1024 / 1024).toFixed(2)} MB</small>
                          </div>
                          <button type="button" className="pp-link" onClick={() => fileRef.current?.click()}>{t.replace}</button>
                          <button type="button" className="pp-link danger" onClick={() => setProof(null)}>{t.remove}</button>
                        </div>
                      ) : (
                        <div
                          className={`pp-drop ${dragging ? 'over' : ''} ${errors.proof ? 'bad' : ''}`}
                          onDragOver={e => { e.preventDefault(); setDragging(true); }}
                          onDragLeave={() => setDragging(false)}
                          onDrop={e => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]); }}
                          onClick={() => fileRef.current?.click()}
                          role="button" tabIndex={0}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
                        >
                          <span className="pp-drop-ico">{Icon.upload}</span>
                          <span>{t.drop} <u>{t.choose}</u></span>
                          <small>{t.fileHint}</small>
                        </div>
                      )}
                      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" hidden onChange={e => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
                      {errors.proof && <p className="pp-err">{errors.proof}</p>}
                    </motion.div>
                  )}
                  {method === 'mada' && (
                    <motion.div key="mada" className="pp-panel" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
                      <div className="pp-mada">
                        <span className="pp-mada-ico">{Icon.card}</span>
                        <div>
                          <b>{page.mada?.title || t.madaTitle}</b>
                          <p>{page.mada?.instructions || t.madaDefault}</p>
                          {page.mada?.address && <p className="pp-mada-addr"><span>{t.address}:</span> {page.mada.address}</p>}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Section>

              <Section n="03" title={t.s3} delay={0.35}>
                {page.terms && (
                  <div className={`pp-terms ${errors.terms ? 'bad' : ''}`} data-field="terms">
                    <div className="pp-terms-text"><b>{t.terms}</b><p>{page.terms}</p></div>
                    <label className="pp-check">
                      <input type="checkbox" checked={agreed} onChange={e => { setAgreed(e.target.checked); setErrors(er => ({ ...er, terms: undefined })); }} />
                      <span className="pp-check-box">{Icon.check}</span>
                      <span>{t.agree}</span>
                    </label>
                  </div>
                )}
                {hasDiscount && (
                  <div className="pp-breakdown">
                    <div><span>{t.base}</span><b dir="ltr">{fmtAmount(page.baseAmount)} {t.sar}</b></div>
                    <div className="off"><span>{t.discount} (<bdi dir="ltr">{pctStr}</bdi>)</span><b dir="ltr">- {fmtAmount(page.discountValue)} {t.sar}</b></div>
                  </div>
                )}
                <div className="pp-total">
                  <span>{hasDiscount ? t.totalAfter : t.total}</span>
                  <strong dir="ltr">{amountStr} <em>{t.sar}</em></strong>
                </div>
                {serverError && <p className="pp-server-err" role="alert">{serverError}</p>}
                <motion.button type="submit" className="pp-pay" disabled={submitting} whileTap={{ scale: 0.985 }}>
                  {submitting ? <><span className="pp-spin" />{t.sending}</> : <>{method === 'mada' ? t.payMada : t.payBank(amountStr)}<span className="pp-pay-arrow">{Icon.arrow}</span></>}
                </motion.button>
                <p className="pp-footnote">{Icon.lock}{t.footnote}</p>
              </Section>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
};

export default PaymentPage;
