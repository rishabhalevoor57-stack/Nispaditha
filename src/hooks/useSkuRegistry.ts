import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SkuRegistryRow {
  sku: string;
  prefix: string;
  running_number: number;
  type_of_work_code: string;
  vendor_code: string;
  category_code: string;
  type_of_work_id: string | null;
  vendor_id: string | null;
  category_id: string | null;
  type_of_work_name: string | null;
  vendor_name: string | null;
  category_name: string | null;
  status: string;
  product_id: string | null;
  barcode_value: string;
  qr_payload: Record<string, unknown>;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useSkuRegistry() {
  const [rows, setRows] = useState<SkuRegistryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const all: SkuRegistryRow[] = [];
      const PAGE = 1000;
      let from = 0;
      while (from < 200000) {
        const { data, error } = await supabase
          .from('sku_registry' as any)
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...(data as any));
        if (data.length < PAGE) break;
        from += PAGE;
      }
      setRows(all);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to load SKUs', description: e.message });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const generate = useCallback(
    async (args: {
      type_of_work_id: string | null;
      vendor_id: string | null;
      category_id: string | null;
      type_of_work_code: string;
      vendor_code: string;
      category_code: string;
      quantity: number;
      start_number?: number | null;
    }) => {
      const { data, error } = await supabase.rpc('generate_skus' as any, {
        p_type_of_work_id: args.type_of_work_id,
        p_vendor_id: args.vendor_id,
        p_category_id: args.category_id,
        p_quantity: args.quantity,
        p_type_of_work_code: args.type_of_work_code,
        p_vendor_code: args.vendor_code,
        p_category_code: args.category_code,
        p_start_number: args.start_number ?? null,
      } as any);
      if (error) throw error;
      await fetchAll();
      return (data || []) as SkuRegistryRow[];
    },
    [fetchAll]
  );

  const remove = useCallback(
    async (skus: string[]) => {
      if (!skus.length) return;
      const { error } = await supabase.from('sku_registry' as any).delete().in('sku', skus);
      if (error) throw error;
      await fetchAll();
    },
    [fetchAll]
  );

  return { rows, isLoading, refresh: fetchAll, generate, remove };
}
