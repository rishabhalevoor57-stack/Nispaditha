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
  const flatDiscount = Number(order.flat_discount) || 0;
  // Sum per-item line discounts so they don't silently disappear on the invoice
  const itemsDiscount = items.reduce((s, i) => s + (Number(i.discount) || 0), 0);
  const totalDiscount = flatDiscount + itemsDiscount;
  // Gross subtotal = post-per-item-discount lines + itemsDiscount so subtotal - totalDiscount = same taxable base
  const grossSubtotal = linesSubtotal + itemsDiscount;
  const taxableBase = Math.max(0, linesSubtotal - flatDiscount);
  const pct = Number(order.gst_percentage) || 0;
  const gstMode = order.gst_mode === 'inclusive' ? 'inclusive' : 'exclusive';
  let gstAmount = 0;
  let grandTotal = 0;
  let subtotalForInvoice = grossSubtotal;
  if (gstMode === 'inclusive') {
    const divisor = 1 + pct / 100;
    const taxable = divisor > 0 ? taxableBase / divisor : taxableBase;
    gstAmount = Math.max(0, taxableBase - taxable);
    grandTotal = taxableBase;
    subtotalForInvoice = taxable + totalDiscount;
  } else {
    gstAmount = taxableBase * (pct / 100);
    grandTotal = taxableBase + gstAmount;
    subtotalForInvoice = grossSubtotal;
  }
  return {
    lines,
    details,
    notes: buildCustomOrderNotes(order, details),
    subtotalForInvoice,
    discount: totalDiscount,
    gstAmount,
    grandTotal,
    pct,
    gstMode,
  };
};


// IMPORTANT: To keep totals consistent between Custom Order and generated Invoice,
// we roll ALL discount (per-item line discount + order-level flat discount) into
// invoice.discount_amount and zero out the per-item discount on invoice_items rows.
// The line's `subtotal` here is the GROSS pre-discount amount, so:
//   sum(invoice_items.subtotal) = invoice.subtotal
//   invoice.subtotal - invoice.discount_amount = taxable base
// This avoids the double-counting bug where per-item discount was subtracted twice
// (once in item.subtotal already post-discount, once again via invoice.discount_amount).
const buildItemsPayload = (invoiceId: string, lines: LineItemInput[]) => lines.map(l => {
  const grossSubtotal = (Number(l.subtotal) || 0) + (Number(l.discount) || 0);
  return {
    invoice_id: invoiceId,
    product_id: l.product_id,
    product_name: l.product_name,
    category: l.category,
    quantity: l.quantity,
    weight_grams: l.weight_grams,
    rate_per_gram: l.rate_per_gram,
    gold_value: l.gold_value,
    making_charges: l.making_charges,
    discount: 0,
    discounted_making: l.discounted_making,
    subtotal: grossSubtotal,
    gst_percentage: 0,
    gst_amount: 0,
    total: grossSubtotal,
    mrp: Math.max(l.mrp, grossSubtotal),
    description: l.description,
  };
});

