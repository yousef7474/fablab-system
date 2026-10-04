// 3D printing service — the materials + colors customers may pick
// from. Stored as one JSON row in Settings under 'print3d_options' and
// edited by managers from the admin 3D Printing tab.
//
// Shape:
//   {
//     materials: [{ code, nameAr, nameEn, noteAr, noteEn, enabled }],
//     colors:    [{ hex, nameAr, nameEn, materials: [code...], enabled }]
//   }
//
// Materials are keyed by `code` (PLA / PETG / ...) — the same code is
// saved on each request and used to look up its print3d_rate_<code>
// price. Colors are one shared list keyed by hex; `materials` limits a
// color to specific material codes (empty = every material).
//
// Pure module (no model imports) so models/Settings.js can seed from
// DEFAULT_PRINT3D_OPTIONS without a require cycle.

const DEFAULT_PRINT3D_OPTIONS = {
  materials: [
    { code: 'PLA',  nameAr: 'عام ومتعدد الاستخدام', nameEn: 'General purpose',    noteAr: 'أفضل للمجسمات الديكورية والنماذج',  noteEn: 'Best for decorative models and prototypes', enabled: true },
    { code: 'PETG', nameAr: 'قوي ومقاوم للماء',     nameEn: 'Strong & waterproof', noteAr: 'مناسب للاستخدام الوظيفي والحاويات', noteEn: 'Great for functional parts and containers', enabled: true },
    { code: 'TPU',  nameAr: 'مرن كالمطاط',          nameEn: 'Rubber-like flexible', noteAr: 'للأجزاء المرنة والحماية والإطارات', noteEn: 'For flexible parts, protection, gaskets',   enabled: true }
  ],
  // Mirrors the palette the customer form offered before this list
  // became admin-managed.
  colors: [
    { hex: '#ffffff', nameAr: 'أبيض',    nameEn: 'White',     materials: [], enabled: true },
    { hex: '#111111', nameAr: 'أسود',    nameEn: 'Black',     materials: [], enabled: true },
    { hex: '#6b7280', nameAr: 'رمادي',   nameEn: 'Gray',      materials: [], enabled: true },
    { hex: '#dc2626', nameAr: 'أحمر',    nameEn: 'Red',       materials: [], enabled: true },
    { hex: '#f97316', nameAr: 'برتقالي', nameEn: 'Orange',    materials: [], enabled: true },
    { hex: '#facc15', nameAr: 'أصفر',    nameEn: 'Yellow',    materials: [], enabled: true },
    { hex: '#16a34a', nameAr: 'أخضر',    nameEn: 'Green',     materials: [], enabled: true },
    { hex: '#06b6d4', nameAr: 'تركوازي', nameEn: 'Turquoise', materials: [], enabled: true },
    { hex: '#2563eb', nameAr: 'أزرق',    nameEn: 'Blue',      materials: [], enabled: true },
    { hex: '#7c3aed', nameAr: 'بنفسجي',  nameEn: 'Purple',    materials: [], enabled: true },
    { hex: '#ec4899', nameAr: 'زهري',    nameEn: 'Pink',      materials: [], enabled: true },
    { hex: '#78350f', nameAr: 'بني',     nameEn: 'Brown',     materials: [], enabled: true },
    { hex: '#e5e7eb', nameAr: 'شفاف',    nameEn: 'Clear',     materials: [], enabled: true },
    { hex: '#d4af37', nameAr: 'ذهبي',    nameEn: 'Gold',      materials: [], enabled: true },
    { hex: '#c0c0c0', nameAr: 'فضي',     nameEn: 'Silver',    materials: [], enabled: true }
  ]
};

const CODE_RE = /^[A-Z0-9][A-Z0-9_+-]{0,15}$/; // fits Print3DRequest.material STRING(16)
const HEX_RE = /^#[0-9a-f]{6}$/;

const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const normCode = (v) => str(v, 32).toUpperCase();
const normHex = (v) => str(v, 16).toLowerCase();

// Settings key holding the per-gram price for a material code.
const rateKeyFor = (code) => `print3d_rate_${String(code).toLowerCase()}`;

