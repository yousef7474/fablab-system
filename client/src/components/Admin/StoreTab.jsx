import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';
import './StoreTab.css';

const SAR = (n) => `${Number(n || 0).toFixed(2)} ر.س`;
const fmtOrderNo = (n) => n == null ? '—' : `INV-${String(n).padStart(4, '0')}`;
const fmtWhen = (v) => v ? new Date(v).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { calendar: 'gregory', hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : '—';

const STATUS_BADGES = {
  pending:   { text: 'قيد المراجعة', bg: '#fef3c7', fg: '#92400e', border: '#fde68a' },
  confirmed: { text: 'مؤكد',          bg: '#dbeafe', fg: '#1d4ed8', border: '#bfdbfe' },
  ready:     { text: 'جاهز للاستلام', bg: '#e0f2fe', fg: '#0369a1', border: '#7dd3fc' },
  completed: { text: 'مكتمل',         bg: '#dcfce7', fg: '#166534', border: '#86efac' },
  cancelled: { text: 'ملغى',          bg: '#fee2e2', fg: '#b91c1c', border: '#fecaca' }
};

const emptyItem = {
  name: '', nameEn: '', description: '', descriptionEn: '',
  price: 0, stock: 0, category: '', images: [],
  isActive: true, isFeatured: false, sku: ''
};

const emptyCoupon = {
  code: '', description: '', percent: 10, isActive: true,
  maxUses: '', validFrom: '', validUntil: '', minOrderTotal: ''
};

const StoreTab = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [tab, setTab] = useState('orders');   // 'orders' | 'items' | 'coupons'
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);

  const [couponModal, setCouponModal] = useState(null); // { mode, coupon? }
  const [couponForm, setCouponForm] = useState(emptyCoupon);
  const [savingCoupon, setSavingCoupon] = useState(false);

  // Item modal
  const [itemModal, setItemModal] = useState(null); // { mode, item? }
  const [form, setForm] = useState(emptyItem);
  const [savingItem, setSavingItem] = useState(false);

  // Order modal
  const [orderModal, setOrderModal] = useState(null);
  const [orderStatus, setOrderStatus] = useState('');
  const [orderAdminNote, setOrderAdminNote] = useState('');
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [savingOrder, setSavingOrder] = useState(false);

  const [orderFilter, setOrderFilter] = useState('all');
  const [orderSearch, setOrderSearch] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [i, o, c] = await Promise.all([
        api.get('/store/items'),
        api.get('/store/orders'),
        api.get('/store/coupons')
      ]);
      setItems(Array.isArray(i.data) ? i.data : []);
      setOrders(Array.isArray(o.data) ? o.data : []);
      setCoupons(Array.isArray(c.data) ? c.data : []);
    } catch (err) {
      toast.error('تعذّر تحميل المتجر');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ---- Stats ----
  const stats = useMemo(() => {
    const s = {
      totalItems: items.length,
      activeItems: items.filter(i => i.isActive).length,
      lowStock: items.filter(i => i.stock >= 0 && i.stock <= 5 && i.stock > 0).length,
      outOfStock: items.filter(i => i.stock === 0).length,
      totalOrders: orders.length,
      pending: orders.filter(o => o.status === 'pending').length,
      revenue: orders.filter(o => o.status === 'completed').reduce((sum, o) => sum + Number(o.total || 0), 0)
    };
    return s;
  }, [items, orders]);

  // ---- Orders filter ----
  const filteredOrders = useMemo(() => {
    let list = orders;
    if (orderFilter !== 'all') list = list.filter(o => o.status === orderFilter);
    if (orderSearch.trim()) {
      const q = orderSearch.trim().toLowerCase();
      list = list.filter(o =>
        (o.customerName || '').toLowerCase().includes(q) ||
        (o.customerPhone || '').includes(q) ||
        (o.customerEmail || '').toLowerCase().includes(q) ||
        String(o.orderNumber || '').includes(q)
      );
    }
    return list;
  }, [orders, orderFilter, orderSearch]);

  // ---- Item actions ----
  const openCreateItem = () => { setForm(emptyItem); setItemModal({ mode: 'create' }); };
  const openEditItem = (item) => {
    setForm({
      name: item.name || '',
      nameEn: item.nameEn || '',
      description: item.description || '',
      descriptionEn: item.descriptionEn || '',
      price: item.price || 0,
      stock: item.stock || 0,
      category: item.category || '',
      images: Array.isArray(item.images) ? [...item.images] : [],
      isActive: !!item.isActive,
      isFeatured: !!item.isFeatured,
      sku: item.sku || ''
    });
    setItemModal({ mode: 'edit', item });
  };

  const handleImageAdd = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      if (f.size > 3 * 1024 * 1024) {
        toast.error(`الصورة أكبر من 3 ميجا: ${f.name}`);
        continue;
      }
      await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          setForm(fm => ({ ...fm, images: [...fm.images, reader.result] }));
          resolve();
        };
        reader.readAsDataURL(f);
      });
    }
    e.target.value = '';
  };

  const removeImage = (idx) => setForm(fm => ({ ...fm, images: fm.images.filter((_, i) => i !== idx) }));

  const saveItem = async () => {
    if (!form.name.trim() || form.price == null) {
      toast.error('الاسم والسعر مطلوبان');
      return;
    }
    setSavingItem(true);
    try {
      if (itemModal.mode === 'create') {
        await api.post('/store/items', form);
        toast.success('تمت إضافة المنتج');
      } else {
        await api.put(`/store/items/${itemModal.item.itemId}`, form);
        toast.success('تم التحديث');
      }
      setItemModal(null);
      await fetchAll();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'تعذّر الحفظ');
    } finally {
      setSavingItem(false);
    }
  };

  const deleteItem = async (item) => {
    if (!window.confirm(`حذف "${item.name}"؟`)) return;
    try {
      await api.delete(`/store/items/${item.itemId}`);
      toast.success('تم الحذف');
      await fetchAll();
    } catch { toast.error('تعذّر الحذف'); }
  };

  const toggleActive = async (item) => {
    try {
      await api.put(`/store/items/${item.itemId}`, { isActive: !item.isActive });
      await fetchAll();
    } catch { toast.error('تعذّر التحديث'); }
  };

  // ---- Order actions ----
  const openOrder = (order) => {
    setOrderModal(order);
    setOrderStatus(order.status);
    setOrderAdminNote(order.adminNotes || '');
    setNotifyCustomer(true);
  };

  const saveOrderStatus = async () => {
    setSavingOrder(true);
    try {
      await api.patch(`/store/orders/${orderModal.orderId}/status`, {
        status: orderStatus,
        adminNotes: orderAdminNote,
        notifyCustomer
      });
      toast.success('تم التحديث');
      setOrderModal(null);
      await fetchAll();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'تعذّر التحديث');
    } finally {
      setSavingOrder(false);
    }
  };

  const markPaid = async (order) => {
    try {
      await api.post(`/store/orders/${order.orderId}/mark-paid`);
      toast.success('تم تسجيل الدفع');
      await fetchAll();
      setOrderModal(o => o ? { ...o, paidAt: new Date().toISOString() } : o);
    } catch { toast.error('تعذّر الحفظ'); }
  };

  // ---- Coupon actions ----
  const openCreateCoupon = () => { setCouponForm(emptyCoupon); setCouponModal({ mode: 'create' }); };
  const openEditCoupon = (c) => {
    setCouponForm({
      code: c.code || '',
      description: c.description || '',
      percent: c.percent || 10,
      isActive: !!c.isActive,
      maxUses: c.maxUses ?? '',
      validFrom: c.validFrom ? String(c.validFrom).slice(0, 10) : '',
      validUntil: c.validUntil ? String(c.validUntil).slice(0, 10) : '',
      minOrderTotal: c.minOrderTotal ?? ''
    });
    setCouponModal({ mode: 'edit', coupon: c });
  };
  const saveCoupon = async () => {
    if (!couponForm.code.trim() || !couponForm.percent) {
      toast.error('الرمز والنسبة مطلوبان');
      return;
    }
    setSavingCoupon(true);
    try {
      const body = {
        ...couponForm,
        code: couponForm.code.trim().toUpperCase(),
        percent: Number(couponForm.percent),
        maxUses: couponForm.maxUses === '' ? null : Number(couponForm.maxUses),
        validFrom: couponForm.validFrom || null,
        validUntil: couponForm.validUntil || null,
        minOrderTotal: couponForm.minOrderTotal === '' ? null : Number(couponForm.minOrderTotal)
      };
      if (couponModal.mode === 'create') {
        await api.post('/store/coupons', body);
        toast.success('تمت إضافة الرمز');
      } else {
        await api.put(`/store/coupons/${couponModal.coupon.couponId}`, body);
        toast.success('تم التحديث');
      }
      setCouponModal(null);
      await fetchAll();
    } catch (err) {
      toast.error(err?.response?.data?.messageAr || err?.response?.data?.message || 'تعذّر الحفظ');
    } finally {
      setSavingCoupon(false);
    }
  };
  const deleteCoupon = async (c) => {
    if (!window.confirm(`حذف رمز "${c.code}"؟`)) return;
    try {
      await api.delete(`/store/coupons/${c.couponId}`);
      toast.success('تم الحذف');
      await fetchAll();
    } catch { toast.error('تعذّر الحذف'); }
  };
  const toggleCouponActive = async (c) => {
    try {
      await api.put(`/store/coupons/${c.couponId}`, { isActive: !c.isActive });
      await fetchAll();
    } catch { toast.error('تعذّر التحديث'); }
  };

  const deleteOrder = async (order) => {
    if (!window.confirm(`حذف الطلب ${fmtOrderNo(order.orderNumber)}؟`)) return;
    try {
      await api.delete(`/store/orders/${order.orderId}`);
      toast.success('تم الحذف');
      setOrderModal(null);
      await fetchAll();
    } catch { toast.error('تعذّر الحذف'); }
  };

  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const printInvoice = (o) => {
    const w = window.open('', '_blank');
    if (!w) return toast.error('فشل فتح نافذة الطباعة');
    const paid = !!o.paidAt;
    const stampColor = paid ? '#16a34a' : '#dc2626';
    const stampText = paid ? 'تم الدفع' : 'لم يُدفع';
    const stampSub = paid && o.paidAt
      ? new Date(o.paidAt).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { calendar: 'gregory' })
      : 'بانتظار الدفع';

    const itemsHtml = (o.items || []).map((i, idx) => `
      <tr>
        <td class="cell-idx">${idx + 1}</td>
        <td class="cell-name">${esc(i.name)}</td>
        <td class="cell-num">${i.quantity}</td>
        <td class="cell-num">${SAR(i.price)}</td>
        <td class="cell-num cell-total">${SAR(i.lineTotal)}</td>
      </tr>`).join('');

    const invoiceDate = new Date(o.createdAt).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', {
      calendar: 'gregory', year: 'numeric', month: 'long', day: 'numeric'
    });
    const dueLabel = paid ? '—' : 'عند الاستلام';

    w.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>فاتورة ${fmtOrderNo(o.orderNumber)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Cairo','Segoe UI',Tahoma,Arial,sans-serif;
    color: #1f2937;
    background: #fff;
    padding: 20px 22px;
    font-size: 11.5px;
    line-height: 1.55;
    position: relative;
  }

  /* Diagonal PAID / UNPAID watermark stamp */
  .stamp {
    position: fixed;
    top: 42%;
    inset-inline-start: 20%;
    transform: rotate(-22deg);
    border: 6px double ${stampColor};
    color: ${stampColor};
    padding: 18px 44px;
    font-family: 'Bricolage Grotesque', 'Cairo', sans-serif;
    font-weight: 900;
    font-size: 38px;
    letter-spacing: 3px;
    text-align: center;
    background: rgba(255,255,255,0.05);
    opacity: 0.22;
    pointer-events: none;
    z-index: 0;
    border-radius: 12px;
    text-transform: uppercase;
  }
  .stamp small {
    display: block;
    font-size: 12px;
    letter-spacing: 1px;
    font-weight: 700;
    margin-top: 4px;
    opacity: 0.9;
  }

  main { position: relative; z-index: 1; }

  /* --- Formal invoice header --- */
  .invoice-head {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    padding-bottom: 16px;
    margin-bottom: 20px;
    border-bottom: 3px solid #0f172a;
  }
  .brand { display: flex; gap: 12px; align-items: center; }
  .brand-logos { display: flex; gap: 8px; }
  .brand-logos img { height: 48px; object-fit: contain; }
  .brand-info { }
  .brand-info h1 {
    font-family: 'Bricolage Grotesque', 'Cairo', sans-serif;
    font-size: 18px;
    color: #0f172a;
    margin-bottom: 3px;
    letter-spacing: -0.01em;
  }
  .brand-info p { font-size: 10.5px; color: #6b7280; margin: 0; }
  .brand-info small {
    display: block;
    font-size: 10px;
    color: #6b7280;
    margin-top: 4px;
    font-family: 'JetBrains Mono', monospace;
  }

  .invoice-meta {
    text-align: end;
  }
  .invoice-meta h2 {
    font-family: 'Bricolage Grotesque', 'Cairo', sans-serif;
    font-size: 26px;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.02em;
    margin-bottom: 4px;
  }
  .invoice-meta .no {
    font-family: 'JetBrains Mono', monospace;
    font-size: 15px;
    color: #EE2329;
    font-weight: 800;
    letter-spacing: 2px;
  }
  .invoice-meta .dates {
    display: grid;
    grid-template-columns: auto auto;
    gap: 4px 10px;
    margin-top: 10px;
    font-size: 10.5px;
    justify-content: end;
  }
  .invoice-meta .dates span { color: #6b7280; }
  .invoice-meta .dates b { color: #0f172a; font-weight: 700; direction: ltr; }

  /* --- Parties block --- */
  .parties {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 18px;
  }
  .party {
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 12px 14px;
  }
  .party-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1.4px;
    color: #6b7280;
    font-weight: 700;
    margin-bottom: 6px;
  }
  .party-name {
    font-size: 14px;
    font-weight: 800;
    color: #0f172a;
    margin-bottom: 4px;
  }
  .party-row {
    font-size: 11px;
    color: #4b5563;
    margin-top: 2px;
    direction: ltr;
    text-align: start;
  }
  .party-row b { color: #0f172a; font-weight: 600; direction: rtl; }

  /* --- Items table --- */
  .items-title {
    font-size: 11px;
    color: #6b7280;
    letter-spacing: 1.4px;
    text-transform: uppercase;
    font-weight: 700;
    margin-bottom: 6px;
  }
  table.items {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    overflow: hidden;
  }
  table.items thead {
    background: #0f172a;
    color: #fff;
  }
  table.items thead th {
    padding: 10px 12px;
    text-align: start;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 700;
  }
  table.items thead th.cell-num { text-align: end; }
  table.items tbody tr:nth-child(even) { background: #f9fafb; }
  table.items tbody td {
    padding: 10px 12px;
    border-top: 1px solid #e5e7eb;
    font-size: 11.5px;
  }
  .cell-idx {
    font-family: 'JetBrains Mono', monospace;
    color: #6b7280;
    width: 28px;
    text-align: center;
  }
  .cell-name { color: #0f172a; }
  .cell-num {
    font-family: 'JetBrains Mono', monospace;
    text-align: end;
  }
  .cell-total { font-weight: 700; color: #0f172a; }

  /* --- Totals --- */
  .totals-wrap {
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: 14px;
    margin-bottom: 16px;
  }
  .payment-info {
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 12px 14px;
    font-size: 11px;
  }
  .payment-info .pi-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1.4px;
    color: #6b7280;
    font-weight: 700;
    margin-bottom: 6px;
  }
  .payment-info .pi-row { margin: 3px 0; color: #4b5563; }
  .payment-info .pi-row b { color: #0f172a; font-weight: 700; }
  .totals {
    width: 100%;
    border-collapse: collapse;
    font-size: 11.5px;
  }
  .totals td {
    padding: 8px 12px;
    border-bottom: 1px solid #e5e7eb;
  }
  .totals td.label { color: #6b7280; text-align: end; }
  .totals td.val { font-family: 'JetBrains Mono', monospace; text-align: end; font-weight: 700; color: #0f172a; }
  .totals .discount td.label { color: #16a34a; }
  .totals .discount td.val { color: #16a34a; }
  .totals .final td {
    background: #EE2329;
    color: #fff;
    font-family: 'JetBrains Mono', monospace;
    font-size: 15px;
    font-weight: 800;
    padding: 14px;
    border: none;
  }
  .totals .final td.label { text-align: end; font-family: 'Cairo', sans-serif; }

  /* --- Notes --- */
  .notes {
    background: #fffbeb;
    border-inline-start: 3px solid #f59e0b;
    border-radius: 6px;
    padding: 10px 14px;
    font-size: 11px;
    color: #78350f;
    margin-bottom: 14px;
  }
  .notes b { display: block; margin-bottom: 3px; color: #92400e; font-weight: 700; }

  /* --- Footer --- */
  .invoice-foot {
    margin-top: 18px;
    padding-top: 12px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: #9ca3af;
  }
  .invoice-foot .foot-brand b { color: #0f172a; }

  @media print {
    body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .party, .payment-info { break-inside: avoid; }
  }
</style></head><body>
  <div class="stamp">${stampText}<small>${esc(stampSub)}</small></div>
  <main>
    <div class="invoice-head">
      <div class="brand">
        <div class="brand-logos">
          <img src="/found.png" alt="مؤسسة" />
          <img src="/fablab.png" alt="فاب لاب" />
        </div>
        <div class="brand-info">
          <h1>فاب لاب الأحساء</h1>
          <p>مؤسسة عبدالمنعم الراشد الإنسانية</p>
          <small>fablabsahsa.com · متجر</small>
        </div>
      </div>
      <div class="invoice-meta">
        <h2>فاتورة</h2>
        <div class="no">${esc(fmtOrderNo(o.orderNumber))}</div>
        <div class="dates">
          <span>تاريخ الإصدار</span><b>${esc(invoiceDate)}</b>
          <span>الاستحقاق</span><b>${esc(dueLabel)}</b>
          <span>طريقة الدفع</span><b>نقداً عند الاستلام</b>
        </div>
      </div>
    </div>

    <div class="parties">
      <div class="party">
        <div class="party-title">المُصدَر إلى — Bill To</div>
        <div class="party-name">${esc(o.customerName)}</div>
        <div class="party-row"><b>الجوال: </b>${esc(o.customerPhone)}</div>
        <div class="party-row"><b>البريد: </b>${esc(o.customerEmail)}</div>
        ${o.customerNationalId ? `<div class="party-row"><b>الهوية: </b>${esc(o.customerNationalId)}</div>` : ''}
        ${o.deliveryAddress ? `<div class="party-row" style="direction:rtl;text-align:start"><b>العنوان: </b>${esc(o.deliveryAddress)}</div>` : ''}
      </div>
      <div class="party">
        <div class="party-title">المُصدِر — From</div>
        <div class="party-name">فاب لاب الأحساء</div>
        <div class="party-row" style="direction:rtl;text-align:start">مؤسسة عبدالمنعم الراشد الإنسانية</div>
        <div class="party-row" style="direction:rtl;text-align:start">المملكة العربية السعودية — الأحساء</div>
        <div class="party-row"><b>البريد: </b>fablabspec@fablabsahsa.com</div>
      </div>
    </div>

    <div class="items-title">تفاصيل المشتريات — Line Items</div>
    <table class="items">
      <thead>
        <tr>
          <th class="cell-idx">#</th>
          <th>الصنف</th>
          <th class="cell-num">الكمية</th>
          <th class="cell-num">السعر</th>
          <th class="cell-num">الإجمالي</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <div class="totals-wrap">
      <div class="payment-info">
        <div class="pi-title">معلومات الدفع</div>
        <div class="pi-row"><b>الحالة: </b>${esc(STATUS_BADGES[o.status]?.text || o.status)}</div>
        <div class="pi-row"><b>حالة الدفع: </b>${paid ? '✓ مدفوع بالكامل' : 'بانتظار الدفع عند الاستلام'}</div>
        ${o.paidAt ? `<div class="pi-row"><b>تاريخ الدفع: </b><span style="direction:ltr">${esc(new Date(o.paidAt).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { calendar: 'gregory' }))}</span></div>` : ''}
        <div class="pi-row" style="margin-top:6px;padding-top:6px;border-top:1px dashed #d1d5db"><b>طريقة الدفع: </b>نقداً</div>
      </div>
      <table class="totals">
        <tr><td class="label">المجموع الفرعي</td><td class="val">${SAR(o.subtotal)}</td></tr>
        ${Number(o.discountAmount) > 0 ? `<tr class="discount"><td class="label">خصم (${esc(o.couponCode)} · ${o.couponPercent}%)</td><td class="val">-${SAR(o.discountAmount)}</td></tr>` : ''}
        <tr><td class="label">ضريبة القيمة المضافة (${Math.round((o.taxRate || 0) * 100)}%)</td><td class="val">${SAR(o.taxAmount)}</td></tr>
        <tr class="final"><td class="label">الإجمالي المستحق</td><td class="val">${SAR(o.total)}</td></tr>
      </table>
    </div>

    ${o.notes || o.adminNotes ? `
    <div class="notes">
      ${o.notes ? `<b>ملاحظات العميل:</b>${esc(o.notes)}` : ''}
      ${o.adminNotes ? `<div style="margin-top:${o.notes ? '8px' : '0'}"><b>ملاحظات الإدارة:</b>${esc(o.adminNotes)}</div>` : ''}
    </div>` : ''}

    <div class="invoice-foot">
      <div class="foot-brand"><b>فاب لاب الأحساء</b> · مؤسسة عبدالمنعم الراشد الإنسانية</div>
      <div>طُبع في: ${esc(new Date().toLocaleString('ar-SA-u-ca-gregory-nu-latn', { calendar: 'gregory' }))}</div>
    </div>
  </main>
</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div className="stt" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="stt-head">
        <div>
          <h2>{isRTL ? 'متجر فاب لاب' : 'FabLab Store'}</h2>
          <p>{isRTL ? 'إدارة المنتجات والطلبات' : 'Manage products and orders'}</p>
        </div>
        <div className="stt-tabs">
          <button className={`stt-tab ${tab === 'orders' ? 'is-active' : ''}`} onClick={() => setTab('orders')}>
            {isRTL ? 'الطلبات' : 'Orders'}
            {stats.pending > 0 && <span className="stt-tab-badge">{stats.pending}</span>}
          </button>
          <button className={`stt-tab ${tab === 'items' ? 'is-active' : ''}`} onClick={() => setTab('items')}>
            {isRTL ? 'المنتجات' : 'Products'}
          </button>
          <button className={`stt-tab ${tab === 'coupons' ? 'is-active' : ''}`} onClick={() => setTab('coupons')}>
            {isRTL ? 'أكواد الخصم' : 'Coupons'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stt-stats">
        {tab === 'orders' ? (
          <>
            <StatCard label={isRTL ? 'إجمالي الطلبات' : 'Total Orders'} value={stats.totalOrders} tint="#EE2329" />
            <StatCard label={isRTL ? 'قيد المراجعة' : 'Pending'}          value={stats.pending}       tint="#f59e0b" />
            <StatCard label={isRTL ? 'الإيرادات المؤكدة' : 'Revenue'}     value={SAR(stats.revenue)}   tint="#16a34a" />
          </>
        ) : (
          <>
            <StatCard label={isRTL ? 'إجمالي المنتجات' : 'Total Products'} value={stats.totalItems} tint="#EE2329" />
            <StatCard label={isRTL ? 'نشطة' : 'Active'}             value={stats.activeItems} tint="#16a34a" />
            <StatCard label={isRTL ? 'مخزون منخفض' : 'Low Stock'}   value={stats.lowStock}    tint="#f59e0b" />
            <StatCard label={isRTL ? 'نفدت الكمية' : 'Out of Stock'} value={stats.outOfStock} tint="#dc2626" />
          </>
        )}
      </div>

      {loading ? (
        <div className="stt-loading">جارٍ التحميل...</div>
      ) : tab === 'items' ? (
        <ItemsPanel
          items={items}
          onCreate={openCreateItem}
          onEdit={openEditItem}
          onDelete={deleteItem}
          onToggle={toggleActive}
        />
      ) : tab === 'coupons' ? (
        <CouponsPanel
          coupons={coupons}
          onCreate={openCreateCoupon}
          onEdit={openEditCoupon}
          onDelete={deleteCoupon}
          onToggle={toggleCouponActive}
        />
      ) : (
        <OrdersPanel
          orders={filteredOrders}
          totalOrders={orders.length}
          filter={orderFilter}
          setFilter={setOrderFilter}
          search={orderSearch}
          setSearch={setOrderSearch}
          onOpen={openOrder}
          onPrint={printInvoice}
        />
      )}

      {/* Item modal */}
      <AnimatePresence>
        {itemModal && (
          <motion.div className="stt-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setItemModal(null)}>
            <motion.div className="stt-modal" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <div className="stt-modal-head">
                <h3>{itemModal.mode === 'create' ? (isRTL ? 'منتج جديد' : 'New Product') : (isRTL ? 'تعديل المنتج' : 'Edit Product')}</h3>
                <button onClick={() => setItemModal(null)} className="stt-close">✕</button>
              </div>
              <div className="stt-modal-body">
                <div className="stt-form">
                  <div className="stt-field stt-field--full">
                    <label>{isRTL ? 'الاسم (عربي) *' : 'Name (Arabic) *'}</label>
                    <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="stt-field stt-field--full">
                    <label>{isRTL ? 'الاسم (إنجليزي)' : 'Name (English)'}</label>
                    <input type="text" value={form.nameEn} onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))} />
                  </div>
                  <div className="stt-field">
                    <label>{isRTL ? 'السعر (ر.س) *' : 'Price (SAR) *'}</label>
                    <input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} dir="ltr" />
                  </div>
                  <div className="stt-field">
                    <label>{isRTL ? 'المخزون (-1 = غير محدود)' : 'Stock (-1 = unlimited)'}</label>
                    <input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} dir="ltr" />
                  </div>
                  <div className="stt-field">
                    <label>{isRTL ? 'الفئة' : 'Category'}</label>
                    <input type="text" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder={isRTL ? 'مثال: أدوات، مكونات' : 'e.g. Tools, Kits'} />
                  </div>
                  <div className="stt-field">
                    <label>SKU</label>
                    <input type="text" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} dir="ltr" />
                  </div>
                  <div className="stt-field stt-field--full">
                    <label>{isRTL ? 'الوصف (عربي)' : 'Description (Arabic)'}</label>
                    <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="stt-field stt-field--full">
                    <label>{isRTL ? 'الوصف (إنجليزي)' : 'Description (English)'}</label>
                    <textarea rows={3} value={form.descriptionEn} onChange={e => setForm(f => ({ ...f, descriptionEn: e.target.value }))} />
                  </div>

                  <div className="stt-field stt-field--full">
                    <label>{isRTL ? 'الصور' : 'Images'}</label>
                    <div className="stt-images">
                      {form.images.map((img, i) => (
                        <div key={i} className="stt-img">
                          <img src={img} alt="" />
                          <button type="button" onClick={() => removeImage(i)}>✕</button>
                        </div>
                      ))}
                      <label className="stt-img-add">
                        + {isRTL ? 'إضافة' : 'Add'}
                        <input type="file" accept="image/*" multiple onChange={handleImageAdd} style={{ display: 'none' }} />
                      </label>
                    </div>
                    <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                      {isRTL ? 'الحد الأقصى لكل صورة 3 ميجا' : 'Max 3MB per image'}
                    </span>
                  </div>

                  <div className="stt-field stt-field--full stt-toggles">
                    <label className="stt-toggle">
                      <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                      <span>{isRTL ? 'نشط — ظاهر في المتجر' : 'Active — visible in store'}</span>
                    </label>
                    <label className="stt-toggle">
                      <input type="checkbox" checked={form.isFeatured} onChange={e => setForm(f => ({ ...f, isFeatured: e.target.checked }))} />
                      <span>⭐ {isRTL ? 'مميز — يظهر في الأعلى' : 'Featured — pinned to top'}</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="stt-modal-foot">
                {itemModal.mode === 'edit' && (
                  <button className="stt-btn stt-btn--danger" onClick={() => { deleteItem(itemModal.item); setItemModal(null); }}>
                    {isRTL ? '🗑️ حذف' : '🗑️ Delete'}
                  </button>
                )}
                <div style={{ flex: 1 }} />
                <button className="stt-btn stt-btn--ghost" onClick={() => setItemModal(null)} disabled={savingItem}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
                <button className="stt-btn stt-btn--primary" onClick={saveItem} disabled={savingItem}>
                  {savingItem ? (isRTL ? 'جارٍ الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Coupon modal */}
      <AnimatePresence>
        {couponModal && (
          <motion.div className="stt-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCouponModal(null)}>
            <motion.div className="stt-modal" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <div className="stt-modal-head">
                <h3>{couponModal.mode === 'create' ? (isRTL ? 'رمز خصم جديد' : 'New Coupon') : (isRTL ? 'تعديل الرمز' : 'Edit Coupon')}</h3>
                <button onClick={() => setCouponModal(null)} className="stt-close">✕</button>
              </div>
              <div className="stt-modal-body">
                <div className="stt-form">
                  <div className="stt-field">
                    <label>{isRTL ? 'رمز الخصم *' : 'Code *'}</label>
                    <input type="text" value={couponForm.code} onChange={e => setCouponForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="EID2026" dir="ltr" style={{ fontFamily: 'JetBrains Mono, monospace', letterSpacing: 2, fontWeight: 700 }} />
                  </div>
                  <div className="stt-field">
                    <label>{isRTL ? 'نسبة الخصم % *' : 'Percent % *'}</label>
                    <input type="number" min="1" max="100" value={couponForm.percent} onChange={e => setCouponForm(f => ({ ...f, percent: e.target.value }))} dir="ltr" />
                  </div>
                  <div className="stt-field stt-field--full">
                    <label>{isRTL ? 'الوصف (اختياري)' : 'Description (optional)'}</label>
                    <input type="text" value={couponForm.description} onChange={e => setCouponForm(f => ({ ...f, description: e.target.value }))} placeholder={isRTL ? 'مثال: عرض عيد الفطر' : 'e.g. Eid promo'} />
                  </div>
                  <div className="stt-field">
                    <label>{isRTL ? 'الحد الأقصى للاستخدام (فارغ = بلا حد)' : 'Max Uses (blank = unlimited)'}</label>
                    <input type="number" min="0" value={couponForm.maxUses} onChange={e => setCouponForm(f => ({ ...f, maxUses: e.target.value }))} dir="ltr" />
                  </div>
                  <div className="stt-field">
                    <label>{isRTL ? 'الحد الأدنى للطلب (ر.س)' : 'Min Order Total (SAR)'}</label>
                    <input type="number" min="0" step="0.01" value={couponForm.minOrderTotal} onChange={e => setCouponForm(f => ({ ...f, minOrderTotal: e.target.value }))} dir="ltr" />
                  </div>
                  <div className="stt-field">
                    <label>{isRTL ? 'يبدأ من' : 'Valid From'}</label>
                    <input type="date" value={couponForm.validFrom} onChange={e => setCouponForm(f => ({ ...f, validFrom: e.target.value }))} dir="ltr" />
                  </div>
                  <div className="stt-field">
                    <label>{isRTL ? 'ينتهي في' : 'Valid Until'}</label>
                    <input type="date" value={couponForm.validUntil} onChange={e => setCouponForm(f => ({ ...f, validUntil: e.target.value }))} dir="ltr" />
                  </div>
                  <div className="stt-field stt-field--full stt-toggles">
                    <label className="stt-toggle">
                      <input type="checkbox" checked={couponForm.isActive} onChange={e => setCouponForm(f => ({ ...f, isActive: e.target.checked }))} />
                      <span>{isRTL ? 'مفعّل' : 'Active'}</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="stt-modal-foot">
                {couponModal.mode === 'edit' && (
                  <button className="stt-btn stt-btn--danger" onClick={() => { deleteCoupon(couponModal.coupon); setCouponModal(null); }}>🗑️ حذف</button>
                )}
                <div style={{ flex: 1 }} />
                <button className="stt-btn stt-btn--ghost" onClick={() => setCouponModal(null)} disabled={savingCoupon}>إلغاء</button>
                <button className="stt-btn stt-btn--primary" onClick={saveCoupon} disabled={savingCoupon}>
                  {savingCoupon ? 'جارٍ الحفظ...' : 'حفظ'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order modal */}
      <AnimatePresence>
        {orderModal && (
          <motion.div className="stt-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOrderModal(null)}>
            <motion.div className="stt-modal stt-modal--wide" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <div className="stt-modal-head">
                <div>
                  <div className="stt-order-kicker">
                    <span>{isRTL ? 'طلب' : 'Order'}</span>
                    <b>{fmtOrderNo(orderModal.orderNumber)}</b>
                    <span className="stt-status-badge" style={{
                      background: STATUS_BADGES[orderModal.status]?.bg,
                      color: STATUS_BADGES[orderModal.status]?.fg,
                      borderColor: STATUS_BADGES[orderModal.status]?.border
                    }}>{STATUS_BADGES[orderModal.status]?.text}</span>
                    {orderModal.paidAt && <span className="stt-paid-pill">✓ مدفوع</span>}
                  </div>
                  <h3 style={{ marginTop: 6 }}>{orderModal.customerName}</h3>
                </div>
                <button onClick={() => setOrderModal(null)} className="stt-close">✕</button>
              </div>
              <div className="stt-modal-body">
                <div className="stt-order-info">
                  <div><span>الجوال</span><b dir="ltr">{orderModal.customerPhone}</b></div>
                  <div><span>البريد</span><b dir="ltr">{orderModal.customerEmail}</b></div>
                  {orderModal.customerNationalId && <div><span>رقم الهوية</span><b dir="ltr">{orderModal.customerNationalId}</b></div>}
                  <div><span>تاريخ الطلب</span><b>{fmtWhen(orderModal.createdAt)}</b></div>
                  {orderModal.deliveryAddress && <div className="stt-order-info-full"><span>العنوان</span><b>{orderModal.deliveryAddress}</b></div>}
                  {orderModal.notes && <div className="stt-order-info-full"><span>ملاحظات العميل</span><b>{orderModal.notes}</b></div>}
                </div>

                <table className="stt-order-items">
                  <thead>
                    <tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr>
                  </thead>
                  <tbody>
                    {(orderModal.items || []).map((i, idx) => (
                      <tr key={idx}>
                        <td>{i.name}</td>
                        <td style={{ textAlign: 'center' }}>{i.quantity}</td>
                        <td style={{ textAlign: 'end', fontFamily: 'JetBrains Mono, monospace' }}>{SAR(i.price)}</td>
                        <td style={{ textAlign: 'end', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{SAR(i.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr><td colSpan={3} style={{ textAlign: 'end', color: '#64748b' }}>المجموع الفرعي</td><td style={{ textAlign: 'end', fontFamily: 'JetBrains Mono, monospace' }}>{SAR(orderModal.subtotal)}</td></tr>
                    <tr><td colSpan={3} style={{ textAlign: 'end', color: '#64748b' }}>ضريبة {Math.round((orderModal.taxRate || 0) * 100)}%</td><td style={{ textAlign: 'end', fontFamily: 'JetBrains Mono, monospace' }}>{SAR(orderModal.taxAmount)}</td></tr>
                    <tr className="stt-order-final"><td colSpan={3} style={{ textAlign: 'end' }}>الإجمالي</td><td style={{ textAlign: 'end' }}>{SAR(orderModal.total)}</td></tr>
                  </tfoot>
                </table>

                {/* Status update */}
                <div className="stt-order-controls">
                  <label>
                    <span>الحالة الجديدة</span>
                    <select value={orderStatus} onChange={e => setOrderStatus(e.target.value)}>
                      <option value="pending">قيد المراجعة</option>
                      <option value="confirmed">تأكيد الطلب</option>
                      <option value="ready">جاهز للاستلام</option>
                      <option value="completed">مكتمل</option>
                      <option value="cancelled">إلغاء</option>
                    </select>
                  </label>
                  <label>
                    <span>ملاحظة الإدارة</span>
                    <textarea rows={2} value={orderAdminNote} onChange={e => setOrderAdminNote(e.target.value)} />
                  </label>
                  <label className="stt-toggle">
                    <input type="checkbox" checked={notifyCustomer} onChange={e => setNotifyCustomer(e.target.checked)} />
                    <span>📧 إشعار العميل بالبريد بالتحديث</span>
                  </label>
                </div>
              </div>
              <div className="stt-modal-foot">
                <button className="stt-btn stt-btn--danger" onClick={() => deleteOrder(orderModal)}>🗑️ حذف</button>
                <div style={{ flex: 1 }} />
                <button className="stt-btn stt-btn--ghost" onClick={() => printInvoice(orderModal)}>🖨️ فاتورة</button>
                {!orderModal.paidAt && <button className="stt-btn stt-btn--ghost" onClick={() => markPaid(orderModal)}>💵 تسجيل الدفع</button>}
                <button className="stt-btn stt-btn--primary" onClick={saveOrderStatus} disabled={savingOrder}>
                  {savingOrder ? 'جارٍ الحفظ...' : 'حفظ التحديث'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// -------------------- Sub-components --------------------

const StatCard = ({ label, value, tint }) => (
  <div className="stt-stat" style={{ borderColor: `${tint}55` }}>
    <div className="stt-stat-val" style={{ color: tint }}>{value}</div>
    <div className="stt-stat-lbl">{label}</div>
  </div>
);

const ItemsPanel = ({ items, onCreate, onEdit, onDelete, onToggle }) => (
  <div>
    <div className="stt-toolbar">
      <button className="stt-btn stt-btn--primary" onClick={onCreate}>+ منتج جديد</button>
    </div>
    {items.length === 0 ? (
      <div className="stt-empty">لا توجد منتجات — أضف أول منتج للبدء</div>
    ) : (
      <div className="stt-item-grid">
        {items.map(item => (
          <div key={item.itemId} className={`stt-item-card ${!item.isActive ? 'is-inactive' : ''}`}>
            <div className="stt-item-thumb">
              {item.images?.[0] ? <img src={item.images[0]} alt="" /> : <span>📦</span>}
              {item.isFeatured && <span className="stt-item-featured">⭐</span>}
            </div>
            <div className="stt-item-info">
              <div className="stt-item-name">{item.name}</div>
              {item.category && <div className="stt-item-cat">{item.category}</div>}
              <div className="stt-item-meta">
                <span className="stt-item-price">{SAR(item.price)}</span>
                <span className={`stt-item-stock ${item.stock === 0 ? 'is-out' : ''}`}>
                  {item.stock < 0 ? '∞ متوفر' : item.stock === 0 ? 'نفدت' : `${item.stock}`}
                </span>
              </div>
              <div className="stt-item-actions">
                <button onClick={() => onToggle(item)} className={item.isActive ? 'is-on' : ''}>
                  {item.isActive ? '👁️ نشط' : '⏸ معطّل'}
                </button>
                <button onClick={() => onEdit(item)}>✏️ تعديل</button>
                <button onClick={() => onDelete(item)} className="danger">🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const OrdersPanel = ({ orders, totalOrders, filter, setFilter, search, setSearch, onOpen, onPrint }) => (
  <div>
    <div className="stt-toolbar">
      <input
        type="search"
        placeholder="بحث بالاسم / الرقم / الجوال / البريد..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="stt-search"
      />
      <div className="stt-filters">
        {['all', 'pending', 'confirmed', 'ready', 'completed', 'cancelled'].map(f => (
          <button
            key={f}
            className={`stt-filter ${filter === f ? 'is-active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'الكل' : STATUS_BADGES[f]?.text}
          </button>
        ))}
      </div>
    </div>
    {totalOrders === 0 ? (
      <div className="stt-empty">لا توجد طلبات حتى الآن</div>
    ) : orders.length === 0 ? (
      <div className="stt-empty">لا توجد نتائج مطابقة</div>
    ) : (
      <div className="stt-order-list">
        {orders.map(o => (
          <div key={o.orderId} className="stt-order-row" onClick={() => onOpen(o)}>
            <div className="stt-order-no">{fmtOrderNo(o.orderNumber)}</div>
            <div className="stt-order-cust">
              <div>{o.customerName}</div>
              <span>{o.customerPhone}</span>
            </div>
            <div className="stt-order-items-count">{(o.items || []).length} صنف</div>
            <div className="stt-order-total">{SAR(o.total)}</div>
            <div>
              <span className="stt-status-badge" style={{
                background: STATUS_BADGES[o.status]?.bg,
                color: STATUS_BADGES[o.status]?.fg,
                borderColor: STATUS_BADGES[o.status]?.border
              }}>{STATUS_BADGES[o.status]?.text}</span>
              {o.paidAt && <span className="stt-paid-pill" style={{ marginInlineStart: 6 }}>💵</span>}
            </div>
            <div className="stt-order-when">{fmtWhen(o.createdAt)}</div>
            <button onClick={(e) => { e.stopPropagation(); onPrint(o); }} className="stt-icon-btn" title="طباعة">🖨️</button>
          </div>
        ))}
      </div>
    )}
  </div>
);

const CouponsPanel = ({ coupons, onCreate, onEdit, onDelete, onToggle }) => {
  const today = new Date().toISOString().slice(0, 10);
  const statusOf = (c) => {
    if (!c.isActive) return { text: 'معطّل', bg: '#f1f5f9', fg: '#475569' };
    if (c.validUntil && today > String(c.validUntil).slice(0, 10)) return { text: 'منتهي', bg: '#fee2e2', fg: '#b91c1c' };
    if (c.validFrom && today < String(c.validFrom).slice(0, 10)) return { text: 'قادم', bg: '#dbeafe', fg: '#1d4ed8' };
    if (c.maxUses != null && c.usedCount >= c.maxUses) return { text: 'استُنفد', bg: '#fef3c7', fg: '#92400e' };
    return { text: 'نشط', bg: '#dcfce7', fg: '#166534' };
  };
  return (
    <div>
      <div className="stt-toolbar">
        <button className="stt-btn stt-btn--primary" onClick={onCreate}>+ رمز خصم جديد</button>
      </div>
      {coupons.length === 0 ? (
        <div className="stt-empty">لا توجد رموز خصم — أضف رمزاً للبدء</div>
      ) : (
        <div className="stt-coupon-grid">
          {coupons.map(c => {
            const st = statusOf(c);
            return (
              <div key={c.couponId} className="stt-coupon-card">
                <div className="stt-coupon-head">
                  <span className="stt-coupon-status" style={{ background: st.bg, color: st.fg }}>{st.text}</span>
                  <span className="stt-coupon-pct">-{c.percent}%</span>
                </div>
                <div className="stt-coupon-code">{c.code}</div>
                {c.description && <div className="stt-coupon-desc">{c.description}</div>}
                <div className="stt-coupon-meta">
                  <div><span>الاستخدام</span><b>{c.usedCount}{c.maxUses != null ? ` / ${c.maxUses}` : ''}</b></div>
                  {c.minOrderTotal != null && <div><span>حد أدنى</span><b>{SAR(c.minOrderTotal)}</b></div>}
                  {(c.validFrom || c.validUntil) && (
                    <div className="stt-coupon-meta-full">
                      <span>الفترة</span>
                      <b dir="ltr">{c.validFrom || '—'} → {c.validUntil || '—'}</b>
                    </div>
                  )}
                </div>
                <div className="stt-coupon-actions">
                  <button onClick={() => onToggle(c)} className={c.isActive ? 'is-on' : ''}>{c.isActive ? '👁️ نشط' : '⏸ معطّل'}</button>
                  <button onClick={() => onEdit(c)}>✏️ تعديل</button>
                  <button onClick={() => onDelete(c)} className="danger">🗑️</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StoreTab;