export async function syncCustomOrderInvoice(
  order: CustomOrder,
  items: CustomOrderItem[],
  components: CustomOrderComponent[],
): Promise<void> {
  if (!order.converted_to_invoice_id) return;

  const invoiceId = order.converted_to_invoice_id;
  const invoiceData = buildInvoiceData(order, items, components);

  const { error: updateErr } = await supabase
    .from('invoices')
    .update({
      subtotal: invoiceData.subtotalForInvoice,
      discount_amount: invoiceData.discount,
      gst_amount: invoiceData.gstAmount,
      grand_total: invoiceData.grandTotal,
      balance_due: invoiceData.grandTotal,
      notes: invoiceData.notes,
      gst_percentage: invoiceData.pct,
      gst_mode: invoiceData.gstMode,
      client_source: 'custom_order',
    } as never)
    .eq('id', invoiceId);
  if (updateErr) throw updateErr;

  const { error: deleteErr } = await supabase
    .from('invoice_items')
    .delete()
    .eq('invoice_id', invoiceId);
  if (deleteErr) throw deleteErr;

  const { error: insertErr } = await supabase
    .from('invoice_items')
    .insert(buildItemsPayload(invoiceId, invoiceData.lines));
  if (insertErr) throw insertErr;
}

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

  // 3. Build invoice line items, totals, and full custom-order detail payload
  const invoiceData = buildInvoiceData(order, items, components);

  // 4. Fetch any advance payments recorded on the custom order
  const { data: advances = [] } = await (supabase
    .from('custom_order_payments' as any)
    .select('*')
    .eq('custom_order_id', order.id)
    .order('payment_date', { ascending: true }) as any) as unknown as {
    data: Array<{ id: string; amount: number; payment_mode: string; payment_date: string; reference_number: string; notes: string | null }>;
  };

  const advancesArr = advances || [];
  const cashAdvances = advancesArr.filter(p => p.payment_mode !== 'store_credit');
  const creditAdvances = advancesArr.filter(p => p.payment_mode === 'store_credit');
  const cashAdvanceTotal = cashAdvances.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const creditAdvanceTotal = creditAdvances.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const totalAdvanceApplied = cashAdvanceTotal + creditAdvanceTotal;
  const balanceAfterAdvances = Math.max(0, invoiceData.grandTotal - totalAdvanceApplied);
  const paymentStatus = balanceAfterAdvances <= 0.05
    ? 'paid'
    : totalAdvanceApplied > 0 ? 'partial' : 'pending';

  // 5. Insert invoice
  const invoicePayload = {
    invoice_number: invoiceNumber,
    client_id: clientId,
    invoice_date: new Date().toISOString().split('T')[0],
    subtotal: invoiceData.subtotalForInvoice,
    discount_amount: invoiceData.discount,
    order_discount: Number(order.flat_discount) || 0,
    gst_amount: invoiceData.gstAmount,
    grand_total: invoiceData.grandTotal,
    advance_paid: cashAdvanceTotal,
    store_credits_used: creditAdvanceTotal,
    payment_status: paymentStatus,
    payment_mode: cashAdvances[0]?.payment_mode || (finalize ? 'cash' : null),
    total_paid: cashAdvanceTotal,
    balance_due: balanceAfterAdvances,
    notes: invoiceData.notes,
    status: finalize ? (balanceAfterAdvances <= 0.05 ? 'paid' : 'sent') : 'draft',
    gst_percentage: invoiceData.pct,
    gst_mode: invoiceData.gstMode,
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

  // 6. Insert invoice items
  const itemsPayload = buildItemsPayload((invoice as { id: string }).id, invoiceData.lines);

  const { data: insertedItems, error: itemsErr } = await supabase
    .from('invoice_items')
    .insert(itemsPayload)
    .select('id');
  if (itemsErr || !insertedItems || insertedItems.length === 0) {
    await supabase.from('invoices').delete().eq('id', (invoice as { id: string }).id);
    console.error('[convertCustomOrderToInvoice] items insert failed', itemsErr, { count: itemsPayload.length, sample: itemsPayload[0] });
    throw itemsErr || new Error('Could not save invoice line items — invoice rolled back. Please try again.');
  }

  // 7. Transfer each advance payment into invoice_payments — preserving ADV- reference in notes
  if (advancesArr.length > 0) {
    for (const adv of advancesArr) {
      const { data: payment, error: payErr } = await (supabase
        .from('invoice_payments')
        .insert({
          invoice_id: (invoice as { id: string }).id,
          amount: adv.amount,
          payment_mode: adv.payment_mode,
          payment_date: adv.payment_date,
          receipt_number: adv.reference_number, // keep ADV-000045 as the receipt reference
          notes: `Advance from ${order.reference_number}${adv.notes ? ` — ${adv.notes}` : ''}`,
        } as never)
        .select('id')
        .single() as any);
      if (payErr) {
        console.error('[convertCustomOrderToInvoice] advance transfer failed', payErr);
      } else if (payment?.id) {
        await (supabase
          .from('custom_order_payments' as any)
          .update({ transferred_to_invoice_payment_id: payment.id } as any)
          .eq('id', adv.id) as any);
      }
    }
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

