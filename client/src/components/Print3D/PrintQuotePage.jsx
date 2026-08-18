import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import axios from 'axios';
import './PrintService.css';

const API_URL = process.env.NODE_ENV === 'production'
  ? '/api'
  : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');

const SAR = (n) => `${Number(n || 0).toFixed(2)} ر.س`;
const fmtRequestNumber = (n) => n == null ? '—' : `P3D-${String(n).padStart(4, '0')}`;

const PrintQuotePage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${API_URL}/public/print3d/quote/${token}`);
        setRequest(data);
      } catch (err) {
        const body = err?.response?.data || {};
        setError(body.messageAr || body.message || (isRTL ? 'تعذّر تحميل الطلب' : 'Failed to load'));
      } finally {
        setLoading(false);
      }
    })();
  }, [token, isRTL]);

  const decide = async (decision) => {
    setSubmitting(true);
    try {
      const { data } = await axios.post(`${API_URL}/public/print3d/quote/${token}/decide`, {
        decision,
        message: message.trim() || null
      });
      setRequest(r => ({ ...r, status: data.status }));
      toast.success(decision === 'accept'
        ? (isRTL ? 'تم قبول عرض السعر' : 'Quote accepted')
        : (isRTL ? 'تم رفض عرض السعر' : 'Quote rejected'));
      setRejecting(false);
    } catch (err) {
      const body = err?.response?.data || {};
      toast.error(body.messageAr || body.message || (isRTL ? 'تعذّر إرسال القرار' : 'Decision failed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p3d" dir={isRTL ? 'rtl' : 'ltr'}>
        <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
          <div style={{
            width: 48, height: 48,
            border: '3px solid rgba(14,165,233,0.2)',
            borderTopColor: '#0ea5e9',
            borderRadius: '50%',
            animation: 'spin 0.9s linear infinite'
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="p3d" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="p3d-success" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'linear-gradient(180deg, rgba(239,68,68,0.08), rgba(15,23,42,0.6))' }}>
          <h2 style={{ color: '#fca5a5' }}>{isRTL ? 'رابط غير صالح' : 'Invalid link'}</h2>
          <p>{error}</p>
          <div className="p3d-success-actions">
            <button type="button" onClick={() => navigate('/register')}>{isRTL ? 'الرئيسية' : 'Home'}</button>
          </div>
        </div>
      </div>
    );
  }

  const reqNo = fmtRequestNumber(request.requestNumber);
  const decided = request.status === 'accepted' || request.status === 'rejected'
    || request.status === 'printing' || request.status === 'ready' || request.status === 'completed';
  const canDecide = request.status === 'quoted';

  return (
    <div className="p3d" dir={isRTL ? 'rtl' : 'ltr'}>
      <header className="p3d-topbar">
        <button type="button" className="p3d-brand" onClick={() => navigate('/register')}>
          <img src="/logo.png" alt="" />
          <div>
            <div className="p3d-brand-title">{isRTL ? 'فاب لاب الأحساء' : 'FabLab Al-Ahsa'}</div>
            <div className="p3d-brand-sub">{isRTL ? 'خدمة الطباعة ثلاثية الأبعاد' : '3D Printing Service'}</div>
          </div>
        </button>
        <div className="p3d-topbar-actions">
          <button type="button" className="p3d-lang" onClick={() => i18n.changeLanguage(isRTL ? 'en' : 'ar')}>
            {isRTL ? 'EN' : 'ع'}
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 720, margin: '40px auto', padding: '0 20px' }}>
        <motion.div
          className="p3d-card"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        >
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              display: 'inline-block',
              background: 'rgba(14,165,233,0.15)',
              color: '#7dd3fc',
              padding: '6px 18px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1.2,
              marginBottom: 14
            }}>
              {isRTL ? '💵 عرض السعر' : '💵 QUOTE'}
            </div>
            <h1 style={{
              fontFamily: "'Bricolage Grotesque', Cairo, sans-serif",
              fontSize: 26,
              fontWeight: 800,
              color: '#f8fafc',
              marginBottom: 8
            }}>
              {isRTL ? `مرحباً ${request.customerName}` : `Hi ${request.customerName}`}
            </h1>
            <p style={{ color: '#94a3b8', fontSize: 14 }}>
              {isRTL ? `عرض السعر لطلب الطباعة رقم ` : `Quote for print request `}
              <b style={{ color: '#7dd3fc', fontFamily: 'monospace' }}>{reqNo}</b>
            </p>
          </div>

          {/* Status banner */}
          {decided && (
            <div style={{
              padding: '14px 18px',
              borderRadius: 12,
              marginBottom: 20,
              textAlign: 'center',
              fontWeight: 700,
              background: request.status === 'rejected' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
              border: `1px solid ${request.status === 'rejected' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
              color: request.status === 'rejected' ? '#fca5a5' : '#6ee7b7'
            }}>
              {request.status === 'accepted' && (isRTL ? '✓ لقد قمت بقبول هذا العرض — سنبدأ الطباعة قريباً' : '✓ You accepted this quote — printing will begin shortly')}
              {request.status === 'rejected' && (isRTL ? '✕ لقد رفضت هذا العرض' : '✕ You rejected this quote')}
              {request.status === 'printing' && (isRTL ? '🖨️ الطلب قيد الطباعة' : '🖨️ Printing in progress')}
              {request.status === 'ready' && (isRTL ? '✅ الطلب جاهز للاستلام' : '✅ Ready for pickup')}
              {request.status === 'completed' && (isRTL ? '✅ تم استلام الطلب' : '✅ Order completed')}
            </div>
          )}

          {request.status === 'submitted' && (
            <div style={{
              padding: '14px 18px',
              borderRadius: 12,
              marginBottom: 20,
              textAlign: 'center',
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.3)',
              color: '#fcd34d',
              fontWeight: 600
            }}>
              {isRTL ? '⏳ لا يزال عرض السعر قيد التحضير — سنرسله لك قريباً' : '⏳ Your quote is still being prepared — we will email it soon'}
            </div>
          )}

          {/* Request summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              [isRTL ? 'الملف' : 'File', request.fileName],
              [isRTL ? 'الخامة' : 'Material', request.material],
              [isRTL ? 'نمط اللون' : 'Color mode', request.colorMode === 'multi' ? (isRTL ? 'متعدد الألوان' : 'Multi-color') : (isRTL ? 'لون واحد' : 'Single color')],
              request.estimatedWeight && [isRTL ? 'الوزن التقديري' : 'Estimated weight', `${request.estimatedWeight} ${isRTL ? 'جم' : 'g'}`]
            ].filter(Boolean).map(([k, v]) => (
              <div key={k} style={{
                padding: '10px 14px',
                background: 'rgba(15,23,42,0.5)',
                borderRadius: 8,
                border: '1px solid rgba(148,163,184,0.15)'
              }}>
                <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{k}</div>
                <div style={{ fontSize: 13.5, color: '#f1f5f9', fontWeight: 700, direction: 'ltr' }}>{v}</div>
              </div>
            ))}
          </div>

          {request.colorMode === 'multi' && Array.isArray(request.multiColorParts) && request.multiColorParts.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>
                {isRTL ? 'تفاصيل الألوان' : 'Color details'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {request.multiColorParts.map((p, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    background: 'rgba(15,23,42,0.4)',
                    borderRadius: 8,
                    border: '1px solid rgba(148,163,184,0.12)'
                  }}>
                    <span style={{
                      display: 'inline-block',
                      width: 22, height: 22,
                      borderRadius: 6,
                      background: p.color,
                      border: '1px solid rgba(148,163,184,0.3)',
                      flexShrink: 0
                    }} />
                    <b style={{ color: '#f1f5f9', flex: 1 }}>{p.part}</b>
                    <span style={{ fontFamily: 'monospace', color: '#94a3b8', fontSize: 12 }}>{p.color}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cost breakdown */}
          {request.estimatedCost && (
            <div style={{
              padding: 20,
              background: 'linear-gradient(135deg, rgba(14,165,233,0.08), rgba(37,99,235,0.04))',
              border: '1px solid rgba(14,165,233,0.3)',
              borderRadius: 14,
              marginBottom: 20
            }}>
              <div style={{ fontSize: 11, color: '#7dd3fc', textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 12, fontWeight: 700, textAlign: 'center' }}>
                {isRTL ? 'تفاصيل التكلفة' : 'Cost Breakdown'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                  <span>{isRTL ? `الخامة (${request.material}) — ${request.estimatedWeight} جم × ${SAR(request.materialRate)}` : `Material (${request.material}) — ${request.estimatedWeight}g × ${SAR(request.materialRate)}`}</span>
                  <b style={{ fontFamily: 'monospace' }}>{SAR(Number(request.estimatedWeight) * Number(request.materialRate))}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                  <span>{isRTL ? 'رسوم الإعداد والمعايرة' : 'Setup & calibration fee'}</span>
                  <b style={{ fontFamily: 'monospace' }}>{SAR(request.setupFee)}</b>
                </div>
                {Number(request.multiColorFee) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                    <span>{isRTL ? 'رسوم الألوان المتعددة' : 'Multi-color fee'}</span>
                    <b style={{ fontFamily: 'monospace' }}>{SAR(request.multiColorFee)}</b>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', paddingTop: 10, borderTop: '1px solid rgba(148,163,184,0.15)' }}>
                  <span>{isRTL ? 'المجموع الفرعي' : 'Subtotal'}</span>
                  <b style={{ fontFamily: 'monospace' }}>{SAR(request.subtotal)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                  <span>{isRTL ? `ضريبة القيمة المضافة (${Math.round((request.taxRate || 0) * 100)}%)` : `VAT (${Math.round((request.taxRate || 0) * 100)}%)`}</span>
                  <b style={{ fontFamily: 'monospace' }}>{SAR(request.taxAmount)}</b>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 8,
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
                  borderRadius: 10,
                  color: '#fff',
                  fontFamily: "'Bricolage Grotesque', Cairo, sans-serif",
                  fontSize: 17,
                  fontWeight: 800
                }}>
                  <span>{isRTL ? 'الإجمالي المستحق' : 'Total Due'}</span>
                  <b style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18 }}>{SAR(request.estimatedCost)}</b>
                </div>
              </div>
            </div>
          )}

          {/* Decision UI */}
          {canDecide && (
            <AnimatePresence mode="wait">
              {rejecting ? (
                <motion.div
                  key="reject"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                >
                  <label style={{ fontSize: 13.5, color: '#cbd5e1', fontWeight: 600, marginBottom: 6, display: 'block' }}>
                    {isRTL ? 'سبب الرفض (اختياري)' : 'Reason for rejection (optional)'}
                  </label>
                  <textarea
                    rows={3}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder={isRTL ? 'أخبرنا لماذا لا يناسبك هذا السعر...' : 'Tell us why the quote does not work...'}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'rgba(15,23,42,0.6)',
                      border: '1px solid rgba(148,163,184,0.22)',
                      borderRadius: 10,
                      color: '#f1f5f9',
                      fontFamily: 'inherit',
                      fontSize: 14,
                      marginBottom: 12,
                      resize: 'vertical'
                    }}
                  />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => decide('reject')}
                      disabled={submitting}
                      style={{
                        flex: 1,
                        padding: '13px 20px',
                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 12,
                        fontFamily: 'inherit',
                        fontWeight: 800,
                        fontSize: 15,
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        opacity: submitting ? 0.5 : 1
                      }}
                    >
                      {submitting ? (isRTL ? '...' : '...') : (isRTL ? '✕ تأكيد الرفض' : '✕ Confirm rejection')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejecting(false)}
                      style={{
                        padding: '13px 20px',
                        background: 'transparent',
                        color: '#cbd5e1',
                        border: '1px solid rgba(148,163,184,0.3)',
                        borderRadius: 12,
                        fontFamily: 'inherit',
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: 'pointer'
                      }}
                    >
                      {isRTL ? 'رجوع' : 'Back'}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="choose"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  style={{ display: 'flex', gap: 12 }}
                >
                  <button
                    type="button"
                    onClick={() => decide('accept')}
                    disabled={submitting}
                    style={{
                      flex: 1,
                      padding: '15px 20px',
                      background: 'linear-gradient(135deg, #16a34a, #15803d)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 12,
                      fontFamily: "'Bricolage Grotesque', Cairo, sans-serif",
                      fontWeight: 800,
                      fontSize: 16,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      boxShadow: '0 10px 24px -10px rgba(22,163,74,0.6)',
                      opacity: submitting ? 0.6 : 1
                    }}
                  >
                    {isRTL ? '✓ أوافق على السعر' : '✓ Accept quote'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejecting(true)}
                    disabled={submitting}
                    style={{
                      padding: '15px 24px',
                      background: 'transparent',
                      color: '#fca5a5',
                      border: '1px solid rgba(239,68,68,0.4)',
                      borderRadius: 12,
                      fontFamily: 'inherit',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: 'pointer'
                    }}
                  >
                    {isRTL ? '✕ رفض' : '✕ Reject'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default PrintQuotePage;
