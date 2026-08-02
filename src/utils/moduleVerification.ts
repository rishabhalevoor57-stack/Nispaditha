import { supabase } from '@/integrations/supabase/client';

export interface VerificationRow {
  module: string;
  metric: string;
  value: number | string;
  expected?: number | string;
  status: 'ok' | 'mismatch' | 'info';
  note?: string;
}

async function fetchAll<T>(table: string, select: string, apply?: (q: any) => any): Promise<T[]> {
  const PAGE = 1000;
  let all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q: any = supabase.from(table as any).select(select).range(from, from + PAGE - 1);
    if (apply) q = apply(q);
    const { data, error } = await q;
    if (error) throw error;
    all = all.concat((data || []) as T[]);
    if (!data || data.length < PAGE) break;
  }
  return all;
}

const money = (n: number) => Math.round(n * 100) / 100;

/**
 * Cross-module consistency check. Inventory is the single source of truth:
 * "current products" = active SKU (deleted_at is null) with quantity > 0.
 */
export async function runModuleVerification(): Promise<VerificationRow[]> {
  const rows: VerificationRow[] = [];

  const products = await fetchAll<any>('products', 'id, sku, quantity, weight_grams, deleted_at', (q) =>
    q.is('deleted_at', null)
  );
  const inStock = products.filter((p) => (p.quantity || 0) > 0);
  const outOfStock = products.filter((p) => (p.quantity || 0) <= 0);

  rows.push({ module: 'Inventory', metric: 'Products in stock (qty > 0)', value: inStock.length, status: 'ok' });
  rows.push({ module: 'Inventory', metric: 'Out of stock SKUs', value: outOfStock.length, status: 'info' });
  rows.push({ module: 'Inventory', metric: 'Lifetime SKUs (active records)', value: products.length, status: 'info' });
  rows.push({
    module: 'Inventory',
    metric: 'Total quantity on hand',
    value: inStock.reduce((s, p) => s + (p.quantity || 0), 0),
    status: 'ok',
  });
  rows.push({
    module: 'Inventory',
    metric: 'Total weight on hand (g)',
    value: money(inStock.reduce((s, p) => s + Number(p.weight_grams || 0) * (p.quantity || 0), 0)),
    status: 'ok',
  });

  // Duplicate SKUs
  const skuCount = new Map<string, number>();
  products.forEach((p) => skuCount.set(p.sku, (skuCount.get(p.sku) || 0) + 1));
  const dupes = [...skuCount.values()].filter((n) => n > 1).length;
  rows.push({
    module: 'Inventory',
    metric: 'Duplicate active SKUs',
    value: dupes,
    expected: 0,
    status: dupes === 0 ? 'ok' : 'mismatch',
    note: dupes ? 'Duplicate SKUs must be merged or archived' : undefined,
  });

  // Invoices
  const invoices = await fetchAll<any>(
    'invoices',
    'id, client_id, grand_total, total_paid, balance_due, status'
  );
  const liveInvoices = invoices.filter((i) => i.status !== 'cancelled');
  const salesTotal = money(liveInvoices.reduce((s, i) => s + Number(i.grand_total || 0), 0));
  rows.push({ module: 'Invoices', metric: 'Active invoices', value: liveInvoices.length, status: 'ok' });
  rows.push({ module: 'Invoices', metric: 'Cancelled invoices', value: invoices.length - liveInvoices.length, status: 'info' });
  rows.push({ module: 'Invoices', metric: 'Lifetime sales value', value: salesTotal, status: 'ok' });

  // Clients vs invoice ledger
  const clients = await fetchAll<any>('clients', 'id, total_purchases, outstanding_balance');
  const ledger = new Map<string, { total: number; due: number }>();
  liveInvoices.forEach((i) => {
    if (!i.client_id) return;
    const e = ledger.get(i.client_id) || { total: 0, due: 0 };
    const grand = Number(i.grand_total || 0);
    const paid = Number(i.total_paid || 0);
    e.total += grand;
    e.due += Math.max(0, i.balance_due != null ? Number(i.balance_due) : grand - paid);
    ledger.set(i.client_id, e);
  });
  const driftedClients = clients.filter((c) => {
    const e = ledger.get(c.id) || { total: 0, due: 0 };
    return (
      Math.abs(Number(c.total_purchases || 0) - e.total) > 0.01 ||
      Math.abs(Number(c.outstanding_balance || 0) - e.due) > 0.01
    );
  });
  rows.push({ module: 'Clients', metric: 'Total clients', value: clients.length, status: 'ok' });
  rows.push({
    module: 'Clients',
    metric: 'Clients with stale purchase history',
    value: driftedClients.length,
    expected: 0,
    status: driftedClients.length === 0 ? 'ok' : 'mismatch',
    note: driftedClients.length ? 'Run "Recalculate client history"' : undefined,
  });

  // Sold ledger
  const manual = await fetchAll<any>('manual_sold_items', 'id, total, quantity');
  rows.push({ module: 'Sold', metric: 'Manual sold entries', value: manual.length, status: 'info' });
  rows.push({
    module: 'Sold',
    metric: 'Manual sold value',
    value: money(manual.reduce((s, m) => s + Number(m.total || 0), 0)),
    status: 'info',
  });

  // Custom orders
  const customOrders = await fetchAll<any>('custom_orders', 'id, status, total_amount, stock_deducted');
  const confirmedStates = ['confirmed', 'in_production', 'ready', 'delivered', 'invoiced', 'released'];
  const shouldDeduct = customOrders.filter((c) => confirmedStates.includes(c.status));
  const notDeducted = shouldDeduct.filter((c) => !c.stock_deducted).length;
  rows.push({ module: 'Custom Orders', metric: 'Total orders', value: customOrders.length, status: 'ok' });
  rows.push({
    module: 'Custom Orders',
    metric: 'Confirmed orders missing stock deduction',
    value: notDeducted,
    expected: 0,
    status: notDeducted === 0 ? 'ok' : 'mismatch',
    note: notDeducted ? 'Re-save these orders to sync stock' : undefined,
  });

  return rows;
}

export async function logVerificationRun(rows: VerificationRow[]) {
  const mismatches = rows.filter((r) => r.status === 'mismatch');
  // eslint-disable-next-line no-console
  console.table(rows);
  const { data: auth } = await supabase.auth.getUser();
  await supabase.from('activity_logs').insert({
    module: 'verification',
    action: mismatches.length ? 'verification_failed' : 'verification_passed',
    record_label: `${rows.length} checks, ${mismatches.length} mismatch(es)`,
    new_value: rows as any,
    user_id: auth?.user?.id ?? null,
    user_name: auth?.user?.email ?? null,
  });
}
