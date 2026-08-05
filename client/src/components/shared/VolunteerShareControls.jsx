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

// Normalize a Saudi phone number to WhatsApp's international format
// (966XXXXXXXXX). Accepts local (05XXXXXXXX), international with plus
// (+966XXXXXXXXX) and 00-prefixed forms. Returns null if we can't be
// confident it's a valid Saudi mobile.
const _normalizeSaudiPhone = (raw) => {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00966')) digits = digits.slice(5);
  else if (digits.startsWith('966')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length !== 9 || !digits.startsWith('5')) return null;
  return `966${digits}`;
};

// Plain-text template with no emoji. Some WhatsApp clients garble
// supplementary-plane emoji (👋 🙌) when opened via a wa.me deep link,
// showing them as U+FFFD replacement chars in the received message.
// The admin can still add emojis manually via WhatsApp's own picker
// after opening the link — the textarea is editable.
const _buildVolunteerMessage = (volunteer) => {
  const first = String(volunteer.name || '').split(/\s+/)[0] || volunteer.name || '';
  return (
`مرحباً ${first}،

هذا رابط مجلد Google Drive الخاص بك في فاب لاب الأحساء لرفع محتوى تطوعك:

${volunteer.driveUrl}

الرجاء اتباع الخطوات التالية:
1) أنشئ مجلداً جديداً داخل الرابط باسم الفرصة التطوعية التي شاركت فيها.
2) ارفع بداخله ما لا يقل عن ٥ صور توثّق مشاركتك في هذه الفرصة.

ملاحظة: يمكنك رفع الصور والملفات بسهولة عبر تطبيق Google Drive على هاتفك.

شكراً لتطوعك معنا.`
  );
};

const VolunteerShareControls = ({ volunteer, isRTL, onUpdated }) => {
  const [saving, setSaving] = useState(false);
  const [driveInput, setDriveInput] = useState(volunteer.driveUrl || '');
  const [showDrive, setShowDrive] = useState(false);
  const [showPeriod, setShowPeriod] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [fromInput, setFromInput] = useState(_toDateInput(volunteer.shareFromDate));
  const [toInput, setToInput] = useState(_toDateInput(volunteer.shareToDate));

  const whatsappPhone = _normalizeSaudiPhone(volunteer.phone);

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

        {volunteer.driveUrl && (
          <button
            type="button"
            className="vshare-btn vshare-send-btn"
            onClick={() => {
              setShowSend(v => !v);
              setMessageInput(_buildVolunteerMessage(volunteer));
            }}
            title={isRTL ? 'إرسال رابط Drive إلى المتطوع' : 'Send Drive link to volunteer'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13"/>
              <path d="M22 2l-7 20-4-9-9-4z"/>
            </svg>
            {isRTL ? 'إرسال للمتطوع' : 'Send to volunteer'}
          </button>
        )}
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

      {showSend && (
        <div className="vshare-send-panel">
          <div className="vshare-send-target">
            <span className="vshare-send-label">
              {isRTL ? 'إلى' : 'To'}
            </span>
            <span dir="ltr" className="vshare-send-phone">
              {whatsappPhone ? `+${whatsappPhone}` : (volunteer.phone || '—')}
            </span>
            {!whatsappPhone && (
              <span className="vshare-send-warn">
                {isRTL
                  ? '⚠ رقم الجوال غير قابل للاستخدام مع واتساب — استخدم النسخ'
                  : '⚠ Phone unusable for WhatsApp — use Copy instead'}
              </span>
            )}
          </div>
          <textarea
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            className="vshare-send-textarea"
            rows={7}
            dir="rtl"
          />
          <div className="vshare-send-actions">
            <a
              href={whatsappPhone
                ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(messageInput)}`
                : undefined}
              target="_blank"
              rel="noopener noreferrer"
              className={`vshare-btn vshare-btn-wa ${!whatsappPhone ? 'is-disabled' : ''}`}
              onClick={(e) => { if (!whatsappPhone) e.preventDefault(); }}
              title={isRTL ? 'فتح واتساب مع الرسالة جاهزة' : 'Open WhatsApp with the message ready'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              {isRTL ? 'إرسال عبر واتساب' : 'Send via WhatsApp'}
            </a>
            <button
              type="button"
              className="vshare-btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(messageInput);
                  toast.success(isRTL ? 'تم نسخ الرسالة' : 'Message copied');
                } catch {
                  window.prompt(isRTL ? 'انسخ الرسالة:' : 'Copy the message:', messageInput);
                }
              }}
              title={isRTL ? 'نسخ الرسالة كاملة' : 'Copy the full message'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              {isRTL ? 'نسخ الرسالة' : 'Copy message'}
            </button>
            <button
              type="button"
              className="vshare-btn ghost"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(volunteer.driveUrl);
                  toast.success(isRTL ? 'تم نسخ رابط Drive' : 'Drive link copied');
                } catch {
                  window.prompt(isRTL ? 'انسخ الرابط:' : 'Copy the link:', volunteer.driveUrl);
                }
              }}
              title={isRTL ? 'نسخ رابط Drive فقط' : 'Copy just the Drive URL'}
            >
              {isRTL ? 'نسخ الرابط فقط' : 'Copy URL only'}
            </button>
            <button
              type="button"
              className="vshare-btn ghost"
              onClick={() => setShowSend(false)}
            >
              {isRTL ? 'إغلاق' : 'Close'}
            </button>
          </div>
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
