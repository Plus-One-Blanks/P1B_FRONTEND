import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { getProductOptions } from '@shopify/hydrogen';
import { AddToCartButton } from './AddToCartButton';
import { useAside } from './Aside';
import { getActiveTier, getTierPrice, BULK_TIERS } from './BulkPricingTiers';

/**
 * @param {{
 *   productOptions: MappedProductOptions[];
 *   selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
 *   selectedColorProduct?: ProductFragment | null;
 *   activeTier?: object | null;
 *   currentCartTotal?: number;
 *   onProjectedTotalChange?: (total: number) => void;
 * }}
 */
export function ProductForm({
  productOptions,
  selectedVariant,
  selectedColorProduct,
  activeTier,
  currentCartTotal = 0,
  onProjectedTotalChange,
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

  // Check if this is an accessory (single size) or product with multiple sizes
  const isAccessory =
    effectiveSizeOption && effectiveSizeOption.optionValues.length === 1;
  const hasMultipleSizes =
    effectiveSizeOption && effectiveSizeOption.optionValues.length > 1;

  // If we have a Size option with multiple values, use the new size selector with S-4XL
  if (hasMultipleSizes) {
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
            const qty = updated[value.name] || 0;
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
      const normalizedSizeName = sizeName?.trim();
      const matchingVariant = selectedColorProduct.adjacentVariants.find((variant) => {
        if (!variant?.selectedOptions) return false;
        if (variant.product?.handle !== selectedColorProduct.handle) {
          return false;
        }
        const sizeOption = variant.selectedOptions.find(
          (opt) => opt?.name?.toLowerCase() === 'size',
        );
        if (!sizeOption) return false;
        const variantSizeValue = sizeOption.value?.trim();
        return variantSizeValue === normalizedSizeName;
      });
      return matchingVariant || null;
    };

    // Build cart lines using variants from the selected color product
    const cartLines = effectiveSizeOption.optionValues
      .filter((value) => {
        const quantity = sizeQuantities[value.name];
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
          quantity: sizeQuantities[value.name],
          selectedVariant: variant,
        };
      })
      .filter((line) => line.merchandiseId);

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
          cartLines={cartLines}
          onAddToCart={() => open('cart')}
          activeTier={activeTier}
          currentCartTotal={currentCartTotal}
          alwaysShowSizes={['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']}
        />
      </div>
    );
  }

  // If it's an accessory (single size), show "One Size" block
  if (isAccessory) {
    const variant = effectiveSelectedVariant;
    const basePrice = variant?.price?.amount ? parseFloat(variant.price.amount) : 0;

    // Get quantity for one size
    const oneSizeQuantity = sizeQuantities['One Size'] || 0;

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
          'One Size': quantity,
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
              <div className="size-label">One Size</div>
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
              disabled={cartLines.length === 0}
              onClick={() => open('cart')}
              lines={cartLines}
            >
              ADD TO CART
            </AddToCartButton>
          </div>
        </div>
      </div>
    );
  }

  // Standard form for non-size options
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
        disabled={!effectiveSelectedVariant || !effectiveSelectedVariant.availableForSale}
        onClick={() => open('cart')}
        lines={
          effectiveSelectedVariant
            ? [
              {
                merchandiseId: effectiveSelectedVariant.id,
                quantity: 1,
                selectedVariant: effectiveSelectedVariant,
              },
            ]
            : []
        }
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
        to={`/products/${handle}?${variantUriQuery}`}
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
}) {
  // Helper function to find variant by size in the selected color product
  const findVariantForSize = (sizeName) => {
    if (!selectedColorProduct || !selectedColorProduct.adjacentVariants) {
      return null;
    }

    // Normalize the size name for comparison
    const normalizedSizeName = sizeName?.trim();

    // Find variant in selected color product that matches this size
    // Match by comparing the size option value (case-insensitive for option name, exact for value)
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

      // Compare size values (trim and exact match)
      const variantSizeValue = sizeOption.value?.trim();
      return variantSizeValue === normalizedSizeName;
    });

    return matchingVariant || null;
  };


  // Always show S-4XL sizes regardless of what's available
  const standardSizes = alwaysShowSizes || ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

  // Create a map of available sizes for quick lookup
  const availableSizesMap = new Map();
  sizeOption.optionValues.forEach((value) => {
    availableSizesMap.set(value.name, value);
  });

  return (
    <div className="size-selector-with-quantities">
      <h5 className="size-selector-title">Choose Size</h5>
      <div className="size-selector-grid">
        {standardSizes.map((sizeName) => {
          // Get the value from available sizes, or create a placeholder
          const value = availableSizesMap.get(sizeName) || {
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
              (v) => v.name === value.name,
            );
            const candidateVariant = colorSizeValue?.firstSelectableVariant;

            // Verify the variant belongs to the selected color product and matches the size
            if (candidateVariant) {
              const variantSizeOption = candidateVariant.selectedOptions?.find(
                (opt) => opt?.name?.toLowerCase() === 'size',
              );
              const variantSizeValue = variantSizeOption?.value?.trim();

              if (candidateVariant.product?.handle === selectedColorProduct.handle &&
                variantSizeValue === value.name.trim()) {
                variant = candidateVariant;
              }
            }
          }

          // Only fallback to original product's variant if we don't have a selected color product
          if (!variant && !selectedColorProduct) {
            variant = value.firstSelectableVariant;
          }

          const quantity = sizeQuantities[value.name] || 0;
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
            disabled={cartLines.length === 0}
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
