import { Image, Money } from '@shopify/hydrogen';
import { Link } from 'react-router';
import { groupCartLinesForPageDisplay } from '~/lib/cartEditSizes';
import { cartRetailSubtotalFromLines } from '~/lib/cartRetailPricing';

/**
 * @param {{ cart: CartSummaryProps['cart'] }}
 */
function CartAsideSavings({ cart }) {
  const lines = cart?.lines?.nodes ?? [];
  const retailSubtotal = cartRetailSubtotalFromLines(lines);
  const subtotal = parseFloat(cart?.cost?.subtotalAmount?.amount || 0);
  const savings =
    retailSubtotal > 0 && subtotal >= 0 ? Math.max(0, retailSubtotal - subtotal) : 0;
  if (savings <= 0) return null;
  return (
    <div className="cart-summary-savings">
      <span className="cart-summary-savings-label">Total Savings</span>
      <span className="cart-summary-savings-amount">- ${savings.toFixed(2)}</span>
    </div>
  );
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
          <CartAsideSavings cart={cart} />
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
  const subtotalNum = parseFloat(cart?.cost?.subtotalAmount?.amount || 0);
  const retailSubtotal = cartRetailSubtotalFromLines(lines);
  /** PDP-style retail (2× variant price × qty) minus actual merchandise subtotal after bulk pricing. */
  const savingsAmount =
    retailSubtotal > 0 && subtotalNum >= 0
      ? Math.max(0, retailSubtotal - subtotalNum)
      : 0;
  const savingsCurrency = cart?.cost?.subtotalAmount?.currencyCode;

  return (
    <div id="cart-summary" className={className}>
      <h2 className="cart-order-summary-heading">Order summary</h2>

      {summaryThumbGroups.length > 0 ? (
        <ul className="cart-order-summary-thumbs" aria-label="Items in cart">
          {summaryThumbGroups.slice(0, 5).map((group) => {
            const first = group[0];
            const img = first?.merchandise?.image;
            const groupQty = group.reduce(
              (acc, line) => acc + (line.quantity ?? 0),
              0,
            );
            return (
              <li
                key={group.map((l) => l.id).join('::')}
                className="cart-order-summary-thumb"
              >
                {img?.url ? (
                  <div className="cart-order-summary-thumb-image">
                    <Image
                      alt={img.altText ?? ''}
                      data={img}
                      sizes="48px"
                      width={160}
                    />
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
            {retailSubtotal > 0 && savingsCurrency ? (
              <Money
                data={{
                  amount: retailSubtotal.toFixed(2),
                  currencyCode: savingsCurrency,
                }}
              />
            ) : cart?.cost?.subtotalAmount?.amount ? (
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
        {savingsAmount > 0 && savingsCurrency ? (
          <div className="cart-order-summary-row cart-order-summary-row--savings">
            <span>Savings</span>
            <span className="cart-order-summary-savings-value">
              <Money
                data={{
                  amount: savingsAmount.toFixed(2),
                  currencyCode: savingsCurrency,
                }}
              />
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
