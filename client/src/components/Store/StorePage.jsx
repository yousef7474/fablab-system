import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import axios from 'axios';
import useCart, { rememberOrder } from './useCart';
import useCustomer from './useCustomer';
import AuthModal from './AuthModal';
import './StorePage.css';

const API_URL = process.env.NODE_ENV === 'production'
  ? '/api'
  : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');

const SAR = (n) => `${Number(n || 0).toFixed(2)} ر.س`;

// Render a plain-text description with professional typography. When
// a group of consecutive lines all start with a bullet marker
// (•, -, *, or Arabic numeric ordering), promote them to a real <ul>
// so the modal shows a tidy list instead of a flat paragraph. Any
// other text renders inside <p> with white-space:pre-wrap so admin's
// line breaks are preserved.
const BULLET_RE = /^\s*[•\-*·▪●◆◇]\s+/;
const renderProseWithBullets = (text) => {
  const lines = String(text).split(/\r?\n/);
  const blocks = [];
  let paragraph = [];
  let list = [];
  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'p', text: paragraph.join('\n') });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push({ type: 'ul', items: [...list] });
      list = [];
    }
  };
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }
    if (BULLET_RE.test(trimmed)) {
      flushParagraph();
      list.push(trimmed.replace(BULLET_RE, ''));
    } else {
      flushList();
      paragraph.push(raw);
    }
  }
  flushParagraph();
  flushList();

  return blocks.map((b, i) => b.type === 'ul'
    ? <ul key={i}>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>
    : <p key={i} style={{ margin: i === 0 ? '0 0 8px' : '8px 0' }}>{b.text}</p>
  );
};

const emptyCheckout = {
  customerName: '', customerPhone: '', customerEmail: '',
  customerNationalId: '', deliveryAddress: '', notes: ''
};

