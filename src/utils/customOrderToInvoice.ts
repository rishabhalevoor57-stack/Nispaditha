import { supabase } from '@/integrations/supabase/client';
import type { CustomOrder, CustomOrderItem, CustomOrderComponent } from '@/types/customOrder';
import type { InvoiceCustomOrderDetails } from '@/types/invoice';

export interface ConvertOptions {
  finalize?: boolean; // true = sent/paid, false = draft
  createdBy?: string | null;
}

export interface ConvertResult {
  invoiceId: string;
  invoiceNumber: string;
  clientId: string | null;
}

interface LineItemInput {
  product_id: string | null;
  product_name: string;
  category: string;
  quantity: number;
  weight_grams: number;
  rate_per_gram: number;
  gold_value: number;
  making_charges: number;
  discount: number;
  discounted_making: number;
  subtotal: number; // pre-gst line total
  mrp: number;
  description: string | null;
}

const money = (amount: number): string =>
  `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount) || 0)}`;

const buildChargeLines = (order: CustomOrder): Array<{ label: string; amount: number }> => [
  { label: 'Making Charges', amount: Number(order.making_charges) || 0 },
  { label: 'Design Charges', amount: Number(order.design_charges) || 0 },
  { label: 'Labour Charges', amount: Number(order.labour_charges) || 0 },
  { label: 'Polishing Charges', amount: Number(order.polishing_charges) || 0 },
  { label: 'Repair Charges', amount: Number(order.repair_charges) || 0 },
  { label: order.additional_charge_label || 'Additional Charge', amount: Number(order.additional_charge) || 0 },
  ...((order.extra_charges || []).map(c => ({ label: c.label, amount: Number(c.amount) || 0 }))),
].filter(c => c.amount > 0 && c.label);

const buildCustomOrderDetails = (
  order: CustomOrder,
  items: CustomOrderItem[],
  components: CustomOrderComponent[],
  charges: Array<{ label: string; amount: number }>,
): InvoiceCustomOrderDetails => ({
  referenceNumber: order.reference_number,
  orderDate: order.order_date,
  expectedDeliveryDate: order.expected_delivery_date,
  gstMode: order.gst_mode === 'inclusive' ? 'inclusive' : 'exclusive',
  gstPercentage: Number(order.gst_percentage) || 0,
  notes: order.notes || null,
  orderItems: items
    .filter((it) => (it.item_description || '').trim())
    .map((it) => ({
      name: it.item_description || 'Custom Jewellery Piece',
      sku: it.sku || null,
      category: it.category || null,
      quantity: Number(it.quantity) || 1,
      weight_grams: Number(it.expected_weight) || 0,
      pricing_mode: it.pricing_mode === 'flat_price' ? 'flat_price' : 'weight_based',
      rate_per_gram: Number(it.rate_per_gram) || 0,
      making_charges: Number(it.mc_amount) || 0,
      discount: Number(it.discount) || 0,
      line_total: Number(it.item_total) || 0,
      description: it.customization_notes || null,
      reference_image_url: it.reference_image_url || null,
    })),
  customerMaterials: (order.customer_materials || [])
    .filter((m) => (m.name || '').trim())
    .map((m) => ({
      name: m.name,
      description: m.description || undefined,
      quantity: Number(m.quantity) || undefined,
      weight_grams: Number(m.weight_grams) || undefined,
    })),
  components: components
    .filter((c) => (c.component_name || '').trim())
    .map((c) => ({
      name: c.component_name,
      material: c.material || null,
      quantity: Number(c.quantity) || 1,
      weight_grams: Number(c.weight_grams) || 0,
      unit_price: Number(c.unit_price) || 0,
      rate_per_gram: Number(c.rate_per_gram) || 0,
      total: Number(c.total) || 0,
    })),
  charges,
});

const buildCustomOrderNotes = (order: CustomOrder, details: InvoiceCustomOrderDetails): string => {
  const notesParts: string[] = [`Converted from Custom Order ${order.reference_number}`];
  if (order.notes && order.notes.trim()) {
    notesParts.push('\nNOTES:');
    notesParts.push(order.notes.trim());
  }

  notesParts.push('\nCUSTOM_ORDER_DETAILS_JSON:' + JSON.stringify(details));

  return notesParts.join('\n');
};

