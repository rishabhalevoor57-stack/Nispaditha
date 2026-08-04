import type { InvoiceTotals } from '@/types/invoice';
import type { GstMode } from '@/hooks/useInvoiceCalculations';

interface InvoiceTotalsSectionProps {
  totals: InvoiceTotals;
  isAdmin: boolean;
  gstPercentage?: number;
  roundOff?: number;
  gstMode?: GstMode;
  /** Order-level discount (e.g. carried over from a custom order). Part of totals.discountAmount. */
  orderDiscount?: number;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
};

export function InvoiceTotalsSection({
  totals,
  isAdmin,
  gstPercentage = 3,
  roundOff = 0,
  gstMode = 'exclusive',
  orderDiscount = 0,
}: InvoiceTotalsSectionProps) {
  const isInclusive = gstMode === 'inclusive';
  // MRP (Total) is always the gross pre-discount value: subtotal (post-discount) + discount.
  // Inclusive mode additionally shows the GST that is baked inside that price.
  const mrpTotal = totals.subtotal + totals.discountAmount;
  const orderDisc = Math.min(Math.max(0, orderDiscount), totals.discountAmount);
  const itemDisc = Math.max(0, totals.discountAmount - orderDisc);
  const cgst = totals.gstAmount / 2;
  const sgst = totals.gstAmount / 2;
  // Inclusive: GST is inside the price; grand total = subtotal + roundOff (no GST on top).
  // Exclusive: GST is added on top.
  const grandTotal = isInclusive
    ? totals.subtotal + roundOff
    : totals.subtotal + totals.gstAmount + roundOff;

  return (
    <div className="bg-muted/30 rounded-lg p-5 space-y-2.5 text-[15px]">
      <div className="flex justify-between text-lg font-bold">
        <span>MRP (Total)</span>
        <span className="tabular-nums">{formatCurrency(mrpTotal)}</span>
      </div>
      {isAdmin && itemDisc > 0 && (
        <div className="flex justify-between text-destructive font-medium">
          <span>{orderDisc > 0 ? '− Item Discount' : '− Discount'}</span>
          <span className="tabular-nums">−{formatCurrency(itemDisc)}</span>
        </div>
      )}
      {isAdmin && orderDisc > 0 && (
        <div className="flex justify-between text-destructive font-medium">
          <span>− Order Discount</span>
          <span className="tabular-nums">−{formatCurrency(orderDisc)}</span>
        </div>
      )}
      {isInclusive && totals.gstAmount > 0 && (
        <div className="flex justify-between text-destructive">
          <span>− GST Included</span>
          <span className="tabular-nums">−{formatCurrency(totals.gstAmount)}</span>
        </div>
      )}
      <div className="flex justify-between">
        <span className="text-muted-foreground">CGST @ {(gstPercentage / 2).toFixed(2)}%</span>
        <span className="tabular-nums">{formatCurrency(cgst)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">SGST @ {(gstPercentage / 2).toFixed(2)}%</span>
        <span className="tabular-nums">{formatCurrency(sgst)}</span>
      </div>
      {roundOff !== 0 && (
        <div className="flex justify-between text-muted-foreground italic">
          <span>{roundOff >= 0 ? 'Round Off' : '− Round Off'}</span>
          <span className="tabular-nums">{formatCurrency(Math.abs(roundOff))}</span>
        </div>
      )}
      <div
        className="flex items-center justify-between mt-3 px-5 py-4 rounded-md text-white font-bold"
        style={{ background: '#4a2060' }}
      >
        <span className="uppercase tracking-wider text-base">Grand Total</span>
        <span className="tabular-nums text-2xl">{formatCurrency(grandTotal)}</span>
      </div>
    </div>
  );
}
