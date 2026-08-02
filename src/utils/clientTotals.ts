import { supabase } from '@/integrations/supabase/client';

export interface ClientTotalsResult {
  scanned: number;
  updated: number;
  errors: string[];
}

interface InvoiceRow {
  client_id: string | null;
  grand_total: number | null;
  total_paid: number | null;
  balance_due: number | null;
  invoice_date: string | null;
  status: string | null;
}

async function fetchAllInvoices(): Promise<InvoiceRow[]> {
  const PAGE = 1000;
  let all: InvoiceRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('invoices')
      .select('client_id, grand_total, total_paid, balance_due, invoice_date, status')
      .neq('status', 'cancelled')
      .order('invoice_date', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all = all.concat((data || []) as InvoiceRow[]);
    if (!data || data.length < PAGE) break;
  }
  return all;
}

/**
 * Recomputes clients.total_purchases, outstanding_balance and last_invoice_date
 * from the actual invoice ledger (cancelled invoices excluded).
 */
export async function recalcClientPurchaseHistory(): Promise<ClientTotalsResult> {
  const errors: string[] = [];
  const invoices = await fetchAllInvoices();

  const agg = new Map<string, { total: number; due: number; last: string | null }>();
  for (const inv of invoices) {
    if (!inv.client_id) continue;
    const entry = agg.get(inv.client_id) || { total: 0, due: 0, last: null };
    const grand = Number(inv.grand_total) || 0;
    const paid = Number(inv.total_paid) || 0;
    const due = inv.balance_due != null ? Number(inv.balance_due) : Math.max(0, grand - paid);
    entry.total += grand;
    entry.due += Math.max(0, due);
    if (inv.invoice_date && (!entry.last || inv.invoice_date > entry.last)) entry.last = inv.invoice_date;
    agg.set(inv.client_id, entry);
  }

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, total_purchases, outstanding_balance, last_invoice_date');
  if (error) throw error;

  let updated = 0;
  for (const c of clients || []) {
    const entry = agg.get(c.id) || { total: 0, due: 0, last: null };
    const sameTotal = Math.abs(Number(c.total_purchases || 0) - entry.total) < 0.01;
    const sameDue = Math.abs(Number(c.outstanding_balance || 0) - entry.due) < 0.01;
    const currentLast = c.last_invoice_date ? String(c.last_invoice_date).slice(0, 10) : null;
    const sameLast = currentLast === entry.last;
    if (sameTotal && sameDue && sameLast) continue;

    const { error: upErr } = await supabase
      .from('clients')
      .update({
        total_purchases: entry.total,
        outstanding_balance: entry.due,
        last_invoice_date: entry.last ? new Date(entry.last).toISOString() : null,
      })
      .eq('id', c.id);
    if (upErr) errors.push(`${c.id}: ${upErr.message}`);
    else updated += 1;
  }

  return { scanned: (clients || []).length, updated, errors };
}
