import { useOptimisticCart } from '@shopify/hydrogen';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { useAside } from '~/components/Aside';
import { CartLineItem } from '~/components/CartLineItem';
import { groupCartLinesForPageDisplay } from '~/lib/cartEditSizes';
import { CartSummary } from './CartSummary';

/**
 * The main cart component that displays the cart items and summary.
 * It is used by both the /cart route and the cart aside dialog.
 * @param {CartMainProps}
 */
export function CartMain({ layout, cart: originalCart }) {
  const cart = useOptimisticCart(originalCart);
  const { close } = useAside();

  const pageGroups = useMemo(
    () => groupCartLinesForPageDisplay(cart?.lines?.nodes ?? []),
    [cart?.lines?.nodes],
  );

  const linesCount = Boolean(cart?.lines?.nodes?.length || 0);
  const withDiscount =
    cart && Boolean(cart?.discountCodes?.filter((code) => code.applicable)?.length);
  const className = `cart-main ${layout === 'page' ? 'cart-main--page' : ''} ${withDiscount ? 'with-discount' : ''}`;
  const cartHasItems = cart?.totalQuantity ? cart.totalQuantity > 0 : false;
  const totalQuantity = cart?.totalQuantity || 0;

  if (layout === 'aside') {
    return (
      <div className="cart-aside-wrapper">
        <div className="cart-aside-content">
          <div className="cart-aside-header">
            <h3 className="cart-aside-title">SHOPPING CART ({totalQuantity})</h3>
            <button className="cart-aside-close" onClick={close} aria-label="Close">
              ×
            </button>
          </div>
          <div className={className}>
            <CartEmpty hidden={linesCount} layout={layout} />
            <div className="cart-details">
              <div className="cart-lines-container" aria-labelledby="cart-lines">
                <ul className="cart-lines-list">
                  {(cart?.lines?.nodes ?? []).map((line) => (
                    <CartLineItem key={line.id} line={line} layout={layout} cart={cart} />
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {cartHasItems && (
          <div className="cart-summary-footer">
            <CartSummary cart={cart} layout={layout} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      {!linesCount ? (
        <header className="cart-page-header">
          <h1 className="cart-page-title" id="cart-page-heading">
            Cart{totalQuantity > 0 ? ` (${totalQuantity})` : ''}
          </h1>
        </header>
      ) : null}

      <CartEmpty hidden={linesCount} layout={layout} />

      {linesCount ? (
        <>
          <div className="cart-page-layout">
            <div className="cart-page-left">
              <h1 className="cart-page-title" id="cart-page-heading">
                Cart{totalQuantity > 0 ? ` (${totalQuantity})` : ''}
              </h1>
              <div className="cart-page-main">
                <div className="cart-page-lines-card">
                  <ul
                    className="cart-lines-list cart-lines-list--page"
                    id="cart-lines"
                    aria-label="Cart line items"
                  >
                    {pageGroups.map((group) => (
                      <CartLineItem
                        key={group.map((l) => l.id).join('::')}
                        layout="page"
                        lines={group}
                        cart={cart}
                      />
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            <aside className="cart-page-sidebar" aria-labelledby="cart-summary">
              <CartSummary cart={cart} layout={layout} />
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * @param {{
 *   hidden: boolean;
 *   layout?: CartMainProps['layout'];
 * }}
 */
function CartEmpty({ hidden = false, layout }) {
  const { close } = useAside();
  return (
    <div hidden={hidden} className={layout === 'page' ? 'cart-page-empty' : undefined}>
      <p className="cart-page-empty-text">
        Looks like you haven&rsquo;t added anything yet. Let&rsquo;s get you started.
      </p>
      <Link className="cart-page-empty-cta" to="/collections" onClick={close} prefetch="viewport">
        Continue shopping
      </Link>
    </div>
  );
}

/** @typedef {'page' | 'aside'} CartLayout */
/**
 * @typedef {{
 *   cart: CartApiQueryFragment | null;
 *   layout: CartLayout;
 * }} CartMainProps
 */

/** @typedef {import('storefrontapi.generated').CartApiQueryFragment} CartApiQueryFragment */
