import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';

const RoomPhoto = ({ formData, onChange, onNext, onBack }) => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(isRTL ? 'يرجى اختيار صورة فقط' : 'Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(isRTL ? 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت' : 'Image must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      onChange({ roomPhotoBefore: event.target.result });
    };
    reader.readAsDataURL(file);
  };

  const canProceed = !!formData.roomPhotoBefore;

  return (
    <div>
      <h2 className="step-title">
        {isRTL ? 'صورة القاعة' : 'Room Photo'}
      </h2>
      <p className="step-description">
        {isRTL ? 'التقط صورة للقاعة قبل بدء الفترة التعليمية' : 'Take a photo of the room before the education period starts'}
      </p>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `3px dashed ${formData.roomPhotoBefore ? '#2596be' : '#cbd5e1'}`,
            borderRadius: '16px',
            padding: formData.roomPhotoBefore ? '12px' : '40px',
            textAlign: 'center',
            cursor: 'pointer',
            background: formData.roomPhotoBefore ? '#e8f6fb' : '#fafafa',
            transition: 'all 0.3s ease',
            minHeight: '200px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          {formData.roomPhotoBefore ? (
            <div style={{ position: 'relative' }}>
              <img
                src={formData.roomPhotoBefore}
                alt="Room"
                style={{
                  maxWidth: '100%',
                  maxHeight: '300px',
                  borderRadius: '12px',
                  objectFit: 'cover'
                }}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onChange({ roomPhotoBefore: '' });
                }}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  background: 'rgba(239, 68, 68, 0.9)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px'
                }}
              >
                ×
              </button>
              <p style={{ marginTop: '8px', color: '#2596be', fontSize: '13px' }}>
                {isRTL ? 'انقر لتغيير الصورة' : 'Click to change photo'}
              </p>
            </div>
          ) : (
            <>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" style={{ marginBottom: '12px' }}>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <p style={{ color: '#64748b', fontWeight: '600', margin: '0 0 4px' }}>
                {isRTL ? 'انقر لرفع صورة القاعة' : 'Click to upload room photo'}
              </p>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
                {isRTL ? 'الحد الأقصى 5 ميجابايت' : 'Max 5MB'}
              </p>
            </>
          )}
        </div>
      </motion.div>

      <div className="form-navigation" style={{ marginTop: '24px' }}>
        <button className="btn btn-secondary" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }}>
            <path d="m15 18-6-6 6-6"/>
          </svg>
          {isRTL ? 'السابق' : 'Previous'}
        </button>
        <button
          className="btn btn-primary"
          onClick={onNext}
          disabled={!canProceed}
          style={{ background: canProceed ? 'linear-gradient(135deg, #2596be, #2ba8cc)' : undefined }}
        >
          {isRTL ? 'التالي' : 'Next'}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }}>
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default RoomPhoto;
