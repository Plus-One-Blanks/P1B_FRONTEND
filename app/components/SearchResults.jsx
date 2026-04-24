import {Link} from 'react-router';
import {HomeFeaturedProductCard} from '~/components/HomeFeaturedProductCard';
import {
  SEARCH_CATALOG_SHOW_INITIAL,
  SEARCH_CATALOG_SHOW_STEP,
} from '~/lib/searchDrawerCollection';
import {urlWithTrackingParams} from '~/lib/search';

/**
 * @param {string} term
 * @param {number} showCount — total catalog styles to show (omit param at initial count).
 */
function searchCatalogShowHref(term, showCount) {
  const sp = new URLSearchParams();
  if (term) sp.set('q', term);
  if (showCount > SEARCH_CATALOG_SHOW_INITIAL) {
    sp.set('show', String(showCount));
  }
  return `?${sp.toString()}`;
}

/**
 * @param {Omit<SearchResultsProps, 'error' | 'type'>}
 */
export function SearchResults({term, result, children}) {
  if (!result?.total) {
    return null;
  }

  return children({...result.items, term});
}

SearchResults.Articles = SearchResultsArticles;
SearchResults.Pages = SearchResultsPages;
SearchResults.Products = SearchResultsProducts;
SearchResults.Empty = SearchResultsEmpty;

/**
 * @param {PartialSearchResult<'articles'>}
 */
function SearchResultsArticles({term, articles}) {
  if (!articles?.nodes.length) {
    return null;
  }

  return (
    <section className="search-drawer-section" aria-label="Articles">
      <div className="predictive-search-result">
        <h5>Articles</h5>
        <ul>
          {articles?.nodes?.map((article) => {
            const blogHandle = article.blog?.handle;
            const articleUrl = urlWithTrackingParams({
              baseUrl: blogHandle
                ? `/blogs/${blogHandle}/${article.handle}`
                : `/blogs/${article.handle}`,
              trackingParams: article.trackingParameters,
              term,
            });

            return (
              <li className="predictive-search-result-item" key={article.id}>
                <Link prefetch="intent" to={articleUrl}>
                  <div>
                    <span>{article.title}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/**
 * @param {PartialSearchResult<'pages'>}
 */
function SearchResultsPages({term, pages}) {
  if (!pages?.nodes.length) {
    return null;
  }

  return (
    <section className="search-drawer-section" aria-label="Pages">
      <div className="predictive-search-result">
        <h5>Pages</h5>
        <ul>
          {pages?.nodes?.map((page) => {
            const pageUrl = urlWithTrackingParams({
              baseUrl: `/pages/${page.handle}`,
              trackingParams: page.trackingParameters,
              term,
            });

            return (
              <li className="predictive-search-result-item" key={page.id}>
                <Link prefetch="intent" to={pageUrl}>
                  <div>
                    <span>{page.title}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/**
 * @param {PartialSearchResult<'products'> & {
 *   siblingColorDataByProductId?: Record<string, {count: number; swatchHexes: string[]}>;
 * }} props
 */
function SearchResultsProducts({
  term,
  products,
  siblingColorDataByProductId,
}) {
  if (!products?.nodes.length) {
    return null;
  }

  const {nodes, showCount, totalCount, hasMore} = products;
  const nextShow = Math.min(
    showCount + SEARCH_CATALOG_SHOW_STEP,
    totalCount,
  );

  return (
    <section
      className="search-page-catalog"
      aria-labelledby="search-catalog-heading"
    >
      <div className="search-page-catalog-intro">
        <div className="collection-section-header search-page-catalog-title-row">
          <h2 id="search-catalog-heading" className="collection-section-title">
            Products
          </h2>
        </div>
        <p className="search-page-catalog-meta" aria-live="polite">
          Showing {nodes.length} of {totalCount} styles
        </p>
      </div>
      <div className="home-featured home-featured--search-catalog">
        <div className="home-featured-grid-bleed">
          <div className="home-featured-grid">
            {nodes.map((product, index) => (
              <HomeFeaturedProductCard
                key={product.id}
                product={product}
                siblingColorData={siblingColorDataByProductId?.[product.id]}
                imageLoading={
                  index < SEARCH_CATALOG_SHOW_INITIAL ? 'eager' : 'lazy'
                }
              />
            ))}
          </div>
        </div>
      </div>
      {hasMore ? (
        <div className="search-page-catalog-show-more-wrap">
          <Link
            to={searchCatalogShowHref(term, nextShow)}
            className="search-page-catalog-show-more"
            prefetch="intent"
            preventScrollReset
          >
            Show more
          </Link>
        </div>
      ) : null}
    </section>
  );
}

/**
 * @param {{term?: string}} props
 */
function SearchResultsEmpty({term}) {
  const q = (term ?? '').trim();
  if (q) {
    return (
      <div className="search-drawer-results-block">
        <p className="search-drawer-status search-drawer-muted">
          No results found for <q>{q}</q>
        </p>
      </div>
    );
  }

  return (
    <div className="search-drawer-results-block">
      <p className="search-drawer-status search-drawer-muted">
        Enter a search term to find products, pages, and articles.
      </p>
    </div>
  );
}

/** @typedef {RegularSearchReturn['result']['items']} SearchItems */
/**
 * @typedef {Pick<
 *   SearchItems,
 *   ItemType
 * > &
 *   Pick<RegularSearchReturn, 'term'>} PartialSearchResult
 * @template {keyof SearchItems} ItemType
 */
/**
 * @typedef {RegularSearchReturn & {
 *   children: (args: SearchItems & {term: string}) => React.ReactNode;
 * }} SearchResultsProps
 */

/** @typedef {import('~/lib/search').RegularSearchReturn} RegularSearchReturn */
