/**
 * Blank vs decorated catalog helpers (Shopify product tags).
 */

export const FULFILLMENT_BLANK = 'fulfillment:blank';
export const FULFILLMENT_DECORATED = 'fulfillment:decorated';

/**
 * @param {string[] | null | undefined} tags
 */
export function isDecoratedProduct(tags) {
  return (tags || []).some(
    (t) => String(t).trim().toLowerCase() === FULFILLMENT_DECORATED,
  );
}

/**
 * @param {string[] | null | undefined} tags
 */
export function isBlankProduct(tags) {
  if (isDecoratedProduct(tags)) return false;
  return (
    (tags || []).some(
      (t) => String(t).trim().toLowerCase() === FULFILLMENT_BLANK,
    ) || true
  );
}

/**
 * URL segment for PDPs.
 * @param {string[] | null | undefined} tags
 * @param {string} [handle]
 * @returns {'products' | 'decorated-products'}
 */
export function productPathPrefixFromTags(tags, handle) {
  if (isDecoratedProduct(tags)) return 'decorated-products';
  if (handle && /-decorated$/i.test(String(handle))) return 'decorated-products';
  return 'products';
}

/**
 * @param {string} handle
 * @param {string[] | null | undefined} [tags]
 * @param {string} [pathname] current path (for locale prefix)
 */
export function getProductHref(handle, tags, pathname = '') {
  const prefix = productPathPrefixFromTags(tags, handle);
  const match = /(\/[a-zA-Z]{2}-[a-zA-Z]{2}\/)/.exec(pathname || '');
  const locale = match?.[1] || '/';
  return `${locale}${prefix}/${handle}`.replace(/\/{2,}/g, '/');
}
