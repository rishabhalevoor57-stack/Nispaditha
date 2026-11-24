import { PAYMENT_TOLERANCE } from '@/lib/moneyTolerance';

export type ServiceInvoicePaymentStatus = 'paid' | 'partial' | 'pending';

export interface ServiceInvoiceSettlement {
  amountPaid: number;
  balanceDue: number;
  paymentStatus: ServiceInvoicePaymentStatus;
  invoiceStatus: 'paid' | 'sent';
}

export function calculateServiceInvoiceSettlement(
  chargeAmount: number,
  amountReceived: number,
): ServiceInvoiceSettlement {
  const total = Math.max(0, Number.isFinite(chargeAmount) ? chargeAmount : 0);
  const received = Math.min(
    total,
    Math.max(0, Number.isFinite(amountReceived) ? amountReceived : 0),
  );
  const amountPaid = Math.round(received * 100) / 100;
  const rawBalance = Math.max(0, Math.round((total - amountPaid) * 100) / 100);
  const settled = amountPaid > 0 && rawBalance <= PAYMENT_TOLERANCE;

  return {
    amountPaid,
    balanceDue: settled ? 0 : rawBalance,
    paymentStatus: amountPaid === 0 ? 'pending' : settled ? 'paid' : 'partial',
    invoiceStatus: settled ? 'paid' : 'sent',
  };
}