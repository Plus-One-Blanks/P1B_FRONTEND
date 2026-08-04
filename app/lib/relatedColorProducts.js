import {
  FULFILLMENT_BLANK,
  FULFILLMENT_DECORATED,
  isDecoratedProduct,
} from '~/lib/productFulfillment';

/**
 * Storefront search for color siblings sharing a `ProductID:` tag.
 * Quotes are required so AND filters (e.g. fulfillment) work.
 *
 * @param {string} productId numeric / id portion only (e.g. `00708`)
 * @param {'decorated' | 'blank' | null | undefined} [fulfillment]
 */
export function buildSiblingProductSearchQuery(productId, fulfillment) {
  const id = String(productId || '')
    .trim()
    .replace(/"/g, '');
  if (!id) return '';
  const idClause = `tag:"ProductID:${id}"`;
  if (fulfillment === 'decorated') {
    return `${idClause} AND tag:"${FULFILLMENT_DECORATED}"`;
  }
  if (fulfillment === 'blank') {
    return `${idClause} AND tag:"${FULFILLMENT_BLANK}"`;
  }
  return idClause;
}

/**
 * @param {string[] | null | undefined} tags
 * @returns {'decorated' | 'blank' | null}
 */
export function fulfillmentScopeFromTags(tags) {
  if (isDecoratedProduct(tags)) return 'decorated';
  if (
    (tags || []).some(
      (t) => String(t).trim().toLowerCase() === FULFILLMENT_BLANK,
    )
  ) {
    return 'blank';
  }
  return null;
}

/**
 * Paginate Storefront `products(query:)` for all color siblings.
 * Comfort Colors 1717 alone has 68 blank + 68 decorated under one ProductID —
 * a single `first: 100` page drops ~half the decorated colors.
 *
 * @param {import('@shopify/hydrogen').Storefront} storefront
 * @param {string} graphqlQuery full GraphQL document with $query, $first, $after
 * @param {{
 *   productId: string;
 *   fulfillment?: 'decorated' | 'blank' | null;
 *   pageSize?: number;
 *   maxPages?: number;
 * }} opts
 * @returns {Promise<{ products: { nodes: any[] } }>}
 */
export async function fetchAllRelatedProductsByProductId(
  storefront,
  graphqlQuery,
  opts,
) {
  const productId = String(opts.productId || '').trim();
  if (!productId) {
    return {products: {nodes: []}};
  }

  const searchQuery = buildSiblingProductSearchQuery(
    productId,
    opts.fulfillment ?? null,
  );
  const pageSize = Math.min(Math.max(opts.pageSize ?? 100, 1), 250);
  const maxPages = Math.min(Math.max(opts.maxPages ?? 10, 1), 20);

  /** @type {any[]} */
  const nodes = [];
  /** @type {string | null} */
  let after = null;
  let hasNext = true;

  for (let page = 0; page < maxPages && hasNext; page++) {
    const result = await storefront.query(graphqlQuery, {
      variables: {
        query: searchQuery,
        first: pageSize,
        after,
      },
    });
    const conn = result?.products;
    const pageNodes = conn?.nodes ?? [];
    nodes.push(...pageNodes);
    hasNext = Boolean(conn?.pageInfo?.hasNextPage);
    after = conn?.pageInfo?.endCursor ?? null;
    if (!pageNodes.length) break;
  }

  return {products: {nodes}};
}
