/**
 * Bulk pricing tiers configuration
 * These should match the discount codes created in Shopify Admin
 */
export const BULK_TIERS = [
  { threshold: 99, code: 'BULK99', label: '$99+' },
  { threshold: 250, code: 'BULK250', label: '$250+' },
  { threshold: 500, code: 'BULK500', label: '$500+' },
  { threshold: 1000, code: 'BULK1000', label: '$1000+' },
];

/**
 * Calculate adjusted price based on tier using percentage discounts
 * @param {number} basePrice - Base price
 * @param {number} tierIndex - Index of the tier (0 = highest, 3 = lowest)
 * @returns {number}
 */
export function getTierPrice(basePrice, tierIndex) {
  // Percentage discounts per tier (matches Shopify discount codes)
  // These percentages are calculated to achieve the target price reductions
  // BULK99: 0.30% off, BULK250: 0.76% off, BULK500: 1.21% off, BULK1000: 1.52% off
  const percentages = [0.30, 0.76, 1.21, 1.52]; // Percentage off per tier (ordered from lowest to highest threshold)
  const discountPercent = percentages[tierIndex] || 0;
  const discountAmount = (basePrice * discountPercent) / 100;
  return Math.max(0, basePrice - discountAmount);
}

/**
 * Get active tier based on cart total
 * Returns the highest tier that applies (best discount)
 * @param {number} cartTotal - Cart subtotal amount
 * @returns {object|null}
 */
export function getActiveTier(cartTotal) {
  // Find the highest tier that applies (since tiers are ordered from lowest to highest)
  const applicableTiers = BULK_TIERS.filter(t => cartTotal >= t.threshold);
  return applicableTiers.length > 0
    ? applicableTiers[applicableTiers.length - 1] // Return the highest applicable tier
    : null;
}

/**
 * Static bulk pricing tiers display component
 * @param {{
 *   basePrice?: number; // Legacy support - will use whiteBasePrice if not provided
 *   whiteBasePrice?: number; // Base price for white products
 *   colorBasePrice?: number; // Base price for colored products
 * }}
 */
export function BulkPricingTiers({ basePrice, whiteBasePrice, colorBasePrice }) {
  // Use provided white/color prices, or fall back to basePrice for both
  const whitePrice = whiteBasePrice || basePrice || 0;
  const colorPrice = colorBasePrice || basePrice || 0;

  // Calculate discount percentage based on retail price (basePrice * 2)
  const calculateDiscountPercent = (discountedPrice, basePrice) => {
    const retailPrice = basePrice * 2;
    if (retailPrice === 0) return 0;
    const discount = ((retailPrice - discountedPrice) / retailPrice) * 100;
    return Math.round(discount);
  };

  return (
    <div className="bulk-pricing-tiers">
      <h4 className="bulk-pricing-title">Buy More Save More</h4>
      <div className="bulk-pricing-table-container">
        <table className="bulk-pricing-table">
          <thead>
            <tr>
              <th>Cart Total</th>
              <th>White</th>
              <th>Colors</th>
            </tr>
          </thead>
          <tbody>
            {BULK_TIERS.map((tier, index) => {
              const whiteTierPrice = getTierPrice(whitePrice, index);
              const colorTierPrice = getTierPrice(colorPrice, index);
              const whiteDiscountPercent = calculateDiscountPercent(whiteTierPrice, whitePrice);
              const colorDiscountPercent = calculateDiscountPercent(colorTierPrice, colorPrice);

              return (
                <tr key={tier.code}>
                  <td>{tier.label}</td>
                  <td>
                    <div className="tier-price-container">
                      <span className="tier-price">${whiteTierPrice.toFixed(2)}</span>
                      <span className="tier-discount">{whiteDiscountPercent}% off</span>
                    </div>
                  </td>
                  <td>
                    <div className="tier-price-container">
                      <span className="tier-price">${colorTierPrice.toFixed(2)}</span>
                      <span className="tier-discount">{colorDiscountPercent}% off</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="bulk-pricing-size-note">
        Prices are for Sizes S-XL
      </div>
    </div>
  );
}

