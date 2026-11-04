// Starting a workshop request from an approved kit — used by the kits tab
// («🛠 طلب ورشة من هذه الحقيبة») and the requests tab («＋ طلب ورشة»).
import { WR_KIND } from './wrKind';
import { newWorkshopRequestData, analyze } from './wrModel';

const R = WR_KIND.routes.mine;
const me = () => { try { return JSON.parse(localStorage.getItem('employeeData') || 'null'); } catch { return null; } };

// Creates a request prefilled from the kit and returns it in full (for
// the editor). Throws with an Arabic message when the kit isn't approved.
export const createWorkshopRequest = async (api, kitId) => {
  const { data: kit } = await api.get(`/training-kits/mine/${kitId}`);
  if (kit.status !== 'approved') {
    const e = new Error('Kit not approved');
    e.response = { data: { messageAr: 'لا يمكن طلب ورشة إلا من حقيبة معتمدة' } };
    throw e;
  }
  const data = newWorkshopRequestData(kit, me());
  const { data: created } = await api.post(R.list, { data, completion: analyze(data).pct });
  const { data: full } = await api.get(R.kit(created.id));
  return full;
};

export const openWorkshopRequest = async (api, id) => (await api.get(R.kit(id))).data;
