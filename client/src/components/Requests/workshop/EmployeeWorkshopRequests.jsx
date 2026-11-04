import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import employeeApi from '../../../config/employeeApi';
import KitList, { KitFilters } from '../../TrainingKits/KitList';
import KitReview from '../../TrainingKits/KitReview';
import { Modal } from '../../TrainingKits/KitParts';
import { fmtKitNo, fmtDay } from '../../TrainingKits/kitModel';
import { errorText } from '../../TrainingKits/kitApi';
import WorkshopRequestEditor from './WorkshopRequestEditor';
import { WR_KIND } from './wrKind';
import { createWorkshopRequest, openWorkshopRequest } from './wrApi';
import '../../TrainingKits/TrainingKits.css';
import './WorkshopRequest.css';

const R = WR_KIND.routes.mine;

// The employee's workshop requests (طلبات الورش): a request is built from
// one of their approved training kits, goes to the project manager then
// the manager, and the approval creates the workshop. Lives in the
// employee dashboard's «الطلبات» tab.
const EmployeeWorkshopRequests = ({ portalTarget, theme }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null); // full request object
  const [viewing, setViewing] = useState(null); // requestId
  const [picker, setPicker] = useState(null); // approved kits, while choosing
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await employeeApi.get(R.list);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(errorText(err, 'تعذّر تحميل طلبات الورش'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openEditor = async (id) => {
    try {
      const full = await openWorkshopRequest(employeeApi, id);
      setViewing(null);
      setEditing(full);
    } catch (err) {
      toast.error(errorText(err, 'تعذّر فتح الطلب'));
    }
  };

  const startNew = async () => {
    try {
      const { data } = await employeeApi.get('/training-kits/mine');
      setPicker((Array.isArray(data) ? data : []).filter(k => k.status === 'approved'));
    } catch (err) {
      toast.error(errorText(err, 'تعذّر تحميل الحقائب'));
    }
  };
  const createFrom = async (kit) => {
    setCreating(true);
    try {
      const full = await createWorkshopRequest(employeeApi, kit.id || kit.kitId);
      setPicker(null);
      setEditing(full);
      load();
    } catch (err) {
      toast.error(errorText(err, 'تعذّر إنشاء طلب الورشة'));
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

  // Editable requests open in the editor; requests under review or
  // approved open read-only with their history.
  const open = (x) => (['draft', 'returned'].includes(x.status) ? openEditor(x.id) : setViewing(x.id));

  const counts = useMemo(() => ({
    all: items.length,
    draft: items.filter(x => x.status === 'draft').length,
    review: items.filter(x => ['pm_review', 'manager_review'].includes(x.status)).length,
    returned: items.filter(x => x.status === 'returned').length,
    approved: items.filter(x => x.status === 'approved').length
  }), [items]);
  const shown = items.filter(x => filter === 'all'
    || (filter === 'review' ? ['pm_review', 'manager_review'].includes(x.status) : x.status === filter));
  const drafts = shown.filter(x => x.status === 'draft' && x.currentVersion === 0);
  const made = shown.filter(x => x.status === 'approved' && x.workshopId);

  const newBtn = <button type="button" className="tk-btn primary" onClick={startNew} disabled={creating}>＋ طلب ورشة</button>;

  return (
    <div className="tk" data-theme={theme} dir="rtl">
      <div className="tk-tab-head">
        <div>
          <h3>🛠 طلبات الورش</h3>
          <p>اطلب ورشة من إحدى حقائبك التدريبية المعتمدة: يُنسخ محتوى الحقيبة تلقائيًا، وتحدد أنت الموعد والمكان والمقاعد والرسوم. يمر الطلب على مسؤول إدارة المشاريع ثم المدير، وعند اعتماده تُنشأ الورشة في نظام الورش.</p>
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
        <KitList kits={shown} onOpen={open} kind={WR_KIND} empty={{
          title: filter === 'all' ? 'لا توجد طلبات ورش بعد' : 'لا توجد طلبات في هذا التصنيف',
          text: filter === 'all' ? 'ابدأ من «＋ طلب ورشة» واختر حقيبة معتمدة، أو من زر «🛠 طلب ورشة» داخل أي حقيبة معتمدة.' : '',
          action: filter === 'all' ? newBtn : null
        }} />
      )}
      {made.length > 0 && (
        <p className="tk-muted-s" style={{ marginTop: 10 }}>
          ✓ أُنشئت في نظام الورش: {made.map(x => `«${x.title}»`).join('، ')}
        </p>
      )}
      {drafts.length > 0 && (
        <p className="tk-muted-s" style={{ marginTop: 10 }}>
          لحذف مسودة لم تُرسل بعد:{' '}
          {drafts.map((x, i) => <React.Fragment key={x.id}>{i > 0 && ' · '}<button type="button" className="tk-more" onClick={() => remove(x)}>حذف «{x.title || 'بلا عنوان'}»</button></React.Fragment>)}
        </p>
      )}

      {picker && (
        <Modal onClose={() => !creating && setPicker(null)} labelledBy="wr-new-title">
          <h3 id="wr-new-title">طلب ورشة — اختر الحقيبة المعتمدة</h3>
          {picker.length ? (
            <>
              <p>يُنسخ عنوان الحقيبة ووصفها وأهدافها ومحتواها إلى الطلب، ويمكنك تعديلها.</p>
              <div className="wr-kitlist">
                {picker.map(k => (
                  <button type="button" key={k.id || k.kitId} className="wr-kitopt" disabled={creating} onClick={() => createFrom(k)}>
                    <span className="no">{fmtKitNo(k.number != null ? k.number : k.kitNumber)}</span>
                    <b>{k.title || 'حقيبة بلا اسم'}</b>
                    <small>اعتُمدت {fmtDay(k.approvedAt)}</small>
                  </button>
                ))}
              </div>
            </>
          ) : <p>لا توجد لديك حقائب تدريبية معتمدة بعد. أكمل حقيبة من تبويب «الحقائب التدريبية» وأرسلها للاعتماد أولًا.</p>}
          <div className="tk-modal-actions"><button type="button" className="tk-btn" onClick={() => setPicker(null)} disabled={creating}>{creating ? 'جارٍ الإنشاء…' : 'إلغاء'}</button></div>
        </Modal>
      )}

      {editing && (
        <WorkshopRequestEditor api={employeeApi} doc={editing} portalTarget={portalTarget} theme={theme}
          onClose={() => { setEditing(null); load(); }}
          onSubmitted={() => { setEditing(null); load(); }} />
      )}
      {viewing && (
        <KitReview api={employeeApi} scope="mine" kitId={viewing} kind={WR_KIND} portalTarget={portalTarget} theme={theme}
          onClose={() => { setViewing(null); load(); }}
          onEdit={(x) => openEditor(x.id)}
          extraActions={(x) => (x.status === 'approved' && x.workshopId ? <span className="wr-made">✓ أُنشئت الورشة</span> : null)} />
      )}
    </div>
  );
};

export default EmployeeWorkshopRequests;
