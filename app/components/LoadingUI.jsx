import {useLocation, useNavigation} from 'react-router';

/**
 * Apparel PDP paths (blank + decorated).
 * @param {string | null | undefined} pathname
 */
export function isApparelProductPath(pathname) {
  const p = String(pathname || '');
  return (
    /\/products\/[^/]+/.test(p) || /\/decorated-products\/[^/]+/.test(p)
  );
}

/**
 * True while navigating to a different apparel PDP (hide stale product UI).
 */
export function useApparelProductNavPending() {
  const navigation = useNavigation();
  const location = useLocation();
  return (
    navigation.state === 'loading' &&
    Boolean(navigation.location) &&
    isApparelProductPath(navigation.location.pathname) &&
    navigation.location.pathname !== location.pathname
  );
}

/**
 * True while navigating to /cart (hide stale cart page).
 */
export function useCartPageNavPending() {
  const navigation = useNavigation();
  const location = useLocation();
  const next = navigation.location?.pathname || '';
  return (
    navigation.state === 'loading' &&
    /\/cart\/?$/.test(next) &&
    location.pathname !== next
  );
}

/**
 * Fade-in wrapper once content is ready.
 * @param {{ children: React.ReactNode; className?: string }}
 */
export function ContentReveal({children, className = ''}) {
  return (
    <div className={`p1-content-reveal${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  );
}

/**
 * Soft shimmer block used by skeletons.
 * @param {{ className?: string; style?: React.CSSProperties }}
 */
function Bone({className = '', style}) {
  return (
    <div
      className={`p1-skeleton-bone${className ? ` ${className}` : ''}`}
      style={style}
      aria-hidden
    />
  );
}

/**
 * Full PDP placeholder — shown until related color data is ready / during nav.
 */
export function ProductPageSkeleton() {
  return (
    <div
      className="p1-product-skeleton"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading product"
    >
      <span className="visually-hidden">Loading product…</span>
      <div className="p1-product-skeleton-grid">
        <div className="p1-product-skeleton-media">
          <Bone className="p1-product-skeleton-image" />
        </div>
        <div className="p1-product-skeleton-main">
          <Bone className="p1-product-skeleton-title" />
          <Bone className="p1-product-skeleton-price" />
          <Bone className="p1-product-skeleton-swatches" />
          <div className="p1-product-skeleton-sizes">
            {Array.from({length: 6}).map((_, i) => (
              <Bone key={i} className="p1-product-skeleton-size" />
            ))}
          </div>
          <Bone className="p1-product-skeleton-cta" />
        </div>
      </div>
    </div>
  );
}

/**
 * Cart drawer / page placeholder.
 * @param {{ layout?: 'aside' | 'page' }}
 */
export function CartSkeleton({layout = 'aside'}) {
  const isPage = layout === 'page';
  return (
    <div
      className={`p1-cart-skeleton${isPage ? ' p1-cart-skeleton--page' : ' p1-cart-skeleton--aside'}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading cart"
    >
      <span className="visually-hidden">Loading cart…</span>
      {isPage ? (
        <div className="p1-cart-skeleton-page-layout">
          <div className="p1-cart-skeleton-page-left">
            <Bone className="p1-cart-skeleton-heading" />
            {Array.from({length: 3}).map((_, i) => (
              <div key={i} className="p1-cart-skeleton-line">
                <Bone className="p1-cart-skeleton-thumb" />
                <div className="p1-cart-skeleton-line-copy">
                  <Bone className="p1-cart-skeleton-line-title" />
                  <Bone className="p1-cart-skeleton-line-meta" />
                </div>
              </div>
            ))}
          </div>
          <div className="p1-cart-skeleton-page-side">
            <Bone className="p1-cart-skeleton-summary" />
          </div>
        </div>
      ) : (
        <>
          <div className="p1-cart-skeleton-aside-header">
            <Bone className="p1-cart-skeleton-heading" />
          </div>
          <div className="p1-cart-skeleton-aside-body">
            {Array.from({length: 3}).map((_, i) => (
              <div key={i} className="p1-cart-skeleton-line">
                <Bone className="p1-cart-skeleton-thumb" />
                <div className="p1-cart-skeleton-line-copy">
                  <Bone className="p1-cart-skeleton-line-title" />
                  <Bone className="p1-cart-skeleton-line-meta" />
                </div>
              </div>
            ))}
          </div>
          <div className="p1-cart-skeleton-aside-footer">
            <Bone className="p1-cart-skeleton-summary" />
          </div>
        </>
      )}
    </div>
  );
}
