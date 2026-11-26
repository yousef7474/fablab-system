import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import axios from 'axios';
import StudioShell, { useStudioTheme } from '../RegistrationForm/StudioShell';
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
  const [theme, toggleTheme] = useStudioTheme();
  const shell = {
    isRTL, theme, onToggleTheme: toggleTheme, servicesHref: '/register',
    subtitle: isRTL ? 'عرض سعر الطباعة' : '3D print quote',
    intro: {
      portal: isRTL ? 'عرض سعر الطباعة' : '3D print quote',
      title: isRTL ? <>راجع عرض السعر<br /><em>ثم وافق أو ارفض</em></> : <>Review your quote<br /><em>then accept or decline</em></>,
      features: [
        { ar: 'لن نبدأ الطباعة قبل موافقتك', en: 'Nothing is printed before you accept', d: ['M9 11l3 3L22 4', 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'] },
        { ar: 'الدفع نقدًا عند الاستلام', en: 'Pay cash on pickup', d: ['M2 6h20v12H2z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'] },
        { ar: 'يصلك بريد عند جاهزية الطلب', en: 'We email you when it is ready', d: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M22 6l-10 7L2 6'] }
      ]
    }
  };

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
      <StudioShell {...shell}>
        <section className="rgx-card p3q-loading" aria-busy="true"><span className="p3q-spin" /></section>
      </StudioShell>
    );
  }

  if (error || !request) {
    return (
      <StudioShell {...shell}>
        <section className="rgx-card rgx-closed">
          <span className="rgx-closed-ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
          </span>
          <h2>{isRTL ? 'رابط غير صالح' : 'Invalid link'}</h2>
          <p className="rgx-closed-text">{error}</p>
          <div className="rgx-closed-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/register')}>{isRTL ? 'كل الخدمات' : 'All services'}</button>
          </div>
        </section>
      </StudioShell>
    );
  }

  const reqNo = fmtRequestNumber(request.requestNumber);
  const decided = request.status === 'accepted' || request.status === 'rejected'
    || request.status === 'printing' || request.status === 'ready' || request.status === 'completed';
  const canDecide = request.status === 'quoted';
  const statusText = {
    accepted: isRTL ? 'لقد قمت بقبول هذا العرض — سنبدأ الطباعة قريباً' : 'You accepted this quote — printing will begin shortly',
    rejected: isRTL ? 'لقد رفضت هذا العرض' : 'You rejected this quote',
    printing: isRTL ? 'الطلب قيد الطباعة' : 'Printing in progress',
    ready: isRTL ? 'الطلب جاهز للاستلام' : 'Ready for pickup',
    completed: isRTL ? 'تم استلام الطلب' : 'Order completed'
  }[request.status];

  return (
    <StudioShell {...shell}>
      <motion.section
        className="rgx-card p3q"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      >
        <div className="p3q-head">
          <span className="p3q-kicker">{isRTL ? 'عرض السعر' : 'Quote'}</span>
          <h1>{isRTL ? `مرحباً ${request.customerName}` : `Hi ${request.customerName}`}</h1>
          <p>{isRTL ? 'عرض السعر لطلب الطباعة رقم ' : 'Quote for print request '}<b dir="ltr">{reqNo}</b></p>
        </div>

        {decided && (
          <div className={`p3q-status ${request.status === 'rejected' ? 'is-bad' : 'is-good'}`}>{statusText}</div>
        )}
        {request.status === 'submitted' && (
          <div className="p3q-status is-wait">
            {isRTL ? 'لا يزال عرض السعر قيد التحضير — سنرسله لك قريباً' : 'Your quote is still being prepared — we will email it soon'}
          </div>
        )}

        <div className="p3q-facts">
          {[
            [isRTL ? 'الملف' : 'File', request.fileName],
            [isRTL ? 'الخامة' : 'Material', request.material],
            [isRTL ? 'نمط اللون' : 'Color mode', request.colorMode === 'multi' ? (isRTL ? 'متعدد الألوان' : 'Multi-color') : (isRTL ? 'لون واحد' : 'Single color')],
            request.estimatedWeight && [isRTL ? 'الوزن التقديري' : 'Estimated weight', `${request.estimatedWeight} ${isRTL ? 'جم' : 'g'}`]
          ].filter(Boolean).map(([k, v]) => (
            <div key={k} className="p3q-fact"><small>{k}</small><b dir="auto">{v}</b></div>
          ))}
        </div>

        {request.colorMode === 'multi' && Array.isArray(request.multiColorParts) && request.multiColorParts.length > 0 && (
          <div className="p3q-parts">
            <small>{isRTL ? 'تفاصيل الألوان' : 'Color details'}</small>
            {request.multiColorParts.map((p, i) => (
              <div key={i} className="p3q-part">
                <span className="p3q-swatch" style={{ background: p.color }} />
                <b>{p.part}</b>
                <code>{p.color}</code>
              </div>
            ))}
          </div>
        )}

        {request.estimatedCost && (
          <div className="p3q-cost">
            <small>{isRTL ? 'تفاصيل التكلفة' : 'Cost breakdown'}</small>
            <div className="p3q-row">
              <span>{isRTL ? `الخامة (${request.material}) — ${request.estimatedWeight} جم × ${SAR(request.materialRate)}` : `Material (${request.material}) — ${request.estimatedWeight}g × ${SAR(request.materialRate)}`}</span>
              <b>{SAR(Number(request.estimatedWeight) * Number(request.materialRate))}</b>
            </div>
            <div className="p3q-row">
              <span>{isRTL ? 'رسوم الإعداد والمعايرة' : 'Setup & calibration fee'}</span>
              <b>{SAR(request.setupFee)}</b>
            </div>
            {Number(request.multiColorFee) > 0 && (
              <div className="p3q-row">
                <span>{isRTL ? 'رسوم الألوان المتعددة' : 'Multi-color fee'}</span>
                <b>{SAR(request.multiColorFee)}</b>
              </div>
            )}
            <div className="p3q-row is-sub">
              <span>{isRTL ? 'المجموع الفرعي' : 'Subtotal'}</span>
              <b>{SAR(request.subtotal)}</b>
            </div>
            {Number(request.taxAmount) > 0 && (
              <div className="p3q-row is-sub">
                <span>{isRTL ? `ضريبة القيمة المضافة (${Math.round((request.taxRate || 0) * 100)}%)` : `VAT (${Math.round((request.taxRate || 0) * 100)}%)`}</span>
                <b>{SAR(request.taxAmount)}</b>
              </div>
            )}
            <div className="p3q-total">
              <span>{isRTL ? 'الإجمالي المستحق' : 'Total due'}</span>
              <b>{SAR(request.estimatedCost)}</b>
            </div>
          </div>
        )}

        {canDecide && (
          <AnimatePresence mode="wait">
            {rejecting ? (
              <motion.div
                key="reject"
                className="p3q-reject"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              >
                <label className="form-label" htmlFor="p3q-msg">{isRTL ? 'سبب الرفض (اختياري)' : 'Reason for rejection (optional)'}</label>
                <textarea
                  id="p3q-msg"
                  className="form-textarea"
                  rows={3}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={isRTL ? 'أخبرنا لماذا لا يناسبك هذا السعر...' : 'Tell us why the quote does not work...'}
                />
                <div className="p3q-actions">
                  <button type="button" className="btn p3q-btn-no" onClick={() => decide('reject')} disabled={submitting}>
                    {submitting ? '...' : (isRTL ? 'تأكيد الرفض' : 'Confirm rejection')}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setRejecting(false)}>{isRTL ? 'رجوع' : 'Back'}</button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="choose"
                className="p3q-actions"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              >
                <button type="button" className="btn btn-submit p3q-btn-ok" onClick={() => decide('accept')} disabled={submitting}>
                  {isRTL ? 'أوافق على السعر' : 'Accept quote'}
                </button>
                <button type="button" className="btn btn-secondary p3q-btn-ghost" onClick={() => setRejecting(true)} disabled={submitting}>
                  {isRTL ? 'رفض' : 'Reject'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </motion.section>
    </StudioShell>
  );
};

export default PrintQuotePage;
