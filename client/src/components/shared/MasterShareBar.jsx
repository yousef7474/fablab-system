import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../config/api';

/**
 * A single-row bar shown above the volunteers grid. Displays the
 * master share-report URL, with copy + rotate actions. The master
 * report page lists every volunteer whose per-volunteer share toggle
 * is ON.
 */
const MasterShareBar = ({ isRTL }) => {
  const [token, setToken] = useState(null);
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/volunteers/share/master-token');
        if (!cancelled) setToken(data.masterToken);
      } catch (err) {
        console.error('Master token fetch failed', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const url = token ? `${window.location.origin}/public/report/${token}` : '';

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(isRTL ? 'تم نسخ رابط التقرير العام' : 'Master report link copied');
    } catch {
      window.prompt(isRTL ? 'انسخ الرابط:' : 'Copy the link:', url);
    }
  };

  const handleRotate = async () => {
    if (!window.confirm(isRTL
      ? 'سيتم إبطال الرابط الحالي وإصدار رابط جديد. متابعة؟'
      : 'The current link will be invalidated and a new one issued. Continue?')) return;
    setRotating(true);
    try {
      const { data } = await api.post('/volunteers/share/master-token/rotate');
      setToken(data.masterToken);
      toast.success(isRTL ? 'تم توليد رابط جديد' : 'New master link generated');
    } catch (err) {
      console.error('Master rotate failed', err);
      toast.error(isRTL ? 'فشل توليد الرابط' : 'Failed to rotate');
    } finally {
      setRotating(false);
    }
  };

  const handleOpen = () => {
    if (url) window.open(url, '_blank', 'noopener');
  };

  return (
    <div className="mshare-bar">
      <div className="mshare-left">
        <div className="mshare-kicker">
          {isRTL ? 'رابط التقرير العام' : 'Master Report Link'}
        </div>
        <div className="mshare-hint">
          {isRTL
            ? 'رابط واحد يعرض بيانات كل المتطوعين الذين فعّلوا المشاركة — للمراجع الخارجي.'
            : 'One link that shows every share-enabled volunteer — for the external reviewer.'}
        </div>
      </div>
      <div className="mshare-right">
        <div className="mshare-url" title={url}>
          {url || (isRTL ? 'جارٍ التحميل...' : 'Loading…')}
        </div>
        <div className="mshare-actions">
          <button type="button" className="mshare-btn" onClick={handleCopy} disabled={!url}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            {isRTL ? 'نسخ' : 'Copy'}
          </button>
          <button type="button" className="mshare-btn" onClick={handleOpen} disabled={!url}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            {isRTL ? 'فتح' : 'Open'}
          </button>
          <button type="button" className="mshare-btn ghost" onClick={handleRotate} disabled={!url || rotating}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            {isRTL ? 'رابط جديد' : 'Rotate'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MasterShareBar;
