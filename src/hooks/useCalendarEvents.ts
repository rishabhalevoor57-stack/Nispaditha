import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CalendarEvent } from '@/types/calendar';
import { toast } from '@/hooks/use-toast';

export const useCalendarEvents = (month?: Date) => {
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['calendar-events', month?.getMonth(), month?.getFullYear()],
    queryFn: async () => {
      let query = supabase
        .from('calendar_events')
        .select('*')
        .order('event_date', { ascending: true });

      if (month) {
        const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
        const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
        
        query = query
          .gte('event_date', startOfMonth.toISOString().split('T')[0])
          .lte('event_date', endOfMonth.toISOString().split('T')[0]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CalendarEvent[];
    },
  });

  const createEvent = useMutation({
    mutationFn: async (event: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('calendar_events')
        .insert(event)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error creating event', description: error.message, variant: 'destructive' });
    },
  });

  const createOrderNoteEvents = async (
    orderNoteId: string,
    customerName: string,
    orderDate: string,
    deliveryDate: string | null,
    createdBy: string | null
  ) => {
    const events: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'>[] = [];

    // Order Start Event
    events.push({
      title: `Order Started - ${customerName}`,
      event_date: orderDate,
      event_type: 'order_start',
      order_note_id: orderNoteId,
      customer_name: customerName,
      notes: null,
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
        notes: null,
        created_by: createdBy,
      });
    }

    // Insert all events
    const { error } = await supabase
      .from('calendar_events')
      .insert(events);

    if (error) throw error;
    
    queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
  };

  const updateOrderNoteEvents = async (
    orderNoteId: string,
    customerName: string,
    orderDate: string,
    deliveryDate: string | null,
    createdBy: string | null
  ) => {
    // Delete existing events for this order note
    await supabase
      .from('calendar_events')
      .delete()
      .eq('order_note_id', orderNoteId);

    // Create new events
    await createOrderNoteEvents(orderNoteId, customerName, orderDate, deliveryDate, createdBy);
  };

  const deleteOrderNoteEvents = useMutation({
    mutationFn: async (orderNoteId: string) => {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('order_note_id', orderNoteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });

  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(event => event.event_date === dateStr);
  };

  const getEventDates = () => {
    const dates: Record<string, { order_start: boolean; delivery: boolean; milestone: boolean }> = {};
    
    events.forEach(event => {
      if (!dates[event.event_date]) {
        dates[event.event_date] = { order_start: false, delivery: false, milestone: false };
      }
      dates[event.event_date][event.event_type] = true;
    });

    return dates;
  };

  return {
    events,
    isLoading,
    createEvent,
    createOrderNoteEvents,
    updateOrderNoteEvents,
    deleteOrderNoteEvents,
    getEventsForDate,
    getEventDates,
  };
};
