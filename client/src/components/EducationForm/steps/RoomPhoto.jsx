import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { NavArrow } from './TeacherInfo';

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

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        {/* Photo thumbnails grid */}
        {photos.length > 0 && (
          <div className="edu-photos">
            {photos.map((photo, index) => (
              <div key={index} className="edu-photo">
                <img src={photo} alt={`Room ${index + 1}`} />
                <button
                  type="button"
                  className="edu-x"
                  onClick={() => handleRemovePhoto(index)}
                  aria-label={isRTL ? 'حذف الصورة' : 'Remove photo'}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {/* Upload area */}
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            className="edu-drop"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <b>
              {isRTL ? `انقر لرفع صور القاعة (${photos.length}/${MAX_PHOTOS})` : `Click to upload room photos (${photos.length}/${MAX_PHOTOS})`}
            </b>
            <small>
              {isRTL ? 'الحد الأقصى 5 ميجابايت لكل صورة' : 'Max 5MB per image'}
            </small>
          </button>
        )}
      </motion.div>

      <div className="form-navigation">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          <NavArrow dir="back" isRTL={isRTL} />
          {isRTL ? 'السابق' : 'Previous'}
        </button>
        <button type="button" className="btn btn-primary" onClick={onNext} disabled={!canProceed}>
          {isRTL ? 'التالي' : 'Next'}
          <NavArrow dir="next" isRTL={isRTL} />
        </button>
      </div>
    </div>
  );
};

export default RoomPhoto;
