import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../config/api';
import KitList, { KitFilters } from './KitList';
import KitReview from './KitReview';
import { useHostTheme } from './KitParts';
import { errorText } from './kitApi';
import './TrainingKits.css';

// Manager board: training kits waiting for the final approval (Approvals
// hub) and the archive of every kit (approved ones kept for future use),
// plus who the project manager (مسؤول إدارة المشاريع) is.

export const TrainingKitApprovals = () => {
  const theme = useHostTheme();
  const [kits, setKits] = useState([]);
  const [open, setOpen] = useState(null);
  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/training-kits/admin/kits', { params: { scope: 'pending' } });
      setKits(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(errorText(err, 'تعذّر تحميل الحقائب'));
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="tk" data-theme={theme} dir="rtl">
      <div className="tk-tab-head">
        <div>
          <h3>🎒 الحقائب التدريبية بانتظار الاعتماد</h3>
          <p>حقائب راجعها مسؤول إدارة المشاريع واعتمدها. افتح الحقيبة لمراجعة محتواها وسجل تعديلاتها، ثم اعتمدها نهائيًا أو أعدها للموظف مع ملاحظاتك.</p>
        </div>
      </div>
      <KitList kits={kits} showAuthor onOpen={(k) => setOpen(k.kitId)} empty={{ title: 'لا توجد حقائب بانتظار الاعتماد' }} />
      {open && <KitReview api={api} scope="admin" kitId={open} theme={theme} onClose={() => { setOpen(null); load(); }} onChanged={load} />}
    </div>
  );
};

const PmSetting = () => {
  const [state, setState] = useState(null);
  const [choice, setChoice] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.get('/training-kits/admin/settings').then(({ data }) => { setState(data); setChoice(data.pm?.employeeId || ''); }).catch(() => {});
  }, []);
  if (!state) return null;
  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/training-kits/admin/settings', { pmEmployeeId: choice });
      setState(s => ({ ...s, pm: data.pm }));
      toast.success(`مسؤول إدارة المشاريع: ${data.pm.name}`);
    } catch (err) {
      toast.error(errorText(err, 'تعذّر الحفظ'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="tk-panel" style={{ marginBottom: 18 }}>
      <div className="tk-panel-head">
        <h3 className="tk-panel-title">مسؤول إدارة المشاريع</h3>
        <p className="tk-panel-note">يراجع كل حقيبة قبل وصولها إليك، ويدخل «لوحة إدارة المشاريع» من حسابه في لوحة الموظفين.</p>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <select className="tk-select" style={{ minWidth: 260 }} value={choice} onChange={(e) => setChoice(e.target.value)} aria-label="مسؤول إدارة المشاريع">
          <option value="">اختر موظفًا…</option>
          {state.employees.map(e => <option key={e.employeeId} value={e.employeeId}>{e.name}</option>)}
        </select>
        <button type="button" className="tk-btn primary" onClick={save} disabled={saving || !choice || choice === state.pm?.employeeId}>{saving ? 'جارٍ الحفظ…' : 'حفظ'}</button>
        {state.pm ? <span className="tk-pill mint">الحالي: {state.pm.name}</span> : <span className="tk-pill red">لم يُحدَّد بعد — لا يمكن للموظفين إرسال الحقائب</span>}
      </div>
    </div>
  );
};

const MATCH = {
  approved: (k) => k.status === 'approved',
  pending: (k) => k.status === 'manager_review',
  progress: (k) => ['pm_review', 'returned'].includes(k.status),
  all: () => true
};

export const ManagerKitsTab = () => {
  const theme = useHostTheme();
  const [kits, setKits] = useState([]);
  const [filter, setFilter] = useState('approved');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);
  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/training-kits/admin/kits');
      setKits(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(errorText(err, 'تعذّر تحميل الحقائب'));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => Object.fromEntries(Object.keys(MATCH).map(f => [f, kits.filter(MATCH[f]).length])), [kits]);
  const q = search.trim().toLowerCase();
  const shown = kits.filter(k => MATCH[filter](k)
    && (!q || `${k.title || ''} ${k.author?.name || ''} TK-${String(k.kitNumber).padStart(3, '0')}`.toLowerCase().includes(q)));

  return (
    <div className="tk" data-theme={theme} dir="rtl">
      <div className="tk-tab-head">
        <div>
          <p>أرشيف الحقائب التي أعدّها الموظفون: المعتمدة محفوظة هنا للرجوع إليها مستقبلًا، مع كل إصداراتها وملاحظات المراجعة وملفاتها.</p>
        </div>
        <input className="tk-in" style={{ maxWidth: 280 }} placeholder="بحث بالاسم أو الموظف أو الرقم…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="بحث" />
      </div>
      <PmSetting />
      <KitFilters value={filter} onChange={setFilter} options={[
        { key: 'approved', label: 'المعتمدة', count: counts.approved },
        { key: 'pending', label: 'بانتظار اعتمادي', count: counts.pending },
        { key: 'progress', label: 'قيد المراجعة والتعديل', count: counts.progress },
        { key: 'all', label: 'الكل', count: counts.all }
      ]} />
      <KitList kits={shown} showAuthor onOpen={(k) => setOpen(k.kitId)} empty={{ title: filter === 'approved' ? 'لا توجد حقائب معتمدة بعد' : 'لا توجد حقائب هنا' }} />
      {open && <KitReview api={api} scope="admin" kitId={open} theme={theme} onClose={() => { setOpen(null); load(); }} onChanged={load} />}
    </div>
  );
};
