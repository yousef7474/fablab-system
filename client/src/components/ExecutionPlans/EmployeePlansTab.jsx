import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import employeeApi from '../../config/employeeApi';
import KitList, { KitFilters } from '../TrainingKits/KitList';
import KitReview from '../TrainingKits/KitReview';
import { errorText, uploadFile } from '../TrainingKits/kitApi';
import { fmtKitNo } from '../TrainingKits/kitModel';
import PlanEditor from './PlanEditor';
import { PLAN_KIND } from './planKind';
import { blankState, analyze } from './planModel';
import { examplePlanData, exampleMediaImages } from './planExample';
import { fmtFinanceNo } from './planFiles';
import { newFinanceData, analyze as financeAnalyze } from '../Requests/finance/frModel';
import '../TrainingKits/TrainingKits.css';
import './Plans.css';

const R = PLAN_KIND.routes.mine;
const me = () => { try { return JSON.parse(localStorage.getItem('employeeData') || 'null'); } catch { return null; } };

// Employee dashboard tab «الخطة التنفيذية»: the employee's plans (one per
// month or quarter), a new plan, and the editor / review screens.
const EmployeePlansTab = ({ portalTarget, theme }) => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null); // full plan object
  const [viewing, setViewing] = useState(null); // planId
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await employeeApi.get(R.list);
      setPlans(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(errorText(err, 'تعذّر تحميل الخطط'));
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
      toast.error(errorText(err, 'تعذّر فتح الخطة'));
    }
  };

  const createFrom = async (data, failText) => {
    setCreating(true);
    try {
      const { data: plan } = await employeeApi.post(R.list, { data, completion: analyze(data).pct });
      const { data: full } = await employeeApi.get(R.kit(plan.id));
      setEditing(full);
      load();
    } catch (err) {
      toast.error(errorText(err, failText));
    } finally {
      setCreating(false);
    }
  };
  const create = () => createFrom(blankState(me()), 'تعذّر إنشاء خطة جديدة');
  // A filled example plan, to see a complete plan and try the flow. Each
  // «ملف المستهدف» is shown on its own path: the employee's training kit
  // (an approved one first), a financial request created for it, media
  // forms with their ad images and a volunteer form.
  const createExample = async () => {
    setCreating(true);
    try {
      let kit = null;
      try {
        const { data } = await employeeApi.get('/training-kits/mine');
        const list = Array.isArray(data) ? data : [];
        kit = list.find(k => k.status === 'approved') || list[0] || null;
      } catch { /* the example works without a kit */ }
      const data = examplePlanData(me(), kit);
      const { data: plan } = await employeeApi.post(R.list, { data, completion: analyze(data).pct });
      const id = plan.id;
      for (const [ti, file, caption] of exampleMediaImages(kit?.title)) {
        try {
          const up = await uploadFile(employeeApi, id, file, 'image', R.upload(id));
          data.targets[ti].media.form.images.push({ fileId: up.fileId, name: up.name, size: up.size, mime: up.mime, caption });
        } catch { /* the form still opens without that image */ }
      }
      // The training program's financial request (a draft — «قيد الإعداد»).
      try {
        const t = data.targets[0];
        const fd = newFinanceData({
          title: t.name, kind: 'برنامج تدريبي', section: data.header.section,
          startDate: t.phases[2]?.start, endDate: t.phases[2]?.end, days: 4, beneficiaries: 20,
          planId: id, planNo: PLAN_KIND.fmtNo(plan.number), targetId: t.id, targetName: t.name,
          kitId: t.content.kitId, kitNo: t.content.kitNo || (kit ? fmtKitNo(kit.number) : ''), kitTitle: t.content.kitTitle
        });
        const { data: fr } = await employeeApi.post('/financial-requests/mine', { data: fd, completion: financeAnalyze(fd).pct });
        Object.assign(t.finance, { requestId: fr.id, requestNo: fmtFinanceNo(fr.number), requestTitle: fr.title || t.name });
      } catch { /* the target then asks for a financial request */ }
      await employeeApi.put(R.kit(id), { data, completion: analyze(data).pct });
      const { data: full } = await employeeApi.get(R.kit(id));
      setEditing(full);
      load();
    } catch (err) {
      toast.error(errorText(err, 'تعذّر إنشاء خطة المثال'));
    } finally {
      setCreating(false);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`حذف المسودة «${p.title || 'خطة بلا فترة'}» نهائيًا؟`)) return;
    try {
      await employeeApi.delete(R.kit(p.id));
      toast.success('حُذفت المسودة');
      load();
    } catch (err) {
      toast.error(errorText(err, 'تعذّر الحذف'));
    }
  };

  // Editable plans open in the editor; plans under review or approved
  // open read-only with their history.
  const open = (p) => (['draft', 'returned'].includes(p.status) ? openEditor(p.id) : setViewing(p.id));

  const counts = useMemo(() => ({
    all: plans.length,
    draft: plans.filter(p => p.status === 'draft').length,
    review: plans.filter(p => ['pm_review', 'manager_review'].includes(p.status)).length,
    returned: plans.filter(p => p.status === 'returned').length,
    approved: plans.filter(p => p.status === 'approved').length
  }), [plans]);
  const shown = plans.filter(p => filter === 'all'
    || (filter === 'review' ? ['pm_review', 'manager_review'].includes(p.status) : p.status === filter));
  const drafts = shown.filter(p => p.status === 'draft' && p.currentVersion === 0);

  const actions = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button type="button" className="tk-btn" onClick={createExample} disabled={creating} title="خطة مكتملة لترى طريقة التعبئة وتجرّب مسار الاعتماد">📖 ابدأ من خطة مثال</button>
      <button type="button" className="tk-btn primary" onClick={create} disabled={creating}>＋ {creating ? 'جارٍ الإنشاء…' : 'خطة جديدة'}</button>
    </div>
  );

  return (
    <div className="tk" data-theme={theme} dir="rtl">
      <div className="tk-tab-head">
        <div>
          <h3>🗓 الخطة التنفيذية</h3>
          <p>عبّئ نموذج الخطة التنفيذية لقسمك لكل شهر أو ربع سنة: المستهدفات ومراحل تنفيذها وملفاتها، ثم أرسلها لمسؤول إدارة المشاريع ثم للمدير للاعتماد. يُحفظ كل إصدار مع ملاحظات المراجعين.</p>
        </div>
        {actions}
      </div>

      <KitFilters value={filter} onChange={setFilter} options={[
        { key: 'all', label: 'الكل', count: counts.all },
        { key: 'draft', label: 'مسودات', count: counts.draft },
        { key: 'returned', label: 'معادة للتعديل', count: counts.returned },
        { key: 'review', label: 'قيد المراجعة', count: counts.review },
        { key: 'approved', label: 'معتمدة', count: counts.approved }
      ]} />

      {loading ? <div className="tk-doc-loading">جارٍ التحميل…</div> : (
        <KitList kits={shown} onOpen={open} kind={PLAN_KIND} empty={{
          title: filter === 'all' ? 'لم تبدأ أي خطة بعد' : 'لا توجد خطط في هذا التصنيف',
          text: filter === 'all' ? 'ابدأ خطة جديدة — تُحفظ تلقائيًا ويمكنك إكمالها لاحقًا. أو افتح خطة مثال مكتملة لترى طريقة التعبئة.' : '',
          action: filter === 'all' ? actions : null
        }} />
      )}
      {drafts.length > 0 && (
        <p className="tk-muted-s" style={{ marginTop: 10 }}>
          لحذف مسودة لم تُرسل بعد:{' '}
          {drafts.map((p, i) => <React.Fragment key={p.id}>{i > 0 && ' · '}<button type="button" className="tk-more" onClick={() => remove(p)}>حذف «{p.title || 'خطة بلا فترة'}»</button></React.Fragment>)}
        </p>
      )}

      {editing && (
        <PlanEditor api={employeeApi} plan={editing} portalTarget={portalTarget} theme={theme}
          onClose={() => { setEditing(null); load(); }}
          onSubmitted={() => { setEditing(null); load(); }} />
      )}
      {viewing && (
        <KitReview api={employeeApi} scope="mine" kitId={viewing} kind={PLAN_KIND} portalTarget={portalTarget} theme={theme}
          onClose={() => { setViewing(null); load(); }}
          onEdit={(p) => openEditor(p.id)} />
      )}
    </div>
  );
};

export default EmployeePlansTab;
