import { Image, Money } from '@shopify/hydrogen';
import { Link } from 'react-router';
import { groupCartLinesForPageDisplay } from '~/lib/cartEditSizes';
import { readDesignFromLineAttributes } from '~/lib/designOrderAttributes';
import { readGangSheetFromLineAttributes } from '~/lib/dtfGangSheetOrderAttributes';

/**
 * Prefer custom mockup / gang sheet preview over the Shopify product image.
 * @param {{ attributes?: Array<{ key?: string | null; value?: string | null }> | null; merchandise?: { image?: { url?: string | null; altText?: string | null } | null } | null } | null | undefined} line
 * @returns {{ url: string; alt: string; kind: 'gang' | 'design' | 'product' } | null}
 */
function summaryThumbForLine(line) {
  const gang = readGangSheetFromLineAttributes(line?.attributes);
  if (gang?.previewUrl) {
    return {
      url: String(gang.previewUrl),
      alt: gang.designName || 'DTF gang sheet',
      kind: 'gang',
    };
  }
  const design = readDesignFromLineAttributes(line?.attributes);
  if (design?.previewUrl) {
    return {
      url: String(design.previewUrl),
      alt: 'Custom design',
      kind: 'design',
    };
  }
  const img = line?.merchandise?.image;
  if (img?.url) {
    return {
      url: String(img.url),
      alt: img.altText || '',
      kind: 'product',
    };
  }
  return null;
}

/**
 * @param {CartSummaryProps}
 */
export function CartSummary({ cart, layout }) {
  const className =
    layout === 'page' ? 'cart-summary-page' : 'cart-summary-aside';

  if (layout === 'aside') {
    return (
      <div aria-labelledby="cart-summary" className={className}>
        <div className="cart-summary-totals">
          <div className="cart-summary-total-row">
            <span className="cart-summary-total-label">Total</span>
            <span className="cart-summary-total-amount">
              {cart?.cost?.totalAmount?.amount ? (
                <Money data={cart?.cost?.totalAmount} />
              ) : (
                '-'
              )}
            </span>
          </div>
        </div>
        <CartCheckoutActions checkoutUrl={cart?.checkoutUrl} layout={layout} />
      </div>
    );
  }

  const tax = parseFloat(cart?.cost?.totalTaxAmount?.amount || 0);
  const lines = cart?.lines?.nodes ?? [];
  const summaryThumbGroups = groupCartLinesForPageDisplay(lines);

  return (
    <div id="cart-summary" className={className}>
      <h2 className="cart-order-summary-heading">Order summary</h2>

      {summaryThumbGroups.length > 0 ? (
        <ul className="cart-order-summary-thumbs" aria-label="Items in cart">
          {summaryThumbGroups.slice(0, 5).map((group) => {
            const first = group[0];
            const thumb = summaryThumbForLine(first);
            const groupQty = group.reduce(
              (acc, line) => acc + (line.quantity ?? 0),
              0,
            );
            return (
              <li
                key={group.map((l) => l.id).join('::')}
                className="cart-order-summary-thumb"
              >
                {thumb ? (
                  <div
                    className={`cart-order-summary-thumb-image${
                      thumb.kind === 'gang'
                        ? ' cart-order-summary-thumb-image--gang'
                        : ''
                    }`}
                  >
                    {thumb.kind === 'product' && first?.merchandise?.image ? (
                      <Image
                        alt={thumb.alt}
                        data={first.merchandise.image}
                        sizes="48px"
                        width={160}
                      />
                    ) : (
                      <img src={thumb.url} alt={thumb.alt} loading="lazy" />
                    )}
                  </div>
                ) : (
                  <span className="cart-order-summary-thumb-placeholder" />
                )}
                <span className="cart-order-summary-thumb-qty">
                  {groupQty}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="cart-order-summary-rows">
        <div className="cart-order-summary-row">
          <span>Subtotal</span>
          <span>
            {cart?.cost?.subtotalAmount?.amount ? (
              <Money data={cart.cost.subtotalAmount} />
            ) : (
              '—'
            )}
          </span>
        </div>
        {tax > 0 ? (
          <div className="cart-order-summary-row">
            <span>Estimated tax</span>
            <span>
              <Money data={cart.cost.totalTaxAmount} />
            </span>
          </div>
        ) : null}
        <div className="cart-order-summary-row cart-order-summary-row--muted">
          <span>Shipping</span>
          <span className="cart-order-summary-shipping-note">
            TBD
          </span>
        </div>
        <div className="cart-order-summary-row cart-order-summary-row--total">
          <span>Total</span>
          <span>
            {cart?.cost?.totalAmount?.amount ? (
              <Money data={cart.cost.totalAmount} />
            ) : (
              '—'
            )}
          </span>
        </div>
      </div>

      <CartCheckoutActions checkoutUrl={cart?.checkoutUrl} layout={layout} />
    </div>
  );
}

/**
 * @param {{checkoutUrl?: string, layout?: string}}
 */
function CartCheckoutActions({ checkoutUrl, layout }) {
  if (!checkoutUrl) return null;

  if (layout === 'aside') {
    return (
      <div className="cart-checkout-actions">
        <Link to="/cart" className="cart-view-cart-btn">
          View Cart
        </Link>
        <a href={checkoutUrl} target="_self" className="cart-continue-checkout-btn">
          Checkout
        </a>
      </div>
    );
  }

  return (
    <div className="cart-checkout-actions-page">
      <a
        href={checkoutUrl}
        target="_self"
        rel="noreferrer"
        className="cart-checkout-btn-page"
      >
        Checkout
      </a>
    </div>
  );
}

/**
 * @typedef {{
 *   cart: OptimisticCart<CartApiQueryFragment | null>;
 *   layout: CartLayout;
 * }} CartSummaryProps
 */

/** @typedef {import('storefrontapi.generated').CartApiQueryFragment} CartApiQueryFragment */
/** @typedef {import('~/components/CartMain').CartLayout} CartLayout */
/** @typedef {import('@shopify/hydrogen').OptimisticCart} OptimisticCart */
