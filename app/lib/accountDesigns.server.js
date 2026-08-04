import {readDesignFromLineAttributes, DESIGN_ATTR, buildDesignReorderUrl} from '~/lib/designOrderAttributes';

/** How many recent orders to scan for design line attributes (dashboard). */
export const ACCOUNT_DESIGN_ORDERS_SCAN = 25;

/** Deeper order scan for the dedicated Designs page. */
export const ACCOUNT_DESIGN_ORDERS_SCAN_PAGE = 50;

/** Max unique designs to show on the account dashboard. */
export const ACCOUNT_DESIGNS_LIMIT = 8;

/** Max unique designs on the dedicated Designs page. */
export const ACCOUNT_DESIGNS_PAGE_LIMIT = 48;

/**
 * @typedef {{
 *   id: string;
 *   previewUrl: string | null;
 *   productHandle: string | null;
 *   productTitle: string | null;
 *   color: string | null;
 *   printStyle: string | null;
 *   locations: string | null;
 *   orderNumber: number | string | null;
 *   orderId: string | null;
 *   orderedAt: string | null;
 *   lineImageUrl: string | null;
 *   reorderUrl: string | null;
 * }} AccountDesignSummary
 */

/**
 * Collect unique designs from Customer Account order line attributes.
 * Prefer newest order first; first sighting of a design ID wins.
 *
 * @param {Array<{
 *   id?: string | null;
 *   number?: number | string | null;
 *   processedAt?: string | null;
 *   lineItems?: { nodes?: Array<Record<string, unknown>> | null } | null;
 * }> | null | undefined} orders
 * @returns {AccountDesignSummary[]}
 */
export function collectDesignsFromOrders(orders) {
  /** @type {Map<string, AccountDesignSummary>} */
  const byId = new Map();

  for (const order of orders || []) {
    const lines = order?.lineItems?.nodes || [];
    for (const line of lines) {
      const attrs = /** @type {Array<{key?: string|null; value?: string|null}>} */ (
        line?.customAttributes || []
      );
      const design = readDesignFromLineAttributes(attrs);
      if (!design?.id) continue;

      const id = String(design.id).trim();
      if (!id || byId.has(id)) continue;

      const handleFromAttr =
        design.productHandle ||
        attrs.find((a) => a?.key === DESIGN_ATTR.productHandle)?.value ||
        null;

      const productHandle = handleFromAttr ? String(handleFromAttr) : null;
      const productTitle =
        typeof line?.title === 'string' && line.title.trim()
          ? line.title.trim()
          : null;
      const lineImageUrl =
        line?.image && typeof line.image === 'object' && line.image?.url
          ? String(line.image.url)
          : null;

      byId.set(id, {
        id,
        previewUrl: design.previewUrl || null,
        productHandle,
        productTitle,
        color: design.color || null,
        printStyle: design.printStyle || null,
        locations: design.locations || null,
        orderNumber: order?.number ?? null,
        orderId: order?.id ?? null,
        orderedAt: order?.processedAt ?? null,
        lineImageUrl,
        reorderUrl: null,
      });
    }
  }

  return Array.from(byId.values());
}

/**
 * Enrich summaries with Firestore design packets (preview URL, product handle).
 *
 * @param {AccountDesignSummary[]} designs
 * @param {string | null | undefined} designApiBase
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<AccountDesignSummary[]>}
 */
export async function enrichAccountDesigns(designs, designApiBase, opts = {}) {
  const limit = opts.limit ?? ACCOUNT_DESIGNS_LIMIT;
  const base = String(designApiBase || '')
    .trim()
    .replace(/\/$/, '');
  const slice = designs.slice(0, limit);

  if (!slice.length) return [];

  const enriched = await Promise.all(
    slice.map(async (design) => {
      let next = {...design};

      if (base) {
        try {
          const remote = await fetchDesignDoc(base, design.id);
          if (remote) {
            next = {
              ...next,
              previewUrl:
                (typeof remote.previewUrl === 'string' && remote.previewUrl) ||
                next.previewUrl,
              productHandle:
                (typeof remote.productHandle === 'string' &&
                  remote.productHandle) ||
                next.productHandle,
              color:
                next.color ||
                (typeof remote.colorName === 'string' && remote.colorName) ||
                (typeof remote.colorCode === 'string' && remote.colorCode) ||
                null,
              printStyle:
                next.printStyle ||
                (typeof remote.printStyle === 'string' && remote.printStyle) ||
                null,
            };
          }
        } catch (err) {
          console.warn('[accountDesigns] getDesign failed', design.id, err);
        }
      }

      next.reorderUrl = buildDesignReorderUrl(next.productHandle, next.id);
      return next;
    }),
  );

  return enriched;
}

/**
 * @param {string} apiBase
 * @param {string} designId
 */
async function fetchDesignDoc(apiBase, designId) {
  const res = await fetch(
    `${apiBase}/getDesign?id=${encodeURIComponent(designId)}`,
    {method: 'GET'},
  );
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  return json?.design || null;
}

/**
 * Preview mock designs for local `?preview=1` account dashboards.
 * @returns {AccountDesignSummary[]}
 */
export function buildMockAccountDesigns() {
  const days = (n) =>
    new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
  return [
    {
      id: 'preview-design-gildan-5000',
      previewUrl: null,
      productHandle: 'gildan-5000-decorated',
      productTitle: 'Gildan 5000 Heavy Cotton T-Shirt — Decorated',
      color: 'Antique Cherry Red',
      printStyle: 'Full color',
      locations: 'Front',
      orderNumber: 1008,
      orderId: 'gid://shopify/Order/preview-dash-1',
      orderedAt: days(2),
      lineImageUrl: null,
      reorderUrl:
        '/decorated-products/gildan-5000-decorated?design=preview-design-gildan-5000',
    },
    {
      id: 'preview-design-comfort-1717',
      previewUrl: null,
      productHandle: 'comfort-colors-1717-decorated',
      productTitle: 'Comfort Colors 1717 — Decorated',
      color: 'Banana',
      printStyle: 'Full color',
      locations: 'Front, Back',
      orderNumber: 1007,
      orderId: 'gid://shopify/Order/preview-dash-2',
      orderedAt: days(5),
      lineImageUrl: null,
      reorderUrl:
        '/decorated-products/comfort-colors-1717-decorated?design=preview-design-comfort-1717',
    },
    {
      id: 'preview-design-aa-1301',
      previewUrl: null,
      productHandle: 'american-apparel-1301gd-decorated',
      productTitle: 'American Apparel 1301GD — Decorated',
      color: 'Black',
      printStyle: 'Simple color',
      locations: 'Left chest',
      orderNumber: 1006,
      orderId: 'gid://shopify/Order/preview-dash-3',
      orderedAt: days(9),
      lineImageUrl: null,
      reorderUrl:
        '/decorated-products/american-apparel-1301gd-decorated?design=preview-design-aa-1301',
    },
  ];
}
