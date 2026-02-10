export interface CustomOrderItem {
  id?: string;
  custom_order_id?: string;
  item_description: string;
  customization_notes?: string;
  reference_image_url?: string;
  quantity: number;
  expected_weight: number;
  pricing_mode: 'weight_based' | 'flat_price';
  flat_price: number;
  mc_per_gram: number;
  discount_on_mc: number;
  rate_per_gram: number;
  base_price: number;
  mc_amount: number;
  item_total: number;
  created_at?: string;
}

export interface CustomOrder {
  id: string;
  reference_number: string;
  client_name: string;
  phone_number: string | null;
  order_date: string;
  expected_delivery_date: string | null;
  status: CustomOrderStatus;
  design_charges: number;
  additional_charge: number;
  additional_charge_label: string;
  total_amount: number;
  notes: string | null;
  converted_to_invoice_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  items?: CustomOrderItem[];
}

export type CustomOrderStatus = 'order_noted' | 'design_approved' | 'in_production' | 'ready' | 'delivered';

export const CUSTOM_ORDER_STATUS_LABELS: Record<CustomOrderStatus, string> = {
  order_noted: 'Order Noted',
  design_approved: 'Design Approved',
  in_production: 'In Production',
  ready: 'Ready',
  delivered: 'Delivered',
};

export const CUSTOM_ORDER_STATUS_COLORS: Record<CustomOrderStatus, string> = {
  order_noted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  design_approved: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  in_production: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  ready: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  delivered: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};
