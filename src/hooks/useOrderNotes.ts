import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OrderNote, OrderNoteItem, OrderNoteStatus } from '@/types/orderNote';
import { toast } from '@/hooks/use-toast';


const uploadItemImage = async (file: File, orderNoteId: string): Promise<string> => {
  const ext = file.name.split('.').pop() || 'jpg';
  const filePath = `${orderNoteId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  
  const { error } = await supabase.storage
    .from('order-note-images')
    .upload(filePath, file);
  
  if (error) throw error;
  
  const { data } = supabase.storage
    .from('order-note-images')
    .getPublicUrl(filePath);
  
  return data.publicUrl;
};

const uploadItemImages = async (items: OrderNoteItem[], orderNoteId: string): Promise<OrderNoteItem[]> => {
  const results = await Promise.all(
    items.map(async (item) => {
      if (item._imageFile) {
        const imageUrl = await uploadItemImage(item._imageFile, orderNoteId);
        return { ...item, image_url: imageUrl, _imageFile: undefined };
      }
      return { ...item, _imageFile: undefined };
    })
  );
  return results;
};

export const useOrderNotes = () => {
  const queryClient = useQueryClient();

  const { data: orderNotes = [], isLoading } = useQuery({
    queryKey: ['order-notes'],
    queryFn: async () => {
      // Fetch order notes
      const { data: notes, error } = await supabase
        .from('order_notes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch handler profiles for all notes that have handled_by
      const handlerIds = [...new Set(notes.filter(n => n.handled_by).map(n => n.handled_by!))];
      let profilesMap: Record<string, { full_name: string | null; email: string | null }> = {};
      
      if (handlerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', handlerIds);
        
        if (profiles) {
          profilesMap = Object.fromEntries(
            profiles.map(p => [p.user_id, { full_name: p.full_name, email: p.email }])
          );
        }
      }

      return notes.map(note => ({
        ...note,
        handler: note.handled_by ? profilesMap[note.handled_by] || null : null,
      })) as unknown as OrderNote[];
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
        .select('*')
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

    // Get handler profile
    let handler = null;
    if (noteResult.data.handled_by) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', noteResult.data.handled_by)
        .single();
      handler = profile;
    }

    return {
      ...noteResult.data as unknown as OrderNote,
      handler,
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

    events.push({
      title: `Order Started - ${customerName}`,
      event_date: orderDate,
      event_type: 'order_start',
      order_note_id: orderNoteId,
      customer_name: customerName,
      created_by: createdBy,
    });

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
    await supabase
      .from('calendar_events')
      .delete()
      .eq('order_note_id', orderNoteId);

    await createCalendarEvents(orderNoteId, customerName, orderDate, deliveryDate, createdBy);
  };

  const createOrderNote = useMutation({
    mutationFn: async (data: {
      note: Omit<OrderNote, 'id' | 'balance' | 'created_at' | 'updated_at'>;
      items: Omit<OrderNoteItem, 'id' | 'order_note_id' | 'created_at'>[];
    }) => {
      const { data: noteData, error: noteError } = await supabase
        .from('order_notes')
        .insert(data.note as any)
        .select()
        .single();

      if (noteError) throw noteError;

      if (data.items.length > 0) {
        const itemsWithImages = await uploadItemImages(data.items as OrderNoteItem[], noteData.id);
        
        const itemsWithNoteId = itemsWithImages.map(item => ({
          item_description: item.item_description,
          customization_notes: item.customization_notes || null,
          quantity: item.quantity,
          expected_price: item.expected_price,
          service_type: item.service_type || 'new_order',
          image_url: item.image_url || null,
          order_note_id: noteData.id,
        }));

        const { error: itemsError } = await supabase
          .from('order_note_items')
          .insert(itemsWithNoteId);

        if (itemsError) throw itemsError;
      }

      // Only create calendar events for non-draft orders
      if (data.note.status !== 'draft') {
        await createCalendarEvents(
          noteData.id,
          data.note.customer_name,
          data.note.order_date,
          data.note.expected_delivery_date || null,
          data.note.created_by || null
        );
      }

      return noteData;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['order-notes'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      const isDraft = variables.note.status === 'draft';
      toast({ title: isDraft ? 'Draft saved successfully' : 'Order note created successfully' });
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
        .update(data.note as any)
        .eq('id', data.id);

      if (noteError) throw noteError;

      const { error: deleteError } = await supabase
        .from('order_note_items')
        .delete()
        .eq('order_note_id', data.id);

      if (deleteError) throw deleteError;

      if (data.items.length > 0) {
        const itemsWithImages = await uploadItemImages(data.items as OrderNoteItem[], data.id);
        
        const itemsWithNoteId = itemsWithImages.map(item => ({
            item_description: item.item_description,
            customization_notes: item.customization_notes,
            quantity: item.quantity,
            expected_price: item.expected_price,
            service_type: item.service_type || 'new_order',
            image_url: item.image_url || null,
            order_note_id: data.id,
          }));

        const { error: itemsError } = await supabase
          .from('order_note_items')
          .insert(itemsWithNoteId);

        if (itemsError) throw itemsError;
      }

      if (data.note.customer_name && data.note.order_date) {
        if (data.note.status === 'draft') {
          // Remove calendar events for drafts
          await supabase.from('calendar_events').delete().eq('order_note_id', data.id);
        } else {
          await updateCalendarEvents(
            data.id,
            data.note.customer_name,
            data.note.order_date,
            data.note.expected_delivery_date || null,
            data.note.created_by || null
          );
        }
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
      // Delete calendar events first
      await supabase.from('calendar_events').delete().eq('order_note_id', id);
      // Delete items
      await supabase.from('order_note_items').delete().eq('order_note_id', id);
      // Delete order note
      const { error } = await supabase
        .from('order_notes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-notes'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
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
        .update({ status } as any)
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
