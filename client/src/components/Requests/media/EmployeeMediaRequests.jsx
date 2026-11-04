import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import employeeApi from '../../../config/employeeApi';
import KitList, { KitFilters } from '../../TrainingKits/KitList';
import { errorText } from '../../TrainingKits/kitApi';
import MediaRequestEditor from './MediaRequestEditor';
import MediaReview from './MediaReview';
import { MEDIA_KIND, MEDIA_ROUTES } from './mediaKind';
import { newMediaData, EDITABLE } from './mediaModel';
import { createMediaRequest, openMediaRequest } from './mediaApi';
import '../../TrainingKits/TrainingKits.css';
import './Media.css';

const R = MEDIA_ROUTES.employee;
const MATCH = {
  all: () => true,
  mine: (x) => EDITABLE.includes(x.status) || x.status === 'employee_check',
  design: (x) => x.status === 'design',
  review: (x) => ['pm_review', 'manager_review'].includes(x.status),
  approved: (x) => x.status === 'approved'
};

// The employee's media design requests (طلبات التصميم): fill the form →
// the design team designs → the employee checks the design → project
// manager → manager. Lives in the employee dashboard's «الطلبات» tab.
const EmployeeMediaRequests = ({ portalTarget, theme }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null); // full request
  const [viewing, setViewing] = useState(null); // requestId
  const [creating, setCreating] = useState(false);
  const me = useMemo(() => { try { return JSON.parse(localStorage.getItem('employeeData') || 'null'); } catch { return null; } }, []);

  const load = useCallback(async () => {
    try {
      const { data } = await employeeApi.get(R.list);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(errorText(err, 'تعذّر تحميل طلبات التصميم'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openEditor = async (id) => {
    try {
      const full = await openMediaRequest(employeeApi, id);
      setViewing(null);
      setEditing(full);
    } catch (err) {
      toast.error(errorText(err, 'تعذّر فتح الطلب'));
    }
  };

  const create = async () => {
    setCreating(true);
    try {
      const full = await createMediaRequest(employeeApi, newMediaData({ implementer: me?.name || '' }));
      setEditing(full);
      load();
    } catch (err) {
      toast.error(errorText(err, 'تعذّر إنشاء الطلب'));
    } finally {
      setCreating(false);
    }
  };

  const remove = async (x) => {
    if (!window.confirm(`حذف مسودة الطلب «${x.title || 'بلا عنوان'}» نهائيًا؟`)) return;
    try {
      await employeeApi.delete(R.kit(x.id));
      toast.success('حُذفت المسودة');
      load();
    } catch (err) {
      toast.error(errorText(err, 'تعذّر الحذف'));
    }
  };

  // Drafts open in the editor; everything else in the review screen (where
  // the employee checks a delivered design, or edits after a return).
  const open = (x) => (x.status === 'draft' ? openEditor(x.id) : setViewing(x.id));

  const counts = useMemo(() => Object.fromEntries(Object.keys(MATCH).map(k => [k, items.filter(MATCH[k]).length])), [items]);
  const shown = items.filter(MATCH[filter]);
  const toCheck = items.filter(x => x.status === 'employee_check');
  const drafts = shown.filter(x => x.status === 'draft' && !x.lastEventType);
  const newBtn = <button type="button" className="tk-btn primary" onClick={create} disabled={creating}>＋ {creating ? 'جارٍ الإنشاء…' : 'طلب تصميم جديد'}</button>;

  return (
    <div className="tk" data-theme={theme} dir="rtl">
      <div className="tk-tab-head">
        <div>
          <h3>📣 طلبات التصميم</h3>
          <p>«نموذج اعتماد طلب تصميم إعلان» داخل النظام: تعبّئ بيانات النشاط وصوره، فيصمّم فريق التصميم الإعلان ويعيده إليك لتراجعه وتعتمده، ثم يمر على مسؤول إدارة المشاريع والمدير. يُحفظ المسار كاملًا بكل ملاحظاته وإصداراته.</p>
        </div>
        {newBtn}
      </div>

      {toCheck.length > 0 && (
        <div className="tk-note cyan" style={{ marginBottom: 12 }}>
          <span className="tk-note-ico">👁</span>
          <div><b>تصميم بانتظار مراجعتك</b>{toCheck.map((x, i) => <React.Fragment key={x.id}>{i > 0 && ' · '}<button type="button" className="tk-more" onClick={() => setViewing(x.id)}>«{x.title || 'طلب تصميم'}» — الإصدار {x.designVersion}</button></React.Fragment>)}</div>
        </div>
      )}

      <KitFilters value={filter} onChange={setFilter} options={[
        { key: 'all', label: 'الكل', count: counts.all },
        { key: 'mine', label: 'بانتظاري', count: counts.mine },
        { key: 'design', label: 'لدى فريق التصميم', count: counts.design },
        { key: 'review', label: 'قيد الاعتماد', count: counts.review },
        { key: 'approved', label: 'المعتمدة', count: counts.approved }
      ]} />

      {loading ? <div className="tk-doc-loading">جارٍ التحميل…</div> : (
        <KitList kits={shown} onOpen={open} kind={MEDIA_KIND} empty={{
          title: filter === 'all' ? 'لا توجد طلبات تصميم بعد' : 'لا توجد طلبات في هذا التصنيف',
          text: filter === 'all' ? 'ابدأ «طلب تصميم جديد»، أو أنشئه من «المتطلبات الإعلامية» في أحد مستهدفات خطتك التنفيذية.' : '',
          action: filter === 'all' ? newBtn : null
        }} />
      )}
      {drafts.length > 0 && (
        <p className="tk-muted-s" style={{ marginTop: 10 }}>
          لحذف مسودة لم تُرسل بعد:{' '}
          {drafts.map((x, i) => <React.Fragment key={x.id}>{i > 0 && ' · '}<button type="button" className="tk-more" onClick={() => remove(x)}>حذف «{x.title || 'بلا عنوان'}»</button></React.Fragment>)}
        </p>
      )}

      {editing && (
        <MediaRequestEditor api={employeeApi} doc={editing} portalTarget={portalTarget} theme={theme}
          onClose={() => { setEditing(null); load(); }}
          onSubmitted={() => { setEditing(null); load(); }} />
      )}
      {viewing && (
        <MediaReview api={employeeApi} role="employee" requestId={viewing} portalTarget={portalTarget} theme={theme}
          onClose={() => { setViewing(null); load(); }}
          onChanged={load}
          onEdit={(x) => openEditor(x.id)} />
      )}
    </div>
  );
};

export default EmployeeMediaRequests;