// Strict check used when a manager saves the list. Returns null when
// valid, otherwise a bilingual { message, messageAr } error.
const validatePrint3dOptions = (raw) => {
  const src = raw && typeof raw === 'object' ? raw : {};
  if (!Array.isArray(src.materials) || !Array.isArray(src.colors)) {
    return { message: 'materials and colors must be arrays', messageAr: 'بيانات الخامات والألوان غير صحيحة' };
  }
  const codes = new Set();
  for (const m of src.materials) {
    const code = normCode(m?.code);
    if (!CODE_RE.test(code)) {
      return {
        message: `Invalid material code "${code || '—'}" — use 1–16 letters/digits (e.g. PLA, PETG)`,
        messageAr: `رمز الخامة "${code || '—'}" غير صحيح — استخدم من 1 إلى 16 حرفاً لاتينياً أو رقماً (مثل PLA أو PETG)`
      };
    }
    if (codes.has(code)) {
      return { message: `Material ${code} is listed twice`, messageAr: `الخامة ${code} مكررة` };
    }
    if (!str(m.nameAr, 80) && !str(m.nameEn, 80)) {
      return { message: `Material ${code} needs a name`, messageAr: `يرجى إدخال اسم للخامة ${code}` };
    }
    codes.add(code);
  }
  const hexes = new Set();
  for (const c of src.colors) {
    const hex = normHex(c?.hex);
    if (!HEX_RE.test(hex)) {
      return { message: `Invalid color code "${hex || '—'}"`, messageAr: `رمز اللون "${hex || '—'}" غير صحيح` };
    }
    if (hexes.has(hex)) {
      return { message: `Color ${hex} is listed twice`, messageAr: `اللون ${hex} مكرر` };
    }
    if (!str(c.nameAr, 40) && !str(c.nameEn, 40)) {
      return { message: `Color ${hex} needs a name`, messageAr: `يرجى إدخال اسم للون ${hex}` };
    }
    hexes.add(hex);
  }
  return null;
};

// Lenient normalizer — run on every load and before saving. Drops
// malformed / duplicate entries instead of throwing so a bad row can
// never take the public form down.
const sanitizePrint3dOptions = (raw) => {
  const src = raw && typeof raw === 'object' ? raw : {};

  const materials = [];
  const codes = new Set();
  for (const m of Array.isArray(src.materials) ? src.materials : []) {
    const code = normCode(m?.code);
    if (!CODE_RE.test(code) || codes.has(code)) continue;
    codes.add(code);
    const nameAr = str(m.nameAr, 80);
    const nameEn = str(m.nameEn, 80);
    materials.push({
      code,
      nameAr: nameAr || nameEn || code,
      nameEn: nameEn || nameAr || code,
      noteAr: str(m.noteAr, 160),
      noteEn: str(m.noteEn, 160),
      enabled: m.enabled !== false
    });
  }

  const colors = [];
  const hexes = new Set();
  for (const c of Array.isArray(src.colors) ? src.colors : []) {
    const hex = normHex(c?.hex);
    if (!HEX_RE.test(hex) || hexes.has(hex)) continue;
    hexes.add(hex);
    const wanted = Array.isArray(c.materials) ? c.materials.map(normCode).filter(Boolean) : [];
    const limitedTo = [...new Set(wanted.filter(code => codes.has(code)))];
    const nameAr = str(c.nameAr, 40);
    const nameEn = str(c.nameEn, 40);
    colors.push({
      hex,
      nameAr: nameAr || nameEn || hex,
      nameEn: nameEn || nameAr || hex,
      materials: limitedTo,
      // A color limited only to materials that were since removed
      // would otherwise silently widen to "all materials" — switch it
      // off instead and let the admin decide.
      enabled: c.enabled !== false && !(wanted.length && !limitedTo.length)
    });
  }

  return { materials, colors };
};

// What the public form receives: enabled entries only, with each
// color's material limits narrowed to enabled materials. A color whose
// only materials are all disabled is left out entirely.
const publicPrint3dOptions = (options) => {
  const materials = options.materials
    .filter(m => m.enabled)
    .map(({ code, nameAr, nameEn, noteAr, noteEn }) => ({ code, nameAr, nameEn, noteAr, noteEn }));
  const live = new Set(materials.map(m => m.code));
  const colors = [];
  for (const c of options.colors) {
    if (!c.enabled) continue;
    const limitedTo = c.materials.filter(code => live.has(code));
    if (c.materials.length && !limitedTo.length) continue;
    colors.push({ hex: c.hex, nameAr: c.nameAr, nameEn: c.nameEn, materials: limitedTo });
  }
  return { materials, colors };
};

// True when `hex` is an enabled color offered for material `code`.
const isColorOffered = (options, hex, code) => {
  const h = normHex(hex);
  return options.colors.some(c =>
    c.enabled && c.hex === h && (c.materials.length === 0 || c.materials.includes(code))
  );
};

module.exports = {
  DEFAULT_PRINT3D_OPTIONS,
  rateKeyFor,
  normCode,
  normHex,
  validatePrint3dOptions,
  sanitizePrint3dOptions,
  publicPrint3dOptions,
  isColorOffered
};
