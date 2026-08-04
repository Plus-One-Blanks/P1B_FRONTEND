import {extractProductGroupTag} from '~/lib/productGroupColorData';
import {
  buildSiblingProductSearchQuery,
  fulfillmentScopeFromTags,
} from '~/lib/relatedColorProducts';

/**
 * @param {string | null | undefined} s
 */
export function normColorKey(s) {
  return String(s || '').toLowerCase().trim();
}

/**
 * One PDP-style swatch row from a Shopify product (uses `colorCode:` / `colorName:` tags).
 * @param {{
 *   handle?: string;
 *   tags?: string[];
 *   featuredImage?: { url?: string; altText?: string } | null;
 *   variants?: { nodes?: Array<{ image?: { url?: string; altText?: string } | null }> };
 * } | null | undefined} p
 * @returns {{ code: string; formattedCode: string; name: string; productHandle: string; imageUrl: string | null; imageAlt: string } | null}
 */
export function colorSwatchRowFromProduct(p) {
  if (!p?.handle) return null;
  const tags = p.tags ?? [];
  const colorCodeTag = tags.find((t) => String(t).startsWith('colorCode:'));
  if (!colorCodeTag) return null;
  const code = String(colorCodeTag).replace(/^colorCode:/i, '').trim();
  const colorNameTag = tags.find((t) => String(t).startsWith('colorName:'));
  const name = colorNameTag
    ? String(colorNameTag).replace(/^colorName:/i, '').trim()
    : code;
  const formattedCode = code.startsWith('#') ? code : `#${code}`;
  const v0 = p.variants?.nodes?.[0];
  const img = v0?.image ?? p.featuredImage ?? null;
  return {
    code,
    formattedCode,
    name,
    productHandle: p.handle,
    imageUrl: img?.url ? String(img.url) : null,
    imageAlt: img?.altText ? String(img.altText) : name,
  };
}

/**
 * Same grouping idea as `ProductColorSwatches` on the PDP: unique `colorCode`, sorted by name.
 * @param {unknown} primaryProduct
 * @param {unknown[] | null | undefined} relatedNodes
 */
export function buildSiblingColorRows(primaryProduct, relatedNodes) {
  /** @type {Map<string, ReturnType<typeof colorSwatchRowFromProduct>>} */
  const byCode = new Map();
  const add = (p) => {
    const row = colorSwatchRowFromProduct(p);
    if (!row) return;
    const k = normColorKey(row.code);
    if (!byCode.has(k)) byCode.set(k, row);
  };
  add(primaryProduct);
  for (const n of relatedNodes ?? []) add(n);
  return [...byCode.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {sensitivity: 'base'}),
  );
}

/**
 * Default to the first sibling whose display name differs from the cart line color (initial open only).
 * @param {Array<{ name: string; productHandle: string }>} rows
 * @param {string} requestedHandle
 * @param {string} lineColorLabel
 */
export function pickDefaultSiblingProductHandle(rows, requestedHandle, lineColorLabel) {
  if (!rows.length) return requestedHandle;
  const cur = normColorKey(lineColorLabel);
  const other = rows.find((r) => normColorKey(r.name) !== cur);
  if (other) return other.productHandle;
  const keep = rows.find((r) => r.productHandle === requestedHandle);
  return (keep ?? rows[0]).productHandle;
}

const CART_ADD_COLOR_SIBLINGS = `#graphql
  query CartAddColorSiblings(
    $query: String!
    $first: Int!
    $after: String
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    products(first: $first, after: $after, query: $query) {
      nodes {
        handle
        tags
        featuredImage {
          url
          altText
        }
        variants(first: 1) {
          nodes {
            image {
              url
              altText
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

/**
 * @param {import('@shopify/hydrogen').Storefront} storefront
 * @param {string[] | undefined} tags
 */
export async function fetchSiblingProductNodesForAddColor(storefront, tags) {
  const tag = extractProductGroupTag(tags);
  if (!tag) return [];
  const productId = String(tag).replace(/^ProductID:\s*/i, '').trim();
  if (!productId) return [];
  const fulfillment = fulfillmentScopeFromTags(tags);
  const query = buildSiblingProductSearchQuery(productId, fulfillment);
  /** @type {any[]} */
  const nodes = [];
  /** @type {string | null} */
  let after = null;
  let hasNext = true;
  const maxPages = 10;

  try {
    for (let page = 0; page < maxPages && hasNext; page++) {
      const {products, errors} = await storefront.query(CART_ADD_COLOR_SIBLINGS, {
        variables: {query, first: 100, after},
      });
      if (errors?.length) {
        console.error('cart-add-color siblings:', errors);
      }
      const pageNodes = products?.nodes ?? [];
      nodes.push(...pageNodes);
      hasNext = Boolean(products?.pageInfo?.hasNextPage);
      after = products?.pageInfo?.endCursor ?? null;
      if (!pageNodes.length) break;
    }
    return nodes;
  } catch (e) {
    console.error('cart-add-color siblings fetch:', e);
    return [];
  }
}
