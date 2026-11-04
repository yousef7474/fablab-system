// Network helpers for media design requests (employee side).
import { MEDIA_ROUTES } from './mediaKind';
import { analyze, normalize } from './mediaModel';

const R = MEDIA_ROUTES.employee;

// A new request from prefilled data (newMediaData) → the full request.
export const createMediaRequest = async (api, data) => {
  const d = normalize(data);
  const { data: created } = await api.post(R.list, { data: d, completion: analyze(d).pct });
  const { data: full } = await api.get(R.kit(created.id));
  return full;
};

// A new request from a plan target's embedded media form (its images are
// copied into the request) → the full request.
export const createMediaRequestFromPlan = async (api, planId, targetId) => {
  const { data: created } = await api.post(R.fromPlan, { planId, targetId });
  const { data: full } = await api.get(R.kit(created.id));
  return full;
};

export const openMediaRequest = async (api, id) => (await api.get(R.kit(id))).data;
