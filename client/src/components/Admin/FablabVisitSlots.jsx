import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';
import './FablabVisitSlots.css';

// Admin calendar of the visit slots offered on the public /fablab-visit
// form. One group books a whole slot; capacity = the most visitors that
// group may bring (instructors come on top: 2 per 15 visitors).

const riyadhToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date());
const pad = (n) => String(n).padStart(2, '0');
const monthKey = (iso) => iso.slice(0, 7);
const shiftMonth = (ym, delta) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};
const monthBounds = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${pad(days)}`, days, firstWeekday: new Date(Date.UTC(y, m - 1, 1)).getUTCDay() };
};
const weekdayOf = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();

const WEEKDAYS = {
  ar: ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
};

const STATUS = {
  open: { ar: 'متاح', en: 'Open' },
  booked: { ar: 'محجوز', en: 'Booked' },
  inactive: { ar: 'متوقف', en: 'Paused' },
  past: { ar: 'منتهي', en: 'Past' }
};
const slotStatus = (sl) => (sl.booking ? 'booked' : sl.isPast ? 'past' : !sl.isActive ? 'inactive' : 'open');

const bookingStage = (b, isRTL) => {
  if (!b) return '';
  if (b.visitorDecision === 'accepted') return isRTL ? 'تم إشعار الزائر بالقبول' : 'Visitor accepted';
  if (b.approvalStatus === 'approved') return isRTL ? 'معتمد من المدير' : 'Manager approved';
  if (b.approvalStatus === 'pending') return isRTL ? 'بانتظار المدير' : 'Awaiting manager';
  return isRTL ? 'طلب جديد' : 'New request';
};

const Modal = ({ children, onClose, wide }) => createPortal(
  <motion.div
    className="fvs-overlay"
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    onClick={onClose}
  >
    <motion.div
      className={`fvs-modal ${wide ? 'wide' : ''}`}
      initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.97 }}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      {children}
    </motion.div>
  </motion.div>,
  document.body
);

const errMsg = (err, isRTL, fallbackAr, fallbackEn) => {
  const d = err?.response?.data;
  return (isRTL ? d?.messageAr : d?.message) || d?.messageAr || d?.message || (isRTL ? fallbackAr : fallbackEn);
};

const FablabVisitSlots = ({ isRTL, onOpenVisit }) => {
  const lang = isRTL ? 'ar' : 'en';
  const today = riyadhToday();
  const [month, setMonth] = useState(monthKey(today));
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingDays, setWorkingDays] = useState([0, 1, 2, 3, 4]);
  const [workStart, setWorkStart] = useState('09:00');

  const [detail, setDetail] = useState(null);   // slot
  const [edit, setEdit] = useState(null);       // { slot, form }
  const [savingEdit, setSavingEdit] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchSlots = useCallback(async (ym = month) => {
    setLoading(true);
    try {
      const { from, to } = monthBounds(ym);
      const { data } = await api.get('/fablab-visits/slots', { params: { from, to } });
      setSlots(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(errMsg(err, isRTL, 'تعذّر تحميل المواعيد', 'Could not load the slots'));
    } finally {
      setLoading(false);
    }
  }, [month, isRTL]);

  useEffect(() => { fetchSlots(month); }, [month, fetchSlots]);

  useEffect(() => {
    api.get('/settings/working-hours')
      .then(({ data }) => {
        if (Array.isArray(data?.workingDays) && data.workingDays.length) setWorkingDays(data.workingDays);
        if (data?.startTime) setWorkStart(String(data.startTime).slice(0, 5));
      })
      .catch(() => {});
  }, []);

  const byDate = useMemo(() => {
    const m = new Map();
    for (const sl of slots) {
      if (!m.has(sl.date)) m.set(sl.date, []);
      m.get(sl.date).push(sl);
    }
    return m;
  }, [slots]);

  const counts = useMemo(() => {
    const c = { open: 0, booked: 0, inactive: 0, past: 0 };
    for (const sl of slots) c[slotStatus(sl)]++;
    return c;
  }, [slots]);

  const monthLabel = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }, [month, isRTL]);

  const fmtDay = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

  // -------- slot actions --------
  const toggleActive = async (sl) => {
    try {
      await api.put(`/fablab-visits/slots/${sl.slotId}`, { isActive: !sl.isActive });
      toast.success(sl.isActive
        ? (isRTL ? 'تم إيقاف الموعد — لن يظهر للزوار' : 'Slot paused — hidden from visitors')
        : (isRTL ? 'تم تفعيل الموعد' : 'Slot activated'));
      setDetail(null);
      fetchSlots();
    } catch (err) {
      toast.error(errMsg(err, isRTL, 'تعذّر تحديث الموعد', 'Could not update the slot'));
    }
  };

  const removeSlot = async (sl) => {
    if (!window.confirm(isRTL ? 'حذف هذا الموعد نهائياً؟' : 'Delete this slot permanently?')) return;
    try {
      await api.delete(`/fablab-visits/slots/${sl.slotId}`);
      toast.success(isRTL ? 'تم حذف الموعد' : 'Slot deleted');
      setDetail(null);
      fetchSlots();
    } catch (err) {
      toast.error(errMsg(err, isRTL, 'تعذّر حذف الموعد', 'Could not delete the slot'));
    }
  };

  const openEdit = (sl) => {
    setDetail(null);
    setEdit({ slot: sl, form: { date: sl.date, startTime: sl.startTime, endTime: sl.endTime, capacity: String(sl.capacity), notes: sl.notes || '' } });
  };

  const saveEdit = async () => {
    const { slot, form } = edit;
    const cap = parseInt(form.capacity, 10);
    if (!form.date || !form.startTime || !form.endTime || form.startTime >= form.endTime) {
      toast.error(isRTL ? 'أدخل تاريخاً ووقتاً صحيحين (البداية قبل النهاية)' : 'Enter a valid date and time (start before end)');
      return;
    }
    if (!Number.isInteger(cap) || cap < 1 || cap > 1000) {
      toast.error(isRTL ? 'العدد المسموح بين 1 و 1000' : 'Capacity must be 1–1000');
      return;
    }
    const body = { capacity: cap, notes: form.notes.trim() };
    if (!slot.booking) Object.assign(body, { date: form.date, startTime: form.startTime, endTime: form.endTime });
    setSavingEdit(true);
    try {
      await api.put(`/fablab-visits/slots/${slot.slotId}`, body);
      toast.success(isRTL ? 'تم حفظ الموعد' : 'Slot saved');
      setEdit(null);
      if (monthKey(form.date) !== month) setMonth(monthKey(form.date)); else fetchSlots();
    } catch (err) {
      toast.error(errMsg(err, isRTL, 'تعذّر حفظ الموعد', 'Could not save the slot'));
    } finally {
      setSavingEdit(false);
    }
  };

  // -------- render helpers --------
  const SlotChip = ({ sl, full }) => {
    const st = slotStatus(sl);
    return (
      <button
        type="button"
        className={`fvs-chip ${st} ${full ? 'full' : ''}`}
        onClick={(e) => { e.stopPropagation(); setDetail(sl); }}
        title={`${sl.startTime}–${sl.endTime} · ${STATUS[st][lang]}`}
      >
        <span className="fvs-chip-time"><bdi dir="ltr">{sl.startTime}–{sl.endTime}</bdi></span>
        {sl.booking ? (
          <span className="fvs-chip-sub">
            <b dir="ltr">{sl.booking.visitNumberLabel}</b> · {sl.booking.entityName} · 👥 {sl.booking.visitorsCount}
          </span>
        ) : (
          <span className="fvs-chip-sub">👥 {sl.capacity} · {STATUS[st][lang]}</span>
        )}
      </button>
    );
  };

  const { days, firstWeekday } = monthBounds(month);
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(`${month}-${pad(d)}`);

  const agendaDates = [...byDate.keys()].sort();

  return (
    <div className="fvs">
      {/* Toolbar */}
      <div className="fvs-toolbar">
        <div className="fvs-monthnav">
          <button type="button" onClick={() => setMonth(m => shiftMonth(m, -1))} aria-label={isRTL ? 'الشهر السابق' : 'Previous month'}>{isRTL ? '›' : '‹'}</button>
          <div className="fvs-month">{monthLabel}</div>
          <button type="button" onClick={() => setMonth(m => shiftMonth(m, 1))} aria-label={isRTL ? 'الشهر التالي' : 'Next month'}>{isRTL ? '‹' : '›'}</button>
          {month !== monthKey(today) && (
            <button type="button" className="fvs-today" onClick={() => setMonth(monthKey(today))}>{isRTL ? 'الشهر الحالي' : 'This month'}</button>
          )}
        </div>
        <button type="button" className="fvs-primary" onClick={() => setCreating(true)}>
          ➕ {isRTL ? 'فتح مواعيد' : 'Open slots'}
        </button>
      </div>

      <div className="fvs-legend">
        {['open', 'booked', 'inactive', 'past'].map(k => (
          <span key={k} className={`fvs-legend-item ${k}`}>
            <span className="fvs-dot" /> {STATUS[k][lang]} <b>{counts[k]}</b>
          </span>
        ))}
        <span className="fvs-legend-note">
          {isRTL ? 'كل موعد لمجموعة واحدة · العدد = الحد الأقصى للزوار · مرافقان لكل 15 زائراً' : 'One group per slot · capacity = max visitors · 2 instructors per 15 visitors'}
        </span>
      </div>

      {/* Month grid */}
      <div className={`fvs-cal ${loading ? 'loading' : ''}`}>
        {WEEKDAYS[lang].map(w => <div key={w} className="fvs-weekday">{w}</div>)}
        {cells.map((iso, i) => {
          if (!iso) return <div key={`b${i}`} className="fvs-cell blank" />;
          const list = byDate.get(iso) || [];
          const isPastDay = iso < today;
          return (
            <div
              key={iso}
              className={`fvs-cell ${iso === today ? 'today' : ''} ${isPastDay ? 'past' : ''} ${list.length ? 'has' : ''}`}
              onClick={() => {
                if (!list.length) return;
                document.getElementById(`fvs-day-${iso}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              <div className="fvs-daynum">{Number(iso.slice(8))}</div>
              <div className="fvs-dots">
                {list.map(sl => <span key={sl.slotId} className={`fvs-dot ${slotStatus(sl)}`} />)}
              </div>
              <div className="fvs-chips">
                {list.map(sl => <SlotChip key={sl.slotId} sl={sl} />)}
              </div>
            </div>
          );
        })}
      </div>

      {!loading && slots.length === 0 && (
        <div className="fvs-empty">
          {isRTL ? 'لا توجد مواعيد مفتوحة في هذا الشهر — اضغط «فتح مواعيد» لإضافتها.' : 'No slots in this month yet — press “Open slots” to add some.'}
        </div>
      )}

      {/* Agenda (phones) */}
      {agendaDates.length > 0 && (
        <div className="fvs-agenda">
          {agendaDates.map(iso => (
            <div key={iso} id={`fvs-day-${iso}`} className="fvs-agenda-day">
              <div className="fvs-agenda-date">{fmtDay(iso)}</div>
              {byDate.get(iso).map(sl => <SlotChip key={sl.slotId} sl={sl} full />)}
            </div>
          ))}
        </div>
      )}

      {/* Slot detail */}
      <AnimatePresence>
        {detail && (
          <Modal onClose={() => setDetail(null)}>
            {(() => {
              const st = slotStatus(detail);
              const b = detail.booking;
              return (
                <>
                  <div className="fvs-modal-head">
                    <div>
                      <span className={`fvs-status ${st}`}><span className="fvs-dot" /> {STATUS[st][lang]}</span>
                      <h3>{fmtDay(detail.date)}</h3>
                      <div className="fvs-modal-sub" dir="ltr">{detail.startTime} – {detail.endTime}</div>
                    </div>
                    <button type="button" className="fvs-x" onClick={() => setDetail(null)} aria-label={isRTL ? 'إغلاق' : 'Close'}>✕</button>
                  </div>
                  <div className="fvs-modal-body">
                    <div className="fvs-kv-grid">
                      <div className="fvs-kv"><span>{isRTL ? 'العدد المسموح' : 'Capacity'}</span><b>👥 {detail.capacity}</b></div>
                      <div className="fvs-kv"><span>{isRTL ? 'المرافقون المطلوبون' : 'Instructors needed'}</span><b>{isRTL ? `حتى ${2 * Math.ceil(detail.capacity / 15)}` : `up to ${2 * Math.ceil(detail.capacity / 15)}`}</b></div>
                    </div>
                    {detail.notes && <div className="fvs-note">📝 {detail.notes}</div>}
                    {b ? (
                      <div className="fvs-booking">
                        <div className="fvs-booking-title">{isRTL ? 'محجوز لـ' : 'Booked by'}</div>
                        <div className="fvs-booking-name"><b dir="ltr">{b.visitNumberLabel}</b> · {b.entityName}</div>
                        <div className="fvs-booking-meta">
                          {isRTL ? 'المشرف' : 'Supervisor'}: {b.personInCharge} · <span dir="ltr">{b.phone}</span> · 👥 {b.visitorsCount}
                        </div>
                        <div className="fvs-booking-stage">{bookingStage(b, isRTL)}</div>
                        <button type="button" className="fvs-primary small" onClick={() => { setDetail(null); onOpenVisit(b.visitId); }}>
                          📋 {isRTL ? 'عرض الطلب' : 'Open request'}
                        </button>
                      </div>
                    ) : st === 'open' ? (
                      <div className="fvs-hint">{isRTL ? 'هذا الموعد ظاهر للزوار في صفحة طلب الزيارة.' : 'Visitors can book this slot on the visit page.'}</div>
                    ) : null}
                  </div>
                  <div className="fvs-modal-foot">
                    <button type="button" className="fvs-btn danger" onClick={() => removeSlot(detail)}>🗑 {isRTL ? 'حذف' : 'Delete'}</button>
                    {!detail.isPast && (
                      <button type="button" className="fvs-btn" onClick={() => toggleActive(detail)}>
                        {detail.isActive ? `⏸ ${isRTL ? 'إيقاف' : 'Pause'}` : `▶ ${isRTL ? 'تفعيل' : 'Activate'}`}
                      </button>
                    )}
                    <button type="button" className="fvs-btn" onClick={() => openEdit(detail)}>✏️ {isRTL ? 'تعديل' : 'Edit'}</button>
                  </div>
                </>
              );
            })()}
          </Modal>
        )}
      </AnimatePresence>

      {/* Edit slot */}
      <AnimatePresence>
        {edit && (
          <Modal onClose={() => !savingEdit && setEdit(null)}>
            <div className="fvs-modal-head">
              <div>
                <h3>{isRTL ? 'تعديل الموعد' : 'Edit slot'}</h3>
                {edit.slot.booking && (
                  <div className="fvs-modal-sub">{isRTL ? 'الموعد محجوز — يمكن تعديل العدد والملاحظات فقط' : 'This slot is booked — only capacity and notes can change'}</div>
                )}
              </div>
              <button type="button" className="fvs-x" onClick={() => setEdit(null)} aria-label={isRTL ? 'إغلاق' : 'Close'}>✕</button>
            </div>
            <div className="fvs-modal-body">
              <div className="fvs-form-grid">
                <label className="fvs-field span2">
                  <span>{isRTL ? 'التاريخ' : 'Date'}</span>
                  <input type="date" value={edit.form.date} min={today} disabled={!!edit.slot.booking}
                    onChange={e => setEdit(s => ({ ...s, form: { ...s.form, date: e.target.value } }))} />
                </label>
                <label className="fvs-field">
                  <span>{isRTL ? 'من' : 'From'}</span>
                  <input type="time" value={edit.form.startTime} disabled={!!edit.slot.booking}
                    onChange={e => setEdit(s => ({ ...s, form: { ...s.form, startTime: e.target.value } }))} />
                </label>
                <label className="fvs-field">
                  <span>{isRTL ? 'إلى' : 'To'}</span>
                  <input type="time" value={edit.form.endTime} disabled={!!edit.slot.booking}
                    onChange={e => setEdit(s => ({ ...s, form: { ...s.form, endTime: e.target.value } }))} />
                </label>
                <label className="fvs-field span2">
                  <span>{isRTL ? 'العدد المسموح (أقصى عدد زوار)' : 'Capacity (max visitors)'}</span>
                  <input type="number" min="1" max="1000" value={edit.form.capacity}
                    onChange={e => setEdit(s => ({ ...s, form: { ...s.form, capacity: e.target.value } }))} />
                </label>
                <label className="fvs-field span2">
                  <span>{isRTL ? 'ملاحظات (داخلية)' : 'Notes (internal)'}</span>
                  <textarea rows={2} value={edit.form.notes}
                    onChange={e => setEdit(s => ({ ...s, form: { ...s.form, notes: e.target.value } }))} />
                </label>
              </div>
            </div>
            <div className="fvs-modal-foot">
              <button type="button" className="fvs-btn" onClick={() => setEdit(null)} disabled={savingEdit}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
              <button type="button" className="fvs-primary" onClick={saveEdit} disabled={savingEdit}>
                {savingEdit ? (isRTL ? 'جارٍ الحفظ…' : 'Saving…') : (isRTL ? 'حفظ' : 'Save')}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Create slots */}
      <AnimatePresence>
        {creating && (
          <CreateSlotsModal
            isRTL={isRTL}
            today={today}
            startMonth={month < monthKey(today) ? monthKey(today) : month}
            workingDays={workingDays}
            defaultStart={workStart}
            onClose={() => setCreating(false)}
            onCreated={() => fetchSlots()}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// Multi-date picker + one time window/capacity applied to every date.
const CreateSlotsModal = ({ isRTL, today, startMonth, workingDays, defaultStart, onClose, onCreated }) => {
  const lang = isRTL ? 'ar' : 'en';
  const [month, setMonth] = useState(startMonth);
  const [selected, setSelected] = useState(() => new Set());
  const [existing, setExisting] = useState(new Map()); // date → count
  const [startTime, setStartTime] = useState(defaultStart || '09:00');
  const [endTime, setEndTime] = useState(() => {
    const [h, m] = (defaultStart || '09:00').split(':').map(Number);
    return `${pad(Math.min(23, h + 2))}:${pad(m)}`;
  });
  const [capacity, setCapacity] = useState('30');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const { from, to } = monthBounds(month);
    api.get('/fablab-visits/slots', { params: { from, to } })
      .then(({ data }) => {
        const m = new Map();
        (Array.isArray(data) ? data : []).forEach(sl => m.set(sl.date, (m.get(sl.date) || 0) + 1));
        setExisting(m);
      })
      .catch(() => setExisting(new Map()));
  }, [month]);

  const { days, firstWeekday } = monthBounds(month);
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(`${month}-${pad(d)}`);

  const monthLabel = (() => {
    const [y, m] = month.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  })();

  const toggle = (iso) => setSelected(prev => {
    const n = new Set(prev);
    if (n.has(iso)) n.delete(iso); else n.add(iso);
    return n;
  });
  const selectWorkingDays = () => setSelected(prev => {
    const n = new Set(prev);
    cells.forEach(iso => { if (iso && iso >= today && workingDays.includes(weekdayOf(iso))) n.add(iso); });
    return n;
  });
  const clearMonth = () => setSelected(prev => new Set([...prev].filter(iso => monthKey(iso) !== month)));

  const sortedSelected = [...selected].sort();
  const fmtShort = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

  const submit = async () => {
    const cap = parseInt(capacity, 10);
    if (!sortedSelected.length) { toast.error(isRTL ? 'اختر يوماً واحداً على الأقل' : 'Pick at least one day'); return; }
    if (sortedSelected.length > 62) { toast.error(isRTL ? 'الحد الأقصى 62 يوماً في المرة الواحدة' : 'Up to 62 days at once'); return; }
    if (!startTime || !endTime || startTime >= endTime) { toast.error(isRTL ? 'وقت البداية يجب أن يكون قبل وقت النهاية' : 'Start time must be before end time'); return; }
    if (!Number.isInteger(cap) || cap < 1 || cap > 1000) { toast.error(isRTL ? 'العدد المسموح بين 1 و 1000' : 'Capacity must be 1–1000'); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/fablab-visits/slots', { dates: sortedSelected, startTime, endTime, capacity: cap, notes: notes.trim() || undefined });
      setResult(data);
      onCreated();
    } catch (err) {
      toast.error(errMsg(err, isRTL, 'تعذّر فتح المواعيد', 'Could not open the slots'));
    } finally {
      setSaving(false);
    }
  };

  const reset = () => { setResult(null); setSelected(new Set()); };

  return (
    <Modal onClose={() => !saving && onClose()} wide>
      <div className="fvs-modal-head">
        <div>
          <h3>➕ {isRTL ? 'فتح مواعيد زيارات' : 'Open visit slots'}</h3>
          <div className="fvs-modal-sub">{isRTL ? 'اختر الأيام ثم حدد الوقت والعدد — يُفتح الموعد نفسه في كل يوم مختار.' : 'Pick the days, then the time and capacity — the same slot opens on every selected day.'}</div>
        </div>
        <button type="button" className="fvs-x" onClick={onClose} aria-label={isRTL ? 'إغلاق' : 'Close'}>✕</button>
      </div>

      {result ? (
        <>
          <div className="fvs-modal-body">
            <div className="fvs-result ok">✓ {isRTL ? `تم فتح ${result.created?.length || 0} موعد` : `${result.created?.length || 0} slot(s) opened`}</div>
            {Array.isArray(result.skipped) && result.skipped.length > 0 && (
              <div className="fvs-result warn">
                <div>{isRTL ? `تم تجاوز ${result.skipped.length} يوم لوجود موعد متداخل في نفس الوقت:` : `${result.skipped.length} day(s) skipped — an overlapping slot already exists:`}</div>
                <div className="fvs-picked">
                  {result.skipped.map(d => <span key={d} className="fvs-pill">{fmtShort(d)}</span>)}
                </div>
              </div>
            )}
          </div>
          <div className="fvs-modal-foot">
            <button type="button" className="fvs-btn" onClick={reset}>{isRTL ? 'فتح مواعيد أخرى' : 'Open more'}</button>
            <button type="button" className="fvs-primary" onClick={onClose}>{isRTL ? 'تم' : 'Done'}</button>
          </div>
        </>
      ) : (
        <>
          <div className="fvs-modal-body fvs-create">
            <div className="fvs-picker">
              <div className="fvs-monthnav compact">
                <button type="button" onClick={() => setMonth(m => shiftMonth(m, -1))} disabled={month <= monthKey(today)} aria-label={isRTL ? 'الشهر السابق' : 'Previous month'}>{isRTL ? '›' : '‹'}</button>
                <div className="fvs-month">{monthLabel}</div>
                <button type="button" onClick={() => setMonth(m => shiftMonth(m, 1))} aria-label={isRTL ? 'الشهر التالي' : 'Next month'}>{isRTL ? '‹' : '›'}</button>
              </div>
              <div className="fvs-mini">
                {WEEKDAYS[lang].map(w => <div key={w} className="fvs-weekday">{w}</div>)}
                {cells.map((iso, i) => {
                  if (!iso) return <div key={`b${i}`} />;
                  const past = iso < today;
                  const on = selected.has(iso);
                  const n = existing.get(iso) || 0;
                  return (
                    <button
                      type="button"
                      key={iso}
                      disabled={past}
                      className={`fvs-mini-day ${on ? 'on' : ''} ${workingDays.includes(weekdayOf(iso)) ? '' : 'off'}`}
                      onClick={() => toggle(iso)}
                      aria-pressed={on}
                      title={n ? (isRTL ? `${n} موعد قائم` : `${n} existing slot(s)`) : ''}
                    >
                      {Number(iso.slice(8))}
                      {n > 0 && <span className="fvs-mini-mark" />}
                    </button>
                  );
                })}
              </div>
              <div className="fvs-picker-tools">
                <button type="button" className="fvs-link" onClick={selectWorkingDays}>{isRTL ? 'تحديد أيام العمل في هذا الشهر' : 'Select working days this month'}</button>
                <button type="button" className="fvs-link" onClick={clearMonth}>{isRTL ? 'مسح تحديد هذا الشهر' : 'Clear this month'}</button>
              </div>
              <div className="fvs-picked-head">
                {isRTL ? `الأيام المختارة: ${sortedSelected.length}` : `Selected days: ${sortedSelected.length}`}
              </div>
              <div className="fvs-picked">
                {sortedSelected.length === 0
                  ? <span className="fvs-muted">{isRTL ? 'لم يتم اختيار أي يوم بعد' : 'No days selected yet'}</span>
                  : sortedSelected.map(d => (
                    <button type="button" key={d} className="fvs-pill" onClick={() => toggle(d)} title={isRTL ? 'إزالة' : 'Remove'}>{fmtShort(d)} ✕</button>
                  ))}
              </div>
            </div>

            <div className="fvs-form-grid">
              <label className="fvs-field">
                <span>{isRTL ? 'من الساعة' : 'From'}</span>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </label>
              <label className="fvs-field">
                <span>{isRTL ? 'إلى الساعة' : 'To'}</span>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
              </label>
              <label className="fvs-field span2">
                <span>{isRTL ? 'العدد المسموح (أقصى عدد زوار للمجموعة)' : 'Capacity (max visitors in the group)'}</span>
                <input type="number" min="1" max="1000" value={capacity} onChange={e => setCapacity(e.target.value)} />
                {parseInt(capacity, 10) > 0 && (
                  <small>{isRTL
                    ? `مجموعة بهذا العدد تحتاج ${2 * Math.ceil(parseInt(capacity, 10) / 15)} مرافقين على الأقل (2 لكل 15 زائراً)`
                    : `A group this size needs at least ${2 * Math.ceil(parseInt(capacity, 10) / 15)} instructors (2 per 15 visitors)`}</small>
                )}
              </label>
              <label className="fvs-field span2">
                <span>{isRTL ? 'ملاحظات (داخلية، اختيارية)' : 'Notes (internal, optional)'}</span>
                <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
              </label>
            </div>
          </div>
          <div className="fvs-modal-foot">
            <button type="button" className="fvs-btn" onClick={onClose} disabled={saving}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
            <button type="button" className="fvs-primary" onClick={submit} disabled={saving || sortedSelected.length === 0}>
              {saving
                ? (isRTL ? 'جارٍ الفتح…' : 'Opening…')
                : (isRTL ? `فتح ${sortedSelected.length || ''} موعد` : `Open ${sortedSelected.length || ''} slot(s)`)}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
};

export default FablabVisitSlots;
