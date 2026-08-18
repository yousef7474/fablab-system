import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import api from '../../config/api';
import './YearCalendar.css';

const MONTH_NAMES_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const MONTH_NAMES_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LETTERS_AR = ['ح','ن','ث','ر','خ','ج','س'];
const DAY_LETTERS_EN = ['S','M','T','W','T','F','S'];

// Category → default color + label
const CATEGORIES = [
  { key: 'task',           labelAr: 'مهمة',        labelEn: 'Task',           color: '#EE2329' },
  { key: 'reminder',       labelAr: 'تذكير',       labelEn: 'Reminder',       color: '#f59e0b' },
  { key: 'meeting',        labelAr: 'اجتماع',      labelEn: 'Meeting',        color: '#0ea5e9' },
  { key: 'event',          labelAr: 'فعالية',      labelEn: 'Event',          color: '#a855f7' },
  { key: 'holiday',        labelAr: 'عطلة',        labelEn: 'Holiday',        color: '#16a34a' },
  { key: 'staff-vacation', labelAr: 'عطلة موظف',   labelEn: 'Staff Vacation', color: '#f97316' },
  { key: 'other',          labelAr: 'أخرى',        labelEn: 'Other',          color: '#64748b' },
  // Virtual read-only categories mirrored from the Schedule tab.
  { key: 'appointment',    labelAr: 'موعد تسجيل',  labelEn: 'Appointment',    color: '#8b5cf6' },
  { key: 'employee-task',  labelAr: 'مهمة موظف',   labelEn: 'Employee Task',  color: '#ec4899' }
];

// Preset palette shown when the user picks the "other" category and
// wants a custom color. Deliberately vibrant + high-contrast.
const COLOR_PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#64748b'
];

const catColor = (cat) => CATEGORIES.find(c => c.key === cat)?.color || '#64748b';
const catLabel = (ev, isRTL) => {
  // Prefer the user's custom label when the event is category='other'.
  if (ev.category === 'other' && ev.customCategory) return ev.customCategory;
  const c = CATEGORIES.find(x => x.key === ev.category);
  return c ? (isRTL ? c.labelAr : c.labelEn) : ev.category;
};

// Local-tz safe ISO
const toISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Compare two YYYY-MM-DD strings inclusively
const inRange = (iso, start, end) => iso >= start && iso <= (end || start);

