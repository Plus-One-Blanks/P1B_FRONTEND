/**
 * Hex from `colorCode:#BE531C` (or without #) on product tags.
 * @param {string[] | undefined} tags
 * @returns {string | null} normalized `#rrggbb`
 */
export function extractColorCodeHex(tags) {
  if (!tags?.length) return null;
  for (const t of tags) {
    const s = String(t).trim();
    if (!/^colorCode:/i.test(s)) continue;
    let hex = s.replace(/^colorCode:/i, '').trim();
    if (!hex.startsWith('#')) hex = `#${hex}`;
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
    if (!m) continue;
    let out = hex.toLowerCase();
    if (out.length === 4) {
      const r = out[1];
      const g = out[2];
      const b = out[3];
      out = `#${r}${r}${g}${g}${b}${b}`;
    }
    return out;
  }
  return null;
}

/**
 * Pale swatches need a visible edge on white image backgrounds.
 * @param {string | null | undefined} hex
 */
export function isLightSwatchHex(hex) {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return false;
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (r + g + b) / 3 >= 245;
}

/** Brand logos (Shopify Files CDN) + collection paths — adjust handles if yours differ. */
export const HOME_QUALITY_BRANDS = [
  {
    imageUrl:
      'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/LANE_SEVEN_LOGO.png?v=1775164722',
    alt: 'Lane Seven',
    to: '/collections/lane-seven',
  },
  {
    imageUrl:
      'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/VALUCAP_LOGO.png?v=1775164722',
    alt: 'Valucap',
    to: '/collections/valucap',
  },
  {
    imageUrl:
      'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/RICHARDSON_LOGO.png?v=1775164722',
    alt: 'Richardson',
    to: '/collections/richardson',
  },
  {
    imageUrl:
      'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/NEXT_LEVEL_LOGO.png?v=1775164722',
    alt: 'Next Level',
    to: '/collections/next-level',
  },
  {
    imageUrl:
      'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/AMERICAN_APPAREL_LOGO.png?v=1775529615',
    alt: 'American Apparel',
    to: '/collections/american-apparel',
  },
  {
    imageUrl:
      'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/REALTREE_LOGO.png?v=1775529882',
    alt: 'Realtree',
    to: '/collections/realtree',
  },
  {
    imageUrl:
      'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/BELLA_CANVAS_LOGO.png?v=1775520833',
    alt: 'Bella Canvas',
    to: '/collections/bella-canvas',
  },
  {
    imageUrl:
      'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/GILDAN_LOGO.png?v=1775164722',
    alt: 'Gildan',
    to: '/collections/gildan',
  },
  {
    imageUrl:
      'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/COMFORT_COLORS_LOGO.png?v=1775164722',
    alt: 'Comfort Colors',
    to: '/collections/comfort-colors',
  },
  {
    imageUrl:
      'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/OAKLEY_LOGO.png?v=1775164722',
    alt: 'Oakley',
    to: '/collections/oakley',
  },
  {
    imageUrl:
      'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/INDEPENDENT_LOGO.png?v=1775164722',
    alt: 'Independent Trading Co.',
    to: '/collections/independent-trading-co',
  },
  {
    imageUrl:
      'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/SHAKA_LOGO.png?v=1775164722',
    alt: 'Shaka Wear',
    to: '/collections/shaka-wear',
  },
  {
    imageUrl:
      'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/HANES_LOGO.png?v=1775164722',
    alt: 'Hanes',
    to: '/collections/hanes',
  },
];

/**
 * Lowercase needles per brand `alt` — matched against Shopify `vendor` and each `tags` entry.
 * Longer phrases first to prefer specific matches (e.g. Independent Trading vs generic words).
 */
export const HOME_BRAND_LOGO_MATCH_KEYS = {
  'Lane Seven': ['lane seven apparel', 'lane seven', 'laneseven'],
  Valucap: ['valucap'],
  Richardson: ['richardson'],
  'Next Level': ['next level apparel', 'next level', 'nextlevel'],
  'American Apparel': ['american apparel', 'americanapparel'],
  Realtree: ['realtree', 'real tree'],
  'Bella Canvas': ['bella canvas', 'bellacanvas'],
  Gildan: ['gildan'],
  'Comfort Colors': ['comfort colors', 'comfortcolors'],
  Oakley: ['oakley'],
  'Independent Trading Co.': [
    'independent trading company',
    'independent trading co',
    'independent trading',
  ],
  'Shaka Wear': ['shaka wear', 'shaka'],
  Hanes: ['hanes'],
};

