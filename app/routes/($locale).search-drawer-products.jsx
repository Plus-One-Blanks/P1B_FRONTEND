import {ALL_PRODUCTS_COLLECTION_HANDLE} from '~/lib/searchDrawerCollection';

/**
 * JSON resource for the search drawer: products in the “all products” collection.
 * Used for client-side filtering so quick search stays scoped to that collection.
 *
 * @param {Route.LoaderArgs} args
 */
export async function loader({context}) {
  const {storefront} = context;

  const {collection, errors} = await storefront.query(SEARCH_DRAWER_COLLECTION_QUERY, {
    variables: {
      handle: ALL_PRODUCTS_COLLECTION_HANDLE,
      first: 250,
    },
  });

  if (errors?.length) {
    console.error('search-drawer-products:', errors);
  }

  const products = collection?.products?.nodes ?? [];

  return Response.json({products});
}

const SEARCH_DRAWER_PRODUCT_FRAGMENT = `#graphql
  fragment SearchDrawerProduct on Product {
    __typename
    id
    title
    handle
    vendor
    tags
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

const SEARCH_DRAWER_COLLECTION_QUERY = `#graphql
  query SearchDrawerCollectionProducts(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
    $first: Int!
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      products(first: $first) {
        nodes {
          ...SearchDrawerProduct
        }
      }
    }
  }
  ${SEARCH_DRAWER_PRODUCT_FRAGMENT}
`;

/** @typedef {import('./+types/search-drawer-products').Route} Route */
