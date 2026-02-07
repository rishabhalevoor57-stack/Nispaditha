import { useMemo, useCallback } from 'react';
import type { InvoiceItem, InvoiceTotals, Product, DiscountType } from '@/types/invoice';

const GST_PERCENTAGE = 3;

function calculateDiscount(makingCharges: number, discountType: DiscountType, discountValue: number): number {
  if (discountType === 'percentage') {
    return Math.min(makingCharges, makingCharges * (discountValue / 100));
  }
  return Math.min(makingCharges, discountValue);
}

export function useInvoiceCalculations(items: InvoiceItem[]) {
  const totals = useMemo<InvoiceTotals>(() => {
    const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
    const discountAmount = items.reduce((sum, item) => sum + item.discount, 0);
    const gstAmount = subtotal * (GST_PERCENTAGE / 100);
    const grandTotal = subtotal + gstAmount;

    return { subtotal, discountAmount, gstAmount, grandTotal };
  }, [items]);

  const createInvoiceItem = useCallback((product: Product, ratePerGram: number): InvoiceItem => {
    const pricingMode = product.pricing_mode || 'weight_based';

    if (pricingMode === 'flat_price') {
      // Flat price: use selling_price directly, no weight/rate/MC calculations
      const lineTotal = product.selling_price;
      return {
        product_id: product.id,
        sku: product.sku,
        product_name: product.name,
        category: product.categories?.name || '',
        weight_grams: product.weight_grams || 0,
        quantity: 1,
        rate_per_gram: 0,
        base_price: product.selling_price,
        making_charges: 0,
        making_charges_per_gram: 0,
        discount: 0,
        discount_type: 'fixed' as DiscountType,
        discount_value: 0,
        discounted_making: 0,
        line_total: lineTotal,
        gst_percentage: GST_PERCENTAGE,
        pricing_mode: 'flat_price',
        selling_price: product.selling_price,
        mrp: product.mrp || 0,
      };
    }

    // Weight based pricing — making_charges on product is MC per gram
    const makingChargesPerGram = product.making_charges; // per gram value
    const basePrice = product.weight_grams * ratePerGram * 1;
    const makingCharges = makingChargesPerGram * product.weight_grams * 1;
    const discount = 0;
    const discountedMaking = makingCharges - discount;
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
      making_charges_per_gram: makingChargesPerGram,
      discount: discount,
      discount_type: 'fixed' as DiscountType,
      discount_value: 0,
      discounted_making: discountedMaking,
      line_total: lineTotal,
      gst_percentage: GST_PERCENTAGE,
      pricing_mode: 'weight_based',
      mrp: product.mrp || 0,
    };
  }, []);

  const updateItemDiscount = useCallback((item: InvoiceItem, discountValue: number, discountType: DiscountType): InvoiceItem => {
    if (item.pricing_mode === 'flat_price') {
      // Flat price: discount applies on total amount (selling_price * quantity)
      const grossTotal = (item.selling_price || item.base_price) * item.quantity;
      const discount = discountType === 'percentage'
        ? Math.min(grossTotal, grossTotal * (discountValue / 100))
        : Math.min(grossTotal, discountValue);
      const lineTotal = grossTotal - discount;

      return {
        ...item,
        discount,
        discount_type: discountType,
        discount_value: discountValue,
        line_total: lineTotal,
      };
    }

    const discount = calculateDiscount(item.making_charges, discountType, discountValue);
    const discountedMaking = Math.max(0, item.making_charges - discount);
    const lineTotal = item.base_price + discountedMaking;

    return {
      ...item,
      discount,
      discount_type: discountType,
      discount_value: discountValue,
      discounted_making: discountedMaking,
      line_total: lineTotal,
    };
  }, []);

  const updateItemQuantity = useCallback((item: InvoiceItem, quantity: number): InvoiceItem => {
    if (item.pricing_mode === 'flat_price') {
      const grossTotal = (item.selling_price || item.base_price / item.quantity) * quantity;
      // Re-apply discount on new quantity
      const discount = item.discount_value > 0
        ? (item.discount_type === 'percentage'
          ? Math.min(grossTotal, grossTotal * (item.discount_value / 100))
          : Math.min(grossTotal, item.discount_value))
        : 0;
      const lineTotal = grossTotal - discount;
      return {
        ...item,
        quantity,
        base_price: grossTotal,
        discount,
        line_total: lineTotal,
      };
    }

    // Weight based: MC also scales with quantity
    const basePrice = item.weight_grams * item.rate_per_gram * quantity;
    const makingCharges = item.making_charges_per_gram * item.weight_grams * quantity;
    // Re-apply discount on new MC amount
    const discount = calculateDiscount(makingCharges, item.discount_type, item.discount_value);
    const discountedMaking = Math.max(0, makingCharges - discount);
    const lineTotal = basePrice + discountedMaking;

    return {
      ...item,
      quantity,
      base_price: basePrice,
      making_charges: makingCharges,
      discount,
      discounted_making: discountedMaking,
      line_total: lineTotal,
    };
  }, []);

  const updateItemRate = useCallback((item: InvoiceItem, rate: number): InvoiceItem => {
    // No rate change for flat price items
    if (item.pricing_mode === 'flat_price') return item;

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
