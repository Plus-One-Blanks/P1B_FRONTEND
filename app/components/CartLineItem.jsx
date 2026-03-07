import { CartForm, Image } from '@shopify/hydrogen';
import { useVariantUrl } from '~/lib/variants';
import { Link, useNavigate } from 'react-router';
import { ProductPrice } from './ProductPrice';
import { useAside } from './Aside';

/**
 * A single line item in the cart. It displays the product image, title, price.
 * It also provides controls to update the quantity or remove the line item.
 * @param {{
 *   layout: CartLayout;
 *   line: CartLine;
 *   cart?: CartApiQueryFragment | null;
 * }}
 */
export function CartLineItem({ layout, line, cart }) {
  const { id, merchandise, quantity, cost } = line;
  const { product, title, image, selectedOptions } = merchandise;
  const lineItemUrl = useVariantUrl(product.handle, selectedOptions);
  const { close } = useAside();
  const navigate = useNavigate();

  const handleLineItemClick = () => {
    if (layout === 'aside') {
      close();
    }
    navigate(lineItemUrl);
  };

  // Calculate pricing - use API amounts so bulk tier discount shows correctly (e.g. 8.70 → 8.67)
  const totalAmount = parseFloat(cost?.totalAmount?.amount || 0); // Line total after discounts (from API)
  const unitPrice = parseFloat(cost?.amountPerQuantity?.amount || 0); // Unit price after discounts (from API)

  // Original price before any cart-level discount (variant price)
  const originalUnitPrice = parseFloat(merchandise?.price?.amount || 0);
  const originalLineTotal = originalUnitPrice * quantity;

  // When cart has a bulk discount, Shopify may not break it down per line; compute discounted unit so each line shows e.g. $8.67
  const cartSubtotal = parseFloat(cart?.cost?.subtotalAmount?.amount || 0);
  const cartTotal = parseFloat(cart?.cost?.totalAmount?.amount || 0);
  const cartSavings = cartSubtotal - cartTotal;
  const discountPercentage = cartSubtotal > 0 ? (cartSavings / cartSubtotal) * 100 : 0;
  const computedDiscountedUnit =
    discountPercentage > 0 && originalUnitPrice > 0
      ? originalUnitPrice * (1 - discountPercentage / 100)
      : unitPrice;
  // When there's a cart-level discount, show the computed discounted price per item ($8.67); otherwise use API unit price
  const displayUnitPrice =
    discountPercentage > 0 && originalUnitPrice > 0
      ? Math.round(computedDiscountedUnit * 100) / 100
      : (unitPrice > 0 ? unitPrice : computedDiscountedUnit);

  const displayLineTotal =
    discountPercentage > 0 && originalUnitPrice > 0
      ? Math.round(displayUnitPrice * quantity * 100) / 100
      : totalAmount;
  const lineSavings = originalLineTotal - displayLineTotal;
  const hasDiscount = originalUnitPrice > displayUnitPrice && displayUnitPrice > 0;

  // Get product title and remove everything after the last "-"
  const fullTitle = product.title;
  const displayTitle = fullTitle?.includes('-')
    ? fullTitle.substring(0, fullTitle.lastIndexOf('-')).trim()
    : fullTitle;

  // Separate color and size options
  const sizeOption = selectedOptions.find(opt =>
    opt.name.toLowerCase().trim() === 'size'
  );

  // Try multiple variations of color option names
  let colorOption = selectedOptions.find(opt => {
    const name = opt.name.toLowerCase().trim();
    return name === 'color' || name === 'colour' || name === 'colors' || name === 'colours';
  });

  // If color not found in selectedOptions, try to extract from variant title
  // Variant title format might be like: "Product Name - Color / Size" or "Product Name / Color / Size"
  if (!colorOption && title) {
    // Try to extract color from variant title (title is the variant title)
    // Look for patterns like " - Color /" or " / Color /" or " - Color"
    const variantTitle = title;
    // Pattern: look for text after last "-" and before "/" or at the end
    const parts = variantTitle.split(/\s*\/\s*/);
    if (parts.length > 1) {
      // If there are parts separated by "/", the color is likely the first part after the product name
      // Or it could be in a format like "Product - Color / Size"
      const lastDashIndex = variantTitle.lastIndexOf('-');
      if (lastDashIndex > 0) {
        const afterDash = variantTitle.substring(lastDashIndex + 1).trim();
        const colorPart = afterDash.split(/\s*\/\s*/)[0].trim();
        if (colorPart && colorPart.toLowerCase() !== sizeOption?.value?.toLowerCase()) {
          colorOption = { name: 'Color', value: colorPart };
        }
      }
    } else {
      // Try pattern "Product - Color"
      const lastDashIndex = variantTitle.lastIndexOf('-');
      if (lastDashIndex > 0) {
        const colorPart = variantTitle.substring(lastDashIndex + 1).trim();
        if (colorPart && colorPart.toLowerCase() !== sizeOption?.value?.toLowerCase()) {
          colorOption = { name: 'Color', value: colorPart };
        }
      }
    }
  }

  // If still no color found, check if there's a non-size option that might be color
  // (common case: if there are only 2 options and one is size, the other is likely color)
  if (!colorOption && sizeOption) {
    const nonSizeOptions = selectedOptions.filter(opt => opt.name.toLowerCase().trim() !== 'size');
    // If there's exactly one non-size option, it's likely the color
    if (nonSizeOptions.length === 1) {
      colorOption = { name: 'Color', value: nonSizeOptions[0].value };
    }
  }

  const otherOptions = selectedOptions.filter(opt => {
    const name = opt.name.toLowerCase().trim();
    const isColor = colorOption && opt.name === colorOption.name && opt.value === colorOption.value;
    return !isColor &&
      name !== 'color' &&
      name !== 'colour' &&
      name !== 'colors' &&
      name !== 'colours' &&
      name !== 'size';
  });

  return (
    <li key={id} className="cart-line" onClick={handleLineItemClick}>
      {image && (
        <div className="cart-line-image">
          <Image
            alt={title}
            data={image}
            aspectRatio="3/4" // typical apparel ratio
            width={80}
          />
        </div>

      )}

      <div className="cart-line-content">
        <p className="cart-line-product-name">{displayTitle}</p>
        <div className="cart-line-attributes">
          {sizeOption && (
            <span key={sizeOption.name} className="cart-line-attribute">
              {sizeOption.name}: {sizeOption.value}
            </span>
          )}
          {colorOption && (
            <span key={colorOption.name} className="cart-line-attribute">
              {colorOption.name}: {colorOption.value}
            </span>
          )}
          {otherOptions.map((option) => (
            <span key={option.name} className="cart-line-attribute">
              {option.name}: {option.value}
            </span>
          ))}
        </div>
        <div className="cart-line-controls" onClick={(e) => e.stopPropagation()}>
          <CartLineQuantity line={line} />
          <div className="cart-line-pricing">
            {hasDiscount && (
              <span className="cart-line-price-original">${originalUnitPrice.toFixed(2)} ea</span>
            )}
            <span className={`cart-line-price-current${hasDiscount ? ' cart-line-price-discounted' : ''}`}>
              ${displayUnitPrice.toFixed(2)} ea
            </span>
            <span className="cart-line-price-total">${displayLineTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </li>
  );
}

/**
 * Provides the controls to update the quantity of a line item in the cart.
 * These controls are disabled when the line item is new, and the server
 * hasn't yet responded that it was successfully added to the cart.
 * @param {{line: CartLine}}
 */
function CartLineQuantity({ line }) {
  if (!line || typeof line?.quantity === 'undefined') return null;
  const { id: lineId, quantity, isOptimistic } = line;
  const prevQuantity = Number(Math.max(0, quantity - 1).toFixed(0));
  const nextQuantity = Number((quantity + 1).toFixed(0));

  return (
    <div className="cart-line-quantity-controls">
      <CartLineRemoveButton lineIds={[lineId]} disabled={!!isOptimistic} />
      <div className="cart-line-quantity-box">
        <CartLineUpdateButton lines={[{ id: lineId, quantity: prevQuantity }]}>
          <button
            className="cart-line-quantity-btn"
            aria-label="Decrease quantity"
            disabled={quantity <= 1 || !!isOptimistic}
            name="decrease-quantity"
            value={prevQuantity}
            onClick={(e) => e.stopPropagation()}
          >
            <span>−</span>
          </button>
        </CartLineUpdateButton>
        <span className="cart-line-quantity-value">{quantity}</span>
        <CartLineUpdateButton lines={[{ id: lineId, quantity: nextQuantity }]}>
          <button
            className="cart-line-quantity-btn"
            aria-label="Increase quantity"
            name="increase-quantity"
            value={nextQuantity}
            disabled={!!isOptimistic}
            onClick={(e) => e.stopPropagation()}
          >
            <span>+</span>
          </button>
        </CartLineUpdateButton>
      </div>
    </div>
  );
}

/**
 * A button that removes a line item from the cart. It is disabled
 * when the line item is new, and the server hasn't yet responded
 * that it was successfully added to the cart.
 * @param {{
 *   lineIds: string[];
 *   disabled: boolean;
 * }}
 */
function CartLineRemoveButton({ lineIds, disabled }) {
  return (
    <CartForm
      fetcherKey={getUpdateKey(lineIds)}
      route="/cart"
      action={CartForm.ACTIONS.LinesRemove}
      inputs={{ lineIds }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="cart-line-remove-btn"
        disabled={disabled}
        type="submit"
        aria-label="Remove item"
        onClick={(e) => e.stopPropagation()}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      </button>
    </CartForm>
  );
}

/**
 * @param {{
 *   children: React.ReactNode;
 *   lines: CartLineUpdateInput[];
 * }}
 */
function CartLineUpdateButton({ children, lines }) {
  const lineIds = lines.map((line) => line.id);

  return (
    <CartForm
      fetcherKey={getUpdateKey(lineIds)}
      route="/cart"
      action={CartForm.ACTIONS.LinesUpdate}
      inputs={{ lines }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </CartForm>
  );
}

/**
 * Returns a unique key for the update action. This is used to make sure actions modifying the same line
 * items are not run concurrently, but cancel each other. For example, if the user clicks "Increase quantity"
 * and "Decrease quantity" in rapid succession, the actions will cancel each other and only the last one will run.
 * @returns
 * @param {string[]} lineIds - line ids affected by the update
 */
function getUpdateKey(lineIds) {
  return [CartForm.ACTIONS.LinesUpdate, ...lineIds].join('-');
}

/** @typedef {OptimisticCartLine<CartApiQueryFragment>} CartLine */

/** @typedef {import('@shopify/hydrogen/storefront-api-types').CartLineUpdateInput} CartLineUpdateInput */
/** @typedef {import('~/components/CartMain').CartLayout} CartLayout */
/** @typedef {import('@shopify/hydrogen').OptimisticCartLine} OptimisticCartLine */
/** @typedef {import('storefrontapi.generated').CartApiQueryFragment} CartApiQueryFragment */
