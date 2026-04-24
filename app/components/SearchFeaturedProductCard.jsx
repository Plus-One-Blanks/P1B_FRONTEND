import {Link} from 'react-router';
import {Image, Money} from '@shopify/hydrogen';
import {urlWithTrackingParams} from '~/lib/search';
import {resolveBrandLogoFromVendorAndTags} from '~/lib/featuredProductCard';

/**
 * Compact featured-style tile for the search drawer (Storefront collection / variant shape).
 *
 * @param {{
 *   product: {
 *     id: string;
 *     handle: string;
 *     title: string;
 *     vendor?: string | null;
 *     trackingParameters?: string | null;
 *     selectedOrFirstAvailableVariant?: {
 *       image?: {
 *         url: string;
 *         altText?: string | null;
 *         width?: number | null;
 *         height?: number | null;
 *       } | null;
 *       price?: import('@shopify/hydrogen').MoneyV2;
 *     } | null;
 *   };
 *   term: React.MutableRefObject<string>;
 *   onNavigate?: () => void;
 *   imageLoading?: 'eager' | 'lazy';
 * }}
 */
export function SearchFeaturedProductCard({
  product,
  term,
  onNavigate,
  imageLoading = 'lazy',
}) {
  const productUrl = urlWithTrackingParams({
    baseUrl: `/products/${product.handle}`,
    trackingParams: product.trackingParameters,
    term: term.current,
  });
  const variant = product.selectedOrFirstAvailableVariant;
  const image = variant?.image;
  const price = variant?.price;
  const vendor = product.vendor || '';
  const brandLogo = resolveBrandLogoFromVendorAndTags(product.vendor, undefined);

  return (
    <Link
      to={productUrl}
      className="search-featured-card"
      prefetch="intent"
      onClick={onNavigate}
    >
      <div className="search-featured-card-image">
        {image?.url ? (
          <Image
            alt={image.altText ?? product.title}
            src={image.url}
            width={image.width ?? 240}
            height={image.height ?? 240}
            loading={imageLoading}
            sizes="(min-width: 48em) 12vw, 28vw"
          />
        ) : (
          <div className="search-featured-card-placeholder" aria-hidden />
        )}
      </div>
      <h3 className="search-featured-card-title">{product.title}</h3>
      {vendor ? (
        <p className="search-featured-card-meta">
          <span>{vendor}</span>
        </p>
      ) : null}
      <div className="search-featured-card-price-row">
        <p className="search-featured-card-price">
          From {price ? <Money data={price} /> : null}
        </p>
        {brandLogo ? (
          <div
            className="search-featured-card-brand-wrap"
            title={brandLogo.alt}
            aria-hidden="true"
          >
            <img
              className="search-featured-card-brand-logo"
              src={brandLogo.imageUrl}
              alt=""
              width={72}
              height={34}
              loading="lazy"
              decoding="async"
            />
          </div>
        ) : null}
      </div>
    </Link>
  );
}

/**
 * @param {{
 *   products: Parameters<typeof SearchFeaturedProductCard>[0]['product'][];
 *   term: React.MutableRefObject<string>;
 *   closeSearch?: () => void;
 *   heading?: string;
 * }}
 */
export function SearchFeaturedProductGrid({
  products,
  term,
  closeSearch,
  heading = 'Products',
}) {
  if (!products.length) return null;

  return (
    <div className="search-featured-product-block">
      {heading ? (
        <h3 className="search-featured-product-block-title">{heading}</h3>
      ) : null}
      <ul className="search-featured-grid">
        {products.map((product, index) => (
          <li key={product.id} className="search-featured-grid-item">
            <SearchFeaturedProductCard
              product={product}
              term={term}
              onNavigate={closeSearch}
              imageLoading={index < 4 ? 'eager' : 'lazy'}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
