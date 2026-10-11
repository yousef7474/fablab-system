import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';
import './EducationTeachers.css';

// Teachers / instructors who registered through an education workshop's
// school link: per-workshop section (students view) and an all-workshops
// requirements board (Education toolbar).

const ROOM_TONE = { digital: 'cyan', future: 'violet', alrashed: 'amber' };
// Same list as server/utils/eduRooms.js (the API also sends it).
const ROOMS = [
  { id: 'digital', ar: 'قاعة الديجتال', en: 'Digital Hall' },
  { id: 'future', ar: 'قاعة المستقبل', en: 'Future Hall' },
  { id: 'alrashed', ar: 'قاعة الراشد', en: 'Al-Rashed Hall' }
];

const fmtDate = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
const fmtTime = (t) => (t ? String(t).slice(0, 5) : '');
const fmtSize = (n) => {
  const b = Number(n) || 0;
  if (!b) return '';
  return b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
};
const fmtStamp = (iso, isRTL) => {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {
      timeZone: 'Asia/Riyadh', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'
    }).format(new Date(iso));
  } catch { return String(iso).slice(0, 16); }
};

// "Last day to register" for an education workshop card / header.
export const fmtDeadline = (iso, isRTL) => {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {
      timeZone: 'Asia/Riyadh', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'
    }).format(new Date(iso));
  } catch { return iso; }
};

// First letter of the name, skipping a title such as «أ.» or «م.».
const initialOf = (name) => (String(name || '?').trim().replace(/^(أ|ا|م|د|Mr|Ms|Mrs|Dr)\.?\s+/i, '').charAt(0) || '?');

const openTeacherFile = (teacherId) => {
  const token = localStorage.getItem('adminToken') || '';
  window.open(`${api.defaults.baseURL}/workshops/teachers/${teacherId}/file?token=${encodeURIComponent(token)}`, '_blank');
};

export const RoomBadge = ({ room, label, isRTL, rooms }) => {
  const r = (rooms && rooms.length ? rooms : ROOMS).find(x => x.id === room);
  const text = r ? (isRTL ? r.ar : r.en) : (label || room || '—');
  return <span className={`edt-room ${ROOM_TONE[room] || ''}`}>🏫 {text}</span>;
};

// Long requirements collapse to a few lines with a toggle.
const Requirements = ({ text, isRTL }) => {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const long = text.length > 220 || text.split('\n').length > 4;
  return (
    <div className="edt-req">
      <div className="edt-req-label">{isRTL ? 'المتطلبات' : 'Requirements'}</div>
      <div className={`edt-req-text ${long && !open ? 'is-clamped' : ''}`}>{text}</div>
      {long && (
        <button type="button" className="edt-link" onClick={() => setOpen(v => !v)}>
          {open ? (isRTL ? 'عرض أقل' : 'Show less') : (isRTL ? 'عرض المزيد' : 'Show more')}
        </button>
      )}
    </div>
  );
};

const FileButton = ({ t, isRTL }) => {
  if (!t.requirementsFileName) return null;
  return (
    <button type="button" className="edt-file" onClick={() => openTeacherFile(t.teacherId)} title={isRTL ? 'فتح الملف المرفق' : 'Open the attached file'}>
      📎 <span className="edt-file-name" dir="auto">{t.requirementsFileName}</span>
      {t.requirementsFileSize ? <span className="edt-file-size" dir="ltr">{fmtSize(t.requirementsFileSize)}</span> : null}
    </button>
  );
};

