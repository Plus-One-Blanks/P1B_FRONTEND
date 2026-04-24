import {useLoaderData} from 'react-router';
import {Search} from 'lucide-react';
import {Analytics} from '@shopify/hydrogen';
import {SearchForm} from '~/components/SearchForm';
import {SearchResults} from '~/components/SearchResults';
import {getEmptyPredictiveSearchResult} from '~/lib/search';
import {buildSiblingColorDataByProductId} from '~/lib/productGroupColorData';
import {
  ALL_PRODUCTS_COLLECTION_HANDLE,
  SEARCH_CATALOG_SHOW_INITIAL,
  dedupeProductsByStyleGroup,
  filterCollectionProductsByQuery,
} from '~/lib/searchDrawerCollection';

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{title: `Hydrogen | Search`}];
};

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({request, context}) {
  const url = new URL(request.url);
  const isPredictive = url.searchParams.has('predictive');
  const searchPromise = isPredictive
    ? predictiveSearch({request, context})
    : regularSearch({request, context});

  searchPromise.catch((error) => {
    console.error(error);
    return {term: '', result: null, error: error.message};
  });

  return await searchPromise;
}

/**
 * Renders the /search route
 */
export default function SearchPage() {
  /** @type {LoaderReturnData} */
  const {type, term, result, error} = useLoaderData();
  if (type === 'predictive') return null;

  return (
    <div className="search-page">
      <div className="search-page-constrain">
        <h1 className="search-page-heading-sr">Search</h1>
        <SearchForm
          method="get"
          className="search-drawer-form predictive-search-form search-page-form"
        >
          {({inputRef}) => (
            <div className="search-drawer-query">
              <span className="search-drawer-query-icon" aria-hidden>
                <Search size={20} strokeWidth={2} />
              </span>
              <input
                key={term}
                defaultValue={term}
                name="q"
                className="search-drawer-query-input"
                placeholder="What are you looking for?"
                ref={inputRef}
                type="search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
              />
              <button type="submit" className="search-drawer-submit">
                Search
              </button>
            </div>
          )}
        </SearchForm>

        <div className="search-page-body">
          {error ? (
            <p className="search-page-error" role="alert">
              {error}
            </p>
          ) : null}

          {!term?.trim() || !result?.total ? (
            <SearchResults.Empty term={term} />
          ) : null}
        </div>
      </div>

      {term?.trim() && result?.total ? (
        <SearchResults result={result} term={term}>
          {({
            articles,
            pages,
            products,
            siblingColorDataByProductId,
            term: searchTerm,
          }) => (
            <>
              <SearchResults.Products
                products={products}
                siblingColorDataByProductId={siblingColorDataByProductId}
                term={searchTerm}
              />
              <div className="search-page-constrain">
                <div className="search-page-results search-page-results-secondary">
                  <SearchResults.Pages pages={pages} term={searchTerm} />
                  <SearchResults.Articles
                    articles={articles}
                    term={searchTerm}
                  />
                </div>
              </div>
            </>
          )}
        </SearchResults>
      ) : null}

      <Analytics.SearchView data={{searchTerm: term, searchResults: result}} />
    </div>
  );
}

/** Same product fields as the homepage featured strip (image, swatches, From price). */
const SEARCH_PAGE_CATALOG_PRODUCT_FRAGMENT = `#graphql
  fragment SearchPageCatalogProduct on Product {
    id
    handle
    title
    vendor
    tags
    featuredImage {
      id
      altText
      url
      width
      height
    }
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    options {
      name
      values
    }
    variants(first: 250) {
      nodes {
        selectedOptions {
          name
          value
        }
      }
    }
  }
`;

const SEARCH_PAGE_FRAGMENT = `#graphql
  fragment SearchPage on Page {
     __typename
     handle
    id
    title
    trackingParameters
  }
`;

const SEARCH_ARTICLE_FRAGMENT = `#graphql
  fragment SearchArticle on Article {
    __typename
    handle
    id
    title
    trackingParameters
    blog {
      handle
    }
  }
`;

