import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';

const RoomPhoto = ({ formData, onChange, onNext, onBack }) => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const fileInputRef = useRef(null);

  const photos = formData.roomPhotosBefore || [];
  const MAX_PHOTOS = 10;

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      toast.error(isRTL ? `الحد الأقصى ${MAX_PHOTOS} صور` : `Maximum ${MAX_PHOTOS} photos`);
      return;
    }

    const filesToProcess = files.slice(0, remaining);
    let processed = 0;
    const newPhotos = [];

    filesToProcess.forEach(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(isRTL ? 'يرجى اختيار صور فقط' : 'Please select image files only');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(isRTL ? 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت' : 'Image must be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        newPhotos.push(event.target.result);
        processed++;
        if (processed === filesToProcess.length) {
          const updatedPhotos = [...photos, ...newPhotos];
          onChange({
            roomPhotosBefore: updatedPhotos,
            roomPhotoBefore: updatedPhotos[0] || ''
          });
        }
      };
      reader.readAsDataURL(file);
    });

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemovePhoto = (index) => {
    const updatedPhotos = photos.filter((_, i) => i !== index);
    onChange({
      roomPhotosBefore: updatedPhotos,
      roomPhotoBefore: updatedPhotos[0] || ''
    });
  };

  const canProceed = photos.length > 0 || !!formData.roomPhotoBefore;

  return (
    <div>
      <h2 className="step-title">
        {isRTL ? 'صور القاعة' : 'Room Photos'}
      </h2>
      <p className="step-description">
        {isRTL ? `التقط صور للقاعة قبل بدء الفترة التعليمية (حتى ${MAX_PHOTOS} صور)` : `Take photos of the room before the education period starts (up to ${MAX_PHOTOS} photos)`}
      </p>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Photo thumbnails grid */}
        {photos.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: '12px',
            marginBottom: '16px'
          }}>
            {photos.map((photo, index) => (
              <div key={index} style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '2px solid #e2e8f0' }}>
                <img
                  src={photo}
                  alt={`Room ${index + 1}`}
                  style={{ width: '100%', height: '100px', objectFit: 'cover', display: 'block' }}
                />
                <button
                  onClick={() => handleRemovePhoto(index)}
                  style={{
                    position: 'absolute', top: '4px', right: '4px',
                    background: 'rgba(239, 68, 68, 0.9)', color: 'white',
                    border: 'none', borderRadius: '50%', width: '24px', height: '24px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '14px', lineHeight: 1
                  }}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload area */}
        {photos.length < MAX_PHOTOS && (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '3px dashed #cbd5e1',
              borderRadius: '16px',
              padding: '30px',
              textAlign: 'center',
              cursor: 'pointer',
              background: '#fafafa',
              transition: 'all 0.3s ease',
              minHeight: '120px',
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
              multiple
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" style={{ marginBottom: '12px' }}>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <p style={{ color: '#64748b', fontWeight: '600', margin: '0 0 4px' }}>
              {isRTL ? `انقر لرفع صور القاعة (${photos.length}/${MAX_PHOTOS})` : `Click to upload room photos (${photos.length}/${MAX_PHOTOS})`}
            </p>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
              {isRTL ? 'الحد الأقصى 5 ميجابايت لكل صورة' : 'Max 5MB per image'}
            </p>
          </div>
        )}
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
          style={{ background: canProceed ? 'linear-gradient(135deg, #6d28d9, #7c3aed)' : undefined }}
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
