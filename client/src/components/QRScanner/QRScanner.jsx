import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Html5Qrcode } from 'html5-qrcode';
import './QRScanner.css';

const QRScanner = ({ onClose }) => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [welcome, setWelcome] = useState(null);
  const scannerRef = useRef(null);
  const welcomeTimerRef = useRef(null);
  const cooldownRef = useRef(false);

  const showWelcome = useCallback((data) => {
    if (cooldownRef.current) return;
    cooldownRef.current = true;

    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      setWelcome(parsed);

      // Auto-close after 7 seconds, then ready for next scan
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
      try {
        html5Qr = new Html5Qrcode(scannerId);
        scannerRef.current = html5Qr;

        await html5Qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
          (decodedText) => {
            showWelcome(decodedText);
          },
          () => {} // ignore errors (no QR found in frame)
        );
      } catch (err) {
        console.error('Scanner start error:', err);
        // Try any available camera
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            html5Qr = new Html5Qrcode(scannerId);
            scannerRef.current = html5Qr;
            await html5Qr.start(
              devices[0].id,
              { fps: 10, qrbox: { width: 250, height: 250 } },
              (decodedText) => {
                showWelcome(decodedText);
              },
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
  }, [showWelcome]);

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
          <button className="qr-scanner-close" onClick={handleClose}>×</button>
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
