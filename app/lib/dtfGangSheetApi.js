/**
 * Client for DTF gang sheet Cloud Functions (same PUBLIC_DESIGN_API_URL service).
 */

import {getDesignApiBaseUrl} from '~/lib/designStudioApi';

/**
 * @typedef {{
 *   id: string;
 *   designId?: string | null;
 *   label?: string;
 *   transform: { x: number; y: number; scale: number; rotation: number };
 *   imageDataUrl?: string | null;
 *   imageUrl?: string | null;
 *   widthIn?: number | null;
 *   heightIn?: number | null;
 * }} GangSheetItemLocal
 */

/**
 * @typedef {{
 *   remoteId: string | null;
 *   sheetSize: string;
 *   sheetWidthIn: number;
 *   sheetHeightIn: number;
 *   items: GangSheetItemLocal[];
 *   previewUrl?: string | null;
 *   previewDataUrl?: string | null;
 *   productHandle?: string | null;
 *   designName?: string | null;
 * }} SavedGangSheet
 */

/**
 * @param {{
 *   gangSheetId?: string | null;
 *   sheetSize: string;
 *   sheetWidthIn: number;
 *   sheetHeightIn: number;
 *   productHandle?: string | null;
 *   productId?: string | null;
 *   designName?: string | null;
 *   previewBase64?: string | null;
 *   items: Array<{
 *     id: string;
 *     designId?: string | null;
 *     label?: string;
 *     transform: { x: number; y: number; scale: number; rotation: number };
 *     imageBase64: string;
 *     widthIn?: number | null;
 *     heightIn?: number | null;
 *   }>;
 * }} payload
 */
export async function saveGangSheetRemote(payload) {
  const base = getDesignApiBaseUrl();
  if (!base) {
    console.warn('[dtf] PUBLIC_DESIGN_API_URL not set — cannot save gang sheet');
    return null;
  }

  const res = await fetch(`${base}/saveGangSheet`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[dtf] saveGangSheet failed', res.status, text);
    return null;
  }
  const json = await res.json();
  return json.gangSheet || null;
}

/**
 * @param {string} id
 */
export async function getGangSheetRemote(id) {
  const base = getDesignApiBaseUrl();
  if (!base || !id) return null;
  const res = await fetch(
    `${base}/getGangSheet?id=${encodeURIComponent(String(id))}`,
  );
  if (!res.ok) return null;
  const json = await res.json();
  return json.gangSheet || null;
}

/**
 * Bake a sheet preview (art placed on sheet) for cart thumb / confirm snapshot.
 * @param {{
 *   sheetWidthIn: number;
 *   sheetHeightIn: number;
 *   items: GangSheetItemLocal[];
 *   maxPx?: number;
 *   transparent?: boolean;
 * }} opts
 * @returns {Promise<string | null>} data URL
 */
