import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface WalletTx {
  id: string;
  client_id: string;
  type: 'credit' | 'debit';
  amount: number;
  source: string;
  reference_id: string | null;
  reference_label: string | null;
  notes: string | null;
  balance_after: number | null;
  created_at: string;
}

export function useStoreWallet(clientId: string | null | undefined) {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!clientId) {
      setBalance(0);
      setTransactions([]);
      return;
    }
    setLoading(true);
    try {
      const [w, t] = await Promise.all([
        supabase.from('store_wallets').select('balance').eq('client_id', clientId).maybeSingle(),
        supabase
          .from('wallet_transactions')
          .select('*')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);
      setBalance(Number(w.data?.balance) || 0);
      setTransactions((t.data as WalletTx[]) || []);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { balance, transactions, loading, refresh };
}

/** Adjust wallet balance via secure RPC. delta > 0 = credit, delta < 0 = debit. */
export async function adjustWallet(
  clientId: string,
  delta: number,
  source:
    | 'return'
    | 'exchange'
    | 'buyback'
    | 'manual'
    | 'invoice'
    | 'invoice_refund'
    | 'cancel_refund',
  referenceId?: string | null,
  referenceLabel?: string | null,
  notes?: string | null,
): Promise<number> {
  const { data, error } = await supabase.rpc('adjust_wallet_balance', {
    p_client_id: clientId,
    p_delta: delta,
    p_type: delta >= 0 ? 'credit' : 'debit',
    p_source: source,
    p_reference_id: referenceId ?? null,
    p_reference_label: referenceLabel ?? null,
    p_notes: notes ?? null,
  });
  if (error) throw error;
  return Number(data) || 0;
}

/** Net wallet effect (credits − debits) already recorded for one reference. */
export async function walletNetForReference(
  clientId: string,
  referenceId: string,
  sources: string[],
): Promise<number> {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('type, amount, source')
    .eq('client_id', clientId)
    .eq('reference_id', referenceId)
    .in('source', sources);
  if (error) throw error;
  return (data || []).reduce(
    (s, t) => s + (t.type === 'credit' ? 1 : -1) * (Number(t.amount) || 0),
    0,
  );
}

/**
 * Idempotent wallet settlement: brings the net wallet effect for a reference to
 * `targetNet` (positive = credit, negative = debit, 0 = fully reversed).
 * Re-running never creates duplicate credits/debits.
 */
export async function settleWalletForReference(opts: {
  clientId: string;
  referenceId: string;
  targetNet: number;
  source: Parameters<typeof adjustWallet>[2];
  relatedSources: string[];
  referenceLabel?: string | null;
  notes?: string | null;
}): Promise<number> {
  const current = await walletNetForReference(opts.clientId, opts.referenceId, opts.relatedSources);
  const delta = Math.round((opts.targetNet - current) * 100) / 100;
  if (Math.abs(delta) < 0.01) return 0;
  await adjustWallet(opts.clientId, delta, opts.source, opts.referenceId, opts.referenceLabel, opts.notes);
  return delta;
}

export const INVOICE_WALLET_SOURCES = ['invoice', 'cancel_refund', 'invoice_refund'];

/** Quick read of a single client's wallet balance (no transactions). */

export async function getWalletBalance(clientId: string): Promise<number> {
  const { data } = await supabase
    .from('store_wallets')
    .select('balance')
    .eq('client_id', clientId)
    .maybeSingle();
  return Number(data?.balance) || 0;
}
