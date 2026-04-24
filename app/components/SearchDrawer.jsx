import {Link, NavLink, useFetcher, useNavigate} from 'react-router';
import {Search, X} from 'lucide-react';
import {useCallback, useEffect, useId, useMemo, useRef, useState} from 'react';
import logo from '~/assets/logo.svg';
import {SEARCH_ENDPOINT} from '~/components/SearchFormPredictive';
import {SearchFeaturedProductGrid} from '~/components/SearchFeaturedProductCard';
import {SearchResultsPredictive} from '~/components/SearchResultsPredictive';
import {useAside} from '~/components/Aside';
import {
  addRecentSearch,
  getRecentSearches,
  removeRecentSearch,
} from '~/lib/recentSearches';
import {
  dedupeProductsByStyleGroup,
  filterCollectionProductsByQuery,
} from '~/lib/searchDrawerCollection';

/** Max product tiles in the drawer while typing (full list on /search). */
const SEARCH_DRAWER_PRODUCT_PREVIEW = 5;

/** @type {{ label: string; q: string }[]} */
const POPULAR_SEARCH_CHIPS = [
  {label: 'T-Shirts', q: 't-shirt'},
  {label: 'Hoodies', q: 'hoodie'},
  {label: 'Longsleeves', q: 'long sleeve'},
  {label: 'Hats', q: 'hats'},
  {label: 'Sweatshirts', q: 'sweatshirt'},
  {label: 'Polos', q: 'polo'},
  {label: 'Safety', q: 'safety'},
];

/**
 * Top search drawer: logo, pill search field, catalog-scoped results, recent & popular chips.
 * Quick search loads products from the All Products collection and filters client-side.
 *
 * @param {{ shopName: string }} props
 */
