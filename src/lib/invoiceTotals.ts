/**
 * Single authoritative invoice total calculation.
 *
 * Flow (must never be duplicated elsewhere):
 *   itemsSubtotal (post item-discount sum of line totals)
 *   -> taxable / gstAmount, per GST mode
 *   -> amountBeforeRoundOff
 *   -> grandTotal = amountBeforeRoundOff + roundOff   (roundOff applied exactly ONCE)
 *
 * Round off is signed: negative subtracts, positive adds, zero does nothing.
 */

export type InvoiceGstMode = 'exclusive' | 'inclusive';

export interface GrandTotalInput {
  /** Sum of line totals (MRP − item discount). Always pre-round-off. */
  subtotal: number;
  /** GST amount: added on top when exclusive, already inside subtotal when inclusive. */
  gstAmount?: number;
  gstMode?: InvoiceGstMode;
  /** Signed round-off adjustment. */
  roundOff?: number;
}

export const round2 = (value: number): number =>
  Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100;

/** Invoice total BEFORE the round-off adjustment. */
export function amountBeforeRoundOff({ subtotal, gstAmount = 0, gstMode = 'exclusive' }: GrandTotalInput): number {
  const sub = Number(subtotal) || 0;
  const gst = Number(gstAmount) || 0;
  return round2(gstMode === 'inclusive' ? sub : sub + gst);
}

/** Final invoice grand total. Round off is applied here and nowhere else. */
export function computeGrandTotal(input: GrandTotalInput): number {
  return round2(amountBeforeRoundOff(input) + (Number(input.roundOff) || 0));
}
