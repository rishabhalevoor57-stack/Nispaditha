import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBranch } from '@/contexts/BranchContext';
import { useBranchFilter } from '@/hooks/useBranchFilter';
import { useAuth } from '@/contexts/AuthContext';
import { calculateInventoryMetrics, inventoryNumber } from '@/lib/inventoryMetrics';

export function useInventorySnapshot() {
  const branch = useBranchFilter();
  const { loading: branchLoading, defaultBranch } = useBranch();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const scope = [user?.id, branch.filterId, defaultBranch?.id];
  const enabled = !!user && !branchLoading;
  const inventory = useQuery({
    queryKey: ['inventory-snapshot', ...scope], enabled,
    queryFn: async () => {
      const records = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await branch.apply(supabase.from('products')
          .select('*, categories(name)')
          .order('id').range(from, from + 999));
        if (error) throw error;
        records.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      // The registry is global; only include unassigned registry history in the consolidated view.
      const historicalSkus = records.map(p => p.sku);
      if (branch.isAll) {
        for (let from = 0; ; from += 1000) {
          const { data, error } = await supabase.from('sku_registry').select('sku').order('sku').range(from, from + 999);
          if (error) throw error;
          historicalSkus.push(...(data ?? []).map(p => p.sku));
          if (!data || data.length < 1000) break;
        }
      }
      return { records, historicalSkus };
    },
    staleTime: 0, refetchOnMount: 'always', refetchInterval: 30000,
  });
  const settingsQuery = useQuery({
    queryKey: ['inventory-valuation-settings', user?.id], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('business_settings').select('*').limit(1).single();
      if (error) throw error;
      return data;
    },
    staleTime: 0, refetchOnMount: 'always', refetchInterval: 30000,
  });
  useEffect(() => {
    const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['inventory-snapshot'] }); };
    const channel = supabase.channel(`inventory-reporting-${user?.id}-${branch.filterId ?? 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sku_registry' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_settings' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['inventory-valuation-settings'] });
      }).subscribe();
    window.addEventListener('inventory:refresh', refresh);
    return () => {
      window.removeEventListener('inventory:refresh', refresh);
      void supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id, branch.filterId]);
  const silverRate = inventoryNumber(settingsQuery.data?.silver_rate_per_gram);
  const metrics = useMemo(() => calculateInventoryMetrics(inventory.data?.records ?? [], silverRate, inventory.data?.historicalSkus ?? []), [inventory.data, silverRate]);
  return { ...metrics, silverRate, settings: settingsQuery.data,
    isLoading: !enabled || inventory.isLoading || settingsQuery.isLoading,
    error: inventory.error || settingsQuery.error,
  };
}