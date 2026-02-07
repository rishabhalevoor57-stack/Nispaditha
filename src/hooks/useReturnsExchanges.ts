import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ReturnExchange } from '@/types/returnExchange';

export function useReturnsExchanges() {
  const [records, setRecords] = useState<ReturnExchange[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'return' | 'exchange'>('all');
  const [searchTerm, setSearchTerm] = useState('');

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

  return {
    records: filteredRecords,
    isLoading,
    typeFilter,
    setTypeFilter,
    searchTerm,
    setSearchTerm,
    counts,
    refresh: fetchRecords,
  };
}
