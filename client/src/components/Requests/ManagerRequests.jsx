import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../config/api';
import KitList, { KitFilters } from '../TrainingKits/KitList';
import KitReview from '../TrainingKits/KitReview';
import { useHostTheme } from '../TrainingKits/KitParts';
import { errorText } from '../TrainingKits/kitApi';
import { WR_KIND } from './workshop/wrKind';
import { FR_KIND } from './finance/frKind';
import '../TrainingKits/TrainingKits.css';
import '../ExecutionPlans/Plans.css';
import './workshop/WorkshopRequest.css';

// Manager board: workshop requests (طلبات الورش — approving one creates
// the workshop) and financial requests (طلبات الصرف المالي — approved ones
// are printed and signed), each after the project manager's review.
export const REQUEST_TYPES = [
  { key: 'workshop', kind: WR_KIND, label: 'طلبات الورش', none: 'لا توجد طلبات ورش' },
  { key: 'finance', kind: FR_KIND, label: 'طلبات الصرف المالي', none: 'لا توجد طلبات صرف' }
];

// An approved workshop request shows that its workshop was created.
const madeWorkshop = (d) => (d.workshopId ? <span className="wr-made">✓ أُنشئت الورشة</span> : null);
const extraFor = (kind) => (kind === WR_KIND ? madeWorkshop : undefined);

const searchText = (kind, d) => `${d.title || ''} ${d.author?.name || ''} ${kind.fmtNo(d.number)}`.toLowerCase();

// Approvals hub: both pending queues on one page.
export const RequestApprovals = () => {
  const theme = useHostTheme();
  const [lists, setLists] = useState({});
  const [open, setOpen] = useState(null); // { kind, id }
  const load = useCallback(async () => {
    const next = {};
    await Promise.all(REQUEST_TYPES.map(async (t) => {
      try {
        const { data } = await api.get(t.kind.routes.admin.list, { params: { scope: 'pending' } });
        next[t.key] = Array.isArray(data) ? data : [];
      } catch (err) {
        next[t.key] = [];
        toast.error(errorText(err, `تعذّر تحميل ${t.label}`));
      }
    }));
    setLists(next);
  }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="tk" data-theme={theme} dir="rtl">
      <div className="tk-tab-head">
        <div>
          <h3>📨 الطلبات بانتظار الاعتماد</h3>
          <p>طلبات راجعها مسؤول إدارة المشاريع واعتمدها. اعتماد طلب الورشة يُنشئ الورشة في نظام الورش، وطلب الصرف المعتمد يُطبع للتوقيع.</p>
        </div>
      </div>
      {REQUEST_TYPES.map(t => (
        <section key={t.key} style={{ marginBottom: 22 }}>
          <h4 className="tk-panel-title" style={{ margin: '0 0 10px' }}>{t.kind.icon} {t.label} <span className="tk-pill muted">{(lists[t.key] || []).length}</span></h4>
          <KitList kits={lists[t.key] || []} kind={t.kind} showAuthor onOpen={(d) => setOpen({ kind: t.kind, id: d.id })} empty={{ title: `${t.none} بانتظار الاعتماد` }} />
        </section>
      ))}
      {open && <KitReview api={api} scope="admin" kind={open.kind} kitId={open.id} theme={theme} extraActions={extraFor(open.kind)} onClose={() => { setOpen(null); load(); }} onChanged={load} />}
    </div>
  );
};

const MATCH = {
  approved: (d) => d.status === 'approved',
  pending: (d) => d.status === 'manager_review',
  progress: (d) => ['pm_review', 'returned'].includes(d.status),
  all: () => true
};

// Sidebar tab: archive of both request types, with a type switch.
export const ManagerRequestsTab = () => {
  const theme = useHostTheme();
  const [type, setType] = useState(() => { try { return localStorage.getItem('mgrRequestsType') === 'finance' ? 'finance' : 'workshop'; } catch { return 'workshop'; } });
  const [lists, setLists] = useState({});
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);
  const T = REQUEST_TYPES.find(t => t.key === type);

  const load = useCallback(async () => {
    const next = {};
    await Promise.all(REQUEST_TYPES.map(async (t) => {
      try {
        const { data } = await api.get(t.kind.routes.admin.list);
        next[t.key] = Array.isArray(data) ? data : [];
      } catch (err) {
        next[t.key] = [];
        toast.error(errorText(err, `تعذّر تحميل ${t.label}`));
      }
    }));
    setLists(next);
  }, []);
  useEffect(() => { load(); }, [load]);

  const switchType = (key) => { setType(key); setOpen(null); setSearch(''); try { localStorage.setItem('mgrRequestsType', key); } catch { /* ignore */ } };
  const docs = useMemo(() => lists[type] || [], [lists, type]);
  const counts = useMemo(() => Object.fromEntries(Object.keys(MATCH).map(f => [f, docs.filter(MATCH[f]).length])), [docs]);
  const q = search.trim().toLowerCase();
  const shown = docs.filter(d => MATCH[filter](d) && (!q || searchText(T.kind, d).includes(q)));

  return (
    <div className="tk" data-theme={theme} dir="rtl">
      <div className="tk-tab-head">
        <div className="ep-kindswitch" role="tablist" aria-label="نوع الطلبات">
          {REQUEST_TYPES.map(t => {
            const waiting = (lists[t.key] || []).filter(d => d.status === 'manager_review').length;
            return (
              <button key={t.key} type="button" role="tab" aria-selected={type === t.key} onClick={() => switchType(t.key)}>
                <span aria-hidden="true">{t.kind.icon}</span> {t.label}
                {waiting > 0 && <span className="c" title="بانتظار اعتمادك">{waiting}</span>}
              </button>
            );
          })}
        </div>
        <input className="tk-in" style={{ maxWidth: 280 }} placeholder="بحث بالعنوان أو الموظف أو الرقم…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="بحث" />
      </div>
      <p className="tk-muted-s" style={{ margin: '0 0 12px' }}>
        {type === 'workshop'
          ? 'طلبات إقامة ورشة من حقيبة تدريبية معتمدة. اعتمادك النهائي يُنشئ الورشة تلقائيًا في نظام الورش.'
          : 'طلبات الصرف المالي للبرامج والمشاريع، بعد مراجعة مسؤول إدارة المشاريع. اطبع الطلب المعتمد للتوقيع والختم.'}
      </p>
      <KitFilters value={filter} onChange={setFilter} options={[
        { key: 'pending', label: 'بانتظار اعتمادي', count: counts.pending },
        { key: 'approved', label: 'المعتمدة', count: counts.approved },
        { key: 'progress', label: 'قيد المراجعة والتعديل', count: counts.progress },
        { key: 'all', label: 'الكل', count: counts.all }
      ]} />
      <KitList kits={shown} kind={T.kind} showAuthor onOpen={(d) => setOpen(d.id)} empty={{ title: T.none }} />
      {open && <KitReview api={api} scope="admin" kind={T.kind} kitId={open} theme={theme} extraActions={extraFor(T.kind)} onClose={() => { setOpen(null); load(); }} onChanged={load} />}
    </div>
  );
};