// ─────────── Per-workshop section (students view) ───────────
export const EduTeachersSection = ({ workshop, isRTL, onChanged }) => {
  const teachers = Array.isArray(workshop?.teachers) ? workshop.teachers : [];
  const [busyId, setBusyId] = useState(null);
  const link = `${window.location.origin}/workshop/${workshop.workshopId}`;

  const remove = async (t) => {
    if (!window.confirm(isRTL ? `حذف تسجيل المعلم «${t.fullName}»؟` : `Remove ${t.fullName}'s registration?`)) return;
    setBusyId(t.teacherId);
    try {
      await api.delete(`/workshops/teachers/${t.teacherId}`);
      toast.success(isRTL ? 'تم حذف المعلم' : 'Teacher removed');
      onChanged && onChanged();
    } catch (e) {
      const d = e.response?.data;
      toast.error((isRTL ? d?.messageAr : d?.message) || (isRTL ? 'تعذّر الحذف' : 'Could not remove'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="edt-section">
      <div className="edt-section-head">
        <h4>👩‍🏫 {isRTL ? 'المعلمون والمدربون' : 'Teachers & instructors'} <span className="edt-count">{teachers.length}</span></h4>
        {workshop.registrationDeadline && (
          <span className="edt-deadline">
            ⏰ {isRTL ? 'آخر موعد للتسجيل:' : 'Registration deadline:'} <b>{fmtDeadline(workshop.registrationDeadline, isRTL)}</b>
            {workshop.registrationForceOpen && <em className="edt-forced">{isRTL ? ' · مفتوح استثنائياً' : ' · opened as an exception'}</em>}
          </span>
        )}
      </div>

      {teachers.length === 0 ? (
        <div className="edt-empty">
          <p>{isRTL
            ? 'لم يسجّل أي معلم أو مدرب بعد. يسجّل المعلمون عبر رابط المدرسة نفسه باختيار «التسجيل كمعلم أو مدرب»، ويختارون القاعة ويكتبون متطلباتهم أو يرفعون ملفاً بها.'
            : 'No teacher has registered yet. Teachers use the same school link, choose “Register as a teacher or instructor”, pick a room and write or upload their requirements.'}</p>
          <button type="button" className="edt-btn ghost" onClick={() => navigator.clipboard.writeText(link).then(
            () => toast.success(isRTL ? 'تم نسخ رابط المدرسة' : 'School link copied'),
            () => window.prompt(isRTL ? 'رابط المدرسة:' : 'School link:', link)
          )}>🔗 {isRTL ? 'نسخ رابط المدرسة' : 'Copy school link'}</button>
        </div>
      ) : (
        <div className="edt-list">
          {teachers.map(t => (
            <motion.article key={t.teacherId} layout className="edt-card" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <div className="edt-card-top">
                <div className="edt-avatar" aria-hidden="true">{initialOf(t.fullName)}</div>
                <div className="edt-who">
                  <div className="edt-name">{t.fullName}</div>
                  <div className="edt-job">{t.jobTitle}</div>
                </div>
                <RoomBadge room={t.room} label={t.roomLabel} isRTL={isRTL} />
              </div>
              <div className="edt-contact">
                <a href={`tel:${String(t.phone || '').replace(/[^0-9+]/g, '')}`} dir="ltr">📞 {t.phone}</a>
                <a href={`mailto:${t.email}`} dir="ltr">✉️ {t.email}</a>
                {t.nationalId && <span dir="ltr">🪪 {t.nationalId}</span>}
              </div>
              <Requirements text={t.requirements} isRTL={isRTL} />
              <div className="edt-card-foot">
                <FileButton t={t} isRTL={isRTL} />
                <span className="edt-meta">
                  {isRTL ? 'سُجّل' : 'Registered'} {fmtStamp(t.createdAt, isRTL)}
                  {' · '}
                  {t.confirmationSentAt
                    ? (isRTL ? '✉️ أُرسل التأكيد' : '✉️ Confirmation sent')
                    : (isRTL ? '✉️ لم يُرسل التأكيد' : '✉️ Confirmation not sent')}
                </span>
                <button type="button" className="edt-btn danger" disabled={busyId === t.teacherId} onClick={() => remove(t)}>
                  🗑 {isRTL ? 'حذف' : 'Remove'}
                </button>
              </div>
            </motion.article>
          ))}
        </div>
      )}
    </section>
  );
};

// ─────────── All teachers' requirements (Education toolbar) ───────────
export const EduTeachersModal = ({ isRTL, onClose }) => {
  const [includePast, setIncludePast] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [roomFilter, setRoomFilter] = useState('all');

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    api.get('/workshops/admin/edu-teachers', { params: includePast ? {} : { upcoming: 1 } })
      .then(res => { if (alive) setData(res.data); })
      .catch(err => {
        if (!alive) return;
        const d = err?.response?.data;
        setError((isRTL ? d?.messageAr : d?.message) || (isRTL ? 'تعذّر تحميل المتطلبات' : 'Could not load the requirements'));
      });
    return () => { alive = false; };
  }, [includePast, isRTL]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rooms = useMemo(() => data?.rooms || [], [data]);
  const teachers = useMemo(() => data?.teachers || [], [data]);
  const roomCounts = useMemo(() => {
    const m = {};
    teachers.forEach(t => { m[t.room] = (m[t.room] || 0) + 1; });
    return m;
  }, [teachers]);
  const shown = roomFilter === 'all' ? teachers : teachers.filter(t => t.room === roomFilter);
  const groups = useMemo(() => {
    const map = new Map();
    shown.forEach(t => {
      const key = t.workshop?.workshopId || t.workshopId;
      if (!map.has(key)) map.set(key, { workshop: t.workshop, teachers: [] });
      map.get(key).teachers.push(t);
    });
    return [...map.values()];
  }, [shown]);

  const exportCsv = () => {
    const fmt = (v) => {
      const s = String(v == null ? '' : v).replace(/"/g, '""');
      return /[",\n\r]/.test(s) ? `"${s}"` : s;
    };
    const header = ['الورشة', 'تاريخ البداية', 'تاريخ النهاية', 'الوقت', 'المعلم', 'الوظيفة / التخصص', 'الجوال', 'البريد', 'رقم الهوية', 'القاعة', 'المتطلبات', 'الملف المرفق', 'تاريخ التسجيل'];
    const rows = shown.map(t => {
      const w = t.workshop || {};
      const room = rooms.find(r => r.id === t.room);
      return [
        w.title || '', w.startDate || '', w.endDate || '',
        w.startTime ? `${fmtTime(w.startTime)}${w.endTime ? ` - ${fmtTime(w.endTime)}` : ''}` : '',
        t.fullName, t.jobTitle, t.phone, t.email, t.nationalId || '',
        room ? room.ar : (t.roomLabel || t.room), t.requirements || '', t.requirementsFileName || '',
        t.createdAt ? String(t.createdAt).slice(0, 10) : ''
      ];
    });
    const csv = '﻿' + [header, ...rows].map(r => r.map(fmt).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `teachers-requirements-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        className="modal-content wsr edt-modal"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        role="dialog"
        aria-modal="true"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="wsr-head">
          <div>
            <span className="wsr-kicker">📋 {isRTL ? 'الورش التعليمية' : 'Education workshops'}</span>
            <h3>{isRTL ? 'متطلبات المعلمين والمدربين' : "Teachers' requirements"}</h3>
          </div>
          <button type="button" className="wsr-close" onClick={onClose} aria-label={isRTL ? 'إغلاق' : 'Close'}>✕</button>
        </div>

        <div className="wsr-body">
          <div className="edt-toolbar">
            <label className="edt-check">
              <input type="checkbox" checked={includePast} onChange={e => setIncludePast(e.target.checked)} />
              {isRTL ? 'إظهار الورش المنتهية' : 'Include past workshops'}
            </label>
            <div className="edt-chips" role="tablist">
              <button type="button" className={`edt-chip ${roomFilter === 'all' ? 'on' : ''}`} onClick={() => setRoomFilter('all')}>
                {isRTL ? 'كل القاعات' : 'All rooms'} <b>{teachers.length}</b>
              </button>
              {rooms.map(r => (
                <button key={r.id} type="button" className={`edt-chip ${ROOM_TONE[r.id] || ''} ${roomFilter === r.id ? 'on' : ''}`} onClick={() => setRoomFilter(r.id)}>
                  {isRTL ? r.ar : r.en} <b>{roomCounts[r.id] || 0}</b>
                </button>
              ))}
            </div>
          </div>

          {error && <div className="wsr-empty">{error}</div>}
          {!error && !data && <div className="wsr-empty">{isRTL ? 'جارٍ التحميل…' : 'Loading…'}</div>}
          {data && groups.length === 0 && (
            <div className="wsr-empty">
              {isRTL ? 'لا يوجد معلمون مسجلون في الورش التعليمية القادمة بعد.' : 'No teachers have registered for upcoming education workshops yet.'}
            </div>
          )}

          {groups.map(g => (
            <div key={g.workshop?.workshopId || g.teachers[0].teacherId} className="edt-group">
              <div className="edt-group-head">
                <b>{g.workshop?.title || '—'}</b>
                <span dir="ltr">
                  {fmtDate(g.workshop?.startDate)}{g.workshop?.endDate && g.workshop.endDate !== g.workshop.startDate ? ` → ${fmtDate(g.workshop.endDate)}` : ''}
                  {g.workshop?.startTime ? ` · ${fmtTime(g.workshop.startTime)}${g.workshop.endTime ? `–${fmtTime(g.workshop.endTime)}` : ''}` : ''}
                </span>
              </div>
              {g.teachers.map(t => (
                <div key={t.teacherId} className="edt-row">
                  <div className="edt-row-main">
                    <div className="edt-row-who">
                      <b>{t.fullName}</b>
                      <span>{t.jobTitle}</span>
                    </div>
                    <RoomBadge room={t.room} label={t.roomLabel} isRTL={isRTL} rooms={rooms} />
                  </div>
                  <div className="edt-contact">
                    <a href={`tel:${String(t.phone || '').replace(/[^0-9+]/g, '')}`} dir="ltr">📞 {t.phone}</a>
                    <a href={`mailto:${t.email}`} dir="ltr">✉️ {t.email}</a>
                  </div>
                  <Requirements text={t.requirements} isRTL={isRTL} />
                  <FileButton t={t} isRTL={isRTL} />
                  {!t.requirements && !t.requirementsFileName && (
                    <div className="edt-meta">{isRTL ? 'لا توجد متطلبات مكتوبة.' : 'No written requirements.'}</div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="wsr-foot">
          {shown.length > 0 && (
            <button type="button" className="wsr-btn" onClick={exportCsv}>📥 {isRTL ? 'تصدير CSV' : 'Export CSV'}</button>
          )}
          <button type="button" className="wsr-btn ghost" onClick={onClose}>{isRTL ? 'إغلاق' : 'Close'}</button>
        </div>
      </motion.div>
    </div>
  );
};
