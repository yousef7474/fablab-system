import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import axios from 'axios';
import useCart from './useCart';
import './StorePage.css';

const API_URL = process.env.NODE_ENV === 'production'
  ? '/api'
  : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');

const SAR = (n) => `${Number(n || 0).toFixed(2)} ر.س`;

const emptyCheckout = {
  customerName: '', customerPhone: '', customerEmail: '',
  customerNationalId: '', deliveryAddress: '', notes: ''
};

const StorePage = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();
  const cart = useCart();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [drawer, setDrawer] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkout, setCheckout] = useState(emptyCheckout);
  const [placing, setPlacing] = useState(false);
  const [orderResult, setOrderResult] = useState(null); // { orderNumber, total }
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${API_URL}/public/store/items`);
        setItems(Array.isArray(data) ? data : []);
      } catch (err) {
        toast.error(isRTL ? 'تعذّر تحميل المتجر' : 'Failed to load store');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(() => {
    const set = new Set();
    items.forEach(i => { if (i.category) set.add(i.category); });
    return ['all', ...set];
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (category !== 'all') list = list.filter(i => i.category === category);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(i =>
        (i.name || '').toLowerCase().includes(q) ||
        (i.nameEn || '').toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q)
      );
    }
    // Featured first, then by created
    return list.slice().sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
  }, [items, category, search]);

  const tax = +(cart.subtotal * 0.15).toFixed(2);
  const total = +(cart.subtotal + tax).toFixed(2);

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
        items: cart.lines.map(l => ({ itemId: l.itemId, quantity: l.quantity }))
      });
      setOrderResult({ orderNumber: data.orderNumber, total: data.total });
      cart.clear();
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

      <main className="st-main">
        {/* Hero */}
        <header className="st-hero">
          <span className="st-hero-eyebrow">{isRTL ? 'متجر فاب لاب' : 'FABLAB STORE'}</span>
          <h1 className="st-hero-title">
            {isRTL ? 'تسوّق أدوات ومكونات فاب لاب الأحساء' : 'Shop FabLab Al-Ahsa Tools & Kits'}
          </h1>
          <p className="st-hero-sub">
            {isRTL
              ? 'اختر من مجموعة الأدوات، المكونات، والمواد الاستهلاكية. الدفع نقداً عند الاستلام.'
              : 'Pick from our tools, components, and consumables. Cash payment on pickup.'}
          </p>
        </header>

        {/* Filters */}
        <div className="st-filters">
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
          <div className="st-cats">
            {categories.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`st-cat ${category === c ? 'is-active' : ''}`}
              >
                {c === 'all' ? (isRTL ? 'الكل' : 'All') : c}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="st-loading">
            <div className="st-spinner" />
            <span>{isRTL ? 'جارٍ التحميل...' : 'Loading...'}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="st-empty">
            <div style={{ fontSize: 48, opacity: 0.4 }}>🛍️</div>
            <p>{isRTL ? 'لا توجد منتجات' : 'No products'}</p>
          </div>
        ) : (
          <div className="st-grid">
            {filtered.map(item => (
              <motion.div
                key={item.itemId}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4 }}
                className="st-card"
                onClick={() => setSelected(item)}
              >
                {item.isFeatured && <span className="st-badge">{isRTL ? '⭐ مميز' : '⭐ Featured'}</span>}
                <div className="st-card-img">
                  {item.images?.[0]
                    ? <img src={item.images[0]} alt={item.name} loading="lazy" />
                    : <div className="st-card-img-empty">📦</div>}
                </div>
                <div className="st-card-body">
                  <div className="st-card-name">{isRTL ? item.name : (item.nameEn || item.name)}</div>
                  {item.description && (
                    <div className="st-card-desc">{isRTL ? item.description : (item.descriptionEn || item.description)}</div>
                  )}
                  <div className="st-card-foot">
                    <div className="st-card-price">{SAR(item.price)}</div>
                    <div className={`st-card-stock ${item.stock === 0 ? 'is-out' : ''}`}>
                      {item.stock < 0
                        ? (isRTL ? 'متوفر' : 'Available')
                        : item.stock === 0
                          ? (isRTL ? 'غير متوفر' : 'Out of stock')
                          : (isRTL ? `متبقي ${item.stock}` : `${item.stock} left`)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="st-card-add"
                    disabled={item.stock === 0}
                    onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                  >
                    {item.stock === 0
                      ? (isRTL ? 'غير متوفر' : 'Out of stock')
                      : (isRTL ? '🛒 أضف للسلة' : '🛒 Add to cart')}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

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
                  <div className="st-totals">
                    <div><span>{isRTL ? 'المجموع الفرعي' : 'Subtotal'}</span><b>{SAR(cart.subtotal)}</b></div>
                    <div><span>{isRTL ? 'ضريبة القيمة المضافة 15%' : 'VAT 15%'}</span><b>{SAR(tax)}</b></div>
                    <div className="st-totals-final"><span>{isRTL ? 'الإجمالي' : 'Total'}</span><b>{SAR(total)}</b></div>
                  </div>
                  <button type="button" className="st-checkout-btn" onClick={openCheckout}>
                    {isRTL ? 'إتمام الشراء' : 'Checkout'} →
                  </button>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Item detail modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="st-modal-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
          >
            <motion.div
              className="st-modal"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" className="st-modal-close" onClick={() => setSelected(null)}>✕</button>
              <div className="st-modal-body">
                <div className="st-modal-img">
                  {selected.images?.[0] ? <img src={selected.images[0]} alt={selected.name} /> : <div className="st-card-img-empty">📦</div>}
                </div>
                <div>
                  {selected.category && <div className="st-modal-cat">{selected.category}</div>}
                  <h2>{isRTL ? selected.name : (selected.nameEn || selected.name)}</h2>
                  {selected.description && <p className="st-modal-desc">{isRTL ? selected.description : (selected.descriptionEn || selected.description)}</p>}
                  <div className="st-modal-price">{SAR(selected.price)}</div>
                  <div className={`st-card-stock ${selected.stock === 0 ? 'is-out' : ''}`}>
                    {selected.stock < 0
                      ? (isRTL ? 'متوفر' : 'Available')
                      : selected.stock === 0
                        ? (isRTL ? 'غير متوفر' : 'Out of stock')
                        : (isRTL ? `متبقي ${selected.stock}` : `${selected.stock} left`)}
                  </div>
                  <button
                    type="button"
                    className="st-card-add"
                    disabled={selected.stock === 0}
                    onClick={() => { addToCart(selected); setSelected(null); }}
                    style={{ marginTop: 16 }}
                  >
                    {isRTL ? '🛒 أضف للسلة' : '🛒 Add to cart'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
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
                <button type="button" className="st-btn st-btn--primary" onClick={() => navigate('/register')}>
                  {isRTL ? 'العودة للرئيسية' : 'Back to Home'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StorePage;
