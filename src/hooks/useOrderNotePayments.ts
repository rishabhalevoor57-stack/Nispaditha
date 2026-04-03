import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface OrderNotePayment {
  id: string;
  order_note_id: string;
  amount: number;
  payment_mode: string;
  payment_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export const useOrderNotePayments = (orderNoteId?: string) => {
  const queryClient = useQueryClient();

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['order-note-payments', orderNoteId],
    enabled: !!orderNoteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_note_payments')
        .select('*')
        .eq('order_note_id', orderNoteId!)
        .order('payment_date', { ascending: true });

      if (error) throw error;
      return data as OrderNotePayment[];
    },
  });

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  const addPayment = useMutation({
    mutationFn: async (payment: {
      order_note_id: string;
      amount: number;
      payment_mode: string;
      payment_date: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('order_note_payments')
        .insert({ ...payment, created_by: user?.id || null });

      if (error) throw error;

      // Update advance_received and balance on order_notes
      const { data: noteData } = await supabase
        .from('order_notes')
        .select('quoted_estimate')
        .eq('id', payment.order_note_id)
        .single();

      if (noteData) {
        const { data: allPayments } = await supabase
          .from('order_note_payments')
          .select('amount')
          .eq('order_note_id', payment.order_note_id);

        const newTotal = (allPayments || []).reduce((s, p) => s + Number(p.amount), 0);
        const balance = (noteData.quoted_estimate || 0) - newTotal;

        await supabase
          .from('order_notes')
          .update({
            advance_received: newTotal,
            balance: Math.max(0, balance),
          } as any)
          .eq('id', payment.order_note_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-note-payments', orderNoteId] });
      queryClient.invalidateQueries({ queryKey: ['order-notes'] });
      queryClient.invalidateQueries({ queryKey: ['left-over-payments'] });
      toast({ title: 'Payment recorded successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error recording payment', description: error.message, variant: 'destructive' });
    },
  });

  return { payments, isLoading, totalPaid, addPayment };
};