export function normalizeForBrandMatch(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/['.]/g, '')
    .replace(/\+/g, ' ')
    .replace(/&/g, 'and')
    .replace(/\s+/g, ' ');
}

/**
 * Resolve logo URL from `HOME_QUALITY_BRANDS` when vendor or tags mention a known brand.
 * @param {string | null | undefined} vendor
 * @param {string[] | null | undefined} tags
 * @returns {{ imageUrl: string; alt: string } | null}
 */
export function resolveBrandLogoFromVendorAndTags(vendor, tags) {
  const vendorNorm = normalizeForBrandMatch(vendor);
  const tagNorms = (tags || []).map(normalizeForBrandMatch).filter(Boolean);

  /**
   * @param {string} needle
   */
  function needleMatches(needle) {
    if (!needle || needle.length < 3) return false;
    if (vendorNorm === needle) return true;
    if (needle.length >= 4 && vendorNorm.includes(needle)) return true;
    for (const t of tagNorms) {
      if (t === needle) return true;
      if (needle.length >= 4 && t.includes(needle)) return true;
    }
    return false;
  }

  for (const brand of HOME_QUALITY_BRANDS) {
    const needles =
      HOME_BRAND_LOGO_MATCH_KEYS[brand.alt] ?? [normalizeForBrandMatch(brand.alt)];
    for (const needle of needles) {
      if (needleMatches(needle)) {
        return { imageUrl: brand.imageUrl, alt: brand.alt };
      }
    }
  }
  return null;
}

const HOME_FEATURED_SWATCH_FALLBACK = [
  '#e5e5e5',
  '#d4d4d8',
  '#a3a3a3',
  '#78716c',
  '#57534e',
  '#44403c',
];

/**
 * @param {number} index
 * @param {{ count: number; swatchHexes: string[] } | undefined} siblingColorData
 * @param {{ tags?: string[] }} product
 */
export function getFeaturedCardSwatchColor(index, siblingColorData, product) {
  const fromGroup = siblingColorData?.swatchHexes?.[index];
  if (fromGroup) return fromGroup;
  if (index === 0) {
    const own = extractColorCodeHex(product.tags);
    if (own) return own;
  }
  return HOME_FEATURED_SWATCH_FALLBACK[index % HOME_FEATURED_SWATCH_FALLBACK.length];
}

/**
 * Whether this option name is typically a color choice (Shopify naming varies).
 * @param {string | undefined} name
 */
function isLikelyColorOptionName(name) {
  if (!name) return false;
  const n = name.trim();
  return /\b(color|colour|colou?rway|ink|shade|swatch|hue|palette|tone)\b/i.test(
    n,
  );
}

/**
 * Distinct color values: union of variant selectedOptions and product.options.values.
 * @param {{
 *   options?: Array<{ name: string; values: string[] }>;
 *   variants?: { nodes?: Array<{ selectedOptions?: Array<{ name: string; value: string }> }> };
 * }} product
 */
export function getColorValuesForProduct(product) {
  const byOption = new Map();

  for (const v of product.variants?.nodes ?? []) {
    for (const o of v.selectedOptions ?? []) {
      if (!byOption.has(o.name)) byOption.set(o.name, new Set());
      byOption.get(o.name).add(o.value);
    }
  }

  for (const opt of product.options ?? []) {
    if (!byOption.has(opt.name)) byOption.set(opt.name, new Set());
    const set = byOption.get(opt.name);
    for (const val of opt.values ?? []) {
      set.add(val);
    }
  }

  let colorName = null;
  for (const [name, set] of byOption) {
    if (isLikelyColorOptionName(name) && set.size) {
      colorName = name;
      break;
    }
  }

  if (!colorName) {
    let bestName = null;
    let bestSize = 0;
    for (const [name, set] of byOption) {
      if (/^title$/i.test(name.trim()) && set.size <= 1) continue;
      if (set.size > bestSize) {
        bestSize = set.size;
        bestName = name;
      }
    }
    colorName = bestName;
  }

  if (!colorName) return [];

  const set = byOption.get(colorName);
  const ordered = product.options?.find((o) => o.name === colorName)?.values ?? [];
  const seen = new Set();
  const out = [];
  for (const v of ordered) {
    if (set.has(v) && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  for (const v of set) {
    if (!seen.has(v)) out.push(v);
  }
  return out;
}
