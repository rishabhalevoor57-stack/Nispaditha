import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OrderNote, OrderNoteItem, OrderNoteStatus } from '@/types/orderNote';
import { toast } from '@/hooks/use-toast';

export const useOrderNotes = () => {
  const queryClient = useQueryClient();

  const { data: orderNotes = [], isLoading } = useQuery({
    queryKey: ['order-notes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_notes')
        .select(`
          *,
          handler:handled_by(full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as OrderNote[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-for-handler'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email');

      if (error) throw error;
      return data;
    },
  });

  const generateOrderReference = async (): Promise<string> => {
    const { data, error } = await supabase.rpc('generate_order_reference');
    if (error) throw error;
    return data;
  };

  const getOrderNoteWithItems = async (id: string): Promise<OrderNote & { items: OrderNoteItem[] }> => {
    const [noteResult, itemsResult] = await Promise.all([
      supabase
        .from('order_notes')
        .select('*, handler:handled_by(full_name, email)')
        .eq('id', id)
        .single(),
      supabase
        .from('order_note_items')
        .select('*')
        .eq('order_note_id', id)
        .order('created_at', { ascending: true }),
    ]);

    if (noteResult.error) throw noteResult.error;
    if (itemsResult.error) throw itemsResult.error;

    return {
      ...noteResult.data as unknown as OrderNote,
      items: itemsResult.data as OrderNoteItem[],
    };
  };

  const createCalendarEvents = async (
    orderNoteId: string,
    customerName: string,
    orderDate: string,
    deliveryDate: string | null,
    createdBy: string | null
  ) => {
    const events: Array<{
      title: string;
      event_date: string;
      event_type: string;
      order_note_id: string;
      customer_name: string;
      created_by: string | null;
    }> = [];

    // Order Start Event
    events.push({
      title: `Order Started - ${customerName}`,
      event_date: orderDate,
      event_type: 'order_start',
      order_note_id: orderNoteId,
      customer_name: customerName,
      created_by: createdBy,
    });

    // Delivery Event (if date is set)
    if (deliveryDate) {
      events.push({
        title: `Delivery Due - ${customerName}`,
        event_date: deliveryDate,
        event_type: 'delivery',
        order_note_id: orderNoteId,
        customer_name: customerName,
        created_by: createdBy,
      });
    }

    await supabase.from('calendar_events').insert(events);
  };

  const updateCalendarEvents = async (
    orderNoteId: string,
    customerName: string,
    orderDate: string,
    deliveryDate: string | null,
    createdBy: string | null
  ) => {
    // Delete existing events
    await supabase
      .from('calendar_events')
      .delete()
      .eq('order_note_id', orderNoteId);

    // Create new events
    await createCalendarEvents(orderNoteId, customerName, orderDate, deliveryDate, createdBy);
  };

  const createOrderNote = useMutation({
    mutationFn: async (data: {
      note: Omit<OrderNote, 'id' | 'balance' | 'created_at' | 'updated_at'>;
      items: Omit<OrderNoteItem, 'id' | 'order_note_id' | 'created_at'>[];
    }) => {
      const { data: noteData, error: noteError } = await supabase
        .from('order_notes')
        .insert(data.note)
        .select()
        .single();

      if (noteError) throw noteError;

      if (data.items.length > 0) {
        const itemsWithNoteId = data.items.map(item => ({
          ...item,
          order_note_id: noteData.id,
        }));

        const { error: itemsError } = await supabase
          .from('order_note_items')
          .insert(itemsWithNoteId);

        if (itemsError) throw itemsError;
      }

      // Create calendar events
      await createCalendarEvents(
        noteData.id,
        data.note.customer_name,
        data.note.order_date,
        data.note.expected_delivery_date || null,
        data.note.created_by || null
      );

      return noteData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-notes'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast({ title: 'Order note created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error creating order note', description: error.message, variant: 'destructive' });
    },
  });

  const updateOrderNote = useMutation({
    mutationFn: async (data: {
      id: string;
      note: Partial<OrderNote>;
      items: Omit<OrderNoteItem, 'order_note_id' | 'created_at'>[];
    }) => {
      const { error: noteError } = await supabase
        .from('order_notes')
        .update(data.note)
        .eq('id', data.id);

      if (noteError) throw noteError;

      // Delete existing items and insert new ones
      const { error: deleteError } = await supabase
        .from('order_note_items')
        .delete()
        .eq('order_note_id', data.id);

      if (deleteError) throw deleteError;

      if (data.items.length > 0) {
        const itemsWithNoteId = data.items.map(item => ({
          item_description: item.item_description,
          customization_notes: item.customization_notes,
          quantity: item.quantity,
          expected_price: item.expected_price,
          order_note_id: data.id,
        }));

        const { error: itemsError } = await supabase
          .from('order_note_items')
          .insert(itemsWithNoteId);

        if (itemsError) throw itemsError;
      }

      // Update calendar events
      if (data.note.customer_name && data.note.order_date) {
        await updateCalendarEvents(
          data.id,
          data.note.customer_name,
          data.note.order_date,
          data.note.expected_delivery_date || null,
          data.note.created_by || null
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-notes'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast({ title: 'Order note updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating order note', description: error.message, variant: 'destructive' });
    },
  });

  const deleteOrderNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('order_notes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-notes'] });
      toast({ title: 'Order note deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error deleting order note', description: error.message, variant: 'destructive' });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderNoteStatus }) => {
      const { error } = await supabase
        .from('order_notes')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-notes'] });
      toast({ title: 'Status updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating status', description: error.message, variant: 'destructive' });
    },
  });

  return {
    orderNotes,
    isLoading,
    profiles,
    generateOrderReference,
    getOrderNoteWithItems,
    createOrderNote,
    updateOrderNote,
    deleteOrderNote,
    updateStatus,
  };
};
