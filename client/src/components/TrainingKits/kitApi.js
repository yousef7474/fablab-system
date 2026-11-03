// Network helpers shared by the employee, project-manager and manager
// views. Each view passes its own axios instance (employeeApi or api) and
// the route prefix it is allowed to use (see kinds.js).
import { routesFor } from './kinds';

export const KIT_ROUTES = routesFor('/training-kits', 'kits');

export const errorText = (err, fallback) => {
  const d = err?.response?.data;
  if (err?.response?.status === 413) return 'الملف أكبر من الحد المسموح به على الخادم';
  return d?.messageAr || d?.message || fallback;
};

// Save a blob from an authenticated GET.
export const downloadFile = async (api, url, name) => {
  const res = await api.get(url, { responseType: 'blob' });
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = name || 'file';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 4000);
};

// params: { version: N } for a submitted version, { draft: 1 } for the
// owner's current draft; none = latest version.
export const fetchDocument = async (api, url, params = {}) => {
  const res = await api.get(url, { params, responseType: 'text' });
  return res.data;
};

// Opens the printable document in a new tab and starts printing. The tab
// is opened first (inside the click) so popup blockers allow it.
export const printDocument = async (api, url, params) => {
  const w = window.open('', '_blank');
  if (w) w.document.write('<p dir="rtl" style="font-family:sans-serif;padding:24px">جارٍ تجهيز الحقيبة للطباعة…</p>');
  try {
    const html = await fetchDocument(api, url, params);
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch { /* the user can print from the tab */ } }, 900);
  } catch (err) {
    if (w) w.close();
    throw err;
  }
};

// Reference images are compressed in the browser (max 1400px JPEG) the
// same way the kit template did, so a phone photo doesn't weigh 8 MB.
export const compressImage = (file) => new Promise((resolve) => {
  if (file.type === 'image/svg+xml' || !/^image\//.test(file.type)) { resolve(file); return; }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const s = Math.min(1, 1400 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * s));
    c.height = Math.max(1, Math.round(img.height * s));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    c.toBlob(b => resolve(b ? new File([b], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file), 'image/jpeg', 0.82);
  };
  img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
  img.src = url;
});

// `url` defaults to the kit's upload route; other kinds pass their own.
export const uploadFile = async (api, kitId, file, kind, url = KIT_ROUTES.mine.upload(kitId)) => {
  const { data } = await api.post(url, file, {
    params: { kind },
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-File-Name': encodeURIComponent(file.name),
      'X-File-Type': file.type || 'application/octet-stream'
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity
  });
  return data;
};
