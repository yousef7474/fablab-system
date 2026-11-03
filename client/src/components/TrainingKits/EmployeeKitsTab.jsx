import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import employeeApi from '../../config/employeeApi';
import KitList, { KitFilters } from './KitList';
import KitEditor from './KitEditor';
import KitReview from './KitReview';
import { blankState, analyze } from './kitModel';
import { errorText } from './kitApi';
import './TrainingKits.css';

// Employee dashboard tab «الحقائب التدريبية»: the employee's kits, a new
// kit, and the editor / review screens.
const EmployeeKitsTab = ({ portalTarget, theme }) => {
  const [kits, setKits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null); // full kit object
  const [viewing, setViewing] = useState(null); // kitId
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await employeeApi.get('/training-kits/mine');
      setKits(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(errorText(err, 'تعذّر تحميل الحقائب'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openEditor = async (kitId) => {
    try {
      const { data } = await employeeApi.get(`/training-kits/mine/${kitId}`);
      setViewing(null);
      setEditing(data);
    } catch (err) {
      toast.error(errorText(err, 'تعذّر فتح الحقيبة'));
    }
  };

  const create = async () => {
    setCreating(true);
    try {
      const data = blankState();
      const { data: kit } = await employeeApi.post('/training-kits/mine', { data, completion: analyze(data).pct });
      const { data: full } = await employeeApi.get(`/training-kits/mine/${kit.kitId}`);
      setEditing(full);
      load();
    } catch (err) {
      toast.error(errorText(err, 'تعذّر إنشاء حقيبة جديدة'));
    } finally {
      setCreating(false);
    }
  };

  const remove = async (k) => {
    if (!window.confirm(`حذف المسودة «${k.title || 'بلا اسم'}» نهائيًا؟`)) return;
    try {
      await employeeApi.delete(`/training-kits/mine/${k.kitId}`);
      toast.success('حُذفت المسودة');
      load();
    } catch (err) {
      toast.error(errorText(err, 'تعذّر الحذف'));
    }
  };

  // Editable kits open in the editor; kits under review or approved open
  // read-only with their history.
  const open = (k) => (['draft', 'returned'].includes(k.status) ? openEditor(k.kitId) : setViewing(k.kitId));

  const counts = useMemo(() => ({
    all: kits.length,
    draft: kits.filter(k => k.status === 'draft').length,
    review: kits.filter(k => ['pm_review', 'manager_review'].includes(k.status)).length,
    returned: kits.filter(k => k.status === 'returned').length,
    approved: kits.filter(k => k.status === 'approved').length
  }), [kits]);
  const shown = kits.filter(k => filter === 'all'
    || (filter === 'review' ? ['pm_review', 'manager_review'].includes(k.status) : k.status === filter));
  const drafts = shown.filter(k => k.status === 'draft' && k.currentVersion === 0);

  return (
    <div className="tk" data-theme={theme} dir="rtl">
      <div className="tk-tab-head">
        <div>
          <h3>🎒 الحقائب التدريبية</h3>
          <p>عبّئ قالب الحقيبة التدريبية وأرسله لمسؤول إدارة المشاريع ثم للمدير للاعتماد. يُحفظ كل إصدار مع ملاحظات المراجعين، والحقائب المعتمدة تبقى هنا لاستخدامها في طلب ورشة لاحقًا.</p>
        </div>
        <button type="button" className="tk-btn primary" onClick={create} disabled={creating}>＋ {creating ? 'جارٍ الإنشاء…' : 'حقيبة جديدة'}</button>
      </div>

      <KitFilters value={filter} onChange={setFilter} options={[
        { key: 'all', label: 'الكل', count: counts.all },
        { key: 'draft', label: 'مسودات', count: counts.draft },
        { key: 'returned', label: 'معادة للتعديل', count: counts.returned },
        { key: 'review', label: 'قيد المراجعة', count: counts.review },
        { key: 'approved', label: 'معتمدة', count: counts.approved }
      ]} />

      {loading ? <div className="tk-doc-loading">جارٍ التحميل…</div> : (
        <KitList kits={shown} onOpen={open} empty={{
          title: filter === 'all' ? 'لم تبدأ أي حقيبة بعد' : 'لا توجد حقائب في هذا التصنيف',
          text: filter === 'all' ? 'ابدأ حقيبة جديدة — تُحفظ تلقائيًا ويمكنك إكمالها لاحقًا.' : '',
          action: filter === 'all' ? <button type="button" className="tk-btn primary" onClick={create} disabled={creating}>＋ حقيبة جديدة</button> : null
        }} />
      )}
      {drafts.length > 0 && (
        <p className="tk-muted-s" style={{ marginTop: 10 }}>
          لحذف مسودة لم تُرسل بعد:{' '}
          {drafts.map((k, i) => <React.Fragment key={k.kitId}>{i > 0 && ' · '}<button type="button" className="tk-more" onClick={() => remove(k)}>حذف «{k.title || 'بلا اسم'}»</button></React.Fragment>)}
        </p>
      )}

      {editing && (
        <KitEditor api={employeeApi} kit={editing} portalTarget={portalTarget} theme={theme}
          onClose={() => { setEditing(null); load(); }}
          onSubmitted={() => { setEditing(null); load(); }} />
      )}
      {viewing && (
        <KitReview api={employeeApi} scope="mine" kitId={viewing} portalTarget={portalTarget} theme={theme}
          onClose={() => { setViewing(null); load(); }}
          onEdit={(k) => openEditor(k.kitId)} />
      )}
    </div>
  );
};

export default EmployeeKitsTab;
