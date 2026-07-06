export interface CustomOrderItem {
  id?: string;
  custom_order_id?: string;
  product_id?: string | null;
  sku?: string | null;
  item_description: string;
  category?: string | null;
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
  discount: number;
  discount_type: 'fixed' | 'percentage';
  discount_value: number;
  item_total: number;
  strings_used?: number | null;
  created_at?: string;
}

export type ComponentUnit = 'weight_based' | 'quantity' | 'strings';

export interface CustomOrderComponent {
  id?: string;
  custom_order_id?: string;
  product_id?: string | null;
  sku?: string | null;
  category?: string | null;
  component_name: string;
  material?: string | null;
  unit?: ComponentUnit;
  weight_grams: number;
  quantity: number;
  quantity_used?: number | null;
  strings_used?: number | null;
  unit_price: number;
  rate_per_gram: number;
  total: number;
  created_at?: string;
}

export interface CustomerSuppliedMaterial {
  name: string;
  description?: string;
  quantity?: number;
  weight_grams?: number;
  strings?: number;
}

export interface ExtraCharge {
  label: string;
  amount: number;
}

export type CustomOrderType = 'customer' | 'in_house';

export interface CustomOrder {
  id: string;
  reference_number: string;
  order_type: CustomOrderType;
  client_name: string;
  phone_number: string | null;
  order_date: string;
  expected_delivery_date: string | null;
  status: CustomOrderStatus;
  design_charges: number;
  additional_charge: number;
  additional_charge_label: string;
  flat_discount: number;
  total_amount: number;
  gst_percentage?: number;
  gst_mode?: 'exclusive' | 'inclusive';
  making_charges?: number;
  labour_charges?: number;
  polishing_charges?: number;
  repair_charges?: number;
  extra_charges?: ExtraCharge[];
  customer_materials?: CustomerSuppliedMaterial[];
  components_total?: number;
  components_weight?: number;
  notes: string | null;
  converted_to_invoice_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // In-house product fields
  product_sku?: string | null;
  product_title?: string | null;
  product_description?: string | null;
  product_date_of_making?: string | null;
  product_vendor_id?: string | null;
  product_buying_price?: number | null;
  product_selling_price?: number | null;
  product_selling_price_manual?: boolean;
  product_category_id?: string | null;
  product_image_urls?: string[];
  inventory_product_id?: string | null;
  items?: CustomOrderItem[];
  components?: CustomOrderComponent[];
}

export type CustomOrderStatus = 'draft' | 'confirmed' | 'in_production' | 'ready' | 'delivered' | 'released';

export const CUSTOM_ORDER_STATUS_LABELS: Record<CustomOrderStatus, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  in_production: 'In Production',
  ready: 'Ready',
  delivered: 'Delivered',
  released: 'Released',
};

export const CUSTOM_ORDER_STATUS_COLORS: Record<CustomOrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  in_production: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  ready: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  delivered: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  released: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};
