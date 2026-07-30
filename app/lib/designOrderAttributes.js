/**
 * Cart / order line attributes that tie decorated artwork to Shopify lines.
 * Underscore keys are machine-oriented; human keys show in Shopify Admin.
 */

export const DESIGN_ATTR = {
  id: '_designId',
  idLabel: 'Design ID',
  preview: '_designPreview',
  packet: 'Design files',
  printStyle: 'Print style',
  locations: 'Locations',
  color: 'Garment color',
};

/**
 * @param {import('~/lib/designStudioApi').SavedProductDesign | null | undefined} design
 * @param {{ packetBaseUrl?: string | null }} [opts]
 * @returns {Array<{ key: string; value: string }>}
 */
export function buildDesignLineAttributes(design, opts = {}) {
  if (!design?.remoteId) return [];

  const id = String(design.remoteId);
  const printStyle =
    design.printStyle === 'full'
      ? 'Full color'
      : design.printStyle === 'simple'
        ? 'Simple color'
        : design.printStyle
          ? String(design.printStyle)
          : '';

  const locationLabels = (design.locations || [])
    .map((l) => l.label || l.id)
    .filter(Boolean)
    .join(', ');

  const packetBase = String(opts.packetBaseUrl || '').replace(/\/$/, '');
  const packetUrl = packetBase
    ? `${packetBase}/admin/design?id=${encodeURIComponent(id)}`
    : '';

  /** @type {Array<{ key: string; value: string }>} */
  const attrs = [
    {key: DESIGN_ATTR.id, value: truncateAttr(id)},
    {key: DESIGN_ATTR.idLabel, value: truncateAttr(id)},
  ];

  if (printStyle) {
    attrs.push({key: DESIGN_ATTR.printStyle, value: truncateAttr(printStyle)});
  }
  if (locationLabels) {
    attrs.push({
      key: DESIGN_ATTR.locations,
      value: truncateAttr(locationLabels),
    });
  }
  if (design.colorName || design.colorCode) {
    attrs.push({
      key: DESIGN_ATTR.color,
      value: truncateAttr(
        design.colorName || `#${String(design.colorCode).replace(/^#/, '')}`,
      ),
    });
  }
  if (design.previewUrl) {
    attrs.push({
      key: DESIGN_ATTR.preview,
      value: truncateAttr(design.previewUrl),
    });
  }
  if (packetUrl) {
    attrs.push({key: DESIGN_ATTR.packet, value: truncateAttr(packetUrl)});
  }

  return attrs;
}

/**
 * Shopify line attribute values are limited (~255). Keep URLs usable.
 * @param {string} value
 */
function truncateAttr(value) {
  const s = String(value || '');
  if (s.length <= 250) return s;
  return `${s.slice(0, 247)}...`;
}

/**
 * @param {Array<{ key?: string | null; value?: string | null }> | null | undefined} attributes
 */
export function readDesignFromLineAttributes(attributes) {
  const list = attributes || [];
  const get = (key) =>
    list.find((a) => String(a?.key || '') === key)?.value || null;

  const id = get(DESIGN_ATTR.id) || get(DESIGN_ATTR.idLabel);
  if (!id) return null;

  return {
    id,
    previewUrl: get(DESIGN_ATTR.preview),
    packetUrl: get(DESIGN_ATTR.packet),
    printStyle: get(DESIGN_ATTR.printStyle),
    locations: get(DESIGN_ATTR.locations),
    color: get(DESIGN_ATTR.color),
  };
}

/**
 * Session backup so a refresh before add-to-cart doesn't lose the design.
 * @param {string} productHandle
 * @param {import('~/lib/designStudioApi').SavedProductDesign | null} design
 */
export function persistDesignSession(productHandle, design) {
  if (typeof window === 'undefined' || !productHandle) return;
  const key = sessionKey(productHandle);
  try {
    if (!design) {
      sessionStorage.removeItem(key);
      return;
    }
    // Avoid huge data URLs blowing sessionStorage — keep remote refs + transforms.
    const slim = {
      remoteId: design.remoteId || null,
      previewUrl: design.previewUrl || null,
      printStyle: design.printStyle || null,
      productHandle: design.productHandle || productHandle,
      productId: design.productId || null,
      colorCode: design.colorCode || null,
      colorName: design.colorName || null,
      transform: design.transform,
      locations: (design.locations || []).map((l) => ({
        id: l.id,
        label: l.label,
        transform: l.transform,
        // Keep logo only if small; otherwise rely on remote packet
        logoDataUrl:
          l.logoDataUrl && l.logoDataUrl.length < 80_000
            ? l.logoDataUrl
            : undefined,
      })),
      logoDataUrl:
        design.logoDataUrl && design.logoDataUrl.length < 80_000
          ? design.logoDataUrl
          : undefined,
    };
    sessionStorage.setItem(key, JSON.stringify(slim));
  } catch {
    // quota / private mode — ignore
  }
}

/**
 * @param {string} productHandle
 * @returns {import('~/lib/designStudioApi').SavedProductDesign | null}
 */
export function loadDesignSession(productHandle) {
  if (typeof window === 'undefined' || !productHandle) return null;
  try {
    const raw = sessionStorage.getItem(sessionKey(productHandle));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.remoteId && !parsed?.logoDataUrl) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * @param {string} productHandle
 */
function sessionKey(productHandle) {
  return `p1-design:${productHandle}`;
}
