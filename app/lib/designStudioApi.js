/**
 * Design Studio API helpers.
 * Prefers Google Cloud backend when `PUBLIC_DESIGN_API_URL` is set;
 * otherwise uses an in-browser fallback for background removal.
 *
 * Hydrogen loads `.env` into the Oxygen worker `env` — not always into
 * `import.meta.env` in the browser. Call `setDesignApiBase()` from root
 * with the loader value so client fetches hit the Cloud Function.
 */

/** @type {string} */
let runtimeApiBase = '';

/**
 * @param {string | null | undefined} url
 */
export function setDesignApiBase(url) {
  runtimeApiBase = String(url || '')
    .trim()
    .replace(/\/$/, '');
}

function getApiBase() {
  if (runtimeApiBase) return runtimeApiBase;

  try {
    const fromMeta =
      typeof import.meta !== 'undefined'
        ? import.meta.env?.PUBLIC_DESIGN_API_URL
        : '';
    return String(fromMeta || '')
      .trim()
      .replace(/\/$/, '');
  } catch {
    return '';
  }
}

/**
 * @param {string} dataUrl
 * @returns {Promise<string>} transparent PNG data URL
 */
export async function removeLogoBackground(dataUrl) {
  const base = getApiBase();

  if (base) {
    let res;
    try {
      res = await fetch(`${base}/removeBackground`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          imageBase64: dataUrl,
          mimeType: dataUrl.match(/^data:([^;]+);/)?.[1] || 'image/png',
        }),
      });
    } catch (err) {
      console.warn('[designStudio] removeBackground fetch failed', err);
      throw new Error(
        'Could not reach the design API (blocked by network/CSP, or offline). Check the browser console for CSP errors.',
      );
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Background removal failed');
    }
    const json = await res.json();
    if (!json.imageBase64) {
      throw new Error('Background removal returned an empty image');
    }
    return json.imageBase64;
  }

  return removeBackgroundClientSide(dataUrl);
}

/**
 * Client-side fallback using @imgly/background-removal (dynamic import).
 * @param {string} dataUrl
 */
async function removeBackgroundClientSide(dataUrl) {
  try {
    const mod = await import('@imgly/background-removal');
    const blob = await fetch(dataUrl).then((r) => r.blob());
    const result = await mod.removeBackground(blob, {
      output: {format: 'image/png', quality: 0.95},
    });
    return await blobToDataUrl(result);
  } catch (err) {
    console.warn('[designStudio] client bg-remove unavailable', err);
    throw new Error(
      'Could not remove background. Restart the dev server so PUBLIC_DESIGN_API_URL loads, then try again.',
    );
  }
}

/**
 * Persist design via Cloud Function (optional).
 * @param {Record<string, unknown>} payload
 */
export async function saveDesignRemote(payload) {
  const base = getApiBase();
  if (!base) return null;

  const res = await fetch(`${base}/saveDesign`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Could not save design');
  }
  const json = await res.json();
  return json.design || null;
}

/**
 * @param {string} designId
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function getDesignRemote(designId) {
  const base = getApiBase();
  if (!base || !designId) return null;

  const res = await fetch(
    `${base}/getDesign?id=${encodeURIComponent(designId)}`,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Could not load design');
  }
  const json = await res.json();
  return json.design || null;
}

/**
 * Public design API origin (for cart packet links).
 * @returns {string}
 */
export function getDesignApiBaseUrl() {
  return getApiBase();
}

/**
 * Build a flat mockup PNG (garment + logos) for cart/order preview.
 * Failures return null — save still works with logo-only preview.
 *
 * @param {{
 *   garmentUrl?: string | null;
 *   locations?: Array<{
 *     logoDataUrl: string;
 *     transform?: { x: number; y: number; scale: number; rotation: number };
 *   }>;
 * }} opts
 * @returns {Promise<string | null>}
 */
