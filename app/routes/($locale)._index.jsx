import { useEffect, useState } from 'react';
import { Link, useLoaderData } from 'react-router';
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
import {
  FEATURED_COLLECTION_QUERY,
  loadDecoratedCategorySnippetCollections,
  loadFiveCategorySnippetCollections,
} from '~/lib/categoryCollectionSnippets.server';
import { ALL_PRODUCTS_COLLECTION_HANDLE } from '~/lib/searchDrawerCollection';
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  CircleMinus,
  Clock,
  DollarSign,
  Gem,
  Layers,
  MessageCircle,
  Palette,
  ShieldCheck,
  Truck,
  Upload,
  Zap,
} from 'lucide-react';

/** Homepage hero carousel — Shopify Files CDN. */
const HOME_HERO_SLIDES = [
  {
    src: 'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/Custom_T-Shirts.jpg?v=1775170712',
    alt: 'Custom printed t-shirts',
  },
  {
    src: 'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/Custom_Shirts.jpg?v=1775170712',
    alt: 'Custom shirts and decorated apparel',
  },
  {
    src: 'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/Embroidery_Machines.jpg?v=1775170712',
    alt: 'Embroidery machines in a production facility',
  },
  {
    src: 'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/Hanging_T-Shirts.jpg?v=1775170712',
    alt: 'Hanging blank t-shirts ready for production',
  },
  {
    src: 'https://cdn.shopify.com/s/files/1/0687/9952/9091/files/Warehoused_Products.jpg?v=1775170712',
    alt: 'Warehoused apparel and blanks inventory',
  },
];

const DECORATED_TSHIRTS_PATH = '/collections/t-shirts-decorated';

/** Homepage “Popular decorated styles” grid — manual sort in Shopify Admin. */
const FEATURED_DECORATED_PRODUCT_COLLECTION_HANDLE =
  'featured-decorated-product';

/**
 * Shopify Admin collection used for the homepage process spotlight card.
 * https://admin.shopify.com/store/plus-1-blanks/collections/451883663491
 */
const WORKFLOW_SPOTLIGHT_COLLECTION_ID = 'gid://shopify/Collection/451883663491';

/** Prefer this style in the spotlight when present in the collection. */
const WORKFLOW_SPOTLIGHT_PRODUCT_HINT = 'ls16005';

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{ title: 'Plus 1 Blanks | Custom decorated apparel' }];
};

/**
 * @param {Route.LoaderArgs} args
 */
export async function loader(args) {
  const deferredData = loadDeferredData(args);
  const criticalData = await loadCriticalData(args);
  return { ...deferredData, ...criticalData };
}

/**
 * @param {Route.LoaderArgs}
 */
async function loadCriticalData({ context }) {
  const {storefront} = context;
  const [
    blankSnippets,
    decoratedSnippets,
    spotlightResult,
    featuredDecoratedResult,
  ] = await Promise.all([
    loadFiveCategorySnippetCollections(storefront),
    loadDecoratedCategorySnippetCollections(storefront),
    storefront.query(WORKFLOW_SPOTLIGHT_COLLECTION_QUERY, {
      cache: storefront.CacheLong(),
      variables: {id: WORKFLOW_SPOTLIGHT_COLLECTION_ID},
    }),
    storefront.query(FEATURED_COLLECTION_QUERY, {
      cache: storefront.CacheLong(),
      variables: {handle: FEATURED_DECORATED_PRODUCT_COLLECTION_HANDLE},
    }),
  ]);

  const spotlightCollection = spotlightResult?.collection || null;
  const spotlightNodes = spotlightCollection?.products?.nodes ?? [];
  const spotlightProduct =
    spotlightNodes.find((p) =>
      String(p?.handle || p?.title || '')
        .toLowerCase()
        .includes(WORKFLOW_SPOTLIGHT_PRODUCT_HINT),
    ) ||
    spotlightNodes[0] ||
    null;

  const featuredDecoratedCollection =
    featuredDecoratedResult?.collection ||
    decoratedSnippets.decoratedTshirtsCollection ||
    null;

  const productsForSiblingColors = [];
  const seenSiblingProductId = new Set();
  for (const p of [
    ...(spotlightProduct ? [spotlightProduct] : []),
    ...(featuredDecoratedCollection?.products?.nodes ?? []),
    ...decoratedSnippets.sectionProductsForSiblingColors,
    ...blankSnippets.sectionProductsForSiblingColors,
  ]) {
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
    featuredDecoratedCollection,
    decoratedTshirtsCollection:
      decoratedSnippets.decoratedTshirtsCollection || null,
    decoratedSweatshirtsCollection:
      decoratedSnippets.decoratedSweatshirtsCollection || null,
    decoratedLongSleeveTshirtsCollection:
      decoratedSnippets.decoratedLongSleeveTshirtsCollection || null,
    decoratedPolosCollection:
      decoratedSnippets.decoratedPolosCollection || null,
    decoratedHatsCollection: decoratedSnippets.decoratedHatsCollection || null,
    tshirtsCollection: blankSnippets.tshirtsCollection || null,
    workflowSpotlightCollection: spotlightCollection,
    workflowSpotlightProduct: spotlightProduct,
    productSiblingColorData,
  };
}