const buildInvoiceLines = (
  order: CustomOrder,
  items: CustomOrderItem[],
  components: CustomOrderComponent[],
  chargeLines: Array<{ label: string; amount: number }>,
): LineItemInput[] => {
  const lines: LineItemInput[] = [];

  for (const it of items) {
    const lineTotal = Number(it.item_total) || 0;
    const isFlat = it.pricing_mode === 'flat_price';
    const mrp = isFlat
      ? ((Number(it.flat_price) || lineTotal) * (Number(it.quantity) || 1))
      : (Number(it.base_price) || 0) + (Number(it.mc_amount) || 0);
    lines.push({
      product_id: it.product_id || null,
      product_name: it.item_description || 'Custom Item',
      category: it.category || 'Custom Order',
      quantity: it.quantity || 1,
      weight_grams: isFlat ? 0 : (Number(it.expected_weight) || 0),
      rate_per_gram: isFlat ? 0 : (Number(it.rate_per_gram) || 0),
      gold_value: Number(it.base_price) || 0,
      making_charges: isFlat ? 0 : (Number(it.mc_amount) || 0),
      discount: Number(it.discount) || 0,
      discounted_making: isFlat ? 0 : Math.max(0, (Number(it.mc_amount) || 0) - (Number(it.discount) || 0)),
      subtotal: lineTotal,
      mrp: Math.max(0, mrp || lineTotal),
      description: it.customization_notes || null,
    });
  }

  for (const c of components) {
    const lineTotal = Number(c.total) || 0;
    const wt = Number(c.weight_grams) || 0;
    const qty = Number(c.quantity) || 1;
    const isWeightBased = (Number(c.rate_per_gram) || 0) > 0 && wt > 0;
    lines.push({
      product_id: null,
      product_name: c.component_name + (c.material ? ` (${c.material})` : ''),
      category: 'Component',
      quantity: qty,
      weight_grams: isWeightBased ? wt : 0,
      rate_per_gram: isWeightBased ? (Number(c.rate_per_gram) || 0) : 0,
      gold_value: isWeightBased ? wt * (Number(c.rate_per_gram) || 0) * qty : 0,
      making_charges: 0,
      discount: 0,
      discounted_making: 0,
      subtotal: lineTotal,
      mrp: lineTotal,
      description: null,
    });
  }

  for (const ch of chargeLines) {
    lines.push({
      product_id: null,
      product_name: ch.label,
      category: 'Service Charge',
      quantity: 1,
      weight_grams: 0,
      rate_per_gram: 0,
      gold_value: 0,
      making_charges: 0,
      discount: 0,
      discounted_making: 0,
      subtotal: ch.amount,
      mrp: ch.amount,
      description: null,
    });
  }

  if (lines.length === 0) {
    lines.push({
      product_id: null,
      product_name: `Custom Order ${order.reference_number}`,
      category: 'Custom Order',
      quantity: 1,
      weight_grams: 0,
      rate_per_gram: 0,
      gold_value: 0,
      making_charges: 0,
      discount: 0,
      discounted_making: 0,
      subtotal: Number(order.total_amount) || 0,
      mrp: Number(order.total_amount) || 0,
      description: null,
    });
  }

  return lines;
};

const buildInvoiceData = (order: CustomOrder, items: CustomOrderItem[], components: CustomOrderComponent[]) => {
  const chargeLines = buildChargeLines(order);
  const details = buildCustomOrderDetails(order, items, components, chargeLines);
  const lines = buildInvoiceLines(order, items, components, chargeLines);
  const linesSubtotal = lines.reduce((s, l) => s + l.subtotal, 0);
  const discount = Number(order.flat_discount) || 0;
  const taxableBase = Math.max(0, linesSubtotal - discount);
  const pct = Number(order.gst_percentage) || 0;
  const gstMode = order.gst_mode === 'inclusive' ? 'inclusive' : 'exclusive';
  let gstAmount = 0;
  let grandTotal = 0;
  let subtotalForInvoice = taxableBase;
  if (gstMode === 'inclusive') {
    const divisor = 1 + pct / 100;
    const taxable = divisor > 0 ? taxableBase / divisor : taxableBase;
    gstAmount = Math.max(0, taxableBase - taxable);
    grandTotal = taxableBase;
    subtotalForInvoice = taxable + discount;
  } else {
    gstAmount = taxableBase * (pct / 100);
    grandTotal = taxableBase + gstAmount;
    subtotalForInvoice = linesSubtotal;
  }
  return {
    lines,
    details,
    notes: buildCustomOrderNotes(order, details),
    subtotalForInvoice,
    discount,
    gstAmount,
    grandTotal,
    pct,
    gstMode,
  };
};

const buildItemsPayload = (invoiceId: string, lines: LineItemInput[]) => lines.map(l => ({
  invoice_id: invoiceId,
  product_id: l.product_id,
  product_name: l.product_name,
  category: l.category,
  quantity: l.quantity,
  weight_grams: l.weight_grams,
  rate_per_gram: l.rate_per_gram,
  gold_value: l.gold_value,
  making_charges: l.making_charges,
  discount: l.discount,
  discounted_making: l.discounted_making,
  subtotal: l.subtotal,
  gst_percentage: 0,
  gst_amount: 0,
  total: l.subtotal,
  mrp: l.mrp,
  description: l.description,
}));

