import {redirect, useLoaderData} from 'react-router';
import {useState, useEffect, useRef, useMemo} from 'react';
import {getPaginationVariables, Analytics} from '@shopify/hydrogen';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {CollectionBanner} from '~/routes/($locale)._index';
import {HomeFeaturedProductCard} from '~/components/HomeFeaturedProductCard';
import {buildSiblingColorDataByProductId} from '~/lib/productGroupColorData';
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

  const collectionNodes = collection.products?.nodes ?? [];
  const collectionSiblingColorData = await buildSiblingColorDataByProductId(
    storefront,
    collectionNodes,
  );

  return {
    collection,
    collectionSiblingColorData,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 * @param {Route.LoaderArgs}
 */
function loadDeferredData() {
  return {};
}

export default function Collection() {
  /** @type {LoaderReturnData} */
  const {collection, collectionSiblingColorData} = useLoaderData();

  const allProducts = useMemo(
    () => collection.products?.nodes || [],
    [collection],
  );
  const [filteredProducts, setFilteredProducts] = useState(allProducts);
  const [activeFilters, setActiveFilters] = useState([]);
  const filtersRef = useRef(null);
  const filterChromeRef = useRef(null);

  // Update filtered products when collection changes
  useEffect(() => {
    setFilteredProducts(allProducts);
  }, [allProducts]);

  const handleRemoveFilter = (type, value) => {
    filtersRef.current?.removeFilter?.(type, value);
  };

  const handleClearAllFilters = () => {
    filtersRef.current?.clearAllFilters?.();
  };

  return (
    <div className="collection">
      <CollectionBanner collection={collection} />
      <div className="collection-content-wrapper">
        <div
          ref={filterChromeRef}
          className={
            activeFilters.length > 0
              ? 'collection-filters-sticky-stack collection-filters-sticky-stack--has-active-filters'
              : 'collection-filters-sticky-stack'
          }
        >
          <CollectionFilters
            ref={filtersRef}
            chromeRootRef={filterChromeRef}
            products={allProducts}
            onFilterChange={setFilteredProducts}
            onActiveFiltersChange={setActiveFilters}
            itemCount={filteredProducts.length}
          />
          {activeFilters.length > 0 && (
            <div className="collection-sticky-active-filters">
              <div className="active-filters-row">
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
                <button
                  type="button"
                  className="active-filters-clear-all"
                  onClick={handleClearAllFilters}
                >
                  Clear all filters
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="collection-products">
          <div
            key={`grid-${filteredProducts.length}-${filteredProducts[0]?.id ?? ''}-${filteredProducts[filteredProducts.length - 1]?.id ?? ''}`}
            className="collection-products-featured"
          >
            {filteredProducts.length === 0 ? (
              <p className="collection-products-empty">No products match these filters.</p>
            ) : (
              <div className="home-featured-grid-bleed">
                <div className="home-featured-grid">
                  {filteredProducts.map((product, index) => (
                    <HomeFeaturedProductCard
                      key={product.id}
                      product={product}
                      siblingColorData={collectionSiblingColorData?.[product.id]}
                      swatchLimitNarrow={7}
                      imageLoading={index < 8 ? 'eager' : 'lazy'}
                    />
                  ))}
                </div>
              </div>
            )}
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
  fragment MoneyProductItemCollection on MoneyV2 {
    amount
    currencyCode
  }
  fragment ProductItemCollection on Product {
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
        ...MoneyProductItemCollection
      }
      maxVariantPrice {
        ...MoneyProductItemCollection
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
          ...ProductItemCollection
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
/** @typedef {import('storefrontapi.generated').ProductItemCollectionFragment} ProductItemCollectionFragment */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