export function SearchDrawer({shopName}) {
  const formId = useId();
  const {close, type} = useAside();
  const navigate = useNavigate();
  const termRef = useRef('');
  const prevSearchOpen = useRef(false);

  const [recent, setRecent] = useState([]);
  const [query, setQuery] = useState('');

  const productsFetcher = useFetcher({key: 'search-drawer-collection'});

  const collectionProducts = productsFetcher.data?.products ?? [];
  const hasQuery = Boolean(query.trim());

  /** Match /search: filter full catalog, then one tile per `ProductID:*` style. */
  const styleCatalog = useMemo(
    () => dedupeProductsByStyleGroup(collectionProducts),
    [collectionProducts],
  );

  const filteredForQuery = useMemo(
    () =>
      dedupeProductsByStyleGroup(
        filterCollectionProductsByQuery(collectionProducts, query),
      ),
    [collectionProducts, query],
  );

  const displayProducts = useMemo(() => {
    const list = hasQuery ? filteredForQuery : styleCatalog;
    return list.slice(0, SEARCH_DRAWER_PRODUCT_PREVIEW);
  }, [hasQuery, filteredForQuery, styleCatalog]);

  const catalogLoading =
    productsFetcher.state === 'loading' && collectionProducts.length === 0;

  termRef.current = query;

  useEffect(() => {
    const open = type === 'search';
    if (open && !prevSearchOpen.current) {
      setRecent(getRecentSearches());
      setQuery('');
      productsFetcher.load('/search-drawer-products');
    }
    prevSearchOpen.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per open; fetcher identity is unstable
  }, [type]);

  const goToSearch = useCallback(() => {
    const term = query.trim();
    if (term) {
      addRecentSearch(term);
    }
    void navigate(
      SEARCH_ENDPOINT + (term ? `?q=${encodeURIComponent(term)}` : ''),
    );
    close();
  }, [close, navigate, query]);

  function handleChipNavigate(q) {
    addRecentSearch(q);
    setRecent(getRecentSearches());
    close();
  }

  function closeSearch() {
    setQuery('');
    close();
  }

  function handleRemoveRecent(e, q) {
    e.preventDefault();
    e.stopPropagation();
    removeRecentSearch(q);
    setRecent(getRecentSearches());
  }

  return (
    <div className="search-drawer">
      <div className="search-drawer-top">
        <NavLink
          to="/"
          className="header-logo-link search-drawer-logo-link"
          onClick={() => close()}
          end
        >
          <div className="header-logo">
            <img src={logo} alt={shopName} className="logo-image" />
          </div>
        </NavLink>
        <button
          type="button"
          className="search-drawer-close"
          onClick={() => close()}
          aria-label="Close search"
        >
          ×
        </button>
      </div>

      <form
        id={formId}
        className="search-drawer-form predictive-search-form"
        onSubmit={(e) => {
          e.preventDefault();
          goToSearch();
        }}
      >
        <div className="search-drawer-query">
          <span className="search-drawer-query-icon" aria-hidden>
            <Search size={20} strokeWidth={2} />
          </span>
          <input
            name="q"
            className="search-drawer-query-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What are you looking for?"
            type="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
          <button type="submit" className="search-drawer-submit">
            Search
          </button>
        </div>
      </form>

      <div className="search-drawer-body">
        {catalogLoading ? (
          <p className="search-drawer-status" role="status">
            Loading products…
          </p>
        ) : null}

        {!catalogLoading && hasQuery && filteredForQuery.length === 0 ? (
          <div className="search-drawer-results-block">
            <SearchResultsPredictive.Empty term={termRef} />
          </div>
        ) : null}

        {!catalogLoading && displayProducts.length > 0 ? (
          <div className="search-drawer-results-block search-drawer-results-block--live">
            <SearchFeaturedProductGrid
              products={displayProducts}
              closeSearch={closeSearch}
              term={termRef}
            />
            {hasQuery && filteredForQuery.length > 0 ? (
              <Link
                className="search-drawer-view-all"
                to={`${SEARCH_ENDPOINT}?q=${encodeURIComponent(query.trim())}`}
                onClick={() => {
                  const t = query.trim();
                  if (t) addRecentSearch(t);
                  closeSearch();
                }}
              >
                Show all products
              </Link>
            ) : null}
          </div>
        ) : null}

        {!hasQuery && !catalogLoading ? (
          <div className="search-drawer-suggestions">
            {recent.length > 0 ? (
              <section
                className="search-drawer-section"
                aria-label="Recent searches"
              >
                <h3 className="search-drawer-section-title">
                  Recent searches
                </h3>
                <ul className="search-drawer-chips">
                  {recent.map((q) => (
                    <li key={q}>
                      <div className="search-drawer-chip-recent">
                        <Link
                          className="search-drawer-chip"
                          to={`${SEARCH_ENDPOINT}?q=${encodeURIComponent(q)}`}
                          onClick={() => handleChipNavigate(q)}
                        >
                          <Search
                            size={14}
                            strokeWidth={2}
                            aria-hidden
                            className="search-drawer-chip-icon"
                          />
                          <span>{q}</span>
                        </Link>
                        <button
                          type="button"
                          className="search-drawer-chip-remove"
                          aria-label={`Remove "${q}" from recent searches`}
                          onClick={(e) => handleRemoveRecent(e, q)}
                        >
                          <X size={12} strokeWidth={2} aria-hidden />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section
              className="search-drawer-section"
              aria-label="Popular searches"
            >
              <h3 className="search-drawer-section-title">Popular searches</h3>
              <ul className="search-drawer-chips search-drawer-chips--wrap">
                {POPULAR_SEARCH_CHIPS.map(({label, q}) => (
                  <li key={q}>
                    <Link
                      className="search-drawer-chip"
                      to={`${SEARCH_ENDPOINT}?q=${encodeURIComponent(q)}`}
                      onClick={() => handleChipNavigate(q)}
                    >
                      <Search
                        size={14}
                        strokeWidth={2}
                        aria-hidden
                        className="search-drawer-chip-icon"
                      />
                      <span>{label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
