/** Category rows on homepage + `/collections` — must match Handles in Shopify Admin. */
export const CATEGORY_SNIPPET_HANDLES = {
  tshirts: 't-shirts',
  sweatshirts: 'sweatshirts',
  longSleeveTshirts: 'long-sleeve-t-shirts',
  polos: 'polos',
  hats: 'hats',
};

/** Decorated parallels — `{blank-handle}-decorated` in Shopify Admin. */
export const DECORATED_CATEGORY_SNIPPET_HANDLES = {
  tshirts: 't-shirts-decorated',
  sweatshirts: 'sweatshirts-decorated',
  longSleeveTshirts: 'long-sleeve-t-shirts-decorated',
  polos: 'polos-decorated',
  hats: 'hats-decorated',
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
 * @param {import('@shopify/hydrogen').Storefront} storefront
 * @param {Record<string, string>} handles
 */
async function loadSnippetCollectionsByHandles(storefront, handles) {
  const entries = Object.entries(handles);
  const results = await Promise.all(
    entries.map(([, handle]) =>
      storefront.query(FEATURED_COLLECTION_QUERY, {
        cache: storefront.CacheLong(),
        variables: {handle},
      }),
    ),
  );

  /** @type {Record<string, unknown>} */
  const byKey = {};
  entries.forEach(([key], i) => {
    byKey[key] = results[i]?.collection || null;
  });

  const sectionCollections = Object.values(byKey).filter(Boolean);
  /** @type {unknown[]} */
  const sectionProductsForSiblingColors = [];
  const seenSectionProductId = new Set();
  for (const col of sectionCollections) {
    for (const p of /** @type {{ products?: { nodes?: Array<{ id?: string }> } }} */ (
      col
    ).products?.nodes ?? []) {
      if (p?.id && !seenSectionProductId.has(p.id)) {
        seenSectionProductId.add(p.id);
        sectionProductsForSiblingColors.push(p);
      }
    }
  }

  return {byKey, sectionProductsForSiblingColors};
}

/**
 * Homepage category rows + `/collections`: five collections plus flat product refs for sibling swatches.
 * @param {import('@shopify/hydrogen').Storefront} storefront
 */
export async function loadFiveCategorySnippetCollections(storefront) {
  const {byKey, sectionProductsForSiblingColors} =
    await loadSnippetCollectionsByHandles(storefront, CATEGORY_SNIPPET_HANDLES);

  return {
    tshirtsCollection: byKey.tshirts || null,
    sweatshirtsCollection: byKey.sweatshirts || null,
    longSleeveTshirtsCollection: byKey.longSleeveTshirts || null,
    polosCollection: byKey.polos || null,
    hatsCollection: byKey.hats || null,
    sectionProductsForSiblingColors,
  };
}

/**
 * Decorated catalog snippets for the homepage (primary shop path).
 * @param {import('@shopify/hydrogen').Storefront} storefront
 */
export async function loadDecoratedCategorySnippetCollections(storefront) {
  const {byKey, sectionProductsForSiblingColors} =
    await loadSnippetCollectionsByHandles(
      storefront,
      DECORATED_CATEGORY_SNIPPET_HANDLES,
    );

  return {
    decoratedTshirtsCollection: byKey.tshirts || null,
    decoratedSweatshirtsCollection: byKey.sweatshirts || null,
    decoratedLongSleeveTshirtsCollection: byKey.longSleeveTshirts || null,
    decoratedPolosCollection: byKey.polos || null,
    decoratedHatsCollection: byKey.hats || null,
    sectionProductsForSiblingColors,
  };
}
