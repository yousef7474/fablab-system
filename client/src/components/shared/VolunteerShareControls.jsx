import React, { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../config/api';

/**
 * Compact per-card share controls for a Volunteer:
 *   - Google Drive URL (editable + save)
 *   - Public Share toggle
 *   - Copy Share Link button
 *   - Rotate Token button (invalidates old link)
 *
 * Rendered inside the volunteer card. When the toggle or driveUrl
 * changes, calls the parent `onUpdated(volunteerId, patch)` so the
 * parent list stays in sync without a full refetch.
 */
const VolunteerShareControls = ({ volunteer, isRTL, onUpdated }) => {
  const [saving, setSaving] = useState(false);
  const [driveInput, setDriveInput] = useState(volunteer.driveUrl || '');
  const [showDrive, setShowDrive] = useState(false);

  const shareEnabled = !!volunteer.shareEnabled;
  const shareToken = volunteer.shareToken;
  const shareUrl = shareToken
    ? `${window.location.origin}/public/volunteer/${shareToken}`
    : '';

  const patchShare = async (patch) => {
    setSaving(true);
    try {
      const { data } = await api.patch(`/volunteers/${volunteer.volunteerId}/share`, patch);
      onUpdated && onUpdated(volunteer.volunteerId, data);
      return data;
    } catch (err) {
      console.error('Share update failed', err);
      toast.error(isRTL ? 'فشل تحديث إعدادات المشاركة' : 'Failed to update share settings');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    try {
      await patchShare({ shareEnabled: !shareEnabled });
      toast.success(
        !shareEnabled
          ? (isRTL ? 'تم تفعيل رابط المشاركة' : 'Share link enabled')
          : (isRTL ? 'تم إيقاف رابط المشاركة' : 'Share link disabled')
      );
    } catch { /* toast already shown */ }
  };

  const handleSaveDrive = async () => {
    const trimmed = driveInput.trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      return toast.error(isRTL ? 'يجب أن يبدأ الرابط بـ http أو https' : 'URL must start with http/https');
    }
    try {
      await patchShare({ driveUrl: trimmed });
      toast.success(isRTL ? 'تم حفظ رابط Drive' : 'Drive link saved');
      setShowDrive(false);
    } catch { /* handled */ }
  };

  const handleCopy = async () => {
    if (!shareEnabled) {
      return toast.info(isRTL ? 'فعّل المشاركة أولاً' : 'Enable sharing first');
    }
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(isRTL ? 'تم نسخ الرابط' : 'Link copied');
    } catch {
      window.prompt(isRTL ? 'انسخ الرابط:' : 'Copy the link:', shareUrl);
    }
  };

  const handleRotate = async () => {
    if (!window.confirm(isRTL
      ? 'سيتم إبطال الرابط القديم فوراً. متابعة؟'
      : 'The old link will be invalidated immediately. Continue?')) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/volunteers/${volunteer.volunteerId}/share/rotate`);
      onUpdated && onUpdated(volunteer.volunteerId, { shareToken: data.shareToken });
      toast.success(isRTL ? 'تم توليد رابط جديد' : 'New link generated');
    } catch (err) {
      console.error('Rotate failed', err);
      toast.error(isRTL ? 'فشل توليد الرابط' : 'Failed to rotate token');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="vshare" onClick={(e) => e.stopPropagation()}>
      <div className="vshare-row">
        <label className={`vshare-toggle ${shareEnabled ? 'on' : ''}`} title={isRTL ? 'تفعيل رابط عام' : 'Enable public link'}>
          <input
            type="checkbox"
            checked={shareEnabled}
            onChange={handleToggle}
            disabled={saving}
          />
          <span className="vshare-track"><span className="vshare-thumb" /></span>
          <span className="vshare-toggle-label">
            {shareEnabled
              ? (isRTL ? 'المشاركة مفعّلة' : 'Sharing ON')
              : (isRTL ? 'مشاركة عامة' : 'Public share')}
          </span>
        </label>

        <button
          type="button"
          className="vshare-btn"
          onClick={handleCopy}
          disabled={!shareEnabled || saving}
          title={isRTL ? 'نسخ رابط المتطوع' : 'Copy volunteer link'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          {isRTL ? 'نسخ الرابط' : 'Copy link'}
        </button>

        <button
          type="button"
          className="vshare-btn ghost"
          onClick={handleRotate}
          disabled={saving}
          title={isRTL ? 'توليد رابط جديد وإبطال القديم' : 'Rotate token'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          {isRTL ? 'رابط جديد' : 'Rotate'}
        </button>

        <button
          type="button"
          className="vshare-btn ghost"
          onClick={() => { setShowDrive(v => !v); setDriveInput(volunteer.driveUrl || ''); }}
          title={isRTL ? 'رابط Google Drive' : 'Google Drive URL'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          {volunteer.driveUrl ? (isRTL ? 'تعديل Drive' : 'Edit Drive') : (isRTL ? 'إضافة Drive' : 'Add Drive')}
        </button>
      </div>

      {showDrive && (
        <div className="vshare-drive-edit">
          <input
            type="url"
            value={driveInput}
            onChange={(e) => setDriveInput(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/..."
            className="vshare-drive-input"
            dir="ltr"
          />
          <button type="button" className="vshare-btn primary" onClick={handleSaveDrive} disabled={saving}>
            {isRTL ? 'حفظ' : 'Save'}
          </button>
          {volunteer.driveUrl && (
            <button
              type="button"
              className="vshare-btn ghost"
              onClick={async () => { setDriveInput(''); await patchShare({ driveUrl: '' }); toast.success(isRTL ? 'تمت الإزالة' : 'Removed'); setShowDrive(false); }}
              disabled={saving}
            >
              {isRTL ? 'إزالة' : 'Remove'}
            </button>
          )}
        </div>
      )}

      {shareEnabled && shareUrl && (
        <div className="vshare-url" title={shareUrl}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          <span className="vshare-url-text">{shareUrl}</span>
        </div>
      )}
    </div>
  );
};

export default VolunteerShareControls;
