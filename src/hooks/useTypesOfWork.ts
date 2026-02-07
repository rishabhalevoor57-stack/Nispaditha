import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TypeOfWorkRecord {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export function useTypesOfWork() {
  const [typesOfWork, setTypesOfWork] = useState<TypeOfWorkRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchTypesOfWork();
    fetchProductCounts();
  }, []);

  const fetchTypesOfWork = async () => {
    try {
      const { data, error } = await supabase
        .from('types_of_work')
        .select('*')
        .order('name');
      if (error) throw error;
      setTypesOfWork(data || []);
    } catch (error) {
      console.error('Error fetching types of work:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProductCounts = async () => {
    const { data } = await supabase.from('products').select('type_of_work');
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach((p) => {
        const tow = p.type_of_work || '';
        if (tow) {
          counts[tow] = (counts[tow] || 0) + 1;
        }
      });
      setProductCounts(counts);
    }
  };

  const addTypeOfWork = async (name: string) => {
    try {
      const { error } = await supabase.from('types_of_work').insert([{ name }]);
      if (error) throw error;
      toast({ title: 'Type of Work added' });
      fetchTypesOfWork();
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: msg });
      return false;
    }
  };

  const updateTypeOfWork = async (id: string, oldName: string, newName: string) => {
    try {
      const { error } = await supabase
        .from('types_of_work')
        .update({ name: newName })
        .eq('id', id);
      if (error) throw error;

      // Update all products that reference the old name
      await supabase
        .from('products')
        .update({ type_of_work: newName })
        .eq('type_of_work', oldName);

      toast({ title: 'Type of Work renamed' });
      fetchTypesOfWork();
      fetchProductCounts();
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: msg });
      return false;
    }
  };

  const deleteTypeOfWork = async (name: string) => {
    const count = productCounts[name] || 0;
    if (count > 0) {
      toast({
        variant: 'destructive',
        title: 'Cannot delete',
        description: `${count} product(s) are linked to "${name}". Reassign them first.`,
      });
      return false;
    }

    try {
      const { error } = await supabase.from('types_of_work').delete().eq('name', name);
      if (error) throw error;
      toast({ title: 'Type of Work deleted' });
      fetchTypesOfWork();
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: msg });
      return false;
    }
  };

  return {
    typesOfWork,
    isLoading,
    productCounts,
    addTypeOfWork,
    updateTypeOfWork,
    deleteTypeOfWork,
    refresh: fetchTypesOfWork,
  };
}
