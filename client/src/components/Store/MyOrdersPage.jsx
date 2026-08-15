import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import axios from 'axios';
import { listRememberedOrders, forgetOrder } from './useCart';
import useCustomer from './useCustomer';
import AuthModal from './AuthModal';
import './StorePage.css';
import './MyOrdersPage.css';

const API_URL = process.env.NODE_ENV === 'production'
  ? '/api'
  : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');

const SAR = (n) => `${Number(n || 0).toFixed(2)} ر.س`;
const fmtOrderNo = (n) => n == null ? '—' : `INV-${String(n).padStart(4, '0')}`;
const fmtWhen = (v, isRTL) => v ? new Date(v).toLocaleString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-US', {
  calendar: 'gregory', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
}) : '—';

const STATUS_MAP = {
  pending:   { ar: 'قيد المراجعة',  en: 'Pending Review',  bg: '#fef3c7', fg: '#92400e', icon: '⏳' },
  confirmed: { ar: 'تم التأكيد',    en: 'Confirmed',       bg: '#dbeafe', fg: '#1d4ed8', icon: '✓' },
  ready:     { ar: 'جاهز للاستلام', en: 'Ready for Pickup', bg: '#e0f2fe', fg: '#0369a1', icon: '📦' },
  completed: { ar: 'مكتمل',         en: 'Completed',       bg: '#dcfce7', fg: '#166534', icon: '✅' },
  cancelled: { ar: 'ملغى',          en: 'Cancelled',       bg: '#fee2e2', fg: '#b91c1c', icon: '✕' }
};

