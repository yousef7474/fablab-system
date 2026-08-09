import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import api from '../../config/api';
import '../Mawhba/Mawhba.css';
import './AttendanceStation.css';

// One attendance page for both Mawhba students and Volunteers.
// The USB HID barcode reader listener runs while this component is
// mounted with open=true. Each scanned code is tried against Mawhba
// first (course-based color grouping) and falls back to Volunteer
// if not found (single orange "Volunteers" group).

// Marker written to the URL hash while the attendance station is open.
// A page refresh keeps the hash, so the station re-opens itself even
// though the parent's `open` state has just been reset to false. This
// is what makes F5 not close the kiosk.
const HASH = '#attendance';

const UnifiedAttendancePage = ({ open, onClose, isRTL }) => {
  // The station renders whenever either the parent asks (open prop)
  // OR the URL hash says the kiosk was open before refresh.
  const [selfOpen, setSelfOpen] = useState(() =>
    typeof window !== 'undefined' && window.location.hash === HASH
  );
  const isOpen = open || selfOpen;

  const [groups, setGroups] = useState([]);
  const [sessionStats, setSessionStats] = useState({ checkins: 0, checkouts: 0, errors: 0 });
  const [recentScans, setRecentScans] = useState([]);
  const [scanPopup, setScanPopup] = useState(null);
  const [clearingToday, setClearingToday] = useState(false);
  const [now, setNow] = useState(new Date());
  const hwBufferRef = useRef('');
  const hwLastKeyRef = useRef(0);
  const scanPopupTimerRef = useRef(null);

  // Keep the URL hash in sync with the visible state.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = window.location.pathname + window.location.search;
    if (isOpen && window.location.hash !== HASH) {
      window.history.replaceState(null, '', url + HASH);
    } else if (!isOpen && window.location.hash === HASH) {
      window.history.replaceState(null, '', url);
    }
  }, [isOpen]);

  // Bridge the parent's opening intent into selfOpen so a subsequent
  // manual close (which clears selfOpen) actually hides the station.
  useEffect(() => {
    if (open) setSelfOpen(true);
  }, [open]);

  // Live clock refreshed once per second while the station is open.
  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [isOpen]);

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
      const [m, v, s, i, su, tr] = await Promise.allSettled([
        api.get('/mawhba/attendance/today'),
        api.get('/volunteers/attendance/today'),
        api.get('/fablab-staff/attendance/today'),
        api.get('/interns/attendance/today'),
        api.get('/summer/attendance/today'),
        api.get('/trainer-assistants/attendance/today')
      ]);
      const mData  = m.status  === 'fulfilled' ? m.value.data  : null;
      const vData  = v.status  === 'fulfilled' ? v.value.data  : null;
      const sData  = s.status  === 'fulfilled' ? s.value.data  : null;
      const iData  = i.status  === 'fulfilled' ? i.value.data  : null;
      const suData = su.status === 'fulfilled' ? su.value.data : null;
      const trData = tr.status === 'fulfilled' ? tr.value.data : null;

      const combined = [];
      // FabLab staff first — they're the fixed team on-site
      if (Array.isArray(sData?.staff) && sData.staff.length > 0) {
        combined.push({
          category: 'staff',
          course: isRTL ? 'موظفو فاب لاب' : 'FabLab Staff',
          color: '#7c3aed',
          students: sData.staff
        });
      }
      // Assistant Trainers (مدرب معاون)
      if (Array.isArray(trData?.trainers) && trData.trainers.length > 0) {
        combined.push({
          category: 'trainer',
          course: isRTL ? 'المدربون المعاونون' : 'Assistant Trainers',
          color: '#059669',
          students: trData.trainers
        });
      }
      // Summer FabLab programs (per-program grouping like Mawhba courses)
      if (Array.isArray(suData?.groups)) {
        suData.groups.forEach(g => combined.push({
          category: 'summer',
          course: g.course,
          color: g.color,
          students: g.students
        }));
      }
      // Mawhba courses
      if (Array.isArray(mData?.groups)) {
        mData.groups.forEach(g => combined.push({
          category: 'mawhba',
          course: g.course,
          color: g.color,
          students: g.students
        }));
      }
      // Volunteers
      if (Array.isArray(vData?.volunteers) && vData.volunteers.length > 0) {
        combined.push({
          category: 'volunteer',
          course: isRTL ? 'المتطوعون' : 'Volunteers',
          color: '#f97316',
          students: vData.volunteers
        });
      }
      // University Training interns
      if (Array.isArray(iData?.trainees) && iData.trainees.length > 0) {
        combined.push({
          category: 'intern',
          course: isRTL ? 'التدريب الجامعي' : 'University Training',
          color: '#0ea5e9',
          students: iData.trainees
        });
      }
      setGroups(combined);

      const mStats  = mData?.stats  || { checkins: 0, checkouts: 0 };
      const vStats  = vData?.stats  || { checkins: 0, checkouts: 0 };
      const sStats  = sData?.stats  || { checkins: 0, checkouts: 0 };
      const iStats  = iData?.stats  || { checkins: 0, checkouts: 0 };
      const suStats = suData?.stats || { checkins: 0, checkouts: 0 };
      const trStats = trData?.stats || { checkins: 0, checkouts: 0 };
      setSessionStats(prev => ({
        checkins:  (mStats.checkins  || 0) + (vStats.checkins  || 0) + (sStats.checkins  || 0) + (iStats.checkins  || 0) + (suStats.checkins  || 0) + (trStats.checkins  || 0),
        checkouts: (mStats.checkouts || 0) + (vStats.checkouts || 0) + (sStats.checkouts || 0) + (iStats.checkouts || 0) + (suStats.checkouts || 0) + (trStats.checkouts || 0),
        errors: prev.errors
      }));
    } catch (err) {
      console.error('unified attendance hydrate failed', err);
    }
  }, [isRTL]);

  useEffect(() => {
    if (!isOpen) return;
    setSessionStats({ checkins: 0, checkouts: 0, errors: 0 });
    setRecentScans([]);
    setGroups([]);
    hydrate();
  }, [isOpen, hydrate]);

  // Auto-refresh the "today's attendance" board every 10s while the
  // kiosk is open, so numbers stay live across multiple screens and
  // any admin edits (manual add, checkout signing) show up without a
  // manual page refresh. Refreshes pause while the browser tab is
  // hidden to avoid useless traffic when the screen is off.
  useEffect(() => {
    if (!isOpen) return;
    const tick = () => { if (!document.hidden) hydrate(); };
    const id = setInterval(tick, 10000);
    // Also refresh immediately when the tab comes back to the front.
    const onVis = () => { if (!document.hidden) hydrate(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [isOpen, hydrate]);

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
    // Try Summer FabLab first — the busy program during summer, so
    // matching it first minimizes latency for the on-site scanner
    try {
      const { data } = await api.post('/summer/attendance/scan', { code });
      const s = data.student || {};
      const r = data.record || {};
      const refTime = data.action === 'checkout' ? r.checkOutAt : r.checkInAt;
      const { kind, label } = labelFor(data.action);
      const payload = {
        kind, label,
        name: s.name || code,
        badge: s.program?.name || (isRTL ? 'صيف فاب لاب' : 'Summer FabLab'),
        badgeType: isRTL ? 'طالب صيف فاب لاب' : 'Summer FabLab student',
        time: fmtTimeLong(refTime || new Date().toISOString()),
        color: data.color || '#f97316'
      };
      showResult(payload);
      if (kind === 'checkin') setSessionStats(p => ({ ...p, checkins: p.checkins + 1 }));
      else if (kind === 'checkout') setSessionStats(p => ({ ...p, checkouts: p.checkouts + 1 }));
      setRecentScans(prev => [payload, ...prev].slice(0, 30));
      hydrate();
      return;
    } catch (suErr) { /* fall through to Mawhba */ }

    // Try Mawhba
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
      else if (kind === 'checkout') {
        setSessionStats(p => ({ ...p, checkouts: p.checkouts + 1 }));
        // If the server auto-marked any opportunities based on the
        // visit's time overlap with their daily windows, surface the
        // list as a toast so the door operator sees what happened.
        if (Array.isArray(data.autoMarked) && data.autoMarked.length > 0) {
          const list = data.autoMarked
            .map(m => `${m.title} (${m.hours}h)`)
            .join('، ');
          toast.success(
            isRTL
              ? `تم تسجيل حضور تلقائي في: ${list}`
              : `Auto-marked in: ${list}`,
            { autoClose: 6000 }
          );
        }
      }
      setRecentScans(prev => [payload, ...prev].slice(0, 30));
      hydrate();
      return;
    } catch (vErr) {
      // fall through to staff
    }

    try {
      const { data } = await api.post('/fablab-staff/attendance/scan', { code });
      const st = data.staff || {};
      const r = data.record || {};
      const refTime = data.action === 'checkout' ? r.checkOutAt : r.checkInAt;
      const { kind, label } = labelFor(data.action);
      const payload = {
        kind, label,
        name: st.name || code,
        badge: st.position || (isRTL ? 'موظف' : 'Staff'),
        badgeType: isRTL ? 'موظف فاب لاب' : 'FabLab staff',
        time: fmtTimeLong(refTime || new Date().toISOString()),
        color: '#7c3aed'
      };
      showResult(payload);
      if (kind === 'checkin') setSessionStats(p => ({ ...p, checkins: p.checkins + 1 }));
      else if (kind === 'checkout') setSessionStats(p => ({ ...p, checkouts: p.checkouts + 1 }));
      setRecentScans(prev => [payload, ...prev].slice(0, 30));
      hydrate();
      return;
    } catch (sErr) {
      // fall through to intern (University Training)
    }

    try {
      const { data } = await api.post('/interns/attendance/scan', { code });
      const it = data.intern || {};
      const r = data.record || {};
      const refTime = data.action === 'checkout' ? r.checkOutAt : r.checkInAt;
      const { kind, label } = labelFor(data.action);
      const payload = {
        kind, label,
        name: it.name || code,
        badge: it.university || (isRTL ? 'تدريب جامعي' : 'University Training'),
        badgeType: isRTL ? 'متدرب جامعي' : 'University trainee',
        time: fmtTimeLong(refTime || new Date().toISOString()),
        color: '#0ea5e9'
      };
      showResult(payload);
      if (kind === 'checkin') setSessionStats(p => ({ ...p, checkins: p.checkins + 1 }));
      else if (kind === 'checkout') setSessionStats(p => ({ ...p, checkouts: p.checkouts + 1 }));
      setRecentScans(prev => [payload, ...prev].slice(0, 30));
      hydrate();
      return;
    } catch (iErr) {
      // fall through to trainer-assistant
    }

    try {
      const { data } = await api.post('/trainer-assistants/attendance/scan', { code });
      const tr = data.trainer || {};
      const r = data.record || {};
      const refTime = data.action === 'checkout' ? r.checkOutAt : r.checkInAt;
      const { kind, label } = labelFor(data.action);
      const payload = {
        kind, label,
        name: tr.name || code,
        badge: isRTL ? 'مدرب معاون' : 'Assistant Trainer',
        badgeType: isRTL ? 'مدرب معاون' : 'Assistant Trainer',
        time: fmtTimeLong(refTime || new Date().toISOString()),
        color: '#059669'
      };
      showResult(payload);
      if (kind === 'checkin') setSessionStats(p => ({ ...p, checkins: p.checkins + 1 }));
      else if (kind === 'checkout') setSessionStats(p => ({ ...p, checkouts: p.checkouts + 1 }));
      setRecentScans(prev => [payload, ...prev].slice(0, 30));
      hydrate();
      return;
    } catch (trErr) {
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
    if (!isOpen) return undefined;
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
      ? 'سيتم حذف جميع سجلات الحضور لهذا اليوم لكل الأقسام. هل أنت متأكد؟'
      : 'This will delete ALL of today\'s attendance records across all sections. Are you sure?')) return;
    setClearingToday(true);
    try {
      const [m, v, s, i, su, tr] = await Promise.allSettled([
        api.delete('/mawhba/attendance/today'),
        api.delete('/volunteers/attendance/today'),
        api.delete('/fablab-staff/attendance/today'),
        api.delete('/interns/attendance/today'),
        api.delete('/summer/attendance/today'),
        api.delete('/trainer-assistants/attendance/today')
      ]);
      const mCount  = m.status  === 'fulfilled' ? (m.value.data?.count  || 0) : 0;
      const vCount  = v.status  === 'fulfilled' ? (v.value.data?.count  || 0) : 0;
      const sCount  = s.status  === 'fulfilled' ? (s.value.data?.count  || 0) : 0;
      const iCount  = i.status  === 'fulfilled' ? (i.value.data?.count  || 0) : 0;
      const suCount = su.status === 'fulfilled' ? (su.value.data?.count || 0) : 0;
      const trCount = tr.status === 'fulfilled' ? (tr.value.data?.count || 0) : 0;
      const total   = mCount + vCount + sCount + iCount + suCount + trCount;
      setGroups([]);
      setRecentScans([]);
      setSessionStats({ checkins: 0, checkouts: 0, errors: 0 });
      toast.success(isRTL
        ? `تم حذف ${total} سجل`
        : `Deleted ${total} record(s)`);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'فشل الحذف' : 'Clear failed');
    } finally {
      setClearingToday(false);
    }
  };

  if (!isOpen) return null;

  // Wraps the parent's onClose so the URL hash is cleared and our
  // internal open state resets in the same call. Passed to every
  // "close the kiosk" trigger (X button, background click if any).
  const handleClose = () => {
    setSelfOpen(false);
    if (typeof window !== 'undefined' && window.location.hash === HASH) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    if (typeof onClose === 'function') onClose();
  };

  const clockTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  const clockDate = new Intl.DateTimeFormat(isRTL ? 'ar-SA-u-ca-gregory' : 'en-GB', {
    weekday: 'long', day: 'numeric', month: 'long'
  }).format(now);

  const categoryIcon = (cat) => ({
    volunteer: '🤝',
    staff: '👥',
    trainer: '🎓',
    intern: '🎒',
    summer: '☀️',
    mawhba: '📚'
  })[cat] || '👤';

  const scanIcon = (kind) => ({
    checkin: '📥', checkout: '📤', error: '⚠', warning: '⏱', done: '✓'
  })[kind] || '✓';

  return (
    <div className="as-shell" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="as-wrap">
        {/* Top bar */}
        <div className="as-topbar">
          <div className="as-brand">
            <div className="as-brand-mark">FL</div>
            <div className="as-brand-text">
              <b>{isRTL ? 'فاب لاب الأحساء' : 'FABLAB Al-Ahsa'}</b>
              <span>{isRTL ? 'محطة الحضور الموحّدة' : 'Unified Attendance Station'}</span>
            </div>
          </div>
          <div className="as-clock">
            {clockTime}
            <span className="as-clock-date">{clockDate}</span>
          </div>
          <div className="as-topbar-actions">
            <button
              className="as-btn as-btn-danger"
              onClick={clearToday}
              disabled={clearingToday}
              title={isRTL ? 'مسح سجلات اليوم' : "Clear today's logs"}
            >
              🗑 {isRTL ? 'مسح سجلات اليوم' : 'Clear today'}
            </button>
            <button className="as-btn as-btn-close" onClick={handleClose}>
              ✕
            </button>
          </div>
        </div>

        {/* Hero: READY panel + stats */}
        <div className="as-hero">
          <div className="as-ready">
            <div className="as-ready-kicker">
              <span className="as-live-dot" />
              {isRTL ? 'مباشر · تحديث تلقائي كل ١٠ ثوان' : 'LIVE · auto-refresh every 10s'}
            </div>
            <div className="as-ready-pulse" />
            <div className="as-ready-label">
              {isRTL ? 'جاهز للمسح' : 'READY TO SCAN'}
            </div>
            <div className="as-ready-hint">
              {isRTL
                ? 'وجّه الماسح نحو رمز QR على أي بطاقة — متطوع، موظف، مدرب، متدرب أو طالب. سيتم تصنيف المسح تلقائياً.'
                : 'Point the scanner at any QR badge — volunteer, staff, trainer, intern or student. The scan will be categorized automatically.'}
            </div>
          </div>
          <div className="as-stats">
            <div className="as-stat checkin">
              <span className="as-stat-label">{isRTL ? 'حالات دخول' : 'Check-ins'}</span>
              <span className="as-stat-value">{sessionStats.checkins}</span>
            </div>
            <div className="as-stat checkout">
              <span className="as-stat-label">{isRTL ? 'حالات خروج' : 'Check-outs'}</span>
              <span className="as-stat-value">{sessionStats.checkouts}</span>
            </div>
            <div className="as-stat error">
              <span className="as-stat-label">{isRTL ? 'فشل التعرف' : 'Not found'}</span>
              <span className="as-stat-value">{sessionStats.errors}</span>
            </div>
          </div>
        </div>

        {/* Recent scans */}
        {recentScans.length > 0 && (
          <div className="as-recent">
            <h3 className="as-section-title">
              {isRTL ? 'آخر المسحات' : 'Recent Scans'}
            </h3>
            <div className="as-recent-grid">
              {recentScans.slice(0, 8).map((sc, i) => (
                <div
                  key={i}
                  className="as-recent-card"
                  style={{ '--recent-color': sc.color }}
                >
                  <div className="as-recent-top">
                    <span>{scanIcon(sc.kind)}</span>
                    <span>
                      {sc.kind === 'checkin' && (isRTL ? 'دخول' : 'CHECK-IN')}
                      {sc.kind === 'checkout' && (isRTL ? 'خروج' : 'CHECK-OUT')}
                      {sc.kind === 'error' && (isRTL ? 'غير موجود' : 'NOT FOUND')}
                      {sc.kind === 'warning' && (isRTL ? 'تنبيه' : 'WAIT')}
                      {sc.kind === 'done' && (isRTL ? 'تم' : 'DONE')}
                    </span>
                  </div>
                  <div className="as-recent-name">{sc.name}</div>
                  <div className="as-recent-meta">
                    <span>{sc.badge || '—'}</span>
                    <span className="as-recent-time">{sc.time || '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today's attendance grouped by category */}
        <h3 className="as-section-title" style={{ marginTop: 8 }}>
          {isRTL ? 'حضور اليوم' : "Today's Attendance"}
        </h3>
        {groups.length === 0 ? (
          <div className="as-empty">
            {isRTL ? 'لا توجد سجلات حضور بعد اليوم.' : 'No attendance records yet today.'}
          </div>
        ) : (
          <div className="as-groups">
            {groups.map(g => (
              <div
                key={`${g.category}-${g.course}`}
                className="as-group"
                style={{ '--group-color': g.color }}
              >
                <div className="as-group-header">
                  <div className="as-group-left">
                    <span className="as-group-dot" />
                    <span className="as-group-name">
                      {categoryIcon(g.category)} {g.course || (isRTL ? 'بدون قسم' : 'Uncategorized')}
                    </span>
                  </div>
                  <span className="as-group-count">{g.students.length}</span>
                </div>
                <div className="as-group-body">
                  {g.students.map(st => {
                    const isOut = st.status === 'checked_out';
                    return (
                      <div key={`${g.category}-${st.attendanceId}`} className="as-row">
                        <span className={`as-row-badge ${isOut ? 'is-out' : 'is-in'}`}>
                          {isOut ? (isRTL ? 'خرج' : 'Out') : (isRTL ? 'داخل' : 'In')}
                        </span>
                        <span className="as-row-name">{st.name}</span>
                        <span className="as-row-times">
                          <span>{isRTL ? 'د' : 'IN'} <b>{fmtTime(st.checkInAt)}</b></span>
                          {st.checkOutAt && (
                            <span>{isRTL ? 'خ' : 'OUT'} <b>{fmtTime(st.checkOutAt)}</b></span>
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
      </div>

      {/* Full-screen scan popup */}
      {scanPopup && (
        <div className="as-popup-overlay" onClick={() => setScanPopup(null)}>
          <div
            className="as-popup"
            style={{ '--popup-color': scanPopup.color || '#4ade80' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="as-popup-icon">{scanIcon(scanPopup.kind)}</div>
            <div className="as-popup-label">{scanPopup.label}</div>
            <div className="as-popup-name">{scanPopup.name}</div>
            {scanPopup.badge && <div className="as-popup-badge">{scanPopup.badge}</div>}
            {scanPopup.time && <div className="as-popup-time">{scanPopup.time}</div>}
            <div className="as-popup-fadebar"><div /></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedAttendancePage;
