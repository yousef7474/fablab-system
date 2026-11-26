import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import axios from 'axios';
import EducationTeacherForm from './EducationTeacherForm';
import StudioShell, { Icon, useStudioTheme } from '../RegistrationForm/StudioShell';
import './WorkshopRegistration.css';

const API_URL = process.env.NODE_ENV === 'production' ? '/api' : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');
const api = axios.create({ baseURL: API_URL });

// Persist the in-progress form so a refresh doesn't wipe what the
// customer typed. Cleared once the registration is successfully
// submitted (step 3). Keyed with a version so we can invalidate the
// cache when the shape changes.
const DRAFT_STORAGE_KEY = 'fablab_workshop_reg_draft_v1';
const _readDraft = () => {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (!draft || typeof draft !== 'object') return null;
    return draft;
  } catch { return null; }
};
const _clearDraft = () => {
  try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch {}
};

// Stroke icons (24-unit grid) used on this page.
const IC = {
  user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  userPlus: ['M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M20 8v6', 'M23 11h-6'],
  users: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  cap: ['M22 10L12 5 2 10l10 5 10-5z', 'M6 12v5c3 2 9 2 12 0v-5'],
  card: ['M2 5h20v14H2z', 'M2 10h20'],
  mada: ['M2 5h20v14H2z', 'M2 10h20', 'M6 15h4'],
  bank: ['M3 21h18', 'M3 10h18', 'M5 6l7-3 7 3', 'M4 10v11', 'M20 10v11', 'M8 14v3', 'M12 14v3', 'M16 14v3'],
  badge: ['M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M8.21 13.89 7 23l5-3 5 3-1.21-9.12'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35'],
  check: ['M20 6 9 17l-5-5'],
  cal: ['M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M16 2v4', 'M8 2v4', 'M3 10h18'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  timer: ['M10 2h4', 'M12 14l3-3', 'M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z'],
  tag: ['M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z', 'M7 7h.01'],
  copy: ['M9 9h11v11H9z', 'M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1'],
  upload: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12'],
  camera: ['M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z', 'M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  idcard: ['M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M9 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', 'M14 10h4', 'M14 14h4', 'M6 17c.6-1.6 1.8-2.5 3-2.5s2.4.9 3 2.5'],
  bag: ['M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', 'M9 6V4a3 3 0 0 1 6 0v2', 'M8 14h8'],
  board: ['M2 3h20', 'M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3', 'M7 21l5-5 5 5'],
  pin: ['M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z', 'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  alert: ['M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01'],
  pause: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M10 15V9', 'M14 15V9'],
  gift: ['M20 12v10H4V12', 'M2 7h20v5H2z', 'M12 22V7', 'M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z', 'M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z'],
  home: ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
  grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
  left: ['M19 12H5', 'M12 19l-7-7 7-7'],
  right: ['M5 12h14', 'M12 5l7 7-7 7']
};

const WorkshopRegistration = () => {
  const navigate = useNavigate();
  const [theme, toggleTheme] = useStudioTheme();
  const { workshopId: routeWorkshopId } = useParams();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  // When true, the customer arrived via /workshop/:id — a shareable
  // education-workshop URL. We fetch just that workshop, skip the
  // picker step, and show a closed banner if registration is off.
  const isSingleMode = !!routeWorkshopId;
  const [singleWorkshopMeta, setSingleWorkshopMeta] = useState(null); // { closedReason, isOpen, ... }
  const [singleFetchError, setSingleFetchError] = useState(null);
  // Education links offer two registrations: a student (the existing
  // steps) or a teacher / instructor (EducationTeacherForm). Remembered
  // per workshop for this tab.
  const roleKey = `fablab_edu_role_${routeWorkshopId || ''}`;
  const [eduRole, setEduRoleState] = useState(() => {
    try { return sessionStorage.getItem(roleKey) || null; } catch { return null; }
  });
  const setEduRole = (r) => {
    setEduRoleState(r);
    try { if (r) sessionStorage.setItem(roleKey, r); else sessionStorage.removeItem(roleKey); } catch { /* private mode */ }
  };

  // Read any saved draft ONCE on mount so a refresh restores the
  // exact step + typed fields + selected workshop.
  const _initialDraft = _readDraft();

  const [step, setStep] = useState(_initialDraft?.step ?? 0);
  const [workshops, setWorkshops] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  // Age is verified from a photo of the National ID / Iqama for every
  // workshop except Education ones (the shareable /workshop/:id links).
  // The public page only lists non-education workshops.
  const requireId = isSingleMode ? (workshops[0] ? !workshops[0].isEducation : false) : true;
  // { status: 'idle'|'reading'|'ok'|'error', preview, photo, birthDate,
  //   birthDateHijri, age, idNumber, token, error } — kept out of the
  // saved draft (large photo; the token expires after 2 hours).
  const [idCheck, setIdCheck] = useState({ status: 'idle' });
  const [result, setResult] = useState(null);

  // If the customer already filled personal info, skip the "lookup"
  // prompt on reload — they clearly aren't a returning-user lookup.
  const [lookupMode, setLookupMode] = useState(() => {
    const d = _initialDraft;
    if (d?.form?.firstName || d?.form?.email || d?.form?.nationalId) return false;
    return true;
  });
  const [lookupValue, setLookupValue] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);

  const [form, setForm] = useState(() => (_initialDraft?.form) || {
    firstName: '', lastName: '', phone: '', email: '',
    nationalId: '', gender: '', age: '', city: '',
    workshopId: '',
    paymentMethod: 'bank_transfer' // 'bank_transfer' | 'mada'
  });

  // Payment settings (bank / mada / terms) for the currently selected
  // paid workshop — fetched when the customer lands on step 2.
  const [payment, setPayment] = useState({ bank: null, mada: null, terms: [] });
  const [proofFile, setProofFile] = useState(() => _initialDraft?.proofFile || null);
  const [copiedField, setCopiedField] = useState(null);
  const [termsAgreed, setTermsAgreed] = useState(() => !!_initialDraft?.termsAgreed);
  // Coupon workflow — customer types a code, clicks "Apply" → server
  // returns the discount + net. We keep the response in state so we
  // can render the discount inline and re-use it in submit.
  const [couponInput, setCouponInput] = useState(() => _initialDraft?.couponInput || '');
  const [couponApplying, setCouponApplying] = useState(false);
  const [coupon, setCoupon] = useState(() => _initialDraft?.coupon || null); // { code, percent, discountAmount, netAmount }

  useEffect(() => {
    // Shareable-URL mode: fetch just the education workshop and
    // pre-select it. Full picker fetch would leak public workshops
    // into the flow — we want a single-workshop landing page.
    if (isSingleMode) {
      api.get(`/workshops/edu/${routeWorkshopId}`)
        .then(res => {
          setSingleWorkshopMeta(res.data);
          setWorkshops([res.data]); // list of one so downstream lookups still work
          setForm(prev => ({ ...prev, workshopId: res.data.workshopId }));
          // Skip past the picker step; keep step 0 (personal info)
          // if the user hasn't filled it yet, otherwise jump to
          // the payment/confirm step.
          if (step === 1) setStep(2);
        })
        .catch(err => {
          setSingleFetchError(err?.response?.status === 404
            ? (isRTL ? 'الورشة غير موجودة أو الرابط منتهي' : 'Workshop not found or link expired')
            : (isRTL ? 'تعذّر تحميل الورشة' : 'Failed to load workshop'));
        });
      return;
    }
    api.get('/workshops/active').then(res => setWorkshops(res.data || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSingleMode, routeWorkshopId]);

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canProceedStep0 = form.firstName && form.lastName && form.phone && form.email && isValidEmail(form.email) && form.nationalId && form.gender && form.city
    && (requireId ? idCheck.status === 'ok' : form.age);
  // A workshop can be picked while registration is open (not closed by
  // the admin, not started yet) and it still has seats.
  const isPickable = (w) => !!w && w.isOpen !== false && (w.spotsRemaining == null || w.spotsRemaining > 0);
  const canProceedStep1 = form.workshopId && isPickable(workshops.find(w => w.workshopId === form.workshopId));

  const selectedWorkshopEarly = workshops.find(w => w.workshopId === form.workshopId);
  const workshopIsPaid = selectedWorkshopEarly && Number(selectedWorkshopEarly.price) > 0;
  // Total after any applied coupon — 0 when coupon covers the whole price.
  const netAmount = coupon ? Number(coupon.netAmount) : Number(selectedWorkshopEarly?.price || 0);
  const canProceedStep2 = !workshopIsPaid
    ? true
    : (netAmount <= 0
        ? termsAgreed
        : (
            termsAgreed && (
              form.paymentMethod === 'mada'
              || (form.paymentMethod === 'bank_transfer' && !!proofFile)
            )
          )
      );

  // Fetch bank + mada + terms settings on entering step 2 for a
  // paid workshop. Coupon input resets whenever the workshop changes.
  useEffect(() => {
    if (step === 2 && workshopIsPaid && form.workshopId) {
      api.get(`/workshops/public/${form.workshopId}/payment-settings`)
        .then(res => setPayment({
          bank: res.data.bank || null,
          mada: res.data.mada || null,
          terms: Array.isArray(res.data.terms) ? res.data.terms : []
        }))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form.workshopId]);

  // Reset coupon whenever the customer picks a different workshop.
  useEffect(() => {
    setCoupon(null);
    setCouponInput('');
  }, [form.workshopId]);

  // Persist an in-progress draft on every meaningful change. Clears
  // itself once we hit the success screen (step 3) or when the user
  // navigates away with an empty form. Try/catch because localStorage
  // can throw in Safari private mode or when disk is full.
  useEffect(() => {
    if (step === 3) { _clearDraft(); return; }
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
        step,
        form,
        coupon,
        couponInput,
        termsAgreed,
        proofFile
      }));
    } catch { /* quota exceeded — a large proof file can trigger this; drop the proof from the draft */
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
          step, form, coupon, couponInput, termsAgreed, proofFile: null
        }));
      } catch {}
    }
  }, [step, form, coupon, couponInput, termsAgreed, proofFile]);

  const applyCoupon = async () => {
    const code = String(couponInput || '').trim().toUpperCase();
    if (!code) return;
    setCouponApplying(true);
    try {
      const res = await api.get('/workshops/public/coupons/validate', {
        params: { code, workshopId: form.workshopId }
      });
      if (res.data?.ok) {
        setCoupon(res.data);
        toast.success(isRTL
          ? `تم تطبيق الخصم ${res.data.percent}%`
          : `Coupon applied — ${res.data.percent}% off`);
      } else {
        setCoupon(null);
        toast.error((isRTL ? res.data?.messageAr : res.data?.message) || res.data?.messageAr || (isRTL ? 'كود غير صالح' : 'Invalid code'));
      }
    } catch (err) {
      const msg = (isRTL ? err?.response?.data?.messageAr : err?.response?.data?.message) || err?.response?.data?.messageAr || (isRTL ? 'فشل التحقق' : 'Validation failed');
      toast.error(msg);
    } finally {
      setCouponApplying(false);
    }
  };
  const removeCoupon = () => { setCoupon(null); setCouponInput(''); };

  // Read a File into { fileName, fileType, fileSize, fileData (base64) }.
  const readAsFilePayload = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const raw = String(e.target.result || '');
      const b64 = raw.includes(',') ? raw.split(',').pop() : raw;
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      resolve({ fileName: file.name, fileType: ext, fileSize: file.size, fileData: b64 });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // Downscale + re-encode as JPEG (longest side ≤ 1600px): plenty for
  // reading the card and keeps the upload around 200–500 KB.
  const compressImage = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const preview = canvas.toDataURL('image/jpeg', 0.88);
      const fileData = preview.split(',')[1];
      resolve({
        preview,
        photo: { fileName: `${(file.name || 'id').replace(/\.[^.]+$/, '')}.jpg`, fileType: 'jpg', fileSize: Math.round(fileData.length * 0.75), fileData }
      });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });

  const handleIdUpload = async (fileList) => {
    const file = fileList?.[0];
    if (!file) return;
    if (!String(file.type).startsWith('image/')) {
      setIdCheck({ status: 'error', error: isRTL ? 'يرجى اختيار صورة (JPG أو PNG)' : 'Please choose an image (JPG or PNG)' });
      return;
    }
    let compressed;
    try {
      compressed = await compressImage(file);
    } catch {
      setIdCheck({ status: 'error', error: isRTL ? 'تعذّر فتح الصورة — جرّب صورة JPG أو PNG' : "Couldn't open the image — try a JPG or PNG" });
      return;
    }
    const { preview, photo } = compressed;
    setIdCheck({ status: 'reading', preview });
    handleChange('age', '');
    try {
      const { data } = await api.post('/workshops/public/read-id', { idPhoto: photo }, { timeout: 90000 });
      setIdCheck({ status: 'ok', preview, photo, ...data });
      // Age comes from the card; fill the ID number too if still empty.
      setForm(prev => ({ ...prev, age: String(data.age), nationalId: prev.nationalId || data.idNumber || '' }));
    } catch (err) {
      const status = err.response?.status;
      const own = isRTL ? err.response?.data?.messageAr : err.response?.data?.message;
      // No JSON message = the request never got a proper answer from the
      // API (offline, timed out, or the web server answered instead).
      let fallback;
      if (!err.response) {
        fallback = isRTL ? 'تعذّر الاتصال بالخادم — تحقق من الإنترنت ثم أعد رفع الصورة' : "Couldn't reach the server — check your connection and upload again";
      } else if (status === 413) {
        fallback = isRTL ? 'حجم الصورة كبير جداً — صوّر البطاقة من مسافة أقرب وأعد المحاولة' : 'The photo is too large — take a closer photo of the card and try again';
      } else if (status >= 500) {
        fallback = isRTL ? 'خدمة قراءة الهوية مشغولة حالياً — يرجى المحاولة بعد دقيقة' : 'ID reading is busy right now — please try again in a minute';
      } else {
        fallback = isRTL ? 'تعذّرت قراءة البطاقة — يرجى المحاولة مرة أخرى' : "Couldn't read the card — please try again";
      }
      if (!own) console.error('read-id failed:', status || err.code || err.message);
      setIdCheck({ status: 'error', preview, error: own || fallback });
    }
  };

  // Resuming a saved draft past step 0 without a verified ID (photo and
  // token aren't saved) → back to step 0 to upload it again.
  useEffect(() => {
    if (requireId && step > 0 && step < 3 && idCheck.status !== 'ok') setStep(0);
  }, [requireId, step, idCheck.status]);

  const fmtDmy = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');

  const handleProofUpload = async (fileList) => {
    const file = fileList?.[0];
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'webp', 'pdf'].includes(ext)) {
      toast.error(isRTL ? 'الصيغة غير مدعومة — اختر صورة أو PDF' : 'Unsupported format — pick an image or PDF');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(isRTL ? 'حجم الملف أكبر من 10 ميجابايت' : 'File is larger than 10 MB');
      return;
    }
    try {
      const payload = await readAsFilePayload(file);
      setProofFile(payload);
    } catch {
      toast.error(isRTL ? 'تعذّر قراءة الملف' : 'Failed to read the file');
    }
  };

  const copyToClipboard = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for older browsers without the async clipboard API.
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta);
      ta.select(); try { document.execCommand('copy'); } catch {}
      ta.remove();
    }
    setCopiedField(key);
    setTimeout(() => setCopiedField(prev => prev === key ? null : prev), 1600);
  };

  const handleStep1Next = async () => {
    if (!form.workshopId) return;
    // Check age range on frontend
    const sw = workshops.find(w => w.workshopId === form.workshopId);
    if (sw && form.age) {
      const studentAge = parseInt(form.age);
      if (!isNaN(studentAge)) {
        if (sw.minAge && studentAge < sw.minAge) {
          toast.error(isRTL ? `العمر يجب أن يكون بين ${sw.minAge} و ${sw.maxAge || '∞'} سنة. عمرك: ${studentAge}` : `Age must be ${sw.minAge}-${sw.maxAge || '∞'}. Your age: ${studentAge}`);
          return;
        }
        if (sw.maxAge && studentAge > sw.maxAge) {
          toast.error(isRTL ? `العمر يجب أن يكون بين ${sw.minAge || 0} و ${sw.maxAge} سنة. عمرك: ${studentAge}` : `Age must be ${sw.minAge || 0}-${sw.maxAge}. Your age: ${studentAge}`);
          return;
        }
      }
    }
    try {
      if (form.nationalId) {
        const params = new URLSearchParams({ workshopId: form.workshopId, nationalId: form.nationalId });
        const res = await api.get(`/workshops/check-duplicate?${params}`);
        if (res.data.duplicate) {
          toast.error(isRTL
            ? 'هذا الطالب مسجل بالفعل في هذه الورشة بنفس رقم الهوية.'
            : 'This student is already registered for this workshop with the same National ID.');
          return;
        }
      }
    } catch (e) {}
    setStep(2);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const paid = workshopIsPaid;
      // If a coupon covered the whole amount, treat the registration
      // as free — no bank/mada required.
      const priceAfterCoupon = coupon ? Number(coupon.netAmount) : (selectedWorkshopEarly?.price || 0);
      const effectiveMethod = !paid || priceAfterCoupon <= 0
        ? 'free'
        : form.paymentMethod;
      const payload = {
        ...form,
        paymentMethod: effectiveMethod,
        paymentProof: effectiveMethod === 'bank_transfer' ? proofFile : null,
        couponCode: coupon?.code || null,
        termsAccepted: paid ? termsAgreed : true,
        idPhoto: requireId ? idCheck.photo : null,
        idToken: requireId ? idCheck.token : null
      };
      const res = await api.post('/workshops/register', payload);
      setResult(res.data);
      setStep(3);
      toast.success(isRTL ? 'تم التسجيل بنجاح!' : 'Registration successful!');
    } catch (error) {
      const msg = (isRTL ? error.response?.data?.messageAr : error.response?.data?.message) || error.response?.data?.messageAr || (isRTL ? 'خطأ في التسجيل' : 'Registration error');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedWorkshop = workshops.find(w => w.workshopId === form.workshopId);

  const handleLookup = async () => {
    if (!lookupValue.trim()) return;
    setLookupLoading(true);
    try {
      const res = await api.get(`/workshops/lookup-student?identifier=${encodeURIComponent(lookupValue.trim())}`);
      if (res.data.found) {
        const s = res.data.student;
        setForm(prev => ({ ...prev, firstName: s.firstName || '', lastName: s.lastName || '', phone: s.phone || '', email: s.email || '', nationalId: s.nationalId || '', gender: s.gender || '', age: s.age || '', city: s.city || '' }));
        toast.success(isRTL ? 'مرحباً بعودتك! تم تعبئة بياناتك' : 'Welcome back! Your info has been filled');
        setStep(1);
      } else {
        toast.info(isRTL ? 'لم يتم العثور على تسجيل سابق — يرجى إدخال بياناتك' : 'No previous registration found — please enter your info');
        setLookupMode(false);
      }
    } catch (error) {
      setLookupMode(false);
    } finally {
      setLookupLoading(false);
    }
  };

  const isEduLink = isSingleMode && !!singleWorkshopMeta?.isEducation;
  // A saved student draft past the first step means they already chose.
  const effectiveRole = isEduLink ? (eduRole || (step > 0 ? 'student' : null)) : 'student';
  const showStudentFlow = !isEduLink || effectiveRole === 'student';
  const deadlineLabel = (() => {
    if (!isEduLink || !singleWorkshopMeta?.registrationDeadline) return '';
    const d = new Date(singleWorkshopMeta.registrationDeadline);
    const when = d.toLocaleString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {
      timeZone: 'Asia/Riyadh', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit'
    });
    if (singleWorkshopMeta.forceOpen) return isRTL ? 'التسجيل مفتوح استثنائياً بقرار من فاب لاب' : 'Registration is open as an exception by FabLab';
    return isRTL ? `آخر موعد للتسجيل: ${when} (قبل بدء الورشة بـ 24 ساعة)` : `Registration closes ${when} (24 hours before the workshop starts)`;
  })();

  const tx = (ar, en) => (isRTL ? ar : en);
  const money = (n) => `${Number(n || 0).toFixed(2)} ${tx('ر.س', 'SAR')}`;
  const hhmm = (v) => String(v || '').slice(0, 5);
  const arrowNext = isRTL ? IC.left : IC.right;
  const arrowBack = isRTL ? IC.right : IC.left;

  // Rail stepper: the picker step is hidden for a shareable single
  // workshop link (nothing to pick).
  const railSteps = showStudentFlow && !(isSingleMode && singleFetchError) && (!isEduLink || effectiveRole === 'student')
    ? (isSingleMode
      ? [
          { key: 'info', label: tx('البيانات الشخصية', 'Personal info'), icon: IC.user },
          { key: 'pay', label: tx('الدفع والتأكيد', 'Payment & confirm'), icon: IC.card }
        ]
      : [
          { key: 'info', label: tx('البيانات الشخصية', 'Personal info'), icon: IC.user },
          { key: 'pick', label: tx('اختيار الورشة', 'Select workshop'), icon: IC.cap },
          { key: 'pay', label: tx('الدفع والتأكيد', 'Payment & confirm'), icon: IC.card }
        ])
    : null;
  const stepToRail = (s) => (isSingleMode ? (s === 0 ? 0 : 1) : s);
  const railToStep = (i) => (isSingleMode ? (i === 0 ? 0 : 2) : i);
  const railActive = railSteps ? (step === 3 ? railSteps.length : stepToRail(step)) : -1;
  const stepNo = (s) => String(stepToRail(s) + 1).padStart(2, '0');

  const intro = {
    portal: isEduLink ? tx('ورشة تعليمية', 'Education workshop') : tx('الورش التدريبية', 'Training workshops'),
    title: isRTL ? <>تعلّم بيديك<br /><em>في ورش فاب لاب</em></> : <>Learn by making<br /><em>in FabLab workshops</em></>,
    features: [
      { ar: 'ورش في الإلكترونيات والطباعة ثلاثية الأبعاد والمزيد', en: 'Electronics, 3D printing and more', d: IC.cap },
      { ar: 'بطاقة حضور وشهادة بعد إتمام الورشة', en: 'Attendance card and a certificate', d: IC.badge },
      { ar: 'من سجّل سابقًا يكفيه رقم الجوال أو الهوية', en: 'Returning? Your phone or ID is enough', d: IC.search }
    ]
  };

  const closedText = (reason) => (reason === 'full'
    ? tx('تم اكتمال العدد المسموح به.', 'The workshop is full.')
    : reason === 'cancelled'
      ? tx('تم إلغاء هذه الورشة.', 'This workshop has been cancelled.')
      : reason === 'deadline'
        ? tx('يُغلق التسجيل قبل بدء الورشة بـ 24 ساعة. للتسجيل المتأخر يرجى التواصل مع فاب لاب.', 'Registration closes 24 hours before the workshop starts. For late registration please contact FabLab.')
        : reason === 'started' || reason === 'completed'
          ? tx('بدأت الورشة — يُغلق التسجيل من يوم انطلاقها.', 'The workshop has already started — registration closes on the start day.')
          : tx('يرجى التواصل مع إدارة فاب لاب لمزيد من المعلومات.', 'Please contact the FabLab admin for more information.'));

  const stepHead = (s, title, desc) => (
    <>
      <p className="rgx-step-eyebrow"><span>{stepNo(s)}</span>{railSteps?.[stepToRail(s)]?.label}</p>
      <h2 className="step-title">{title}</h2>
      {desc && <p className="step-description">{desc}</p>}
    </>
  );

  const slide = {
    initial: { opacity: 0, x: isRTL ? -24 : 24 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: isRTL ? 24 : -24 },
    transition: { duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }
  };

  // Landing hero: the edu role chooser, or the returning-trainee lookup.
  const eduChooser = isEduLink && !effectiveRole;
  const showHero = !(isSingleMode && singleFetchError) && (eduChooser || (showStudentFlow && step === 0 && lookupMode));

  return (
    <StudioShell
      isRTL={isRTL}
      theme={theme}
      onToggleTheme={toggleTheme}
      intro={intro}
      subtitle={tx('التسجيل في الورش', 'Workshop registration')}
      servicesHref="/register"
      steps={railSteps}
      activeStep={railActive}
      onJump={(i) => { if (step !== 3) setStep(railToStep(i)); }}
    >
      {showHero && (
        <motion.div className="rgx-hero wkr-hero" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <p className="rgx-eyebrow"><i aria-hidden="true" />{isEduLink ? tx('ورشة تعليمية', 'Education workshop') : tx('الورش التدريبية · فاب لاب الأحساء', 'Training workshops · FabLab Al-Ahsa')}</p>
          <h1>{isSingleMode && singleWorkshopMeta ? <em>{singleWorkshopMeta.title}</em> : (isRTL ? <>التسجيل في <em>الورش التدريبية</em></> : <>Register for a <em>workshop</em></>)}</h1>
          <p>{deadlineLabel
            ? deadlineLabel
            : isSingleMode
              ? tx('سجّل بياناتك ثم أكّد التسجيل — من سجّل سابقًا يكفيه رقم الجوال أو الهوية.', 'Enter your details and confirm — returning? Your phone or ID is enough.')
              : tx('سجّل بياناتك، اختر الورشة المناسبة، ثم أكّد التسجيل — من سجّل سابقًا يكفيه رقم الجوال أو الهوية.', 'Enter your details, pick a workshop and confirm — returning? Your phone or ID is enough.')}</p>
        </motion.div>
      )}

      {/* Single-workshop link: failed to load / registration closed */}
      {isSingleMode && singleFetchError && (
        <section className="rgx-card rgx-closed">
          <span className="rgx-closed-ico"><Icon d={IC.alert} /></span>
          <h2>{singleFetchError}</h2>
          <div className="rgx-closed-actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/register')}><Icon d={IC.grid} />{tx('كل الخدمات', 'All services')}</button>
          </div>
        </section>
      )}

      {/* Education link: who is registering? */}
      {eduChooser && (
        <motion.section className="rgx-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="step-title">{tx('سجّل بصفتك', 'Register as')}</h2>
          <p className="step-description">{tx('اختر نوع التسجيل في هذه الورشة.', 'Choose how you are joining this workshop.')}</p>
          <div className="selection-grid wkr-roles">
            <button type="button" className="selection-card" onClick={() => setEduRole('student')}>
              <span className="selection-card-icon"><Icon d={IC.bag} /></span>
              <span className="selection-card-title">{tx('طالب', 'Student')}</span>
              <span className="selection-card-description">{tx('سجّل بيانات الطالب للمشاركة في الورشة', "Enter the student's details to join the workshop")}</span>
            </button>
            <button type="button" className="selection-card" onClick={() => setEduRole('teacher')}>
              <span className="selection-card-icon"><Icon d={IC.board} /></span>
              <span className="selection-card-title">{tx('معلم أو مدرب', 'Teacher or instructor')}</span>
              <span className="selection-card-description">{tx('بياناتك، القاعة، والمتطلبات التي تحتاج تجهيزها', 'Your details, the room, and what you need prepared')}</span>
            </button>
          </div>
        </motion.section>
      )}

      {isEduLink && effectiveRole === 'teacher' && (
        <section className="rgx-card wkr-teacher">
          <EducationTeacherForm
            meta={singleWorkshopMeta}
            isRTL={isRTL}
            deadlineLabel={deadlineLabel}
            onBack={() => setEduRole(null)}
          />
        </section>
      )}

      {showStudentFlow && !(isSingleMode && singleFetchError) && (
        <>
          {isEduLink && step !== 3 && (
            <div className="wkr-rolebar">
              <span className="wkr-rolebar-ico"><Icon d={IC.bag} /></span>
              <span className="wkr-rolebar-text">
                <b>{tx('تسجيل طالب', 'Student registration')} · {singleWorkshopMeta.title}</b>
                {deadlineLabel && <small>{deadlineLabel}</small>}
              </span>
              <button type="button" className="wkr-linkbtn" onClick={() => setEduRole(null)}>{tx('تغيير', 'Change')}</button>
            </div>
          )}

          {isSingleMode && singleWorkshopMeta && !singleWorkshopMeta.isOpen && step !== 3 && (
            <div className="info-banner warning wkr-closed">
              <Icon d={IC.pause} />
              <span>
                <b>{tx('التسجيل في هذه الورشة مغلق', 'Registration for this workshop is closed')}</b>
                <br />{closedText(singleWorkshopMeta.closedReason)}
              </span>
            </div>
          )}

          <motion.section className="rgx-card wkr-flow" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }}>
            <div className="rgx-content">
              <AnimatePresence mode="wait">
                {step === 0 && (
                  <motion.div key={lookupMode ? 'lookup' : 'info'} {...slide}>
                    {lookupMode ? (
                      <>
                        {stepHead(0, tx('هل سبق لك التسجيل في ورشة؟', 'Registered for a workshop before?'),
                          tx('أدخل رقم الجوال أو الهوية لنعبّئ بياناتك تلقائيًا، أو ابدأ تسجيلًا جديدًا.', 'Enter your phone or national ID and we fill in your details — or start a new registration.'))}
                        <div className="user-lookup-input wkr-lookup">
                          <input
                            className="form-input"
                            value={lookupValue}
                            onChange={e => setLookupValue(e.target.value)}
                            placeholder={tx('رقم الجوال أو رقم الهوية', 'Phone number or National ID')}
                            onKeyDown={e => e.key === 'Enter' && handleLookup()}
                          />
                        </div>
                        <div className="user-lookup-buttons">
                          <button type="button" className="btn btn-primary" disabled={!lookupValue.trim() || lookupLoading} onClick={handleLookup}>
                            {lookupLoading ? <span className="loading-spinner" /> : <Icon d={IC.search} />}
                            {lookupLoading ? tx('جاري البحث…', 'Searching…') : tx('بحث', 'Search')}
                          </button>
                          <button type="button" className="btn btn-secondary" onClick={() => setLookupMode(false)}>
                            <Icon d={IC.userPlus} />{tx('تسجيل جديد', 'Register as new')}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        {stepHead(0, tx('البيانات الشخصية', 'Personal information'), tx('بيانات المتدرب كما في الهوية.', "The trainee's details, as on the ID."))}
                        <div className="form-grid">
                          <div className="form-group">
                            <label className="form-label">{tx('الاسم الأول', 'First name')} <span className="required">*</span></label>
                            <input className="form-input" value={form.firstName} onChange={e => handleChange('firstName', e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">{tx('الاسم الأخير', 'Last name')} <span className="required">*</span></label>
                            <input className="form-input" value={form.lastName} onChange={e => handleChange('lastName', e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">{tx('رقم الجوال', 'Phone')} <span className="required">*</span></label>
                            <input className="form-input" type="tel" dir="ltr" value={form.phone} onChange={e => handleChange('phone', e.target.value)} placeholder="05xxxxxxxx" />
                          </div>
                          <div className="form-group">
                            <label className="form-label">{tx('البريد الإلكتروني', 'Email')} <span className="required">*</span></label>
                            <input className={`form-input${form.email && !isValidEmail(form.email) ? ' wkr-bad' : ''}`} type="email" dir="ltr" value={form.email} onChange={e => handleChange('email', e.target.value)} placeholder="name@example.com" />
                            {form.email && !isValidEmail(form.email) && <span className="wkr-err">{tx('البريد الإلكتروني غير صحيح', 'Invalid email address')}</span>}
                          </div>
                          <div className="form-group">
                            <label className="form-label">{tx('رقم هوية الطالب', "Student's national ID")} <span className="required">*</span></label>
                            <input className="form-input" dir="ltr" value={form.nationalId} onChange={e => handleChange('nationalId', e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">{tx('الجنس', 'Gender')} <span className="required">*</span></label>
                            <select className="form-select" value={form.gender} onChange={e => handleChange('gender', e.target.value)}>
                              <option value="">{tx('اختر', 'Select')}</option>
                              <option value="male">{tx('ذكر', 'Male')}</option>
                              <option value="female">{tx('أنثى', 'Female')}</option>
                            </select>
                          </div>
                          {!requireId && (
                            <div className="form-group">
                              <label className="form-label">{tx('العمر', 'Age')} <span className="required">*</span></label>
                              <input className="form-input" type="number" value={form.age} onChange={e => handleChange('age', e.target.value)} />
                            </div>
                          )}
                          <div className="form-group">
                            <label className="form-label">{tx('المدينة', 'City')} <span className="required">*</span></label>
                            <input className="form-input" value={form.city} onChange={e => handleChange('city', e.target.value)} />
                          </div>
                          {requireId && (
                            <div className="form-group full-width">
                              <label className="form-label">{tx('صورة الهوية الوطنية أو الإقامة', 'Photo of the National ID or Iqama')} <span className="required">*</span></label>
                              <div className={`wkr-id is-${idCheck.status}`}>
                                <span className="wkr-id-thumb">
                                  {idCheck.preview ? <img src={idCheck.preview} alt="" /> : <Icon d={IC.idcard} />}
                                </span>
                                <div className="wkr-id-body">
                                  {idCheck.status === 'idle' && (
                                    <p className="wkr-id-hint">{tx('صوّر الوجه الأمامي للبطاقة كاملاً بإضاءة جيدة وبدون انعكاس — نقرأ تاريخ الميلاد ونحسب العمر تلقائياً.', 'Photograph the whole front of the card in good light, without glare — we read the date of birth and work out the age.')}</p>
                                  )}
                                  {idCheck.status === 'reading' && (
                                    <p className="wkr-id-reading"><span className="loading-spinner" />{tx('جاري قراءة البطاقة…', 'Reading the card…')}</p>
                                  )}
                                  {idCheck.status === 'ok' && (
                                    <>
                                      <p className="wkr-id-line">
                                        {tx('تاريخ الميلاد:', 'Date of birth:')} <b dir="ltr">{fmtDmy(idCheck.birthDate)}</b>{isRTL ? ' م' : ''}
                                        {idCheck.birthDateHijri && <> · <b dir="ltr">{fmtDmy(idCheck.birthDateHijri)}</b> {tx('هـ', 'AH')}</>}
                                      </p>
                                      <p className="wkr-id-age"><Icon d={IC.check} />{tx('العمر:', 'Age:')} <b>{idCheck.age}</b> {tx('سنة', 'years')}</p>
                                    </>
                                  )}
                                  {idCheck.status === 'error' && <p className="wkr-id-error" role="alert">{idCheck.error}</p>}
                                  <label className={`btn btn-secondary wkr-id-btn${idCheck.status === 'reading' ? ' is-disabled' : ''}`}>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      hidden
                                      disabled={idCheck.status === 'reading'}
                                      onChange={e => { handleIdUpload(e.target.files); e.target.value = ''; }}
                                    />
                                    <Icon d={IC.camera} />
                                    {idCheck.status === 'idle' ? tx('رفع صورة الهوية', 'Upload ID photo') : tx('تغيير الصورة', 'Change photo')}
                                  </label>
                                </div>
                              </div>
                              {idCheck.status === 'ok' && idCheck.idNumber && form.nationalId && form.nationalId !== idCheck.idNumber && (
                                <div className="info-banner warning wkr-id-warn">
                                  <Icon d={IC.alert} />
                                  <span>
                                    {isRTL
                                      ? <>رقم الهوية في البطاقة (<b dir="ltr">{idCheck.idNumber}</b>) يختلف عن الرقم المُدخل.</>
                                      : <>The number on the card (<b>{idCheck.idNumber}</b>) differs from the one entered.</>}
                                    {' '}
                                    <button type="button" className="wkr-linkbtn" onClick={() => handleChange('nationalId', idCheck.idNumber)}>{tx('استخدم رقم البطاقة', 'Use the card number')}</button>
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="form-navigation">
                          <button type="button" className="btn btn-secondary" onClick={() => setLookupMode(true)}><Icon d={arrowBack} />{tx('رجوع', 'Back')}</button>
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={!canProceedStep0 || (isSingleMode && singleWorkshopMeta && !singleWorkshopMeta.isOpen)}
                            onClick={() => setStep(isSingleMode ? 2 : 1)}
                          >{tx('التالي', 'Next')}<Icon d={arrowNext} /></button>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}

                {step === 1 && (
                  <motion.div key="pick" {...slide}>
                    {stepHead(1, tx('اختر الورشة التدريبية', 'Select a workshop'), tx('الورش المفتوحة للتسجيل الآن — اختر ورشة واحدة.', 'Workshops open for registration now — pick one.'))}
                    {workshops.length === 0 ? (
                      <div className="wkr-empty"><Icon d={IC.cap} />{tx('لا توجد ورش متاحة حالياً', 'No workshops available right now')}</div>
                    ) : (
                      <div className="wkr-cards">
                        {workshops.map(w => {
                          const pickable = isPickable(w);
                          const on = form.workshopId === w.workshopId;
                          const closedLabel = w.closedReason === 'deadline'
                            ? tx('انتهى التسجيل (يُغلق قبل البدء بـ24 ساعة)', 'Registration ended (closes 24h before the start)')
                            : w.closedReason === 'started'
                              ? tx('بدأت الورشة — التسجيل مغلق', 'Started — registration closed')
                              : w.closedReason === 'full' || (w.spotsRemaining != null && w.spotsRemaining <= 0)
                                ? tx('مكتمل', 'Full')
                                : tx('التسجيل مغلق', 'Registration closed');
                          let days = 1;
                          if (w.startDate && w.endDate && w.endDate !== w.startDate) {
                            days = Math.max(1, Math.ceil((new Date(w.endDate) - new Date(w.startDate)) / (1000 * 60 * 60 * 24)) + 1);
                          }
                          const perDay = w.totalHours && days > 1 ? (w.totalHours / days).toFixed(1) : null;
                          return (
                            <button
                              type="button"
                              key={w.workshopId}
                              className={`wkr-card${on ? ' on' : ''}${!pickable ? ' off' : ''}`}
                              disabled={!pickable}
                              onClick={() => pickable && handleChange('workshopId', w.workshopId)}
                              aria-pressed={on}
                            >
                              {w.photo
                                ? <span className="wkr-card-img" style={{ backgroundImage: `url(${w.photo})` }} />
                                : <span className="wkr-card-img wkr-card-img--none"><Icon d={IC.cap} /></span>}
                              {on && <span className="wkr-card-check"><Icon d={IC.check} /></span>}
                              <span className="wkr-card-body">
                                <b className="wkr-card-title">{w.title}</b>
                                {pickable && w.registrationDeadline && (
                                  <span className="wkr-chip amber"><Icon d={IC.clock} />{tx('آخر موعد: ', 'Register by: ')}{new Date(w.registrationDeadline).toLocaleString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { timeZone: 'Asia/Riyadh', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                                )}
                                {w.presenter && <span className="wkr-card-presenter">{tx('المقدم:', 'Presenter:')} <bdi>{w.presenter}</bdi></span>}
                                <span className="wkr-card-meta">
                                  {w.startDate && <span><Icon d={IC.cal} />{w.startDate}{w.endDate && w.endDate !== w.startDate ? ` ← ${w.endDate}` : ''}</span>}
                                  {w.startTime && <span dir="ltr"><Icon d={IC.clock} />{hhmm(w.startTime)}{w.endTime ? ` - ${hhmm(w.endTime)}` : ''}</span>}
                                  {w.totalHours && <span><Icon d={IC.timer} />{w.totalHours} {tx('ساعة', 'hrs')}{perDay ? ` (${perDay} × ${days})` : ''}</span>}
                                  {(w.minAge || w.maxAge) && <span><Icon d={IC.users} />{w.minAge || '?'}–{w.maxAge || '?'} {tx('سنة', 'yrs')}</span>}
                                </span>
                                {w.content && <span className="wkr-card-text">{w.content}</span>}
                                {w.objectives && <span className="wkr-card-obj">{tx('الأهداف: ', 'Objectives: ')}{w.objectives}</span>}
                                <span className="wkr-card-foot">
                                  <b className={`wkr-price${Number(w.price) > 0 ? '' : ' free'}`}>{Number(w.price) > 0 ? `${w.price} ${tx('ر.س', 'SAR')}` : tx('مجاني', 'Free')}</b>
                                  <span className={`wkr-spots${!pickable || (w.spotsRemaining != null && w.spotsRemaining <= 3) ? ' low' : ''}`}>
                                    {!pickable ? closedLabel : w.spotsRemaining != null ? `${w.spotsRemaining} ${tx('مقعد متبقٍ', 'spots left')}` : tx('متاح', 'Open')}
                                  </span>
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="form-navigation">
                      <button type="button" className="btn btn-secondary" onClick={() => setStep(0)}><Icon d={arrowBack} />{tx('السابق', 'Back')}</button>
                      <button type="button" className="btn btn-primary" disabled={!canProceedStep1} onClick={handleStep1Next}>{tx('التالي', 'Next')}<Icon d={arrowNext} /></button>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div key="pay" {...slide}>
                    {stepHead(2, tx('الدفع والتأكيد', 'Payment & confirmation'), workshopIsPaid
                      ? tx('راجع الورشة، اختر طريقة الدفع ثم أكّد التسجيل.', 'Review the workshop, choose how to pay, then confirm.')
                      : tx('راجع الورشة ثم أكّد التسجيل.', 'Review the workshop, then confirm.'))}

                    {selectedWorkshop && (
                      <div className="wkr-summary">
                        <span className="wkr-summary-ico"><Icon d={IC.cap} /></span>
                        <span className="wkr-summary-text">
                          <b>{selectedWorkshop.title}</b>
                          <small>
                            {selectedWorkshop.startDate}{selectedWorkshop.totalHours ? ` · ${selectedWorkshop.totalHours} ${tx('ساعة', 'h')}` : ''}
                            {selectedWorkshop.room ? <> · {tx('القاعة:', 'Room:')} <b>{selectedWorkshop.room}</b></> : null}
                          </small>
                        </span>
                        <b className={`wkr-price${workshopIsPaid ? '' : ' free'}`}>{workshopIsPaid ? `${selectedWorkshop.price} ${tx('ر.س', 'SAR')}` : tx('مجاناً', 'Free')}</b>
                      </div>
                    )}

                    {!workshopIsPaid && (
                      <div className="info-banner success wkr-free">
                        <Icon d={IC.gift} />
                        <span><b>{tx('هذه الورشة مجانية', 'This workshop is free')}</b><br />{tx('اضغط «تأكيد التسجيل» لإتمام العملية.', 'Press “Confirm registration” to finish.')}</span>
                      </div>
                    )}

                    {workshopIsPaid && (
                      <div className="wkr-due">
                        <div className="wkr-coupon">
                          <span className="wkr-coupon-label"><Icon d={IC.tag} />{tx('كود خصم (اختياري)', 'Coupon code (optional)')}</span>
                          {coupon ? (
                            <div className="wkr-coupon-on">
                              <span><b dir="ltr">{coupon.code}</b> · {isRTL ? `خصم ${coupon.percent}%` : `${coupon.percent}% off`} · <b>-{money(coupon.discountAmount)}</b></span>
                              <button type="button" className="wkr-linkbtn danger" onClick={removeCoupon}>{tx('إزالة', 'Remove')}</button>
                            </div>
                          ) : (
                            <div className="wkr-coupon-row">
                              <input
                                className="form-input"
                                dir="ltr"
                                value={couponInput}
                                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                                placeholder={tx('أدخل الكود', 'Enter code')}
                                onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                              />
                              <button type="button" className="btn btn-secondary" onClick={applyCoupon} disabled={couponApplying || !couponInput.trim()}>
                                {couponApplying ? <span className="loading-spinner" /> : tx('تطبيق', 'Apply')}
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="wkr-total">
                          <span>
                            <small>{tx('الإجمالي المستحق', 'Total due')}</small>
                            {coupon && <em><s>{Number(coupon.originalPrice).toFixed(2)}</s> · −{coupon.percent}%</em>}
                          </span>
                          <b>{netAmount <= 0 ? tx('مجاناً', 'Free') : money(netAmount)}</b>
                        </div>
                      </div>
                    )}

                    {workshopIsPaid && netAmount > 0 && (
                      <>
                        <h3 className="wkr-sub">{tx('طريقة الدفع', 'Payment method')}</h3>
                        <div className="selection-grid wkr-pay">
                          {[
                            { key: 'bank_transfer', icon: IC.bank, ar: 'تحويل بنكي', en: 'Bank transfer', hAr: 'ارفع صورة الإشعار للمراجعة', hEn: 'Upload the transfer receipt for review' },
                            { key: 'mada', icon: IC.mada, ar: 'مدى في مقر فاب لاب', en: 'Mada at FabLab', hAr: 'ادفع بمدى داخل المقر', hEn: 'Pay in person at FabLab' }
                          ].map(pm => (
                            <button
                              key={pm.key}
                              type="button"
                              className={`selection-card${form.paymentMethod === pm.key ? ' selected' : ''}`}
                              onClick={() => handleChange('paymentMethod', pm.key)}
                            >
                              <span className="selection-card-icon"><Icon d={pm.icon} /></span>
                              <span className="selection-card-title">{isRTL ? pm.ar : pm.en}</span>
                              <span className="selection-card-description">{isRTL ? pm.hAr : pm.hEn}</span>
                            </button>
                          ))}
                        </div>

                        {form.paymentMethod === 'bank_transfer' && (
                          <>
                            <div className="wkr-bank">
                              <div className="wkr-bank-head">
                                <b>{tx('تفاصيل التحويل البنكي', 'Bank transfer details')}</b>
                                {payment.bank && (
                                  <button
                                    type="button"
                                    className="wkr-copy"
                                    onClick={() => copyToClipboard(`${payment.bank.bankName || ''}\n${payment.bank.accountHolder || ''}\nIBAN: ${payment.bank.iban || ''}`, 'all')}
                                  >
                                    <Icon d={copiedField === 'all' ? IC.check : IC.copy} />{copiedField === 'all' ? tx('نُسخ الكل', 'Copied') : tx('نسخ الكل', 'Copy all')}
                                  </button>
                                )}
                              </div>
                              {payment.bank ? (
                                <>
                                  {[
                                    { key: 'bank', ar: 'البنك', en: 'Bank', value: payment.bank.bankName },
                                    { key: 'holder', ar: 'اسم صاحب الحساب', en: 'Account holder', value: payment.bank.accountHolder },
                                    { key: 'iban', ar: 'رقم الآيبان (IBAN)', en: 'IBAN', value: payment.bank.iban, ltr: true }
                                  ].map(row => (
                                    <div key={row.key} className="wkr-bank-row">
                                      <small>{isRTL ? row.ar : row.en}</small>
                                      <span dir={row.ltr ? 'ltr' : undefined} className={row.ltr ? 'mono' : ''}>{row.value || '—'}</span>
                                      {row.value && (
                                        <button type="button" className="wkr-copy icon" onClick={() => copyToClipboard(row.value, row.key)} title={tx('نسخ', 'Copy')}>
                                          <Icon d={copiedField === row.key ? IC.check : IC.copy} />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                  {payment.bank.additionalInfo && <p className="wkr-bank-note" dir="auto">{payment.bank.additionalInfo}</p>}
                                </>
                              ) : (
                                <p className="wkr-muted">{tx('جاري تحميل تفاصيل الحساب…', 'Loading account details…')}</p>
                              )}
                            </div>

                            <label className={`wkr-upload${proofFile ? ' has-file' : ''}`}>
                              <input type="file" hidden accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf" onChange={(e) => { handleProofUpload(e.target.files); e.target.value = ''; }} />
                              <span className="wkr-upload-ico"><Icon d={proofFile ? IC.check : IC.upload} /></span>
                              <span className="wkr-upload-text">
                                {proofFile
                                  ? <><b>{proofFile.fileName}</b><small>{(proofFile.fileSize / 1024).toFixed(0)} KB · {tx('اضغط للتغيير', 'Tap to change')}</small></>
                                  : <><b>{tx('ارفع صورة إشعار التحويل', 'Upload the transfer receipt')} <span className="required">*</span></b><small>{tx('PNG أو JPG أو WebP أو PDF · حتى 10 ميجابايت', 'PNG, JPG, WebP or PDF · up to 10 MB')}</small></>}
                              </span>
                              {proofFile && <button type="button" className="wkr-linkbtn danger" onClick={(e) => { e.preventDefault(); setProofFile(null); }}>{tx('إزالة', 'Remove')}</button>}
                            </label>
                          </>
                        )}

                        {form.paymentMethod === 'mada' && payment.mada && (
                          <div className="info-banner wkr-mada">
                            <Icon d={IC.mada} />
                            <span>
                              <b>{payment.mada.title || tx('الدفع بمدى', 'Mada payment')}</b><br />
                              {payment.mada.instructions}
                              {payment.mada.address && <><br /><Icon d={IC.pin} /> {payment.mada.address}</>}
                              <br /><small>{tx('سيتم تفعيل تسجيلك بعد الدفع في المقر.', 'Your registration is activated after you pay at FabLab.')}</small>
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {workshopIsPaid && payment.terms.length > 0 && (
                      <div className="wkr-terms">
                        <b className="wkr-sub">{tx('الشروط والأحكام', 'Terms & conditions')}</b>
                        <ol className="wkr-terms-list" dir="auto">
                          {payment.terms.map((t, i) => <li key={i}>{t}</li>)}
                        </ol>
                        <label className={`rgx-ack${termsAgreed ? ' is-on' : ''}`}>
                          <input type="checkbox" checked={termsAgreed} onChange={(e) => setTermsAgreed(e.target.checked)} />
                          <span>{tx('أقرّ بأنني قرأت الشروط والأحكام أعلاه وأوافق عليها بالكامل قبل إتمام التسجيل.', 'I have read and agree to all the terms and conditions above.')}</span>
                        </label>
                      </div>
                    )}

                    <div className="form-navigation">
                      <button type="button" className="btn btn-secondary" onClick={() => setStep(isSingleMode ? 0 : 1)}><Icon d={arrowBack} />{tx('السابق', 'Back')}</button>
                      <button type="button" className="btn btn-primary btn-submit" disabled={!canProceedStep2 || submitting} onClick={handleSubmit}>
                        {submitting ? <span className="loading-spinner" /> : <Icon d={IC.check} />}
                        {submitting ? tx('جاري التسجيل…', 'Submitting…') : tx('تأكيد التسجيل', 'Confirm registration')}
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === 3 && result && (
                  <motion.div key="done" className="wkr-done" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 20 }}>
                    <motion.span
                      className={`wkr-done-ico${result.paymentMethod === 'free' ? '' : ' wait'}`}
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.12 }}
                    >
                      <Icon d={result.paymentMethod === 'free' ? IC.check : IC.clock} />
                    </motion.span>
                    <h2>
                      {result.paymentMethod === 'free'
                        ? tx('تم التسجيل بنجاح!', 'Registration successful!')
                        : tx('تم استلام طلبك — بانتظار مراجعة الدفع', 'Received — awaiting payment review')}
                    </h2>
                    <span className="wkr-ref" dir="ltr">{result.invoiceNumber}</span>
                    <p>
                      {result.paymentMethod === 'free' && tx('تسجيلك مفعّل وسيصلك بريد التأكيد مع بطاقة الحضور.', 'Your seat is confirmed. Check your inbox for the workshop email and attendance ID.')}
                      {result.paymentMethod === 'bank_transfer' && tx('استلمنا صورة إشعار التحويل. سيقوم فريق الإدارة بالتحقق منها وسيصلك بريد التأكيد النهائي مع الفاتورة قريباً.', 'We received your transfer receipt. Our team will verify it and email you the final confirmation and invoice shortly.')}
                      {result.paymentMethod === 'mada' && tx('يرجى الحضور إلى مقر فاب لاب الأحساء لإتمام الدفع بمدى. سيقوم فريقنا بتفعيل تسجيلك فور الدفع.', 'Please visit FabLab Al-Ahsa to pay by mada. Our team activates your seat right after payment.')}
                    </p>
                    <div className="wkr-done-sum">
                      <div><small>{tx('الورشة', 'Workshop')}</small><b>{result.workshop?.title || selectedWorkshop?.title}</b></div>
                      {Number(result.discountAmount) > 0 && (
                        <div><small>{tx('الخصم', 'Discount')}</small><b className="ok">−{money(result.discountAmount)}{result.couponCode ? ` (${result.couponCode} · ${result.couponPercent}%)` : ''}</b></div>
                      )}
                      {result.paymentAmount > 0 && <div><small>{tx('الإجمالي المستحق', 'Amount due')}</small><b className="due">{money(result.paymentAmount)}</b></div>}
                      <div><small>{tx('الحالة', 'Status')}</small><b>{result.paymentStatus === 'verified' ? tx('مؤكد', 'Confirmed') : tx('بانتظار المراجعة', 'Pending review')}</b></div>
                    </div>
                    <div className="wkr-done-actions">
                      <button type="button" className="btn btn-primary" onClick={() => navigate('/')}><Icon d={IC.home} />{tx('العودة للرئيسية', 'Back to home')}</button>
                      <button type="button" className="btn btn-secondary" onClick={() => navigate('/register')}><Icon d={IC.grid} />{tx('خدمات أخرى', 'Other services')}</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.section>
        </>
      )}
    </StudioShell>
  );
};

export default WorkshopRegistration;
