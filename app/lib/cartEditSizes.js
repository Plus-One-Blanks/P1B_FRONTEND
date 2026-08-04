/**
 * Cart "edit sizes" helpers: detect color-like options and parse variant titles.
 * Used by CartLineItem, CartEditSizesModal, and cart-edit-sizes route.
 */

/**
 * @param {string} name
 */
export function isColorLikeOptionName(name) {
  const n = name.toLowerCase().trim();
  if (
    n === 'color' ||
    n === 'colour' ||
    n === 'colors' ||
    n === 'colours'
  ) {
    return true;
  }
  if (n.includes('colour') || n.includes('color')) return true;
  return false;
}

/**
 * @param {{ name: string; value: string }} opt
 */
export function isSizeOption(opt) {
  return opt.name.toLowerCase().trim() === 'size';
}

/**
 * Prefer explicit color-like option names, then a single non-size option.
 * @param {Array<{ name: string; value: string }> | undefined} selectedOptions
 * @returns {{ name: string; value: string } | null}
 */
export function findColorSelectedOption(selectedOptions) {
  if (!selectedOptions?.length) return null;
  const byName = selectedOptions.find((o) => isColorLikeOptionName(o.name));
  if (byName) return byName;
  const nonSize = selectedOptions.filter((o) => !isSizeOption(o));
  if (nonSize.length === 1) return nonSize[0];
  return null;
}

/**
 * Shopify variant titles often look like "White / XL" or "Product Name - Navy / M".
 * @param {string | undefined | null} title
 * @param {{ name: string; value: string } | undefined} sizeOption
 * @returns {{ name: string; value: string } | null}
 */
/**
 * Many stores encode color in the product title after a dash, e.g. "G500 Tee - Sage".
 * @param {string | undefined | null} productTitle
 * @returns {{ name: string; value: string } | null}
 */
/**
 * Custom properties on the cart line (some themes send Color here).
 * @param {Array<{ key?: string; value?: string }> | undefined} attributes
 * @returns {{ name: string; value: string } | null}
 */
export function findColorInLineAttributes(attributes) {
  if (!attributes?.length) return null;
  const hit = attributes.find((a) => {
    const k = (a.key ?? '').toLowerCase().trim();
    if (!k) return false;
    // Design Studio metadata — not the blank's cart color option
    if (k === 'garment color' || k.startsWith('_design')) return false;
    if (k === 'color' || k === 'colour' || k === 'colors' || k === 'colours') {
      return true;
    }
    return k.includes('color') || k.includes('colour');
  });
  const v = hit?.value?.trim();
  if (!v) return null;
  return {name: hit.key ?? 'Color', value: v};
}

export function inferColorFromProductTitle(productTitle) {
  if (!productTitle || typeof productTitle !== 'string') return null;
  const trimmed = productTitle.trim();
  /** ASCII hyphen, en dash, em dash */
  const dashChars = ['-', '\u2013', '\u2014'];
  let lastIdx = -1;
  for (const ch of dashChars) {
    const i = trimmed.lastIndexOf(ch);
    if (i > lastIdx) lastIdx = i;
  }
  if (lastIdx <= 0 || lastIdx >= trimmed.length - 1) return null;
  const tail = trimmed.slice(lastIdx + 1).trim();
  if (!tail || tail.length < 2 || tail.length > 60) return null;
  // Skip common spec fragments (e.g. "5.3 oz", "6.1 oz")
  if (/^\d+(\.\d+)?\s*(oz|ml|g|lb)s?\b/i.test(tail)) return null;
  return {name: 'Color', value: tail};
}

export function inferColorFromVariantTitle(title, sizeOption) {
  if (!title || !sizeOption) return null;
  const parts = title.split(/\s*\/\s*/).map((p) => p.trim()).filter(Boolean);
  const sizeVal = sizeOption.value.toLowerCase().trim();

  if (parts.length >= 2) {
    const last = parts[parts.length - 1].toLowerCase().trim();
    if (last === sizeVal) {
      let colorSource = parts.slice(0, -1).join(' / ');
      const dashIdx = colorSource.lastIndexOf('-');
      if (dashIdx > 0) {
        colorSource = colorSource.substring(dashIdx + 1).trim();
      }
      if (
        colorSource &&
        colorSource.toLowerCase().trim() !== sizeVal
      ) {
        return {name: 'Color', value: colorSource};
      }
    }
  }

  const lastDashIndex = title.lastIndexOf('-');
  if (lastDashIndex > 0) {
    const afterDash = title.substring(lastDashIndex + 1).trim();
    const colorPart = afterDash.split(/\s*\/\s*/)[0].trim();
    if (colorPart && colorPart.toLowerCase() !== sizeVal) {
      return {name: 'Color', value: colorPart};
    }
  }

  return null;
}

/**
 * All options except size (used with anchor variant filtering).
 * @param {Array<{ name: string; value: string }>} selectedOptions
 */
export function nonSizeSelectedOptions(selectedOptions) {
  return selectedOptions.filter((o) => !isSizeOption(o));
}

/**
 * True if every non-size option on `a` matches `b` (same name + value).
 * @param {Array<{ name: string; value: string }>} a
 * @param {Array<{ name: string; value: string }>} b
 */
export function sameNonSizeSelection(a, b) {
  const aNS = nonSizeSelectedOptions(a);
  if (!aNS.length) return nonSizeSelectedOptions(b).length === 0;
  return aNS.every((opt) => {
    const found = b.find((x) => x.name === opt.name && x.value === opt.value);
    return Boolean(found);
  });
}

