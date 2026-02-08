import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/useActivityLog';
import type { ReturnExchange } from '@/types/returnExchange';

export function useReturnsExchanges() {
  const [records, setRecords] = useState<ReturnExchange[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'return' | 'exchange'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('return_exchanges')
        .select('*')
        .order('created_at', { ascending: false });

      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRecords((data as ReturnExchange[]) || []);
    } catch (error) {
      console.error('Error fetching return/exchange records:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [typeFilter]);

  const filteredRecords = records.filter((r) => {
    const term = searchTerm.toLowerCase();
    return (
      r.reference_number.toLowerCase().includes(term) ||
      r.original_invoice_number.toLowerCase().includes(term) ||
      r.client_name?.toLowerCase().includes(term)
    );
  });

  const counts = {
    all: records.length,
    return: records.filter((r) => r.type === 'return').length,
    exchange: records.filter((r) => r.type === 'exchange').length,
  };

  const deleteRecord = async (record: ReturnExchange) => {
    try {
      // Fetch items to reverse stock adjustments
      const { data: items, error: itemsError } = await supabase
        .from('return_exchange_items')
        .select('*')
        .eq('return_exchange_id', record.id);
      if (itemsError) throw itemsError;

      // Reverse stock changes for each item
      for (const item of items || []) {
        if (!item.product_id) continue;

        const { data: product } = await supabase
          .from('products')
          .select('quantity')
          .eq('id', item.product_id)
          .single();

        if (!product) continue;

        if (item.direction === 'returned') {
          // Was added back to stock on create → subtract it now
          await supabase
            .from('products')
            .update({ quantity: product.quantity - item.quantity })
            .eq('id', item.product_id);
        } else if (item.direction === 'new') {
          // Was subtracted from stock on create → add it back now
          await supabase
            .from('products')
            .update({ quantity: product.quantity + item.quantity })
            .eq('id', item.product_id);
        }

        // Remove related stock_history entries
        await supabase
          .from('stock_history')
          .delete()
          .eq('reference_id', record.id)
          .eq('product_id', item.product_id);
      }

      // Delete the record (items cascade automatically)
      const { error: deleteError } = await supabase
        .from('return_exchanges')
        .delete()
        .eq('id', record.id);
      if (deleteError) throw deleteError;

      // Log activity
      logActivity({
        module: record.type === 'return' ? 'return' : 'exchange',
        action: 'delete',
        recordId: record.id,
        recordLabel: record.reference_number,
        oldValue: {
          reference_number: record.reference_number,
          original_invoice: record.original_invoice_number,
          client: record.client_name,
          refund_amount: record.refund_amount,
          additional_charge: record.additional_charge,
        },
      });

      toast({ title: `${record.reference_number} deleted successfully` });
      fetchRecords();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete';
      toast({ variant: 'destructive', title: 'Error', description: message });
    }
  };

  return {
    records: filteredRecords,
    isLoading,
    typeFilter,
    setTypeFilter,
    searchTerm,
    setSearchTerm,
    counts,
    refresh: fetchRecords,
    deleteRecord,
  };
}
