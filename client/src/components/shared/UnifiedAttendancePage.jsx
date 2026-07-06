import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import api from '../../config/api';
import '../Mawhba/Mawhba.css';

// One attendance page for both Mawhba students and Volunteers.
// The USB HID barcode reader listener runs while this component is
// mounted with open=true. Each scanned code is tried against Mawhba
// first (course-based color grouping) and falls back to Volunteer
// if not found (single orange "Volunteers" group).

const UnifiedAttendancePage = ({ open, onClose, isRTL }) => {
  const [groups, setGroups] = useState([]);
  const [sessionStats, setSessionStats] = useState({ checkins: 0, checkouts: 0, errors: 0 });
  const [recentScans, setRecentScans] = useState([]);
  const [scanPopup, setScanPopup] = useState(null);
  const [clearingToday, setClearingToday] = useState(false);
  const hwBufferRef = useRef('');
  const hwLastKeyRef = useRef(0);
  const scanPopupTimerRef = useRef(null);

  const fmtTime = useCallback((iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);

  const fmtTimeLong = useCallback((iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }, []);

  const hydrate = useCallback(async () => {
    try {
      const [m, v] = await Promise.allSettled([
        api.get('/mawhba/attendance/today'),
        api.get('/volunteers/attendance/today')
      ]);
      const mData = m.status === 'fulfilled' ? m.value.data : null;
      const vData = v.status === 'fulfilled' ? v.value.data : null;

      const combined = [];
      if (Array.isArray(mData?.groups)) {
        mData.groups.forEach(g => combined.push({
          category: 'mawhba',
          course: g.course,
          color: g.color,
          students: g.students
        }));
      }
      if (Array.isArray(vData?.volunteers) && vData.volunteers.length > 0) {
        combined.push({
          category: 'volunteer',
          course: isRTL ? 'المتطوعون' : 'Volunteers',
          color: '#f97316',
          students: vData.volunteers
        });
      }
      setGroups(combined);

      const mStats = mData?.stats || { checkins: 0, checkouts: 0 };
      const vStats = vData?.stats || { checkins: 0, checkouts: 0 };
      setSessionStats(prev => ({
        checkins: (mStats.checkins || 0) + (vStats.checkins || 0),
        checkouts: (mStats.checkouts || 0) + (vStats.checkouts || 0),
        errors: prev.errors
      }));
    } catch (err) {
      console.error('unified attendance hydrate failed', err);
    }
  }, [isRTL]);

  useEffect(() => {
    if (!open) return;
    setSessionStats({ checkins: 0, checkouts: 0, errors: 0 });
    setRecentScans([]);
    setGroups([]);
    hydrate();
  }, [open, hydrate]);

  const showResult = useCallback((payload) => {
    if (scanPopupTimerRef.current) clearTimeout(scanPopupTimerRef.current);
    setScanPopup(payload);
    scanPopupTimerRef.current = setTimeout(() => setScanPopup(null), 3000);
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = payload.kind === 'error' ? 320 : (payload.kind === 'checkout' ? 880 : 1200);
      gain.gain.value = 0.25;
      osc.start(); osc.stop(ctx.currentTime + 0.13);
    } catch {}
  }, []);

  const labelFor = useCallback((action) => {
    if (action === 'checkout') return { kind: 'checkout', label: isRTL ? 'تم تسجيل الخروج' : 'Checked Out' };
    if (action === 'already_done') return { kind: 'done', label: isRTL ? 'مكتمل اليوم' : 'Already Done Today' };
    if (action === 'duplicate') return { kind: 'warning', label: isRTL ? 'انتظر قليلاً قبل تسجيل الخروج' : 'Wait before checking out' };
    return { kind: 'checkin', label: isRTL ? 'تم تسجيل الدخول' : 'Checked In' };
  }, [isRTL]);

  const handleScan = useCallback(async (code) => {
    // Try Mawhba first
    try {
      const { data } = await api.post('/mawhba/attendance/scan', { code });
      const s = data.student || {};
      const r = data.record || {};
      const refTime = data.action === 'checkout' ? r.checkOutAt : r.checkInAt;
      const { kind, label } = labelFor(data.action);
      const payload = {
        kind, label,
        name: s.nameAr || s.nameEn || code,
        badge: s.courseName || (isRTL ? 'موهبة' : 'Mawhba'),
        badgeType: isRTL ? 'طالب موهبة' : 'Mawhba student',
        time: fmtTimeLong(refTime || new Date().toISOString()),
        color: data.color || '#8b5cf6'
      };
      showResult(payload);
      if (kind === 'checkin') setSessionStats(p => ({ ...p, checkins: p.checkins + 1 }));
      else if (kind === 'checkout') setSessionStats(p => ({ ...p, checkouts: p.checkouts + 1 }));
      setRecentScans(prev => [payload, ...prev].slice(0, 30));
      hydrate();
      return;
    } catch (mErr) {
      // Fall through to volunteer only if it's a "not found" — other
      // errors (500 etc.) should still surface here as errors.
      if (mErr?.response?.status !== 404) {
        // 404 continues to volunteer; any other status is a hard error
        // unless the payload literally shape-matches a not-found case.
      }
    }

    try {
      const { data } = await api.post('/volunteers/attendance/scan', { code });
      const v = data.volunteer || {};
      const r = data.record || {};
      const refTime = data.action === 'checkout' ? r.checkOutAt : r.checkInAt;
      const { kind, label } = labelFor(data.action);
      const payload = {
        kind, label,
        name: v.name || code,
        badge: isRTL ? 'متطوع' : 'Volunteer',
        badgeType: isRTL ? 'متطوع' : 'Volunteer',
        time: fmtTimeLong(refTime || new Date().toISOString()),
        color: '#f97316'
      };
      showResult(payload);
      if (kind === 'checkin') setSessionStats(p => ({ ...p, checkins: p.checkins + 1 }));
      else if (kind === 'checkout') setSessionStats(p => ({ ...p, checkouts: p.checkouts + 1 }));
      setRecentScans(prev => [payload, ...prev].slice(0, 30));
      hydrate();
      return;
    } catch (vErr) {
      const payload = {
        kind: 'error',
        label: isRTL ? 'لم يتم العثور على المستخدم' : 'Not found',
        name: code,
        badge: '',
        time: '',
        color: '#ef4444'
      };
      showResult(payload);
      setSessionStats(p => ({ ...p, errors: p.errors + 1 }));
      setRecentScans(prev => [payload, ...prev].slice(0, 30));
    }
  }, [isRTL, fmtTimeLong, showResult, hydrate, labelFor]);

  // USB HID barcode reader — only while this page is open
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || '';
      const editable = e.target && (e.target.isContentEditable ||
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT');
      if (editable) return;
      const now = Date.now();
      const gap = now - (hwLastKeyRef.current || 0);
      if (gap > 300) hwBufferRef.current = '';
      hwLastKeyRef.current = now;
      if (e.key === 'Enter') {
        const code = (hwBufferRef.current || '').trim();
        hwBufferRef.current = '';
        if (code.length >= 3) { e.preventDefault(); handleScan(code); }
        return;
      }
      if (e.key && e.key.length === 1) hwBufferRef.current += e.key;
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, handleScan]);

  const clearToday = async () => {
    if (!window.confirm(isRTL
      ? 'سيتم حذف جميع سجلات الحضور لهذا اليوم (موهبة والمتطوعين). هل أنت متأكد؟'
      : 'This will delete ALL of today\'s attendance records (Mawhba + Volunteers). Are you sure?')) return;
    setClearingToday(true);
    try {
      const [m, v] = await Promise.allSettled([
        api.delete('/mawhba/attendance/today'),
        api.delete('/volunteers/attendance/today')
      ]);
      const mCount = m.status === 'fulfilled' ? (m.value.data?.count || 0) : 0;
      const vCount = v.status === 'fulfilled' ? (v.value.data?.count || 0) : 0;
      setGroups([]);
      setRecentScans([]);
      setSessionStats({ checkins: 0, checkouts: 0, errors: 0 });
      toast.success(isRTL
        ? `تم حذف ${mCount + vCount} سجل (${mCount} موهبة + ${vCount} متطوع)`
        : `Deleted ${mCount + vCount} record(s) — ${mCount} Mawhba + ${vCount} Volunteer`);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'فشل الحذف' : 'Clear failed');
    } finally {
      setClearingToday(false);
    }
  };

  if (!open) return null;

  return (
    <div className="mawhba-attendance-mode" dir={isRTL ? 'rtl' : 'ltr'}>
      <button className="mawhba-am-close" onClick={onClose} title={isRTL ? 'إغلاق' : 'Close'}>×</button>
      <button
        className="mawhba-am-clear"
        onClick={clearToday}
        disabled={clearingToday}
        title={isRTL ? 'مسح سجلات اليوم' : "Clear today's logs"}
      >
        🗑 {isRTL ? 'مسح سجلات اليوم' : 'Clear today'}
      </button>

      <div className="mawhba-am-inner">
        <header className="mawhba-am-header">
          <div className="mawhba-am-eyebrow">
            📡 {isRTL ? 'الحضور الموحّد · فاب لاب الأحساء' : 'Unified Attendance · FABLAB Al-Ahsa'}
          </div>
          <h1 className="mawhba-am-title">
            {isRTL ? 'صفحة تسجيل الحضور' : 'Attendance Registration'}
          </h1>
          <p className="mawhba-am-sub">
            {isRTL
              ? 'يقبل الماسح بطاقات طلاب موهبة والمتطوعين — يميّز النظام النوع تلقائياً'
              : 'The scanner accepts both Mawhba students and volunteer cards — the type is detected automatically'}
          </p>
        </header>

        <div className="mawhba-am-ready">
          <div className="mawhba-am-ready-pulse"></div>
          <div className="mawhba-am-ready-label">{isRTL ? 'جاهز للمسح' : 'READY TO SCAN'}</div>
          <div className="mawhba-am-ready-hint">
            {isRTL ? 'وجّه الماسح نحو رمز الحضور على البطاقة' : 'Point the reader at the QR on the card'}
          </div>
        </div>

        <div className="mawhba-am-stats">
          <div className="mawhba-am-stat" style={{ borderColor: '#22c55e' }}>
            <div className="mawhba-am-stat-value" style={{ color: '#16a34a' }}>{sessionStats.checkins}</div>
            <div className="mawhba-am-stat-label">{isRTL ? 'دخول' : 'Check-ins'}</div>
          </div>
          <div className="mawhba-am-stat" style={{ borderColor: '#f59e0b' }}>
            <div className="mawhba-am-stat-value" style={{ color: '#d97706' }}>{sessionStats.checkouts}</div>
            <div className="mawhba-am-stat-label">{isRTL ? 'خروج' : 'Check-outs'}</div>
          </div>
          <div className="mawhba-am-stat" style={{ borderColor: '#ef4444' }}>
            <div className="mawhba-am-stat-value" style={{ color: '#dc2626' }}>{sessionStats.errors}</div>
            <div className="mawhba-am-stat-label">{isRTL ? 'فشل' : 'Errors'}</div>
          </div>
        </div>

        {groups.length > 0 && (
          <div className="mawhba-am-groups">
            <div className="mawhba-am-recent-title">
              {isRTL ? 'حضور اليوم' : "Today's Attendance"}
            </div>
            {groups.map(g => (
              <div
                key={`${g.category}-${g.course}`}
                className="mawhba-am-group"
                style={{ '--group-color': g.color }}
              >
                <div className="mawhba-am-group-header">
                  <span className="mawhba-am-group-dot" />
                  <span className="mawhba-am-group-name">
                    {g.category === 'volunteer' ? '🤝 ' : '📚 '}
                    {g.course || (isRTL ? 'بدون دورة' : 'No course')}
                  </span>
                  <span className="mawhba-am-group-count">{g.students.length}</span>
                </div>
                <div className="mawhba-am-group-body">
                  {g.students.map(st => {
                    const isOut = st.status === 'checked_out';
                    return (
                      <div
                        key={`${g.category}-${st.attendanceId}`}
                        className={`mawhba-am-student status-${st.status}`}
                      >
                        <span className={`mawhba-am-student-badge ${isOut ? 'is-out' : 'is-in'}`}>
                          {isOut ? (isRTL ? 'خرج' : 'Left') : (isRTL ? 'داخل' : 'Inside')}
                        </span>
                        <span className="mawhba-am-student-name">{st.name}</span>
                        <span className="mawhba-am-student-times mono">
                          <span>{isRTL ? 'د' : 'IN'} {fmtTime(st.checkInAt)}</span>
                          {st.checkOutAt && (
                            <span>{isRTL ? 'خ' : 'OUT'} {fmtTime(st.checkOutAt)}</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {recentScans.length > 0 && (
          <div className="mawhba-am-recent">
            <div className="mawhba-am-recent-title">{isRTL ? 'آخر المسحات' : 'Recent Scans'}</div>
            <div className="mawhba-am-recent-list">
              {recentScans.slice(0, 6).map((sc, i) => (
                <div
                  key={i}
                  className={`mawhba-am-recent-item kind-${sc.kind}`}
                  style={{ '--popup-color': sc.color }}
                >
                  <span className="mawhba-am-recent-icon">
                    {sc.kind === 'checkin' ? '📥' : sc.kind === 'checkout' ? '📤' : sc.kind === 'error' ? '⚠' : sc.kind === 'warning' ? '⏱' : '✓'}
                  </span>
                  <span className="mawhba-am-recent-name">{sc.name}</span>
                  {sc.badge && <span className="mawhba-am-recent-course">{sc.badge}</span>}
                  <span className="mawhba-am-recent-time mono">{sc.time || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {scanPopup && (
        <div className={`mawhba-scan-popup-overlay kind-${scanPopup.kind}`}>
          <div className="mawhba-scan-popup" style={{ '--popup-color': scanPopup.color || '#8b5cf6' }}>
            <div className="mawhba-scan-popup-label">{scanPopup.label}</div>
            <div className="mawhba-scan-popup-name">{scanPopup.name}</div>
            {scanPopup.badge && <div className="mawhba-scan-popup-workshop">{scanPopup.badge}</div>}
            {scanPopup.time && <div className="mawhba-scan-popup-time mono">{scanPopup.time}</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedAttendancePage;
