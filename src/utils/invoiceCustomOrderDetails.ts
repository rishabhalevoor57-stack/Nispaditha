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
        total: Number(item.line_total) || 0,
      })),
    charges: items
      .filter((item) => item.category === 'Service Charge')
      .map((item) => ({ label: item.product_name, amount: Number(item.line_total) || 0 })),
  });
};