// Shared hooks + helpers for the public website.
import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../config/api';
import T from './siteText';

// Images served by our API come back as "/api/site/…". In development the
// API runs on another port, so prefix them with the API origin.
const API_ORIGIN = String(api.defaults.baseURL || '').replace(/\/api\/?$/, '');
export const assetUrl = (u) => {
  if (!u) return '';
  if (/^(data:|https?:|blob:)/i.test(u)) return u;
  if (u.startsWith('/api/')) return `${API_ORIGIN}${u}`;
  return u;
};

export const useSiteLang = () => {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ar';
  const isRTL = lang === 'ar';
  const t = useCallback((key) => (T[lang] && T[lang][key]) ?? T.ar[key] ?? key, [lang]);
  // Pick the right language from { ar, en } objects / ar+en field pairs.
  const L = useCallback((obj) => (obj ? (obj[lang] ?? obj.ar) : ''), [lang]);
  const pick = useCallback((ar, en) => (lang === 'en' && en ? en : ar), [lang]);
  const toggle = useCallback(() => i18n.changeLanguage(lang === 'ar' ? 'en' : 'ar'), [i18n, lang]);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  return { lang, isRTL, t, L, pick, toggle };
};

// ---- Site content (contact, socials, stats, partners) ----
export const DEFAULT_CONTENT = {
  stats: { beneficiaries: 999, projects: 150, workshops: 999 },
  partners: [
    { id: 'kfu', name: 'جامعة الملك فيصل', nameEn: 'King Faisal University', logoUrl: '/site/partners/kfu.jpg' },
    { id: 'alahsa', name: 'غرفة الأحساء', nameEn: 'Al-Ahsa Chamber', logoUrl: '/site/partners/ALahsa.jpg' },
    { id: 'moe', name: 'وزارة التعليم', nameEn: 'Ministry of Education', logoUrl: '/site/partners/moe.png' },
    { id: 'saip', name: 'الهيئة السعودية للملكية الفكرية', nameEn: 'Saudi Authority for Intellectual Property', logoUrl: '/site/partners/safip.avif' },
    { id: 'mawhiba', name: 'مؤسسة الملك عبدالعزيز ورجاله للموهبة والإبداع', nameEn: 'King Abdulaziz & His Companions Foundation for Giftedness & Creativity', logoUrl: '/site/partners/kaahcffgac.png' },
    { id: 'sfcpd', name: 'الاتحاد السعودي للأمن السيبراني والبرمجة والدرونز', nameEn: 'Saudi Federation for Cybersecurity, Programming & Drones', logoUrl: '/site/partners/sffcpd.png' },
    { id: 'tuwaiq', name: 'أكاديمية طويق', nameEn: 'Tuwaiq Academy', logoUrl: '/site/partners/ta.jpg' },
    { id: 'tvtc', name: 'المؤسسة العامة للتدريب التقني والمهني', nameEn: 'Technical and Vocational Training Corporation', logoUrl: '/site/partners/tavtc.jpg' },
    { id: 'dow', name: 'Dow', nameEn: 'Dow', logoUrl: '/site/partners/dow.webp' }
  ],
  contact: {
    email: 'info@fablabahsa.org',
    phone: '013-58-40004',
    whatsapp: '',
    addressAr: 'الأحساء - حي الحزام الذهبي - شارع عين نجم',
    addressEn: 'Al-Ahsa - Golden Belt District - Ain Najm Street',
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3603.8507641559995!2d49.56045308498625!3d25.409805583797752!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3e37972ec8390af5%3A0x4a3f469489c0fcd9!2z2YHYp9ioINmE2KfYqCDYp9mE2KPYrdiz2KfYoQ!5e0!3m2!1sar!2ssa!4v1759741737132!5m2!1sar!2ssa'
  },
  social: {
    x: 'https://x.com/fablabahsa',
    instagram: 'https://instagram.com/fablabahsa',
    youtube: 'https://youtube.com/@fablabahsa',
    snapchat: 'https://snapchat.com/add/fablabahsa'
  },
  workingHoursAr: 'الأحد - الخميس: 9:00 ص - 6:00 م',
  workingHoursEn: 'Sunday - Thursday: 9:00 AM - 6:00 PM',
  internshipUniversities: [
    { id: 'kfu', name: 'جامعة الملك فيصل', nameEn: 'King Faisal University', logoUrl: null },
    { id: 'tech', name: 'الكلية التقنية بالأحساء', nameEn: 'Technical College in Al-Ahsa', logoUrl: null },
    { id: 'community', name: 'كلية المجتمع بالأحساء', nameEn: 'Community College in Al-Ahsa', logoUrl: null },
    { id: 'iau', name: 'جامعة الإمام عبدالرحمن بن فيصل', nameEn: 'Imam Abdulrahman Bin Faisal University', logoUrl: null }
  ]
};

