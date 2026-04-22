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

      // Fetch color from API if missing
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
      cooldownRef.current = false;
    }
  }, []);

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
