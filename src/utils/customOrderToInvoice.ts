import { supabase } from '@/integrations/supabase/client';
import type { CustomOrder, CustomOrderItem, CustomOrderComponent } from '@/types/customOrder';

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

  // 5. Build customer-materials descriptive note
  const materialsNote = (order.customer_materials || [])
    .filter(m => (m.name || '').trim())
    .map(m => {
      const parts = [m.name];
      if (m.quantity) parts.push(`Qty: ${m.quantity}`);
      if (m.weight_grams) parts.push(`${m.weight_grams}g`);
      if (m.description) parts.push(m.description);
      return `• ${parts.join(' — ')}`;
    });

  const notesParts: string[] = [];
  notesParts.push(`Converted from Custom Order ${order.reference_number}`);
  if (materialsNote.length) {
    notesParts.push('\nCustomer Materials Supplied:');
    notesParts.push(...materialsNote);
  }
  if (order.notes && order.notes.trim()) {
    notesParts.push('\n' + order.notes.trim());
  }
  const combinedNotes = notesParts.join('\n');

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
