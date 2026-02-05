export interface CalendarEvent {
  id: string;
  title: string;
  event_date: string;
  event_type: 'order_start' | 'delivery' | 'milestone';
  order_note_id: string | null;
  customer_name: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const EVENT_TYPE_COLORS: Record<string, string> = {
  order_start: 'bg-success',
  delivery: 'bg-destructive',
  milestone: 'bg-primary',
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  order_start: 'Order Started',
  delivery: 'Delivery Due',
  milestone: 'Milestone',
};
