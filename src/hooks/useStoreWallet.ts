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

/** Quick read of a single client's wallet balance (no transactions). */
export async function getWalletBalance(clientId: string): Promise<number> {
  const { data } = await supabase
    .from('store_wallets')
    .select('balance')
    .eq('client_id', clientId)
    .maybeSingle();
  return Number(data?.balance) || 0;
}
