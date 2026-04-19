import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import './QRScanner.css';

const QRScanner = ({ onClose, onResult }) => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      // Start scanning frames
      intervalRef.current = setInterval(scanFrame, 500);
    } catch (err) {
      console.error('Camera error:', err);
      setError(isRTL ? 'لا يمكن الوصول للكاميرا' : 'Cannot access camera');
    }
  };

  const stopCamera = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
  };

  const scanFrame = () => {
    if (!videoRef.current || !canvasRef.current || !scanning) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Use jsQR if available, otherwise try BarcodeDetector API
    if (window.BarcodeDetector) {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      detector.detect(canvas).then(barcodes => {
        if (barcodes.length > 0) {
          handleQRResult(barcodes[0].rawValue);
        }
      }).catch(() => {});
    }
  };

  const handleQRResult = (data) => {
    if (!scanning) return;
    setScanning(false);

    try {
      const parsed = JSON.parse(data);
      setResult(parsed);
      if (onResult) onResult(parsed);
      stopCamera();
    } catch {
      // Not valid JSON, try as plain text
      setResult({ raw: data });
      stopCamera();
    }
  };

  // Manual input fallback
  const [manualInput, setManualInput] = useState('');
  const handleManualSubmit = () => {
    if (!manualInput.trim()) return;
    try {
      const parsed = JSON.parse(manualInput.trim());
      setResult(parsed);
      setScanning(false);
      if (onResult) onResult(parsed);
      stopCamera();
    } catch {
      toast.error(isRTL ? 'بيانات غير صالحة' : 'Invalid data');
    }
  };

  return (
    <motion.div className="qr-scanner-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="qr-scanner-modal">
        <div className="qr-scanner-header">
          <h3>{isRTL ? 'مسح بطاقة الحضور' : 'Scan Attendance ID'}</h3>
          <button className="qr-scanner-close" onClick={() => { stopCamera(); onClose(); }}>×</button>
        </div>

        {error ? (
          <div className="qr-scanner-error">
            <p>{error}</p>
            <div className="qr-scanner-manual">
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 8 }}>
                {isRTL ? 'أو أدخل رمز الطالب يدوياً:' : 'Or enter student code manually:'}
              </p>
              <input
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                placeholder={isRTL ? 'WS-XXXXXXXX أو بيانات QR' : 'WS-XXXXXXXX or QR data'}
                style={{ width: '100%', padding: '0.6rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'monospace', textAlign: 'center' }}
              />
              <button onClick={handleManualSubmit} style={{ marginTop: 8, padding: '0.5rem 1.5rem', borderRadius: 8, border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
                {isRTL ? 'بحث' : 'Search'}
              </button>
            </div>
          </div>
        ) : !result ? (
          <div className="qr-scanner-camera">
            <video ref={videoRef} playsInline muted />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <div className="qr-scanner-frame" />
            <p className="qr-scanner-hint">
              {isRTL ? 'وجّه الكاميرا نحو رمز QR في بطاقة الحضور' : 'Point camera at the QR code on the attendance ID'}
            </p>
            {/* Manual fallback */}
            <div className="qr-scanner-manual">
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 6 }}>
                {isRTL ? 'أو أدخل الرمز يدوياً:' : 'Or enter code manually:'}
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={manualInput}
                  onChange={e => setManualInput(e.target.value)}
                  placeholder="WS-XXXXXXXX"
                  style={{ flex: 1, padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'monospace', textAlign: 'center', fontSize: '0.85rem' }}
                />
                <button onClick={handleManualSubmit} style={{ padding: '0.5rem 1rem', borderRadius: 8, border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', fontFamily: 'inherit' }}>
                  {isRTL ? 'بحث' : 'Go'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="qr-scanner-result">
            <div className="qr-result-icon">✓</div>
            <h4>{isRTL ? 'تم التعرف على الطالب' : 'Student Identified'}</h4>
            <div className="qr-result-card">
              {result.name && <div className="qr-result-row"><span>{isRTL ? 'الاسم' : 'Name'}</span><strong>{result.name}</strong></div>}
              {result.phone && <div className="qr-result-row"><span>{isRTL ? 'الهاتف' : 'Phone'}</span><strong dir="ltr">{result.phone}</strong></div>}
              {result.workshop && <div className="qr-result-row"><span>{isRTL ? 'الورشة' : 'Workshop'}</span><strong>{result.workshop}</strong></div>}
              {result.studentId && <div className="qr-result-row"><span>{isRTL ? 'الرمز' : 'Code'}</span><strong style={{ fontFamily: 'monospace' }}>WS-{result.studentId.substring(0, 8).toUpperCase()}</strong></div>}
            </div>
            <div className="qr-result-actions">
              <button onClick={() => { setResult(null); setScanning(true); startCamera(); }} className="qr-btn-secondary">
                {isRTL ? 'مسح آخر' : 'Scan Another'}
              </button>
              <button onClick={() => { stopCamera(); onClose(); }} className="qr-btn-primary">
                {isRTL ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default QRScanner;
