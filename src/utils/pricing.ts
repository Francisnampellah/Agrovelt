// Shared by products.service.ts (org-wide variant defaults) and
// inventory.service.ts (per-batch prices) so the markup formula only lives
// in one place.
export function computeSellingPriceFromMarkup(costPrice: number, markupPercent: number): number {
  return parseFloat((Number(costPrice) * (1 + Number(markupPercent) / 100)).toFixed(2))
}