export async function composeGangSheetPreview(opts) {
  const {
    sheetWidthIn,
    sheetHeightIn,
    items,
    maxPx = 900,
    transparent = false,
    /**
     * `full` — entire sheet (can be very tall/skinny).
     * `top-square` — crop to sheet-width × sheet-width from the top
     *   so cart thumbs for long sheets (e.g. 7ft) stay readable.
     */
    framing = 'full',
  } = opts;
  if (!sheetWidthIn || !sheetHeightIn || !items?.length) return null;

  const viewWidthIn = sheetWidthIn;
  const viewHeightIn =
    framing === 'top-square'
      ? Math.min(sheetHeightIn, sheetWidthIn)
      : sheetHeightIn;
  const viewOffsetYIn = 0;

  const aspect = viewWidthIn / viewHeightIn;
  let w = maxPx;
  let h = Math.round(maxPx / aspect);
  if (h > maxPx) {
    h = maxPx;
    w = Math.round(maxPx * aspect);
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  if (transparent) {
    ctx.clearRect(0, 0, w, h);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
  }

  const pxPerIn = w / viewWidthIn;

  for (const item of items) {
    const raw = item.imageDataUrl || item.imageUrl;
    if (!raw) continue;
    try {
      // Always prefer a data URL so the canvas stays untainted for toDataURL.
      let src = String(raw);
      if (!src.startsWith('data:')) {
        const converted = await fetchImageAsDataUrl(src);
        if (!converted) {
          console.warn('[dtf] preview skipped (no data url)', item.id);
          continue;
        }
        src = converted;
      }
      const img = await loadImage(src);
      const t = item.transform || {x: 0.5, y: 0.5, scale: 0.2, rotation: 0};
      // t.scale is width relative to full sheet width.
      const drawW = Math.max(8, t.scale * sheetWidthIn * pxPerIn);
      const drawH = (img.height / img.width) * drawW;
      const cxIn = t.x * sheetWidthIn;
      const cyIn = t.y * sheetHeightIn;
      const cx = cxIn * pxPerIn;
      const cy = (cyIn - viewOffsetYIn) * pxPerIn;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(((t.rotation || 0) * Math.PI) / 180);
      const sx = t.flipH ? -1 : 1;
      const sy = t.flipV ? -1 : 1;
      if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    } catch (e) {
      console.warn('[dtf] preview item failed', e);
    }
  }

  try {
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.error('[dtf] composeGangSheetPreview toDataURL failed', e);
    return null;
  }
}

/**
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // crossOrigin on data: URLs can fail to load in some browsers
    if (/^https?:\/\//i.test(String(src))) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Map remote packet → local SavedGangSheet
 * @param {Record<string, unknown>} remote
 * @returns {SavedGangSheet}
 */
export function remoteGangSheetToSaved(remote) {
  const items = Array.isArray(remote.items)
    ? remote.items.map((it) => ({
        id: String(it.id || ''),
        designId: it.designId != null ? String(it.designId) : null,
        label: it.label != null ? String(it.label) : '',
        transform: it.transform || {x: 0.5, y: 0.5, scale: 0.2, rotation: 0},
        imageUrl: it.imageUrl || null,
        imageDataUrl: null,
        widthIn: it.widthIn != null ? Number(it.widthIn) : null,
        heightIn: it.heightIn != null ? Number(it.heightIn) : null,
      }))
    : [];

  return {
    remoteId: remote.id ? String(remote.id) : null,
    sheetSize: String(remote.sheetSize || '22x24'),
    sheetWidthIn: Number(remote.sheetWidthIn) || 22,
    sheetHeightIn: Number(remote.sheetHeightIn) || 24,
    items,
    previewUrl: remote.previewUrl ? String(remote.previewUrl) : null,
    previewDataUrl: null,
    productHandle: remote.productHandle
      ? String(remote.productHandle)
      : null,
    designName: remote.designName ? String(remote.designName) : null,
  };
}

/**
 * Same-origin proxy URL for a remote artwork file (avoids canvas CORS taint).
 * @param {string} remoteUrl
 */
export function dtfImageProxyUrl(remoteUrl) {
  const src = String(remoteUrl || '');
  if (!src || src.startsWith('data:')) return src;
  if (src.includes('/api/dtf-image-proxy')) return src;
  return `/api/dtf-image-proxy?url=${encodeURIComponent(src)}`;
}

/**
 * Fetch an image URL as a data URL (for canvas / re-save).
 * Falls back to the same-origin proxy when GCS CORS blocks direct fetch.
 * @param {string} url
 * @returns {Promise<string | null>}
 */
export async function fetchImageAsDataUrl(url) {
  if (!url) return null;
  if (String(url).startsWith('data:')) return String(url);

  const candidates = [String(url)];
  if (/^https?:\/\//i.test(String(url))) {
    candidates.push(dtfImageProxyUrl(url));
  }

  for (const candidate of candidates) {
    try {
      const res = await fetch(candidate, {
        mode: 'cors',
        credentials: 'omit',
      });
      if (!res.ok) continue;
      const blob = await res.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      if (dataUrl?.startsWith('data:')) return dataUrl;
    } catch (e) {
      console.warn('[dtf] fetchImageAsDataUrl candidate failed', candidate, e);
    }
  }

  // Last resort: draw via <img> (only safe for same-origin / proxy URLs)
  for (const candidate of candidates) {
    if (/^https?:\/\//i.test(candidate) && !candidate.includes('/api/dtf-image-proxy')) {
      continue;
    }
    try {
      const img = await loadImage(candidate);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx || !canvas.width || !canvas.height) continue;
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL('image/png');
    } catch (e) {
      console.warn('[dtf] fetchImageAsDataUrl canvas failed', e);
    }
  }

  return null;
}