// Storefront search for pages + articles; products come from the all-products collection (see regularSearch).
// https://shopify.dev/docs/api/storefront/latest/queries/search
export const SEARCH_QUERY = `#graphql
  query RegularSearch(
    $country: CountryCode
    $language: LanguageCode
    $term: String!
    $handle: String!
    $catalogFirst: Int!
  ) @inContext(country: $country, language: $language) {
    articles: search(query: $term, types: [ARTICLE], first: 10) {
      nodes {
        ...on Article {
          ...SearchArticle
        }
      }
    }
    pages: search(query: $term, types: [PAGE], first: 10) {
      nodes {
        ...on Page {
          ...SearchPage
        }
      }
    }
    catalogCollection: collection(handle: $handle) {
      products(first: $catalogFirst) {
        nodes {
          ...SearchPageCatalogProduct
        }
      }
    }
  }
  ${SEARCH_PAGE_CATALOG_PRODUCT_FRAGMENT}
  ${SEARCH_PAGE_FRAGMENT}
  ${SEARCH_ARTICLE_FRAGMENT}
`;

const CATALOG_FETCH_FIRST = 250;

/**
 * Regular search fetcher
 * @param {Pick<
 *   Route.LoaderArgs,
 *   'request' | 'context'
 * >}
 * @return {Promise<RegularSearchReturn>}
 */
async function regularSearch({request, context}) {
  const {storefront} = context;
  const url = new URL(request.url);
  const term = String(url.searchParams.get('q') || '');
  const trimmed = term.trim();

  const emptyCatalogItems = () => ({
    articles: {nodes: []},
    pages: {nodes: []},
    products: {
      nodes: [],
      showCount: 0,
      totalCount: 0,
      hasMore: false,
    },
    siblingColorDataByProductId: {},
  });

  if (!trimmed) {
    return {
      type: 'regular',
      term,
      error: undefined,
      result: {total: 0, items: emptyCatalogItems()},
    };
  }

  const showRaw = url.searchParams.get('show');
  let showRequested = Number.parseInt(showRaw ?? '', 10);
  if (
    !Number.isFinite(showRequested) ||
    showRequested < SEARCH_CATALOG_SHOW_INITIAL
  ) {
    showRequested = SEARCH_CATALOG_SHOW_INITIAL;
  }

  const {errors, ...items} = await storefront.query(SEARCH_QUERY, {
    variables: {
      term: trimmed,
      handle: ALL_PRODUCTS_COLLECTION_HANDLE,
      catalogFirst: CATALOG_FETCH_FIRST,
    },
  });

  if (!items) {
    throw new Error('No search data returned from Shopify API');
  }

  const catalogNodes = items.catalogCollection?.products?.nodes ?? [];
  const matchedStyles = dedupeProductsByStyleGroup(
    filterCollectionProductsByQuery(catalogNodes, trimmed),
  );
  const totalCatalog = matchedStyles.length;
  const showCount = Math.min(showRequested, totalCatalog);
  const visibleNodes = matchedStyles.slice(0, showCount);

  const siblingColorDataByProductId =
    visibleNodes.length > 0
      ? await buildSiblingColorDataByProductId(storefront, visibleNodes)
      : {};

  const articleCount = items.articles?.nodes?.length ?? 0;
  const pageCount = items.pages?.nodes?.length ?? 0;
  const total = articleCount + pageCount + totalCatalog;

  const error = errors
    ? errors.map(({message}) => message).join(', ')
    : undefined;

  return {
    type: 'regular',
    term,
    error,
    result: {
      total,
      items: {
        articles: items.articles,
        pages: items.pages,
        products: {
          nodes: visibleNodes,
          showCount,
          totalCount: totalCatalog,
          hasMore: showCount < totalCatalog,
        },
        siblingColorDataByProductId,
      },
    },
  };
}

/**
 * Predictive search query and fragments
 * (adjust as needed)
 */
const PREDICTIVE_SEARCH_ARTICLE_FRAGMENT = `#graphql
  fragment PredictiveArticle on Article {
    __typename
    id
    title
    handle
    blog {
      handle
    }
    image {
      url
      altText
      width
      height
    }
    trackingParameters
  }
`;

