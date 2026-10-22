import {useLoaderData, data} from 'react-router';
import {CartForm} from '@shopify/hydrogen';
import {CartMain} from '~/components/CartMain';
import {BULK_TIERS} from '~/components/BulkPricingTiers';
import {
  CartSkeleton,
  ContentReveal,
  useCartPageNavPending,
} from '~/components/LoadingUI';

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{title: 'Cart'}];
};

/**
 * @type {HeadersFunction}
 */
export const headers = ({actionHeaders}) => actionHeaders;

/**
 * Legacy volume discount codes — no longer auto-applied; strip if still on a cart.
 */
const BULK_CODE_SET = new Set(BULK_TIERS.map((t) => t.code));

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

      // User inputted discount code — ignore retired volume (BULK*) codes
      const discountCodes = formDiscountCode ? [formDiscountCode] : [];

      // Combine discount codes already applied on cart
      discountCodes.push(...inputs.discountCodes);

      result = await cart.updateDiscountCodes(
        discountCodes.filter((code) => !BULK_CODE_SET.has(String(code || ''))),
      );
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

  // Volume price breaks are retired — remove any leftover BULK* codes on line changes
  let fullCart = cartResult;
  const shouldStripBulk =
    action === CartForm.ACTIONS.LinesAdd ||
    action === CartForm.ACTIONS.LinesUpdate ||
    action === CartForm.ACTIONS.LinesRemove;

  if (shouldStripBulk && cartId && cartResult) {
    try {
      const freshCart = (await cart.get()) || cartResult;
      const bulkOnCart =
        freshCart.discountCodes?.filter((code) =>
          BULK_CODE_SET.has(code.code),
        ) || [];
      if (bulkOnCart.length > 0) {
        const keepCodes =
          freshCart.discountCodes
            ?.filter((code) => !BULK_CODE_SET.has(code.code))
            .map((code) => code.code) || [];
        const discountResult = await cart.updateDiscountCodes(keepCodes);
        if (discountResult?.cart) {
          fullCart = discountResult.cart;
        } else {
          fullCart = freshCart;
        }
      } else {
        fullCart = freshCart;
      }
    } catch (error) {
      console.error('Error stripping legacy bulk discount codes:', error);
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
  const navPending = useCartPageNavPending();

  if (navPending) {
    return (
      <div className="cart-page">
        <CartSkeleton layout="page" />
      </div>
    );
  }

  return (
    <div className="cart-page">
      <ContentReveal>
        <CartMain layout="page" cart={cart} />
      </ContentReveal>
    </div>
  );
}

/** @typedef {import('react-router').HeadersFunction} HeadersFunction */
/** @typedef {import('./+types/cart').Route} Route */
/** @typedef {import('@shopify/hydrogen').CartQueryDataReturn} CartQueryDataReturn */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof action>} ActionReturnData */
