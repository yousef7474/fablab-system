// Transfer-receipt helpers shared by the payment page (/pay/:slug) and the
// payment step of a FabLab form.

export const MAX_FILE = 10 * 1024 * 1024;

export const groupIban = (iban) => String(iban || '').replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();

export const readFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

// Phone photos of receipts are big — shrink images before upload.
export const compressImage = (dataUrl, maxSide = 1800, quality = 0.85) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    resolve(canvas.toDataURL('image/jpeg', quality));
  };
  img.onerror = () => resolve(dataUrl);
  img.src = dataUrl;
});

// A picked file → { name, type, size, dataUrl, isImage }, or null when it
// is not an image / PDF up to 10 MB.
export const prepareReceipt = async (file) => {
  if (!file) return null;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const isImage = /^image\/(png|jpe?g|webp)$/.test(file.type) || ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
  const isPdf = file.type === 'application/pdf' || ext === 'pdf';
  if ((!isImage && !isPdf) || (isPdf && file.size > MAX_FILE)) return null;
  let dataUrl = await readFile(file);
  let type = isPdf ? 'pdf' : (ext === 'png' ? 'png' : ext === 'webp' ? 'webp' : 'jpg');
  if (isImage && file.size > 1.2 * 1024 * 1024) { dataUrl = await compressImage(dataUrl); type = 'jpg'; }
  if (dataUrl.length * 0.75 > MAX_FILE) return null;
  return { name: file.name, type, size: Math.round(dataUrl.length * 0.75), dataUrl, isImage };
};

// What the server expects for `proof`.
export const proofPayload = (proof) => (proof
  ? { fileName: proof.name.replace(/\.[^.]+$/, '') + '.' + proof.type, fileType: proof.type, fileData: proof.dataUrl }
  : undefined);
