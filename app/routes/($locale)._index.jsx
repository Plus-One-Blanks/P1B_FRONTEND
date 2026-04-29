import { useEffect, useState } from 'react';
import { Link, useLoaderData } from 'react-router';
import { Image, Money } from '@shopify/hydrogen';
import { HomeContactCta } from '~/components/HomeContactCta';
import { HomeGlobalShipping } from '~/components/HomeGlobalShipping';
import { OutlineButton } from '~/components/OutlineButton';
import { TextIconLink } from '~/components/TextIconLink';
import { SolidButton } from '~/components/SolidButton';
import { CollectionSection } from '~/components/CollectionSection';
import { HomeFeaturedProductCard } from '~/components/HomeFeaturedProductCard';
import { HomeWorkflowSpotlightProductCard } from '~/components/HomeWorkflowSpotlightProductCard';
import { HOME_QUALITY_BRANDS } from '~/lib/featuredProductCard';
import { buildSiblingColorDataByProductId } from '~/lib/productGroupColorData';
import { loadFiveCategorySnippetCollections } from '~/lib/categoryCollectionSnippets.server';
import { ALL_PRODUCTS_COLLECTION_HANDLE } from '~/lib/searchDrawerCollection';
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  Clock,
  DollarSign,
  Layers,
  MessageCircle,
  ShieldCheck,
  Shirt,
  ShirtIcon,
  ShoppingBag,
  Sun,
  Truck,
  Upload,
  Waves,
  Zap,
  Gem,
  CircleMinus,
} from 'lucide-react';

/** Homepage hero carousel — Shopify Files CDN. */
const HOME_HERO_SLIDES = [
  {
    src: 'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/Hanging_T-Shirts.jpg?v=1775170712',
    alt: 'Hanging blank t-shirts ready for production',
  },
  {
    src: 'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/Custom_T-Shirts.jpg?v=1775170712',
    alt: 'Custom printed t-shirts',
  },
  {
    src: 'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/Warehoused_Products.jpg?v=1775170712',
    alt: 'Warehoused apparel and blanks inventory',
  },
  {
    src: 'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/Custom_Shirts.jpg?v=1775170712',
    alt: 'Custom shirts and decorated apparel',
  },
  {
    src: 'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/Embroidery_Machines.jpg?v=1775170712',
    alt: 'Embroidery machines in a production facility',
  },
];

/** Homepage featured grid — collection handle in Shopify (e.g. title “Featured Product” → `featured-product`). */
const FEATURED_PRODUCT_COLLECTION_HANDLE = 'featured-product';

/** Shopify Online Store page for DTF upload — create in Admin (Pages) or change this path. */
const DTF_UPLOAD_PAGE_PATH = '/pages/dtf-upload';