const YearCalendar = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [events, setEvents] = useState([]);
  const [holidays, setHolidays] = useState([]);
  // Registrations + tasks pulled from the Schedule tab and rendered as
  // read-only virtual events so the calendar reflects real bookings.
  const [scheduleItems, setScheduleItems] = useState([]);
  // Universal admin preference — persisted server-side so any device
  // where the admin logs in gets the same show/hide choice.
  const [showScheduleOverlay, setShowScheduleOverlay] = useState(true);
  const [togglingOverlay, setTogglingOverlay] = useState(false);
  const [loading, setLoading] = useState(true);

  const [dayModal, setDayModal] = useState(null);  // { iso, events }
  const [editModal, setEditModal] = useState(null); // { mode: 'create'|'edit', event? }
  const [dragStart, setDragStart] = useState(null); // ISO for range selection start

  const [form, setForm] = useState({
    startDate: '', endDate: '', title: '', description: '',
    category: 'task', customCategory: '', color: '', isImportant: false, assignedTo: ''
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Schedule + prefs endpoints tolerate failure so a non-admin
      // (or a fresh install without the pref row) still renders.
      const [e, h, s, p] = await Promise.all([
        api.get(`/calendar-events?year=${year}`),
        api.get(`/calendar-events/saudi-holidays?year=${year}`),
        api.get('/admin/schedule?includeTasks=true').catch(() => ({ data: [] })),
        api.get('/settings/calendar-prefs').catch(() => ({ data: { showScheduleOverlay: true } }))
      ]);
      setEvents(Array.isArray(e.data) ? e.data : []);
      setHolidays(Array.isArray(h.data) ? h.data : []);
      setScheduleItems(Array.isArray(s.data) ? s.data : []);
      setShowScheduleOverlay(!!p.data?.showScheduleOverlay);
    } catch (err) {
      console.error('fetch calendar:', err);
      toast.error(isRTL ? 'تعذّر تحميل التقويم' : 'Failed to load calendar');
    } finally {
      setLoading(false);
    }
  }, [year, isRTL]);

  const toggleScheduleOverlay = async () => {
    const next = !showScheduleOverlay;
    setShowScheduleOverlay(next); // optimistic
    setTogglingOverlay(true);
    try {
      await api.put('/settings/calendar-prefs', { showScheduleOverlay: next });
      toast.success(next
        ? (isRTL ? 'تم إظهار المواعيد ومهام الموظفين' : 'Schedule overlay shown')
        : (isRTL ? 'تم إخفاء المواعيد ومهام الموظفين' : 'Schedule overlay hidden'));
    } catch (err) {
      setShowScheduleOverlay(!next); // revert
      toast.error(isRTL ? 'تعذّر حفظ التفضيل' : 'Failed to save preference');
    } finally {
      setTogglingOverlay(false);
    }
  };

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Convert the Schedule tab payload (appointments + tasks) into
  // read-only virtual events that share the same rendering pipeline.
  const virtualEvents = useMemo(() => {
    const list = [];
    for (const it of scheduleItems || []) {
      if (!it || !it.date) continue;
      const start = String(it.date).slice(0, 10);
      // Tasks may span multiple days via dueDateEnd; appointments are single-day.
      const end = it.dueDateEnd ? String(it.dueDateEnd).slice(0, 10) : start;
      if (it.type === 'appointment') {
        const timeSuffix = it.startTime ? ` — ${String(it.startTime).slice(0, 5)}` : '';
        list.push({
          eventId: `sched-appt-${it.id}`,
          title: `${isRTL ? 'موعد' : 'Appointment'}: ${it.title || ''}${timeSuffix}`,
          startDate: start,
          endDate: end,
          category: 'appointment',
          color: '#8b5cf6',
          description: [
            it.section && `${isRTL ? 'القسم' : 'Section'}: ${it.section}`,
            it.startTime && `${isRTL ? 'الوقت' : 'Time'}: ${String(it.startTime).slice(0,5)}${it.endTime ? ` → ${String(it.endTime).slice(0,5)}` : ''}`,
            it.phone && `${isRTL ? 'الجوال' : 'Phone'}: ${it.phone}`
          ].filter(Boolean).join(' · ') || null,
          assignedTo: it.title || null,
          isReadOnly: true,
          isImportant: false
        });
      } else if (it.type === 'task') {
        const timeSuffix = it.startTime ? ` — ${String(it.startTime).slice(0, 5)}` : '';
        list.push({
          eventId: `sched-task-${it.id}`,
          title: `${isRTL ? 'مهمة' : 'Task'}: ${it.title || ''}${timeSuffix}`,
          startDate: start,
          endDate: end,
          category: 'employee-task',
          color: '#ec4899',
          description: [
            it.assignee && `${isRTL ? 'المكلّف' : 'Assignee'}: ${it.assignee}`,
            it.section && `${isRTL ? 'القسم' : 'Section'}: ${it.section}`,
            it.priority && `${isRTL ? 'الأولوية' : 'Priority'}: ${it.priority}`,
            it.status && `${isRTL ? 'الحالة' : 'Status'}: ${it.status}`
          ].filter(Boolean).join(' · ') || null,
          assignedTo: it.assignee || null,
          isReadOnly: true,
          isImportant: it.priority === 'high' || it.priority === 'urgent'
        });
      }
    }
    return list;
  }, [scheduleItems, isRTL]);

  // All events (user-created + holidays + schedule-overlay) keyed by ISO date for quick lookup
  const eventsByDay = useMemo(() => {
    const map = new Map();
    const push = (iso, ev) => {
      const arr = map.get(iso) || [];
      arr.push(ev);
      map.set(iso, arr);
    };
    const walk = (ev) => {
      const start = String(ev.startDate).slice(0, 10);
      const end = String(ev.endDate || ev.startDate).slice(0, 10);
      let d = new Date(`${start}T00:00:00`);
      const endDate = new Date(`${end}T00:00:00`);
      while (d <= endDate) {
        push(toISO(d), ev);
        d.setDate(d.getDate() + 1);
      }
    };
    holidays.forEach(walk);
    events.forEach(walk);
    if (showScheduleOverlay) virtualEvents.forEach(walk);
    return map;
  }, [events, holidays, virtualEvents, showScheduleOverlay]);

  // Stats for the mini strip at the top. Appointment/employee-task
  // counters zero out when the overlay is hidden so the strip mirrors
  // what's actually rendered on the grid.
  const stats = useMemo(() => ({
    total: events.length,
    tasks: events.filter(e => e.category === 'task').length,
    meetings: events.filter(e => e.category === 'meeting').length,
    important: events.filter(e => e.isImportant).length,
    holidays: holidays.length,
    appointments: showScheduleOverlay ? virtualEvents.filter(e => e.category === 'appointment').length : 0,
    employeeTasks: showScheduleOverlay ? virtualEvents.filter(e => e.category === 'employee-task').length : 0
  }), [events, holidays, virtualEvents, showScheduleOverlay]);

  // ---------- Actions ----------

  const openCreate = (iso) => {
    setForm({
      startDate: iso || toISO(new Date()),
      endDate: '',
      title: '', description: '', category: 'task', customCategory: '', color: '',
      isImportant: false, assignedTo: ''
    });
    setEditModal({ mode: 'create' });
    setDayModal(null);
  };

  const openEdit = (ev) => {
    setForm({
      startDate: String(ev.startDate).slice(0, 10),
      endDate: ev.endDate ? String(ev.endDate).slice(0, 10) : '',
      title: ev.title || '',
      description: ev.description || '',
      category: ev.category || 'task',
      customCategory: ev.customCategory || '',
      color: ev.color || '',
      isImportant: !!ev.isImportant,
      assignedTo: ev.assignedTo || ''
    });
    setEditModal({ mode: 'edit', event: ev });
    setDayModal(null);
  };

  const saveEvent = async () => {
    if (!form.title.trim() || !form.startDate) {
      toast.error(isRTL ? 'العنوان والتاريخ مطلوبان' : 'Title and date are required');
      return;
    }
    if (form.category === 'other' && !form.customCategory.trim()) {
      toast.error(isRTL ? 'اكتب اسم الفئة المخصصة' : 'Enter a custom category name');
      return;
    }
    try {
      const body = {
        ...form,
        endDate: form.endDate && form.endDate >= form.startDate ? form.endDate : null,
        title: form.title.trim(),
        description: form.description.trim() || null,
        customCategory: form.category === 'other' ? form.customCategory.trim() : null,
        color: form.color || null,
        assignedTo: form.assignedTo.trim() || null
      };
      if (editModal.mode === 'create') {
        await api.post('/calendar-events', body);
        toast.success(isRTL ? 'تمت إضافة الحدث' : 'Event added');
      } else {
        await api.put(`/calendar-events/${editModal.event.eventId}`, body);
        toast.success(isRTL ? 'تم التحديث' : 'Updated');
      }
      setEditModal(null);
      await fetchAll();
    } catch (err) {
      toast.error(err?.response?.data?.message || (isRTL ? 'تعذّر الحفظ' : 'Save failed'));
    }
  };

  const deleteEvent = async (ev) => {
    if (!window.confirm(isRTL ? 'حذف هذا الحدث؟' : 'Delete this event?')) return;
    try {
      await api.delete(`/calendar-events/${ev.eventId}`);
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
      setEditModal(null);
      setDayModal(null);
      await fetchAll();
    } catch (err) {
      toast.error(isRTL ? 'تعذّر الحذف' : 'Delete failed');
    }
  };

  // Range-drag support: mousedown → mouseup on cells to pre-fill dates.
  const handleDayMouseDown = (iso) => setDragStart(iso);
  const handleDayMouseUp = (iso) => {
    if (dragStart && dragStart !== iso) {
      const [s, e] = dragStart < iso ? [dragStart, iso] : [iso, dragStart];
      openCreate(s);
      setForm(f => ({ ...f, startDate: s, endDate: e }));
    }
    setDragStart(null);
  };

  const openDay = (iso) => {
    const dayEvents = eventsByDay.get(iso) || [];
    setDayModal({ iso, events: dayEvents });
  };

  // ---------- Render helpers ----------

  const renderMonth = (monthIdx) => {
    const first = new Date(year, monthIdx, 1);
    const last  = new Date(year, monthIdx + 1, 0);
    const cells = [];
    for (let i = 0; i < first.getDay(); i++) cells.push(null);
    for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, monthIdx, d));
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <motion.div
        className="yc-month"
        key={monthIdx}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, delay: monthIdx * 0.02 }}
      >
        <div className="yc-month-head">
          <span className="yc-month-name">{isRTL ? MONTH_NAMES_AR[monthIdx] : MONTH_NAMES_EN[monthIdx]}</span>
          <span className="yc-month-count">
            {[...eventsByDay.keys()].filter(k => {
              const d = new Date(`${k}T00:00:00`);
              return d.getFullYear() === year && d.getMonth() === monthIdx;
            }).reduce((sum, k) => sum + eventsByDay.get(k).length, 0)}
          </span>
        </div>
        <div className="yc-month-weekdays">
          {(isRTL ? DAY_LETTERS_AR : DAY_LETTERS_EN).map((l, i) => <span key={i}>{l}</span>)}
        </div>
        <div className="yc-month-grid">
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="yc-cell yc-cell--empty" />;
            const iso = toISO(d);
            const isToday = iso === toISO(new Date());
            const dayEvents = eventsByDay.get(iso) || [];
            const dots = dayEvents.slice(0, 3);
            const extra = dayEvents.length - dots.length;
            const hasImportant = dayEvents.some(e => e.isImportant);
            const isWeekend = d.getDay() === 5 || d.getDay() === 6;

            return (
              <button
                type="button"
                key={iso}
                onMouseDown={() => handleDayMouseDown(iso)}
                onMouseUp={() => handleDayMouseUp(iso)}
                onClick={() => openDay(iso)}
                onDoubleClick={() => openCreate(iso)}
                className={`yc-cell ${isToday ? 'is-today' : ''} ${isWeekend ? 'is-weekend' : ''} ${dayEvents.length ? 'has-events' : ''} ${hasImportant ? 'is-important' : ''}`}
                title={dayEvents.length ? dayEvents.map(e => e.title).join(' · ') : ''}
              >
                <span className="yc-cell-num">{d.getDate()}</span>
                {dots.length > 0 && (
                  <span className="yc-cell-dots">
                    {dots.map((e, idx) => (
                      <span key={idx} className="yc-dot" style={{ background: e.color || catColor(e.category) }} />
                    ))}
                    {extra > 0 && <span className="yc-dot yc-dot--more">+{extra}</span>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>
    );
  };

  const yearRange = [];
  for (let y = currentYear - 1; y <= currentYear + 8; y++) yearRange.push(y);

  return (
    <div className="yc" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Top bar */}
      <div className="yc-topbar">
        <div className="yc-nav">
          <button type="button" className="yc-nav-btn" onClick={() => setYear(y => y - 1)} aria-label="prev year">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points={isRTL ? '9 18 15 12 9 6' : '15 18 9 12 15 6'}/></svg>
          </button>
          <div className="yc-year">{year}</div>
          <button type="button" className="yc-nav-btn" onClick={() => setYear(y => y + 1)} aria-label="next year">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points={isRTL ? '15 18 9 12 15 6' : '9 18 15 12 9 6'}/></svg>
          </button>
          <select className="yc-year-select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {yearRange.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {year !== currentYear && (
            <button type="button" className="yc-today-btn" onClick={() => setYear(currentYear)}>
              {isRTL ? 'اليوم' : 'Today'}
            </button>
          )}
        </div>

        <div className="yc-legend">
          {CATEGORIES.map(c => (
            <span key={c.key} className="yc-legend-item">
              <span className="yc-legend-dot" style={{ background: c.color }} />
              <span>{isRTL ? c.labelAr : c.labelEn}</span>
            </span>
          ))}
        </div>

        <div className="yc-actions">
          <button
            type="button"
            className={`yc-overlay-btn ${showScheduleOverlay ? 'is-on' : 'is-off'}`}
            onClick={toggleScheduleOverlay}
            disabled={togglingOverlay}
            title={isRTL
              ? 'إظهار/إخفاء المواعيد ومهام الموظفين (تفضيل مشترك بين جميع تسجيلات الدخول)'
              : 'Show/hide appointments & employee tasks (shared across all logins)'}
          >
            {showScheduleOverlay ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            )}
            {showScheduleOverlay
              ? (isRTL ? 'المواعيد ظاهرة' : 'Schedule shown')
              : (isRTL ? 'المواعيد مخفية' : 'Schedule hidden')}
          </button>
          <button type="button" className="yc-add-btn" onClick={() => openCreate(toISO(new Date()))}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {isRTL ? 'إضافة حدث' : 'Add Event'}
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="yc-stats">
        {[
          { label: isRTL ? 'الأحداث' : 'Events',        value: stats.total,          tint: '#EE2329' },
          { label: isRTL ? 'مهام' : 'Tasks',           value: stats.tasks,          tint: '#EE2329' },
          { label: isRTL ? 'اجتماعات' : 'Meetings',    value: stats.meetings,       tint: '#0ea5e9' },
          { label: isRTL ? 'مواعيد' : 'Appointments',  value: stats.appointments,   tint: '#8b5cf6' },
          { label: isRTL ? 'مهام موظفين' : 'Emp Tasks', value: stats.employeeTasks, tint: '#ec4899' },
          { label: isRTL ? 'مهم' : 'Important',        value: stats.important,      tint: '#f59e0b' },
          { label: isRTL ? 'عطل رسمية' : 'Holidays',    value: stats.holidays,       tint: '#16a34a' }
        ].map((s, i) => (
          <div key={i} className="yc-stat" style={{ borderColor: `${s.tint}55` }}>
            <div className="yc-stat-value" style={{ color: s.tint }}>{s.value}</div>
            <div className="yc-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Year grid */}
      {loading ? (
        <div className="yc-loading">
          <div className="yc-spinner" />
          <span>{isRTL ? 'جارٍ التحميل...' : 'Loading...'}</span>
        </div>
      ) : (
        <div className="yc-year-grid">
          {Array.from({ length: 12 }, (_, i) => renderMonth(i))}
        </div>
      )}

      <div className="yc-tip">
        💡 {isRTL
          ? 'انقر مرتين على يوم لإضافة حدث فوري، أو اسحب من يوم لآخر لتحديد فترة زمنية.'
          : 'Double-click a day to quick-add an event, or drag from one day to another to create a range.'}
      </div>

      {/* Day detail modal */}
      <AnimatePresence>
        {dayModal && (
          <motion.div
            className="yc-modal-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setDayModal(null)}
          >
            <motion.div
              className="yc-modal"
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="yc-modal-head">
                <div>
                  <div className="yc-modal-kicker">{isRTL ? 'أحداث اليوم' : 'Events on'}</div>
                  <h3 className="yc-modal-title">
                    {new Date(`${dayModal.iso}T00:00:00`).toLocaleDateString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-US', {
                      calendar: 'gregory', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                    })}
                  </h3>
                </div>
                <button type="button" className="yc-modal-close" onClick={() => setDayModal(null)}>✕</button>
              </div>

              <div className="yc-modal-body">
                {dayModal.events.length === 0 ? (
                  <div className="yc-modal-empty">
                    <div style={{ fontSize: 42, opacity: 0.4 }}>📅</div>
                    <p>{isRTL ? 'لا توجد أحداث في هذا اليوم' : 'No events on this day'}</p>
                  </div>
                ) : (
                  <div className="yc-event-list">
                    {dayModal.events.map((ev, i) => (
                      <div key={i} className="yc-event" style={{ borderInlineStartColor: ev.color || catColor(ev.category) }}>
                        <div className="yc-event-header">
                          <span className="yc-event-cat" style={{ background: (ev.color || catColor(ev.category)) + '22', color: ev.color || catColor(ev.category) }}>
                            {catLabel(ev, isRTL)}
                          </span>
                          {ev.isImportant && <span className="yc-event-star">⭐</span>}
                        </div>
                        <div className="yc-event-title">{ev.title}</div>
                        {ev.description && <div className="yc-event-desc">{ev.description}</div>}
                        {ev.endDate && ev.endDate !== ev.startDate && (
                          <div className="yc-event-range">
                            {isRTL ? 'الفترة' : 'Range'}: <span dir="ltr">{String(ev.startDate).slice(0,10)} → {String(ev.endDate).slice(0,10)}</span>
                          </div>
                        )}
                        {ev.assignedTo && (
                          <div className="yc-event-assigned">
                            {isRTL ? 'المكلّف' : 'Assigned'}: <b>{ev.assignedTo}</b>
                          </div>
                        )}
                        {!ev.isReadOnly && (
                          <div className="yc-event-actions">
                            <button type="button" onClick={() => openEdit(ev)}>{isRTL ? '✏️ تعديل' : '✏️ Edit'}</button>
                            <button type="button" className="danger" onClick={() => deleteEvent(ev)}>{isRTL ? '🗑️ حذف' : '🗑️ Delete'}</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="yc-modal-foot">
                <button type="button" className="yc-add-btn" onClick={() => openCreate(dayModal.iso)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  {isRTL ? 'إضافة حدث لهذا اليوم' : 'Add event on this day'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create/edit modal */}
      <AnimatePresence>
        {editModal && (
          <motion.div
            className="yc-modal-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setEditModal(null)}
          >
            <motion.div
              className="yc-modal yc-modal--form"
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="yc-modal-head">
                <h3 className="yc-modal-title">
                  {editModal.mode === 'create'
                    ? (isRTL ? 'إضافة حدث جديد' : 'New Event')
                    : (isRTL ? 'تعديل الحدث' : 'Edit Event')}
                </h3>
                <button type="button" className="yc-modal-close" onClick={() => setEditModal(null)}>✕</button>
              </div>

              <div className="yc-modal-body">
                <div className="yc-form">
                  <label className="yc-field yc-field--full">
                    <span>{isRTL ? 'العنوان *' : 'Title *'}</span>
                    <input type="text" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder={isRTL ? 'مثال: اجتماع مع المدرّبين' : 'e.g. Trainers meeting'} />
                  </label>

                  <label className="yc-field">
                    <span>{isRTL ? 'من *' : 'From *'}</span>
                    <input type="date" value={form.startDate} onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))} dir="ltr" />
                  </label>

                  <label className="yc-field">
                    <span>{isRTL ? 'إلى (اختياري)' : 'To (optional)'}</span>
                    <input type="date" value={form.endDate} onChange={(e) => setForm(f => ({ ...f, endDate: e.target.value }))} min={form.startDate} dir="ltr" />
                  </label>

                  <div className="yc-field yc-field--full">
                    <span>{isRTL ? 'الفئة' : 'Category'}</span>
                    <div className="yc-cat-grid">
                      {CATEGORIES.map(c => (
                        <button
                          type="button"
                          key={c.key}
                          onClick={() => setForm(f => ({ ...f, category: c.key, color: c.color }))}
                          className={`yc-cat-btn ${form.category === c.key ? 'is-active' : ''}`}
                          style={form.category === c.key ? { borderColor: c.color, background: c.color + '18', color: c.color } : {}}
                        >
                          <span className="yc-cat-dot" style={{ background: c.color }} />
                          {isRTL ? c.labelAr : c.labelEn}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom label + palette — only when "other" is selected */}
                  {form.category === 'other' && (
                    <motion.div
                      className="yc-field yc-field--full yc-custom-block"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <span>{isRTL ? 'اسم الفئة المخصصة *' : 'Custom Category Name *'}</span>
                      <input
                        type="text"
                        value={form.customCategory}
                        onChange={(e) => setForm(f => ({ ...f, customCategory: e.target.value }))}
                        placeholder={isRTL ? 'مثال: دورة تدريبية، حدث طارئ...' : 'e.g. Training course, urgent event...'}
                        maxLength={64}
                      />
                      <div className="yc-palette-wrap">
                        <span className="yc-palette-label">{isRTL ? 'اختر لوناً' : 'Pick a color'}</span>
                        <div className="yc-palette">
                          {COLOR_PALETTE.map(col => (
                            <button
                              type="button"
                              key={col}
                              onClick={() => setForm(f => ({ ...f, color: col }))}
                              className={`yc-palette-dot ${form.color === col ? 'is-active' : ''}`}
                              style={{ background: col }}
                              title={col}
                              aria-label={col}
                            />
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <label className="yc-field">
                    <span>{isRTL ? 'المكلّف (اختياري)' : 'Assigned To (optional)'}</span>
                    <input type="text" value={form.assignedTo} onChange={(e) => setForm(f => ({ ...f, assignedTo: e.target.value }))} placeholder={isRTL ? 'اسم المسؤول' : 'Assignee name'} />
                  </label>

                  <label className="yc-field yc-field--check">
                    <input type="checkbox" checked={form.isImportant} onChange={(e) => setForm(f => ({ ...f, isImportant: e.target.checked }))} />
                    <span>{isRTL ? 'مهم — إبراز بنجمة' : 'Important — highlight with a star'}</span>
                  </label>

                  <label className="yc-field yc-field--full">
                    <span>{isRTL ? 'ملاحظات (اختياري)' : 'Notes (optional)'}</span>
                    <textarea rows={3} value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
                  </label>
                </div>
              </div>

              <div className="yc-modal-foot">
                {editModal.mode === 'edit' && (
                  <button type="button" className="yc-btn yc-btn--danger" onClick={() => deleteEvent(editModal.event)}>
                    {isRTL ? '🗑️ حذف' : '🗑️ Delete'}
                  </button>
                )}
                <div style={{ flex: 1 }} />
                <button type="button" className="yc-btn yc-btn--ghost" onClick={() => setEditModal(null)}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="button" className="yc-btn yc-btn--primary" onClick={saveEvent}>
                  {isRTL ? 'حفظ' : 'Save'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default YearCalendar;
