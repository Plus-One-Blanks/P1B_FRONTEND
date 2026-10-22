/** Shared types + helpers for the DTF gang sheet studio. */

export const MIN_IN = 0.5;
export const MAX_IN = 22;
export const BUILD_PX_PER_IN = 28;
export const BUILD_ZOOM_MIN = 0.2;
export const BUILD_ZOOM_MAX = 4;

export const SIZE_PRESETS = [
  {
    id: 'pocket',
    label: 'Pocket',
    inches: 3.5,
    blurb: 'Left-chest pocket size',
  },
  {
    id: 'infant',
    label: 'Infant',
    inches: 5,
    blurb: 'Perfect for infant sizes',
  },
  {
    id: 'youth',
    label: 'Youth',
    inches: 8,
    blurb: 'Perfect for youth sizes',
  },
  {
    id: 'adult',
    label: 'Adult',
    inches: 11,
    blurb: 'Standard adult chest print',
  },
  {
    id: 'xl',
    label: 'XL',
    inches: 13,
    blurb: 'Large oversized print',
  },
];

/**
 * @param {number} n
 * @param {number} min
 * @param {number} max
 */
export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/**
 * @param {number} longerSideIn
 * @param {number} [qty]
 */
export function makeDesignSize(longerSideIn, qty = 1) {
  return {
    id: `sz-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    longerSideIn,
    qty,
  };
}

/**
 * @param {{
 *   sizes?: Array<{ id: string; longerSideIn: number; qty: number }>;
 *   id?: string;
 *   longerSideIn?: number;
 *   qty?: number;
 *   activeSizeId?: string;
 * }} d
 */
export function designSizes(d) {
  if (d.sizes?.length) return d.sizes;
  if (d.longerSideIn != null) {
    return [
      {
        id: `${d.id || 'legacy'}-sz`,
        longerSideIn: d.longerSideIn,
        qty: d.qty || 1,
      },
    ];
  }
  return [makeDesignSize(4, 1)];
}

/**
 * @param {{
 *   sizes?: Array<{ id: string; longerSideIn: number; qty: number }>;
 *   activeSizeId?: string;
 * }} d
 */
export function getActiveSize(d) {
  const sizes = designSizes(d);
  return sizes.find((s) => s.id === d.activeSizeId) || sizes[0];
}

/**
 * @param {{ naturalWidth?: number; naturalHeight?: number }} d
 * @param {{ longerSideIn?: number }} [sizeRow]
 */
export function computePrintSize(d, sizeRow) {
  const row = sizeRow || getActiveSize(d);
  const nw = d.naturalWidth || 1;
  const nh = d.naturalHeight || 1;
  const longer = clamp(row.longerSideIn || 3, MIN_IN, MAX_IN);
  if (nw >= nh) {
    return {widthIn: longer, heightIn: longer * (nh / nw)};
  }
  return {widthIn: longer * (nw / nh), heightIn: longer};
}

/**
 * @param {{ naturalWidth?: number; naturalHeight?: number }} d
 * @param {{ widthIn: number; heightIn: number }} size
 */
export function estimateDpi(d, size) {
  const dpiW = (d.naturalWidth || 1) / Math.max(size.widthIn, 0.01);
  const dpiH = (d.naturalHeight || 1) / Math.max(size.heightIn, 0.01);
  return Math.round(Math.min(dpiW, dpiH));
}

/**
 * @param {{ naturalWidth?: number; naturalHeight?: number }} d
 * @param {number} targetDpi
 * @param {number} sheetMaxIn
 * @returns {number | null}
 */
export function suggestedLongerSideForDpi(d, targetDpi, sheetMaxIn) {
  const longerPx = Math.max(d.naturalWidth || 1, d.naturalHeight || 1);
  const maxIn = longerPx / Math.max(targetDpi, 1);
  if (maxIn < MIN_IN) return null;
  return Number(
    clamp(maxIn, MIN_IN, Math.min(sheetMaxIn, MAX_IN)).toFixed(2),
  );
}

/**
 * Default print size: largest preset that still hits ~300 DPI, else exact 300 DPI size.
 * @param {{ naturalWidth?: number; naturalHeight?: number }} d
 * @param {number} sheetMaxIn
 */
export function recommendedPrintLongerSide(d, sheetMaxIn) {
  const for300 = suggestedLongerSideForDpi(d, 300, sheetMaxIn);
  if (for300 == null) return MIN_IN;
  const fitting = SIZE_PRESETS.map((p) => p.inches).filter(
    (inches) => inches <= for300 + 0.02 && inches <= sheetMaxIn,
  );
  if (fitting.length) return Math.max(...fitting);
  return for300;
}

/**
 * Upscale a data-URL so the given print size reaches target DPI (capped at 4×).
 * High-quality canvas resample — not a neural model, but reliable offline.
 * @param {string} dataUrl
 * @param {number} widthIn
 * @param {number} heightIn
 * @param {number} [targetDpi]
 */
export async function upscaleImageToPrintDpi(
  dataUrl,
  widthIn,
  heightIn,
  targetDpi = 300,
) {
  const dims = await loadImageDims(dataUrl);
  const needScale = Math.max(
    (Math.max(widthIn, 0.01) * targetDpi) / dims.w,
    (Math.max(heightIn, 0.01) * targetDpi) / dims.h,
    1,
  );
  const scale = Math.min(Number(needScale.toFixed(3)), 4);
  if (scale <= 1.02) {
    return {dataUrl, width: dims.w, height: dims.h, scale: 1};
  }

  const outW = Math.max(1, Math.round(dims.w * scale));
  const outH = Math.max(1, Math.round(dims.h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {dataUrl, width: dims.w, height: dims.h, scale: 1};
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });
  ctx.drawImage(img, 0, 0, outW, outH);
  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: outW,
    height: outH,
    scale,
  };
}

/**
 * @param {number} maxIn
 */
export function buildRulerTicks(maxIn) {
  /** @type {number[]} */
  const ticks = [];
  for (let i = 0; i <= maxIn + 0.001; i += 0.5) {
    ticks.push(Number(i.toFixed(1)));
  }
  return ticks;
}

/**
 * @param {string} dataUrl
 * @returns {Promise<{ w: number; h: number }>}
 */
export function loadImageDims(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({w: img.naturalWidth || 1, h: img.naturalHeight || 1});
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
function toHex(r, g, b) {
  const h = (n) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

/**
 * Detect a likely solid page background from corner samples.
 * @param {string} dataUrl
 * @returns {Promise<{ detected: boolean; hex: string | null; rgb: { r: number; g: number; b: number } | null }>}
 */
export async function detectSolidBackground(dataUrl) {
  const dims = await loadImageDims(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(dims.w, 480);
  canvas.height = Math.min(dims.h, 480);
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  if (!ctx) {
    return {detected: false, hex: null, rgb: null};
  }
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const {data, width, height} = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const pts = [
    [2, 2],
    [width - 3, 2],
    [2, height - 3],
    [width - 3, height - 3],
    [Math.floor(width / 2), 2],
    [2, Math.floor(height / 2)],
  ];
  /** @type {Array<{ r: number; g: number; b: number; a: number }>} */
  const samples = [];
  for (const [sx, sy] of pts) {
    const i = (sy * width + sx) * 4;
    samples.push({
      r: data[i],
      g: data[i + 1],
      b: data[i + 2],
      a: data[i + 3],
    });
  }

  // Already transparent corners → no solid bg
  if (samples.filter((s) => s.a < 24).length >= 3) {
    return {detected: false, hex: null, rgb: null};
  }

  const opaque = samples.filter((s) => s.a > 200);
  if (opaque.length < 4) {
    return {detected: false, hex: null, rgb: null};
  }

  const avg = {
    r: Math.round(opaque.reduce((n, s) => n + s.r, 0) / opaque.length),
    g: Math.round(opaque.reduce((n, s) => n + s.g, 0) / opaque.length),
    b: Math.round(opaque.reduce((n, s) => n + s.b, 0) / opaque.length),
  };

  const spread = Math.max(
    ...opaque.map((s) =>
      Math.max(
        Math.abs(s.r - avg.r),
        Math.abs(s.g - avg.g),
        Math.abs(s.b - avg.b),
      ),
    ),
  );
  if (spread > 28) {
    return {detected: false, hex: null, rgb: null};
  }

  // Require a light / near-white or very flat page color (typical screenshot bg)
  const luminance = (avg.r * 299 + avg.g * 587 + avg.b * 114) / 1000;
  if (luminance < 200 && !(avg.r > 240 && avg.g > 240 && avg.b > 240)) {
    // Still flag very flat light-gray / white pages
    if (luminance < 180) {
      return {detected: false, hex: null, rgb: null};
    }
  }

  return {
    detected: true,
    hex: toHex(avg.r, avg.g, avg.b),
    rgb: avg,
  };
}

/**
 * Find next free spot for a print on the sheet (top-left packing).
 * @param {{
 *   sheetWidthIn: number;
 *   sheetHeightIn: number;
 *   widthIn: number;
 *   heightIn: number;
 *   existing: Array<{ x: number; y: number; widthIn: number; heightIn: number }>;
 * }} args
 */
export function findNextPlacement({
  sheetWidthIn,
  sheetHeightIn,
  widthIn,
  heightIn,
  existing,
}) {
  const margin = 0.25;
  let cursorX = margin;
  let cursorY = margin;
  let rowMaxH = 0;

  // Replay pack of existing items (approx by sort top-to-bottom then left)
  const sorted = [...existing].sort((a, b) => {
    const ay = a.y * sheetHeightIn - a.heightIn / 2;
    const by = b.y * sheetHeightIn - b.heightIn / 2;
    if (Math.abs(ay - by) > 0.05) return ay - by;
    return (
      a.x * sheetWidthIn -
      a.widthIn / 2 -
      (b.x * sheetWidthIn - b.widthIn / 2)
    );
  });

  for (const item of sorted) {
    const w = item.widthIn;
    const h = item.heightIn;
    if (cursorX + w > sheetWidthIn - margin) {
      cursorX = margin;
      cursorY += rowMaxH + margin;
      rowMaxH = 0;
    }
    cursorX += w + margin;
    rowMaxH = Math.max(rowMaxH, h);
  }

  if (cursorX + widthIn > sheetWidthIn - margin) {
    cursorX = margin;
    cursorY += rowMaxH + margin;
  }
  if (cursorY + heightIn > sheetHeightIn - margin) {
    cursorX = margin + (existing.length % 5) * 0.3;
    cursorY = margin + Math.floor(existing.length / 5) * 0.3;
  }

  return {
    x: clamp((cursorX + widthIn / 2) / sheetWidthIn, 0.02, 0.98),
    y: clamp((cursorY + heightIn / 2) / sheetHeightIn, 0.02, 0.98),
  };
}

/**
 * Pack items onto a gang sheet (shelf packing).
 * When `tidy` is true, sorts taller-first for denser rows.
 *
 * @param {{
 *   sheetWidthIn: number;
 *   sheetHeightIn: number;
 *   items: Array<{ id: string; widthIn: number; heightIn: number }>;
 *   canvasMarginIn?: number;
 *   imageMarginIn?: number;
 *   tidy?: boolean;
 * }} args
 * @returns {Map<string, { x: number; y: number }>}
 */
export function packGangSheetItems({
  sheetWidthIn,
  sheetHeightIn,
  items,
  canvasMarginIn = 0,
  imageMarginIn = 0.25,
  tidy = true,
}) {
  const edge = Math.max(0, Number(canvasMarginIn) || 0);
  const gap = Math.max(0, Number(imageMarginIn) || 0);
  const maxRight = sheetWidthIn - edge;
  const maxBottom = sheetHeightIn - edge;

  /** @type {Array<{ id: string; widthIn: number; heightIn: number }>} */
  let ordered = [...items];
  if (tidy) {
    ordered.sort(
      (a, b) =>
        b.heightIn - a.heightIn ||
        b.widthIn - a.widthIn ||
        a.id.localeCompare(b.id),
    );
  }

  let cursorX = edge;
  let cursorY = edge;
  let rowMaxH = 0;
  /** @type {Map<string, { x: number; y: number }>} */
  const out = new Map();

  for (const item of ordered) {
    const w = Math.max(0.1, item.widthIn);
    const h = Math.max(0.1, item.heightIn);

    if (cursorX > edge && cursorX + w > maxRight) {
      cursorX = edge;
      cursorY += rowMaxH + gap;
      rowMaxH = 0;
    }

    // Soft overflow — keep on sheet when possible
    let left = cursorX;
    let top = cursorY;
    if (left + w > maxRight) {
      left = Math.max(edge, maxRight - w);
    }
    if (top + h > maxBottom) {
      top = Math.max(edge, maxBottom - h);
    }

    out.set(item.id, {
      x: clamp((left + w / 2) / sheetWidthIn, 0.01, 0.99),
      y: clamp((top + h / 2) / sheetHeightIn, 0.01, 0.99),
    });

    cursorX = left + w + gap;
    rowMaxH = Math.max(rowMaxH, h);
  }

  return out;
}

/**
 * Axis-aligned bounds (inches) for a placed item, accounting for rotation.
 * @param {{
 *   x: number;
 *   y: number;
 *   widthIn: number;
 *   heightIn: number;
 *   rotation?: number;
 * }} item
 * @param {number} sheetWidthIn
 * @param {number} sheetHeightIn
 */
export function placedItemBoundsIn(item, sheetWidthIn, sheetHeightIn) {
  const cx = Number(item.x) * sheetWidthIn;
  const cy = Number(item.y) * sheetHeightIn;
  const rot = ((Number(item.rotation) || 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rot));
  const sin = Math.abs(Math.sin(rot));
  const w = Math.max(0.05, Number(item.widthIn) || 0.05);
  const h = Math.max(0.05, Number(item.heightIn) || 0.05);
  const bw = w * cos + h * sin;
  const bh = w * sin + h * cos;
  return {
    left: cx - bw / 2,
    right: cx + bw / 2,
    top: cy - bh / 2,
    bottom: cy + bh / 2,
  };
}

/**
 * True when any two pieces overlap (or sit closer than `minGapIn`).
 * @param {Array<{
 *   x: number;
 *   y: number;
 *   widthIn: number;
 *   heightIn: number;
 *   rotation?: number;
 * }>} items
 * @param {number} sheetWidthIn
 * @param {number} sheetHeightIn
 * @param {number} [minGapIn]
 */
export function gangSheetHasOverlaps(
  items,
  sheetWidthIn,
  sheetHeightIn,
  minGapIn = 0.05,
) {
  if (!items?.length || items.length < 2) return false;
  const gap = Math.max(0, Number(minGapIn) || 0);
  const bounds = items.map((p) =>
    placedItemBoundsIn(p, sheetWidthIn, sheetHeightIn),
  );
  for (let i = 0; i < bounds.length; i++) {
    for (let j = i + 1; j < bounds.length; j++) {
      const a = bounds[i];
      const b = bounds[j];
      const separate =
        a.right + gap <= b.left ||
        b.right + gap <= a.left ||
        a.bottom + gap <= b.top ||
        b.bottom + gap <= a.top;
      if (!separate) return true;
    }
  }
  return false;
}
