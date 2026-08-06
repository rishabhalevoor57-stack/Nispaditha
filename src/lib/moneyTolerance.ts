/**
 * Shared money comparison tolerance (₹).
 *
 * Round-off on GST invoices can legitimately leave a sub-rupee difference
 * between the grand total and the amount actually collected. Anything within
 * this band is treated as settled — it must never surface as "Excess Received"
 * or as an outstanding balance.
 */
export const PAYMENT_TOLERANCE = 1;
