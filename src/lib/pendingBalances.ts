import { supabase } from '@/integrations/supabase/client';
import { PAYMENT_TOLERANCE } from '@/lib/moneyTolerance';

/**
 * Single source of truth for customer outstanding balances.
 * Used by the Pending Payments page and by Reports → Outstanding Balances,
 * so the two can never disagree.
 */
export interface PendingInvoiceRow {
  id: string;
  invoice_number: string;
  invoice_date: string;
  grand_total: number;
  advance_paid: number;
  payment_status: string;
  client_id: string | null;
  clients: { name: string | null; phone: string | null } | null;
}

export const pendingBalance = (r: { grand_total: number; advance_paid: number }) =>
  Math.max(0, Number(r.grand_total || 0) - Number(r.advance_paid || 0));

/** Invoices that currently carry a real outstanding balance (cancelled excluded). */
export async function fetchPendingInvoices(): Promise<PendingInvoiceRow[]> {
  const PAGE = 1000;
  let all: PendingInvoiceRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, invoice_date, grand_total, advance_paid, payment_status, client_id, clients(name, phone)')
      .in('payment_status', ['partial', 'pending'])
      .neq('status', 'cancelled')
      .order('invoice_date', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all = all.concat((data || []) as unknown as PendingInvoiceRow[]);
    if (!data || data.length < PAGE) break;
  }
  // Only rows with a balance beyond the round-off tolerance are truly pending
  return all.filter((r) => pendingBalance(r) > PAYMENT_TOLERANCE);
}

export interface OutstandingClient {
  name: string;
  phone: string | null;
  balance: number;
}

/** Aggregates pending invoices per customer. */
export function aggregateOutstanding(rows: PendingInvoiceRow[]): OutstandingClient[] {
  const map = new Map<string, OutstandingClient>();
  for (const r of rows) {
    const key = r.client_id || `walkin:${r.clients?.name || r.invoice_number}`;
    const entry = map.get(key) || {
      name: r.clients?.name || 'Walk-in',
      phone: r.clients?.phone || null,
      balance: 0,
    };
    entry.balance += pendingBalance(r);
    map.set(key, entry);
  }
  return Array.from(map.values())
    .filter((c) => c.balance > PAYMENT_TOLERANCE)
    .sort((a, b) => b.balance - a.balance);
}
