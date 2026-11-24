import { describe, expect, it } from 'vitest';
import { calculateServiceInvoiceSettlement } from '@/lib/serviceInvoiceSettlement';

describe('service invoice payment settlement', () => {
  it('records a ₹250 advance once and leaves ₹750 due on a ₹1,000 bill', () => {
    expect(calculateServiceInvoiceSettlement(1000, 250)).toEqual({
      amountPaid: 250,
      balanceDue: 750,
      paymentStatus: 'partial',
      invoiceStatus: 'sent',
    });
  });

  it('leaves the full ₹1,000 due when no payment was received', () => {
    expect(calculateServiceInvoiceSettlement(1000, 0)).toEqual({
      amountPaid: 0,
      balanceDue: 1000,
      paymentStatus: 'pending',
      invoiceStatus: 'sent',
    });
  });

  it('marks a fully paid ₹1,000 service invoice settled', () => {
    expect(calculateServiceInvoiceSettlement(1000, 1000)).toEqual({
      amountPaid: 1000,
      balanceDue: 0,
      paymentStatus: 'paid',
      invoiceStatus: 'paid',
    });
  });
});