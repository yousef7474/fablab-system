import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Html5QrcodeScanner } from 'html5-qrcode';
import api from '../../config/api';
import './QRScanner.css';

const QRScanner = ({ onClose }) => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [welcome, setWelcome] = useState(null);
  const scannerRef = useRef(null);
  const welcomeTimerRef = useRef(null);
  const cooldownRef = useRef(false);

  const showWelcome = useCallback(async (data) => {
    if (cooldownRef.current) return;
    cooldownRef.current = true;

    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;

      if (!parsed.color && parsed.studentId) {
        try {
          const res = await api.get(`/workshops/students/${parsed.studentId}/attendance-id`);
          if (res.data.workshop?.color) parsed.color = res.data.workshop.color;
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
    const scanner = new Html5QrcodeScanner('qr-reader', {
      fps: 20,
      qrbox: undefined,
      rememberLastUsedCamera: true,
      showTorchButtonIfSupported: true,
      showZoomSliderIfSupported: true,
      defaultZoomValueIfSupported: 2,
      formatsToSupport: [0], // QR_CODE only
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true
      }
    }, false);

    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => { showWelcome(decodedText); },
      () => {}
    );

    return () => {
      if (welcomeTimerRef.current) clearTimeout(welcomeTimerRef.current);
      try { scanner.clear(); } catch (e) {}
    };
  }, [showWelcome]);

  return (
    <div className="qr-scanner-overlay">
      <div className="qr-scanner-modal">
        <div className="qr-scanner-header">
          <h3>{isRTL ? 'مسح بطاقة الحضور' : 'Scan Attendance ID'}</h3>
          <button className="qr-scanner-close" onClick={() => {
            try { scannerRef.current?.clear(); } catch(e) {}
            onClose();
          }}>×</button>
        </div>

        <div style={{ position: 'relative' }}>
          <div id="qr-reader" style={{ width: '100%' }} />
        </div>

        {welcome && (
          <div className="qr-welcome-popup" style={{ borderColor: welcome.color || '#1a56db', '--ws-color': welcome.color || '#1a56db' }}>
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
