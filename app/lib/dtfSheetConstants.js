/**
 * DTF sheet sizes + Shopify product handles.
 * Create matching products/variants in Shopify Admin (see docs/dtf-gang-sheet.md
 * or `node scripts/create-dtf-products.js`).
 */

/**
 * @typedef {{
 *   id: string;
 *   label: string;
 *   feetLabel: string;
 *   widthIn: number;
 *   heightIn: number;
 *   feet: number;
 *   variantTitle: string;
 *   badge?: string | null;
 *   badgeTone?: 'popular' | 'save' | 'value' | null;
 *   defaultPrice: string;
 * }} DtfSheetSize
 */

/** Gang sheet SKU product handle in Shopify */
export const DTF_GANG_SHEET_PRODUCT_HANDLE = 'dtf-gang-sheet';

/** Individual transfer-by-size product handle in Shopify */
export const DTF_TRANSFER_BY_SIZE_PRODUCT_HANDLE = 'dtf-transfer-by-size';

/**
 * All sheets are 22″ wide. Length in feet (like DTFSheet).
 * @type {DtfSheetSize[]}
 */
export const DTF_GANG_SHEET_SIZES = [
  {
    id: '2ft',
    label: '2 Feet',
    feetLabel: '2 Feet',
    widthIn: 22,
    heightIn: 24,
    feet: 2,
    variantTitle: '2 Feet',
    badge: null,
    badgeTone: null,
    defaultPrice: '19.99',
  },
  {
    id: '5ft',
    label: '5 Feet',
    feetLabel: '5 Feet',
    widthIn: 22,
    heightIn: 60,
    feet: 5,
    variantTitle: '5 Feet',
    badge: 'Popular',
    badgeTone: 'popular',
    defaultPrice: '44.99',
  },
  {
    id: '7ft',
    label: '7 Feet',
    feetLabel: '7 Feet',
    widthIn: 22,
    heightIn: 84,
    feet: 7,
    variantTitle: '7 Feet',
    badge: null,
    badgeTone: null,
    defaultPrice: '59.99',
  },
  {
    id: '10ft',
    label: '10 Feet',
    feetLabel: '10 Feet',
    widthIn: 22,
    heightIn: 120,
    feet: 10,
    variantTitle: '10 Feet',
    badge: 'Save 35%',
    badgeTone: 'save',
    defaultPrice: '74.99',
  },
  {
    id: '15ft',
    label: '15 Feet',
    feetLabel: '15 Feet',
    widthIn: 22,
    heightIn: 180,
    feet: 15,
    variantTitle: '15 Feet',
    badge: null,
    badgeTone: null,
    defaultPrice: '99.99',
  },
  {
    id: '20ft',
    label: '20 Feet',
    feetLabel: '20 Feet',
    widthIn: 22,
    heightIn: 240,
    feet: 20,
    variantTitle: '20 Feet',
    badge: 'Best value',
    badgeTone: 'value',
    defaultPrice: '119.99',
  },
];

/**
 * Individual transfer finished sizes.
 * `use` is the popular-size label shown in the by-size picker.
 * @type {Array<{
 *   id: string;
 *   label: string;
 *   maxIn: number;
 *   widthIn: number;
 *   heightIn: number;
 *   variantTitle: string;
 *   defaultPrice: string;
 *   use: string;
 * }>}
 */
