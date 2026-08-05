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
const _toDateInput = (v) => {
  if (!v) return '';
  if (typeof v === 'string') return v.slice(0, 10);
  try { return new Date(v).toISOString().slice(0, 10); } catch { return ''; }
};

const VolunteerShareControls = ({ volunteer, isRTL, onUpdated }) => {
  const [saving, setSaving] = useState(false);
  const [driveInput, setDriveInput] = useState(volunteer.driveUrl || '');
  const [showDrive, setShowDrive] = useState(false);
  const [showPeriod, setShowPeriod] = useState(false);
  const [fromInput, setFromInput] = useState(_toDateInput(volunteer.shareFromDate));
  const [toInput, setToInput] = useState(_toDateInput(volunteer.shareToDate));

  const shareEnabled = !!volunteer.shareEnabled;
  const shareToken = volunteer.shareToken;
  const shareUrl = shareToken
    ? `${window.location.origin}/public/volunteer/${shareToken}`
    : '';

  // The linked program's dates are the sensible default range. We
  // display them as a hint so the admin knows what the reviewer would
  // see if the explicit fields are left blank.
  const programStart = _toDateInput(volunteer.summerProgram?.startDate);
  const programEnd = _toDateInput(volunteer.summerProgram?.endDate);
  const effectiveFrom = _toDateInput(volunteer.shareFromDate) || programStart;
  const effectiveTo = _toDateInput(volunteer.shareToDate) || programEnd;

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

        <button
          type="button"
          className="vshare-btn ghost"
          onClick={() => {
            setShowPeriod(v => !v);
            setFromInput(_toDateInput(volunteer.shareFromDate));
            setToInput(_toDateInput(volunteer.shareToDate));
          }}
          title={isRTL ? 'فترة التطوع المعروضة' : 'Displayed volunteering period'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          {effectiveFrom || effectiveTo
            ? (isRTL ? 'تعديل الفترة' : 'Edit Period')
            : (isRTL ? 'تحديد الفترة' : 'Set Period')}
        </button>
      </div>

      {(effectiveFrom || effectiveTo) && !showPeriod && (
        <div className="vshare-period-chip" title={isRTL ? 'الفترة المعروضة على الرابط العام' : 'Period shown on the public link'}>
          <span className="vshare-period-icon">📅</span>
          {isRTL ? 'الفترة: ' : 'Period: '}
          <b dir="ltr">{effectiveFrom || '…'}</b>
          <span> → </span>
          <b dir="ltr">{effectiveTo || '…'}</b>
          {(!_toDateInput(volunteer.shareFromDate) && !_toDateInput(volunteer.shareToDate)) && (
            <span className="vshare-period-source">
              {isRTL ? ' (من البرنامج)' : ' (from program)'}
            </span>
          )}
        </div>
      )}

      {showPeriod && (
        <div className="vshare-period-edit">
          <div className="vshare-period-row">
            <label>
              <span>{isRTL ? 'من' : 'From'}</span>
              <input
                type="date"
                value={fromInput}
                onChange={(e) => setFromInput(e.target.value)}
                className="vshare-date-input"
              />
            </label>
            <label>
              <span>{isRTL ? 'إلى' : 'To'}</span>
              <input
                type="date"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                className="vshare-date-input"
              />
            </label>
          </div>
          {(programStart || programEnd) && (
            <div className="vshare-period-hint">
              {isRTL ? 'الافتراضي (فترة البرنامج): ' : 'Default (program): '}
              <b dir="ltr">{programStart || '…'}</b> → <b dir="ltr">{programEnd || '…'}</b>
              {(fromInput !== programStart || toInput !== programEnd) && (
                <button
                  type="button"
                  className="vshare-btn ghost vshare-period-fill"
                  onClick={() => { setFromInput(programStart); setToInput(programEnd); }}
                >
                  {isRTL ? 'استخدام فترة البرنامج' : 'Use program dates'}
                </button>
              )}
            </div>
          )}
          <div className="vshare-period-actions">
            <button
              type="button"
              className="vshare-btn primary"
              disabled={saving}
              onClick={async () => {
                if (fromInput && toInput && fromInput > toInput) {
                  return toast.error(isRTL ? 'التاريخ من يجب أن يكون قبل التاريخ إلى' : '"From" must be before "To"');
                }
                try {
                  await patchShare({ shareFromDate: fromInput || null, shareToDate: toInput || null });
                  toast.success(isRTL ? 'تم حفظ الفترة' : 'Period saved');
                  setShowPeriod(false);
                } catch { /* handled */ }
              }}
            >
              {isRTL ? 'حفظ' : 'Save'}
            </button>
            {(volunteer.shareFromDate || volunteer.shareToDate) && (
              <button
                type="button"
                className="vshare-btn ghost"
                disabled={saving}
                onClick={async () => {
                  setFromInput(''); setToInput('');
                  await patchShare({ shareFromDate: null, shareToDate: null });
                  toast.success(isRTL ? 'تم مسح الفترة' : 'Period cleared');
                  setShowPeriod(false);
                }}
              >
                {isRTL ? 'مسح' : 'Clear'}
              </button>
            )}
          </div>
        </div>
      )}

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
