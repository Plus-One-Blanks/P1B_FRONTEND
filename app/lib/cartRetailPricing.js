/**
 * PDP `ProductPricingBoxes` uses sale price × 2 as “Retail Price”. Cart strikethroughs
 * and summary savings use the same rule so messaging stays consistent.
 */
export const PDP_RETAIL_PRICE_MULTIPLIER = 2;

/**
 * @param {{ price?: { amount?: string } | null } | null | undefined} merchandise
 */
export function retailUnitPriceFromMerchandise(merchandise) {
  const unit = parseFloat(merchandise?.price?.amount || 0);
  if (!(unit > 0)) return 0;
  return unit * PDP_RETAIL_PRICE_MULTIPLIER;
}

/**
 * @param {{ merchandise?: unknown; quantity?: number } | null | undefined} line
 */
export function retailLineTotalForLine(line) {
  const u = retailUnitPriceFromMerchandise(line?.merchandise);
  const q = Number(line?.quantity ?? 0);
  return Math.round(u * q * 100) / 100;
}

/**
 * Sum of PDP-style retail line totals for all cart lines.
 *
 * @param {unknown[] | { nodes?: unknown[] } | null | undefined} linesOrConnection
 */
export function cartRetailSubtotalFromLines(linesOrConnection) {
  const nodes = Array.isArray(linesOrConnection)
    ? linesOrConnection
    : linesOrConnection?.nodes ?? [];
  let sum = 0;
  for (const line of nodes) {
    sum += retailUnitPriceFromMerchandise(line?.merchandise) * Number(line?.quantity ?? 0);
  }
  return Math.round(sum * 100) / 100;
}
