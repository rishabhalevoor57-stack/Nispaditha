import { useMemo, useCallback } from 'react';
import type { InvoiceItem, InvoiceTotals, Product } from '@/types/invoice';

const GST_PERCENTAGE = 3;

export function useInvoiceCalculations(items: InvoiceItem[]) {
  const totals = useMemo<InvoiceTotals>(() => {
    const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
    const discountAmount = items.reduce((sum, item) => sum + item.discount, 0);
    const gstAmount = subtotal * (GST_PERCENTAGE / 100);
    const grandTotal = subtotal + gstAmount;

    return { subtotal, discountAmount, gstAmount, grandTotal };
  }, [items]);

  const createInvoiceItem = useCallback((product: Product, ratePerGram: number): InvoiceItem => {
    // Base Price = Weight × Rate × Quantity
    const basePrice = product.weight_grams * ratePerGram * 1; // quantity starts at 1
    const makingCharges = product.making_charges;
    const discount = 0;
    const discountedMaking = makingCharges - discount;
    // Line Total = Base Price + Discounted Making Charges
    const lineTotal = basePrice + discountedMaking;

    return {
      product_id: product.id,
      sku: product.sku,
      product_name: product.name,
      category: product.categories?.name || '',
      weight_grams: product.weight_grams,
      quantity: 1,
      rate_per_gram: ratePerGram,
      base_price: basePrice,
      making_charges: makingCharges,
      discount: discount,
      discounted_making: discountedMaking,
      line_total: lineTotal,
      gst_percentage: GST_PERCENTAGE,
    };
  }, []);

  const updateItemDiscount = useCallback((item: InvoiceItem, discount: number): InvoiceItem => {
    const discountedMaking = Math.max(0, item.making_charges - discount);
    const lineTotal = item.base_price + discountedMaking;

    return {
      ...item,
      discount,
      discounted_making: discountedMaking,
      line_total: lineTotal,
    };
  }, []);

  const updateItemQuantity = useCallback((item: InvoiceItem, quantity: number): InvoiceItem => {
    const basePrice = item.weight_grams * item.rate_per_gram * quantity;
    const lineTotal = basePrice + item.discounted_making;

    return {
      ...item,
      quantity,
      base_price: basePrice,
      line_total: lineTotal,
    };
  }, []);

  const updateItemRate = useCallback((item: InvoiceItem, rate: number): InvoiceItem => {
    const basePrice = item.weight_grams * rate * item.quantity;
    const lineTotal = basePrice + item.discounted_making;

    return {
      ...item,
      rate_per_gram: rate,
      base_price: basePrice,
      line_total: lineTotal,
    };
  }, []);

  return {
    totals,
    createInvoiceItem,
    updateItemDiscount,
    updateItemQuantity,
    updateItemRate,
  };
}
