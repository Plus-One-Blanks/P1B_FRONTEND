/** Category rows on homepage + `/collections` — must match Handles in Shopify Admin. */
export const CATEGORY_SNIPPET_HANDLES = {
  tshirts: 't-shirts',
  sweatshirts: 'sweatshirts',
  longSleeveTshirts: 'long-sleeve-t-shirts',
  polos: 'polos',
  hats: 'hats',
};

/**
 * Matches homepage `FeaturedCollection` — product snippets for featured grids.
 */
export const FEATURED_COLLECTION_QUERY = `#graphql
  fragment CategorySnippetProduct on Product {
    id
    handle
    title
    vendor
    tags
    availableForSale
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
        amount
        currencyCode
      }
    }
    options {
      name
      values
    }
  }
  fragment CategoryFeaturedCollectionFields on Collection {
    id
    title
    description
    handle
    products(first: 20, sortKey: MANUAL) {
      nodes {
        ...CategorySnippetProduct
      }
    }
  }
  query FeaturedCollection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      ...CategoryFeaturedCollectionFields
    }
  }
`;

/**
 * Homepage category rows + `/collections`: five collections plus flat product refs for sibling swatches.
 * @param {import('@shopify/hydrogen').Storefront} storefront
 */
export async function loadFiveCategorySnippetCollections(storefront) {
  const h = CATEGORY_SNIPPET_HANDLES;

  const [
    tshirtsResult,
    sweatshirtsResult,
    longSleeveTshirtsResult,
    polosResult,
    hatsResult,
  ] = await Promise.all([
    storefront.query(FEATURED_COLLECTION_QUERY, {variables: {handle: h.tshirts}}),
    storefront.query(FEATURED_COLLECTION_QUERY, {
      variables: {handle: h.sweatshirts},
    }),
    storefront.query(FEATURED_COLLECTION_QUERY, {
      variables: {handle: h.longSleeveTshirts},
    }),
    storefront.query(FEATURED_COLLECTION_QUERY, {variables: {handle: h.polos}}),
    storefront.query(FEATURED_COLLECTION_QUERY, {variables: {handle: h.hats}}),
  ]);

  const tshirtsCollection = tshirtsResult?.collection || null;
  const sweatshirtsCollection = sweatshirtsResult?.collection || null;
  const longSleeveTshirtsCollection =
    longSleeveTshirtsResult?.collection || null;
  const polosCollection = polosResult?.collection || null;
  const hatsCollection = hatsResult?.collection || null;

  const sectionCollections = [
    tshirtsCollection,
    sweatshirtsCollection,
    longSleeveTshirtsCollection,
    polosCollection,
    hatsCollection,
  ].filter(Boolean);

  /** @type {unknown[]} */
  const sectionProductsForSiblingColors = [];
  const seenSectionProductId = new Set();
  for (const col of sectionCollections) {
    for (const p of col.products?.nodes ?? []) {
      if (p?.id && !seenSectionProductId.has(p.id)) {
        seenSectionProductId.add(p.id);
        sectionProductsForSiblingColors.push(p);
      }
    }
  }

  return {
    tshirtsCollection,
    sweatshirtsCollection,
    longSleeveTshirtsCollection,
    polosCollection,
    hatsCollection,
    sectionProductsForSiblingColors,
  };
}
