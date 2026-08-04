/**
 * Decoration location catalog + placement presets for apparel.
 */

/** @typedef {'tee' | 'hoodie' | 'hat'} GarmentKind */

/**
 * @typedef {{
 *   id: string;
 *   label: string;
 *   group: 'front' | 'back' | 'sleeve' | 'hat';
 *   description: string;
 *   transform: { x: number; y: number; scale: number; rotation: number };
 * }} LocationOption
 */

/** @type {Record<string, LocationOption>} */
export const LOCATION_CATALOG = {
  'front-center': {
    id: 'front-center',
    label: 'Front center',
    group: 'front',
    description: 'Full chest imprint',
    transform: {x: 0.5, y: 0.42, scale: 0.36, rotation: 0},
  },
  'left-chest': {
    id: 'left-chest',
    label: 'Left chest',
    group: 'front',
    description: 'Small logo placement',
    // Wearer's left chest on a front flat — inset from sleeve, below collar
    transform: {x: 0.62, y: 0.37, scale: 0.12, rotation: 0},
  },
  'back-center': {
    id: 'back-center',
    label: 'Back center',
    group: 'back',
    description: 'Main back print',
    transform: {x: 0.5, y: 0.42, scale: 0.4, rotation: 0},
  },
  'back-neck': {
    id: 'back-neck',
    label: 'Nape / neck',
    group: 'back',
    description: 'Small mark below collar',
    transform: {x: 0.5, y: 0.22, scale: 0.1, rotation: 0},
  },
  'left-sleeve': {
    id: 'left-sleeve',
    label: 'Left sleeve',
    group: 'sleeve',
    description: 'Outer left sleeve',
    transform: {x: 0.16, y: 0.46, scale: 0.12, rotation: 0},
  },
  'right-sleeve': {
    id: 'right-sleeve',
    label: 'Right sleeve',
    group: 'sleeve',
    description: 'Outer right sleeve',
    transform: {x: 0.84, y: 0.46, scale: 0.12, rotation: 0},
  },
  'hat-front': {
    id: 'hat-front',
    label: 'Front panel',
    group: 'hat',
    description: 'Center front of cap',
    transform: {x: 0.5, y: 0.42, scale: 0.28, rotation: 0},
  },
  'hat-side': {
    id: 'hat-side',
    label: 'Side',
    group: 'hat',
    description: 'Side panel mark',
    transform: {x: 0.28, y: 0.48, scale: 0.14, rotation: 0},
  },
};

/**
 * @param {string} [title]
 * @returns {GarmentKind}
 */
export function detectGarmentKind(title = '') {
  const t = String(title).toLowerCase();
  if (/\b(hat|cap|beanie|trucker)\b/.test(t)) return 'hat';
  if (/\b(hoodie|sweatshirt|fleece|crewneck)\b/.test(t)) return 'hoodie';
  return 'tee';
}

/**
 * @param {GarmentKind} kind
 * @returns {LocationOption[]}
 */
export function locationsForGarment(kind) {
  if (kind === 'hat') {
    return [LOCATION_CATALOG['hat-front'], LOCATION_CATALOG['hat-side']];
  }
  return [
    LOCATION_CATALOG['front-center'],
    LOCATION_CATALOG['left-chest'],
    LOCATION_CATALOG['back-center'],
    LOCATION_CATALOG['back-neck'],
    LOCATION_CATALOG['left-sleeve'],
    LOCATION_CATALOG['right-sleeve'],
  ];
}

export const PRINT_STYLES = [
  {
    id: 'simple',
    label: 'Simple color',
    eyebrow: 'Best for logos',
    points: [
      '1–2 spot colors',
      'Clean business marks & text',
      'Included in base decoration pricing',
    ],
  },
  {
    id: 'full',
    label: 'Full color',
    eyebrow: 'Best for detail',
    points: [
      'Full-color & photo-ready art',
      'Gradients and fine detail',
      'Ideal for complex brand marks',
    ],
  },
];

/**
 * @param {{ group?: string } | null | undefined} location
 * @returns {'front' | 'back' | 'side'}
 */
export function garmentViewForLocation(location) {
  const group = location?.group;
  if (group === 'back') return 'back';
  if (group === 'sleeve') return 'side';
  return 'front';
}

/**
 * Pick the best product photo for a mockup view.
 * Prefers flat product shots (alt "… - Back" / filename `_b_fl`) over on-model.
 *
 * @param {Array<{ url?: string; altText?: string | null } | null | undefined> | null | undefined} images
 * @param {'front' | 'back' | 'side'} [view='front']
 */
export function pickGarmentViewImage(images, view = 'front') {
  const list = (images || []).filter((img) => img?.url);
  if (!list.length) return null;

  let best = null;
  let bestScore = -1;
  for (let i = 0; i < list.length; i++) {
    const score = scoreImageForView(list[i], view);
    if (score > bestScore) {
      bestScore = score;
      best = list[i];
    }
  }

  if (bestScore > 0) return best;

  // Soft fallbacks when alt/filename don't label views
  if (view === 'back' && list.length > 1) return list[1];
  if (view === 'side' && list.length > 2) return list[2];
  return list[0];
}

/**
 * @param {{ url?: string; altText?: string | null }} img
 * @param {'front' | 'back' | 'side'} view
 */
