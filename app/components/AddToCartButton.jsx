import { useEffect, useRef } from 'react';
import { CartForm } from '@shopify/hydrogen';

/**
 * @param {{
 *   analytics?: unknown;
 *   children: React.ReactNode;
 *   disabled?: boolean;
 *   lines: Array<OptimisticCartLineInput>;
 *   onClick?: () => void;
 * }}
 */
export function AddToCartButton({
  analytics,
  children,
  disabled,
  lines,
  onClick,
  className,
}) {
  return (
    <>
      <CartForm route="/cart" inputs={{ lines }} action={CartForm.ACTIONS.LinesAdd}>
        {(fetcher) => {
          const loggedRef = useRef(false);

          // Log cart data when fetcher completes successfully
          useEffect(() => {
            if (
              fetcher.state === 'idle' &&
              fetcher.data?.cart?.lines?.nodes &&
              !loggedRef.current
            ) {
              loggedRef.current = true;
              
              // Log cart ID
              if (fetcher.data.cart.id) {
                console.log('Cart ID:', fetcher.data.cart.id);
              }
              
              fetcher.data.cart.lines.nodes.forEach((line) => {
                const cartLineData = {
                  id: line.id,
                  originalUnitPrice: line.cost?.compareAtAmountPerQuantity?.amount
                    ? parseFloat(line.cost.compareAtAmountPerQuantity.amount)
                    : line.cost?.amountPerQuantity?.amount
                      ? parseFloat(line.cost.amountPerQuantity.amount)
                      : null,
                  currentUnitPrice: line.cost?.amountPerQuantity?.amount
                    ? parseFloat(line.cost.amountPerQuantity.amount)
                    : null,
                  cost: {
                    subtotalAmount: {
                      amount: line.cost?.totalAmount?.amount
                        ? parseFloat(line.cost.totalAmount.amount)
                        : null,
                    },
                  },
                };
                console.log(JSON.stringify(cartLineData, null, 2));
              });
            }
            // Reset when fetcher starts a new submission
            if (fetcher.state === 'submitting') {
              loggedRef.current = false;
            }
            
            // Dispatch cart update event to refresh bulk pricing (only if not during HMR)
            if (
              fetcher.state === 'idle' && 
              fetcher.data?.cart &&
              typeof window !== 'undefined' &&
              !window.hot // Skip during HMR
            ) {
              // Debounce the event dispatch slightly to prevent rapid-fire events
              setTimeout(() => {
                if (typeof window !== 'undefined' && !window.hot) {
                  window.dispatchEvent(new CustomEvent('cartUpdated'));
                }
              }, 100);
            }
          }, [fetcher.state, fetcher.data]);

          return (
            <div>
          <input
            name="analytics"
            type="hidden"
            value={JSON.stringify(analytics)}
          />
          <button
            type="submit"
            onClick={onClick}
            disabled={disabled ?? fetcher.state !== 'idle'}
                style={{ width: '100%' }}
          >
            {children}
          </button>
            </div>
          );
        }}
      </CartForm>
        </>

  );
}

/** @typedef {import('react-router').FetcherWithComponents} FetcherWithComponents */
/** @typedef {import('@shopify/hydrogen').OptimisticCartLineInput} OptimisticCartLineInput */
