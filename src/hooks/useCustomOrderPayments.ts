import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export type PaymentMode = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'store_credit' | 'multiple';

export interface CustomOrderPayment {
  id: string;
  custom_order_id: string;
  reference_number: string;
  amount: number;
  payment_mode: PaymentMode;
  payment_date: string;
  notes: string | null;
  transferred_to_invoice_payment_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const useCustomOrderPayments = (customOrderId?: string) => {
  const qc = useQueryClient();

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['custom-order-payments', customOrderId],
    queryFn: async () => {
      if (!customOrderId) return [] as CustomOrderPayment[];
      const { data, error } = await (supabase
        .from('custom_order_payments' as any)
        .select('*')
        .eq('custom_order_id', customOrderId)
        .order('payment_date', { ascending: true }) as any);
      if (error) throw error;
      return (data || []) as CustomOrderPayment[];
    },
    enabled: !!customOrderId,
  });

  const addPayment = useMutation({
    mutationFn: async (input: {
      custom_order_id: string;
      amount: number;
      payment_mode: PaymentMode;
      payment_date: string;
      notes?: string | null;
    }) => {
      const { data: ref, error: refErr } = await supabase.rpc('generate_advance_reference' as any);
      if (refErr) throw refErr;
      const { data, error } = await (supabase
        .from('custom_order_payments' as any)
        .insert({
          custom_order_id: input.custom_order_id,
          reference_number: ref as unknown as string,
          amount: input.amount,
          payment_mode: input.payment_mode,
          payment_date: input.payment_date,
          notes: input.notes || null,
        } as any)
        .select('*')
        .single() as any);
      if (error) throw error;
      return data as CustomOrderPayment;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['custom-order-payments', vars.custom_order_id] });
      qc.invalidateQueries({ queryKey: ['custom-orders'] });
      toast({ title: 'Advance payment recorded' });
    },
    onError: (e: Error) => toast({ title: 'Could not record advance', description: e.message, variant: 'destructive' }),
  });

  const deletePayment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('custom_order_payments' as any).delete().eq('id', id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-order-payments', customOrderId] });
      qc.invalidateQueries({ queryKey: ['custom-orders'] });
      toast({ title: 'Advance payment removed' });
    },
    onError: (e: Error) => toast({ title: 'Could not remove advance', description: e.message, variant: 'destructive' }),
  });

  const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const totalByMode = payments.reduce((acc, p) => {
    acc[p.payment_mode] = (acc[p.payment_mode] || 0) + (Number(p.amount) || 0);
    return acc;
  }, {} as Record<string, number>);

  return { payments, isLoading, addPayment, deletePayment, totalPaid, totalByMode };
};
