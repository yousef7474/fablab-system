import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../config/api';
import KitList, { KitFilters } from '../TrainingKits/KitList';
import KitReview from '../TrainingKits/KitReview';
import { useHostTheme } from '../TrainingKits/KitParts';
import { errorText } from '../TrainingKits/kitApi';
import { PLAN_KIND } from './planKind';
import '../TrainingKits/TrainingKits.css';
import './Plans.css';

// Manager board: execution plans waiting for the final approval (Approvals
// hub) and the archive of every plan (approved ones kept for reference).
// The project manager who reviews them first is the one set for the
// training kits.
const R = PLAN_KIND.routes.admin;
const searchText = (p) => `${p.title || ''} ${p.author?.name || ''} ${PLAN_KIND.fmtNo(p.number)}`.toLowerCase();

export const PlanApprovals = () => {
  const theme = useHostTheme();
  const [plans, setPlans] = useState([]);
  const [open, setOpen] = useState(null);
  const load = useCallback(async () => {
    try {
      const { data } = await api.get(R.list, { params: { scope: 'pending' } });
      setPlans(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(errorText(err, 'تعذّر تحميل الخطط'));
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="tk" data-theme={theme} dir="rtl">
      <div className="tk-tab-head">
        <div>
          <h3>🗓 الخطط التنفيذية بانتظار الاعتماد</h3>
          <p>خطط راجعها مسؤول إدارة المشاريع واعتمدها. افتح الخطة لمراجعة مستهدفاتها وسجل تعديلاتها، ثم اعتمدها نهائيًا أو أعدها للموظف مع ملاحظاتك.</p>
        </div>
      </div>
      <KitList kits={plans} kind={PLAN_KIND} showAuthor onOpen={(p) => setOpen(p.id)} empty={{ title: 'لا توجد خطط بانتظار الاعتماد' }} />
      {open && <KitReview api={api} scope="admin" kind={PLAN_KIND} kitId={open} theme={theme} onClose={() => { setOpen(null); load(); }} onChanged={load} />}
    </div>
  );
};

const MATCH = {
  approved: (p) => p.status === 'approved',
  pending: (p) => p.status === 'manager_review',
  progress: (p) => ['pm_review', 'returned'].includes(p.status),
  all: () => true
};

export const ManagerPlansTab = () => {
  const theme = useHostTheme();
  const [plans, setPlans] = useState([]);
  const [filter, setFilter] = useState('approved');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);
  const load = useCallback(async () => {
    try {
      const { data } = await api.get(R.list);
      setPlans(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(errorText(err, 'تعذّر تحميل الخطط'));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => Object.fromEntries(Object.keys(MATCH).map(f => [f, plans.filter(MATCH[f]).length])), [plans]);
  const q = search.trim().toLowerCase();
  const shown = plans.filter(p => MATCH[filter](p) && (!q || searchText(p).includes(q)));

  return (
    <div className="tk" data-theme={theme} dir="rtl">
      <div className="tk-tab-head">
        <div>
          <p>أرشيف الخطط التنفيذية التي رفعها الموظفون لكل شهر أو ربع سنة: المعتمدة محفوظة هنا للرجوع إليها، مع كل إصداراتها وملاحظات المراجعة وملفاتها. يراجع كل خطة مسؤول إدارة المشاريع (المحدد في «الحقائب التدريبية») قبل وصولها إليك.</p>
        </div>
        <input className="tk-in" style={{ maxWidth: 280 }} placeholder="بحث بالفترة أو الموظف أو الرقم…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="بحث" />
      </div>
      <KitFilters value={filter} onChange={setFilter} options={[
        { key: 'approved', label: 'المعتمدة', count: counts.approved },
        { key: 'pending', label: 'بانتظار اعتمادي', count: counts.pending },
        { key: 'progress', label: 'قيد المراجعة والتعديل', count: counts.progress },
        { key: 'all', label: 'الكل', count: counts.all }
      ]} />
      <KitList kits={shown} kind={PLAN_KIND} showAuthor onOpen={(p) => setOpen(p.id)} empty={{ title: filter === 'approved' ? 'لا توجد خطط معتمدة بعد' : 'لا توجد خطط هنا' }} />
      {open && <KitReview api={api} scope="admin" kind={PLAN_KIND} kitId={open} theme={theme} onClose={() => { setOpen(null); load(); }} onChanged={load} />}
    </div>
  );
};