const StorePage = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();
  const cart = useCart();
  const auth = useCustomer();
  const [authOpen, setAuthOpen] = useState(false);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [drawer, setDrawer] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Admin-controlled temporary closure — blocks checkout and shows a banner.
  const [storeClosed, setStoreClosed] = useState(false);
  const [storeCloseReason, setStoreCloseReason] = useState('');

  // Coupon
  const [couponInput, setCouponInput] = useState('');
  const [couponApplied, setCouponApplied] = useState(null); // { code, percent, discountAmount }
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // Checkout state
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkout, setCheckout] = useState(emptyCheckout);
  const [placing, setPlacing] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [selected, setSelected] = useState(null);
  const [galleryIdx, setGalleryIdx] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [itemsRes, statusRes] = await Promise.all([
          axios.get(`${API_URL}/public/store/items`),
          axios.get(`${API_URL}/settings/store-status`).catch(() => ({ data: { disabled: false, reason: '' } }))
        ]);
        setItems(Array.isArray(itemsRes.data) ? itemsRes.data : []);
        setStoreClosed(!!statusRes.data.disabled);
        setStoreCloseReason(statusRes.data.reason || '');
      } catch (err) {
        toast.error(isRTL ? 'تعذّر تحميل المتجر' : 'Failed to load store');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(() => {
    const map = new Map();
    items.forEach(i => {
      const k = i.category || (isRTL ? 'بدون فئة' : 'Uncategorized');
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [items, isRTL]);

  const filtered = useMemo(() => {
    let list = items;
    if (category !== 'all') list = list.filter(i => (i.category || (isRTL ? 'بدون فئة' : 'Uncategorized')) === category);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(i =>
        (i.name || '').toLowerCase().includes(q) ||
        (i.nameEn || '').toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q)
      );
    }
    return list.slice().sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
  }, [items, category, search, isRTL]);

  const featuredCount = useMemo(() => items.filter(i => i.isFeatured).length, [items]);

  // Recompute totals when cart or coupon changes
  const discountAmount = couponApplied ? +(cart.subtotal * (couponApplied.percent / 100)).toFixed(2) : 0;
  const netAfterDiscount = +(cart.subtotal - discountAmount).toFixed(2);
  const tax = +(netAfterDiscount * 0.15).toFixed(2);
  const total = +(netAfterDiscount + tax).toFixed(2);

  // Auto-clear the coupon if the cart empties
  useEffect(() => {
    if (cart.subtotal === 0 && couponApplied) setCouponApplied(null);
  }, [cart.subtotal, couponApplied]);

  // Pre-fill checkout from the signed-in customer whenever the modal
  // opens or the user's profile changes.
  useEffect(() => {
    if (auth.customer) {
      setCheckout(c => ({
        ...c,
        customerName: c.customerName || auth.customer.name || '',
        customerPhone: c.customerPhone || auth.customer.phone || '',
        customerEmail: c.customerEmail || auth.customer.email || '',
        customerNationalId: c.customerNationalId || auth.customer.nationalId || '',
        deliveryAddress: c.deliveryAddress || auth.customer.address || ''
      }));
    }
  }, [auth.customer]);

  const applyCoupon = async () => {
    if (!couponInput.trim()) {
      toast.error(isRTL ? 'أدخل رمز الخصم' : 'Enter a code');
      return;
    }
    setValidatingCoupon(true);
    try {
      const { data } = await axios.post(`${API_URL}/public/store/coupon/validate`, {
        code: couponInput.trim().toUpperCase(),
        subtotal: cart.subtotal
      });
      setCouponApplied({
        code: data.code,
        percent: data.percent,
        description: data.description
      });
      setCouponInput('');
      toast.success(isRTL ? `تم تطبيق خصم ${data.percent}%` : `${data.percent}% off applied`);
    } catch (err) {
      // Surface the server's actual reason — it's much more useful than
      // a generic "invalid code" toast when the coupon exists but the
      // rules failed (min-order, dates, usage cap, disabled, ...).
      console.warn('Coupon validation failed:', err?.response?.status, err?.response?.data);
      const body = err?.response?.data || {};
      const msg = body.messageAr || body.message
        || `${isRTL ? 'خطأ' : 'Error'} ${err?.response?.status || ''}`.trim()
        || (isRTL ? 'رمز غير صالح' : 'Invalid code');
      toast.error(msg);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const clearCoupon = () => {
    setCouponApplied(null);
    setCouponInput('');
  };

  const addToCart = (item) => {
    if (item.stock === 0) {
      toast.warning(isRTL ? 'غير متوفر حالياً' : 'Out of stock');
      return;
    }
    cart.add(item, 1);
    toast.success(isRTL ? `تمت الإضافة — ${item.name}` : `Added — ${item.name}`);
  };

  const openCheckout = () => {
    if (cart.lines.length === 0) return;
    if (storeClosed) {
      toast.warning(storeCloseReason || (isRTL ? 'المتجر مغلق مؤقتاً' : 'Store is temporarily closed'));
      return;
    }
    setCheckoutOpen(true);
    setDrawer(false);
  };

  const placeOrder = async (e) => {
    e.preventDefault();
    if (!checkout.customerName.trim() || !checkout.customerPhone.trim() || !checkout.customerEmail.trim()) {
      toast.error(isRTL ? 'الاسم، الجوال، والبريد مطلوبة' : 'Name, phone and email are required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(checkout.customerEmail.trim())) {
      toast.error(isRTL ? 'بريد إلكتروني غير صالح' : 'Invalid email');
      return;
    }
    setPlacing(true);
    try {
      const { data } = await axios.post(`${API_URL}/public/store/orders`, {
        ...checkout,
        items: cart.lines.map(l => ({ itemId: l.itemId, quantity: l.quantity })),
        couponCode: couponApplied?.code || null
      });
      rememberOrder({ orderId: data.orderId, orderNumber: data.orderNumber, total: data.total });
      setOrderResult({ orderId: data.orderId, orderNumber: data.orderNumber, total: data.total });
      cart.clear();
      setCouponApplied(null);
      setCheckoutOpen(false);
      setCheckout(emptyCheckout);
    } catch (err) {
      toast.error(err?.response?.data?.messageAr || err?.response?.data?.message || (isRTL ? 'تعذّر تقديم الطلب' : 'Order failed'));
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="st" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Everything under .st-inner gets blurred when the store is closed. */}
      <div className={`st-inner ${storeClosed ? 'is-blurred' : ''}`}>
      {/* Topbar */}
      <header className="st-topbar">
        <div className="st-topbar-inner">
          <button className="st-topbar-brand" onClick={() => navigate('/register')} type="button">
            <img src="/logo.png" alt="" className="st-topbar-logo" />
            <div className="st-topbar-titles">
              <span className="st-topbar-title">{isRTL ? 'فاب لاب الأحساء' : 'FabLab Al-Ahsa'}</span>
              <span className="st-topbar-sub">{isRTL ? 'المتجر' : 'Store'}</span>
            </div>
          </button>
          <div className="st-topbar-actions">
            <button
              type="button"
              className="st-lang-btn"
              onClick={() => i18n.changeLanguage(isRTL ? 'en' : 'ar')}
              title={isRTL ? 'English' : 'العربية'}
            >
              {isRTL ? 'EN' : 'ع'}
            </button>
            <button className="st-sidebar-toggle" type="button" onClick={() => setSidebarOpen(true)} title={isRTL ? 'التصنيفات' : 'Categories'}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <button className="st-topbar-link" type="button" onClick={() => navigate('/store/my-orders')} title={isRTL ? 'طلباتي' : 'My Orders'}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              <span>{isRTL ? 'طلباتي' : 'My Orders'}</span>
            </button>
            {auth.customer ? (
              <div className="st-user-chip">
                <span className="st-user-avatar">{(auth.customer.name || '?')[0].toUpperCase()}</span>
                <span className="st-user-name">{auth.customer.name}</span>
                <button type="button" className="st-user-logout" onClick={() => { auth.logout(); toast.info(isRTL ? 'تم تسجيل الخروج' : 'Signed out'); }} title={isRTL ? 'خروج' : 'Sign out'}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </button>
              </div>
            ) : (
              <button type="button" className="st-signin-btn" onClick={() => setAuthOpen(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                <span>{isRTL ? 'تسجيل الدخول' : 'Sign In'}</span>
              </button>
            )}
            <button className="st-topbar-back" type="button" onClick={() => navigate('/register')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              <span>{isRTL ? 'الرئيسية' : 'Home'}</span>
            </button>
            <button className="st-cart-btn" type="button" onClick={() => setDrawer(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              {cart.count > 0 && <span className="st-cart-badge">{cart.count}</span>}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="st-hero-wrap">
        <div className="st-hero-inner">
          <div className="st-hero-content">
            <span className="st-hero-eyebrow">{isRTL ? '🛍️ متجر فاب لاب' : '🛍️ FABLAB STORE'}</span>
            <h1 className="st-hero-title">
              {isRTL ? 'أدوات، مكونات، ومواد للمبدعين' : 'Tools, Kits & Materials for Makers'}
            </h1>
            <p className="st-hero-sub">
              {isRTL
                ? 'كل ما تحتاج لتنفيذ مشاريعك في مكان واحد. الدفع نقداً عند الاستلام.'
                : 'Everything you need for your projects. Cash payment on pickup.'}
            </p>
            <div className="st-hero-badges">
              <span className="st-hero-badge">🚚 {isRTL ? 'استلام سريع' : 'Quick pickup'}</span>
              <span className="st-hero-badge">💵 {isRTL ? 'دفع نقدي' : 'Cash payment'}</span>
              <span className="st-hero-badge">✅ {isRTL ? 'ضمان الجودة' : 'Quality guaranteed'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Body layout: sidebar + main */}
      <div className="st-layout">
        {/* Categories sidebar */}
        <aside className={`st-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
          <div className="st-sidebar-head">
            <h3>{isRTL ? 'التصنيفات' : 'Categories'}</h3>
            <button type="button" className="st-sidebar-close" onClick={() => setSidebarOpen(false)}>✕</button>
          </div>
          <nav className="st-sidebar-nav">
            <button
              type="button"
              className={`st-sidebar-item ${category === 'all' ? 'is-active' : ''}`}
              onClick={() => { setCategory('all'); setSidebarOpen(false); }}
            >
              <span className="st-sidebar-icon">🛒</span>
              <span className="st-sidebar-label">{isRTL ? 'جميع المنتجات' : 'All Products'}</span>
              <span className="st-sidebar-count">{items.length}</span>
            </button>
            {featuredCount > 0 && (
              <button
                type="button"
                className={`st-sidebar-item ${category === '__featured' ? 'is-active' : ''}`}
                onClick={() => { setCategory('__featured'); setSidebarOpen(false); }}
              >
                <span className="st-sidebar-icon">⭐</span>
                <span className="st-sidebar-label">{isRTL ? 'المميّزة' : 'Featured'}</span>
                <span className="st-sidebar-count">{featuredCount}</span>
              </button>
            )}
            <div className="st-sidebar-divider">{isRTL ? 'الفئات' : 'CATEGORIES'}</div>
            {categories.map(c => (
              <button
                key={c.name}
                type="button"
                className={`st-sidebar-item ${category === c.name ? 'is-active' : ''}`}
                onClick={() => { setCategory(c.name); setSidebarOpen(false); }}
              >
                <span className="st-sidebar-icon">📦</span>
                <span className="st-sidebar-label">{c.name}</span>
                <span className="st-sidebar-count">{c.count}</span>
              </button>
            ))}
          </nav>
        </aside>
        <div className={`st-sidebar-overlay ${sidebarOpen ? 'is-open' : ''}`} onClick={() => setSidebarOpen(false)} />

        <main className="st-main">
          {/* Search + heading */}
          <div className="st-toolbar">
            <div className="st-toolbar-title">
              <h2>
                {category === 'all' ? (isRTL ? 'جميع المنتجات' : 'All Products')
                  : category === '__featured' ? (isRTL ? '⭐ المميزة' : '⭐ Featured')
                  : category}
              </h2>
              <span>{filtered.length} {isRTL ? 'منتج' : 'items'}</span>
            </div>
            <div className="st-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="search"
                placeholder={isRTL ? 'ابحث عن منتج...' : 'Search products...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="st-loading">
              <div className="st-spinner" />
              <span>{isRTL ? 'جارٍ التحميل...' : 'Loading...'}</span>
            </div>
          ) : (category === '__featured' ? filtered.filter(i => i.isFeatured) : filtered).length === 0 ? (
            <div className="st-empty">
              <div style={{ fontSize: 56, opacity: 0.35 }}>🛍️</div>
              <p>{isRTL ? 'لا توجد منتجات في هذه الفئة' : 'No products in this category'}</p>
            </div>
          ) : (
            <div className="st-grid">
              {(category === '__featured' ? filtered.filter(i => i.isFeatured) : filtered).map(item => (
                <motion.div
                  key={item.itemId}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="st-card-wrap"
                >
                  <StoreItemCard
                    item={item}
                    isRTL={isRTL}
                    onOpen={() => { setSelected(item); setGalleryIdx(0); }}
                    onAdd={() => addToCart(item)}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Cart drawer */}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div
              className="st-overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
            />
            <motion.aside
              className="st-drawer"
              initial={{ x: isRTL ? '-100%' : '100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRTL ? '-100%' : '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 240 }}
            >
              <div className="st-drawer-head">
                <div>
                  <div className="st-drawer-kicker">{isRTL ? 'سلة المشتريات' : 'Your Cart'}</div>
                  <h3>{cart.count} {isRTL ? 'عنصر' : 'items'}</h3>
                </div>
                <button type="button" onClick={() => setDrawer(false)} className="st-drawer-close">✕</button>
              </div>

              <div className="st-drawer-body">
                {cart.lines.length === 0 ? (
                  <div className="st-drawer-empty">
                    <div style={{ fontSize: 42, opacity: 0.4 }}>🛒</div>
                    <p>{isRTL ? 'سلتك فارغة' : 'Your cart is empty'}</p>
                  </div>
                ) : (
                  cart.lines.map(l => (
                    <div key={l.itemId} className="st-line">
                      <div className="st-line-img">
                        {l.image ? <img src={l.image} alt="" /> : <span>📦</span>}
                      </div>
                      <div className="st-line-body">
                        <div className="st-line-name">{l.name}</div>
                        <div className="st-line-price">{SAR(l.price)}</div>
                        <div className="st-line-qty">
                          <button type="button" onClick={() => cart.setQuantity(l.itemId, l.quantity - 1)} disabled={l.quantity <= 1}>−</button>
                          <span>{l.quantity}</span>
                          <button type="button" onClick={() => cart.setQuantity(l.itemId, l.quantity + 1)}>+</button>
                        </div>
                      </div>
                      <div className="st-line-total">
                        <div>{SAR(l.price * l.quantity)}</div>
                        <button type="button" className="st-line-remove" onClick={() => cart.remove(l.itemId)}>🗑️</button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.lines.length > 0 && (
                <div className="st-drawer-foot">
                  {/* Coupon */}
                  <div className="st-coupon-block">
                    {couponApplied ? (
                      <div className="st-coupon-applied">
                        <span>✓ {isRTL ? 'رمز خصم' : 'Discount code'}</span>
                        <b>{couponApplied.code}</b>
                        <span className="st-coupon-pct">-{couponApplied.percent}%</span>
                        <button type="button" onClick={clearCoupon} className="st-coupon-clear">✕</button>
                      </div>
                    ) : (
                      <div className="st-coupon-input">
                        <input
                          type="text"
                          placeholder={isRTL ? 'رمز خصم' : 'Discount code'}
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } }}
                          disabled={validatingCoupon}
                        />
                        <button type="button" onClick={applyCoupon} disabled={validatingCoupon || !couponInput.trim()}>
                          {validatingCoupon ? '...' : (isRTL ? 'تطبيق' : 'Apply')}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="st-totals">
                    <div><span>{isRTL ? 'المجموع الفرعي' : 'Subtotal'}</span><b>{SAR(cart.subtotal)}</b></div>
                    {discountAmount > 0 && (
                      <div className="st-totals-discount">
                        <span>{isRTL ? `خصم (${couponApplied.percent}%)` : `Discount (${couponApplied.percent}%)`}</span>
                        <b>-{SAR(discountAmount)}</b>
                      </div>
                    )}
                    <div><span>{isRTL ? 'ضريبة 15%' : 'VAT 15%'}</span><b>{SAR(tax)}</b></div>
                    <div className="st-totals-final"><span>{isRTL ? 'الإجمالي' : 'Total'}</span><b>{SAR(total)}</b></div>
                  </div>
                  <button
                    type="button"
                    className="st-checkout-btn"
                    onClick={openCheckout}
                    disabled={storeClosed}
                    style={storeClosed ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
                    title={storeClosed ? (storeCloseReason || (isRTL ? 'المتجر مغلق مؤقتاً' : 'Store is temporarily closed')) : undefined}
                  >
                    {storeClosed
                      ? (isRTL ? 'المتجر مغلق مؤقتاً' : 'Store closed')
                      : (isRTL ? 'إتمام الشراء' : 'Checkout')} {storeClosed ? '' : '→'}
                  </button>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Item detail modal — futuristic PDP */}
      <AnimatePresence>
        {selected && (
          <ItemDetailModal
            item={selected}
            isRTL={isRTL}
            galleryIdx={galleryIdx}
            setGalleryIdx={setGalleryIdx}
            onClose={() => { setSelected(null); setGalleryIdx(0); }}
            onAdd={(qty) => {
              for (let i = 0; i < qty; i++) addToCart(selected);
              setSelected(null);
              setGalleryIdx(0);
            }}
          />
        )}
      </AnimatePresence>

      {/* Checkout modal */}
      <AnimatePresence>
        {checkoutOpen && (
          <motion.div
            className="st-modal-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setCheckoutOpen(false)}
          >
            <motion.div
              className="st-modal st-modal--form"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="st-modal-head">
                <h3>{isRTL ? 'إتمام الشراء' : 'Checkout'}</h3>
                <button type="button" className="st-modal-close" onClick={() => setCheckoutOpen(false)}>✕</button>
              </div>
              <form onSubmit={placeOrder} className="st-checkout">
                <div className="st-checkout-grid">
                  <label className="st-field st-field--full">
                    <span>{isRTL ? 'الاسم الكامل *' : 'Full Name *'}</span>
                    <input type="text" value={checkout.customerName} onChange={e => setCheckout(c => ({ ...c, customerName: e.target.value }))} />
                  </label>
                  <label className="st-field">
                    <span>{isRTL ? 'رقم الجوال *' : 'Phone *'}</span>
                    <input type="tel" dir="ltr" value={checkout.customerPhone} onChange={e => setCheckout(c => ({ ...c, customerPhone: e.target.value }))} placeholder="05XXXXXXXX" />
                  </label>
                  <label className="st-field">
                    <span>{isRTL ? 'البريد الإلكتروني *' : 'Email *'}</span>
                    <input type="email" dir="ltr" value={checkout.customerEmail} onChange={e => setCheckout(c => ({ ...c, customerEmail: e.target.value }))} placeholder="name@example.com" />
                  </label>
                  <label className="st-field">
                    <span>{isRTL ? 'رقم الهوية (اختياري)' : 'National ID (optional)'}</span>
                    <input type="text" dir="ltr" value={checkout.customerNationalId} onChange={e => setCheckout(c => ({ ...c, customerNationalId: e.target.value }))} />
                  </label>
                  <label className="st-field st-field--full">
                    <span>{isRTL ? 'العنوان (اختياري)' : 'Address (optional)'}</span>
                    <input type="text" value={checkout.deliveryAddress} onChange={e => setCheckout(c => ({ ...c, deliveryAddress: e.target.value }))} />
                  </label>
                  <label className="st-field st-field--full">
                    <span>{isRTL ? 'ملاحظات (اختياري)' : 'Notes (optional)'}</span>
                    <textarea rows={2} value={checkout.notes} onChange={e => setCheckout(c => ({ ...c, notes: e.target.value }))} />
                  </label>
                </div>

                <div className="st-checkout-summary">
                  <div className="st-totals">
                    <div><span>{isRTL ? 'المجموع الفرعي' : 'Subtotal'}</span><b>{SAR(cart.subtotal)}</b></div>
                    {discountAmount > 0 && (
                      <div className="st-totals-discount">
                        <span>{isRTL ? `خصم (${couponApplied.code} · ${couponApplied.percent}%)` : `Discount (${couponApplied.code} · ${couponApplied.percent}%)`}</span>
                        <b>-{SAR(discountAmount)}</b>
                      </div>
                    )}
                    <div><span>{isRTL ? 'ضريبة 15%' : 'VAT 15%'}</span><b>{SAR(tax)}</b></div>
                    <div className="st-totals-final"><span>{isRTL ? 'الإجمالي' : 'Total'}</span><b>{SAR(total)}</b></div>
                  </div>
                  <div className="st-payment-note">
                    💵 {isRTL ? 'الدفع نقداً عند الاستلام' : 'Cash payment on pickup'}
                  </div>
                </div>

                <div className="st-checkout-actions">
                  <button type="button" className="st-btn st-btn--ghost" onClick={() => setCheckoutOpen(false)} disabled={placing}>
                    {isRTL ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button type="submit" className="st-btn st-btn--primary" disabled={placing}>
                    {placing ? (isRTL ? 'جارٍ الإرسال...' : 'Placing...') : (isRTL ? 'تأكيد الطلب' : 'Place Order')}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      </div>{/* /.st-inner */}

      {/* Auth modal */}
      <AnimatePresence>
        {authOpen && (
          <AuthModal
            isRTL={isRTL}
            onClose={() => setAuthOpen(false)}
            onSuccess={() => setAuthOpen(false)}
            login={auth.login}
            register={auth.register}
          />
        )}
      </AnimatePresence>

      {/* Success screen */}
      <AnimatePresence>
        {orderResult && (
          <motion.div
            className="st-modal-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="st-modal st-modal--success"
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            >
              <div className="st-success-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h2>{isRTL ? 'تم استلام طلبك!' : 'Order Received!'}</h2>
              <div className="st-success-order">
                {isRTL ? 'رقم الطلب' : 'Order No.'}
                <b dir="ltr">INV-{String(orderResult.orderNumber).padStart(4, '0')}</b>
              </div>
              <div className="st-success-total">
                {isRTL ? 'الإجمالي' : 'Total'}: <b>{SAR(orderResult.total)}</b>
              </div>
              <p>
                {isRTL
                  ? 'ستصلك رسالة تأكيد بالبريد مع تفاصيل الفاتورة. سنتواصل معك قريباً للتأكيد.'
                  : 'You will receive a confirmation email with the invoice. We will contact you shortly.'}
              </p>
              <div className="st-success-actions">
                <button type="button" className="st-btn st-btn--ghost" onClick={() => setOrderResult(null)}>
                  {isRTL ? 'متابعة التسوق' : 'Keep Shopping'}
                </button>
                <button type="button" className="st-btn st-btn--primary" onClick={() => navigate('/store/my-orders')}>
                  {isRTL ? 'عرض طلباتي' : 'View My Orders'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Store closed — full-page blocking overlay. Blurs the browsing
          layer beneath so it's clear no actions are possible. */}
      <AnimatePresence>
        {storeClosed && (
          <motion.div
            className="st-closed-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="st-closed-card"
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 220 }}
            >
              <div className="st-closed-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="10" width="16" height="12" rx="2"/>
                  <path d="M8 10V6a4 4 0 0 1 8 0v4"/>
                </svg>
              </div>
              <h2>{isRTL ? 'المتجر مغلق مؤقتاً' : 'Store Temporarily Closed'}</h2>
              <p className="st-closed-reason">
                {storeCloseReason || (isRTL ? 'الطلبات الجديدة معطّلة حالياً — سنعود قريباً' : 'New orders are disabled — we will be back soon')}
              </p>
              <div className="st-closed-actions">
                <button type="button" onClick={() => navigate('/register')}>
                  {isRTL ? 'العودة للصفحة الرئيسية' : 'Back to home'}
                </button>
                <button type="button" className="ghost" onClick={() => navigate('/store/my-orders')}>
                  {isRTL ? 'عرض طلباتي السابقة' : 'View my past orders'}
                </button>
              </div>
              <div className="st-closed-hint">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                <span>{isRTL ? 'سيتم استئناف الطلبات فور فتح المتجر مجدداً' : 'Orders will resume as soon as the store re-opens'}</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ---------- Item detail modal — futuristic PDP ----------
// - Two-column glass modal: gallery on one side, product info on the
//   other (stacks on mobile).
// - Directional arrows: SVG chevrons that respect RTL, and next/prev
//   wiring flips based on RTL so tapping "→" always means "forward".
// - Auto-cycling gallery every 4s while the modal is open — pauses if
//   the user manually navigates or hovers a thumbnail.
// - Feature chips extracted from bullet lines in the description.
// - Quantity stepper + gradient primary CTA with icon.
const ItemDetailModal = ({ item, isRTL, galleryIdx, setGalleryIdx, onClose, onAdd }) => {
  const images = Array.isArray(item.images) ? item.images.filter(Boolean) : [];
  const hasMany = images.length > 1;
  const desc = isRTL ? item.description : (item.descriptionEn || item.description);
  const [qty, setQty] = useState(1);
  const [auto, setAuto] = useState(true);
  const timerRef = useRef(null);

  // Auto-advance the gallery every 4s while enabled.
  useEffect(() => {
    if (!auto || !hasMany) return;
    timerRef.current = setInterval(() => {
      setGalleryIdx(i => (i + 1) % images.length);
    }, 4000);
    return () => clearInterval(timerRef.current);
  }, [auto, hasMany, images.length, setGalleryIdx]);

  // Keyboard navigation — arrow keys respect RTL.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') return onClose();
      if (!hasMany) return;
      if (e.key === 'ArrowRight') {
        setAuto(false);
        setGalleryIdx(i => isRTL
          ? (i + 1) % images.length              // RTL: right = next
          : (i - 1 + images.length) % images.length); // LTR: right = prev
      }
      if (e.key === 'ArrowLeft') {
        setAuto(false);
        setGalleryIdx(i => isRTL
          ? (i - 1 + images.length) % images.length  // RTL: left = prev
          : (i + 1) % images.length);                // LTR: left = next
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasMany, images.length, isRTL, onClose, setGalleryIdx]);

  const goPrev = () => { setAuto(false); setGalleryIdx(i => (i - 1 + images.length) % images.length); };
  const goNext = () => { setAuto(false); setGalleryIdx(i => (i + 1) % images.length); };

  // Split description into bullet features vs prose so we can render
  // "features chips" in the sidebar.
  const bullets = [];
  const proseLines = [];
  if (desc) {
    for (const line of String(desc).split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      if (BULLET_RE.test(t)) bullets.push(t.replace(BULLET_RE, ''));
      else proseLines.push(line);
    }
  }
  const prose = proseLines.join('\n');
  const currentImg = images[galleryIdx] || images[0];

  return (
    <motion.div
      className="st-pdp-overlay"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="st-pdp"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.96 }}
        transition={{ type: 'spring', damping: 22, stiffness: 240 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button type="button" className="st-pdp-close" onClick={onClose} aria-label="close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <div className="st-pdp-grid">
          {/* -------- Gallery -------- */}
          <div className="st-pdp-gallery">
            <div
              className="st-pdp-stage"
              onMouseEnter={() => setAuto(false)}
              onMouseLeave={() => setAuto(true)}
            >
              {currentImg ? (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.img
                    key={galleryIdx}
                    src={currentImg}
                    alt={item.name}
                    initial={{ opacity: 0, scale: 1.06 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                    draggable={false}
                  />
                </AnimatePresence>
              ) : (
                <div className="st-pdp-empty">📦</div>
              )}

              {item.isFeatured && (
                <div className="st-pdp-featured">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.6 6.5L21 9l-5 4.4L17.6 20 12 16.8 6.4 20 8 13.4 3 9l6.4-.5z"/></svg>
                  {isRTL ? 'مميّز' : 'Featured'}
                </div>
              )}

              {item.stock === 0 && (
                <div className="st-pdp-out">
                  <div>{isRTL ? '❌ نفدت الكمية' : '❌ Out of stock'}</div>
                </div>
              )}

              {hasMany && (
                <>
                  {/* Chevron arrows — visually match the reading direction.
                      Prev = "point-back", Next = "point-forward". */}
                  <button
                    type="button"
                    className="st-pdp-nav st-pdp-nav--prev"
                    onClick={goPrev}
                    aria-label={isRTL ? 'السابق' : 'Previous'}
                  >
                    {isRTL ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 6 9 12 15 18"/></svg>
                    )}
                  </button>
                  <button
                    type="button"
                    className="st-pdp-nav st-pdp-nav--next"
                    onClick={goNext}
                    aria-label={isRTL ? 'التالي' : 'Next'}
                  >
                    {isRTL ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 6 9 12 15 18"/></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
                    )}
                  </button>
                  <div className="st-pdp-counter">
                    <span>{galleryIdx + 1}</span>
                    <em>/ {images.length}</em>
                  </div>
                </>
              )}
            </div>

            {hasMany && (
              <div className="st-pdp-thumbs">
                {images.map((img, i) => (
                  <button
                    type="button"
                    key={i}
                    className={`st-pdp-thumb ${i === galleryIdx ? 'is-active' : ''}`}
                    onClick={() => { setAuto(false); setGalleryIdx(i); }}
                    onMouseEnter={() => setAuto(false)}
                  >
                    <img src={img} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* -------- Info sidebar -------- */}
          <div className="st-pdp-info">
            {item.category && (
              <div className="st-pdp-cat">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                {item.category}
              </div>
            )}
            <h2 className="st-pdp-title">{isRTL ? item.name : (item.nameEn || item.name)}</h2>

            {bullets.length > 0 && (
              <div className="st-pdp-features">
                {bullets.map((b, i) => (
                  <span key={i} className="st-pdp-chip">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {b}
                  </span>
                ))}
              </div>
            )}

            {prose && (
              <div className="st-pdp-desc-block">
                <div className="st-pdp-desc-label">
                  <span className="st-pdp-desc-bar" />
                  {isRTL ? 'وصف المنتج' : 'Product description'}
                </div>
                <div className="st-pdp-desc">{prose}</div>
              </div>
            )}

            <div className="st-pdp-priceline">
              <div className="st-pdp-priceline-main">
                <span className="st-pdp-price-label">{isRTL ? 'السعر' : 'Price'}</span>
                <motion.div
                  key={item.itemId}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="st-pdp-price"
                >{SAR(item.price)}</motion.div>
              </div>
              <div className={`st-pdp-stock ${item.stock === 0 ? 'is-out' : ''}`}>
                <span className="st-pdp-stock-dot" />
                {item.stock < 0
                  ? (isRTL ? 'متوفر بكميات كافية' : 'In stock')
                  : item.stock === 0
                    ? (isRTL ? 'نفدت الكمية' : 'Out of stock')
                    : (isRTL ? `متبقي ${item.stock}` : `${item.stock} left`)}
              </div>
            </div>

            {/* Quantity + CTA */}
            {item.stock !== 0 && (
              <div className="st-pdp-qty-row">
                <div className="st-pdp-qty">
                  <button type="button" onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="decrease">−</button>
                  <span>{qty}</span>
                  <button type="button" onClick={() => setQty(q => Math.min(99, q + 1))} aria-label="increase">+</button>
                </div>
                <button
                  type="button"
                  className="st-pdp-cta"
                  onClick={() => onAdd(qty)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                  </svg>
                  <span>{isRTL ? 'أضف للسلة' : 'Add to cart'}</span>
                  <b>{SAR(item.price * qty)}</b>
                </button>
              </div>
            )}
            {item.stock === 0 && (
              <button type="button" className="st-pdp-cta is-disabled" disabled>
                {isRTL ? 'غير متوفر حالياً' : 'Currently unavailable'}
              </button>
            )}

            {/* Trust row */}
            <div className="st-pdp-trust">
              <div className="st-pdp-trust-item">
                <span className="st-pdp-trust-icon">🚚</span>
                <div>
                  <b>{isRTL ? 'استلام سريع' : 'Quick pickup'}</b>
                  <span>{isRTL ? 'استلم من الفاب لاب' : 'Pick up at FabLab'}</span>
                </div>
              </div>
              <div className="st-pdp-trust-item">
                <span className="st-pdp-trust-icon">💵</span>
                <div>
                  <b>{isRTL ? 'دفع نقدي' : 'Cash payment'}</b>
                  <span>{isRTL ? 'عند الاستلام' : 'On pickup'}</span>
                </div>
              </div>
              <div className="st-pdp-trust-item">
                <span className="st-pdp-trust-icon">✅</span>
                <div>
                  <b>{isRTL ? 'ضمان الجودة' : 'Quality guarantee'}</b>
                  <span>{isRTL ? 'كل المنتجات مفحوصة' : 'Every item verified'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ---------- Storefront card with auto-cycling image gallery ----------
// Hover starts a 1.5s image rotation; leaving resets to the first
// image. Dot indicators show current frame. Crossfade transitions
// (motion) so the effect feels premium rather than jumpy.
const StoreItemCard = ({ item, isRTL, onOpen, onAdd }) => {
  const images = Array.isArray(item.images) ? item.images.filter(Boolean) : [];
  const hasMany = images.length > 1;
  const [idx, setIdx] = useState(0);
  const [hovering, setHovering] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!hovering || !hasMany) {
      clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setIdx(i => (i + 1) % images.length);
    }, 1500);
    return () => clearInterval(timerRef.current);
  }, [hovering, hasMany, images.length]);

  // Reset frame when hover ends so the primary image is always the cover.
  useEffect(() => { if (!hovering) setIdx(0); }, [hovering]);

  return (
    <div
      className="st-card"
      onClick={onOpen}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {item.isFeatured && <span className="st-badge">⭐ {isRTL ? 'مميز' : 'Featured'}</span>}
      <div className="st-card-img">
        {images[0] ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.img
              key={idx}
              src={images[idx]}
              alt={item.name}
              loading="lazy"
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            />
          </AnimatePresence>
        ) : (
          <div className="st-card-img-empty">📦</div>
        )}
        {item.stock === 0 && (
          <div className="st-card-out-overlay">{isRTL ? 'نفدت الكمية' : 'Out of stock'}</div>
        )}
        {hasMany && (
          <>
            <span className="st-card-photos">📷 {images.length}</span>
            {/* dot indicators */}
            <div className="st-card-dots" aria-hidden="true">
              {images.map((_, i) => (
                <span
                  key={i}
                  className={`st-card-dot ${i === idx ? 'is-active' : ''}`}
                />
              ))}
            </div>
          </>
        )}
        {/* Quick-view overlay button — reveals on hover */}
        <div className="st-card-quick">
          <span>{isRTL ? '👁 عرض سريع' : '👁 Quick view'}</span>
        </div>
      </div>
      <div className="st-card-body">
        {item.category && <div className="st-card-cat">{item.category}</div>}
        <div className="st-card-name">{isRTL ? item.name : (item.nameEn || item.name)}</div>
        {item.description && (
          <div className="st-card-desc">
            {isRTL ? item.description : (item.descriptionEn || item.description)}
          </div>
        )}
        <div className="st-card-foot">
          <div className="st-card-price">{SAR(item.price)}</div>
          <div className={`st-card-stock ${item.stock === 0 ? 'is-out' : ''}`}>
            {item.stock < 0
              ? (isRTL ? '✓ متوفر' : '✓ Available')
              : item.stock === 0
                ? (isRTL ? 'غير متوفر' : 'Out')
                : (isRTL ? `${item.stock} متبقي` : `${item.stock} left`)}
          </div>
        </div>
        <button
          type="button"
          className="st-card-add"
          disabled={item.stock === 0}
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
          <span>{item.stock === 0
            ? (isRTL ? 'غير متوفر' : 'Out of stock')
            : (isRTL ? 'أضف للسلة' : 'Add to cart')}</span>
        </button>
      </div>
    </div>
  );
};

export default StorePage;
