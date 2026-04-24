import { extractColorCodeHex } from '~/lib/featuredProductCard';

/**
 * Shared catalog tag (e.g. `ProductID:00708`) — one Shopify product per color, same tag = same style.
 * @param {string[] | undefined} tags
 * @returns {string | null}
 */
export function extractProductGroupTag(tags) {
  if (!tags?.length) return null;
  for (const t of tags) {
    const s = String(t).trim();
    if (/^ProductID:/i.test(s)) return s;
  }
  return null;
}

/**
 * Storefront search string for products carrying this tag.
 * @param {string} tag
 */
function buildProductGroupTagSearchQuery(tag) {
  return `tag:"${String(tag).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

const PRODUCTS_BY_TAG_PAGE_QUERY = `#graphql
  query ProductsByTagPage(
    $query: String!
    $first: Int!
    $after: String
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    products(first: $first, after: $after, query: $query) {
      nodes {
        id
        tags
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

/**
 * Count + up to 8 distinct `colorCode:` hexes from sibling products (same ProductID tag).
 * @param {import('@shopify/hydrogen').Storefront} storefront
 * @param {string} tag
 * @returns {Promise<{ count: number; swatchHexes: string[] }>}
 */
export async function fetchProductGroupTagData(storefront, tag) {
  const query = buildProductGroupTagSearchQuery(tag);
  let total = 0;
  const swatchHexes = [];
  const seenHex = new Set();
  /** @type {string | undefined} */
  let cursor;
  let hasNext = true;
  const maxPages = 12;

  for (let page = 0; page < maxPages && hasNext; page++) {
    const result = await storefront.query(PRODUCTS_BY_TAG_PAGE_QUERY, {
      variables: {
        query,
        first: 250,
        after: cursor,
      },
    });
    const conn = result?.products;
    const nodes = conn?.nodes ?? [];
    total += nodes.length;

    for (const node of nodes) {
      if (swatchHexes.length >= 8) continue;
      const hex = extractColorCodeHex(node.tags);
      if (hex) {
        const key = hex.toLowerCase();
        if (!seenHex.has(key)) {
          seenHex.add(key);
          swatchHexes.push(hex);
        }
      }
    }

    hasNext = Boolean(conn?.pageInfo?.hasNextPage);
    cursor = conn?.pageInfo?.endCursor ?? undefined;
    if (nodes.length === 0) break;
  }

  return { count: total, swatchHexes };
}

const TAG_FETCH_CONCURRENCY = 12;

/**
 * Per product id when `ProductID:*` groups siblings: total color count + up to 8 `colorCode:` hexes.
 * Fetches tag data in small batches to avoid huge parallel Storefront load on large PLPs.
 * @param {import('@shopify/hydrogen').Storefront} storefront
 * @param {Array<{ id: string; tags?: string[] } | null | undefined>} products
 * @returns {Promise<Record<string, { count: number; swatchHexes: string[] }>>}
 */
export async function buildSiblingColorDataByProductId(storefront, products) {
  /** @type {Record<string, { count: number; swatchHexes: string[] }>} */
  const byProductId = {};
  const uniqueTags = new Set();
  for (const p of products) {
    if (!p) continue;
    const t = extractProductGroupTag(p.tags);
    if (t) uniqueTags.add(t);
  }
  if (uniqueTags.size === 0) return byProductId;

  /** @type {Map<string, { count: number; swatchHexes: string[] }>} */
  const dataByTag = new Map();
  const tagList = [...uniqueTags];
  for (let i = 0; i < tagList.length; i += TAG_FETCH_CONCURRENCY) {
    const batch = tagList.slice(i, i + TAG_FETCH_CONCURRENCY);
    await Promise.all(
      batch.map(async (t) => {
        dataByTag.set(t, await fetchProductGroupTagData(storefront, t));
      }),
    );
  }

  for (const p of products) {
    if (!p) continue;
    const t = extractProductGroupTag(p.tags);
    const row = t ? dataByTag.get(t) : null;
    if (row && typeof row.count === 'number' && row.count > 0) {
      byProductId[p.id] = {
        count: row.count,
        swatchHexes: row.swatchHexes,
      };
    }
  }
  return byProductId;
}
