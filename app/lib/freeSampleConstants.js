/**
 * Free Sample offer — questionnaire, placements, Shopify product.
 * Create product: `node scripts/create-free-sample-product.js`
 */

/** Shopify product handle for the free sample pack */
export const FREE_SAMPLE_PRODUCT_HANDLE = 'dtf-free-sample';

/** Variant option titles (must match Shopify) */
export const FREE_SAMPLE_VARIANTS = {
  free: {
    id: 'free',
    optionTitle: 'Custom Sample + Test Kit',
    priceLabel: '$0 TODAY',
    sku: 'DTF-FS-FREE',
  },
  credit: {
    id: 'credit',
    optionTitle: 'Test + Credit Boost',
    priceLabel: '$25 TODAY',
    sku: 'DTF-FS-CREDIT',
  },
  kit: {
    id: 'kit',
    optionTitle: 'Sample Kit',
    priceLabel: 'FREE',
    sku: 'DTF-FS-KIT',
  },
};

/**
 * @typedef {{
 *   id: string;
 *   label: string;
 *   options: Array<{ id: string; label: string }>;
 * }} FreeSampleQuestion
 */

/** @type {FreeSampleQuestion[]} */
export const FREE_SAMPLE_QUESTIONS = [
  {
    id: 'experience',
    label: 'START HERE',
    options: [
      {id: 'yes', label: 'Yes'},
      {id: 'not-yet', label: 'Not yet'},
    ],
  },
  {
    id: 'about',
    label: 'ABOUT YOU',
    options: [
      {id: 'custom-apparel', label: 'We make custom apparel for customers'},
      {id: 'apparel-brand', label: 'We run an apparel brand'},
      {id: 'resell', label: 'We resell apparel or merchandise'},
      {id: 'promo', label: 'We sell promotional products'},
      {id: 'other', label: 'Something else'},
    ],
  },
  {
    id: 'volume',
    label: 'WEEKLY VOLUME',
    options: [
      {id: 'under-25', label: 'Under 25'},
      {id: '25-99', label: '25–99'},
      {id: '100-249', label: '100–249'},
      {id: '250-plus', label: '250+'},
    ],
  },
  {
    id: 'goal',
    label: 'YOUR SAMPLE GOAL',
    options: [
      {id: 'print-quality', label: 'Print quality'},
      {id: 'color-detail', label: 'Color & detail'},
      {id: 'press-peel', label: 'Press & peel'},
      {id: 'consistency', label: 'Consistency'},
    ],
  },
];

/**
 * @typedef {{
 *   id: string;
 *   title: string;
 *   maxLabel: string;
 *   widthIn: number;
 *   heightIn: number;
 *   placement: 'sleeve' | 'left-chest' | 'center-chest' | 'full-front' | 'full-back';
 * }} FreeSampleSize
 */

/** @type {FreeSampleSize[]} */
export const FREE_SAMPLE_SIZES = [
  {
    id: 'sleeve',
    title: 'Small logo or sleeve',
    maxLabel: '3″ × 3″ max',
    widthIn: 3,
    heightIn: 3,
    placement: 'sleeve',
  },
  {
    id: 'left-chest',
    title: 'Left chest',
    maxLabel: '4″ × 4″ max',
    widthIn: 4,
    heightIn: 4,
    placement: 'left-chest',
  },
  {
    id: 'center-chest',
    title: 'Center chest or youth front',
    maxLabel: '8″ × 8″ max',
    widthIn: 8,
    heightIn: 8,
    placement: 'center-chest',
  },
  {
    id: 'full-front',
    title: 'Adult full front',
    maxLabel: '11″ × 11″ max',
    widthIn: 11,
    heightIn: 11,
    placement: 'full-front',
  },
  {
    id: 'full-back',
    title: 'Adult full back',
    maxLabel: '12″ × 17″ max',
    widthIn: 12,
    heightIn: 17,
    placement: 'full-back',
  },
];

/** Flow step keys in order after the landing questionnaire start */
export const FREE_SAMPLE_STEPS = [
  'experience',
  'about',
  'volume',
  'goal',
  'upload',
  'size',
  'offer',
];
