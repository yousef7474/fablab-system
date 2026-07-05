import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../../config/api';
import './QRScanner.css';

const QRScanner = ({ onClose }) => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [welcome, setWelcome] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null);
  const welcomeTimerRef = useRef(null);
  const cooldownRef = useRef(false);

  // Get available cameras on mount
  useEffect(() => {
    Html5Qrcode.getCameras().then(devices => {
      setCameras(devices || []);
      if (devices.length > 0) {
        // Prefer back/external camera
        const back = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear') || d.label.toLowerCase().includes('environment'));
        setSelectedCamera(back ? back.id : devices[devices.length - 1].id);
      }
    }).catch(err => console.error('Camera list error:', err));

    return () => {
      if (welcomeTimerRef.current) clearTimeout(welcomeTimerRef.current);
      stopScanner();
    };
  }, []);

  // Start scanning when camera is selected
  useEffect(() => {
    if (selectedCamera) startScanner(selectedCamera);
    return () => stopScanner();
  }, [selectedCamera]);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      try { scannerRef.current.clear(); } catch {}
      scannerRef.current = null;
      setScanning(false);
    }
  };

  const startScanner = async (cameraId) => {
    await stopScanner();
    await new Promise(r => setTimeout(r, 300));

    const el = document.getElementById('qr-reader');
    if (!el) return;

    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        cameraId,
        {
          fps: 25,
          qrbox: undefined, // scan entire frame
          aspectRatio: 1.5,
          disableFlip: false,
          videoConstraints: {
            deviceId: cameraId,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            focusMode: 'continuous'
          }
        },
        (decodedText, result) => handleScan(decodedText),
        () => {}
      );
      setScanning(true);
    } catch (err) {
      console.error('Scanner error:', err);
    }
  };

  const handleScan = useCallback(async (data) => {
    if (cooldownRef.current) return;
    cooldownRef.current = true;

    // Play beep sound
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 1200;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}

    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;

      // Handle education QR codes - auto-mark attendance
      if (parsed.type === 'education' && parsed.studentId && parsed.educationId) {
        try {
          const res = await api.post('/education/attendance/mark', {
            studentId: parsed.studentId,
            educationId: parsed.educationId
          });
          parsed.name = parsed.fullName || res.data.student?.fullName || parsed.name || '';
          parsed.color = '#6d28d9';
          if (res.data.alreadyMarked) {
            parsed.workshop = isRTL ? `مسجل مسبقاً (دخول: ${res.data.checkInTime || '?'} | خروج: ${res.data.checkOutTime || '?'})` : 'Already checked in & out';
            parsed.color = '#f59e0b';
          } else if (res.data.action === 'checkout') {
            parsed.workshop = isRTL ? `📤 تسجيل خروج ${res.data.checkOutTime}` : `📤 Checked out ${res.data.checkOutTime}`;
            parsed.color = '#f59e0b';
          } else {
            parsed.workshop = isRTL ? `📥 تسجيل دخول ${res.data.time}` : `📥 Checked in ${res.data.time}`;
            parsed.color = '#22c55e';
          }
        } catch (err) {
          parsed.name = parsed.fullName || '';
          parsed.workshop = err.response?.data?.message || 'Error';
          parsed.color = '#ef4444';
        }

        setWelcome(parsed);
        if (welcomeTimerRef.current) clearTimeout(welcomeTimerRef.current);
        welcomeTimerRef.current = setTimeout(() => {
          setWelcome(null);
          cooldownRef.current = false;
        }, 7000);
        return;
      }

      // Fetch color from API if missing (workshop QR codes)
      if (!parsed.color && parsed.studentId) {
        try {
          const res = await api.get(`/workshops/students/${parsed.studentId}/attendance-id`);
          if (res.data.workshop?.color) parsed.color = res.data.workshop.color;
        } catch {}
      }

      setWelcome(parsed);

      if (welcomeTimerRef.current) clearTimeout(welcomeTimerRef.current);
      welcomeTimerRef.current = setTimeout(() => {
        setWelcome(null);
        cooldownRef.current = false;
      }, 7000);
    } catch {
      // Not JSON — fall back to Mawhba card lookup (plain-text national ID)
      const raw = typeof data === 'string' ? data.trim() : '';
      if (/^\d{6,15}$/.test(raw)) {
        try {
          const res = await api.post('/mawhba/attendance/scan', { code: raw });
          const s = res.data.student || {};
          const action = res.data.action;
          const rec = res.data.record || {};
          const fmt = (iso) => {
            if (!iso) return '';
            const d = new Date(iso);
            const pad = (n) => String(n).padStart(2, '0');
            return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
          };
          let workshop = '';
          let color = '#8b5cf6';
          if (action === 'checkin') {
            workshop = isRTL ? `📥 تسجيل دخول ${fmt(rec.checkInAt)}` : `📥 Checked in ${fmt(rec.checkInAt)}`;
            color = '#22c55e';
          } else if (action === 'checkout') {
            workshop = isRTL ? `📤 تسجيل خروج ${fmt(rec.checkOutAt)}` : `📤 Checked out ${fmt(rec.checkOutAt)}`;
            color = '#f59e0b';
          } else if (action === 'already_done') {
            workshop = isRTL
              ? `تم تسجيل الحضور والانصراف اليوم (${fmt(rec.checkInAt)} → ${fmt(rec.checkOutAt)})`
              : `Already checked in & out today (${fmt(rec.checkInAt)} → ${fmt(rec.checkOutAt)})`;
            color = '#64748b';
          } else if (action === 'duplicate') {
            workshop = isRTL ? 'انتظر قليلاً قبل تسجيل الخروج' : 'Wait a moment before checking out';
            color = '#f59e0b';
          }
          setWelcome({
            name: s.nameAr || s.nameEn || raw,
            workshop,
            color,
            phone: s.studentPhone || ''
          });
          if (welcomeTimerRef.current) clearTimeout(welcomeTimerRef.current);
          welcomeTimerRef.current = setTimeout(() => {
            setWelcome(null);
            cooldownRef.current = false;
          }, 6000);
          return;
        } catch (mawhbaErr) {
          // Not a Mawhba student — try a volunteer next before giving up
          try {
            const vRes = await api.post('/volunteers/attendance/scan', { code: raw });
            const v = vRes.data.volunteer || {};
            const action = vRes.data.action;
            const rec = vRes.data.record || {};
            const fmt = (iso) => {
              if (!iso) return '';
              const d = new Date(iso);
              const pad = (n) => String(n).padStart(2, '0');
              return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
            };
            let workshop = '';
            let color = '#f97316';
            if (action === 'checkin') {
              workshop = isRTL ? `📥 تسجيل دخول ${fmt(rec.checkInAt)}` : `📥 Checked in ${fmt(rec.checkInAt)}`;
              color = '#22c55e';
            } else if (action === 'checkout') {
              workshop = isRTL ? `📤 تسجيل خروج ${fmt(rec.checkOutAt)}` : `📤 Checked out ${fmt(rec.checkOutAt)}`;
              color = '#f59e0b';
            } else if (action === 'already_done') {
              workshop = isRTL
                ? `تم تسجيل الحضور والانصراف اليوم (${fmt(rec.checkInAt)} → ${fmt(rec.checkOutAt)})`
                : `Already checked in & out today (${fmt(rec.checkInAt)} → ${fmt(rec.checkOutAt)})`;
              color = '#64748b';
            } else if (action === 'duplicate') {
              workshop = isRTL ? 'انتظر قليلاً قبل تسجيل الخروج' : 'Wait a moment before checking out';
              color = '#f59e0b';
            }
            setWelcome({ name: v.name || raw, workshop, color, phone: v.phone || '' });
            if (welcomeTimerRef.current) clearTimeout(welcomeTimerRef.current);
            welcomeTimerRef.current = setTimeout(() => {
              setWelcome(null);
              cooldownRef.current = false;
            }, 6000);
            return;
          } catch (volErr) {
            setWelcome({
              name: raw,
              workshop: volErr?.response?.data?.message
                || mawhbaErr?.response?.data?.message
                || (isRTL ? 'لم يتم العثور على الطالب أو المتطوع' : 'Student/volunteer not found'),
              color: '#ef4444'
            });
            if (welcomeTimerRef.current) clearTimeout(welcomeTimerRef.current);
            welcomeTimerRef.current = setTimeout(() => {
              setWelcome(null);
              cooldownRef.current = false;
            }, 5000);
            return;
          }
        }
      }
      cooldownRef.current = false;
    }
  }, [isRTL]);

  return (
    <div className="qr-scanner-overlay">
      <div className="qr-scanner-modal">
        {/* Header */}
        <div className="qr-scanner-header">
          <h3>{isRTL ? 'مسح بطاقة الحضور' : 'Scan Attendance ID'}</h3>
          <button className="qr-scanner-close" onClick={() => { stopScanner(); onClose(); }}>×</button>
        </div>

        {/* Camera Selector */}
        {cameras.length > 1 && (
          <div className="qr-camera-selector">
            <select
              value={selectedCamera}
              onChange={e => setSelectedCamera(e.target.value)}
            >
              {cameras.map((cam, i) => (
                <option key={cam.id} value={cam.id}>
                  {cam.label || `${isRTL ? 'كاميرا' : 'Camera'} ${i + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Scanner */}
        <div className="qr-scanner-view">
          <div id="qr-reader" />
          {scanning && !welcome && (
            <div className="qr-scan-overlay">
              <div className="qr-scan-corners">
                <div className="qr-corner tl" />
                <div className="qr-corner tr" />
                <div className="qr-corner bl" />
                <div className="qr-corner br" />
              </div>
              <div className="qr-scan-line" />
            </div>
          )}
        </div>

        {!scanning && !welcome && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
            {cameras.length === 0
              ? (isRTL ? 'لم يتم العثور على كاميرا' : 'No camera found')
              : (isRTL ? 'جاري تشغيل الكاميرا...' : 'Starting camera...')}
          </div>
        )}

        {/* Welcome Popup */}
        {welcome && (
          <div className="qr-welcome-popup" style={{ '--ws-color': welcome.color || '#1a56db' }}>
            <div className="qr-welcome-icon" style={{ background: welcome.color || '#1a56db' }}>✓</div>
            <h2 className="qr-welcome-title">
              {isRTL ? 'أهلاً وسهلاً في فاب لاب الأحساء' : 'Welcome to FABLAB Al-Ahsa'}
            </h2>
            <div className="qr-welcome-name">{welcome.name || ''}</div>
            <div className="qr-welcome-workshop" style={{ background: welcome.color || '#1a56db' }}>
              {welcome.workshop || ''}
            </div>
            {welcome.phone && <div className="qr-welcome-phone" dir="ltr">{welcome.phone}</div>}
            <div className="qr-welcome-bar" style={{ background: welcome.color || '#1a56db' }}>
              <div className="qr-welcome-bar-fill" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QRScanner;
