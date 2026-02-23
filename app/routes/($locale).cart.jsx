import {useLoaderData, data} from 'react-router';
import {CartForm} from '@shopify/hydrogen';
import {CartMain} from '~/components/CartMain';

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{title: `Hydrogen | Cart`}];
};

/**
 * @type {HeadersFunction}
 */
export const headers = ({actionHeaders}) => actionHeaders;

/**
 * @param {Route.ActionArgs}
 */
export async function action({request, context}) {
  const {cart} = context;

  const formData = await request.formData();

  const {action, inputs} = CartForm.getFormInput(formData);

  if (!action) {
    throw new Error('No action provided');
  }

  let status = 200;
  let result;

  switch (action) {
    case CartForm.ACTIONS.LinesAdd:
      result = await cart.addLines(inputs.lines);
      break;
    case CartForm.ACTIONS.LinesUpdate:
      result = await cart.updateLines(inputs.lines);
      break;
    case CartForm.ACTIONS.LinesRemove:
      result = await cart.removeLines(inputs.lineIds);
      break;
    case CartForm.ACTIONS.DiscountCodesUpdate: {
      const formDiscountCode = inputs.discountCode;

      // User inputted discount code
      const discountCodes = formDiscountCode ? [formDiscountCode] : [];

      // Combine discount codes already applied on cart
      discountCodes.push(...inputs.discountCodes);

      result = await cart.updateDiscountCodes(discountCodes);
      break;
    }
    case CartForm.ACTIONS.GiftCardCodesUpdate: {
      const formGiftCardCode = inputs.giftCardCode;

      // User inputted gift card code
      const giftCardCodes = formGiftCardCode ? [formGiftCardCode] : [];

      // Combine gift card codes already applied on cart
      giftCardCodes.push(...inputs.giftCardCodes);

      result = await cart.updateGiftCardCodes(giftCardCodes);
      break;
    }
    case CartForm.ACTIONS.GiftCardCodesRemove: {
      const appliedGiftCardIds = inputs.giftCardCodes;
      result = await cart.removeGiftCardCodes(appliedGiftCardIds);
      break;
    }
    case CartForm.ACTIONS.BuyerIdentityUpdate: {
      result = await cart.updateBuyerIdentity({
        ...inputs.buyerIdentity,
      });
      break;
    }
    default:
      throw new Error(`${action} cart action is not defined`);
  }

  const cartId = result?.cart?.id;
  const headers = cartId ? cart.setCartId(result.cart.id) : new Headers();
  const {cart: cartResult, errors, warnings} = result;

  // Apply bulk discount tiers with retry logic to handle cart conflicts
  let fullCart = cartResult;
  const shouldCheckDiscount = 
    action === CartForm.ACTIONS.LinesAdd ||
    action === CartForm.ACTIONS.LinesUpdate ||
    action === CartForm.ACTIONS.LinesRemove;
  
  if (shouldCheckDiscount && cartId && cartResult) {
    // Use the cart from the result instead of fetching again to avoid stale data
    fullCart = cartResult;
    
    // Bulk discount tiers configuration
    // IMPORTANT: Create these discount codes in Shopify Admin first!
    // The discount codes should be named: BULK99, BULK250, BULK500, BULK1000
    const BULK_TIERS = [
      { threshold: 1000, code: 'BULK1000' },
      { threshold: 500, code: 'BULK500' },
      { threshold: 250, code: 'BULK250' },
      { threshold: 99, code: 'BULK99' },
    ];
    
    const subtotalAmount = fullCart.cost?.subtotalAmount?.amount
      ? parseFloat(fullCart.cost.subtotalAmount.amount)
      : 0;
    
    // Find the highest tier that applies
    const applicableTier = BULK_TIERS.find(tier => subtotalAmount >= tier.threshold);
    
    // Get currently applied bulk discount codes
    const currentBulkCodes = fullCart.discountCodes
      ?.filter(code => BULK_TIERS.some(tier => tier.code === code.code) && code.applicable)
      .map(code => code.code) || [];
    
    // Determine which discount code should be applied
    const targetCode = applicableTier ? applicableTier.code : null;
    
    // Remove all bulk discount codes first
    const otherDiscountCodes = fullCart.discountCodes
      ?.filter(code => !BULK_TIERS.some(tier => tier.code === code.code))
      .map(code => code.code) || [];
    
    // Only update if there's a change needed
    const needsUpdate = 
      (targetCode && (!currentBulkCodes.includes(targetCode) || currentBulkCodes.length > 1)) ||
      (!targetCode && currentBulkCodes.length > 0);
    
    if (needsUpdate) {
      // Retry logic for cart conflicts
      const maxRetries = 3;
      let retryCount = 0;
      let success = false;
      
      while (retryCount < maxRetries && !success) {
        try {
          // Fetch fresh cart data before updating to avoid conflicts
          const freshCart = await cart.get();
          if (!freshCart) break;
          
          // Recalculate with fresh data
          const freshSubtotal = freshCart.cost?.subtotalAmount?.amount
            ? parseFloat(freshCart.cost.subtotalAmount.amount)
            : 0;
          
          const freshApplicableTier = BULK_TIERS.find(tier => freshSubtotal >= tier.threshold);
          const freshTargetCode = freshApplicableTier ? freshApplicableTier.code : null;
          
          const freshCurrentBulkCodes = freshCart.discountCodes
            ?.filter(code => BULK_TIERS.some(tier => tier.code === code.code) && code.applicable)
            .map(code => code.code) || [];
          
          const freshOtherDiscountCodes = freshCart.discountCodes
            ?.filter(code => !BULK_TIERS.some(tier => tier.code === code.code))
            .map(code => code.code) || [];
          
          // Check if update is still needed with fresh data
          const stillNeedsUpdate = 
            (freshTargetCode && (!freshCurrentBulkCodes.includes(freshTargetCode) || freshCurrentBulkCodes.length > 1)) ||
            (!freshTargetCode && freshCurrentBulkCodes.length > 0);
          
          if (stillNeedsUpdate) {
            const discountCodesToApply = freshTargetCode 
              ? [...freshOtherDiscountCodes, freshTargetCode]
              : freshOtherDiscountCodes;
            
            const discountResult = await cart.updateDiscountCodes(discountCodesToApply);
            if (discountResult?.cart) {
              fullCart = discountResult.cart;
              success = true;
            }
          } else {
            // No update needed, use fresh cart
            fullCart = freshCart;
            success = true;
          }
        } catch (error) {
          retryCount++;
          // If it's a cart conflict error, retry with exponential backoff
          if (error.message?.includes('conflict') || error.message?.includes('conflicted')) {
            if (retryCount < maxRetries) {
              // Exponential backoff: 100ms, 200ms, 400ms
              await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, retryCount - 1)));
              continue;
            }
          }
          // For other errors or max retries reached, log and continue with current cart
          if (retryCount >= maxRetries) {
            console.error('Error applying bulk discount after retries:', error);
          }
          break;
        }
      }
    }
  }

  const redirectTo = formData.get('redirectTo') ?? null;
  if (typeof redirectTo === 'string') {
    status = 303;
    headers.set('Location', redirectTo);
  }

  return data(
    {
      cart: fullCart,
      errors,
      warnings,
      analytics: {
        cartId,
      },
    },
    {status, headers},
  );
}

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context}) {
  const {cart} = context;
  try {
    const cartData = await cart.get();
    return cartData || null;
  } catch (error) {
    console.error('Error loading cart:', error);
    return null;
  }
}

export default function Cart() {
  /** @type {LoaderReturnData} */
  const cart = useLoaderData();

  return (
    <div className="cart">
      <h1>Cart</h1>
      <CartMain layout="page" cart={cart} />
    </div>
  );
}

/** @typedef {import('react-router').HeadersFunction} HeadersFunction */
/** @typedef {import('./+types/cart').Route} Route */
/** @typedef {import('@shopify/hydrogen').CartQueryDataReturn} CartQueryDataReturn */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof action>} ActionReturnData */
