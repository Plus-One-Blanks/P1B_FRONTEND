import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import { getProductOptions } from '@shopify/hydrogen';
import { AddToCartButton } from './AddToCartButton';
import { useAside } from './Aside';
import { getActiveTier, getTierPrice, BULK_TIERS } from './BulkPricingTiers';

/**
 * Shopify size value looks like apparel (S–4XL, waist, etc.) — use full grid even if only one variant exists.
 * @param {string | null | undefined} sizeName
 */
function isLikelyApparelSizeLabel(sizeName) {
  const raw = String(sizeName ?? '').trim();
  if (!raw) return false;
  const n = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  const compact = n.replace(/[\s-]/g, '');

  const codes = new Set([
    'xxs',
    'xs',
    's',
    'm',
    'l',
    'xl',
    'xxl',
    '2xl',
    'xxxl',
    '3xl',
    '4xl',
    '4x',
    '5xl',
    '5x',
    '6xl',
    '6x',
  ]);
  if (codes.has(n) || codes.has(compact)) return true;

  const words = ['small', 'medium', 'large', 'x-large', 'xx-large'];
  if (words.includes(n)) return true;

  return false;
}

/**
 * Normalize size labels so "Large" / "l" / "L" match the same grid row and variant.
 * @param {string | null | undefined} label
 */
