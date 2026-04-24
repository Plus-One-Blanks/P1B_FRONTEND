import { getCartLineGroupKey } from '~/lib/cartEditSizes';

const LS_PREFIX = 'p1-cart-group-order:';

/**
 * @param {Array<{ id?: string }>} group
 */
export function groupKeyForLineGroup(group) {
  const first = group?.[0];
  return first ? getCartLineGroupKey(first) : '';
}

/**
 * @param {string} cartId
 * @returns {string[] | null}
 */
function readStoredOrder(cartId) {
  if (!cartId || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LS_PREFIX + cartId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} cartId
 * @param {string[]} keys
 */
function writeStoredOrder(cartId, keys) {
  if (!cartId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(LS_PREFIX + cartId, JSON.stringify(keys));
  } catch {
    /* quota / private mode */
  }
}

/**
 * Merge API groups with a stored key order (new groups append; missing keys skipped).
 * @template T
 * @param {T[][]} groups
 * @param {string} cartId
 * @returns {T[][]}
 */
export function applyStoredGroupOrder(groups, cartId) {
  if (!groups.length) return groups;
  const stored = readStoredOrder(cartId);
  if (!stored?.length) return groups;

  /** @type {Map<string, T[]>} */
  const map = new Map();
  for (const g of groups) {
    const k = groupKeyForLineGroup(g);
    if (k) map.set(k, g);
  }

  const used = new Set();
  /** @type {T[][]} */
  const result = [];

  for (const k of stored) {
    const g = map.get(k);
    if (g?.length) {
      result.push(g);
      used.add(k);
    }
  }
  for (const g of groups) {
    const k = groupKeyForLineGroup(g);
    if (!used.has(k)) result.push(g);
  }
  return result;
}

/**
 * @param {unknown[][]} orderedGroups
 * @param {string} cartId
 */
export function persistGroupOrder(orderedGroups, cartId) {
  if (!cartId) return;
  const keys = orderedGroups.map((g) => groupKeyForLineGroup(g)).filter(Boolean);
  writeStoredOrder(cartId, keys);
}

/**
 * @template T
 * @param {T[]} arr
 * @param {number} fromIndex
 * @param {number} toIndex
 * @returns {T[]}
 */
export function reorderArray(arr, fromIndex, toIndex) {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= arr.length ||
    toIndex >= arr.length
  ) {
    return arr;
  }
  const next = [...arr];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
