import type { InvoiceTotals } from '@/types/invoice';

interface InvoiceTotalsSectionProps {
  totals: InvoiceTotals;
  isAdmin: boolean;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
};

export function InvoiceTotalsSection({ totals, isAdmin }: InvoiceTotalsSectionProps) {
  return (
    <div className="bg-muted/30 rounded-lg p-4 space-y-2">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Subtotal</span>
        <span>{formatCurrency(totals.subtotal)}</span>
      </div>
      {isAdmin && totals.discountAmount > 0 && (
        <div className="flex justify-between text-destructive">
          <span>Total Discount (on MC)</span>
          <span>-{formatCurrency(totals.discountAmount)}</span>
        </div>
      )}
      <div className="flex justify-between">
        <span className="text-muted-foreground">GST (3%)</span>
        <span>{formatCurrency(totals.gstAmount)}</span>
      </div>
      <div className="flex justify-between text-lg font-bold pt-2 border-t">
        <span>Grand Total</span>
        <span className="text-primary">{formatCurrency(totals.grandTotal)}</span>
      </div>
    </div>
  );
}
