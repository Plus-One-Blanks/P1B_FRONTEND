import { Link } from 'react-router';
import { Image, Money } from '@shopify/hydrogen';
import { useVariantUrl } from '~/lib/variants';

/**
 * @param {{
 *   product:
 *     | CollectionItemFragment
 *     | ProductItemFragment
 *     | ProductItemCollectionFragment
 *     | RecommendedProductFragment;
 *   loading?: 'eager' | 'lazy';
 * }}
 */
export function ProductItem({ product, loading }) {
  const variantUrl = useVariantUrl(product.handle);
  const image = product.featuredImage;
  const price = product.priceRange?.minVariantPrice;
  const vendor = product.vendor || '';

  // Format price for display
  const priceAmount = price?.amount ? parseFloat(price.amount) : 0;
  const formattedPrice = priceAmount.toFixed(2);

  // Extract material/weight info from description
  const extractProductDetails = (description) => {
    if (!description) return null;

    // Remove HTML tags
    const textOnly = description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    // Look for patterns like "Cotton 5.3 oz", "5.3 oz", "Cotton", etc.
    // Try to find weight/fabric combinations
    const patterns = [
      /(\d+\.?\d*\s*oz\.?\s*(?:T-Shirt|Sweatshirt|Hoodie|Fleece|Crewneck)?)/i,
      /(Cotton\s+\d+\.?\d*\s*oz\.?)/i,
      /(\d+\.?\d*\s*oz\.?\s*Cotton)/i,
      /(Cotton\/Poly\s+\d+\.?\d*\s*oz\.?)/i,
      /(\d+\.?\d*\s*oz\.?)/,
      /(Cotton\s+\d+%?)/i,
      /(Polyester\s+\d+%?)/i,
    ];

    for (const pattern of patterns) {
      const match = textOnly.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    // Fallback: look for common fabric/material terms
    const fabricTerms = ['Cotton', 'Polyester', 'Fleece', 'Jersey', 'Heather', 'Tri-Blend'];
    for (const term of fabricTerms) {
      if (textOnly.includes(term)) {
        const context = textOnly.substring(
          Math.max(0, textOnly.indexOf(term) - 20),
          Math.min(textOnly.length, textOnly.indexOf(term) + 40)
        );
        return context.trim();
      }
    }

    return null;
  };

  const productDetails = extractProductDetails(product.description);

  // Reviews functionality - disabled for now, can be re-enabled later
  // const { rating, reviewCount } = getReviewData();
  // const filledStars = Math.round(rating);
  const reviewCount = 0; // Temporarily disabled

  return (
    <Link
      className="product-item"
      key={product.id}
      prefetch="intent"
      to={variantUrl}
    >
      {image && (
        <div className="product-item-image">
          <Image
            alt={image.altText || product.title}
            data={image}
            loading={loading}
            sizes="(min-width: 45em) 400px, 100vw"
          />
        </div>
      )}
      <div className="product-item-content">
        <div className="product-item-pricing">
          <div className="product-item-pricing-left">
            <div className="product-item-starting-at">starting at</div>
            <div className="product-item-price">${formattedPrice}</div>
          </div>
          {vendor && (
            <div className="product-item-brand">{vendor}</div>
          )}
        </div>

        {reviewCount > 0 && (
          <div className="product-item-ratings">
            <div className="product-item-stars">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill={i < filledStars ? "#FFD700" : "#E5E7EB"}
                  stroke="none"
                >
                  <path d="M8 0l2.5 5.1L16 5.9l-4 3.9 1 5.8L8 13.1l-5 2.5 1-5.8L0 5.9l5.5-.8L8 0z" />
                </svg>
              ))}
            </div>
            <span className="product-item-review-count">({reviewCount})</span>
          </div>
        )}

        <div className="product-item-delivery">
          <div className="product-item-delivery-label">Earliest Delivery</div>
          <div className="product-item-delivery-date">Tuesday, Jan 6</div>
        </div>

        <div className="product-item-title">
          {product.title?.includes('-')
            ? product.title.substring(0, product.title.lastIndexOf('-')).trim()
            : product.title}
        </div>
      </div>
      {productDetails && (
        <div className="product-item-details">{productDetails}</div>
      )}
    </Link>
  );
}

/** @typedef {import('storefrontapi.generated').ProductItemFragment} ProductItemFragment */
/** @typedef {import('storefrontapi.generated').ProductItemCollectionFragment} ProductItemCollectionFragment */
/** @typedef {import('storefrontapi.generated').CollectionItemFragment} CollectionItemFragment */
/** @typedef {import('storefrontapi.generated').RecommendedProductFragment} RecommendedProductFragment */
