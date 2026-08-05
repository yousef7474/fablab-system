import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import './Public.css';
import { exportMasterReport, exportVolunteerReport } from './excelExport';

// Match the app-wide api.js logic — relative `/api` in production so the
// public page works when served from https://fablabsahsa.com, dev-only
// localhost fallback otherwise.
const API_URL = process.env.NODE_ENV === 'production'
  ? '/api'
  : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');

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

const fmtDuration = (minutes) => {
  if (minutes === null || minutes === undefined || minutes < 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}د`;
  if (m === 0) return `${h}س`;
  return `${h}س ${m}د`;
};

const dayOfWeekAr = (isoDate) => {
  const d = new Date(isoDate + 'T00:00:00');
  return AR_DAYS[d.getDay()];
};

const PublicAttendanceReport = () => {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${API_URL}/public/attendance-report/${token}`);
        if (!cancelled) setState({ loading: false, error: null, data });
      } catch (err) {
        if (!cancelled) {
          const status = err.response?.status;
          setState({
            loading: false,
            error: status === 404
              ? 'الرابط غير صالح أو تم إبطاله.'
              : 'تعذر تحميل التقرير. يرجى المحاولة لاحقاً.',
            data: null
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    document.title = 'تقرير المتطوعين المجمّع | FABLAB SAHSA';
  }, []);

  const filtered = useMemo(() => {
    if (!state.data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return state.data.volunteers;
    return state.data.volunteers.filter(v =>
      (v.name || '').toLowerCase().includes(q) ||
      (v.nationalId || '').includes(q) ||
      (v.phone || '').includes(q) ||
      (v.summerProgram?.name || '').toLowerCase().includes(q)
    );
  }, [state.data, search]);

  const totals = useMemo(() => {
    if (!state.data) return null;
    const volunteers = state.data.volunteers;
    const totalMinutes = volunteers.reduce((s, v) => s + (v.totalMinutes || 0), 0);
    const totalRecords = volunteers.reduce((s, v) => s + (v.attendance?.length || 0), 0);
    const today = todayISO();
    const activeToday = volunteers.filter(v =>
      (v.attendance || []).some(r => r.date === today && r.checkInAt)
    ).length;
    return {
      volunteerCount: volunteers.length,
      totalHours: (totalMinutes / 60).toFixed(1),
      totalRecords,
      activeToday
    };
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

  const today = todayISO();

  return (
    <div className="pub-shell">
      <div className="pub-wrap">
        <div className="pub-brand">
          <div className="pub-brand-mark">FL</div>
          <div className="pub-brand-text">
            <b>فاب لاب الأحساء</b>
            <span>تقرير المتطوعين المجمّع</span>
          </div>
        </div>

        <div className="pub-header">
          <div className="pub-header-top">
            <div>
              <div className="pub-kicker">تقرير مجمّع</div>
              <h1 className="pub-title">سجل المتطوعين</h1>
              <div className="pub-subtitle">
                جميع المتطوعين المفعّل لهم المشاركة، مع بياناتهم وسجل حضورهم اليومي.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className="pub-badge">
                <span className="pub-badge-dot" />
                مباشر
              </span>
              {state.data?.volunteers?.length > 0 && (
                <button
                  type="button"
                  className="pub-btn brand"
                  onClick={() => exportMasterReport(state.data.volunteers)}
                  title="تحميل جميع البيانات في ملف Excel واحد"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  تحميل Excel للجميع
                </button>
              )}
            </div>
          </div>
        </div>

        {totals && (
          <div className="pub-stats">
            <div className="pub-stat brand">
              <div className="pub-stat-label">عدد المتطوعين</div>
              <div className="pub-stat-value">{totals.volunteerCount}</div>
            </div>
            <div className="pub-stat cyan">
              <div className="pub-stat-label">إجمالي الساعات</div>
              <div className="pub-stat-value">{totals.totalHours}</div>
            </div>
            <div className="pub-stat amber">
              <div className="pub-stat-label">إجمالي السجلات</div>
              <div className="pub-stat-value">{totals.totalRecords}</div>
            </div>
            <div className="pub-stat mint">
              <div className="pub-stat-label">نشط اليوم</div>
              <div className="pub-stat-value">{totals.activeToday}</div>
            </div>
          </div>
        )}

        <input
          type="text"
          className="pub-search"
          placeholder="بحث بالاسم أو رقم الهوية أو رقم الجوال…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {filtered.length === 0 ? (
          <div className="pub-panel" style={{ textAlign: 'center' }}>
            <div className="pub-cell-empty">لا توجد نتائج مطابقة.</div>
          </div>
        ) : (
          filtered.map(v => {
            const programColor = v.summerProgram?.color || null;
            const style = programColor ? { '--program-color': programColor } : {};
            return (
              <div className="pub-vcard" key={v.volunteerId} style={style}>
                <div className="pub-vcard-head">
                  <div>
                    <div className="pub-vcard-name">
                      <span className="pub-vcard-dot" />
                      {v.name}
                      {v.summerProgram && (
                        <span
                          className="pub-program-chip"
                          style={programColor ? { borderColor: programColor + '55', color: programColor } : {}}
                        >
                          {v.summerProgram.name}
                        </span>
                      )}
                    </div>
                    <div className="pub-vcard-meta">
                      <span>الهوية: <b>{v.nationalId}</b></span>
                      <span>الجوال: <b>{v.phone}</b></span>
                      <span>الأيام: <b>{v.totalDays}</b></span>
                      <span>الساعات: <b>{(v.totalMinutes / 60).toFixed(1)}</b></span>
                    </div>
                  </div>
                  <div className="pub-vcard-actions">
                    {v.driveUrl && (
                      <a
                        href={v.driveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pub-btn drive"
                      >
                        فتح مجلد Drive
                      </a>
                    )}
                    <button
                      type="button"
                      className="pub-btn"
                      onClick={() => exportVolunteerReport(v, v.attendance || [])}
                      title="تحميل ملف Excel لهذا المتطوع"
                    >
                      تحميل Excel
                    </button>
                    <a
                      href={`/public/volunteer/${v.shareToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pub-btn brand"
                    >
                      عرض التقرير الفردي
                    </a>
                  </div>
                </div>

                {v.attendance && v.attendance.length > 0 && (
                  <div className="pub-vcard-atttable">
                    <div className="pub-table-wrap">
                      <table className="pub-table">
                        <thead>
                          <tr>
                            <th>اليوم</th>
                            <th>التاريخ</th>
                            <th>وقت الدخول</th>
                            <th>وقت الخروج</th>
                            <th>المدة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {v.attendance.map(r => (
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
                  </div>
                )}
              </div>
            );
          })
        )}

        <div className="pub-footer">
          <span>© {new Date().getFullYear()} فاب لاب الأحساء</span>
          <span>آخر تحديث: {state.data?.generatedAt ? new Date(state.data.generatedAt).toLocaleString('ar-SA') : '—'}</span>
        </div>
      </div>
    </div>
  );
};

export default PublicAttendanceReport;
