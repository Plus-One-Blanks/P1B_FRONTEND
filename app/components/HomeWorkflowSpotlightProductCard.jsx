import { Link } from 'react-router';
import { Image, Money } from '@shopify/hydrogen';
import { useVariantUrl } from '~/lib/variants';
import {
  getColorValuesForProduct,
  getFeaturedCardSwatchColor,
  isLightSwatchHex,
} from '~/lib/featuredProductCard';

/**
 * Compact product teaser for the homepage workflow column: no brand logo,
 * “From” price on the same row as color count (and optional vendor).
 *
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
 * }}
 */
export function HomeWorkflowSpotlightProductCard({
  product,
  siblingColorData,
  imageLoading = 'lazy',
}) {
  const variantUrl = useVariantUrl(product.handle, undefined, product.tags);
  const image = product.featuredImage;
  const price = product.priceRange?.minVariantPrice;
  const vendor = product.vendor || '';
  const colorValues = getColorValuesForProduct(product);
  const colorCount =
    typeof siblingColorData?.count === 'number' && siblingColorData.count > 0
      ? siblingColorData.count
      : colorValues.length;
  const maxDots = 8;
  const shown = Array.from({ length: Math.min(maxDots, colorCount) });
  const overflow = Math.max(0, colorCount - maxDots);
  const showMeta = Boolean(vendor || colorCount > 0);

  return (
    <Link
      to={variantUrl}
      className="home-featured-card home-workflow-spotlight-product-card"
      prefetch="intent"
    >
      <div className="home-featured-card-image">
        {image ? (
          <Image
            data={image}
            alt={image.altText || product.title}
            sizes="(min-width: 960px) min(36vw, 420px), min(90vw, 480px)"
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
      <div
        className={`home-workflow-spotlight-card-footer${showMeta ? '' : ' home-workflow-spotlight-card-footer--price-only'}`}
      >
        {showMeta ? (
          <div className="home-workflow-spotlight-card-footer-meta">
            {vendor ? <span>{vendor}</span> : null}
            {vendor && colorCount > 0 ? (
              <span className="home-workflow-spotlight-card-footer-sep">·</span>
            ) : null}
            {colorCount > 0 ? (
              <span>
                {colorCount} {colorCount === 1 ? 'color' : 'colors'}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="home-workflow-spotlight-card-footer-price">
          <div className="home-workflow-spotlight-card-footer-price-line">
            From {price ? <Money data={price} /> : null}
          </div>
        </div>
      </div>
    </Link>
  );
}
