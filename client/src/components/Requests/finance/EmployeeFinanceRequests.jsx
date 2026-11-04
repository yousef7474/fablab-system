import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import employeeApi from '../../../config/employeeApi';
import KitList, { KitFilters } from '../../TrainingKits/KitList';
import KitReview from '../../TrainingKits/KitReview';
import { errorText } from '../../TrainingKits/kitApi';
import FinanceRequestEditor from './FinanceRequestEditor';
import { FR_KIND } from './frKind';
import { blankState, analyze, money } from './frModel';
import '../../TrainingKits/TrainingKits.css';
import './Finance.css';

const R = FR_KIND.routes.mine;

// The employee's financial requests (طلبات الصرف المالي): list, a new
// request, and the editor / review screens. Shown in the employee
// dashboard's «الطلبات» tab.
const EmployeeFinanceRequests = ({ portalTarget, theme }) => {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null); // full request object
  const [viewing, setViewing] = useState(null); // requestId
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await employeeApi.get(R.list);
      setDocs(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(errorText(err, 'تعذّر تحميل طلبات الصرف'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openEditor = async (id) => {
    try {
      const { data } = await employeeApi.get(R.kit(id));
      setViewing(null);
      setEditing(data);
    } catch (err) {
      toast.error(errorText(err, 'تعذّر فتح الطلب'));
    }
  };

  const create = async () => {
    setCreating(true);
    try {
      const data = blankState();
      const { data: doc } = await employeeApi.post(R.list, { data, completion: analyze(data).pct });
      const { data: full } = await employeeApi.get(R.kit(doc.id));
      setEditing(full);
      load();
    } catch (err) {
      toast.error(errorText(err, 'تعذّر إنشاء طلب صرف جديد'));
    } finally {
      setCreating(false);
    }
  };

  const remove = async (d) => {
    if (!window.confirm(`حذف المسودة «${d.title || 'بلا عنوان'}» نهائيًا؟`)) return;
    try {
      await employeeApi.delete(R.kit(d.id));
      toast.success('حُذفت المسودة');
      load();
    } catch (err) {
      toast.error(errorText(err, 'تعذّر الحذف'));
    }
  };

  // Editable requests open in the editor; requests under review or
  // approved open read-only with their history.
  const open = (d) => (['draft', 'returned'].includes(d.status) ? openEditor(d.id) : setViewing(d.id));

  const counts = useMemo(() => ({
    all: docs.length,
    draft: docs.filter(d => d.status === 'draft').length,
    review: docs.filter(d => ['pm_review', 'manager_review'].includes(d.status)).length,
    returned: docs.filter(d => d.status === 'returned').length,
    approved: docs.filter(d => d.status === 'approved').length
  }), [docs]);
  const shown = docs.filter(d => filter === 'all'
    || (filter === 'review' ? ['pm_review', 'manager_review'].includes(d.status) : d.status === filter));
  const drafts = shown.filter(d => d.status === 'draft' && d.currentVersion === 0);
  const approvedTotal = docs.filter(d => d.status === 'approved').reduce((a, d) => a + (Number(d.amount) || 0), 0);

  const newBtn = <button type="button" className="tk-btn primary" onClick={create} disabled={creating}>＋ {creating ? 'جارٍ الإنشاء…' : 'طلب صرف جديد'}</button>;

  return (
    <div className="tk" data-theme={theme} dir="rtl">
      <div className="tk-tab-head">
        <div>
          <h3>💰 طلبات الصرف المالي</h3>
          <p>الملف المالي التفصيلي لكل برنامج أو نشاط: احتياجات كل مشروع والموارد البشرية والضيافة والتسعير والتمويل. يُرسل لمسؤول إدارة المشاريع ثم للمدير الذي يطبعه ويوقّعه.{approvedTotal > 0 ? ` إجمالي المعتمد: ${money(approvedTotal)} ر.س.` : ''}</p>
        </div>
        {newBtn}
      </div>

      <KitFilters value={filter} onChange={setFilter} options={[
        { key: 'all', label: 'الكل', count: counts.all },
        { key: 'draft', label: 'مسودات', count: counts.draft },
        { key: 'returned', label: 'معادة للتعديل', count: counts.returned },
        { key: 'review', label: 'قيد المراجعة', count: counts.review },
        { key: 'approved', label: 'معتمدة', count: counts.approved }
      ]} />

      {loading ? <div className="tk-doc-loading">جارٍ التحميل…</div> : (
        <KitList kits={shown} onOpen={open} kind={FR_KIND} empty={{
          title: filter === 'all' ? 'لا توجد طلبات صرف بعد' : 'لا توجد طلبات في هذا التصنيف',
          text: filter === 'all' ? 'ابدأ طلبًا جديدًا — يُحفظ تلقائيًا ويمكنك إكماله لاحقًا. يمكنك أيضًا إنشاؤه من مستهدف في خطتك التنفيذية.' : '',
          action: filter === 'all' ? newBtn : null
        }} />
      )}
      {drafts.length > 0 && (
        <p className="tk-muted-s" style={{ marginTop: 10 }}>
          لحذف مسودة لم تُرسل بعد:{' '}
          {drafts.map((d, i) => <React.Fragment key={d.id}>{i > 0 && ' · '}<button type="button" className="tk-more" onClick={() => remove(d)}>حذف «{d.title || 'بلا عنوان'}»</button></React.Fragment>)}
        </p>
      )}

      {editing && (
        <FinanceRequestEditor api={employeeApi} doc={editing} portalTarget={portalTarget} theme={theme}
          onClose={() => { setEditing(null); load(); }}
          onSubmitted={() => { setEditing(null); load(); }} />
      )}
      {viewing && (
        <KitReview api={employeeApi} scope="mine" kitId={viewing} kind={FR_KIND} portalTarget={portalTarget} theme={theme}
          onClose={() => { setViewing(null); load(); }}
          onEdit={(d) => openEditor(d.id)} />
      )}
    </div>
  );
};

export default EmployeeFinanceRequests;
