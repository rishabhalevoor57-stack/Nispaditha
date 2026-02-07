export type ReturnExchangeType = 'return' | 'exchange';
export type ItemDirection = 'returned' | 'new';

export interface ReturnExchange {
  id: string;
  reference_number: string;
  type: ReturnExchangeType;
  original_invoice_id: string;
  original_invoice_number: string;
  client_name: string | null;
  client_phone: string | null;
  refund_amount: number;
  additional_charge: number;
  payment_mode: string | null;
  reason: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReturnExchangeItem {
  id: string;
  return_exchange_id: string;
  direction: ItemDirection;
  product_id: string | null;
  product_name: string;
  sku: string | null;
  category: string | null;
  quantity: number;
  weight_grams: number;
  rate_per_gram: number;
  making_charges: number;
  discount: number;
  line_total: number;
  gst_percentage: number;
  gst_amount: number;
  total: number;
  created_at: string;
}

// Used during the creation flow
export interface ReturnItemSelection {
  invoice_item_id: string;
  product_id: string | null;
  product_name: string;
  sku: string;
  category: string;
  weight_grams: number;
  quantity: number;
  max_quantity: number;
  rate_per_gram: number;
  making_charges: number;
  discount: number;
  line_total: number;
  gst_percentage: number;
  gst_amount: number;
  total: number;
  selected: boolean;
  return_quantity: number;
  reason: string;
}