function scoreImageForView(img, view) {
  const alt = String(img.altText || '').toLowerCase();
  const file = String(img.url || '')
    .split('/')
    .pop()
    ?.split('?')[0]
    ?.toLowerCase() || '';

  if (view === 'back') {
    if (/_b_fl|_b\.|[-_]back[-_.]/.test(file) && !/omb|omf|oms/.test(file)) {
      return 100;
    }
    if (/\bback\b/.test(alt) && !/\bfront\b/.test(alt) && !/\bon model\b/.test(alt)) {
      return 90;
    }
    if (/\bon model back\b/.test(alt) || /_omb_/.test(file)) return 50;
    if (/\bback\b/.test(alt)) return 70;
    return 0;
  }

  if (view === 'side') {
    if (/_oms_|[-_]side[-_.]|_s_fl/.test(file)) return 100;
    if (/\bside\b/.test(alt) && !/\bfront\b/.test(alt) && !/\bback\b/.test(alt)) {
      return 90;
    }
    if (/\bon model side\b/.test(alt)) return 50;
    return 0;
  }

  // front — prefer flat front over on-model
  if (/_f_fl|_f\.|[-_]front[-_.]/.test(file) && !/omf|omb|oms/.test(file)) {
    return 100;
  }
  if (
    /\bfront\b/.test(alt) &&
    !/\bback\b/.test(alt) &&
    !/\bon model\b/.test(alt)
  ) {
    return 90;
  }
  if (/\bon model front\b/.test(alt) || /_omf_/.test(file)) return 50;
  if (/\bfront\b/.test(alt)) return 70;
  return 0;
}

const DEFAULT_TRANSFORM_FALLBACK = {
  x: 0.5,
  y: 0.36,
  scale: 0.32,
  rotation: 0,
};

/**
 * @param {import('~/lib/designStudioApi').SavedProductDesign | null | undefined} design
 * @returns {{
 *   front?: { logoDataUrl: string; transform: { x: number; y: number; scale: number; rotation: number } };
 *   back?: { logoDataUrl: string; transform: { x: number; y: number; scale: number; rotation: number } };
 * } | null}
 */
export function designOverlaysByView(design) {
  if (!design) return null;

  /** @type {Record<string, number>} */
  const frontPriority = {'front-center': 2, 'left-chest': 1};
  /** @type {Record<string, number>} */
  const backPriority = {'back-center': 2, 'back-neck': 1};

  /** @type {{ logoDataUrl: string; transform: any; score: number } | null} */
  let front = null;
  /** @type {{ logoDataUrl: string; transform: any; score: number } | null} */
  let back = null;

  for (const loc of design.locations || []) {
    if (!loc?.logoDataUrl) continue;
    const meta = LOCATION_CATALOG[loc.id];
    const view = garmentViewForLocation(meta);
    const entry = {
      logoDataUrl: loc.logoDataUrl,
      transform: loc.transform || {...DEFAULT_TRANSFORM_FALLBACK},
      score: 0,
    };
    if (view === 'front') {
      entry.score = frontPriority[loc.id] || 0;
      if (!front || entry.score >= front.score) front = entry;
    } else if (view === 'back') {
      entry.score = backPriority[loc.id] || 0;
      if (!back || entry.score >= back.score) back = entry;
    }
  }

  if (!front && !back && design.logoDataUrl) {
    front = {
      logoDataUrl: design.logoDataUrl,
      transform: design.transform || {...DEFAULT_TRANSFORM_FALLBACK},
      score: 1,
    };
  }

  if (!front && !back) return null;
  return {
    ...(front
      ? {
          front: {
            logoDataUrl: front.logoDataUrl,
            transform: front.transform,
          },
        }
      : {}),
    ...(back
      ? {
          back: {
            logoDataUrl: back.logoDataUrl,
            transform: back.transform,
          },
        }
      : {}),
  };
}

/**
 * Limit gallery to flat front/back shots that actually have artwork.
 * Views without a saved design are omitted so logos never appear on the wrong side.
 *
 * @param {Array<{ url?: string; altText?: string | null } | null | undefined> | null | undefined} images
 * @param {{ front?: { logoDataUrl?: string }; back?: { logoDataUrl?: string } } | null | undefined} [overlays]
 */
export function frontAndBackGalleryImages(images, overlays = null) {
  const list = (images || []).filter((img) => img?.url);
  if (!list.length) return [];

  const front = pickGarmentViewImage(list, 'front');
  const back = pickGarmentViewImage(list, 'back');
  const out = [];

  const includeFront = Boolean(overlays?.front?.logoDataUrl);
  const includeBack = Boolean(overlays?.back?.logoDataUrl);

  // If overlays weren't passed, keep previous behavior (both views when available).
  if (!overlays) {
    if (front) out.push({...front, mockupView: /** @type {'front'} */ ('front')});
    if (back && back.url !== front?.url) {
      out.push({...back, mockupView: /** @type {'back'} */ ('back')});
    }
  } else {
    if (includeFront && front) {
      out.push({...front, mockupView: /** @type {'front'} */ ('front')});
    }
    if (includeBack && back && back.url !== front?.url) {
      out.push({...back, mockupView: /** @type {'back'} */ ('back')});
    }
  }

  return out.length
    ? out
    : list.slice(0, 1).map((img) => ({
        ...img,
        mockupView: /** @type {'front'} */ ('front'),
      }));
}
