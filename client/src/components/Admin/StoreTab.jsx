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

const StoreTab = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [tab, setTab] = useState('orders');   // 'orders' | 'items'
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

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
      const [i, o] = await Promise.all([
        api.get('/store/items'),
        api.get('/store/orders')
      ]);
      setItems(Array.isArray(i.data) ? i.data : []);
      setOrders(Array.isArray(o.data) ? o.data : []);
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
    const itemsHtml = (o.items || []).map(i => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb">${esc(i.name)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:center">${i.quantity}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:end;font-family:'JetBrains Mono',monospace">${SAR(i.price)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:end;font-weight:700;font-family:'JetBrains Mono',monospace">${SAR(i.lineTotal)}</td>
      </tr>`).join('');
    w.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>فاتورة ${fmtOrderNo(o.orderNumber)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Cairo','Segoe UI',Tahoma,Arial,sans-serif; color: #333; padding: 20px; font-size: 12px; line-height: 1.5; }
  .ids-bar { display: flex; justify-content: space-between; background: linear-gradient(135deg,#EE2329,#c41e24); color:#fff; padding: 10px 16px; border-radius: 8px; margin-bottom: 14px; font-weight: 700; }
  .head { display: flex; justify-content: space-between; align-items: center; padding-bottom: 14px; border-bottom: 2px solid #EE2329; margin-bottom: 18px; }
  .head img { height: 55px; object-fit: contain; }
  .head-center { text-align: center; flex: 1; }
  .head-center h1 { color: #EE2329; font-size: 18px; margin-bottom: 3px; }
  .head-center p { color: #666; font-size: 11px; }
  .form-title { text-align: center; font-size: 15px; font-weight: 700; padding: 10px; background: #fef2f2; border-radius: 6px; border-right: 4px solid #EE2329; margin-bottom: 16px; }
  .section { background: #fafafa; border: 1px solid #eee; border-radius: 6px; padding: 12px; margin-bottom: 12px; }
  .section h3 { font-size: 11px; font-weight: 700; color: #EE2329; margin-bottom: 8px; padding-bottom: 5px; border-bottom: 1px solid #EE2329; text-transform: uppercase; letter-spacing: 0.5px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .field { background: white; padding: 6px 10px; border-radius: 4px; border: 1px solid #eee; }
  .field-label { font-size: 9px; color: #888; margin-bottom: 3px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
  .field-value { font-size: 11px; color: #333; font-weight: 500; }
  .field-full { grid-column: span 3; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
  table thead { background: #fef2f2; }
  table th { padding: 10px 8px; text-align: right; color: #c41e24; font-size: 10px; text-transform: uppercase; }
  table th:nth-child(2) { text-align: center; }
  table th:nth-child(3), table th:nth-child(4) { text-align: end; }
  .totals { margin-top: 6px; }
  .totals tr td { padding: 6px 8px; }
  .totals .subtotal td { color: #64748b; text-align: end; }
  .totals .final { background: #EE2329; color: #fff; }
  .totals .final td { padding: 12px; font-weight: 800; font-size: 14px; text-align: end; font-family: 'JetBrains Mono',monospace; }
  .signature { margin-top: 20px; padding: 12px; background: #f8f9fa; border-radius: 6px; border: 1px dashed #ccc; }
  .signature h3 { font-size: 11px; font-weight: 700; text-align: center; margin-bottom: 12px; color: #EE2329; text-transform: uppercase; letter-spacing: 0.5px; }
  .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .signature-box { text-align: center; }
  .signature-line { border-top: 1px solid #333; margin-top: 32px; padding-top: 5px; font-size: 9px; color: #888; }
  .footer { margin-top: 14px; text-align: center; font-size: 9px; color: #888; padding-top: 8px; border-top: 1px solid #eee; }
  @media print { body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .section, .signature { break-inside: avoid; } }
</style></head><body>
  <div class="ids-bar">
    <span>رقم الفاتورة: ${esc(fmtOrderNo(o.orderNumber))}</span>
    <span>المعرّف الداخلي: ${esc(o.orderId)}</span>
  </div>
  <div class="head">
    <img src="/found.png" alt="مؤسسة" />
    <div class="head-center">
      <h1>فاب لاب الأحساء</h1>
      <p>FABLAB Al-Ahsa · متجر</p>
    </div>
    <img src="/fablab.png" alt="فاب لاب" />
  </div>
  <div class="form-title">فاتورة ضريبية — Tax Invoice</div>

  <div class="section">
    <h3>معلومات الطلب</h3>
    <div class="grid">
      <div class="field"><div class="field-label">تاريخ الطلب</div><div class="field-value">${esc(new Date(o.createdAt).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { calendar: 'gregory' }))}</div></div>
      <div class="field"><div class="field-label">الحالة</div><div class="field-value">${esc(STATUS_BADGES[o.status]?.text || o.status)}</div></div>
      <div class="field"><div class="field-label">حالة الدفع</div><div class="field-value">${o.paidAt ? '✓ مدفوع' : 'بانتظار الدفع'}</div></div>
    </div>
  </div>

  <div class="section">
    <h3>بيانات العميل</h3>
    <div class="grid">
      <div class="field field-full"><div class="field-label">الاسم</div><div class="field-value">${esc(o.customerName)}</div></div>
      <div class="field"><div class="field-label">الجوال</div><div class="field-value" style="direction:ltr">${esc(o.customerPhone)}</div></div>
      <div class="field"><div class="field-label">البريد</div><div class="field-value" style="direction:ltr">${esc(o.customerEmail)}</div></div>
      ${o.customerNationalId ? `<div class="field"><div class="field-label">رقم الهوية</div><div class="field-value" style="direction:ltr">${esc(o.customerNationalId)}</div></div>` : ''}
      ${o.deliveryAddress ? `<div class="field field-full"><div class="field-label">العنوان</div><div class="field-value">${esc(o.deliveryAddress)}</div></div>` : ''}
    </div>
  </div>

  <div class="section">
    <h3>تفاصيل المشتريات</h3>
    <table>
      <thead>
        <tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <table class="totals">
      <tr class="subtotal"><td colspan="3">المجموع الفرعي</td><td style="text-align:end;font-family:'JetBrains Mono',monospace">${SAR(o.subtotal)}</td></tr>
      <tr class="subtotal"><td colspan="3">ضريبة القيمة المضافة (${Math.round((o.taxRate || 0) * 100)}%)</td><td style="text-align:end;font-family:'JetBrains Mono',monospace">${SAR(o.taxAmount)}</td></tr>
      <tr class="final"><td colspan="3">الإجمالي الكلي</td><td>${SAR(o.total)}</td></tr>
    </table>
  </div>

  ${o.notes || o.adminNotes ? `
  <div class="section">
    <h3>ملاحظات</h3>
    ${o.notes ? `<div style="margin-bottom:8px;padding:8px 12px;background:white;border:1px solid #eee;border-radius:4px"><b>ملاحظات العميل:</b> ${esc(o.notes)}</div>` : ''}
    ${o.adminNotes ? `<div style="padding:8px 12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:4px;color:#1e3a8a"><b>ملاحظات الإدارة:</b> ${esc(o.adminNotes)}</div>` : ''}
  </div>` : ''}

  <div class="signature">
    <h3>التوقيعات</h3>
    <div class="signature-grid">
      <div class="signature-box">
        <div style="font-size:10px;color:#666;margin-bottom:28px;font-weight:600">توقيع العميل</div>
        <div class="signature-line">${esc(o.customerName)}</div>
      </div>
      <div class="signature-box">
        <div style="font-size:10px;color:#666;margin-bottom:28px;font-weight:600">توقيع المسؤول</div>
        <div class="signature-line">مسؤول متجر فاب لاب</div>
      </div>
    </div>
    <div style="text-align:center;margin-top:12px;font-size:10px;color:#475569">التاريخ: ${esc(new Date().toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { calendar: 'gregory', year: 'numeric', month: 'long', day: 'numeric' }))}</div>
  </div>

  <div class="footer">
    <p>مؤسسة عبدالمنعم الراشد الإنسانية — فاب لاب الأحساء</p>
    <p>طُبع في: ${esc(new Date().toLocaleString('ar-SA-u-ca-gregory-nu-latn', { calendar: 'gregory' }))}</p>
  </div>
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

export default StoreTab;
