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
import '../Employee/Employee.css';
import './TrainingKits.css';
import '../ExecutionPlans/Plans.css';

// لوحة إدارة المشاريع — the project manager's own board (an employee login
// flagged as مسؤول إدارة المشاريع). Training kits and execution plans
// waiting for her review, and every one that passed through her, each with
// its full history and files.
const TYPES = [
  { key: 'kits', kind: KIT_KIND, label: 'الحقائب التدريبية', plural: 'الحقائب', none: 'لا توجد حقائب' },
  { key: 'plans', kind: PLAN_KIND, label: 'الخطط التنفيذية', plural: 'الخطط', none: 'لا توجد خطط' },
  { key: 'workshops', kind: WR_KIND, label: 'طلبات الورش', plural: 'طلبات الورش', none: 'لا توجد طلبات ورش' },
  { key: 'finance', kind: FR_KIND, label: 'طلبات الصرف', plural: 'طلبات الصرف', none: 'لا توجد طلبات صرف' }
];
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
  returned: k.status === 'returned',
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
    <div ref={setDashRoot} className="employee-dashboard" dir="rtl" data-page="employee" data-theme={theme}>
      <div className="emp-topbar">
        <div className="emp-topbar-left">
          <div className="emp-brand-mark" aria-hidden="true" />
          <div className="emp-brand-block">
            <h2 className="emp-logo">FABLAB</h2>
            <span className="emp-badge">لوحة إدارة المشاريع · {T.label}</span>
          </div>
        </div>
        <div className="emp-topbar-right">
          <button className="emp-theme-btn" onClick={toggleTheme} aria-label="تبديل المظهر" title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}>{theme === 'dark' ? '☀' : '☾'}</button>
          <div className="emp-user-info">
            <span className="emp-user-name">{employee?.name}</span>
            <span className="emp-user-section">مسؤول إدارة المشاريع</span>
          </div>
          <button className="emp-logout-btn" onClick={() => navigate('/employee/dashboard')} title="لوحة الموظف">↩</button>
        </div>
      </div>

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
        <>
          <div className="tk ep-kindbar" data-theme={theme}>
            <div className="ep-kindswitch" role="tablist" aria-label="نوع المستندات">
              {TYPES.map(t => {
                const waiting = (lists[t.key] || []).filter(k => k.status === 'pm_review').length;
                return (
                  <button key={t.key} type="button" role="tab" aria-selected={type === t.key} onClick={() => switchType(t.key)}>
                    <span aria-hidden="true">{t.kind.icon}</span> {t.label}
                    {waiting > 0 && <span className="c" title="بانتظار مراجعتك">{waiting}</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="emp-tabs">
            {TABS.map((t, i) => {
              const n = docs.filter(k => inTab(k, t.key)).length;
              return (
                <button key={t.key} className={`emp-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
                  <span className="emp-tab-key">{String(i + 1).padStart(2, '0')}</span>
                  <span className="emp-tab-icon">{t.icon}</span>
                  <span className="emp-tab-label">{t.key === 'all' ? `كل ${T.plural}` : t.label}{n ? ` (${n})` : ''}</span>
                  {tab === t.key && <span className="emp-tab-indicator" />}
                </button>
              );
            })}
          </div>
          <div className="emp-content">
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
        </>
      )}

      {open && dashRoot && (
        <KitReview api={employeeApi} scope="pm" kind={T.kind} kitId={open} portalTarget={dashRoot} theme={theme}
          onClose={() => { setOpen(null); load(); }} onChanged={load} />
      )}
    </div>
  );
};

export default ProjectManagerBoard;