/**
 * Resolve or create a client by phone/name. Returns client id (or null).
 */
async function resolveClient(name: string, phone: string | null): Promise<string | null> {
  const cleanPhone = (phone || '').trim();
  const cleanName = (name || '').trim() || 'Walk-in Customer';

  if (cleanPhone) {
    const { data: existing } = await supabase
      .from('clients')
      .select('id, name')
      .eq('phone', cleanPhone)
      .maybeSingle();
    if (existing) {
      if (cleanName && existing.name !== cleanName && cleanName !== 'Walk-in Customer') {
        await supabase.from('clients').update({ name: cleanName }).eq('id', existing.id);
      }
      return existing.id;
    }
  }

  // Create lightweight client so name/phone persist on the invoice
  if (cleanPhone || cleanName !== 'Walk-in Customer') {
    const { data: created } = await supabase
      .from('clients')
      .insert({ name: cleanName, phone: cleanPhone || null } as never)
      .select('id')
      .single();
    return (created as { id: string } | null)?.id || null;
  }
  return null;
}

export async function convertCustomOrderToInvoice(
  order: CustomOrder,
  items: CustomOrderItem[],
  components: CustomOrderComponent[],
  opts: ConvertOptions = {}
): Promise<ConvertResult> {
  const finalize = !!opts.finalize;

  // 1. Generate invoice number
  const { data: invoiceNumber, error: numErr } = await supabase.rpc('generate_invoice_number');
  if (numErr || !invoiceNumber) throw numErr || new Error('Could not generate invoice number');

  // 2. Resolve client (preserve customer details!)
  const clientId = await resolveClient(order.client_name, order.phone_number);

  // 3. Build invoice line items
  const lines: LineItemInput[] = [];

  // (a) Legacy custom order items, if any still exist
  for (const it of items) {
    const lineTotal = Number(it.item_total) || 0;
    lines.push({
      product_id: it.product_id || null,
      product_name: it.item_description || 'Custom Item',
      category: it.category || 'Custom Order',
      quantity: it.quantity || 1,
      weight_grams: it.pricing_mode === 'flat_price' ? 0 : (it.expected_weight || 0),
      rate_per_gram: it.pricing_mode === 'flat_price' ? 0 : (it.rate_per_gram || 0),
      gold_value: it.base_price || 0,
      making_charges: it.pricing_mode === 'flat_price' ? 0 : (it.mc_amount || 0),
      discount: it.discount || 0,
      discounted_making: it.pricing_mode === 'flat_price' ? 0 : (it.mc_amount || 0),
      subtotal: lineTotal,
      mrp: it.pricing_mode === 'flat_price' ? (it.flat_price || lineTotal) : 0,
      description: it.customization_notes || null,
    });
  }

  // (b) Nispaditha Components → priced invoice lines
  for (const c of components) {
    const lineTotal = Number(c.total) || 0;
    const wt = Number(c.weight_grams) || 0;
    const qty = Number(c.quantity) || 1;
    const isWeightBased = (Number(c.rate_per_gram) || 0) > 0 && wt > 0;
    lines.push({
      product_id: null,
      product_name: c.component_name + (c.material ? ` (${c.material})` : ''),
      category: 'Component',
      quantity: qty,
      weight_grams: isWeightBased ? wt : 0,
      rate_per_gram: isWeightBased ? (Number(c.rate_per_gram) || 0) : 0,
      gold_value: isWeightBased ? wt * (Number(c.rate_per_gram) || 0) * qty : 0,
      making_charges: 0,
      discount: 0,
      discounted_making: 0,
      subtotal: lineTotal,
      mrp: isWeightBased ? 0 : lineTotal,
      description: null,
    });
  }

  // (c) Charges → flat-price invoice lines
  const chargeLines: Array<{ label: string; amount: number }> = [
    { label: 'Making Charges', amount: Number(order.making_charges) || 0 },
    { label: 'Design Charges', amount: Number(order.design_charges) || 0 },
    { label: 'Labour Charges', amount: Number(order.labour_charges) || 0 },
    { label: 'Polishing Charges', amount: Number(order.polishing_charges) || 0 },
    { label: 'Repair Charges', amount: Number(order.repair_charges) || 0 },
    { label: order.additional_charge_label || 'Additional Charge', amount: Number(order.additional_charge) || 0 },
    ...((order.extra_charges || []).map(c => ({ label: c.label, amount: Number(c.amount) || 0 }))),
  ].filter(c => c.amount > 0 && c.label);

  const customOrderDetails = buildCustomOrderDetails(order, items, components, chargeLines);

  for (const ch of chargeLines) {
    lines.push({
      product_id: null,
      product_name: ch.label,
      category: 'Service Charge',
      quantity: 1,
      weight_grams: 0,
      rate_per_gram: 0,
      gold_value: 0,
      making_charges: 0,
      discount: 0,
      discounted_making: 0,
      subtotal: ch.amount,
      mrp: ch.amount,
      description: null,
    });
  }

  if (lines.length === 0) {
    // safeguard — ensure there is at least one line
    lines.push({
      product_id: null,
      product_name: `Custom Order ${order.reference_number}`,
      category: 'Custom Order',
      quantity: 1,
      weight_grams: 0,
      rate_per_gram: 0,
      gold_value: 0,
      making_charges: 0,
      discount: 0,
      discounted_making: 0,
      subtotal: Number(order.total_amount) || 0,
      mrp: Number(order.total_amount) || 0,
      description: null,
    });
  }

  // 4. Compute totals (mirror form dialog math)
  const linesSubtotal = lines.reduce((s, l) => s + l.subtotal, 0);
  const discount = Number(order.flat_discount) || 0;
  const taxableBase = Math.max(0, linesSubtotal - discount);
  const pct = Number(order.gst_percentage) || 0;
  const gstMode = order.gst_mode === 'inclusive' ? 'inclusive' : 'exclusive';
  let gstAmount = 0;
  let grandTotal = 0;
  let subtotalForInvoice = taxableBase;
  if (gstMode === 'inclusive') {
    const divisor = 1 + pct / 100;
    const taxable = divisor > 0 ? taxableBase / divisor : taxableBase;
    gstAmount = Math.max(0, taxableBase - taxable);
    grandTotal = taxableBase;
    subtotalForInvoice = taxable + discount; // pre-discount, pre-gst
  } else {
    gstAmount = taxableBase * (pct / 100);
    grandTotal = taxableBase + gstAmount;
    subtotalForInvoice = linesSubtotal;
  }

  // 5. Build full custom-order note payload for invoice preview/PDF/history/edit reloads
  const combinedNotes = buildCustomOrderNotes(order, customOrderDetails);

  // 6. Insert invoice
  const invoicePayload = {
    invoice_number: invoiceNumber,
    client_id: clientId,
    invoice_date: new Date().toISOString().split('T')[0],
    subtotal: subtotalForInvoice,
    discount_amount: discount,
    gst_amount: gstAmount,
    grand_total: grandTotal,
    advance_paid: 0,
    store_credits_used: 0,
    payment_status: 'pending',
    payment_mode: finalize ? 'cash' : null,
    total_paid: 0,
    balance_due: grandTotal,
    notes: combinedNotes,
    status: finalize ? 'sent' : 'draft',
    gst_percentage: pct,
    gst_mode: gstMode,
    round_off: 0,
    created_by: opts.createdBy || null,
    client_source: 'custom_order',
  };

  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .insert([invoicePayload as never])
    .select()
    .single();
  if (invErr || !invoice) throw invErr || new Error('Failed to create invoice');

  // 7. Insert invoice items
  const itemsPayload = lines.map(l => ({
    invoice_id: (invoice as { id: string }).id,
    product_id: l.product_id,
    product_name: l.product_name,
    category: l.category,
    quantity: l.quantity,
    weight_grams: l.weight_grams,
    rate_per_gram: l.rate_per_gram,
    gold_value: l.gold_value,
    making_charges: l.making_charges,
    discount: l.discount,
    discounted_making: l.discounted_making,
    subtotal: l.subtotal,
    gst_percentage: 0, // GST handled at invoice level
    gst_amount: 0,
    total: l.subtotal,
    mrp: l.mrp,
    description: l.description,
  }));

  const { data: insertedItems, error: itemsErr } = await supabase
    .from('invoice_items')
    .insert(itemsPayload)
    .select('id');
  if (itemsErr || !insertedItems || insertedItems.length === 0) {
    // Rollback the orphan invoice so the user can retry cleanly
    await supabase.from('invoices').delete().eq('id', (invoice as { id: string }).id);
    console.error('[convertCustomOrderToInvoice] items insert failed', itemsErr, { count: itemsPayload.length, sample: itemsPayload[0] });
    throw itemsErr || new Error('Could not save invoice line items — invoice rolled back. Please try again.');
  }

  // 8. Mark the custom order as converted
  await supabase
    .from('custom_orders')
    .update({ converted_to_invoice_id: (invoice as { id: string }).id })
    .eq('id', order.id);

  return {
    invoiceId: (invoice as { id: string }).id,
    invoiceNumber: invoiceNumber as string,
    clientId,
  };
}