/**
 * Stable key: same product + same color (and other non-size options) → one cart card.
 * @param {{ id?: string; attributes?: Array<{ key?: string; value?: string }>; merchandise?: { id?: string; title?: string; product?: { handle?: string; title?: string }; selectedOptions?: Array<{ name: string; value: string }> } }} line
 */
export function getCartLineGroupKey(line) {
  const m = line?.merchandise;
  if (!m || typeof m !== 'object' || !m.product?.handle) {
    return String(line?.id ?? '');
  }
  const handle = m.product.handle;
  const opts = nonSizeSelectedOptions(m.selectedOptions ?? []);
  if (opts.length === 0) {
    const fromAttrs = findColorInLineAttributes(line.attributes);
    const selected = m.selectedOptions ?? [];
    const sizeOpt = selected.find(isSizeOption);
    const fromVariant =
      sizeOpt && m.title
        ? inferColorFromVariantTitle(m.title, sizeOpt)
        : null;
    const fromProduct = inferColorFromProductTitle(m.product?.title);
    const inferred = fromAttrs || fromVariant || fromProduct;
    if (inferred?.value) {
      const c = String(inferred.value).toLowerCase().trim();
      return `${handle}::c:${c}`;
    }
    return `${handle}::sizeonly`;
  }
  const normalized = [...opts]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((o) => `${o.name}:${o.value}`)
    .join('|');
  return `${handle}::ns:${normalized}`;
}

/**
 * @param {{ merchandise?: { selectedOptions?: Array<{ name: string; value: string }> } }} line
 */
function lineSizeOptionValue(line) {
  const opts = line?.merchandise?.selectedOptions ?? [];
  const s = opts.find((o) => o.name.toLowerCase().trim() === 'size');
  return String(s?.value ?? '').trim();
}

/**
 * Normalize size label for lookup (lowercase, collapse inner spaces).
 * @param {string} v
 */
function normalizeSizeLabel(v) {
  return String(v ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '');
}

/**
 * Numeric rank for ordering sizes small → large (lower = smaller / earlier in run).
 * Unknown labels sort after known ones, stable vs original string.
 * @param {string} raw
 */
function apparelSizeSortRank(raw) {
  const spaced = normalizeSizeLabel(raw);
  if (!spaced) return 50_000;
  const compact = spaced.replace(/\s+/g, '');

  /** Explicit ranks — common Shopify + spelled-out variants */
  const explicit = new Map(
    [
      ['os', 5],
      ['o/s', 5],
      ['one size', 5],
      ['onesize', 5],
      ['xxs', 12],
      ['2xs', 14],
      ['xs', 20],
      ['extra small', 20],
      ['s', 30],
      ['small', 30],
      ['st', 32],
      ['m', 40],
      ['medium', 40],
      ['mt', 42],
      ['l', 50],
      ['large', 50],
      ['lt', 52],
      ['xl', 60],
      ['extra large', 60],
      ['xxl', 70],
      ['2xl', 72],
      ['xxxl', 74],
      ['3xl', 76],
      ['4xl', 78],
      ['5xl', 80],
      ['6xl', 82],
      ['yxs', 16],
      ['ys', 26],
      ['ym', 36],
      ['yl', 46],
      ['yxl', 56],
    ].flatMap(([k, v]) => [
      [k, v],
      [k.replace(/\s+/g, ''), v],
    ]),
  );

  if (explicit.has(spaced)) return /** @type {number} */ (explicit.get(spaced));
  if (explicit.has(compact)) return /** @type {number} */ (explicit.get(compact));

  // Digit + XL (e.g. 2xl, 3xl) not in map
  const numXl = compact.match(/^(\d)xl$/);
  if (numXl) {
    const d = Number(numXl[1]);
    if (d >= 2 && d <= 9) return 70 + d * 2;
  }

  // Pure numeric (waist/inseam etc.) — sort numerically after letter sizes
  const numOnly = compact.match(/^(\d+(\.\d+)?)$/);
  if (numOnly) {
    return 4000 + parseFloat(numOnly[1]) * 10;
  }

  // Letter run without spaces (e.g. "mediumtall" unlikely) — try stripping non-letters
  const lettersOnly = compact.replace(/[^a-z]/g, '');
  if (lettersOnly && explicit.has(lettersOnly)) {
    return /** @type {number} */ (explicit.get(lettersOnly)) + 0.25;
  }

  return 20_000 + compact.charCodeAt(0) * 0.001;
}

/**
 * @param {{ id?: string; merchandise?: { selectedOptions?: Array<{ name: string; value: string }> } }} a
 * @param {{ id?: string; merchandise?: { selectedOptions?: Array<{ name: string; value: string }> } }} b
 */
function compareCartLinesBySize(a, b) {
  const ra = apparelSizeSortRank(lineSizeOptionValue(a));
  const rb = apparelSizeSortRank(lineSizeOptionValue(b));
  if (ra !== rb) return ra - rb;
  return String(a.id ?? '').localeCompare(String(b.id ?? ''));
}

/**
 * Group lines for the full cart page (same model + color → one card, multiple size rows).
 * @param {Array<{ id: string }>} lines
 */
export function groupCartLinesForPageDisplay(lines) {
  if (!lines?.length) return [];
  /** @type {Map<string, typeof lines>} */
  const map = new Map();
  const order = [];
  for (const line of lines) {
    const k = getCartLineGroupKey(line);
    if (!map.has(k)) {
      map.set(k, []);
      order.push(k);
    }
    map.get(k).push(line);
  }
  return order.map((k) => {
    const g = map.get(k) ?? [];
    return [...g].sort(compareCartLinesBySize);
  });
}
