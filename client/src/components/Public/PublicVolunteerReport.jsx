import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import './Public.css';
import { exportVolunteerReport } from './excelExport';

// Match the app-wide api.js logic — relative `/api` in production so the
// public page works when served from https://fablabsahsa.com, dev-only
// localhost fallback otherwise.
const API_URL = process.env.NODE_ENV === 'production'
  ? '/api'
  : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');

// Arabic day-of-week names (Sunday-indexed to match server working days)
const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const todayISO = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const d = parts.find(p => p.type === 'day').value;
  return `${y}-${m}-${d}`;
};

const fmtTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(d);
};

const fmtDate = (isoDate) => {
  if (!isoDate) return '';
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    year: 'numeric', month: 'long', day: 'numeric'
  }).format(new Date(isoDate + 'T00:00:00'));
};

// Duration in H:MM clock form (e.g. 2:30 → 2 hours 30 min). Matches the
// check-in / check-out columns visually and avoids bidi weirdness that
// happens when mixing Arabic letters (س / د) with digits inside RTL
// table cells.
const fmtDuration = (minutes) => {
  if (minutes === null || minutes === undefined || minutes < 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
};

const dayOfWeekAr = (isoDate) => {
  const d = new Date(isoDate + 'T00:00:00');
  return AR_DAYS[d.getDay()];
};

const PublicVolunteerReport = () => {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true, error: null, data: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${API_URL}/public/volunteer/${token}`);
        if (!cancelled) setState({ loading: false, error: null, data });
      } catch (err) {
        if (!cancelled) {
          const status = err.response?.status;
          setState({
            loading: false,
            error: status === 404
              ? 'الرابط غير صالح أو تم إيقاف المشاركة.'
              : 'تعذر تحميل البيانات. يرجى المحاولة لاحقاً.',
            data: null
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const stats = useMemo(() => {
    if (!state.data) return null;
    const att = state.data.attendance || [];
    const totalDays = att.filter(a => a.checkInAt).length;
    const totalMinutes = att.reduce((s, r) => s + (r.minutes || 0), 0);
    const openDays = att.filter(a => a.checkInAt && !a.checkOutAt).length;
    return {
      totalDays,
      totalHours: (totalMinutes / 60).toFixed(1),
      openDays,
      lastVisit: att[0]?.date || null
    };
  }, [state.data]);

  useEffect(() => {
    if (state.data?.volunteer?.name) {
      document.title = `${state.data.volunteer.name} — تقرير التطوع | FABLAB SAHSA`;
    } else {
      document.title = 'تقرير التطوع | FABLAB SAHSA';
    }
  }, [state.data]);

  if (state.loading) {
    return (
      <div className="pub-shell">
        <div className="pub-center"><div className="pub-loader" /></div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="pub-shell">
        <div className="pub-center">
          <div className="pub-error">
            <h2>الرابط غير متاح</h2>
            <p>{state.error}</p>
          </div>
        </div>
      </div>
    );
  }

  const v = state.data.volunteer;
  const att = state.data.attendance || [];
  const today = todayISO();

  return (
    <div className="pub-shell">
      <div className="pub-wrap">
        <div className="pub-brand">
          <div className="pub-brand-mark">FL</div>
          <div className="pub-brand-text">
            <b>فاب لاب الأحساء</b>
            <span>تقرير متطوع</span>
          </div>
        </div>

        <div className="pub-header">
          <div className="pub-header-top">
            <div>
              <div className="pub-kicker">تقرير متطوع</div>
              <h1 className="pub-title">{v.name}</h1>
              {v.summerProgram && (
                <div className="pub-subtitle">
                  <span
                    className="pub-program-chip"
                    style={v.summerProgram.color ? { borderColor: v.summerProgram.color + '55', color: v.summerProgram.color } : {}}
                  >
                    {v.summerProgram.name}
                  </span>
                </div>
              )}
            </div>
            <span className="pub-badge">
              <span className="pub-badge-dot" />
              مشاركة مفعّلة
            </span>
          </div>

          <div className="pub-info-grid">
            <div className="pub-info">
              <div className="pub-info-label">الاسم الكامل</div>
              <div className="pub-info-value text">{v.name}</div>
            </div>
            <div className="pub-info">
              <div className="pub-info-label">رقم الهوية</div>
              <div className="pub-info-value">{v.nationalId}</div>
            </div>
            <div className="pub-info">
              <div className="pub-info-label">رقم الجوال</div>
              <div className="pub-info-value">{v.phone}</div>
            </div>
            {v.email && (
              <div className="pub-info">
                <div className="pub-info-label">البريد الإلكتروني</div>
                <div className="pub-info-value">{v.email}</div>
              </div>
            )}
          </div>

          {v.driveUrl ? (
            <a
              href={v.driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pub-drive"
            >
              <svg className="pub-drive-icon" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path fill="#fff" d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"/>
                <path fill="#fff" d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z"/>
                <path fill="#fff" d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"/>
                <path fill="#fff" d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z"/>
                <path fill="#fff" d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"/>
                <path fill="#fff" d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"/>
              </svg>
              فتح مجلد Google Drive الخاص بالمتطوع
            </a>
          ) : (
            <div className="pub-drive-empty">
              لم يتم إضافة رابط مجلد Google Drive بعد.
            </div>
          )}
        </div>

        {stats && (
          <div className="pub-stats">
            <div className="pub-stat brand">
              <div className="pub-stat-label">إجمالي الأيام</div>
              <div className="pub-stat-value">{stats.totalDays}</div>
            </div>
            <div className="pub-stat cyan">
              <div className="pub-stat-label">إجمالي الساعات</div>
              <div className="pub-stat-value">{stats.totalHours}</div>
            </div>
            <div className="pub-stat amber">
              <div className="pub-stat-label">جلسات مفتوحة</div>
              <div className="pub-stat-value">{stats.openDays}</div>
            </div>
            <div className="pub-stat mint">
              <div className="pub-stat-label">آخر زيارة</div>
              <div className="pub-stat-value" style={{ fontSize: 15, marginTop: 10 }}>
                {stats.lastVisit ? fmtDate(stats.lastVisit) : '—'}
              </div>
            </div>
          </div>
        )}

        <div className="pub-panel">
          <div className="pub-panel-title">
            <h3>سجل الحضور</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span className="pub-panel-hint">{att.length} {att.length === 1 ? 'سجل' : 'سجلات'}</span>
              {att.length > 0 && (
                <button
                  type="button"
                  className="pub-btn brand"
                  onClick={() => exportVolunteerReport(v, att)}
                  title="تحميل ملف Excel يحتوي على جميع البيانات"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  تحميل Excel
                </button>
              )}
            </div>
          </div>

          {att.length === 0 ? (
            <div className="pub-cell-empty" style={{ padding: '24px', textAlign: 'center' }}>
              لا توجد سجلات حضور بعد.
            </div>
          ) : (
            <div className="pub-table-wrap">
              <table className="pub-table">
                <thead>
                  <tr>
                    <th>اليوم</th>
                    <th>التاريخ</th>
                    <th>وقت الدخول</th>
                    <th>وقت الخروج</th>
                    <th>المدة (س:د)</th>
                  </tr>
                </thead>
                <tbody>
                  {att.map((r) => (
                    <tr key={r.date}>
                      <td>
                        {r.date === today && <span className="pub-today-mark">اليوم</span>}
                        {dayOfWeekAr(r.date)}
                      </td>
                      <td className="pub-num">{r.date}</td>
                      <td className="pub-time">{fmtTime(r.checkInAt) || '—'}</td>
                      <td className="pub-time">{fmtTime(r.checkOutAt) || <span className="pub-cell-empty">جارٍ الآن</span>}</td>
                      <td className="pub-num">{fmtDuration(r.minutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="pub-footer">
          <span>© {new Date().getFullYear()} فاب لاب الأحساء</span>
          <span>fablabsahsa.com</span>
        </div>
      </div>
    </div>
  );
};

export default PublicVolunteerReport;
