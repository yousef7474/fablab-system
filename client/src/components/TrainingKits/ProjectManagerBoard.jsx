import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import employeeApi from '../../config/employeeApi';
import KitList from './KitList';
import KitReview from './KitReview';
import { errorText } from './kitApi';
import { KIT_KIND } from './kinds';
import { PLAN_KIND } from '../ExecutionPlans/planKind';
import { WR_KIND } from '../Requests/workshop/wrKind';
import { FR_KIND } from '../Requests/finance/frKind';
import { MEDIA_KIND } from '../Requests/media/mediaKind';
import MediaReview from '../Requests/media/MediaReview';
import '../Employee/Employee.css';
import './TrainingKits.css';
import '../ExecutionPlans/Plans.css';
import '../Employee/Employee.fx.css';
// Dashboard theme — imported last so it sits on top of the CSS above.
import '../../styles/fx.css';

// لوحة إدارة المشاريع — the project manager's own board (an employee login
// flagged as مسؤول إدارة المشاريع). Training kits and execution plans
// waiting for her review, and every one that passed through her, each with
// its full history and files.
const TYPES = [
  { key: 'kits', kind: KIT_KIND, label: 'الحقائب التدريبية', plural: 'الحقائب', none: 'لا توجد حقائب' },
  { key: 'plans', kind: PLAN_KIND, label: 'الخطط التنفيذية', plural: 'الخطط', none: 'لا توجد خطط' },
  { key: 'workshops', kind: WR_KIND, label: 'طلبات الورش', plural: 'طلبات الورش', none: 'لا توجد طلبات ورش' },
  { key: 'finance', kind: FR_KIND, label: 'طلبات الصرف', plural: 'طلبات الصرف', none: 'لا توجد طلبات صرف' },
  // The design request has its own line: designer ⇄ employee before it
  // reaches the PM, so «معادة» means «with the designer or the employee».
  { key: 'media', kind: MEDIA_KIND, label: 'طلبات التصميم', plural: 'طلبات التصميم', none: 'لا توجد طلبات تصميم', returnedLabel: 'لدى التصميم أو المنفذ' }
];
// Sidebar icon tiles for the document types.
const TYPE_ICON_PATHS = {
  kits: ['M5 7h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z', 'M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2', 'M3 13h18'],
  plans: ['M4 22V4', 'M4 4h12l-2 4 2 4H4'],
  workshops: ['M22 10L12 5 2 10l10 5 10-5z', 'M6 12v5c3 2 9 2 12 0v-5'],
  finance: ['M12 1v22', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'],
  media: ['M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M18.5 5.5a9 9 0 0 1 0 13']
};
const TypeIcon = ({ name }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {(TYPE_ICON_PATHS[name] || TYPE_ICON_PATHS.kits).map(d => <path key={d} d={d} />)}
  </svg>
);

const TABS = [
  { key: 'queue', label: 'بانتظار مراجعتي', icon: '⏳' },
  { key: 'manager', label: 'لدى المدير', icon: '📤' },
  { key: 'returned', label: 'معادة للتعديل', icon: '↩' },
  { key: 'approved', label: 'المعتمدة', icon: '✓' },
  { key: 'all', label: 'الكل', icon: '🗂' }
];
const inTab = (k, key) => ({
  queue: k.status === 'pm_review',
  manager: k.status === 'manager_review',
  returned: ['returned', 'design', 'employee_check', 'returned_employee'].includes(k.status),
  approved: k.status === 'approved',
  all: true
}[key]);

const ProjectManagerBoard = () => {
  const navigate = useNavigate();
  const [dashRoot, setDashRoot] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('employeeTheme') || 'dark');
  const [me, setMe] = useState(null); // { isPM, pmName }
  const [lists, setLists] = useState({});
  const [type, setType] = useState(() => { const t = localStorage.getItem('pmBoardType'); return TYPES.some(x => x.key === t) ? t : 'kits'; });
  const [tab, setTab] = useState('queue');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);
  // Sidebar drawer on small screens.
  const [navOpen, setNavOpen] = useState(false);
  const employee = useMemo(() => { try { return JSON.parse(localStorage.getItem('employeeData') || 'null'); } catch { return null; } }, []);
  const T = TYPES.find(t => t.key === type);

  useEffect(() => {
    if (!localStorage.getItem('employeeToken')) { navigate('/employee/login'); return; }
    employeeApi.get('/training-kits/pm/status').then(({ data }) => setMe(data)).catch(() => setMe({ isPM: false }));
  }, [navigate]);

  const load = useCallback(async () => {
    const next = {};
    await Promise.all(TYPES.map(async (t) => {
      try {
        const { data } = await employeeApi.get(t.kind.routes.pm.list);
        next[t.key] = Array.isArray(data) ? data : [];
      } catch (err) {
        next[t.key] = [];
        toast.error(errorText(err, `تعذّر تحميل ${t.label}`));
      }
    }));
    setLists(next);
  }, []);
  useEffect(() => { if (me?.isPM) load(); }, [me, load]);

  const toggleTheme = () => setTheme(t => { const n = t === 'dark' ? 'light' : 'dark'; localStorage.setItem('employeeTheme', n); return n; });
  const switchType = (key) => { setType(key); setOpen(null); setSearch(''); try { localStorage.setItem('pmBoardType', key); } catch { /* ignore */ } };

  const docs = lists[type] || [];
  const q = search.trim().toLowerCase();
  const shown = docs.filter(k => inTab(k, tab)
    && (!q || `${k.title || ''} ${k.author?.name || ''} ${T.kind.fmtNo(k.number)}`.toLowerCase().includes(q)));

  return (
    <div ref={setDashRoot} className={`employee-dashboard fx pm-board ${navOpen ? 'nav-open' : ''}`} dir="rtl" data-page="employee" data-theme={theme}>
      {/* Sidebar — the document types waiting for review */}
      <aside className="emp-side" aria-label="أنواع المستندات">
        <div className="emp-side-brand">
          <span className="emp-side-logo"><img src="/logo.png" alt="" /></span>
          <span className="emp-side-brand-text">
            <b>FABLAB</b>
            <small>لوحة إدارة المشاريع</small>
          </span>
          <button type="button" className="emp-side-close" onClick={() => setNavOpen(false)} aria-label="إغلاق القائمة">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="emp-side-me">
          <span className="emp-side-avatar" aria-hidden="true">{(employee?.name || '؟').trim().charAt(0)}</span>
          <span className="emp-side-me-text">
            <b>{employee?.name}</b>
            <small>مسؤول إدارة المشاريع</small>
          </span>
        </div>
        {me && me.isPM && (
          <nav className="ep-kindswitch emp-nav" role="tablist" aria-label="نوع المستندات">
            {TYPES.map(t => {
              const waiting = (lists[t.key] || []).filter(k => k.status === 'pm_review').length;
              return (
                <button key={t.key} type="button" role="tab" className={`emp-tab ${type === t.key ? 'active' : ''}`} aria-selected={type === t.key} onClick={() => { switchType(t.key); setNavOpen(false); }}>
                  <span className="emp-tab-icon"><TypeIcon name={t.key} /></span>
                  <span className="emp-tab-label">{t.label}</span>
                  {waiting > 0 && <span className="c" title="بانتظار مراجعتك">{waiting}</span>}
                </button>
              );
            })}
          </nav>
        )}
        <div className="emp-side-foot">
          <button type="button" className="emp-side-link" onClick={() => navigate('/employee/dashboard')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>
            <span>العودة إلى لوحة الموظف</span>
          </button>
        </div>
      </aside>
      <div className="emp-scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />

      <div className="emp-main">
      <header className="emp-topbar">
        <div className="emp-topbar-left">
          <button type="button" className="emp-hamburger" onClick={() => setNavOpen(true)} aria-label="فتح القائمة" aria-expanded={navOpen}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
          </button>
          <div className="emp-brand-block">
            <span className="emp-badge">لوحة إدارة المشاريع</span>
            <h1 className="emp-logo">{T.label}</h1>
          </div>
        </div>
        <div className="emp-topbar-right">
          <button className="emp-theme-btn" onClick={toggleTheme} aria-label="تبديل المظهر" title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}>
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
          <div className="emp-user-info">
            <span className="emp-user-avatar" aria-hidden="true">{(employee?.name || '؟').trim().charAt(0)}</span>
            <span className="emp-user-text">
              <span className="emp-user-name">{employee?.name}</span>
              <span className="emp-user-section">مسؤول إدارة المشاريع</span>
            </span>
          </div>
          <button className="emp-logout-btn" onClick={() => navigate('/employee/dashboard')} title="لوحة الموظف" aria-label="لوحة الموظف">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>
          </button>
        </div>
      </header>

      {me && !me.isPM ? (
        <div className="emp-content">
          <div className="tk" data-theme={theme}>
            <div className="tk-blank">
              <span className="big">🔒</span>
              <b>هذه الصفحة مخصصة لمسؤول إدارة المشاريع</b>
              <span>{me.pmName ? `مسؤول إدارة المشاريع الحالي: ${me.pmName}.` : 'لم يُحدَّد مسؤول إدارة المشاريع بعد — يحدده المدير من «الحقائب التدريبية» في لوحة المدير.'}</span>
              <button type="button" className="tk-btn" onClick={() => navigate('/employee/dashboard')}>العودة إلى لوحة الموظف</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="emp-content">
          <div className="emp-tabs emp-seg" role="tablist" aria-label="حالة المستندات">
            {TABS.map((t) => {
              const n = docs.filter(k => inTab(k, t.key)).length;
              return (
                <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`emp-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
                  <span className="emp-tab-icon">{t.icon}</span>
                  <span className="emp-tab-label">{t.key === 'all' ? `كل ${T.plural}` : t.key === 'returned' && T.returnedLabel ? T.returnedLabel : t.label}</span>
                  {n > 0 && <span className="c">{n}</span>}
                </button>
              );
            })}
          </div>
          <div className="tk" data-theme={theme}>
            <div className="tk-tab-head">
              <div>
                <h3>{T.label} — {TABS.find(t => t.key === tab)?.label}</h3>
                <p>{tab === 'queue'
                  ? `${T.plural} التي أرسلها الموظفون لمراجعتك. افتح أيًّا منها لتراجع محتواها وسجل تعديلاتها وملفاتها، ثم اعتمدها للمدير أو أعدها مع ملاحظاتك.`
                  : `نسخة من كل ${type === 'kits' ? 'حقيبة' : 'خطة'} مرّت عليك، بكل إصداراتها وملفاتها — يمكنك تنزيلها أو طباعتها في أي وقت.`}</p>
              </div>
              <input className="tk-in" style={{ maxWidth: 280 }} placeholder={type === 'kits' ? 'بحث بالاسم أو الموظف أو الرقم…' : 'بحث بالفترة أو الموظف أو الرقم…'} value={search} onChange={(e) => setSearch(e.target.value)} aria-label="بحث" />
            </div>
            <KitList kits={shown} kind={T.kind} showAuthor onOpen={(k) => setOpen(k.id)} empty={{
              title: tab === 'queue' ? `${T.none} بانتظار مراجعتك` : `${T.none} هنا`,
              text: tab === 'queue' ? 'ستظهر هنا فور إرسال أي موظف للمراجعة، ويصلك بريد بذلك.' : ''
            }} />
          </div>
        </div>
      )}
      </div>{/* .emp-main */}

      {open && dashRoot && (T.key === 'media'
        ? <MediaReview api={employeeApi} role="pm" requestId={open} portalTarget={dashRoot} theme={theme}
            onClose={() => { setOpen(null); load(); }} onChanged={load} />
        : <KitReview api={employeeApi} scope="pm" kind={T.kind} kitId={open} portalTarget={dashRoot} theme={theme}
            onClose={() => { setOpen(null); load(); }} onChanged={load} />)}
    </div>
  );
};

export default ProjectManagerBoard;
