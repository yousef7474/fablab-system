import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../../config/api';
import './QRScanner.css';

const QRScanner = ({ onClose }) => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [welcome, setWelcome] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const scannerRef = useRef(null);
  const welcomeTimerRef = useRef(null);
  const cooldownRef = useRef(false);

  const showWelcome = useCallback(async (data) => {
    if (cooldownRef.current) return;
    cooldownRef.current = true;

    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;

      // If no color in QR data, fetch from API
      if (!parsed.color && parsed.studentId) {
        try {
          const res = await api.get(`/workshops/students/${parsed.studentId}/attendance-id`);
          if (res.data.workshop?.color) {
            parsed.color = res.data.workshop.color;
          }
        } catch (e) {}
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

  useEffect(() => {
    const scannerId = 'qr-reader';
    let html5Qr = null;

    const startScanner = async () => {
      // Stop previous instance if switching camera
      if (scannerRef.current) {
        try { await scannerRef.current.stop(); } catch(e) {}
        try { scannerRef.current.clear(); } catch(e) {}
      }

      try {
        html5Qr = new Html5Qrcode(scannerId);
        scannerRef.current = html5Qr;

        await html5Qr.start(
          { facingMode },
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
          (decodedText) => {
            showWelcome(decodedText);
          },
          () => {}
        );
      } catch (err) {
        console.error('Scanner start error:', err);
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            html5Qr = new Html5Qrcode(scannerId);
            scannerRef.current = html5Qr;
            await html5Qr.start(
              devices[0].id,
              { fps: 10, qrbox: { width: 250, height: 250 } },
              (decodedText) => { showWelcome(decodedText); },
              () => {}
            );
          }
        } catch (e2) {
          console.error('Fallback camera error:', e2);
        }
      }
    };

    startScanner();

    return () => {
      if (welcomeTimerRef.current) clearTimeout(welcomeTimerRef.current);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, [showWelcome, facingMode]);

  const handleClose = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
    }
    onClose();
  };

  return (
    <div className="qr-scanner-overlay">
      <div className="qr-scanner-modal">
        {/* Header */}
        <div className="qr-scanner-header">
          <h3>{isRTL ? 'مسح بطاقة الحضور' : 'Scan Attendance ID'}</h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button onClick={() => setFacingMode(f => f === 'environment' ? 'user' : 'environment')}
              style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '0.4rem 0.7rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2"><path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/><path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5"/><circle cx="12" cy="12" r="3"/><path d="m18 22-3-3 3-3"/><path d="m6 2 3 3-3 3"/></svg>
              {facingMode === 'environment' ? (isRTL ? 'أمامية' : 'Front') : (isRTL ? 'خلفية' : 'Rear')}
            </button>
            <button className="qr-scanner-close" onClick={handleClose}>×</button>
          </div>
        </div>

        {/* Camera */}
        <div style={{ position: 'relative' }}>
          <div id="qr-reader" style={{ width: '100%' }} />
          {!welcome && (
            <p className="qr-scanner-hint">
              {isRTL ? 'وجّه الكاميرا نحو رمز QR' : 'Point camera at QR code'}
            </p>
          )}
        </div>

        {/* Welcome Popup */}
        {welcome && (
          <div
            className="qr-welcome-popup"
            style={{ borderColor: welcome.color || '#1a56db', '--ws-color': welcome.color || '#1a56db' }}
          >
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
