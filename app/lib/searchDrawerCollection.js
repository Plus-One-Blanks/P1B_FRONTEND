import {extractProductGroupTag} from '~/lib/productGroupColorData';

/**
 * Storefront collection handle for the catalog the search drawer loads and filters.
 * Default `all` matches Shopify’s “All products” collection and `/collections/all`.
 * Change this if your catalog lives under a different collection handle.
 */
export const ALL_PRODUCTS_COLLECTION_HANDLE = 'all-products';

/** Full `/search` catalog: first paint count and each “Show more” increment (URL `show`). */
export const SEARCH_CATALOG_SHOW_INITIAL = 15;
export const SEARCH_CATALOG_SHOW_STEP = 15;

/**
 * Normalize for substring match so "t shirt" / "tshirt" match titles like "T-Shirt".
 * @param {string | null | undefined} s
 */
function normalizeForCatalogSearch(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Client-side filter for search drawer + `/search` catalog (same rules).
 * Matches title, handle, vendor, and product tags (Shopify catalog is loaded separately;
 * this is not Storefront `search` for products — see `($locale).search.jsx` loader).
 *
 * @param {Array<{title?: string; handle?: string; vendor?: string; tags?: string[]}>} products
 * @param {string} rawQuery
 */
export function filterCollectionProductsByQuery(products, rawQuery) {
  const q = normalizeForCatalogSearch(rawQuery);
  if (!q) return products;

  return products.filter((p) => {
    const title = normalizeForCatalogSearch(p.title);
    const handle = normalizeForCatalogSearch(p.handle);
    const vendor = normalizeForCatalogSearch(p.vendor);
    const tags = (p.tags ?? []).map((t) => normalizeForCatalogSearch(t)).join(' ');
    return (
      title.includes(q) ||
      handle.includes(q) ||
      vendor.includes(q) ||
      tags.includes(q)
    );
  });
}

/**
 * One row per style: products sharing a `ProductID:*` tag are color variants — keep the first
 * in list order (same rule for the search drawer and full /search catalog).
 *
 * @param {Array<{id?: string; tags?: string[]} | null | undefined>} products
 */
export function dedupeProductsByStyleGroup(products) {
  const seenTag = new Set();
  const out = [];
  for (const p of products) {
    if (!p?.id) continue;
    const tag = extractProductGroupTag(p.tags);
    if (tag) {
      if (seenTag.has(tag)) continue;
      seenTag.add(tag);
    }
    out.push(p);
  }
  return out;
}
