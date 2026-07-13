import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MetalType, resolveMetalRate } from '@/lib/metalTypes';

interface MetalRates {
  silver: number;
  gold22: number;
  gold18: number;
  gold24: number;
  updatedAt: string | null;
  loading: boolean;
  rateFor: (metal: MetalType) => number;
  refresh: () => Promise<void>;
}

/**
 * Live metal-rate hook backed by business_settings.
 * Stores silver + gold 22K; derives 18K and 24K from 22K.
 */
export function useMetalRates(): MetalRates {
  const [silver, setSilver] = useState(0);
  const [gold22, setGold22] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('business_settings')
      .select('silver_rate_per_gram, gold_rate_per_gram, updated_at')
      .limit(1)
      .single();
    setSilver(Number(data?.silver_rate_per_gram) || 0);
    setGold22(Number(data?.gold_rate_per_gram) || 0);
    setUpdatedAt(data?.updated_at ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const base = { silver, gold22 };
  return {
    silver,
    gold22,
    gold18: gold22 * (18 / 22),
    gold24: gold22 * (24 / 22),
    updatedAt,
    loading,
    rateFor: (m: MetalType) => resolveMetalRate(m, base),
    refresh,
  };
}