const mergeContent = (data) => {
  const d = data && typeof data === 'object' ? data : {};
  const nonEmpty = (v) => v !== undefined && v !== null && v !== '';
  const merged = { ...DEFAULT_CONTENT };
  if (d.stats) merged.stats = { ...DEFAULT_CONTENT.stats, ...Object.fromEntries(Object.entries(d.stats).filter(([, v]) => nonEmpty(v))) };
  if (Array.isArray(d.partners) && d.partners.length) merged.partners = d.partners;
  if (d.contact) merged.contact = { ...DEFAULT_CONTENT.contact, ...Object.fromEntries(Object.entries(d.contact).filter(([, v]) => nonEmpty(v))) };
  if (d.social) merged.social = { ...DEFAULT_CONTENT.social, ...Object.fromEntries(Object.entries(d.social).filter(([, v]) => nonEmpty(v))) };
  if (nonEmpty(d.workingHoursAr)) merged.workingHoursAr = d.workingHoursAr;
  if (nonEmpty(d.workingHoursEn)) merged.workingHoursEn = d.workingHoursEn;
  if (Array.isArray(d.internshipUniversities) && d.internshipUniversities.length) merged.internshipUniversities = d.internshipUniversities;
  return merged;
};

let _contentPromise = null;
export const useSiteContent = () => {
  const [content, setContent] = useState(DEFAULT_CONTENT);
  useEffect(() => {
    let alive = true;
    if (!_contentPromise) {
      _contentPromise = api.get('/site/content')
        .then(r => mergeContent(r.data))
        .catch(() => { _contentPromise = null; return DEFAULT_CONTENT; });
    }
    _contentPromise.then(c => { if (alive) setContent(c); });
    return () => { alive = false; };
  }, []);
  return content;
};

// ---- Motion helpers ----
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const useInView = (options = { threshold: 0.15 }, once = true) => {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return undefined; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); if (once) io.disconnect(); }
      else if (!once) setInView(false);
    }, options);
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return [ref, inView];
};

// ---- Files → JSON payload { fileName, fileType, fileData (base64) } ----
export const fileToPayload = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const raw = String(e.target.result || '');
    resolve({
      fileName: file.name,
      fileType: (file.name.split('.').pop() || '').toLowerCase(),
      fileSize: file.size,
      fileData: raw.includes(',') ? raw.split(',').pop() : raw
    });
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

// Only http(s) / site-relative links from admin-entered content are followed.
export const safeUrl = (u) => (typeof u === 'string' && /^(https?:\/\/|\/(?!\/))/i.test(u.trim()) ? u.trim() : '');

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const apiError = (err, isRTL, fallbackAr, fallbackEn) => {
  const d = err?.response?.data || {};
  return (isRTL ? d.messageAr : d.message) || d.messageAr || d.message || (isRTL ? fallbackAr : fallbackEn);
};

export const fmtDate = (d, lang) => {
  if (!d) return '';
  const date = new Date(String(d).length <= 10 ? `${d}T00:00:00` : d);
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString(lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

// Scroll to an element id, accounting for the fixed header.
export const scrollToId = (id) => {
  const el = document.getElementById(id);
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - 96;
  window.scrollTo({ top: y, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
};
