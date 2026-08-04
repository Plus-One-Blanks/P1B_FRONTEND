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

  if (!base) {
    throw new Error(
      'Background removal requires the design API. Set PUBLIC_DESIGN_API_URL and redeploy.',
    );
  }

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

/**
 * Build a mockup that matches the Design Studio stage:
 * square canvas, garment drawn with object-fit:contain, logo placed in the
 * garment fit-box using the same % coords as `.design-studio-fit-layer`
 * (left/top/width % + translate(-50%,-50%) + rotate).
 *
 * @param {{
 *   garmentUrl?: string | null;
 *   logos?: Array<{
 *     logoDataUrl: string;
 *     transform?: { x: number; y: number; scale: number; rotation: number };
 *   }>;
 *   size?: number;
 * }} opts
 * @returns {Promise<string | null>}
 */
export async function composeStageExactPreview(opts) {
  if (typeof document === 'undefined') return null;
  const garmentUrl = opts.garmentUrl;
  const logos = (opts.logos || []).filter((l) => l?.logoDataUrl);
  const size = Math.max(400, Math.round(opts.size || 1000));
  if (!garmentUrl || !logos.length) return null;

  try {
    const garment = await loadHtmlImageCrossOrigin(garmentUrl);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    const gw = garment.naturalWidth || garment.width || size;
    const gh = garment.naturalHeight || garment.height || size;
    const fit = Math.min(size / gw, size / gh);
    const dw = gw * fit;
    const dh = gh * fit;
    const ox = (size - dw) / 2;
    const oy = (size - dh) / 2;
    ctx.drawImage(garment, ox, oy, dw, dh);

    for (const loc of logos) {
      const logoSrc = loc.logoDataUrl;
      const logo = /^https?:/i.test(logoSrc)
        ? await loadHtmlImageCrossOrigin(logoSrc)
        : await loadHtmlImage(logoSrc);
      const t = loc.transform || DEFAULT_DESIGN_TRANSFORM;
      // Transforms are % of the object-fit garment box (same as .design-studio-fit-layer),
      // not the full square canvas — otherwise letterboxing shifts/scales the art.
      const lw = Math.max(8, dw * (t.scale || 0.32));
      const lh =
        (logo.naturalHeight / Math.max(1, logo.naturalWidth)) * lw;
      const cx = ox + dw * (t.x ?? 0.5);
      const cy = oy + dh * (t.y ?? 0.36);
      const rot = ((t.rotation || 0) * Math.PI) / 180;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.drawImage(logo, -lw / 2, -lh / 2, lw, lh);
      ctx.restore();
    }

    return canvas.toDataURL('image/png', 0.92);
  } catch (err) {
    console.warn('[designStudio] stage-exact preview failed', err);
    return null;
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
 * Map a Firestore / getDesign packet into the storefront SavedProductDesign shape
 * used by Design Studio + ATC attributes.
 *
 * @param {Record<string, unknown> | null | undefined} remote
 * @returns {SavedProductDesign | null}
 */
export function remoteDesignToSaved(remote) {
  if (!remote || typeof remote !== 'object') return null;
  const id = remote.id != null ? String(remote.id) : null;
  if (!id) return null;

  const locationsIn = Array.isArray(remote.locations) ? remote.locations : [];
  const locations = locationsIn.map((loc, i) => {
    const l = /** @type {Record<string, unknown>} */ (loc || {});
    return {
      id: String(l.id || `loc-${i + 1}`),
      label: l.label != null ? String(l.label) : undefined,
      transform:
        l.transform && typeof l.transform === 'object'
          ? /** @type {typeof DEFAULT_DESIGN_TRANSFORM} */ (l.transform)
          : undefined,
      // Prefer hosted logo URL as logoDataUrl so studio/reorder can render art
      logoDataUrl:
        (typeof l.logoUrl === 'string' && l.logoUrl) ||
        (typeof l.logoDataUrl === 'string' && l.logoDataUrl) ||
        undefined,
    };
  });

  const viewMockupsIn = Array.isArray(remote.viewMockups)
    ? remote.viewMockups
    : [];
  const viewMockups = viewMockupsIn
    .map((m) => {
      const vm = /** @type {Record<string, unknown>} */ (m || {});
      if (!vm.view) return null;
      return {
        view: /** @type {'front'|'back'|'side'|string} */ (String(vm.view)),
        url: typeof vm.url === 'string' ? vm.url : null,
        dataUrl: null,
      };
    })
    .filter(Boolean);

  const printStyleRaw = remote.printStyle;
  /** @type {'simple' | 'full' | undefined} */
  let printStyle;
  if (printStyleRaw === 'simple' || printStyleRaw === 'full') {
    printStyle = printStyleRaw;
  }

  return {
    remoteId: id,
    logoDataUrl:
      (typeof remote.logoUrl === 'string' && remote.logoUrl) ||
      (typeof remote.logoDataUrl === 'string' && remote.logoDataUrl) ||
      '',
    transform:
      remote.transform && typeof remote.transform === 'object'
        ? /** @type {typeof DEFAULT_DESIGN_TRANSFORM} */ (remote.transform)
        : undefined,
    locations,
    printStyle,
    productHandle:
      typeof remote.productHandle === 'string' ? remote.productHandle : null,
    productId: typeof remote.productId === 'string' ? remote.productId : null,
    colorCode: typeof remote.colorCode === 'string' ? remote.colorCode : null,
    colorName: typeof remote.colorName === 'string' ? remote.colorName : null,
    previewUrl:
      typeof remote.previewUrl === 'string' ? remote.previewUrl : null,
    viewMockups: /** @type {DesignViewMockup[]} */ (viewMockups),
  };
}

/**
 * Public design API origin (for cart packet links).
 * @returns {string}
 */
export function getDesignApiBaseUrl() {
  return getApiBase();
}

/**
 * @deprecated Prefer composeStageExactPreview — kept as a thin wrapper.
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
  return composeStageExactPreview({
    garmentUrl: opts.garmentUrl,
    logos: opts.locations,
    size: 1000,
  });
}

/**
 * Normalize a color code for comparison (# optional, case-insensitive).
 * @param {string | null | undefined} code
 */
export function normalizeColorCode(code) {
  return String(code || '')
    .replace(/^#/, '')
    .trim()
    .toLowerCase();
}

/**
 * Re-bake front/back/side mockups onto a different blank color's photos.
 * Uses local logo data URLs when present; otherwise loads logos from the
 * remote design packet.
 *
 * @param {SavedProductDesign | null | undefined} design
 * @param {Array<{ url?: string; altText?: string | null } | null | undefined> | null | undefined} garmentImages
 * @returns {Promise<DesignViewMockup[]>}
 */
export async function rebuildDesignViewMockups(design, garmentImages) {
  if (!design || typeof document === 'undefined') return [];

  const {
    garmentViewForLocation,
    pickGarmentViewImage,
    LOCATION_CATALOG,
  } = await import('~/components/DesignStudio/designStudioLocations');

  const locations = await resolveDesignLocationsForCompose(design);
  if (!locations.length) return [];

  const imagePool = (garmentImages || []).filter((img) => img?.url);
  /** @type {Record<string, typeof locations>} */
  const logosByView = {};
  for (const loc of locations) {
    const view = garmentViewForLocation(LOCATION_CATALOG[loc.id]);
    if (!logosByView[view]) logosByView[view] = [];
    logosByView[view].push(loc);
  }

  /** @type {DesignViewMockup[]} */
  const viewMockups = [];
  for (const view of /** @type {Array<'front'|'back'|'side'>} */ ([
    'front',
    'back',
    'side',
  ])) {
    const logos = logosByView[view];
    if (!logos?.length) continue;
    const garment = pickGarmentViewImage(imagePool, view) || imagePool[0];
    if (!garment?.url) continue;
    try {
      const dataUrl = await composeStageExactPreview({
        garmentUrl: garment.url,
        logos,
        size: 1000,
      });
      if (dataUrl) viewMockups.push({view, dataUrl, url: null});
    } catch {
      // continue other views
    }
  }

  return viewMockups;
}

/**
 * After the customer switches blank color: re-bake mockups and upload a hosted
 * preview so cart/order attributes get a real image (not a grey placeholder).
 *
 * Tries an in-place design update first; falls back to a full re-save (new ID)
 * which works even before the designId API is deployed.
 *
 * @param {{
 *   design: SavedProductDesign;
 *   colorCode?: string | null;
 *   colorName?: string | null;
 *   garmentImages?: Array<{ url?: string; altText?: string | null } | null | undefined> | null;
 * }} opts
 * @returns {Promise<SavedProductDesign>}
 */
export async function syncDesignMockupsForColor(opts) {
  const design = opts.design;
  if (!design?.remoteId) return design;

  const viewMockups = await rebuildDesignViewMockups(
    design,
    opts.garmentImages || [],
  );
  if (!viewMockups.length) {
    throw new Error(
      'Could not build a mockup for this blank color. Try again in a moment.',
    );
  }

  const previewBase64 = viewMockups[0].dataUrl;
  const colorCode = opts.colorCode ?? design.colorCode;
  const colorName = opts.colorName ?? design.colorName;

  // 1) Prefer updating the existing design packet (needs deployed API support)
  try {
    const updated = await saveDesignRemote({
      designId: design.remoteId,
      colorCode,
      colorName,
      previewBase64,
      viewMockups: viewMockups.map((m) => ({
        view: m.view,
        imageBase64: m.dataUrl,
      })),
    });
    if (updated?.previewUrl && !String(updated.previewUrl).startsWith('data:')) {
      return {
        ...design,
        remoteId: String(updated.id || design.remoteId),
        colorCode,
        colorName,
        previewUrl: String(updated.previewUrl),
        viewMockups: Array.isArray(updated.viewMockups) && updated.viewMockups.length
          ? updated.viewMockups.map((m) => ({
              view: m.view,
              url: m.url || null,
              dataUrl: null,
            }))
          : viewMockups,
      };
    }
  } catch {
    // Older API — fall through to full re-save
  }

  // 2) Full re-save with artwork + new mockups (works on current production API)
  const locations = await resolveDesignLocationsAsBase64(design);
  if (!locations.length) {
    throw new Error(
      'Could not load artwork to save this color’s mockup. Re-open Design Studio and save once, then switch colors.',
    );
  }

  const primary = locations[0];
  const created = await saveDesignRemote({
    productHandle: design.productHandle || null,
    productId: design.productId || null,
    colorCode,
    colorName,
    printStyle: design.printStyle || null,
    transform: primary.transform || design.transform || DEFAULT_DESIGN_TRANSFORM,
    logoBase64: primary.logoDataUrl,
    locations: locations.map((l) => ({
      id: l.id,
      label: l.label,
      transform: l.transform,
      logoBase64: l.logoDataUrl,
    })),
    previewBase64,
    viewMockups: viewMockups.map((m) => ({
      view: m.view,
      imageBase64: m.dataUrl,
    })),
  });

  if (!created?.id || !created?.previewUrl) {
    throw new Error('Design API did not return a preview for this color.');
  }

  return {
    ...design,
    remoteId: String(created.id),
    colorCode,
    colorName,
    previewUrl: String(created.previewUrl),
    // Keep local logo data so further color switches don’t need a round-trip
    locations: locations.map((l) => ({
      id: l.id,
      label: l.label,
      logoDataUrl: l.logoDataUrl,
      transform: l.transform || DEFAULT_DESIGN_TRANSFORM,
    })),
    logoDataUrl: primary.logoDataUrl,
    viewMockups: Array.isArray(created.viewMockups) && created.viewMockups.length
      ? created.viewMockups.map((m) => ({
          view: m.view,
          url: m.url || null,
          dataUrl: null,
        }))
      : viewMockups,
  };
}

/**
 * @param {SavedProductDesign} design
 * @returns {Promise<Array<{ id: string; label?: string; logoDataUrl: string; transform: typeof DEFAULT_DESIGN_TRANSFORM }>>}
 */
async function resolveDesignLocationsForCompose(design) {
  /** @type {Array<{ id: string; label?: string; logoDataUrl: string; transform: typeof DEFAULT_DESIGN_TRANSFORM }>} */
  let locations = (design.locations || [])
    .filter((l) => l?.logoDataUrl)
    .map((l) => ({
      id: l.id,
      label: l.label,
      logoDataUrl: l.logoDataUrl,
      transform: l.transform || DEFAULT_DESIGN_TRANSFORM,
    }));

  if (!locations.length && design.logoDataUrl) {
    locations = [
      {
        id: 'primary',
        logoDataUrl: design.logoDataUrl,
        transform: design.transform || DEFAULT_DESIGN_TRANSFORM,
      },
    ];
  }

  if (!locations.length && design.remoteId) {
    try {
      const remote = await getDesignRemote(design.remoteId);
      const remoteLocs = Array.isArray(remote?.locations)
        ? remote.locations
        : [];
      locations = remoteLocs
        .filter((l) => l?.logoUrl)
        .map((l) => ({
          id: String(l.id || 'location'),
          label: l.label ? String(l.label) : undefined,
          logoDataUrl: String(l.logoUrl),
          transform: /** @type {typeof DEFAULT_DESIGN_TRANSFORM} */ (
            l.transform || DEFAULT_DESIGN_TRANSFORM
          ),
        }));
      if (!locations.length && remote?.logoUrl) {
        locations = [
          {
            id: 'primary',
            logoDataUrl: String(remote.logoUrl),
            transform: /** @type {typeof DEFAULT_DESIGN_TRANSFORM} */ (
              remote.transform || DEFAULT_DESIGN_TRANSFORM
            ),
          },
        ];
      }
    } catch (err) {
      console.warn('[designStudio] could not load logos for mockup rebuild', err);
    }
  }

  return locations;
}

/**
 * Same as compose locations, but forces data-URL / base64 payloads for saveDesign.
 * @param {SavedProductDesign} design
 */
async function resolveDesignLocationsAsBase64(design) {
  const locations = await resolveDesignLocationsForCompose(design);
  const out = [];
  for (const loc of locations) {
    try {
      const logoDataUrl = await imageSrcToDataUrl(loc.logoDataUrl);
      out.push({...loc, logoDataUrl});
    } catch (err) {
      console.warn('[designStudio] could not encode logo for re-save', err);
    }
  }
  return out;
}

/**
 * @param {string} src
 * @returns {Promise<string>}
 */
async function imageSrcToDataUrl(src) {
  if (!src) throw new Error('Missing image');
  if (String(src).startsWith('data:')) return String(src);

  try {
    const img = await loadHtmlImageCrossOrigin(src);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    const res = await fetch(src, {mode: 'cors'});
    if (!res.ok) throw new Error('Could not fetch artwork');
    const blob = await res.blob();
    return blobToDataUrl(blob);
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
  y: 0.44,
  scale: 0.36,
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
 *   view: 'front' | 'back' | 'side';
 *   url?: string | null;
 *   dataUrl?: string | null;
 * }} DesignViewMockup
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
 *   viewMockups?: DesignViewMockup[];
 * }} SavedProductDesign
 */
