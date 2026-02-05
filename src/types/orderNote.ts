export interface OrderNoteItem {
  id?: string;
  order_note_id?: string;
  item_description: string;
  customization_notes?: string;
  quantity: number;
  expected_price: number;
  created_at?: string;
}

export interface OrderNote {
  id: string;
  order_reference: string;
  order_date: string;
  handled_by: string | null;
  customer_name: string;
  phone_number: string | null;
  address: string | null;
  quoted_estimate: number;
  advance_received: number;
  balance: number;
  payment_mode: string | null;
  delivery_type: 'pickup' | 'home_delivery';
  expected_delivery_date: string | null;
  time_slot: string | null;
  special_instructions: string | null;
  status: OrderNoteStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderNoteItem[];
  handler?: { full_name: string | null; email: string | null };
}

export type OrderNoteStatus = 'order_noted' | 'design_approved' | 'in_production' | 'ready' | 'delivered';

export const ORDER_NOTE_STATUS_LABELS: Record<OrderNoteStatus, string> = {
  order_noted: 'Order Noted',
  design_approved: 'Design Approved',
  in_production: 'In Production',
  ready: 'Ready',
  delivered: 'Delivered',
};

export const ORDER_NOTE_STATUS_COLORS: Record<OrderNoteStatus, string> = {
  order_noted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  design_approved: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  in_production: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  ready: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  delivered: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

export const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Other'];
export const TIME_SLOTS = ['Morning (9AM-12PM)', 'Afternoon (12PM-4PM)', 'Evening (4PM-8PM)'];