const MyOrdersPage = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();

  const auth = useCustomer();
  const [authOpen, setAuthOpen] = useState(false);
  const [remembered, setRemembered] = useState(() => listRememberedOrders());
  const [orders, setOrders] = useState({}); // orderId → order
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [serverOrders, setServerOrders] = useState([]);

  // Prefer the server-side order list when the customer is logged in;
  // otherwise fall back to the localStorage-remembered list.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (auth.customer && auth.token) {
        try {
          const { data } = await axios.get(`${API_URL}/public/store/customer/orders`, {
            headers: { Authorization: `Bearer ${auth.token}` }
          });
          if (!cancelled) {
            setServerOrders(Array.isArray(data) ? data : []);
            setLoading(false);
          }
          return;
        } catch (err) {
          console.warn('customer myOrders load failed', err);
        }
      }
      // Fallback — pull individual orders by remembered id
      const list = listRememberedOrders();
      if (list.length === 0) { if (!cancelled) { setServerOrders([]); setLoading(false); } return; }
      const results = await Promise.allSettled(
        list.map(x => axios.get(`${API_URL}/public/store/orders/${x.orderId}`))
      );
      const map = {};
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') map[list[i].orderId] = r.value.data;
      });
      if (!cancelled) { setOrders(map); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [auth.customer, auth.token]);

  const removeOrder = (orderId) => {
    if (!window.confirm(isRTL ? 'إزالة هذا الطلب من قائمتك؟ لن يُحذف الطلب من النظام.' : 'Remove this order from your list? The order remains in the system.')) return;
    forgetOrder(orderId);
    setRemembered(listRememberedOrders());
  };

  const displayList = auth.customer
    ? serverOrders.map(o => ({ orderId: o.orderId, orderNumber: o.orderNumber, total: o.total, savedAt: o.createdAt, order: o }))
    : [...remembered].sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt)).map(r => ({ ...r, order: orders[r.orderId] }));
  const spent = displayList.reduce((s, x) => s + Number(x.order?.total || 0), 0);
  const completedCount = displayList.filter(x => x.order?.status === 'completed').length;

  return (
    <div className="st" dir={isRTL ? 'rtl' : 'ltr'}>
      <header className="st-topbar">
        <div className="st-topbar-inner">
          <button className="st-topbar-brand" onClick={() => navigate('/store')} type="button">
            <img src="/logo.png" alt="" className="st-topbar-logo" />
            <div className="st-topbar-titles">
              <span className="st-topbar-title">{isRTL ? 'فاب لاب الأحساء' : 'FabLab Al-Ahsa'}</span>
              <span className="st-topbar-sub">{isRTL ? 'طلباتي' : 'My Orders'}</span>
            </div>
          </button>
          <div className="st-topbar-actions">
            <button className="st-topbar-back" type="button" onClick={() => navigate('/store')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
              <span>{isRTL ? 'المتجر' : 'Store'}</span>
            </button>
            {auth.customer ? (
              <div className="st-user-chip">
                <span className="st-user-avatar">{(auth.customer.name || '?')[0].toUpperCase()}</span>
                <span className="st-user-name">{auth.customer.name}</span>
                <button type="button" className="st-user-logout" onClick={auth.logout} title={isRTL ? 'خروج' : 'Sign out'}>
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
                <span>{isRTL ? 'دخول' : 'Sign In'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mo-main">
        <header className="mo-hero">
          <h1>{isRTL ? 'طلباتي' : 'My Orders'}</h1>
          <p>
            {isRTL
              ? 'جميع طلباتك من هذا المتصفح. تظهر الحالة والفاتورة لكل طلب.'
              : 'All your orders from this browser. See status and invoice for each.'}
          </p>
        </header>

        {!auth.customer && (
          <div className="mo-signin-banner">
            <div>
              <b>{isRTL ? '💡 سجّل دخولك لعرض جميع طلباتك' : '💡 Sign in to see all your orders'}</b>
              <span>{isRTL ? 'اربط طلباتك بحسابك للوصول إليها من أي جهاز' : 'Link your orders to your account and access them from any device'}</span>
            </div>
            <button className="st-btn st-btn--primary" onClick={() => setAuthOpen(true)}>
              {isRTL ? 'تسجيل الدخول' : 'Sign In'}
            </button>
          </div>
        )}

        {loading ? (
          <div className="st-loading"><div className="st-spinner" /><span>{isRTL ? 'جارٍ التحميل...' : 'Loading...'}</span></div>
        ) : displayList.length === 0 ? (
          <div className="mo-empty">
            <div style={{ fontSize: 64, opacity: 0.35 }}>📄</div>
            <h3>{isRTL ? 'لا توجد طلبات بعد' : 'No orders yet'}</h3>
            <p>{isRTL ? 'ابدأ التسوق من المتجر لعرض طلباتك هنا.' : 'Start shopping to see your orders here.'}</p>
            <button className="st-btn st-btn--primary" onClick={() => navigate('/store')}>
              {isRTL ? '🛍️ ابدأ التسوق' : '🛍️ Start Shopping'}
            </button>
          </div>
        ) : (
          <>
            <div className="mo-stats">
              <div className="mo-stat">
                <div className="mo-stat-value">{displayList.length}</div>
                <div className="mo-stat-label">{isRTL ? 'إجمالي الطلبات' : 'Total Orders'}</div>
              </div>
              <div className="mo-stat">
                <div className="mo-stat-value">{completedCount}</div>
                <div className="mo-stat-label">{isRTL ? 'مكتملة' : 'Completed'}</div>
              </div>
              <div className="mo-stat">
                <div className="mo-stat-value" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{SAR(spent)}</div>
                <div className="mo-stat-label">{isRTL ? 'إجمالي المصروف' : 'Total Spent'}</div>
              </div>
            </div>

            <div className="mo-list">
              {displayList.map(rec => {
                const o = rec.order;
                if (!o) {
                  return (
                    <div key={rec.orderId} className="mo-card is-missing">
                      <div className="mo-card-left">
                        <div className="mo-card-no">{fmtOrderNo(rec.orderNumber)}</div>
                        <div className="mo-card-missing">{isRTL ? 'تعذّر تحميل هذا الطلب' : 'Could not load this order'}</div>
                      </div>
                      <button className="mo-remove" onClick={() => removeOrder(rec.orderId)}>{isRTL ? 'إزالة' : 'Remove'}</button>
                    </div>
                  );
                }
                const status = STATUS_MAP[o.status] || STATUS_MAP.pending;
                return (
                  <motion.div
                    key={o.orderId}
                    layout
                    className="mo-card"
                    onClick={() => setSelectedOrder(o)}
                  >
                    <div className="mo-card-left">
                      <div className="mo-card-no">{fmtOrderNo(o.orderNumber)}</div>
                      <div className="mo-card-when">{fmtWhen(o.createdAt, isRTL)}</div>
                    </div>
                    <div className="mo-card-items">
                      {(o.items || []).slice(0, 4).map((line, i) => (
                        <div key={i} className="mo-thumb" title={line.name}>
                          {line.image ? <img src={line.image} alt="" /> : <span>📦</span>}
                        </div>
                      ))}
                      {(o.items || []).length > 4 && <div className="mo-thumb mo-thumb--more">+{o.items.length - 4}</div>}
                    </div>
                    <div className="mo-card-total">
                      <div>{SAR(o.total)}</div>
                      <span>{(o.items || []).length} {isRTL ? 'صنف' : 'items'}</span>
                    </div>
                    <div className="mo-card-status">
                      <span className="mo-status" style={{ background: status.bg, color: status.fg }}>
                        {status.icon} {isRTL ? status.ar : status.en}
                      </span>
                      {o.paidAt && <span className="mo-paid">💵 {isRTL ? 'مدفوع' : 'Paid'}</span>}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </div>

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

      {/* Detail modal */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div className="st-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedOrder(null)}>
            <motion.div className="st-modal" style={{ maxWidth: 640 }} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <div className="st-modal-head">
                <div>
                  <div className="st-drawer-kicker">{isRTL ? 'الطلب' : 'Order'}</div>
                  <h3 style={{ fontFamily: 'JetBrains Mono, monospace', color: '#EE2329' }}>{fmtOrderNo(selectedOrder.orderNumber)}</h3>
                </div>
                <button type="button" className="st-modal-close" onClick={() => setSelectedOrder(null)}>✕</button>
              </div>
              <div style={{ padding: 22, overflowY: 'auto' }}>
                <div className="mo-info">
                  <div><span>{isRTL ? 'التاريخ' : 'Date'}</span><b>{fmtWhen(selectedOrder.createdAt, isRTL)}</b></div>
                  <div><span>{isRTL ? 'الحالة' : 'Status'}</span><b>{(STATUS_MAP[selectedOrder.status] || STATUS_MAP.pending)[isRTL ? 'ar' : 'en']}</b></div>
                  <div><span>{isRTL ? 'الدفع' : 'Payment'}</span><b>{selectedOrder.paidAt ? (isRTL ? '✓ مدفوع' : '✓ Paid') : (isRTL ? 'نقداً عند الاستلام' : 'Cash on pickup')}</b></div>
                </div>

                <table className="mo-items-table">
                  <thead><tr><th>{isRTL ? 'الصنف' : 'Item'}</th><th>{isRTL ? 'الكمية' : 'Qty'}</th><th>{isRTL ? 'السعر' : 'Price'}</th><th>{isRTL ? 'الإجمالي' : 'Total'}</th></tr></thead>
                  <tbody>
                    {(selectedOrder.items || []).map((line, i) => (
                      <tr key={i}>
                        <td>{line.name}</td>
                        <td style={{ textAlign: 'center' }}>{line.quantity}</td>
                        <td style={{ textAlign: 'end' }}>{SAR(line.price)}</td>
                        <td style={{ textAlign: 'end', fontWeight: 700 }}>{SAR(line.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr><td colSpan={3} style={{ textAlign: 'end', color: '#64748b' }}>{isRTL ? 'المجموع الفرعي' : 'Subtotal'}</td><td style={{ textAlign: 'end' }}>{SAR(selectedOrder.subtotal)}</td></tr>
                    {Number(selectedOrder.discountAmount) > 0 && (
                      <tr><td colSpan={3} style={{ textAlign: 'end', color: '#16a34a' }}>{isRTL ? `خصم (${selectedOrder.couponCode})` : `Discount (${selectedOrder.couponCode})`}</td><td style={{ textAlign: 'end', color: '#16a34a' }}>-{SAR(selectedOrder.discountAmount)}</td></tr>
                    )}
                    <tr><td colSpan={3} style={{ textAlign: 'end', color: '#64748b' }}>{isRTL ? `ضريبة ${Math.round((selectedOrder.taxRate || 0) * 100)}%` : `VAT ${Math.round((selectedOrder.taxRate || 0) * 100)}%`}</td><td style={{ textAlign: 'end' }}>{SAR(selectedOrder.taxAmount)}</td></tr>
                    <tr className="mo-items-final"><td colSpan={3} style={{ textAlign: 'end' }}>{isRTL ? 'الإجمالي' : 'Total'}</td><td style={{ textAlign: 'end' }}>{SAR(selectedOrder.total)}</td></tr>
                  </tfoot>
                </table>

                {selectedOrder.deliveryAddress && (
                  <div className="mo-note"><b>{isRTL ? 'العنوان: ' : 'Address: '}</b>{selectedOrder.deliveryAddress}</div>
                )}
                {selectedOrder.notes && (
                  <div className="mo-note"><b>{isRTL ? 'ملاحظاتك: ' : 'Your notes: '}</b>{selectedOrder.notes}</div>
                )}
              </div>
              <div className="st-modal-foot" style={{ padding: '14px 22px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="st-btn st-btn--ghost" onClick={() => removeOrder(selectedOrder.orderId)}>{isRTL ? '🗑️ إزالة من قائمتي' : '🗑️ Remove from list'}</button>
                <button className="st-btn st-btn--primary" onClick={() => setSelectedOrder(null)}>{isRTL ? 'إغلاق' : 'Close'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MyOrdersPage;
