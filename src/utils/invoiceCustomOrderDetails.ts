import type { InvoiceCustomOrderDetails, InvoiceItem } from '@/types/invoice';

const DETAILS_MARKER = 'CUSTOM_ORDER_DETAILS_JSON:';

export const stripCustomOrderPayload = (notes?: string | null): string => {
  if (!notes) return '';
  const idx = notes.indexOf(DETAILS_MARKER);
  return (idx >= 0 ? notes.slice(0, idx) : notes).trim();
};

const normaliseDetails = (details: Partial<InvoiceCustomOrderDetails>): InvoiceCustomOrderDetails => ({
  referenceNumber: details.referenceNumber || '',
  orderDate: details.orderDate || null,
  expectedDeliveryDate: details.expectedDeliveryDate || null,
  gstMode: details.gstMode === 'inclusive' ? 'inclusive' : 'exclusive',
  gstPercentage: Number(details.gstPercentage) || 0,
  notes: details.notes || null,
  orderItems: Array.isArray(details.orderItems) ? details.orderItems : [],
  customerMaterials: Array.isArray(details.customerMaterials) ? details.customerMaterials : [],
  components: Array.isArray(details.components) ? details.components : [],
  charges: Array.isArray(details.charges) ? details.charges : [],
});

export const getCustomOrderDetailsFromNotes = (notes?: string | null): InvoiceCustomOrderDetails | null => {
  if (!notes) return null;
  const markerIndex = notes.indexOf(DETAILS_MARKER);
  if (markerIndex < 0) return null;

  const raw = notes.slice(markerIndex + DETAILS_MARKER.length).trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<InvoiceCustomOrderDetails>;
    return normaliseDetails(parsed);
  } catch {
    return null;
  }
};

export const hasCustomOrderDetails = (details?: InvoiceCustomOrderDetails | null): details is InvoiceCustomOrderDetails => {
  if (!details) return false;
  return Boolean(
    details.orderItems.length ||
    details.customerMaterials.length ||
    details.components.length ||
    details.charges.length ||
    details.referenceNumber,
  );
};

/**
 * Display-only rescue: rebuild billing rows from the custom-order payload stored
 * in the invoice notes when the invoice has no saved line items (legacy
 * conversions where the items insert failed). Never used for saving.
 */
export const buildItemsFromCustomOrderDetails = (
  details: InvoiceCustomOrderDetails | null,
): InvoiceItem[] => {
  if (!details) return [];
  const rows: InvoiceItem[] = [];

  const base = (over: Partial<InvoiceItem>): InvoiceItem => ({
    product_id: '',
    sku: '',
    product_name: '',
    category: '',
    weight_grams: 0,
    quantity: 1,
    rate_per_gram: 0,
    base_price: 0,
    making_charges: 0,
    making_charges_per_gram: 0,
    discount: 0,
    discount_type: 'fixed',
    discount_value: 0,
    discounted_making: 0,
    line_total: 0,
    gst_percentage: Number(details.gstPercentage) || 0,
    pricing_mode: 'weight_based',
    mrp: 0,
    ...over,
  });

  for (const it of details.orderItems) {
    const lineTotal = Number(it.line_total) || 0;
    const discount = Number(it.discount) || 0;
    rows.push(base({
      sku: it.sku || 'N/A',
      product_name: it.name,
      category: it.category || 'Custom Order',
      weight_grams: Number(it.weight_grams) || 0,
      quantity: Number(it.quantity) || 1,
      rate_per_gram: Number(it.rate_per_gram) || 0,
      making_charges: Number(it.making_charges) || 0,
      discount,
      discount_value: discount,
      line_total: lineTotal,
      pricing_mode: it.pricing_mode === 'flat_price' ? 'flat_price' : 'weight_based',
      mrp: lineTotal + discount,
      description: it.description || '',
    }));
  }

  for (const c of details.components) {
    const total = Number(c.total) || 0;
    const discount = Number(c.discount) || 0;
    rows.push(base({
      sku: 'N/A',
      product_name: `${c.name}${c.material ? ` (${c.material})` : ''}`,
      category: 'Component',
      weight_grams: Number(c.weight_grams) || 0,
      quantity: Number(c.quantity) || 1,
      rate_per_gram: Number(c.rate_per_gram) || 0,
      discount,
      discount_value: discount,
      line_total: total,
      pricing_mode: (Number(c.rate_per_gram) || 0) > 0 ? 'weight_based' : 'flat_price',
      mrp: total + discount,
    }));
  }

  for (const ch of details.charges) {
    const amount = Number(ch.amount) || 0;
    rows.push(base({
      sku: 'N/A',
      product_name: ch.label,
      category: 'Service Charge',
      line_total: amount,
      pricing_mode: 'flat_price',
      mrp: amount,
    }));
  }

  return rows;
};

export const buildFallbackCustomOrderDetails = (
  notes: string | null | undefined,
  items: InvoiceItem[],
): InvoiceCustomOrderDetails | null => {
  const firstLine = (notes || '').split('\n').find((line) => line.includes('Custom Order')) || '';
  const referenceNumber = firstLine.match(/(?:Custom Order)\s+([A-Z]+-[\w-]+)/i)?.[1] || '';
  if (!referenceNumber) return null;

  return normaliseDetails({
    referenceNumber,
    orderItems: items
      .filter((item) => item.category !== 'Component' && item.category !== 'Service Charge')
      .map((item) => ({
        name: item.product_name,
        sku: item.sku || null,
        category: item.category || null,
        quantity: Number(item.quantity) || 1,
        weight_grams: Number(item.weight_grams) || 0,
        pricing_mode: item.pricing_mode,
        rate_per_gram: Number(item.rate_per_gram) || 0,
        making_charges: Number(item.making_charges) || 0,
        discount: Number(item.discount) || 0,
        line_total: Number(item.line_total) || 0,
        description: item.description || null,
      })),
    components: items
      .filter((item) => item.category === 'Component')
      .map((item) => ({
        name: item.product_name,
        quantity: Number(item.quantity) || 1,
        weight_grams: Number(item.weight_grams) || 0,
        unit_price: item.pricing_mode === 'flat_price' ? Number(item.line_total) || 0 : 0,
        rate_per_gram: Number(item.rate_per_gram) || 0,
        discount: Number(item.discount) || 0,
        total: Number(item.line_total) || 0,
      })),
    charges: items
      .filter((item) => item.category === 'Service Charge')
      .map((item) => ({ label: item.product_name, amount: Number(item.line_total) || 0 })),
  });
};