export const DTF_TRANSFER_SIZES = [
  {
    id: '2x2',
    label: '2″ × 2″',
    maxIn: 2,
    widthIn: 2,
    heightIn: 2,
    variantTitle: '2x2',
    defaultPrice: '1.49',
    use: 'Tag print / neck label',
  },
  {
    id: '3x3',
    label: '3″ × 3″',
    maxIn: 3,
    widthIn: 3,
    heightIn: 3,
    variantTitle: '3x3',
    defaultPrice: '2.49',
    use: 'Small tag / sleeve icon',
  },
  {
    id: '4x4',
    label: '4″ × 4″',
    maxIn: 4,
    widthIn: 4,
    heightIn: 4,
    variantTitle: '4x4',
    defaultPrice: '3.49',
    use: 'Left-chest logo',
  },
  {
    id: '5x5',
    label: '5″ × 5″',
    maxIn: 5,
    widthIn: 5,
    heightIn: 5,
    variantTitle: '5x5',
    defaultPrice: '4.49',
    use: 'Small chest / youth print',
  },
  {
    id: '8x8',
    label: '8″ × 8″',
    maxIn: 8,
    widthIn: 8,
    heightIn: 8,
    variantTitle: '8x8',
    defaultPrice: '6.99',
    use: 'Medium front print',
  },
  {
    id: '10x10',
    label: '10″ × 10″',
    maxIn: 10,
    widthIn: 10,
    heightIn: 10,
    variantTitle: '10x10',
    defaultPrice: '8.99',
    use: 'Standard adult front',
  },
  {
    id: '11x11',
    label: '11″ × 11″',
    maxIn: 11,
    widthIn: 11,
    heightIn: 11,
    variantTitle: '11x11',
    defaultPrice: '9.99',
    use: 'Adult full front',
  },
  {
    id: '12x12',
    label: '12″ × 12″',
    maxIn: 12,
    widthIn: 12,
    heightIn: 12,
    variantTitle: '12x12',
    defaultPrice: '11.99',
    use: 'Large adult front',
  },
];

/** Volume discount tiers shown on the by-size page (visual + messaging). */
export const DTF_TRANSFER_QTY_TIERS = [
  {min: 1, max: 14, discount: 0, label: '1–14'},
  {min: 15, max: 49, discount: 0.2, label: '15–49'},
  {min: 50, max: 99, discount: 0.3, label: '50–99'},
  {min: 100, max: 249, discount: 0.4, label: '100–249'},
  {min: 250, max: Infinity, discount: 0.5, label: '250+'},
];

/**
 * Match longest side (inches) to nearest transfer size bucket.
 * @param {number} longerSideIn
 */
export function nearestTransferSizeId(longerSideIn) {
  const n = Math.max(0.5, Number(longerSideIn) || 4);
  let best = DTF_TRANSFER_SIZES[0];
  let bestDiff = Math.abs(best.maxIn - n);
  for (const s of DTF_TRANSFER_SIZES) {
    const d = Math.abs(s.maxIn - n);
    if (d < bestDiff || (d === bestDiff && s.maxIn >= n)) {
      best = s;
      bestDiff = d;
    }
  }
  return best.id;
}

/**
 * @param {number} qty
 */
export function transferQtyTier(qty) {
  const q = Math.max(1, Number(qty) || 1);
  return (
    DTF_TRANSFER_QTY_TIERS.find((t) => q >= t.min && q <= t.max) ||
    DTF_TRANSFER_QTY_TIERS[0]
  );
}
export const DEFAULT_GANG_ITEM_TRANSFORM = {
  x: 0.25,
  y: 0.25,
  scale: 0.18,
  rotation: 0,
};

/**
 * Match a Shopify variant to a gang sheet size.
 * @param {Array<{ id: string; title: string; availableForSale?: boolean; price?: { amount: string; currencyCode?: string } }>} variants
 * @param {DtfSheetSize} sheet
 */
export function findGangSheetVariant(variants, sheet) {
  const nodes = variants || [];
  const title = String(sheet.variantTitle || '').toLowerCase();
  const id = String(sheet.id || '').toLowerCase();
  const feet = String(sheet.feet || '');
  return (
    nodes.find((v) => String(v.title).toLowerCase() === title) ||
    nodes.find((v) => String(v.title).toLowerCase().includes(id)) ||
    nodes.find((v) => {
      const t = String(v.title).toLowerCase();
      return t.includes(`${feet} feet`) || t.includes(`${feet}ft`) || t === feet;
    }) ||
    null
  );
}