/** DTF landing (collection or page) — keep in sync with `Header.jsx` primary nav. */
const DTF_TRANSFERS_PATH = '/dtf-transfers';

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{ title: 'Plus 1 Blanks | Wholesale blank apparel' }];
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
  const [snippetBundles, featuredShowcaseResult] = await Promise.all([
    loadFiveCategorySnippetCollections(context.storefront),
    context.storefront.query(FEATURED_SHOWCASE_COLLECTION_QUERY, {
      variables: { handle: FEATURED_PRODUCT_COLLECTION_HANDLE },
    }),
  ]);

  const showcaseProducts =
    featuredShowcaseResult?.collection?.products?.nodes ?? [];

  const sectionProductsForSiblingColors =
    snippetBundles.sectionProductsForSiblingColors;

  /** One pass: featured strip + category rows share ProductID / colorCode lookups */
  const productsForSiblingColors = [];
  const seenSiblingProductId = new Set();
  for (const p of [...showcaseProducts, ...sectionProductsForSiblingColors]) {
    if (p?.id && !seenSiblingProductId.has(p.id)) {
      seenSiblingProductId.add(p.id);
      productsForSiblingColors.push(p);
    }
  }
  const productSiblingColorData = await buildSiblingColorDataByProductId(
    context.storefront,
    productsForSiblingColors,
  );

  return {
    tshirtsCollection: snippetBundles.tshirtsCollection || null,
    sweatshirtsCollection: snippetBundles.sweatshirtsCollection || null,
    longSleeveTshirtsCollection:
      snippetBundles.longSleeveTshirtsCollection || null,
    polosCollection: snippetBundles.polosCollection || null,
    hatsCollection: snippetBundles.hatsCollection || null,
    /** Featured Product collection — top 5 manual order, tags/variants for swatches */
    featuredProductShowcase: featuredShowcaseResult?.collection || null,
    /**
     * Per product when `ProductID:*` groups siblings: total color count + up to 8 `colorCode:` hexes.
     * Built once for featured strip + homepage category rows (keys are Product GIDs).
     */
    productSiblingColorData,
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

export default function Homepage() {
  /** @type {LoaderReturnData} */
  const data = useLoaderData();
  const workflowTshirtSpotlight =
    data.tshirtsCollection?.products?.nodes?.[0] ?? null;

  return (
    <div className="home">
      <HomeHero />
      <HomeDtfFeatures />
      {/* <HomeTickerBar /> */}
      {(data.featuredProductShowcase || data.tshirtsCollection) && (
        <HomeFeaturedBlanks
          collection={data.featuredProductShowcase || data.tshirtsCollection}
          siblingColorData={data.productSiblingColorData}
        />
      )}
      <HomeWorkflow
        spotlightProduct={workflowTshirtSpotlight}
        spotlightSiblingColor={
          workflowTshirtSpotlight
            ? data.productSiblingColorData?.[workflowTshirtSpotlight.id]
            : undefined
        }
      />
      <HomeQualityBrands />
      <HomeGlobalShipping />
      {/* <HomeStatsStrip /> */}
      {/* <HomeBrowseCategories /> */}
      <HomeValueProps />
      <HomeContactCta />
      <div id="home-products" className="home-products-anchor">
        <h2 className="home-value-title">Premium blanks, ready to go.</h2>
        <p className="home-value-lede">
          Shop t-shirts, hoodies, and more—built for printing, pressing, and
          selling.
        </p>
      </div>
      {data.tshirtsCollection && (
        <CollectionSection
          title="T-Shirts"
          shopAllLabel="Shop All T-Shirts"
          collection={data.tshirtsCollection}
          siblingColorDataByProductId={data.productSiblingColorData}
        />
      )}
      {data.sweatshirtsCollection && (
        <CollectionSection
          title="Sweatshirts"
          shopAllLabel="Shop All Sweatshirts"
          collection={data.sweatshirtsCollection}
          siblingColorDataByProductId={data.productSiblingColorData}
        />
      )}
      {data.longSleeveTshirtsCollection && (
        <CollectionSection
          title="Long Sleeve T-Shirts"
          shopAllLabel="Shop All Longsleeves"
          collection={data.longSleeveTshirtsCollection}
          siblingColorDataByProductId={data.productSiblingColorData}
        />
      )}
      {data.polosCollection && (
        <CollectionSection
          title="Polos"
          shopAllLabel="Shop All Polos"
          collection={data.polosCollection}
          siblingColorDataByProductId={data.productSiblingColorData}
        />
      )}
      {data.hatsCollection && (
        <CollectionSection
          title="Hats"
          shopAllLabel="Shop All Hats"
          collection={data.hatsCollection}
          siblingColorDataByProductId={data.productSiblingColorData}
        />
      )}
    </div>
  );
}

const HERO_SLIDE_INTERVAL_MS = 3000;

function HomeHero() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (reduceMotion || paused || HOME_HERO_SLIDES.length < 2) return;
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % HOME_HERO_SLIDES.length);
    }, HERO_SLIDE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion, paused]);

  const trustItems = [
    'Competitive wholesale pricing',
    'Fast turnaround on in-stock orders',
    'No minimum order quantity',
    '999+ styles across core categories',
  ];

  return (
    <section className="home-hero" aria-labelledby="home-hero-heading">
      <div className="home-hero-inner home-hero-grid">
        <div className="home-hero-copy">
          <div className="home-hero-social">
            <div className="home-hero-stars" aria-hidden>
              {Array.from({ length: 5 }, (_, i) => (
                <svg
                  key={i}
                  className="home-hero-star"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ))}
            </div>
            <span className="home-hero-social-text">
              Trusted by print shops &amp; decorators nationwide
            </span>
          </div>

          <h1 id="home-hero-heading" className="home-hero-title">
            Premium blank apparel at wholesale prices
          </h1>
          <p className="home-hero-lede">
            Stock tees, fleece, headwear, and more with straightforward pricing and
            fulfillment built for tight production schedules.
          </p>

          <div className="home-hero-ctas">
            <SolidButton
              to={`/collections/${ALL_PRODUCTS_COLLECTION_HANDLE}`}
              prefetch="intent"
              icon={<ArrowRight className="button-icon" size={18} aria-hidden />}
            >
              Get started
            </SolidButton>
            <OutlineButton to="/collections/t-shirts" prefetch="intent">
              Explore catalog
            </OutlineButton>
          </div>

          <ul className="home-hero-trust-grid" aria-label="Key benefits">
            {trustItems.map((label) => (
              <li key={label} className="home-hero-trust-cell">
                <CheckCircle2
                  className="home-hero-trust-icon"
                  size={18}
                  strokeWidth={2}
                  aria-hidden
                />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div
          className="home-hero-visual"
          role="region"
          aria-roledescription="carousel"
          aria-label="Featured imagery"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="home-hero-media-wrap">
            <div className="home-hero-media-frame">
              <div className="home-hero-slides">
                {HOME_HERO_SLIDES.map((slide, i) => (
                  <img
                    key={slide.src}
                    className={`home-hero-slide-img${i === activeIndex ? ' home-hero-slide-img--active' : ''}`}
                    src={slide.src}
                    alt={slide.alt}
                    width={800}
                    height={1000}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    fetchPriority={i === 0 ? 'high' : undefined}
                    decoding="async"
                    draggable={false}
                  />
                ))}
              </div>
            </div>
          </div>
          <div
            className="home-hero-dots"
            role="tablist"
            aria-label="Select hero image"
          >
            {HOME_HERO_SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === activeIndex}
                aria-label={`Slide ${i + 1} of ${HOME_HERO_SLIDES.length}`}
                className={`home-hero-dot${i === activeIndex ? ' home-hero-dot-active' : ''}`}
                onClick={() => setActiveIndex(i)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function HomeDtfFeatures() {
  const items = [
    {
      title: '100% Quality Guaranteed',
      body: 'We stand behind our DTF transfers. Perfect prints, free art review, and zero hidden fees.',
      Icon: BadgeCheck,
      iconVariant: 'sky',
    },
    {
      title: 'No Minimums',
      body: 'Order exactly what you need with no minimum quantity required for any purchase.',
      Icon: Layers,
      iconVariant: 'mint',
    },
    {
      title: 'Super Fast Shipping',
      body: 'Lightning-fast production and reliable delivery mean your DTF transfers can arrive as soon as next day.',
      Icon: Zap,
      iconVariant: 'butter',
    },
    {
      title: 'Unmatched Color & Detail',
      body: 'Our VIVID AF DTF transfers produce up to 16.7 million colors with stunning detail and vibrancy.',
      Icon: Sun,
      iconVariant: 'lilac',
    },
    {
      title: 'Works with a Heatpress, Iron, or Cricut',
      body: 'Achieve smooth, professional results with our easy press-and-peel application process.',
      Icon: Waves,
      iconVariant: 'blush',
    },
    {
      title: 'Lab-Tested Durability',
      body: 'Our DTF transfers are tested to last 100+ washes without fading, cracking, or peeling.',
      Icon: ShieldCheck,
      iconVariant: 'seafoam',
    },
  ];

  return (
    <section className="home-dtf" aria-labelledby="home-dtf-heading">
      <div className="home-dtf-inner">
        <h2 id="home-dtf-heading" className="home-dtf-title">
          High-Quality DTF Transfers. No Compromises.
        </h2>
        <ul className="home-dtf-grid">
          {items.map(({ title, body, Icon, iconVariant }) => (
            <li key={title} className="home-dtf-item">
              <div className="home-dtf-item-card">
                <div
                  className={`home-dtf-item-icon home-dtf-item-icon--${iconVariant}`}
                  aria-hidden
                >
                  <Icon size={22} strokeWidth={2} />
                </div>
                <h3 className="home-dtf-item-title">{title}</h3>
                <p className="home-dtf-item-body">{body}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="home-dtf-cta">
          <SolidButton
            to={DTF_TRANSFERS_PATH}
            prefetch="intent"
            icon={<ArrowRight className="button-icon" size={18} aria-hidden />}
          >
            Get DTF transfers
          </SolidButton>
        </div>
      </div>
    </section>
  );
}

function HomeTickerBar() {
  const items = [
    { icon: ShoppingBag, text: 'No minimums or upfront costs' },
    { icon: Truck, text: 'Dropshipping' },
    { icon: DollarSign, text: 'Threads that turn heads' },
    { icon: Shirt, text: 'Custom T-shirts' },
    { icon: ShirtIcon, text: 'Custom hoodies' },
    { icon: MessageCircle, text: 'Clothing manufacturer' },
    { icon: CheckCircle2, text: 'USA fulfillment' },
  ];

  // Duplicate the list for a seamless loop.
  const doubledItems = [...items, ...items];

  return (
    <section className="home-ticker" aria-label="Store highlights">
      <div className="home-ticker-outer">
        <div className="home-ticker-track" aria-hidden>
          <div className="home-ticker-group">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.text} className="home-ticker-item">
                  <Icon className="home-ticker-icon" size={16} strokeWidth={2} aria-hidden />
                  <span className="home-ticker-text">{item.text}</span>
                </div>
              );
            })}
          </div>
          <div className="home-ticker-group">
            {doubledItems
              .slice(items.length)
              .map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.text} className="home-ticker-item">
                    <Icon className="home-ticker-icon" size={16} strokeWidth={2} aria-hidden />
                    <span className="home-ticker-text">{item.text}</span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * @param {{
 *   spotlightProduct: import('storefrontapi.generated').ProductItemFragment | null;
 *   spotlightSiblingColor?: { count: number; swatchHexes: string[] };
 * }}
 */
function HomeWorkflow({ spotlightProduct, spotlightSiblingColor }) {
  const steps = [
    {
      num: '01',
      title: 'Choose your blanks',
      body: 'Shop wholesale t-shirts, hoodies, fleece, and more—stock what your customers and jobs need.',
    },
    {
      num: '02',
      title: 'Order your DTF',
      body: 'Upload your artwork and get custom heat transfers made to order—built for your press.',
    },
    {
      num: '03',
      title: 'Buy from one distributor',
      body: 'Blanks and transfers on the same order path—fewer vendors, invoices, and pickups.',
    },
    {
      num: '04',
      title: 'Receive & run',
      body: 'Get inventory and DTF delivered—ready to heat press, stock the shelf, or ship to your client.',
    },
  ];

  return (
    <section className="home-workflow" aria-labelledby="home-workflow-heading">
      <div className="home-workflow-inner">
        <div className="home-workflow-grid">
          <div className="home-workflow-copy">
            <h2 id="home-workflow-heading" className="home-workflow-title">
              Your blanks. Your prints. Shipped fast.
            </h2>
            <div className="home-workflow-ctas">
              <SolidButton
                to={`/collections/${ALL_PRODUCTS_COLLECTION_HANDLE}`}
                prefetch="intent"
                icon={<ArrowRight className="button-icon" size={18} aria-hidden />}
              >
                Shop Blanks
              </SolidButton>
              <OutlineButton
                to={DTF_UPLOAD_PAGE_PATH}
                prefetch="intent"
                icon={<Upload className="button-icon" size={18} aria-hidden />}
              >
                Upload DTF
              </OutlineButton>
            </div>
            <ol className="home-workflow-steps">
              {steps.map((step) => (
                <li key={step.num} className="home-workflow-step">
                  <div className="home-workflow-step-head">
                    <span className="home-workflow-step-num">{step.num}</span>
                    <h3 className="home-workflow-step-title">{step.title}</h3>
                  </div>
                  <p className="home-workflow-step-body">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="home-workflow-visual">
            <div className="home-workflow-visual-card">
              <p className="home-workflow-visual-eyebrow">Blanks & DTF</p>
              <p className="home-workflow-visual-lede">
                We are focused on wholesale apparel and custom transfers—distribution and
                selling first—so sourcing stays simple while you grow the shop.
              </p>
              {spotlightProduct ? (
                <>
                  <p className="home-workflow-spotlight-label">
                    From our t-shirts category
                  </p>
                  <div className="home-featured-grid home-workflow-spotlight-grid">
                    <HomeWorkflowSpotlightProductCard
                      product={spotlightProduct}
                      siblingColorData={spotlightSiblingColor}
                      imageLoading="eager"
                    />
                  </div>
                  <TextIconLink
                    to="/collections/t-shirts"
                    className="collection-section-shop-link home-workflow-spotlight-link"
                    prefetch="intent"
                  >
                    Shop all t-shirts
                  </TextIconLink>
                </>
              ) : (
                <TextIconLink
                  to="/collections/t-shirts"
                  className="collection-section-shop-link home-workflow-spotlight-link"
                  prefetch="intent"
                >
                  Browse t-shirts
                </TextIconLink>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Brands shown in `HomeQualityBrands` (one-row marquee). Full `HOME_QUALITY_BRANDS` is still used
 * for product-card logos (includes American Apparel, Realtree, Shaka Wear, etc.).
 */
const HOME_QUALITY_BRANDS_SHOWCASE_ALTS = new Set([
  'Lane Seven',
  'Valucap',
  'Richardson',
  'Next Level',
  'Bella Canvas',
  'Gildan',
  'Comfort Colors',
  'Oakley',
  'Independent Trading Co.',
  'Hanes',
]);

const HOME_QUALITY_BRANDS_SHOWCASE = HOME_QUALITY_BRANDS.filter((b) =>
  HOME_QUALITY_BRANDS_SHOWCASE_ALTS.has(b.alt),
);

function HomeQualityBrands() {
  const brands = HOME_QUALITY_BRANDS_SHOWCASE;

  return (
    <section className="home-brands" aria-labelledby="home-brands-heading">
      <div className="home-brands-inner">
        <div className="home-brands-panel">
          <div className="home-brands-copy">
            <h2 id="home-brands-heading" className="home-brands-title">
              Shop Quality Blanks
            </h2>
            <p className="home-brands-lede">
              From everyday staples to premium fleece—we carry the brands decorators trust, so you can stock and price with confidence.
            </p>
            <SolidButton
              to={`/collections/${ALL_PRODUCTS_COLLECTION_HANDLE}`}
              prefetch="intent"
              icon={<ArrowRight className="button-icon" size={18} aria-hidden />}
            >
              Shop all brands
            </SolidButton>
          </div>
          <div
            className="home-brands-logos home-brands-marquee"
            aria-label="Featured brands"
          >
            <div className="home-brands-marquee-viewport">
              <div className="home-brands-marquee-track">
                <div className="home-brands-marquee-set">
                  {brands.map(({ imageUrl, alt, to }) => (
                    <Link
                      key={`marquee-a-${to}`}
                      to={to}
                      className="home-brand-tile home-brand-tile--image home-brand-tile--marquee"
                      prefetch="intent"
                    >
                      <img
                        className="home-brand-tile-img"
                        src={imageUrl}
                        alt={alt}
                        loading="lazy"
                        decoding="async"
                        width={256}
                        height={256}
                      />
                    </Link>
                  ))}
                </div>
                <div className="home-brands-marquee-set" aria-hidden="true">
                  {brands.map(({ imageUrl, alt, to }) => (
                    <Link
                      key={`marquee-b-${to}`}
                      tabIndex={-1}
                      to={to}
                      className="home-brand-tile home-brand-tile--image home-brand-tile--marquee"
                      prefetch="intent"
                    >
                      <img
                        className="home-brand-tile-img"
                        src={imageUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        width={256}
                        height={256}
                      />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * @param {{
 *   collection: FeaturedCollectionFragment;
 *   siblingColorData?: Record<string, { count: number; swatchHexes: string[] }>;
 * }}
 */
function HomeFeaturedBlanks({ collection, siblingColorData }) {
  if (!collection?.products?.nodes?.length) return null;

  const products = collection.products.nodes.slice(0, 5);
  const pills = [
    { to: '/collections/t-shirts', label: 'T-Shirts' },
    { to: '/collections/hoodies', label: 'Hoodies' },
    { to: '/collections/sweatshirts', label: 'Sweatshirts' },
    { to: '/collections/long-sleeve-t-shirts', label: 'Long sleeve' },
  ];

  return (
    <section className="home-featured" aria-labelledby="home-featured-heading">
      <div className="home-featured-inner">
        <header className="home-featured-header">
          <h2 id="home-featured-heading" className="home-featured-title">
            Premium wholesale blanks, ready for your vision
          </h2>
          <p className="home-featured-sub">
            High-quality blank apparel with straightforward pricing—your canvas for
            decoration, printing, and retail.
          </p>
        </header>
        <nav className="home-featured-pills" aria-label="Browse categories">
          {pills.map((p) => (
            <OutlineButton
              key={p.to}
              to={p.to}
              prefetch="intent"
              compact
              icon={<ArrowUpRight className="button-icon" size={16} aria-hidden />}
            >
              {p.label}
            </OutlineButton>
          ))}
          <SolidButton
            to={`/collections/${ALL_PRODUCTS_COLLECTION_HANDLE}`}
            prefetch="intent"
            compact
            icon={<ArrowUpRight className="button-icon" size={16} aria-hidden />}
          >
            Browse full catalog
          </SolidButton>
        </nav>
      </div>
      <div className="home-featured-grid-bleed">
        <div className="home-featured-grid">
          {products.map((product) => (
            <HomeFeaturedProductCard
              key={product.id}
              product={product}
              siblingColorData={siblingColorData?.[product.id]}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function HomeStatsStrip() {
  const items = [
    { label: 'Wholesale pricing', detail: 'Margins you can build on' },
    { label: 'Fast turnaround', detail: 'In-stock orders ship quickly' },
    { label: 'No minimum order quantity', detail: 'Order what you need' },
    { label: '999+ styles', detail: 'Core blanks & seasonal drops' },
  ];
  return (
    <section className="home-stats" aria-label="At a glance">
      <ul className="home-stats-list">
        {items.map((item) => (
          <li key={item.label} className="home-stats-item">
            <span className="home-stats-label">{item.label}</span>
            <span className="home-stats-detail">{item.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function HomeBrowseCategories() {
  const links = [
    { to: '/collections/t-shirts', label: 'T-Shirts', Icon: Shirt },
    { to: '/collections/sweatshirts', label: 'Sweatshirts', Icon: ShirtIcon },
    { to: '/collections/hoodies', label: 'Hoodies', Icon: ShirtIcon },
    { to: '/collections/blank-accessories', label: 'Accessories', Icon: ShoppingBag },
  ];
  return (
    <section className="home-categories" aria-labelledby="home-categories-heading">
      <div className="home-categories-header">
        <h2 id="home-categories-heading" className="home-section-title">
          Browse by category
        </h2>
        <p className="home-section-sub">
          Jump straight into the blanks you need—same great pricing across the board.
        </p>
      </div>
      <div className="home-categories-grid">
        {links.map(({ to, label, Icon }) => (
          <Link key={to} to={to} className="home-category-card" prefetch="intent">
            <Icon className="home-category-icon" size={26} aria-hidden />
            <span className="home-category-label">{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function HomeValueProps() {
  const cards = [
    {
      title: 'Pricing that competes',
      body: 'Wholesale rates structured so you can quote jobs confidently and protect your margin on every order.',
      Icon: DollarSign,
      iconVariant: 'sky',
    },
    {
      title: 'Turnaround you can plan around',
      body: 'In-stock items move fast—so you can hit production dates and keep your clients happy.',
      Icon: Truck,
      iconVariant: 'mint',
    },
    {
      title: 'Real humans when you need them',
      body: "Can't find a color, size run, or brand line? Reach out—we'll help you source it or point you to the closest match.",
      Icon: MessageCircle,
      iconVariant: 'lilac',
    },
  ];
  return (
    <section className="home-value" aria-labelledby="home-value-heading">
      <div className="home-value-inner">
        <h2 id="home-value-heading" className="home-value-title">
          Why shops buy from us
        </h2>
        <p className="home-value-lede">
          Less friction from cart to production—so you can focus on the work that pays.
        </p>
        <ul className="home-value-grid">
          {cards.map(({ title, body, Icon, iconVariant }) => (
            <li key={title} className="home-value-item">
              <div className="home-value-item-card">
                <div
                  className={`home-dtf-item-icon home-dtf-item-icon--${iconVariant}`}
                  aria-hidden
                >
                  <Icon size={22} strokeWidth={2} />
                </div>
                <h3 className="home-value-item-title">{title}</h3>
                <p className="home-value-item-body">{body}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="home-value-footnote-block">
          <div className="home-value-footnote-rule" aria-hidden="true" />
          <div className="home-value-footnote">
            <Clock size={18} aria-hidden />
            <span>
              Order timing and cutoffs can vary by SKU—see product pages or ask us for your
              project timeline.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

const COLLECTION_HERO_FEATURES = [
  {
    Icon: Truck,
    title: 'Next-day',
    sub: 'delivery',
  },
  {
    Icon: Gem,
    title: 'Free shipping',
    sub: 'on $50+',
  },
  {
    Icon: DollarSign,
    title: 'Bulk Discounts',
    sub: null,
  },
  {
    Icon: CircleMinus,
    title: 'No minimums',
    sub: null,
  },
];

function collectionHeroDefaultDescription(collectionTitle) {
  const t = collectionTitle.trim();
  const lower = t.toLowerCase();
  return `Looking for high-quality blank ${lower}? Whether you're printing custom designs for your business, starting a brand, or working on a DIY project, we've got the wholesale ${lower} for you.`;
}

/**
 * Collection page hero — left copy, right 2×2 feature cards (matches site UI).
 * @param {{ collection: { title: string; description?: string | null } }}
 */
export function CollectionBanner({ collection }) {
  const title = `Blank ${collection.title} at Wholesale Prices`;
  const description =
    collection.description && String(collection.description).trim()
      ? collection.description
      : collectionHeroDefaultDescription(collection.title);

  return (
    <div className="homepage-banner collection-hero">
      <div className="collection-hero-inner">
        <div className="collection-hero-copy">
          <h1 className="collection-hero-title">{title}</h1>
          <p className="collection-hero-lede">{description}</p>
        </div>
        <ul className="collection-hero-grid" role="list">
          {COLLECTION_HERO_FEATURES.map(({ Icon, title: ft, sub }) => (
            <li key={ft} className="collection-hero-card">
              <div className="collection-hero-card-icon" aria-hidden>
                <Icon className="collection-hero-card-icon-svg" size={20} strokeWidth={2} />
              </div>
              <div className="collection-hero-card-text">
                <span className="collection-hero-card-line">{ft}</span>
                {sub ? (
                  <span className="collection-hero-card-line">{sub}</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Top 5 from the featured collection (manual sort), tags + variants for swatches. */
const FEATURED_SHOWCASE_COLLECTION_QUERY = `#graphql
  fragment ProductItem on Product {
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
  fragment ProductShowcase on Product {
    ...ProductItem
    variants(first: 250) {
      nodes {
        selectedOptions {
          name
          value
        }
      }
    }
  }
  fragment ShowcaseCollection on Collection {
    id
    title
    handle
    products(first: 5, sortKey: MANUAL) {
      nodes {
        ...ProductShowcase
      }
    }
  }
  query FeaturedShowcaseCollection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      ...ShowcaseCollection
    }
  }
`;

/** @typedef {import('./+types/_index').Route} Route */
/** @typedef {import('storefrontapi.generated').FeaturedCollectionFragment} FeaturedCollectionFragment */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
