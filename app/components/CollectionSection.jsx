import { TextIconLink } from '~/components/TextIconLink';
import { HomeFeaturedProductCard } from '~/components/HomeFeaturedProductCard';

/**
 * @param {{
 *   title: string;
 *   shopAllLabel: string;
 *   collection: FeaturedCollectionLike;
 *   siblingColorDataByProductId?: Record<string, { count: number; swatchHexes: string[] }>;
 * }}
 */
export function CollectionSection({
  title,
  shopAllLabel,
  collection,
  siblingColorDataByProductId,
}) {
  if (!collection) return null;

  const headingId = `collection-section-${collection.handle}`;
  const products = collection.products?.nodes?.slice(0, 5) ?? [];

  return (
    <section
      className="collection-section"
      aria-labelledby={headingId}
    >
      <div className="collection-section-inset">
        <div className="collection-section-header">
          <h2 id={headingId} className="collection-section-title">
            {title}
          </h2>
          <div className="collection-section-header-trail">
            <div className="collection-section-separator" aria-hidden>
              |
            </div>
            <TextIconLink
              to={`/collections/${collection.handle}`}
              className="collection-section-shop-link"
              prefetch="intent"
            >
              {shopAllLabel}
            </TextIconLink>
          </div>
        </div>
        {collection.description ? (
          <p className="collection-section-description">
            {collection.description}
          </p>
        ) : null}
        {products.length > 0 ? (
          <div className="home-featured-grid collection-section-grid">
            {products.map((product) => (
              <HomeFeaturedProductCard
                key={product.id}
                product={product}
                siblingColorData={siblingColorDataByProductId?.[product.id]}
              />
            ))}
          </div>
        ) : (
          <p className="collection-section-empty">No products in this collection.</p>
        )}
      </div>
    </section>
  );
}

/**
 * Minimal shape needed for this component (homepage & collections index loaders).
 * @typedef {{
 *   handle: string;
 *   description?: string | null;
 *   products?: { nodes?: Array<unknown> } | null;
 * }} FeaturedCollectionLike
 */
