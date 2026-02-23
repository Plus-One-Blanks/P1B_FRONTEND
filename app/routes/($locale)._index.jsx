import { useLoaderData } from 'react-router';
import { ProductItem } from '~/components/ProductItem';
import { Shirt, ShirtIcon, ShoppingBag } from 'lucide-react';

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{ title: 'Hydrogen | Home' }];
};

/**
 * @param {Route.LoaderArgs} args
 */
export async function loader(args) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return { ...deferredData, ...criticalData };
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 * @param {Route.LoaderArgs}
 */
async function loadCriticalData({ context }) {
  // Query multiple collections for different sections
  const tshirtsHandle = 'short-sleeve-t-shirts';
  const sweatshirtsHandle = 'sweatshirts';
  const longSleeveTshirtsHandle = 'long-sleeve-t-shirts';
  const youthTshirtsHandle = 'youth-t-shirts';
  const tankTopsHandle = 'tank-tops';

  const [tshirtsResult, sweatshirtsResult, longSleeveTshirtsResult, youthTshirtsResult, tankTopsResult] = await Promise.all([
    context.storefront.query(FEATURED_COLLECTION_QUERY, {
      variables: { handle: tshirtsHandle },
    }),
    context.storefront.query(FEATURED_COLLECTION_QUERY, {
      variables: { handle: sweatshirtsHandle },
    }),
    context.storefront.query(FEATURED_COLLECTION_QUERY, {
      variables: { handle: longSleeveTshirtsHandle },
    }),
    context.storefront.query(FEATURED_COLLECTION_QUERY, {
      variables: { handle: youthTshirtsHandle },
    }),
    context.storefront.query(FEATURED_COLLECTION_QUERY, {
      variables: { handle: tankTopsHandle },
    }),
  ]);

  // Debug: Log collection data to see what's being returned
  if (tshirtsResult?.collection?.products?.nodes) {
    console.log('T-Shirts collection products count:', tshirtsResult.collection.products.nodes.length);
    tshirtsResult.collection.products.nodes.forEach((product, index) => {
      console.log(`T-Shirt ${index + 1}:`, product.title, product.id, product.featuredImage ? 'has image' : 'NO IMAGE');
    });
  }

  if (sweatshirtsResult?.collection?.products?.nodes) {
    console.log('Sweatshirts collection products count:', sweatshirtsResult.collection.products.nodes.length);
    sweatshirtsResult.collection.products.nodes.forEach((product, index) => {
      console.log(`Sweatshirt ${index + 1}:`, product.title, product.id, product.featuredImage ? 'has image' : 'NO IMAGE');
    });
  }

  return {
    tshirtsCollection: tshirtsResult?.collection || null,
    sweatshirtsCollection: sweatshirtsResult?.collection || null,
    longSleeveTshirtsCollection: longSleeveTshirtsResult?.collection || null,
    youthTshirtsCollection: youthTshirtsResult?.collection || null,
    tankTopsCollection: tankTopsResult?.collection || null,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 * @param {Route.LoaderArgs}
 */
function loadDeferredData({ context }) {
  return {};
}

export default function Homepage() {
  /** @type {LoaderReturnData} */
  const data = useLoaderData();
  return (
    <div className="home">
      <HomepageBanner />
      {data.tshirtsCollection && (
        <CollectionSection
          title="T-Shirts"
          collection={data.tshirtsCollection}
        />
      )}
      {data.sweatshirtsCollection && (
        <CollectionSection
          title="Sweatshirts"
          collection={data.sweatshirtsCollection}
        />
      )}
      {data.longSleeveTshirtsCollection && (
        <CollectionSection
          title="Long Sleeve T-Shirts"
          collection={data.longSleeveTshirtsCollection}
        />
      )}
      {data.youthTshirtsCollection && (
        <CollectionSection
          title="Youth T-Shirts"
          collection={data.youthTshirtsCollection}
        />
      )}
      {data.tankTopsCollection && (
        <CollectionSection
          title="Tank Tops"
          collection={data.tankTopsCollection}
        />
      )}
    </div>
  );
}

/**
 * Homepage promotional banner section
 */
function HomepageBanner() {
  return (
    <CollectionBanner
      title="Blank Apparel at Wholesale Prices"
      description="Shop in bulk with our premium blank apparel. We offer a wide selection of blank products at unbeatable wholesale prices. Stock up now and enjoy bulk discounts!"
    />
  );
}

/**
 * Reusable collection banner component
 * @param {{ title: string; description?: string }}
 */
export function CollectionBanner({ title, description }) {
  return (
    <div className="homepage-banner">
      <div className="homepage-banner-content">
        <h1 className="homepage-banner-title">{title}</h1>
        <div className="homepage-banner-features">
          <div className="homepage-banner-feature">
            <span className="homepage-banner-check">✓</span>
            <span>Next day delivery</span>
          </div>
          <div className="homepage-banner-feature">
            <span className="homepage-banner-check">✓</span>
            <span>No minimums</span>
          </div>
          <div className="homepage-banner-feature">
            <span className="homepage-banner-check">✓</span>
            <span>2,000+ products</span>
          </div>
          <div className="homepage-banner-feature">
            <span className="homepage-banner-check">✓</span>
            <span>Competitive pricing</span>
            <svg
              className="homepage-banner-info-icon"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="8" cy="8" r="7" />
              <path d="M8 12V8M8 4h.01" />
            </svg>
          </div>
        </div>
        {description && (
          <p className="homepage-banner-description">
            {description}
          </p>
        )}
        <div className="homepage-banner-categories">
          <a href="/collections/short-sleeve-t-shirts" className="homepage-banner-category">
            <Shirt className="homepage-banner-category-icon" size={24} />
            <span className="homepage-banner-category-label">T-Shirts</span>
          </a>
          <a href="/collections/sweatshirts" className="homepage-banner-category">
            <ShirtIcon className="homepage-banner-category-icon" size={24} />
            <span className="homepage-banner-category-label">Sweatshirts</span>
          </a>
          <a href="/collections/hoodies" className="homepage-banner-category">
            <ShirtIcon className="homepage-banner-category-icon" size={24} />
            <span className="homepage-banner-category-label">Hoodies</span>
          </a>
          <a href="/collections/blank-accessories" className="homepage-banner-category">
            <ShoppingBag className="homepage-banner-category-icon" size={24} />
            <span className="homepage-banner-category-label">Accessories</span>
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * @param {{
 *   title: string;
 *   collection: FeaturedCollectionFragment;
 * }}
 */
function CollectionSection({ title, collection }) {
  if (!collection) return null;

  // Debug: Log what we're rendering
  console.log(`${title} section render - products count:`, collection.products?.nodes?.length);
  if (collection.products?.nodes) {
    collection.products.nodes.forEach((product, index) => {
      console.log(`Rendering ${title} product ${index + 1}:`, product.title, product.id);
    });
  }

  return (
    <div className="collection-section">
      <div className="collection-section-header">
        <h2 className="collection-section-title">{title}</h2>
        <div className="collection-section-separator">|</div>
        <a href={`/collections/${collection.handle}`} className="collection-section-view-all">
          View All
        </a>
      </div>
      {collection.description && (
        <p className="collection-section-description">{collection.description}</p>
      )}
      {collection.products?.nodes && collection.products.nodes.length > 0 ? (
        <div className="collection-section-products">
          {collection.products.nodes.slice(0, 5).map((product) => (
            <ProductItem key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <p>No products in this collection.</p>
      )}
    </div>
  );
}


const FEATURED_COLLECTION_QUERY = `#graphql
  fragment ProductItem on Product {
    id
    handle
    title
    vendor
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
  }
  fragment FeaturedCollection on Collection {
    id
    title
    description
    handle
    products(first: 20, sortKey: COLLECTION_DEFAULT) {
      nodes {
        ...ProductItem
      }
    }
  }
  query FeaturedCollection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      ...FeaturedCollection
    }
  }
`;

/** @typedef {import('./+types/_index').Route} Route */
/** @typedef {import('storefrontapi.generated').FeaturedCollectionFragment} FeaturedCollectionFragment */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
