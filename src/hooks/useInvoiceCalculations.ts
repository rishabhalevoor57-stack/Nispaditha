import { useMemo, useCallback } from 'react';
import type { InvoiceItem, InvoiceTotals, Product, DiscountType } from '@/types/invoice';

const GST_PERCENTAGE = 3;

export type GstMode = 'exclusive' | 'inclusive';

function calculateDiscount(makingCharges: number, discountType: DiscountType, discountValue: number): number {
  if (discountType === 'percentage') {
    return Math.min(makingCharges, makingCharges * (discountValue / 100));
  }
  return Math.min(makingCharges, discountValue);
}

function calculateGrossMrp(basePrice: number, makingCharges: number): number {
  return Math.max(0, basePrice + makingCharges);
}

function scaleMrp(previousMrp: number, previousGross: number, nextGross: number): number {
  if (previousGross <= 0) return Math.max(0, nextGross);
  const ratio = previousMrp > 0 ? previousMrp / previousGross : 1;
  return Math.max(0, nextGross * ratio);
}

export function useInvoiceCalculations(
  items: InvoiceItem[],
  gstPct: number = GST_PERCENTAGE,
  gstMode: GstMode = 'exclusive',
) {
  const totals = useMemo<InvoiceTotals>(() => {
    // subtotal = sum of line_totals = MRP - discount per item.
    // Exclusive mode: subtotal is the taxable amount, GST is added on top.
    // Inclusive mode: subtotal already includes GST, GST is extracted from it.
    const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
    const discountAmount = items.reduce((sum, item) => sum + item.discount, 0);

    let gstAmount: number;
    let grandTotal: number;
    if (gstMode === 'inclusive') {
      const divisor = 1 + (gstPct / 100);
      const taxable = divisor > 0 ? subtotal / divisor : subtotal;
      gstAmount = Math.max(0, subtotal - taxable);
      grandTotal = subtotal; // GST is already baked into the price.
    } else {
      gstAmount = subtotal * (gstPct / 100);
      grandTotal = subtotal + gstAmount;
    }

    return { subtotal, discountAmount, gstAmount, grandTotal };
  }, [items, gstPct, gstMode]);

  const createInvoiceItem = useCallback((product: Product, ratePerGram: number): InvoiceItem => {
    const pricingMode = product.pricing_mode || 'weight_based';

    if (pricingMode === 'flat_price') {
      // Flat price: use selling_price directly, no weight/rate/MC calculations
      const grossMrp = product.selling_price;
      const mrp = product.mrp > 0 ? product.mrp : grossMrp;
      const lineTotal = Math.max(0, mrp);
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
        mrp,
      };
    }

    // Weight based pricing — making_charges on product is MC per gram
    const makingChargesPerGram = product.making_charges; // per gram value
    const basePrice = product.weight_grams * ratePerGram * 1;
    const makingCharges = makingChargesPerGram * product.weight_grams * 1;
    const discount = 0;
    const discountedMaking = makingCharges - discount;
    const grossMrp = calculateGrossMrp(basePrice, makingCharges);
    const mrp = product.mrp > 0 ? product.mrp : grossMrp;
    const lineTotal = Math.max(0, mrp - discount);

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
      mrp,
    };
  }, []);

  const updateItemDiscount = useCallback((item: InvoiceItem, discountValue: number, discountType: DiscountType): InvoiceItem => {
    if (item.pricing_mode === 'flat_price') {
      // Flat price: discount applies on total amount (selling_price * quantity)
      const grossTotal = (item.selling_price || item.base_price) * item.quantity;
      const discount = discountType === 'percentage'
        ? Math.min(grossTotal, grossTotal * (discountValue / 100))
        : Math.min(grossTotal, discountValue);
      const lineTotal = Math.max(0, item.mrp - discount);

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
    const lineTotal = Math.max(0, item.mrp - discount);

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
      const mrpPerUnit = item.quantity > 0 ? item.mrp / item.quantity : grossTotal;
      const mrp = Math.max(0, mrpPerUnit * quantity);
      // Re-apply discount on new quantity
      const discount = item.discount_value > 0
        ? (item.discount_type === 'percentage'
          ? Math.min(grossTotal, grossTotal * (item.discount_value / 100))
          : Math.min(grossTotal, item.discount_value))
        : 0;
      const lineTotal = Math.max(0, mrp - discount);
      return {
        ...item,
        quantity,
        base_price: grossTotal,
        mrp,
        discount,
        line_total: lineTotal,
      };
    }

    // Weight based: MC also scales with quantity
    const previousGross = calculateGrossMrp(item.base_price, item.making_charges);
    const basePrice = item.weight_grams * item.rate_per_gram * quantity;
    const makingCharges = item.making_charges_per_gram * item.weight_grams * quantity;
    const nextGross = calculateGrossMrp(basePrice, makingCharges);
    const mrp = scaleMrp(item.mrp, previousGross, nextGross);
    // Re-apply discount on new MC amount
    const discount = calculateDiscount(makingCharges, item.discount_type, item.discount_value);
    const discountedMaking = Math.max(0, makingCharges - discount);
    const lineTotal = Math.max(0, mrp - discount);

    return {
      ...item,
      quantity,
      base_price: basePrice,
      making_charges: makingCharges,
      mrp,
      discount,
      discounted_making: discountedMaking,
      line_total: lineTotal,
    };
  }, []);

  const updateItemRate = useCallback((item: InvoiceItem, rate: number): InvoiceItem => {
    // No rate change for flat price items
    if (item.pricing_mode === 'flat_price') return item;

    const previousGross = calculateGrossMrp(item.base_price, item.making_charges);
    const basePrice = item.weight_grams * rate * item.quantity;
    const nextGross = calculateGrossMrp(basePrice, item.making_charges);
    const mrp = scaleMrp(item.mrp, previousGross, nextGross);
    const lineTotal = Math.max(0, mrp - item.discount);

    return {
      ...item,
      rate_per_gram: rate,
      base_price: basePrice,
      mrp,
      line_total: lineTotal,
    };
  }, []);

  const updateItemWeight = useCallback((item: InvoiceItem, weight: number): InvoiceItem => {
    if (item.pricing_mode === 'flat_price') return item;
    const w = Math.max(0, weight);
    const previousGross = calculateGrossMrp(item.base_price, item.making_charges);
    const basePrice = w * item.rate_per_gram * item.quantity;
    const makingCharges = item.making_charges_per_gram * w * item.quantity;
    const nextGross = calculateGrossMrp(basePrice, makingCharges);
    const mrp = scaleMrp(item.mrp, previousGross, nextGross);
    const discount = calculateDiscount(makingCharges, item.discount_type, item.discount_value);
    const discountedMaking = Math.max(0, makingCharges - discount);
    const lineTotal = Math.max(0, mrp - discount);
    return {
      ...item,
      weight_grams: w,
      base_price: basePrice,
      making_charges: makingCharges,
      mrp,
      discount,
      discounted_making: discountedMaking,
      line_total: lineTotal,
    };
  }, []);

  const updateItemMakingCharges = useCallback((item: InvoiceItem, mcPerGram: number): InvoiceItem => {
    if (item.pricing_mode === 'flat_price') return item;
    const mcg = Math.max(0, mcPerGram);
    const previousGross = calculateGrossMrp(item.base_price, item.making_charges);
    const makingCharges = mcg * item.weight_grams * item.quantity;
    const nextGross = calculateGrossMrp(item.base_price, makingCharges);
    const mrp = scaleMrp(item.mrp, previousGross, nextGross);
    const discount = calculateDiscount(makingCharges, item.discount_type, item.discount_value);
    const discountedMaking = Math.max(0, makingCharges - discount);
    const lineTotal = Math.max(0, mrp - discount);
    return {
      ...item,
      making_charges_per_gram: mcg,
      making_charges: makingCharges,
      mrp,
      discount,
      discounted_making: discountedMaking,
      line_total: lineTotal,
    };
  }, []);

  const updateItemMrp = useCallback((item: InvoiceItem, mrpValue: number): InvoiceItem => {
    const mrp = Math.max(0, mrpValue);
    return {
      ...item,
      mrp,
      line_total: Math.max(0, mrp - item.discount),
    };
  }, []);

  return {
    totals,
    createInvoiceItem,
    updateItemDiscount,
    updateItemQuantity,
    updateItemRate,
    updateItemWeight,
    updateItemMakingCharges,
    updateItemMrp,
  };
}
