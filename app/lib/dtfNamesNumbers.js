/** Names & Numbers — fonts, sizes, and canvas text rendering for gang sheets. */

export const NN_PRINT_DPI = 300;

/** @typedef {'name-number' | 'name' | 'number'} NnMode */
/** @typedef {'small' | 'medium' | 'large'} NnSizeId */

/**
 * @typedef {{
 *   id: string;
 *   label: string;
 *   family: string;
 *   google?: string;
 * }} NnFont
 */

/**
 * Athletic / varsity-friendly fonts (Google Fonts where available).
 * @type {NnFont[]}
 */
export const NN_FONTS = [
  {id: 'alfaslab', label: 'Alfa Slab One', family: '"Alfa Slab One", serif', google: 'Alfa+Slab+One'},
  {id: 'anton', label: 'Anton', family: '"Anton", sans-serif', google: 'Anton'},
  {id: 'archivoblack', label: 'Archivo Black', family: '"Archivo Black", sans-serif', google: 'Archivo+Black'},
  {id: 'bebas', label: 'Bebas Neue', family: '"Bebas Neue", sans-serif', google: 'Bebas+Neue'},
  {id: 'blackops', label: 'Black Ops One', family: '"Black Ops One", system-ui', google: 'Black+Ops+One'},
  {id: 'bowlby', label: 'Bowlby One', family: '"Bowlby One", system-ui', google: 'Bowlby+One'},
  {id: 'graduate', label: 'COLLEGE', family: '"Graduate", serif', google: 'Graduate'},
  {id: 'oswald', label: 'COLLEGIATE', family: '"Oswald", sans-serif', google: 'Oswald:wght@700'},
  {id: 'luckiest', label: 'Luckiest Guy', family: '"Luckiest Guy", system-ui', google: 'Luckiest+Guy'},
  {id: 'russo', label: 'Russo One', family: '"Russo One", sans-serif', google: 'Russo+One'},
  {id: 'staatliches', label: 'Staatliches', family: '"Staatliches", sans-serif', google: 'Staatliches'},
  {id: 'teko', label: 'Teko', family: '"Teko", sans-serif', google: 'Teko:wght@600'},
];

/**
 * @type {Array<{ id: NnSizeId; label: string; nameH: number; numberH: number }>}
 */
export const NN_SIZE_PRESETS = [
  {id: 'small', label: 'Small', nameH: 1, numberH: 4},
  {id: 'medium', label: 'Medium', nameH: 1.5, numberH: 6},
  {id: 'large', label: 'Large', nameH: 2, numberH: 8},
];

export const NN_FILL_PRESETS = [
  {id: 'black', label: 'Black', value: '#0a0a0a'},
  {id: 'white', label: 'White', value: '#ffffff'},
  {id: 'navy', label: 'Navy', value: '#0f2744'},
  {id: 'red', label: 'Red', value: '#b91c1c'},
  {id: 'royal', label: 'Royal', value: '#1d4ed8'},
  {id: 'gold', label: 'Gold', value: '#ca8a04'},
];

export const NN_OUTLINE_PRESETS = [
  {id: 'off', label: 'Off', value: null},
  {id: 'white', label: 'White', value: '#ffffff'},
  {id: 'black', label: 'Black', value: '#0a0a0a'},
  {id: 'navy', label: 'Navy', value: '#0f2744'},
];

const FONT_LINK_ID = 'dtf-nn-google-fonts';

/** Inject Google Fonts stylesheet once. */
export function ensureNnFontsLoaded() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(FONT_LINK_ID)) return;
  const families = NN_FONTS.map((f) => f.google)
    .filter(Boolean)
    .join('&family=');
  const link = document.createElement('link');
  link.id = FONT_LINK_ID;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${families}&display=swap`;
  document.head.appendChild(link);
}

/**
 * @param {string} family
 * @param {number} px
 */
export async function waitForNnFont(family, px = 48) {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  try {
    await document.fonts.load(`700 ${px}px ${family}`);
  } catch {
    /* ignore */
  }
}

/**
 * @param {{
 *   text: string;
 *   fontFamily: string;
 *   heightIn: number;
 *   fill: string;
 *   outline: string | null;
 * }} opts
 * @returns {Promise<{ dataUrl: string; naturalWidth: number; naturalHeight: number; widthIn: number; heightIn: number }>}
 */
export async function renderNnTextGraphic({
  text,
  fontFamily,
  heightIn,
  fill,
  outline,
}) {
  const clean = String(text || '').trim();
  if (!clean) {
    throw new Error('Empty text');
  }
  const hIn = Math.max(0.35, heightIn);
  const heightPx = Math.round(hIn * NN_PRINT_DPI);
  await waitForNnFont(fontFamily, heightPx);

  const probe = document.createElement('canvas');
  const pctx = probe.getContext('2d');
  if (!pctx) throw new Error('Canvas unavailable');
  pctx.font = `700 ${heightPx}px ${fontFamily}`;
  const metrics = pctx.measureText(clean);
  const textW = Math.ceil(
    Math.max(
      metrics.width,
      (metrics.actualBoundingBoxLeft || 0) +
        (metrics.actualBoundingBoxRight || 0),
    ),
  );
  const ascent = Math.ceil(
    metrics.actualBoundingBoxAscent || heightPx * 0.8,
  );
  const descent = Math.ceil(
    metrics.actualBoundingBoxDescent || heightPx * 0.2,
  );
  const strokePad = outline ? Math.ceil(heightPx * 0.08) : Math.ceil(heightPx * 0.04);
  const widthPx = Math.max(8, textW + strokePad * 2);
  const canvasH = Math.max(8, ascent + descent + strokePad * 2);

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  ctx.clearRect(0, 0, widthPx, canvasH);
  ctx.font = `700 ${heightPx}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const x = widthPx / 2;
  const y = strokePad + ascent;

  if (outline) {
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.lineWidth = Math.max(2, heightPx * 0.1);
    ctx.strokeStyle = outline;
    ctx.strokeText(clean, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(clean, x, y);

  const widthIn = widthPx / NN_PRINT_DPI;
  const outHIn = canvasH / NN_PRINT_DPI;

  return {
    dataUrl: canvas.toDataURL('image/png'),
    naturalWidth: widthPx,
    naturalHeight: canvasH,
    widthIn: Number(widthIn.toFixed(3)),
    heightIn: Number(outHIn.toFixed(3)),
  };
}

/**
 * Parse pasted roster lines into name/number pairs.
 * Supports "NAME 23", "NAME,23", "NAME\t23".
 * @param {string} raw
 * @returns {Array<{ name: string; number: string }>}
 */
export function parseNnPasteList(raw) {
  return String(raw || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.*?)[\s,|;]+(\d+)\s*$/);
      if (m) {
        return {name: m[1].trim(), number: m[2]};
      }
      if (/^\d+$/.test(line)) {
        return {name: '', number: line};
      }
      return {name: line, number: ''};
    });
}
