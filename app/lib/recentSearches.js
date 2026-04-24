const STORAGE_KEY = 'plus1-recent-searches';
const MAX = 8;

/**
 * @returns {string[]}
 */
export function getRecentSearches() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x) => typeof x === 'string' && x.trim())
      : [];
  } catch {
    return [];
  }
}

/**
 * @param {string} query
 */
export function addRecentSearch(query) {
  if (typeof window === 'undefined') return;
  const q = String(query).trim();
  if (!q) return;
  try {
    const prev = getRecentSearches();
    const next = [q, ...prev.filter((x) => x !== q)].slice(0, MAX);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * @param {string} query
 */
export function removeRecentSearch(query) {
  if (typeof window === 'undefined') return;
  const q = String(query).trim();
  if (!q) return;
  try {
    const next = getRecentSearches().filter((x) => x !== q);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
