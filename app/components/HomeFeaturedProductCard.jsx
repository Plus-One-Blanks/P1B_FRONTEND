import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Image, Money } from '@shopify/hydrogen';
import { useVariantUrl } from '~/lib/variants';
import {
  getColorValuesForProduct,
  getFeaturedCardSwatchColor,
  isLightSwatchHex,
  resolveBrandLogoFromVendorAndTags,
} from '~/lib/featuredProductCard';

const DEFAULT_MAX_SWATCH_DOTS = 8;

/** @param {string} query */
function useMatchMedia(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/**
 * @param {{
 *   product: {
 *     id: string;
 *     handle: string;
 *     title: string;
 *     vendor?: string | null;
 *     tags?: string[];
 *     featuredImage?: import('@shopify/hydrogen').ImageType | null;
 *     priceRange?: { minVariantPrice?: import('@shopify/hydrogen').MoneyV2 };
 *     options?: Array<{ name: string; values: string[] }>;
 *     variants?: { nodes?: Array<{ selectedOptions?: Array<{ name: string; value: string }> }> };
 *   };
 *   siblingColorData?: { count: number; swatchHexes: string[] };
 *   imageLoading?: 'eager' | 'lazy';
 *   swatchLimitNarrow?: number;
 * }}
 */
export function HomeFeaturedProductCard({
  product,
  siblingColorData,
  imageLoading = 'lazy',
  swatchLimitNarrow,
}) {
  const variantUrl = useVariantUrl(product.handle, undefined, product.tags);
  const image = product.featuredImage;
  const price = product.priceRange?.minVariantPrice;
  const vendor = product.vendor || '';
  const brandLogo = resolveBrandLogoFromVendorAndTags(
    product.vendor,
    product.tags,
  );
  const colorValues = getColorValuesForProduct(product);
  const colorCount =
    typeof siblingColorData?.count === 'number' && siblingColorData.count > 0
      ? siblingColorData.count
      : colorValues.length;
  const isNarrowViewport = useMatchMedia('(max-width: 1024px)');
  const maxDots =
    swatchLimitNarrow != null && isNarrowViewport
      ? swatchLimitNarrow
      : DEFAULT_MAX_SWATCH_DOTS;
  const shown = Array.from({ length: Math.min(maxDots, colorCount) });
  const overflow = Math.max(0, colorCount - maxDots);

  return (
    <Link to={variantUrl} className="home-featured-card" prefetch="intent">
      <div className="home-featured-card-image">
        {image ? (
          <Image
            data={image}
            alt={image.altText || product.title}
            sizes="(min-width: 64em) min(19vw, 420px), (min-width: 45em) 45vw, 88vw"
            loading={imageLoading}
          />
        ) : (
          <div className="home-featured-card-placeholder" aria-hidden />
        )}
      </div>
      {colorCount > 0 && (
        <div className="home-featured-swatches" aria-hidden>
          {shown.map((_, i) => {
            const bg = getFeaturedCardSwatchColor(i, siblingColorData, product);
            const light = isLightSwatchHex(bg);
            return (
              <span
                key={i}
                className={`home-featured-swatch${light ? ' home-featured-swatch--light' : ''}`}
                style={{ background: bg }}
              />
            );
          })}
          {overflow > 0 && (
            <span className="home-featured-swatch-more">+{overflow}</span>
          )}
        </div>
      )}
      <h3 className="home-featured-card-title">{product.title}</h3>
      {(vendor || colorCount > 0) && (
        <p className="home-featured-meta">
          {vendor ? <span>{vendor}</span> : null}
          {vendor && colorCount > 0 ? (
            <span className="home-featured-meta-sep">|</span>
          ) : null}
          {colorCount > 0 ? (
            <span>
              {colorCount}{' '}
              {colorCount === 1 ? 'color' : 'colors'}
            </span>
          ) : null}
        </p>
      )}
      <div className="home-featured-price-row">
        <p className="home-featured-price">
          From {price ? <Money data={price} /> : null}
        </p>
        {brandLogo ? (
          <div
            className="home-featured-brand-logo-wrap"
            title={brandLogo.alt}
            aria-hidden="true"
          >
            <img
              className="home-featured-brand-logo"
              src={brandLogo.imageUrl}
              alt=""
              width={125}
              height={58}
              loading="lazy"
              decoding="async"
            />
          </div>
        ) : null}
      </div>
    </Link>
  );
}
