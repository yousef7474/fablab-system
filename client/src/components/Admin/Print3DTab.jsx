import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';
import './Print3DTab.css';

const API_URL = process.env.NODE_ENV === 'production'
  ? '/api'
  : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');

const SAR = (n) => `${Number(n || 0).toFixed(2)} ر.س`;
const fmtNo = (n) => n == null ? '—' : `P3D-${String(n).padStart(4, '0')}`;
const fmtWhen = (v) => v ? new Date(v).toLocaleString('ar-SA-u-ca-gregory-nu-latn', {
  calendar: 'gregory', hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short'
}) : '—';

const STATUS_BADGES = {
  submitted: { text: 'مستلم',          bg: '#e0e7ff', fg: '#3730a3', border: '#c7d2fe' },
  quoted:    { text: 'بانتظار القرار', bg: '#fef3c7', fg: '#92400e', border: '#fde68a' },
  accepted:  { text: 'تمت الموافقة',   bg: '#dcfce7', fg: '#166534', border: '#86efac' },
  rejected:  { text: 'مرفوض',           bg: '#fee2e2', fg: '#b91c1c', border: '#fecaca' },
  printing:  { text: 'قيد الطباعة',    bg: '#e0f2fe', fg: '#0369a1', border: '#7dd3fc' },
  ready:     { text: 'جاهز للاستلام',  bg: '#ccfbf1', fg: '#0f766e', border: '#5eead4' },
  completed: { text: 'مكتمل',           bg: '#dcfce7', fg: '#166534', border: '#86efac' },
  cancelled: { text: 'ملغى',            bg: '#f3f4f6', fg: '#4b5563', border: '#d1d5db' }
};
const STATUS_ORDER = ['submitted','quoted','accepted','rejected','printing','ready','completed','cancelled'];

