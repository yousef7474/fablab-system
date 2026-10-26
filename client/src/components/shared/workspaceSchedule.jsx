import React from 'react';
import './WorkspaceSchedule.css';

// Workspace attendance schedule — for a booking where the person comes
// only on some days of the period, each with its own time slot (e.g.
// two weeks, Sunday 4–8 PM and Tuesday 5–9 PM). Stored on the
// workspace as [{ day: 0-6 (0 = Sunday), startTime, endTime }];
// null = every day of the period. Used by the admin and manager
// workspace forms, cards and the printed banner.

export const WEEKDAYS = [
  { day: 0, ar: 'الأحد', en: 'Sunday' },
  { day: 1, ar: 'الاثنين', en: 'Monday' },
  { day: 2, ar: 'الثلاثاء', en: 'Tuesday' },
  { day: 3, ar: 'الأربعاء', en: 'Wednesday' },
  { day: 4, ar: 'الخميس', en: 'Thursday' },
  { day: 5, ar: 'الجمعة', en: 'Friday' },
  { day: 6, ar: 'السبت', en: 'Saturday' }
];

const dayName = (day, isRTL) => {
  const d = WEEKDAYS.find(w => w.day === Number(day));
  return d ? (isRTL ? d.ar : d.en) : '';
};

const fmt12 = (t) => {
  if (!t) return '';
  const [h, m] = String(t).split(':').map(Number);
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const scheduleDays = (schedule) =>
  (Array.isArray(schedule) ? [...schedule] : []).sort((a, b) => a.day - b.day);

// Form check before saving: null when fine, else the message to show.
export const scheduleError = (schedule, isRTL) => {
  if (!Array.isArray(schedule)) return null;
  if (schedule.length === 0) {
    return isRTL ? 'اختر يوماً واحداً على الأقل في جدول الحضور، أو اختر «كل أيام الفترة»' : 'Pick at least one day in the attendance schedule, or choose "Every day"';
  }
  const bad = schedule.find(d => !d.startTime || !d.endTime || String(d.endTime).slice(0, 5) <= String(d.startTime).slice(0, 5));
  if (bad) {
    return isRTL
      ? `حدد وقت بداية ونهاية صحيحين ليوم ${dayName(bad.day, true)} (النهاية بعد البداية)`
      : `Set a valid start and end time for ${dayName(bad.day, false)} (end after start)`;
  }
  return null;
};

// ── Editor (inside the workspace form) ──────────────────────────
export const WorkspaceScheduleEditor = ({ value, onChange, isRTL, defaultStart = '', defaultEnd = '' }) => {
  const specific = Array.isArray(value);
  const days = scheduleDays(value);

  const toggleDay = (day) => {
    if (days.some(d => d.day === day)) {
      onChange(days.filter(d => d.day !== day));
      return;
    }
    // A new day starts with the last day's slot, else the period's times.
    const last = days[days.length - 1];
    const startTime = last?.startTime || String(defaultStart || '').slice(0, 5);
    const endTime = last?.endTime || String(defaultEnd || '').slice(0, 5);
    onChange(scheduleDays([...days, { day, startTime, endTime }]));
  };

  const setTime = (day, key, v) => onChange(days.map(d => (d.day === day ? { ...d, [key]: v } : d)));

  return (
    <div className="wss-editor">
      <div className="wss-mode" role="radiogroup" aria-label={isRTL ? 'أيام الحضور' : 'Attendance days'}>
        <button type="button" role="radio" aria-checked={!specific} className={!specific ? 'on' : ''} onClick={() => onChange(null)}>
          {isRTL ? 'كل أيام الفترة' : 'Every day of the period'}
        </button>
        <button type="button" role="radio" aria-checked={specific} className={specific ? 'on' : ''} onClick={() => !specific && onChange([])}>
          {isRTL ? 'أيام محددة من الأسبوع' : 'Specific weekdays'}
        </button>
      </div>

      {specific && (
        <>
          <div className="wss-days">
            {WEEKDAYS.map(w => (
              <button
                key={w.day}
                type="button"
                className={`wss-day ${days.some(d => d.day === w.day) ? 'on' : ''}`}
                aria-pressed={days.some(d => d.day === w.day)}
                onClick={() => toggleDay(w.day)}
              >
                {isRTL ? w.ar : w.en}
              </button>
            ))}
          </div>
          {days.length > 0 && (
            <div className="wss-rows">
              {days.map(d => (
                <div key={d.day} className="wss-row">
                  <span className="wss-row-day">{dayName(d.day, isRTL)}</span>
                  <label>
                    <span>{isRTL ? 'من' : 'From'}</span>
                    <input type="time" className="modern-input-field" value={d.startTime || ''} onChange={e => setTime(d.day, 'startTime', e.target.value)} />
                  </label>
                  <label>
                    <span>{isRTL ? 'إلى' : 'To'}</span>
                    <input type="time" className="modern-input-field" value={d.endTime || ''} onChange={e => setTime(d.day, 'endTime', e.target.value)} />
                  </label>
                </div>
              ))}
            </div>
          )}
          <p className="wss-hint">
            {isRTL
              ? 'لمن يحضر أياماً محددة فقط خلال الفترة — مثال: أسبوعان، يومان في الأسبوع ولكل يوم وقته. يُطبع الجدول على اللافتة.'
              : 'For someone who comes only on some days of the period — e.g. two weeks, two days a week, each with its own time. Printed on the banner.'}
          </p>
        </>
      )}
    </div>
  );
};

// ── Card chips (workspace list) ─────────────────────────────────
export const WorkspaceScheduleChips = ({ schedule, isRTL }) => {
  const days = scheduleDays(schedule);
  if (!days.length) return null;
  return (
    <div className="wss-chips" title={isRTL ? 'أيام الحضور' : 'Attendance days'}>
      <span className="wss-chips-label">📅 {isRTL ? 'أيام الحضور' : 'Days'}</span>
      {days.map(d => (
        <span key={d.day} className="wss-chip">
          <b>{dayName(d.day, isRTL)}</b>
          <span dir="ltr">{fmt12(d.startTime)} – {fmt12(d.endTime)}</span>
        </span>
      ))}
    </div>
  );
};

// ── Printed banner ──────────────────────────────────────────────
export const SCHEDULE_BANNER_CSS = `
  .schedule-section { margin: 5mm 15mm 0; }
  .schedule-title {
    font-size: 12px; font-weight: 700; color: #1e40af; letter-spacing: 1px;
    text-align: center; margin-bottom: 3mm;
  }
  .schedule-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 3mm; }
  .schedule-day {
    min-width: 40mm; padding: 7px 12px; text-align: center;
    background: #ffffff; border: 1.5px solid #bfdbfe; border-radius: 12px;
  }
  .schedule-day-name { font-size: 14px; font-weight: 800; color: #1e40af; }
  .schedule-day-time { font-size: 12px; font-weight: 600; color: #3b82f6; margin-top: 2px; }
  /* make room for the schedule on the A4 page */
  .banner-wrapper.has-schedule .table-hero { margin-top: 4mm; }
  .banner-wrapper.has-schedule .table-number-circle { width: 40mm; height: 40mm; }
  .banner-wrapper.has-schedule .table-value { font-size: 48px; }
  .banner-wrapper.has-schedule .project-section { margin-top: 4mm; }
  .banner-wrapper.has-schedule .project-name { font-size: 21px; }
  .banner-wrapper.has-schedule .info-grid { padding-top: 5mm; gap: 3mm; }
  .banner-wrapper.has-schedule .info-card { padding: 9px 14px; }
  .banner-wrapper.has-schedule .duration-section { margin-top: 5mm; padding: 10px 20px; }
  .banner-wrapper.has-schedule .rules-section { margin-top: 5mm; }
  .banner-wrapper.has-schedule .rules-title { margin-bottom: 3mm; }
  .banner-wrapper.has-schedule .rules-list { gap: 2mm 5mm; }
  /* 5+ days take two rows of day cards */
  .banner-wrapper.many-days .table-hero { margin-top: 3mm; }
  .banner-wrapper.many-days .table-number-circle { width: 34mm; height: 34mm; }
  .banner-wrapper.many-days .table-label { font-size: 11px; }
  .banner-wrapper.many-days .table-value { font-size: 40px; }
  .banner-wrapper.many-days .schedule-day { padding: 5px 10px; }
`;

// Extra classes for .banner-wrapper so the schedule fits on the A4 page.
export const scheduleBannerClass = (schedule) => {
  const n = scheduleDays(schedule).length;
  return n ? (n > 4 ? ' has-schedule many-days' : ' has-schedule') : '';
};

export const scheduleBannerHtml = (schedule, isRTL) => {
  const days = scheduleDays(schedule);
  if (!days.length) return '';
  return `
    <div class="schedule-section">
      <div class="schedule-title">${isRTL ? 'أيام وأوقات الحضور خلال الفترة' : 'ATTENDANCE DAYS & TIMES'}</div>
      <div class="schedule-grid">
        ${days.map(d => `
          <div class="schedule-day">
            <div class="schedule-day-name">${escapeHtml(dayName(d.day, isRTL))}</div>
            <div class="schedule-day-time" dir="ltr">${escapeHtml(fmt12(d.startTime))} – ${escapeHtml(fmt12(d.endTime))}</div>
          </div>`).join('')}
      </div>
    </div>`;
};