export async function composeDesignPreview(opts) {
  if (typeof document === 'undefined') return null;
  const garmentUrl = opts.garmentUrl;
  const locations = (opts.locations || []).filter((l) => l?.logoDataUrl);
  if (!garmentUrl || !locations.length) return null;

  try {
    const garment = await loadHtmlImageCrossOrigin(garmentUrl);
    const width = garment.naturalWidth || garment.width || 1000;
    const height = garment.naturalHeight || garment.height || 1200;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(garment, 0, 0, width, height);

    for (const loc of locations) {
      const logo = await loadHtmlImage(loc.logoDataUrl);
      const t = loc.transform || DEFAULT_DESIGN_TRANSFORM;
      const lw = Math.max(8, width * (t.scale || 0.32));
      const lh = (logo.naturalHeight / Math.max(1, logo.naturalWidth)) * lw;
      const cx = width * (t.x ?? 0.5);
      const cy = height * (t.y ?? 0.36);
      const rot = ((t.rotation || 0) * Math.PI) / 180;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.drawImage(logo, -lw / 2, -lh / 2, lw, lh);
      ctx.restore();
    }

    return canvas.toDataURL('image/png', 0.92);
  } catch (err) {
    console.warn('[designStudio] compose preview failed', err);
    return null;
  }
}

/**
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
function loadHtmlImageCrossOrigin(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load garment image'));
    img.src = src;
  });
}

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * @typedef {{ r: number; g: number; b: number; hex: string }} SampledColor
 */

/**
 * Sample a pixel color from a data-URL image using normalized 0–1 coords.
 * @param {string} dataUrl
 * @param {number} xNorm
 * @param {number} yNorm
 * @returns {Promise<SampledColor>}
 */
export async function sampleImageColor(dataUrl, xNorm, yNorm) {
  const {canvas, ctx, width, height} = await drawDataUrlToCanvas(dataUrl);
  const x = clampInt(Math.floor(xNorm * width), 0, width - 1);
  const y = clampInt(Math.floor(yNorm * height), 0, height - 1);
  const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
  void canvas;
  return {r, g, b, hex: rgbToHex(r, g, b)};
}

/**
 * Make pixels matching any of the target colors transparent (chroma-style).
 * Soft edge: near-threshold pixels fade instead of hard-cut.
 *
 * @param {string} dataUrl
 * @param {Array<{ r: number; g: number; b: number }>} colors
 * @param {number} [tolerance=36] 0–100-ish; higher removes a wider range
 * @returns {Promise<string>} PNG data URL
 */
export async function removeColorsFromImage(dataUrl, colors, tolerance = 36) {
  if (!colors?.length) return dataUrl;

  const {canvas, ctx, width, height} = await drawDataUrlToCanvas(dataUrl);
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const threshold = Math.max(0, Number(tolerance) || 0) * 2.55; // ~0–255
  const soft = Math.max(8, threshold * 0.35);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a === 0) continue;

    let best = Infinity;
    for (const c of colors) {
      const d = colorDistance(r, g, b, c.r, c.g, c.b);
      if (d < best) best = d;
    }

    if (best <= threshold) {
      data[i + 3] = 0;
    } else if (best <= threshold + soft) {
      const t = (best - threshold) / soft;
      data[i + 3] = Math.round(a * t);
    }
  }

  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * @param {string} dataUrl
 */
async function drawDataUrlToCanvas(dataUrl) {
  const img = await loadHtmlImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(img, 0, 0);
  return {canvas, ctx, width: canvas.width, height: canvas.height};
}

/**
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
function loadHtmlImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = src;
  });
}

function colorDistance(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function rgbToHex(r, g, b) {
  return (
    '#' +
    [r, g, b]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function clampInt(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Default imprint placement (percent of preview box).
 */
export const DEFAULT_DESIGN_TRANSFORM = {
  x: 0.5,
  y: 0.36,
  scale: 0.32,
  rotation: 0,
};

/**
 * @typedef {{
 *   id: string;
 *   label?: string;
 *   logoDataUrl: string;
 *   transform: typeof DEFAULT_DESIGN_TRANSFORM;
 * }} DesignLocationArt
 *
 * @typedef {{
 *   id?: string | null;
 *   logoDataUrl: string;
 *   transform: typeof DEFAULT_DESIGN_TRANSFORM;
 *   locations?: DesignLocationArt[];
 *   printStyle?: 'simple' | 'full';
 *   productHandle?: string | null;
 *   productId?: string | null;
 *   colorCode?: string | null;
 *   colorName?: string | null;
 *   previewUrl?: string | null;
 *   remoteId?: string | null;
 * }} SavedProductDesign
 */
