import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import employeeApi from '../../config/employeeApi';
import KitList from './KitList';
import KitReview from './KitReview';
import { errorText } from './kitApi';
import '../Employee/Employee.css';
import './TrainingKits.css';

// لوحة إدارة المشاريع — the project manager's own board (an employee login
// flagged as مسؤول إدارة المشاريع). Kits waiting for her review, and every
// kit that passed through her, each with its full history and files.
const TABS = [
  { key: 'queue', label: 'بانتظار مراجعتي', icon: '⏳' },
  { key: 'manager', label: 'لدى المدير', icon: '📤' },
  { key: 'returned', label: 'معادة للتعديل', icon: '↩' },
  { key: 'approved', label: 'المعتمدة', icon: '✓' },
  { key: 'all', label: 'كل الحقائب', icon: '🗂' }
];

const ProjectManagerBoard = () => {
  const navigate = useNavigate();
  const [dashRoot, setDashRoot] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('employeeTheme') || 'dark');
  const [me, setMe] = useState(null); // { isPM, pmName }
  const [kits, setKits] = useState([]);
  const [tab, setTab] = useState('queue');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);
  const employee = useMemo(() => { try { return JSON.parse(localStorage.getItem('employeeData') || 'null'); } catch { return null; } }, []);

  useEffect(() => {
    if (!localStorage.getItem('employeeToken')) { navigate('/employee/login'); return; }
    employeeApi.get('/training-kits/pm/status').then(({ data }) => setMe(data)).catch(() => setMe({ isPM: false }));
  }, [navigate]);

  const load = useCallback(async () => {
    try {
      const { data } = await employeeApi.get('/training-kits/pm/kits');
      setKits(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(errorText(err, 'تعذّر تحميل الحقائب'));
    }
  }, []);
  useEffect(() => { if (me?.isPM) load(); }, [me, load]);

  const toggleTheme = () => setTheme(t => { const n = t === 'dark' ? 'light' : 'dark'; localStorage.setItem('employeeTheme', n); return n; });

  const inTab = (k, key) => ({
    queue: k.status === 'pm_review',
    manager: k.status === 'manager_review',
    returned: k.status === 'returned',
    approved: k.status === 'approved',
    all: true
  }[key]);
  const q = search.trim().toLowerCase();
  const shown = kits.filter(k => inTab(k, tab)
    && (!q || `${k.title || ''} ${k.author?.name || ''} TK-${String(k.kitNumber).padStart(3, '0')}`.toLowerCase().includes(q)));

  return (
    <div ref={setDashRoot} className="employee-dashboard" dir="rtl" data-page="employee" data-theme={theme}>
      <div className="emp-topbar">
        <div className="emp-topbar-left">
          <div className="emp-brand-mark" aria-hidden="true" />
          <div className="emp-brand-block">
            <h2 className="emp-logo">FABLAB</h2>
            <span className="emp-badge">لوحة إدارة المشاريع · الحقائب التدريبية</span>
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
          <div className="emp-tabs">
            {TABS.map((t, i) => {
              const n = kits.filter(k => inTab(k, t.key)).length;
              return (
                <button key={t.key} className={`emp-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
                  <span className="emp-tab-key">{String(i + 1).padStart(2, '0')}</span>
                  <span className="emp-tab-icon">{t.icon}</span>
                  <span className="emp-tab-label">{t.label}{n ? ` (${n})` : ''}</span>
                  {tab === t.key && <span className="emp-tab-indicator" />}
                </button>
              );
            })}
          </div>
          <div className="emp-content">
            <div className="tk" data-theme={theme}>
              <div className="tk-tab-head">
                <div>
                  <h3>{TABS.find(t => t.key === tab)?.label}</h3>
                  <p>{tab === 'queue'
                    ? 'الحقائب التي أرسلها الموظفون لمراجعتك. افتح الحقيبة لتراجع محتواها وسجل تعديلاتها وملفاتها، ثم اعتمدها للمدير أو أعدها مع ملاحظاتك.'
                    : 'نسخة من كل حقيبة مرّت عليك، بكل إصداراتها وملفاتها — يمكنك تنزيلها أو طباعتها في أي وقت.'}</p>
                </div>
                <input className="tk-in" style={{ maxWidth: 280 }} placeholder="بحث بالاسم أو الموظف أو الرقم…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="بحث" />
              </div>
              <KitList kits={shown} showAuthor onOpen={(k) => setOpen(k.kitId)} empty={{
                title: tab === 'queue' ? 'لا توجد حقائب بانتظار مراجعتك' : 'لا توجد حقائب هنا',
                text: tab === 'queue' ? 'ستظهر هنا فور إرسال أي موظف حقيبة للمراجعة، ويصلك بريد بذلك.' : ''
              }} />
            </div>
          </div>
        </>
      )}

      {open && dashRoot && (
        <KitReview api={employeeApi} scope="pm" kitId={open} portalTarget={dashRoot} theme={theme}
          onClose={() => { setOpen(null); load(); }} onChanged={load} />
      )}
    </div>
  );
};

export default ProjectManagerBoard;
