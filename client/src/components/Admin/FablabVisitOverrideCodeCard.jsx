import React, { useEffect, useState, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';
import api from '../../config/api';

// Small self-contained card for the admin Settings tab. Shows the
// current FABLAB Visit override code, ticks the remaining validity
// down every second, offers copy-to-clipboard, and lets the admin
// force-rotate it.
const FablabVisitOverrideCodeCard = ({ isRTL }) => {
  const [state, setState] = useState({ code: '••••••', expiresAt: null });
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [now, setNow] = useState(Date.now());
  const tickRef = useRef(null);

  const fetchCode = useCallback(async () => {
    try {
      const { data } = await api.get('/fablab-visits/override-code');
      setState({ code: data.code, expiresAt: data.expiresAt });
    } catch (err) {
      console.error('fetch override code:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCode();
    // Tick once per second for the countdown.
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tickRef.current);
  }, [fetchCode]);

  // Auto-refresh once the current code expires so admin always sees
  // the live value without having to click "Regenerate".
  useEffect(() => {
    if (!state.expiresAt) return;
    const remaining = new Date(state.expiresAt).getTime() - now;
    if (remaining <= 0) fetchCode();
  }, [now, state.expiresAt, fetchCode]);

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const { data } = await api.post('/fablab-visits/override-code/regenerate');
      setState({ code: data.code, expiresAt: data.expiresAt });
      toast.success(isRTL ? 'تم توليد رمز جديد' : 'New code generated');
    } catch (err) {
      toast.error(isRTL ? 'تعذر توليد رمز جديد' : 'Failed to regenerate');
    } finally {
      setRegenerating(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(state.code);
      toast.success(isRTL ? 'تم النسخ' : 'Copied');
    } catch {
      toast.error(isRTL ? 'تعذر النسخ' : 'Copy failed');
    }
  };

  const remainingMs = state.expiresAt ? new Date(state.expiresAt).getTime() - now : 0;
  const remainingSec = Math.max(0, Math.floor(remainingMs / 1000));
  const mm = String(Math.floor(remainingSec / 60)).padStart(2, '0');
  const ss = String(remainingSec % 60).padStart(2, '0');
  const pct = Math.max(0, Math.min(100, (remainingMs / (5 * 60 * 1000)) * 100));

  // Color tints based on remaining time
  const tint = remainingSec > 180 ? '#0ea5e9' : remainingSec > 60 ? '#f59e0b' : '#dc2626';

  return (
    <div className="settings-card" style={{ border: `2px solid ${tint}`, background: `${tint}0d` }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={tint} strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        {isRTL ? 'رمز تجاوز أوقات زيارة فاب لاب' : 'FABLAB Visit Override Code'}
      </h3>

      <p style={{ margin: '4px 0 14px', color: '#64748b', fontSize: 13, lineHeight: 1.7 }}>
        {isRTL
          ? 'يتيح هذا الرمز للزوار تقديم طلب زيارة خارج أيام العمل الرسمية أو خلال فترات الإغلاق. الرمز صالح لمدة ٥ دقائق فقط ثم يتغير تلقائياً. أعطِ الرمز للزائر مباشرة عند الحاجة.'
          : 'This code lets visitors submit a request outside official working days or during closure periods. It rotates every 5 minutes. Share it directly with the visitor when needed.'}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
        <div
          onClick={copy}
          title={isRTL ? 'انسخ الرمز' : 'Click to copy'}
          style={{
            flex: '0 1 260px',
            padding: '18px 22px',
            background: '#fff',
            border: `2px dashed ${tint}`,
            borderRadius: 14,
            cursor: 'pointer',
            userSelect: 'all',
            textAlign: 'center',
            transition: 'transform 0.15s',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: 8,
            color: tint,
            direction: 'ltr'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          {loading ? '••••••' : state.code}
        </div>

        <div style={{ flex: '1 1 200px', minWidth: 200 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
            {isRTL ? 'الوقت المتبقي' : 'Time Remaining'}
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 26, fontWeight: 800, color: tint, direction: 'ltr', marginBottom: 6 }}>
            {mm}:{ss}
          </div>
          <div style={{ height: 6, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${tint}, ${tint}bb)`, transition: 'width 1s linear' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={copy}
            disabled={loading}
            style={{
              padding: '10px 18px', borderRadius: 10, border: '1px solid #e5e7eb',
              background: '#fff', color: '#0f172a', cursor: 'pointer', fontWeight: 700, fontSize: 13
            }}
          >
            📋 {isRTL ? 'نسخ' : 'Copy'}
          </button>
          <button
            onClick={regenerate}
            disabled={regenerating}
            style={{
              padding: '10px 18px', borderRadius: 10, border: 'none',
              background: `linear-gradient(135deg, ${tint}, ${tint}cc)`, color: '#fff',
              cursor: regenerating ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13,
              opacity: regenerating ? 0.6 : 1
            }}
          >
            {regenerating
              ? (isRTL ? 'جارٍ التوليد...' : 'Regenerating...')
              : (isRTL ? '🔄 توليد رمز جديد' : '🔄 Regenerate')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FablabVisitOverrideCodeCard;
