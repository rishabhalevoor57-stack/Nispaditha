import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface MeltingItem {
  id?: string;
  description: string;
  quantity: number;
  gross_weight: number;
  purity: number;
  fine_weight?: number;
  remarks?: string | null;
}

export interface MeltingEntry {
  id: string;
  melting_number: string;
  entry_date: string;
  vendor_id: string | null;
  vendor_name: string | null;
  client_id: string | null;
  customer_name: string | null;
  source_type: string;
  source_reference_id: string | null;
  source_reference_label: string | null;
  description: string | null;
  metal_type: string;
  gross_weight: number;
  avg_purity: number;
  fine_weight: number;
  melting_loss_percent: number;
  recovered_weight: number;
  status: string;
  notes: string | null;
  documents: { url: string; name: string }[];
  inventory_product_id: string | null;
  inventory_sku: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  items?: MeltingItem[];
}

export function useMelting() {
  const [entries, setEntries] = useState<MeltingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('melting_entries')
      .select('*, items:melting_items(*)')
      .order('created_at', { ascending: false });
    if (error) toast({ variant: 'destructive', title: 'Error', description: error.message });
    setEntries((data as unknown as MeltingEntry[]) || []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (
    entry: Partial<MeltingEntry>,
    items: MeltingItem[],
  ): Promise<MeltingEntry | null> => {
    try {
      const { data: numData } = await supabase.rpc('generate_melting_number');
      const melting_number = (numData as unknown as string) || `MELT-${Date.now()}`;
      const { data: inserted, error } = await supabase
        .from('melting_entries')
        .insert([{
          melting_number,
          entry_date: entry.entry_date || new Date().toISOString().split('T')[0],
          vendor_id: entry.vendor_id || null,
          vendor_name: entry.vendor_name || null,
          client_id: entry.client_id || null,
          customer_name: entry.customer_name || null,
          source_type: entry.source_type || 'other',
          source_reference_id: entry.source_reference_id || null,
          source_reference_label: entry.source_reference_label || null,
          description: entry.description || null,
          metal_type: entry.metal_type || 'silver',
          gross_weight: entry.gross_weight || 0,
          avg_purity: entry.avg_purity || 0,
          fine_weight: entry.fine_weight || 0,
          melting_loss_percent: entry.melting_loss_percent || 0,
          recovered_weight: entry.recovered_weight || 0,
          status: entry.status || 'pending',
          notes: entry.notes || null,
          documents: entry.documents || [],
        }])
        .select('*')
        .single();
      if (error) throw error;
      if (items.length) {
        await supabase.from('melting_items').insert(
          items.map((i) => ({
            melting_id: inserted.id,
            description: i.description,
            quantity: i.quantity,
            gross_weight: i.gross_weight,
            purity: i.purity,
            fine_weight: (i.gross_weight * i.purity) / 100,
            remarks: i.remarks || null,
          })),
        );
      }
      toast({ title: 'Melting entry created', description: melting_number });
      await load();
      return inserted as unknown as MeltingEntry;
    } catch (e) {
      toast({ variant: 'destructive', title: 'Failed', description: e instanceof Error ? e.message : 'Error' });
      return null;
    }
  }, [load, toast]);

  const updateStatus = useCallback(async (id: string, status: string) => {
    await supabase.from('melting_entries').update({ status }).eq('id', id);
    toast({ title: 'Status updated' });
    load();
  }, [load, toast]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('melting_entries').delete().eq('id', id);
    if (error) toast({ variant: 'destructive', title: 'Failed', description: error.message });
    else { toast({ title: 'Deleted' }); load(); }
  }, [load, toast]);

  const sendToInventory = useCallback(async (
    id: string,
    product_name: string,
    price_per_gram: number,
    making_charges: number,
  ) => {
    try {
      const { data, error } = await supabase.rpc('send_melting_to_inventory', {
        p_melting_id: id,
        p_product_name: product_name,
        p_price_per_gram: price_per_gram,
        p_making_charges: making_charges,
      });
      if (error) throw error;
      toast({ title: 'Sent to inventory', description: 'New SKU created.' });
      load();
      window.dispatchEvent(new CustomEvent('inventory:refresh'));
      return data as unknown as string;
    } catch (e) {
      toast({ variant: 'destructive', title: 'Failed', description: e instanceof Error ? e.message : 'Error' });
      return null;
    }
  }, [load, toast]);

  return { entries, loading, refresh: load, create, updateStatus, remove, sendToInventory };
}