/**
 * @param {Route.LoaderArgs}
 */
function loadDeferredData() {
  return {};
}

export default function Homepage() {
  /** @type {LoaderReturnData} */
  const data = useLoaderData();
  const featuredDecorated =
    data.featuredDecoratedCollection?.products?.nodes?.slice(0, 5) ?? [];
  const workflowSpotlight = data.workflowSpotlightProduct ?? null;

  return (
    <div className="home">
      <HomeHero />
      <HomeDecoratedHighlights />
      <HomeDecoratedProcess
        spotlightProduct={workflowSpotlight}
        spotlightSiblingColor={
          workflowSpotlight
            ? data.productSiblingColorData?.[workflowSpotlight.id]
            : undefined
        }
        spotlightCollectionHandle={
          data.workflowSpotlightCollection?.handle || 't-shirts-decorated'
        }
        spotlightCollectionTitle={
          data.workflowSpotlightCollection?.title || 'Decorated T-Shirts'
        }
      />
      {featuredDecorated.length > 0 ? (
        <HomeFeaturedDecorated
          products={featuredDecorated}
          siblingColorData={data.productSiblingColorData}
        />
      ) : null}
      <HomeQualityBrands />
      <HomeGlobalShipping />
      <HomeValueProps />
      <HomeContactCta />

      <div id="home-products" className="home-products-anchor">
        <h2 className="home-value-title">Shop decorated apparel</h2>
        <p className="home-value-lede">
          Pick a style, open Design Studio, and we&apos;ll print your artwork —
          no minimums, with bulk discounts as you grow.
        </p>
      </div>
      {data.decoratedTshirtsCollection && (
        <CollectionSection
          title="Decorated T-Shirts"
          shopAllLabel="Shop all decorated tees"
          collection={data.decoratedTshirtsCollection}
          siblingColorDataByProductId={data.productSiblingColorData}
        />
      )}
      {data.decoratedSweatshirtsCollection && (
        <CollectionSection
          title="Decorated Sweatshirts"
          shopAllLabel="Shop all decorated sweatshirts"
          collection={data.decoratedSweatshirtsCollection}
          siblingColorDataByProductId={data.productSiblingColorData}
        />
      )}
      {data.decoratedLongSleeveTshirtsCollection && (
        <CollectionSection
          title="Decorated Long Sleeves"
          shopAllLabel="Shop all decorated longsleeves"
          collection={data.decoratedLongSleeveTshirtsCollection}
          siblingColorDataByProductId={data.productSiblingColorData}
        />
      )}
      {data.decoratedPolosCollection && (
        <CollectionSection
          title="Decorated Polos"
          shopAllLabel="Shop all decorated polos"
          collection={data.decoratedPolosCollection}
          siblingColorDataByProductId={data.productSiblingColorData}
        />
      )}
      {data.decoratedHatsCollection && (
        <CollectionSection
          title="Decorated Hats"
          shopAllLabel="Shop all decorated hats"
          collection={data.decoratedHatsCollection}
          siblingColorDataByProductId={data.productSiblingColorData}
        />
      )}

      <HomeBlanksTeaser
        collection={data.tshirtsCollection}
        siblingColorData={data.productSiblingColorData}
      />
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
    'No minimum order quantity',
    'Bulk discounts as you scale',
    'Design Studio in a few clicks',
    'Artwork travels with your order',
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
              Custom decorated apparel for teams, shops &amp; brands
            </span>
          </div>

          <h1 id="home-hero-heading" className="home-hero-title">
            Custom decorated apparel, made simple
          </h1>
          <p className="home-hero-lede">
            Choose a garment, upload your logo in Design Studio, and check out —
            we handle the print. No minimums, with bulk pricing when you need
            more.
          </p>

          <div className="home-hero-ctas">
            <SolidButton
              to={DECORATED_TSHIRTS_PATH}
              prefetch="intent"
              icon={<ArrowRight className="button-icon" size={18} aria-hidden />}
            >
              Shop decorated
            </SolidButton>
            <OutlineButton
              to={`/collections/${ALL_PRODUCTS_COLLECTION_HANDLE}`}
              prefetch="intent"
            >
              Browse blank apparel
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

function HomeDecoratedHighlights() {
  const items = [
    {
      title: '100% Quality Guaranteed',
      body: 'We stand behind every decorated order — clear proofs in Design Studio, solid blanks, and no surprise fees.',
      Icon: BadgeCheck,
      iconVariant: 'sky',
    },
    {
      title: 'No Minimums',
      body: 'Order exactly what you need with no minimum quantity — one piece or a full team run.',
      Icon: Layers,
      iconVariant: 'mint',
    },
    {
      title: 'Super Fast Turnaround',
      body: 'In-stock garments move quickly from design to production so you can hit tight timelines.',
      Icon: Zap,
      iconVariant: 'butter',
    },
    {
      title: 'Bulk Discounts',
      body: 'Tiered pricing kicks in as quantities grow, so bigger decorated runs cost less per piece.',
      Icon: DollarSign,
      iconVariant: 'lilac',
    },
    {
      title: 'Easy Design Studio',
      body: 'Upload your logo, place it on the garment, and preview before you buy — all in the browser.',
      Icon: Palette,
      iconVariant: 'blush',
    },
    {
      title: 'Production-Ready Files',
      body: 'Your artwork and placements travel with the order so print locations stay clear for the shop floor.',
      Icon: ShieldCheck,
      iconVariant: 'seafoam',
    },
  ];

  return (
    <section className="home-dtf" aria-labelledby="home-highlights-heading">
      <div className="home-dtf-inner">
        <h2 id="home-highlights-heading" className="home-dtf-title">
          High-Quality Decorated Apparel. No Compromises.
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
            to={DECORATED_TSHIRTS_PATH}
            prefetch="intent"
            icon={<ArrowRight className="button-icon" size={18} aria-hidden />}
          >
            Get decorated goods
          </SolidButton>
        </div>
      </div>
    </section>
  );
}

/**
 * @param {{
 *   spotlightProduct: import('storefrontapi.generated').ProductItemFragment | null;
 *   spotlightSiblingColor?: { count: number; swatchHexes: string[] };
 *   spotlightCollectionHandle?: string;
 *   spotlightCollectionTitle?: string;
 * }}
 */
function HomeDecoratedProcess({
  spotlightProduct,
  spotlightSiblingColor,
  spotlightCollectionHandle = 't-shirts-decorated',
  spotlightCollectionTitle = 'Decorated T-Shirts',
}) {
  const steps = [
    {
      num: '01',
      title: 'Pick your garment',
      body: 'Shop decorated tees, fleece, polos, and hats — the same brands customers already trust.',
    },
    {
      num: '02',
      title: 'Open Design Studio',
      body: 'One click on the product page launches the studio — no separate apps or email threads.',
    },
    {
      num: '03',
      title: 'Upload & place your art',
      body: 'Drop in your logo, clean the background if you need, and place it on chest, back, or more.',
    },
    {
      num: '04',
      title: 'Choose sizes & colors',
      body: 'Add quantities across sizes. No minimums — bulk discounts apply as your order grows.',
    },
    {
      num: '05',
      title: 'Checkout — we print',
      body: 'Your design files travel with the order. We decorate and ship so you can stay focused.',
    },
  ];

  const shopAllPath = `/collections/${spotlightCollectionHandle}`;
  const categoryLabel = String(spotlightCollectionTitle || '')
    .replace(/\s*decorated\s*$/i, '')
    .trim()
    .toLowerCase();

  return (
    <section className="home-workflow" aria-labelledby="home-process-heading">
      <div className="home-workflow-inner">
        <div className="home-workflow-grid">
          <div className="home-workflow-copy">
            <h2 id="home-process-heading" className="home-workflow-title">
              Your design. Our print. Shipped fast.
            </h2>
            <div className="home-workflow-ctas">
              <SolidButton
                to={DECORATED_TSHIRTS_PATH}
                prefetch="intent"
                icon={<ArrowRight className="button-icon" size={18} aria-hidden />}
              >
                Shop decorated
              </SolidButton>
              <OutlineButton
                to={shopAllPath}
                prefetch="intent"
                icon={<Upload className="button-icon" size={18} aria-hidden />}
              >
                Start designing
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
              <div className="home-workflow-visual-copy">
                <p className="home-workflow-visual-eyebrow">Decorated apparel</p>
                <p className="home-workflow-visual-lede">
                  Design in the browser, preview on the blank, then check out —
                  no minimums, bulk pricing as you scale.
                </p>
              </div>
              {spotlightProduct ? (
                <>
                  <HomeWorkflowSpotlightProductCard
                    product={spotlightProduct}
                    siblingColorData={spotlightSiblingColor}
                    imageLoading="eager"
                  />
                  <TextIconLink
                    to={shopAllPath}
                    className="collection-section-shop-link home-workflow-spotlight-link"
                    prefetch="intent"
                  >
                    Shop all {categoryLabel || 'decorated styles'}
                  </TextIconLink>
                </>
              ) : (
                <TextIconLink
                  to={DECORATED_TSHIRTS_PATH}
                  className="collection-section-shop-link home-workflow-spotlight-link"
                  prefetch="intent"
                >
                  Browse decorated tees
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
 * @param {{
 *   products: Array<import('storefrontapi.generated').ProductItemFragment>;
 *   siblingColorData?: Record<string, { count: number; swatchHexes: string[] }>;
 * }}
 */
function HomeFeaturedDecorated({ products, siblingColorData }) {
  const pills = [
    { to: '/collections/t-shirts-decorated', label: 'T-Shirts' },
    { to: '/collections/sweatshirts-decorated', label: 'Sweatshirts' },
    { to: '/collections/polos-decorated', label: 'Polos' },
    { to: '/collections/hats-decorated', label: 'Hats' },
  ];

  return (
    <section className="home-featured" aria-labelledby="home-featured-heading">
      <div className="home-featured-inner">
        <header className="home-featured-header">
          <h2 id="home-featured-heading" className="home-featured-title">
            Popular decorated styles, ready for your logo
          </h2>
          <p className="home-featured-sub">
            High-quality apparel with Design Studio built in — upload your artwork,
            place it on the garment, and order with no minimums. Bulk discounts kick
            in as your run grows, so teams and shops can start small and scale cleanly.
          </p>
        </header>
        <nav className="home-featured-pills" aria-label="Decorated categories">
          <div className="home-featured-pills-row">
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
              to={DECORATED_TSHIRTS_PATH}
              prefetch="intent"
              compact
              icon={<ArrowUpRight className="button-icon" size={16} aria-hidden />}
            >
              Browse decorated catalog
            </SolidButton>
          </div>
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

/**
 * Brands shown in `HomeQualityBrands` (one-row marquee).
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
              Brands customers already trust
            </h2>
            <p className="home-brands-lede">
              Decorate on Comfort Colors, Gildan, Bella + Canvas, and more — the
              same quality blanks shops quote every day.
            </p>
            <SolidButton
              to={DECORATED_TSHIRTS_PATH}
              prefetch="intent"
              icon={<ArrowRight className="button-icon" size={18} aria-hidden />}
            >
              Shop decorated brands
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

function HomeValueProps() {
  const cards = [
    {
      title: 'No minimums, real bulk pricing',
      body: 'Start with a single decorated piece when you need to. Volume discounts step in as your order grows.',
      Icon: DollarSign,
      iconVariant: 'sky',
    },
    {
      title: 'Clear from design to ship',
      body: 'Design Studio captures placement and files so production knows exactly what to print.',
      Icon: Truck,
      iconVariant: 'mint',
    },
    {
      title: 'Help when you need it',
      body: "Can't find a color, size run, or brand line? Reach out — we'll help you source it or point you to the closest match.",
      Icon: MessageCircle,
      iconVariant: 'lilac',
    },
  ];
  return (
    <section className="home-value" aria-labelledby="home-value-heading">
      <div className="home-value-inner">
        <h2 id="home-value-heading" className="home-value-title">
          Why teams order decorated here
        </h2>
        <p className="home-value-lede">
          Less back-and-forth from mockup to carton — so you can focus on the work that pays.
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
              Turnaround can vary by decoration method and quantity — check the
              product page or ask us for your project timeline.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Secondary path for customers who only need undecorated blanks.
 * @param {{
 *   collection: FeaturedCollectionFragment | null;
 *   siblingColorData?: Record<string, { count: number; swatchHexes: string[] }>;
 * }}
 */
function HomeBlanksTeaser({ collection, siblingColorData }) {
  const products = collection?.products?.nodes?.slice(0, 4) ?? [];

  return (
    <section className="home-blanks-teaser" aria-labelledby="home-blanks-teaser-heading">
      <div className="home-blanks-teaser-inner">
        <div className="home-blanks-teaser-copy">
          <p className="home-blanks-teaser-eyebrow">Also available</p>
          <h2 id="home-blanks-teaser-heading" className="home-blanks-teaser-title">
            Need undecorated blanks?
          </h2>
          <p className="home-blanks-teaser-lede">
            Same catalog, undecorated — for shops that print or embroider in-house.
          </p>
          <div className="home-blanks-teaser-ctas">
            <OutlineButton
              to={`/collections/${ALL_PRODUCTS_COLLECTION_HANDLE}`}
              prefetch="intent"
            >
              Shop blank apparel
            </OutlineButton>
            {collection?.handle ? (
              <TextIconLink
                to={`/collections/${collection.handle}`}
                className="collection-section-shop-link"
                prefetch="intent"
              >
                Browse blank t-shirts
              </TextIconLink>
            ) : null}
          </div>
        </div>
        {products.length > 0 ? (
          <div className="home-featured-grid home-blanks-teaser-grid">
            {products.map((product) => (
              <HomeFeaturedProductCard
                key={product.id}
                product={product}
                siblingColorData={siblingColorData?.[product.id]}
              />
            ))}
          </div>
        ) : null}
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

const WORKFLOW_SPOTLIGHT_COLLECTION_QUERY = `#graphql
  fragment WorkflowSpotlightProduct on Product {
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
    variants(first: 250) {
      nodes {
        selectedOptions {
          name
          value
        }
      }
    }
  }
  query WorkflowSpotlightCollection(
    $id: ID!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    collection(id: $id) {
      id
      handle
      title
      products(first: 24, sortKey: MANUAL) {
        nodes {
          ...WorkflowSpotlightProduct
        }
      }
    }
  }
`;

/** @typedef {import('./+types/_index').Route} Route */
/** @typedef {import('storefrontapi.generated').FeaturedCollectionFragment} FeaturedCollectionFragment */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
