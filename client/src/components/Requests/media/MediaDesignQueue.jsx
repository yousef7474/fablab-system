import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../../config/api';
import KitList, { KitFilters } from '../../TrainingKits/KitList';
import { useHostTheme } from '../../TrainingKits/KitParts';
import { errorText } from '../../TrainingKits/kitApi';
import MediaReview from './MediaReview';
import { MEDIA_KIND, MEDIA_ROUTES } from './mediaKind';
import '../../TrainingKits/TrainingKits.css';
import './Media.css';

const R = MEDIA_ROUTES.designer;
const MATCH = {
  design: (x) => x.status === 'design',
  check: (x) => x.status === 'employee_check',
  review: (x) => ['pm_review', 'manager_review', 'returned_employee'].includes(x.status),
  approved: (x) => x.status === 'approved',
  all: () => true
};
const searchText = (x) => `${x.title || ''} ${x.author?.name || ''} ${MEDIA_KIND.fmtNo(x.number)}`.toLowerCase();

// Admin dashboard tab «طلبات التصميم» — the design team's queue. A request
// arrives when the employee sends it; the designer reads it, uploads the
// design and sends it back to the employee; returns from the employee, the
// project manager or the manager come back here with their notes.
const MediaDesignQueue = () => {
  const theme = useHostTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('design');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(R.list);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(errorText(err, 'تعذّر تحميل طلبات التصميم'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => Object.fromEntries(Object.keys(MATCH).map(k => [k, items.filter(MATCH[k]).length])), [items]);
  const q = search.trim().toLowerCase();
  const shown = items.filter(x => MATCH[filter](x) && (!q || searchText(x).includes(q)));

  return (
    <div className="tk" data-theme={theme} dir="rtl">
      <div className="tk-tab-head">
        <div>
          <h3>📣 طلبات التصميم</h3>
          <p>طلبات «نموذج اعتماد طلب تصميم إعلان» من الموظفين. افتح الطلب لقراءة بياناته وصوره، ثم ارفع التصميم وأرسله لمنفذ الطلب. يعود إليك الطلب مع الملاحظات إذا رفض منفذ الطلب التصميم أو أعاده مسؤول إدارة المشاريع أو المدير للمصمم.</p>
        </div>
        <input className="tk-in" style={{ maxWidth: 280 }} placeholder="بحث بالنشاط أو الموظف أو الرقم…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="بحث" />
      </div>
      <KitFilters value={filter} onChange={setFilter} options={[
        { key: 'design', label: 'بانتظار التصميم', count: counts.design },
        { key: 'check', label: 'لدى منفذ الطلب للمراجعة', count: counts.check },
        { key: 'review', label: 'لدى الاعتماد', count: counts.review },
        { key: 'approved', label: 'المعتمدة', count: counts.approved },
        { key: 'all', label: 'الكل', count: counts.all }
      ]} />
      {loading ? <div className="tk-doc-loading">جارٍ التحميل…</div> : (
        <KitList kits={shown} kind={MEDIA_KIND} showAuthor onOpen={(x) => setOpen(x.id)} empty={{
          title: filter === 'design' ? 'لا توجد طلبات بانتظار التصميم' : 'لا توجد طلبات هنا',
          text: filter === 'design' ? 'تظهر هنا الطلبات فور إرسالها من الموظفين، وعند إعادتها للمصمم مع ملاحظات.' : ''
        }} />
      )}
      {open && <MediaReview api={api} role="designer" requestId={open} theme={theme} onClose={() => { setOpen(null); load(); }} onChanged={load} />}
    </div>
  );
};

export default MediaDesignQueue;
