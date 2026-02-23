import {redirect, useLoaderData} from 'react-router';
import {useState, useMemo, useEffect, useRef} from 'react';
import {getPaginationVariables, Analytics} from '@shopify/hydrogen';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {ProductItem} from '~/components/ProductItem';
import {CollectionBanner} from '~/routes/($locale)._index';
import {CollectionFilters} from '~/components/CollectionFilters';

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({data}) => {
  return [{title: `Hydrogen | ${data?.collection.title ?? ''} Collection`}];
};

/**
 * @param {Route.LoaderArgs} args
 */
export async function loader(args) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 * @param {Route.LoaderArgs}
 */
async function loadCriticalData({context, params, request}) {
  const {handle} = params;
  const {storefront} = context;
  // Fetch more products for client-side filtering
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 250, // Fetch more products for filtering
  });

  if (!handle) {
    throw redirect('/collections');
  }

  const [{collection}] = await Promise.all([
    storefront.query(COLLECTION_QUERY, {
      variables: {handle, ...paginationVariables},
      // Add other queries here, so that they are loaded in parallel
    }),
  ]);

  if (!collection) {
    throw new Response(`Collection ${handle} not found`, {
      status: 404,
    });
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, {handle, data: collection});

  return {
    collection,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 * @param {Route.LoaderArgs}
 */
function loadDeferredData({context}) {
  return {};
}

export default function Collection() {
  /** @type {LoaderReturnData} */
  const {collection} = useLoaderData();

  // Generate dynamic title based on collection title
  const bannerTitle = `Blank ${collection.title} at Wholesale Prices`;

  // Get all products from the collection
  const allProducts = collection.products?.nodes || [];
  const [filteredProducts, setFilteredProducts] = useState(allProducts);
  const [activeFilters, setActiveFilters] = useState([]);
  const filtersRef = useRef(null);

  // Update filtered products when collection changes
  useEffect(() => {
    setFilteredProducts(allProducts);
  }, [allProducts]);

  const handleRemoveFilter = (type, value) => {
    filtersRef.current?.removeFilter?.(type, value);
  };

  // Create a mock connection object for PaginatedResourceSection
  const filteredConnection = useMemo(() => {
    return {
      nodes: filteredProducts,
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        endCursor: null,
        startCursor: null,
      },
    };
  }, [filteredProducts]);

  return (
    <div className="collection">
      <CollectionBanner 
        title={bannerTitle}
        description={collection.description}
      />
      <div className="collection-content-wrapper">
        <div className="collection-sidebar">
          <CollectionFilters
            ref={filtersRef}
            products={allProducts}
            onFilterChange={setFilteredProducts}
            onActiveFiltersChange={setActiveFilters}
          />
        </div>
        <div className="collection-products">
          <div className="collection-products-header">
            <span className="collection-products-count">
              Showing {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
            </span>
          </div>
          {activeFilters.length > 0 && (
            <div className="active-filters">
              {activeFilters.map((filter) => (
                <button
                  key={`${filter.type}-${filter.value}`}
                  type="button"
                  className="active-filter-chip"
                  onClick={() => handleRemoveFilter(filter.type, filter.value)}
                >
                  <span className="active-filter-chip-label">
                    {filter.label}: {filter.value}
                  </span>
                  <span className="active-filter-chip-remove" aria-label={`Remove ${filter.label} ${filter.value}`}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M9 3L3 9M3 3l6 6" />
                    </svg>
                  </span>
                </button>
              ))}
            </div>
          )}
          <div
            key={`grid-${filteredProducts.length}-${filteredProducts[0]?.id ?? ''}-${filteredProducts[filteredProducts.length - 1]?.id ?? ''}`}
            className="products-grid-transition"
          >
            <div className="products-grid">
              {filteredProducts.map((product, index) => (
                <div
                  key={product.id}
                  className="product-item-wrapper"
                  style={{ '--i': index }}
                >
                  <ProductItem
                    product={product}
                    loading={index < 8 ? 'eager' : undefined}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Analytics.CollectionView
        data={{
          collection: {
            id: collection.id,
            handle: collection.handle,
          },
        }}
      />
    </div>
  );
}

const PRODUCT_ITEM_FRAGMENT = `#graphql
  fragment MoneyProductItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment ProductItem on Product {
    id
    handle
    title
    vendor
    tags
    description
    featuredImage {
      id
      altText
      url
      width
      height
    }
    priceRange {
      minVariantPrice {
        ...MoneyProductItem
      }
      maxVariantPrice {
        ...MoneyProductItem
      }
    }
  }
`;

// NOTE: https://shopify.dev/docs/api/storefront/2022-04/objects/collection
const COLLECTION_QUERY = `#graphql
  ${PRODUCT_ITEM_FRAGMENT}
  query Collection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      products(
        first: $first,
        last: $last,
        before: $startCursor,
        after: $endCursor
      ) {
        nodes {
          ...ProductItem
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          endCursor
          startCursor
        }
      }
    }
  }
`;

/** @typedef {import('./+types/collections.$handle').Route} Route */
/** @typedef {import('storefrontapi.generated').ProductItemFragment} ProductItemFragment */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