const PREDICTIVE_SEARCH_COLLECTION_FRAGMENT = `#graphql
  fragment PredictiveCollection on Collection {
    __typename
    id
    title
    handle
    image {
      url
      altText
      width
      height
    }
    trackingParameters
  }
`;

const PREDICTIVE_SEARCH_PAGE_FRAGMENT = `#graphql
  fragment PredictivePage on Page {
    __typename
    id
    title
    handle
    trackingParameters
  }
`;

const PREDICTIVE_SEARCH_PRODUCT_FRAGMENT = `#graphql
  fragment PredictiveProduct on Product {
    __typename
    id
    title
    handle
    trackingParameters
    selectedOrFirstAvailableVariant(
      selectedOptions: []
      ignoreUnknownOptions: true
      caseInsensitiveMatch: true
    ) {
      id
      image {
        url
        altText
        width
        height
      }
      price {
        amount
        currencyCode
      }
    }
  }
`;

const PREDICTIVE_SEARCH_QUERY_FRAGMENT = `#graphql
  fragment PredictiveQuery on SearchQuerySuggestion {
    __typename
    text
    styledText
    trackingParameters
  }
`;

// NOTE: https://shopify.dev/docs/api/storefront/latest/queries/predictiveSearch
const PREDICTIVE_SEARCH_QUERY = `#graphql
  query PredictiveSearch(
    $country: CountryCode
    $language: LanguageCode
    $limit: Int!
    $limitScope: PredictiveSearchLimitScope!
    $term: String!
    $types: [PredictiveSearchType!]
  ) @inContext(country: $country, language: $language) {
    predictiveSearch(
      limit: $limit,
      limitScope: $limitScope,
      query: $term,
      types: $types,
    ) {
      articles {
        ...PredictiveArticle
      }
      collections {
        ...PredictiveCollection
      }
      pages {
        ...PredictivePage
      }
      products {
        ...PredictiveProduct
      }
      queries {
        ...PredictiveQuery
      }
    }
  }
  ${PREDICTIVE_SEARCH_ARTICLE_FRAGMENT}
  ${PREDICTIVE_SEARCH_COLLECTION_FRAGMENT}
  ${PREDICTIVE_SEARCH_PAGE_FRAGMENT}
  ${PREDICTIVE_SEARCH_PRODUCT_FRAGMENT}
  ${PREDICTIVE_SEARCH_QUERY_FRAGMENT}
`;

/**
 * Predictive search fetcher
 * @param {Pick<
 *   Route.ActionArgs,
 *   'request' | 'context'
 * >}
 * @return {Promise<PredictiveSearchReturn>}
 */
async function predictiveSearch({request, context}) {
  const {storefront} = context;
  const url = new URL(request.url);
  const term = String(url.searchParams.get('q') || '').trim();
  const limit = Number(url.searchParams.get('limit') || 10);
  const type = 'predictive';

  if (!term) return {type, term, result: getEmptyPredictiveSearchResult()};

  // Predictively search articles, collections, pages, products, and queries (suggestions)
  const {predictiveSearch: items, errors} = await storefront.query(
    PREDICTIVE_SEARCH_QUERY,
    {
      variables: {
        // customize search options as needed
        limit,
        limitScope: 'EACH',
        term,
      },
    },
  );

  if (errors) {
    throw new Error(
      `Shopify API errors: ${errors.map(({message}) => message).join(', ')}`,
    );
  }

  if (!items) {
    throw new Error('No predictive search data returned from Shopify API');
  }

  const total = Object.values(items).reduce(
    (acc, item) => acc + item.length,
    0,
  );

  return {type, term, result: {items, total}};
}

/** @typedef {import('./+types/search').Route} Route */
/** @typedef {import('~/lib/search').RegularSearchReturn} RegularSearchReturn */
/** @typedef {import('~/lib/search').PredictiveSearchReturn} PredictiveSearchReturn */
/** @typedef {import('storefrontapi.generated').RegularSearchQuery} RegularSearchQuery */
/** @typedef {import('storefrontapi.generated').PredictiveSearchQuery} PredictiveSearchQuery */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