function canonicalApparelSizeToken(label) {
  const n = String(label ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const c = n.replace(/[\s-]/g, '');
  if (n === 'xxs' || c === 'xxs') return 'xxs';
  if (n === 'xs' || n === 'x-small' || c === 'xs') return 'xs';
  if (n === 's' || n === 'small' || c === 'small') return 's';
  if (n === 'm' || n === 'medium' || c === 'medium') return 'm';
  if (n === 'l' || n === 'large' || c === 'large') return 'l';
  if (n === 'xl' || n === 'x-large' || n === 'xlarge' || c === 'xlarge') {
    return 'xl';
  }
  if (
    n === '2xl' ||
    n === 'xxl' ||
    n === 'xx-large' ||
    n === 'xxlarge' ||
    c === '2xl' ||
    c === 'xxl'
  ) {
    return '2xl';
  }
  if (n === '3xl' || n === 'xxxl' || c === '3xl' || c === 'xxxl') return '3xl';
  if (n === '4xl' || n === '4x' || c === '4xl' || c === '4x') return '4xl';
  if (n === '5xl' || n === '5x' || c === '5xl') return '5xl';
  if (n === '6xl' || n === '6x' || c === '6xl') return '6xl';
  return c || n;
}

/**
 * Single size option that is NOT apparel lettering (e.g. OS, One Size) — compact one-row UI.
 * @param {import('@shopify/hydrogen').MappedProductOptions | null | undefined} sizeOption
 */
function isAccessorySingleSizeLayout(sizeOption) {
  if (!sizeOption || sizeOption.optionValues.length !== 1) return false;
  const name = sizeOption.optionValues[0]?.name;
  return !isLikelyApparelSizeLabel(name);
}

/**
 * @param {import('@shopify/hydrogen').MappedProductOptions | null | undefined} sizeOption
 */
function useFullApparelSizeGrid(sizeOption) {
  return Boolean(
    sizeOption &&
      (sizeOption.optionValues.length > 1 ||
        !isAccessorySingleSizeLayout(sizeOption)),
  );
}

/**
 * @param {Record<string, number>} quantities
 * @param {string} label
 */
function quantityForSizeLabel(quantities, label) {
  if (!quantities || label == null) return 0;
  const want = canonicalApparelSizeToken(label);
  for (const [k, v] of Object.entries(quantities)) {
    if (canonicalApparelSizeToken(k) === want) {
      return Math.max(0, Number(v) || 0);
    }
  }
  return 0;
}

/**
 * Attach design attributes to every cart line (copied onto the Shopify order).
 * @param {Array<Record<string, unknown>>} lines
 * @param {Array<{ key: string; value: string }> | null | undefined} designAttrs
 */
function withDesignAttributes(lines, designAttrs) {
  if (!designAttrs?.length) return lines;
  return lines.map((line) => ({
    ...line,
    attributes: [...(line.attributes || []), ...designAttrs],
  }));
}

/**
 * @param {{
 *   productOptions: MappedProductOptions[];
 *   selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
 *   selectedColorProduct?: ProductFragment | null;
 *   activeTier?: object | null;
 *   currentCartTotal?: number;
 *   onProjectedTotalChange?: (total: number) => void;
 *   designLineAttributes?: Array<{ key: string; value: string }> | null;
 *   requireDesign?: boolean;
 *   designReady?: boolean;
 * }}
 */
export function ProductForm({
  productOptions,
  selectedVariant,
  selectedColorProduct,
  activeTier,
  currentCartTotal = 0,
  onProjectedTotalChange,
  designLineAttributes = null,
  requireDesign = false,
  designReady = true,
}) {
  const navigate = useNavigate();
  const { open } = useAside();
  const [sizeQuantities, setSizeQuantities] = useState({});

  // Get product options from selected color product if available
  // getProductOptions will extract adjacentVariants from the product automatically
  const colorProductOptions = selectedColorProduct
    ? getProductOptions({
      ...selectedColorProduct,
      selectedOrFirstAvailableVariant: selectedColorProduct.selectedOrFirstAvailableVariant,
    })
    : null;

  const effectiveProductOptions = colorProductOptions || productOptions;
  const effectiveSizeOption = effectiveProductOptions.find(
    (option) => option.name.toLowerCase() === 'size',
  );
  const effectiveSelectedVariant =
    selectedColorProduct?.selectedOrFirstAvailableVariant || selectedVariant;

  useEffect(() => {
    setSizeQuantities({});
  }, [selectedColorProduct?.id]);

  const showFullSizeGrid = useFullApparelSizeGrid(effectiveSizeOption);
  const showAccessoryOneSize = isAccessorySingleSizeLayout(effectiveSizeOption);

  // Apparel: multiple sizes OR one real size (e.g. only "L") — full S–4XL grid, missing sizes sold out.
  // Accessories: single OS / One Size / non-apparel label — one compact row.
  if (showFullSizeGrid) {
    const handleQuantityChange = (sizeName, quantity) => {
      setSizeQuantities((prev) => {
        const updated = {
          ...prev,
          [sizeName]: quantity,
        };

        // Calculate projected cart total
        if (onProjectedTotalChange) {
          let projectedTotal = currentCartTotal;
          effectiveSizeOption.optionValues.forEach((value) => {
            const qty = quantityForSizeLabel(updated, value.name);
            if (qty > 0) {
              // Find variant price
              let variant = findVariantForSize(value.name);
              if (!variant) {
                variant = value.firstSelectableVariant;
              }

              const price = variant?.price?.amount
                ? parseFloat(variant.price.amount)
                : 0;
              projectedTotal += price * qty;
            }
          });
          onProjectedTotalChange(projectedTotal);
        }

        return updated;
      });
    };

    // Helper function to find variant by size in the selected color product
    const findVariantForSize = (sizeName) => {
      if (!selectedColorProduct || !selectedColorProduct.adjacentVariants) {
        return null;
      }
      const want = canonicalApparelSizeToken(sizeName);
      const matchingVariant = selectedColorProduct.adjacentVariants.find((variant) => {
        if (!variant?.selectedOptions) return false;
        if (variant.product?.handle !== selectedColorProduct.handle) {
          return false;
        }
        const sizeOption = variant.selectedOptions.find(
          (opt) => opt?.name?.toLowerCase() === 'size',
        );
        if (!sizeOption) return false;
        return canonicalApparelSizeToken(sizeOption.value) === want;
      });
      return matchingVariant || null;
    };

    // Build cart lines using variants from the selected color product
    const cartLines = effectiveSizeOption.optionValues
      .filter((value) => {
        const quantity = quantityForSizeLabel(sizeQuantities, value.name);
        if (!quantity || quantity <= 0) return false;

        // Find variant for this size
        let variant = findVariantForSize(value.name);
        if (!variant) {
          variant = value.firstSelectableVariant;
        }

        // Check if variant exists and is available
        return variant?.id && variant?.availableForSale;
      })
      .map((value) => {
        // Find variant for this size using the same logic
        let variant = findVariantForSize(value.name);
        if (!variant) {
          variant = value.firstSelectableVariant;
        }

        return {
          merchandiseId: variant?.id,
          quantity: quantityForSizeLabel(sizeQuantities, value.name),
          selectedVariant: variant,
        };
      })
      .filter((line) => line.merchandiseId);

    const linesForCart = withDesignAttributes(cartLines, designLineAttributes);
    const designBlocksAdd = requireDesign && !designReady;

    return (
      <div className="product-form">
        {effectiveProductOptions
          .filter((option) => option.name.toLowerCase() !== 'size')
          .map((option) => (
            <ProductOptionGroup
              key={option.name}
              option={option}
              navigate={navigate}
            />
          ))}

        <SizeSelectorWithQuantities
          sizeOption={effectiveSizeOption}
          effectiveSizeOption={effectiveSizeOption}
          sizeQuantities={sizeQuantities}
          onQuantityChange={handleQuantityChange}
          selectedColorProduct={selectedColorProduct}
          cartLines={linesForCart}
          onAddToCart={() => open('cart')}
          activeTier={activeTier}
          currentCartTotal={currentCartTotal}
          alwaysShowSizes={['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']}
          addToCartDisabled={designBlocksAdd}
        />
      </div>
    );
  }

  if (showAccessoryOneSize) {
    const variant = effectiveSelectedVariant;
    const basePrice = variant?.price?.amount ? parseFloat(variant.price.amount) : 0;

    const onlySizeLabel = String(
      effectiveSizeOption?.optionValues?.[0]?.name ?? 'One Size',
    );
    const oneSizeQuantity = sizeQuantities[onlySizeLabel] || 0;

    // Calculate projected total including this item to determine tier
    const projectedTotalWithThis = currentCartTotal + (basePrice * oneSizeQuantity);
    const projectedTier = getActiveTier(projectedTotalWithThis);
    const tierToUse = projectedTier || activeTier;

    // Calculate tier-adjusted price
    let price = basePrice;
    if (tierToUse) {
      const tierIndex = BULK_TIERS.findIndex(t => t.code === tierToUse.code);
      if (tierIndex >= 0) {
        price = getTierPrice(basePrice, tierIndex);
      }
    }

    const stockQuantity = variant?.quantityAvailable ?? (variant?.availableForSale ? 999 : 0);
    const available = variant?.availableForSale === true;

    const handleOneSizeQuantityChange = (quantity) => {
      setSizeQuantities((prev) => {
        const updated = {
          ...prev,
          [onlySizeLabel]: quantity,
        };

        // Calculate projected cart total
        if (onProjectedTotalChange) {
          let projectedTotal = currentCartTotal;
          if (quantity > 0) {
            // Recalculate price with updated quantity for tier
            const tempProjectedTotal = currentCartTotal + (basePrice * quantity);
            const tempTier = getActiveTier(tempProjectedTotal);
            const tempTierToUse = tempTier || activeTier;
            let tempPrice = basePrice;
            if (tempTierToUse) {
              const tempTierIndex = BULK_TIERS.findIndex(t => t.code === tempTierToUse.code);
              if (tempTierIndex >= 0) {
                tempPrice = getTierPrice(basePrice, tempTierIndex);
              }
            }
            projectedTotal += tempPrice * quantity;
          }
          onProjectedTotalChange(projectedTotal);
        }

        return updated;
      });
    };

    // Build cart lines
    const cartLines = [];
    if (oneSizeQuantity > 0 && variant?.id && available) {
      cartLines.push({
        merchandiseId: variant.id,
        quantity: oneSizeQuantity,
        selectedVariant: variant,
      });
    }

    const linesForCart = withDesignAttributes(cartLines, designLineAttributes);
    const designBlocksAdd = requireDesign && !designReady;

    return (
      <div className="product-form">
        {effectiveProductOptions
          .filter((option) => option.name.toLowerCase() !== 'size')
          .map((option) => (
            <ProductOptionGroup
              key={option.name}
              option={option}
              navigate={navigate}
            />
          ))}

        <div className="one-size-selector">
          <h5 className="size-selector-title">Choose Size</h5>
          <div className="size-selector-grid">
            <div className="size-selector-item">
              <div className="size-label">{onlySizeLabel}</div>
              <div className="size-input-container">
                <input
                  type="number"
                  min="0"
                  value={oneSizeQuantity || ''}
                  onChange={(e) => {
                    const newQuantity = parseInt(e.target.value, 10) || 0;
                    handleOneSizeQuantityChange(newQuantity);
                  }}
                  className="size-quantity-input"
                  disabled={!available}
                  placeholder="0"
                />
              </div>
              <div className="size-price">${price.toFixed(2)}</div>
              <div className="size-stock">
                {stockQuantity > 0 ? (
                  <>
                    <span className="stock-quantity">
                      {stockQuantity >= 999 ? '999+' : stockQuantity}
                    </span>
                    <span className="stock-label"> In Stock</span>
                  </>
                ) : (
                  <span className="stock-label out-of-stock">Out of Stock</span>
                )}
              </div>
            </div>
          </div>
          <div className="one-size-add-to-cart-wrapper">
            <AddToCartButton
              disabled={linesForCart.length === 0 || designBlocksAdd}
              onClick={() => open('cart')}
              lines={linesForCart}
            >
              ADD TO CART
            </AddToCartButton>
          </div>
        </div>
      </div>
    );
  }

  // Standard form for non-size options
  const standardLines = withDesignAttributes(
    effectiveSelectedVariant
      ? [
          {
            merchandiseId: effectiveSelectedVariant.id,
            quantity: 1,
            selectedVariant: effectiveSelectedVariant,
          },
        ]
      : [],
    designLineAttributes,
  );
  const designBlocksAdd = requireDesign && !designReady;

  return (
    <div className="product-form">
      {effectiveProductOptions.map((option) => (
        <ProductOptionGroup
          key={option.name}
          option={option}
          navigate={navigate}
        />
      ))}
      <AddToCartButton
        disabled={
          !effectiveSelectedVariant ||
          !effectiveSelectedVariant.availableForSale ||
          designBlocksAdd
        }
        onClick={() => open('cart')}
        lines={standardLines}
      >
        {effectiveSelectedVariant?.availableForSale ? 'Add to cart' : 'Sold out'}
      </AddToCartButton>
    </div>
  );
}

/**
 * Renders a product option group (Color, etc.)
 */
function ProductOptionGroup({ option, navigate }) {
  if (option.optionValues.length === 1) return null;

  return (
    <div className="product-options">
      <h5>{option.name}</h5>
      <div className="product-options-grid">
        {option.optionValues.map((value) => (
          <ProductOptionItem
            key={option.name + value.name}
            optionName={option.name}
            value={value}
            navigate={navigate}
          />
        ))}
      </div>
      <br />
    </div>
  );
}

/**
 * Renders a single product option item
 */
function ProductOptionItem({ optionName, value, navigate }) {
  const {
    name,
    handle,
    variantUriQuery,
    selected,
    available,
    exists,
    isDifferentProduct,
    swatch,
  } = value;
  const {pathname} = useLocation();
  const pathPrefix = pathname.includes('/decorated-products/')
    ? 'decorated-products'
    : 'products';

  const commonProps = {
    className: 'product-options-item',
    style: {
      border: selected ? '1px solid black' : '1px solid transparent',
      opacity: available ? 1 : 0.3,
    },
  };

  if (isDifferentProduct) {
    return (
      <Link
        {...commonProps}
        key={optionName + name}
        prefetch="intent"
        preventScrollReset
        replace
        to={`/${pathPrefix}/${handle}?${variantUriQuery}`}
      >
        <ProductOptionSwatch swatch={swatch} name={name} />
      </Link>
    );
  }

  return (
    <button
      {...commonProps}
      type="button"
      className={`product-options-item${exists && !selected ? ' link' : ''}`}
      disabled={!exists}
      onClick={() => {
        if (!selected) {
          void navigate(`?${variantUriQuery}`, {
            replace: true,
            preventScrollReset: true,
          });
        }
      }}
    >
      <ProductOptionSwatch swatch={swatch} name={name} />
    </button>
  );
}

/**
 * Size selector with quantity inputs
 * @param {{
 *   sizeOption: MappedProductOptions;
 *   effectiveSizeOption?: MappedProductOptions | null;
 *   sizeQuantities: Record<string, number>;
 *   onQuantityChange: (sizeName: string, quantity: number) => void;
 *   selectedColorProduct?: ProductFragment | null;
 *   cartLines?: Array<any>;
 *   onAddToCart?: () => void;
 *   activeTier?: object | null;
 *   currentCartTotal?: number;
 *   addToCartDisabled?: boolean;
 * }}
 */
function SizeSelectorWithQuantities({
  sizeOption,
  effectiveSizeOption,
  sizeQuantities,
  onQuantityChange,
  selectedColorProduct,
  cartLines = [],
  onAddToCart,
  activeTier,
  currentCartTotal = 0,
  alwaysShowSizes = null,
  addToCartDisabled = false,
}) {
  // Helper function to find variant by size in the selected color product
  const findVariantForSize = (sizeName) => {
    if (!selectedColorProduct || !selectedColorProduct.adjacentVariants) {
      return null;
    }

    // Normalize the size name for comparison
    const want = canonicalApparelSizeToken(sizeName);

    // Find variant in selected color product that matches this size
    const matchingVariant = selectedColorProduct.adjacentVariants.find((variant) => {
      if (!variant?.selectedOptions) return false;

      // Verify this variant belongs to the selected color product
      if (variant.product?.handle !== selectedColorProduct.handle) {
        return false;
      }

      const sizeOption = variant.selectedOptions.find(
        (opt) => opt?.name?.toLowerCase() === 'size',
      );

      if (!sizeOption) return false;

      return canonicalApparelSizeToken(sizeOption.value) === want;
    });

    return matchingVariant || null;
  };


  // Always show S-4XL sizes regardless of what's available
  const standardSizes = alwaysShowSizes || ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

  // Case-insensitive map (Shopify may use "xl" vs grid "XL")
  const availableSizesMap = new Map();
  sizeOption.optionValues.forEach((value) => {
    const rawKey = String(value.name).trim().toLowerCase();
    availableSizesMap.set(rawKey, value);
    const tok = canonicalApparelSizeToken(value.name);
    if (tok) {
      availableSizesMap.set(tok, value);
    }
  });

  return (
    <div className="size-selector-with-quantities">
      <h5 className="size-selector-title">Choose Size</h5>
      <div className="size-selector-grid">
        {standardSizes.map((sizeName) => {
          const lookupKey = String(sizeName).trim().toLowerCase();
          const canon = canonicalApparelSizeToken(sizeName);
          const value =
            availableSizesMap.get(canon) ||
            availableSizesMap.get(lookupKey) || {
              name: sizeName,
              firstSelectableVariant: null,
              available: false,
              exists: false,
            };
          // First try to find variant from selected color product by matching size
          let variant = findVariantForSize(value.name);

          // If we have a selected color product, ONLY use variants from that product
          // Don't fall back to original product variants
          if (!variant && selectedColorProduct && effectiveSizeOption) {
            // Try using the effective size option's firstSelectableVariant
            // but verify it belongs to the selected color product and matches the size
            const colorSizeValue = effectiveSizeOption.optionValues.find(
              (v) =>
                canonicalApparelSizeToken(v.name) ===
                canonicalApparelSizeToken(value.name),
            );
            const candidateVariant = colorSizeValue?.firstSelectableVariant;

            // Verify the variant belongs to the selected color product and matches the size
            if (candidateVariant) {
              const variantSizeOption = candidateVariant.selectedOptions?.find(
                (opt) => opt?.name?.toLowerCase() === 'size',
              );
              if (candidateVariant.product?.handle === selectedColorProduct.handle &&
                canonicalApparelSizeToken(variantSizeOption?.value) ===
                  canonicalApparelSizeToken(value.name)) {
                variant = candidateVariant;
              }
            }
          }

          // Only fallback to original product's variant if we don't have a selected color product
          if (!variant && !selectedColorProduct) {
            variant = value.firstSelectableVariant;
          }

          const quantity = quantityForSizeLabel(sizeQuantities, value.name);
          const basePrice = variant?.price?.amount
            ? parseFloat(variant.price.amount)
            : 0;

          // Calculate projected total including this item to determine tier
          const projectedTotalWithThis = currentCartTotal + (basePrice * quantity);
          const projectedTier = getActiveTier(projectedTotalWithThis);
          const tierToUse = projectedTier || activeTier;

          // Get tier-adjusted price
          let price = basePrice;
          if (tierToUse) {
            const tierIndex = BULK_TIERS.findIndex(t => t.code === tierToUse.code);
            if (tierIndex >= 0) {
              price = getTierPrice(basePrice, tierIndex);
            }
          }

          // Determine availability: use variant's availableForSale if we have a variant from selected color product
          // If we have a selected color product but no variant found, mark as unavailable
          // Only use original value's availability if no color product is selected
          let available = false;
          if (variant) {
            // Verify variant belongs to selected color product if one is selected
            if (selectedColorProduct) {
              if (variant.product?.handle === selectedColorProduct.handle) {
                available = variant.availableForSale === true;
              } else {
                // Variant doesn't belong to selected color product - mark as unavailable
                available = false;
              }
            } else {
              // No color product selected, use variant's availability
              available = variant.availableForSale === true;
            }
          } else if (!selectedColorProduct) {
            // Only fallback to original value's availability if no color product selected
            available = value.available && value.exists;
          }
          // If selectedColorProduct exists but no variant found, available remains false

          // Get actual inventory quantity if available, otherwise use availableForSale boolean
          // NOTE: quantityAvailable requires the 'unauthenticated_read_product_inventory' scope
          // to be enabled in your Shopify app settings. If it's null, you need to:
          // 1. Go to your Shopify Admin → Apps → Your Storefront API app
          // 2. Enable the 'unauthenticated_read_product_inventory' scope
          // 3. Save and re-authenticate if needed
          let stockQuantity = 0;
          if (variant && variant.quantityAvailable !== null && variant.quantityAvailable !== undefined) {
            // Use actual quantity from API
            stockQuantity = variant.quantityAvailable;
          } else if (available) {
            // Fallback: if available but no quantity data, show 999+
            // This happens when quantityAvailable is null (API scope not enabled)
            stockQuantity = 999;
          } else {
            // Not available
            stockQuantity = 0;
          }

          return (
            <div
              key={value.name}
              className={`size-selector-item ${!available ? 'unavailable' : ''}`}
            >
              <div className="size-label">{value.name}</div>
              <div className="size-input-container">
                <input
                  type="number"
                  min="0"
                  value={quantity || ''}
                  onChange={(e) => {
                    const newQuantity = parseInt(e.target.value, 10) || 0;
                    onQuantityChange(value.name, newQuantity);
                  }}
                  className="size-quantity-input"
                  disabled={!available}
                  placeholder="0"
                />
              </div>
              <div className="size-price">${price.toFixed(2)}</div>
              <div className="size-stock">
                {stockQuantity > 0 ? (
                  <>
                    <span className="stock-quantity">
                      {stockQuantity >= 999 ? '999+' : stockQuantity}
                    </span>
                    <span className="stock-label"> In Stock</span>
                  </>
                ) : (
                  <span className="stock-label out-of-stock">Out of Stock</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {onAddToCart && (
        <div className="size-selector-add-to-cart-wrapper">
          <AddToCartButton
            disabled={cartLines.length === 0 || addToCartDisabled}
            onClick={onAddToCart}
            lines={cartLines}
          >
            ADD TO CART
          </AddToCartButton>
        </div>
      )}
    </div>
  );
}

/**
 * @param {{
 *   swatch?: Maybe<ProductOptionValueSwatch> | undefined;
 *   name: string;
 * }}
 */
function ProductOptionSwatch({ swatch, name }) {
  const image = swatch?.image?.previewImage?.url;
  const color = swatch?.color;

  if (!image && !color) return name;

  return (
    <div
      aria-label={name}
      className="product-option-label-swatch"
      style={{
        backgroundColor: color || 'transparent',
      }}
    >
      {!!image && <img src={image} alt={name} />}
    </div>
  );
}

/** @typedef {import('@shopify/hydrogen').MappedProductOptions} MappedProductOptions */
/** @typedef {import('@shopify/hydrogen/storefront-api-types').Maybe} Maybe */
/** @typedef {import('@shopify/hydrogen/storefront-api-types').ProductOptionValueSwatch} ProductOptionValueSwatch */
/** @typedef {import('storefrontapi.generated').ProductFragment} ProductFragment */