const Print3DTab = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [rows, setRows] = useState([]);
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [weight, setWeight] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [savingQuote, setSavingQuote] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [statusEdit, setStatusEdit] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [r, rt] = await Promise.all([
        api.get('/print3d'),
        api.get('/print3d/rates').catch(() => ({ data: null }))
      ]);
      setRows(Array.isArray(r.data) ? r.data : []);
      setRates(rt.data);
    } catch (err) {
      toast.error(isRTL ? 'تعذّر تحميل طلبات الطباعة' : 'Failed to load print requests');
    } finally {
      setLoading(false);
    }
  }, [isRTL]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const stats = useMemo(() => ({
    total: rows.length,
    submitted: rows.filter(r => r.status === 'submitted').length,
    quoted: rows.filter(r => r.status === 'quoted').length,
    accepted: rows.filter(r => r.status === 'accepted').length,
    printing: rows.filter(r => r.status === 'printing').length,
    completed: rows.filter(r => r.status === 'completed').length,
    revenue: rows.filter(r => !!r.paidAt).reduce((s, r) => s + Number(r.estimatedCost || 0), 0)
  }), [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (statusFilter !== 'all') list = list.filter(r => r.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r =>
        String(r.requestNumber || '').includes(q) ||
        (r.customerName || '').toLowerCase().includes(q) ||
        (r.customerPhone || '').toLowerCase().includes(q) ||
        (r.customerEmail || '').toLowerCase().includes(q) ||
        (r.fileName || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, statusFilter, search]);

  const openDetail = async (r) => {
    setSelected(r);
    setDetail(null);
    setWeight(r.estimatedWeight || '');
    setAdminNote(r.adminNotes || '');
    setStatusEdit(r.status);
    try {
      const { data } = await api.get(`/print3d/${r.requestId}`);
      setDetail(data);
    } catch (err) {
      toast.error(isRTL ? 'تعذّر تحميل الطلب' : 'Failed to load request');
    }
  };

  const closeDetail = () => {
    setSelected(null); setDetail(null); setWeight(''); setAdminNote(''); setStatusEdit('');
  };

  const submitQuote = async () => {
    const w = Number(weight);
    if (!Number.isFinite(w) || w <= 0) {
      toast.error(isRTL ? 'أدخل وزناً صحيحاً بالغرام' : 'Enter a valid weight in grams');
      return;
    }
    setSavingQuote(true);
    try {
      const { data } = await api.post(`/print3d/${selected.requestId}/quote`, {
        estimatedWeight: w,
        sendEmail
      });
      toast.success(isRTL ? 'تم إرسال عرض السعر' : 'Quote sent');
      setDetail(data);
      setRows(rs => rs.map(x => x.requestId === selected.requestId ? { ...x, ...data, fileData: undefined } : x));
    } catch (err) {
      toast.error(err?.response?.data?.message || (isRTL ? 'تعذّر إرسال العرض' : 'Quote failed'));
    } finally {
      setSavingQuote(false);
    }
  };

  const saveStatus = async () => {
    if (!statusEdit) return;
    setSavingStatus(true);
    try {
      const { data } = await api.patch(`/print3d/${selected.requestId}/status`, {
        status: statusEdit,
        adminNotes: adminNote
      });
      setDetail(data);
      setRows(rs => rs.map(x => x.requestId === selected.requestId ? { ...x, status: data.status, adminNotes: data.adminNotes } : x));
      toast.success(isRTL ? 'تم تحديث الحالة' : 'Status updated');
    } catch (err) {
      toast.error(isRTL ? 'تعذّر التحديث' : 'Update failed');
    } finally {
      setSavingStatus(false);
    }
  };

  const markPaid = async () => {
    try {
      const { data } = await api.post(`/print3d/${selected.requestId}/mark-paid`);
      setDetail(data);
      setRows(rs => rs.map(x => x.requestId === selected.requestId ? { ...x, paidAt: data.paidAt } : x));
      toast.success(isRTL ? 'تم تسجيل الدفع' : 'Marked as paid');
    } catch {
      toast.error(isRTL ? 'تعذّر التحديث' : 'Update failed');
    }
  };

  const deleteRequest = async () => {
    if (!window.confirm(isRTL ? 'حذف طلب الطباعة نهائياً؟' : 'Delete this print request permanently?')) return;
    try {
      await api.delete(`/print3d/${selected.requestId}`);
      setRows(rs => rs.filter(x => x.requestId !== selected.requestId));
      closeDetail();
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
    } catch {
      toast.error(isRTL ? 'تعذّر الحذف' : 'Delete failed');
    }
  };

  const downloadFile = () => {
    // Route requires auth — fetch as blob then trigger download.
    (async () => {
      try {
        const res = await fetch(`${API_URL}/print3d/${selected.requestId}/download`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
        });
        if (!res.ok) throw new Error('download failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = selected.fileName || 'print.stl';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        toast.error(isRTL ? 'تعذّر تحميل الملف' : 'Download failed');
      }
    })();
  };

  const openInvoice = () => {
    window.open(`${API_URL}/public/print3d/${selected.requestId}/invoice`, '_blank');
  };

  return (
    <div className="p3t" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="p3t-head">
        <div>
          <h2>{isRTL ? '🖨️ خدمة الطباعة ثلاثية الأبعاد' : '🖨️ 3D Printing Service'}</h2>
          <p>{isRTL ? 'مراجعة الطلبات، إصدار عروض الأسعار، ومتابعة الإنتاج' : 'Review requests, issue quotes, and track production'}</p>
        </div>
        {rates && (
          <div className="p3t-rates">
            <span>PLA: <b>{SAR(rates.PLA)}/g</b></span>
            <span>PETG: <b>{SAR(rates.PETG)}/g</b></span>
            <span>TPU: <b>{SAR(rates.TPU)}/g</b></span>
            <span>{isRTL ? 'رسوم الإعداد:' : 'Setup:'} <b>{SAR(rates.setupFee)}</b></span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="p3t-stats">
        {[
          { label: isRTL ? 'الكل' : 'Total',              val: stats.total,     tint: '#6366f1' },
          { label: isRTL ? 'جديد' : 'New',                val: stats.submitted, tint: '#8b5cf6' },
          { label: isRTL ? 'بانتظار القرار' : 'Awaiting', val: stats.quoted,    tint: '#f59e0b' },
          { label: isRTL ? 'موافق عليه' : 'Accepted',     val: stats.accepted,  tint: '#22c55e' },
          { label: isRTL ? 'قيد الطباعة' : 'Printing',    val: stats.printing,  tint: '#0ea5e9' },
          { label: isRTL ? 'مكتمل' : 'Completed',         val: stats.completed, tint: '#16a34a' },
          { label: isRTL ? 'الإيراد' : 'Revenue',         val: SAR(stats.revenue), tint: '#EE2329', wide: true }
        ].map((s, i) => (
          <div key={i} className="p3t-stat" style={{ borderColor: `${s.tint}55` }}>
            <div className="p3t-stat-val" style={{ color: s.tint, fontSize: s.wide ? 18 : 24 }}>{s.val}</div>
            <div className="p3t-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="p3t-toolbar">
        <div className="p3t-filters">
          <button className={`p3t-chip ${statusFilter === 'all' ? 'is-active' : ''}`} onClick={() => setStatusFilter('all')}>
            {isRTL ? 'الكل' : 'All'}
          </button>
          {STATUS_ORDER.map(s => (
            <button
              key={s}
              className={`p3t-chip ${statusFilter === s ? 'is-active' : ''}`}
              onClick={() => setStatusFilter(s)}
              style={statusFilter === s ? { background: STATUS_BADGES[s].bg, color: STATUS_BADGES[s].fg, borderColor: STATUS_BADGES[s].border } : {}}
            >
              {isRTL ? STATUS_BADGES[s].text : s}
              <span className="p3t-chip-count">{rows.filter(r => r.status === s).length}</span>
            </button>
          ))}
        </div>
        <div className="p3t-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="search"
            placeholder={isRTL ? 'بحث بالرقم أو الاسم أو الملف...' : 'Search number, name, file...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Rows */}
      {loading ? (
        <div className="p3t-loading">
          <div className="p3t-spinner" />
          <span>{isRTL ? 'جارٍ التحميل...' : 'Loading...'}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p3t-empty">
          <div style={{ fontSize: 44, opacity: 0.4 }}>🖨️</div>
          <p>{isRTL ? 'لا توجد طلبات طباعة حالياً' : 'No print requests yet'}</p>
        </div>
      ) : (
        <div className="p3t-list">
          {filtered.map(r => {
            const badge = STATUS_BADGES[r.status] || { text: r.status, bg: '#f3f4f6', fg: '#374151', border: '#d1d5db' };
            return (
              <motion.button
                type="button"
                key={r.requestId}
                className="p3t-row"
                onClick={() => openDetail(r)}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -2 }}
              >
                <div className="p3t-row-no">
                  <span className="p3t-row-hash">{fmtNo(r.requestNumber)}</span>
                  <span className="p3t-row-when">{fmtWhen(r.createdAt)}</span>
                </div>
                <div className="p3t-row-cust">
                  <b>{r.customerName}</b>
                  <span dir="ltr">{r.customerPhone}</span>
                </div>
                <div className="p3t-row-file">
                  <span className="p3t-row-file-ext">.{r.fileType}</span>
                  <span className="p3t-row-file-name" title={r.fileName}>{r.fileName}</span>
                </div>
                <div className="p3t-row-material">
                  <span className="p3t-row-mat-badge">{r.material}</span>
                  <span className="p3t-row-color-mode">
                    {r.colorMode === 'multi' ? (isRTL ? '🎨 متعدد' : '🎨 Multi') : (isRTL ? '● لون واحد' : '● Single')}
                  </span>
                </div>
                <div className="p3t-row-cost">
                  {r.estimatedCost ? <b>{SAR(r.estimatedCost)}</b> : <span className="p3t-row-noquote">{isRTL ? 'بدون عرض' : 'No quote'}</span>}
                  {r.paidAt && <span className="p3t-row-paid">✓ {isRTL ? 'مدفوع' : 'Paid'}</span>}
                </div>
                <div className="p3t-row-status">
                  <span className="p3t-badge" style={{ background: badge.bg, color: badge.fg, border: `1px solid ${badge.border}` }}>
                    {isRTL ? badge.text : r.status}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="p3t-modal-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={closeDetail}
          >
            <motion.div
              className="p3t-modal"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="p3t-modal-head">
                <div>
                  <div className="p3t-modal-kicker">{isRTL ? 'طلب طباعة ثلاثية الأبعاد' : '3D Print Request'}</div>
                  <h3>{fmtNo(selected.requestNumber)}</h3>
                </div>
                <button type="button" className="p3t-modal-close" onClick={closeDetail}>✕</button>
              </div>

              {!detail ? (
                <div className="p3t-modal-body">
                  <div className="p3t-loading">
                    <div className="p3t-spinner" />
                    <span>{isRTL ? 'جارٍ التحميل...' : 'Loading...'}</span>
                  </div>
                </div>
              ) : (
                <div className="p3t-modal-body">
                  {/* Customer */}
                  <section className="p3t-section">
                    <h4>{isRTL ? '👤 بيانات العميل' : '👤 Customer'}</h4>
                    <div className="p3t-kv">
                      <div><span>{isRTL ? 'الاسم:' : 'Name:'}</span><b>{detail.customerName}</b></div>
                      <div><span>{isRTL ? 'الجوال:' : 'Phone:'}</span><b dir="ltr">{detail.customerPhone}</b></div>
                      <div><span>{isRTL ? 'البريد:' : 'Email:'}</span><b dir="ltr">{detail.customerEmail}</b></div>
                      {detail.customerNationalId && <div><span>{isRTL ? 'الهوية:' : 'ID:'}</span><b dir="ltr">{detail.customerNationalId}</b></div>}
                      {detail.deliveryAddress && <div><span>{isRTL ? 'العنوان:' : 'Address:'}</span><b>{detail.deliveryAddress}</b></div>}
                    </div>
                  </section>

                  {/* File */}
                  <section className="p3t-section">
                    <h4>{isRTL ? '📄 الملف' : '📄 File'}</h4>
                    <div className="p3t-file-row">
                      <span className="p3t-file-ext">.{detail.fileType}</span>
                      <div className="p3t-file-info">
                        <b>{detail.fileName}</b>
                        <span>{(detail.fileSize / 1024).toFixed(1)} KB</span>
                      </div>
                      <button type="button" className="p3t-btn p3t-btn--primary" onClick={downloadFile}>
                        ⬇ {isRTL ? 'تحميل الملف' : 'Download file'}
                      </button>
                    </div>
                  </section>

                  {/* Print options */}
                  <section className="p3t-section">
                    <h4>{isRTL ? '⚙️ خيارات الطباعة' : '⚙️ Print options'}</h4>
                    <div className="p3t-kv">
                      <div><span>{isRTL ? 'الخامة:' : 'Material:'}</span><b>{detail.material}</b></div>
                      <div><span>{isRTL ? 'نمط اللون:' : 'Color mode:'}</span><b>{detail.colorMode === 'multi' ? (isRTL ? 'متعدد الألوان' : 'Multi-color') : (isRTL ? 'لون واحد' : 'Single')}</b></div>
                    </div>

                    {detail.colorMode === 'multi' && Array.isArray(detail.multiColorParts) && detail.multiColorParts.length > 0 ? (
                      <div className="p3t-parts">
                        {detail.multiColorParts.map((p, i) => (
                          <div key={i} className="p3t-part">
                            <span className="p3t-part-chip" style={{ background: p.color }} />
                            <b>{p.part}</b>
                            <span className="p3t-part-hex">{p.color}</span>
                          </div>
                        ))}
                      </div>
                    ) : detail.singleColor && (
                      <div className="p3t-parts">
                        <div className="p3t-part">
                          <span className="p3t-part-chip" style={{ background: detail.singleColor }} />
                          <b>{isRTL ? 'اللون الكامل' : 'Full print color'}</b>
                          <span className="p3t-part-hex">{detail.singleColor}</span>
                        </div>
                      </div>
                    )}
                    {detail.notes && (
                      <div className="p3t-notes">
                        <div className="p3t-notes-title">{isRTL ? 'ملاحظات العميل' : 'Customer notes'}</div>
                        <p>{detail.notes}</p>
                      </div>
                    )}
                  </section>

                  {/* Quote */}
                  <section className="p3t-section">
                    <h4>{isRTL ? '💵 عرض السعر' : '💵 Quote'}</h4>
                    <div className="p3t-quote">
                      <label>
                        <span>{isRTL ? 'الوزن التقديري (غرام)' : 'Estimated weight (grams)'}</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={weight}
                          onChange={e => setWeight(e.target.value)}
                          placeholder={isRTL ? 'مثال: 45.5' : 'e.g., 45.5'}
                        />
                      </label>
                      <label className="p3t-quote-check">
                        <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} />
                        <span>{isRTL ? 'إرسال العرض بالبريد للعميل' : 'Email quote to customer'}</span>
                      </label>
                      <button type="button" className="p3t-btn p3t-btn--primary" onClick={submitQuote} disabled={savingQuote}>
                        {savingQuote
                          ? (isRTL ? 'جاري الحفظ...' : 'Saving...')
                          : detail.estimatedCost
                            ? (isRTL ? '🔄 إعادة حساب وإرسال' : '🔄 Recompute & send')
                            : (isRTL ? '💵 إرسال عرض السعر' : '💵 Send quote')}
                      </button>
                    </div>

                    {detail.estimatedCost && (
                      <div className="p3t-quote-breakdown">
                        <div><span>{isRTL ? 'المجموع الفرعي' : 'Subtotal'}</span><b>{SAR(detail.subtotal)}</b></div>
                        <div><span>{isRTL ? `ضريبة (${Math.round((detail.taxRate || 0) * 100)}%)` : `VAT (${Math.round((detail.taxRate || 0) * 100)}%)`}</span><b>{SAR(detail.taxAmount)}</b></div>
                        <div className="p3t-quote-total"><span>{isRTL ? 'الإجمالي' : 'Total'}</span><b>{SAR(detail.estimatedCost)}</b></div>
                        {detail.quotedAt && <div className="p3t-quote-when">{isRTL ? 'أُرسل في:' : 'Sent:'} {fmtWhen(detail.quotedAt)}</div>}
                      </div>
                    )}

                    {(detail.acceptedAt || detail.rejectedAt) && (
                      <div className={`p3t-decision ${detail.rejectedAt ? 'is-reject' : 'is-accept'}`}>
                        <b>
                          {detail.acceptedAt
                            ? (isRTL ? '✓ العميل وافق' : '✓ Customer accepted')
                            : (isRTL ? '✕ العميل رفض' : '✕ Customer rejected')}
                        </b>
                        <span>{fmtWhen(detail.acceptedAt || detail.rejectedAt)}</span>
                        {detail.customerDecisionMessage && <p>"{detail.customerDecisionMessage}"</p>}
                      </div>
                    )}
                  </section>

                  {/* Status */}
                  <section className="p3t-section">
                    <h4>{isRTL ? '📊 الحالة والملاحظات' : '📊 Status & admin notes'}</h4>
                    <div className="p3t-status-edit">
                      <label>
                        <span>{isRTL ? 'الحالة' : 'Status'}</span>
                        <select value={statusEdit} onChange={e => setStatusEdit(e.target.value)}>
                          {STATUS_ORDER.map(s => (
                            <option key={s} value={s}>{isRTL ? STATUS_BADGES[s].text : s}</option>
                          ))}
                        </select>
                      </label>
                      <label className="p3t-status-note">
                        <span>{isRTL ? 'ملاحظة داخلية' : 'Admin note'}</span>
                        <textarea
                          rows={2}
                          value={adminNote}
                          onChange={e => setAdminNote(e.target.value)}
                          placeholder={isRTL ? 'ملاحظات لا تظهر للعميل...' : 'Notes that stay private...'}
                        />
                      </label>
                      <button type="button" className="p3t-btn p3t-btn--secondary" onClick={saveStatus} disabled={savingStatus}>
                        {savingStatus ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ التحديث' : 'Save update')}
                      </button>
                    </div>
                  </section>
                </div>
              )}

              {/* Actions footer */}
              <div className="p3t-modal-foot">
                <div className="p3t-foot-left">
                  {detail?.estimatedCost && !detail?.paidAt && (
                    <button type="button" className="p3t-btn p3t-btn--success" onClick={markPaid}>
                      ✓ {isRTL ? 'تسجيل الدفع' : 'Mark paid'}
                    </button>
                  )}
                  {detail?.estimatedCost && (
                    <button type="button" className="p3t-btn p3t-btn--primary" onClick={openInvoice}>
                      🖨️ {isRTL ? 'طباعة الفاتورة' : 'Print invoice'}
                    </button>
                  )}
                </div>
                <div className="p3t-foot-right">
                  <button type="button" className="p3t-btn p3t-btn--danger" onClick={deleteRequest}>
                    🗑️ {isRTL ? 'حذف' : 'Delete'}
                  </button>
                  <button type="button" className="p3t-btn p3t-btn--ghost" onClick={closeDetail}>
                    {isRTL ? 'إغلاق' : 'Close'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Print3DTab;
