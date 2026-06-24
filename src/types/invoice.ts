export type PricingMode = 'weight_based' | 'flat_price';

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  weight_grams: number;
  quantity: number;
  selling_price: number;
  making_charges: number;
  gst_percentage: number;
  pricing_mode: PricingMode;
  mrp: number;
  categories?: { name: string } | null;
}

export interface Client {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  gst_number: string | null;
}

export interface InvoiceCustomOrderItemDetail {
  name: string;
  sku?: string | null;
  category?: string | null;
  quantity: number;
  weight_grams: number;
  pricing_mode: PricingMode;
  rate_per_gram: number;
  making_charges: number;
  discount: number;
  line_total: number;
  description?: string | null;
  reference_image_url?: string | null;
}

export interface InvoiceCustomerMaterialDetail {
  name: string;
  description?: string;
  quantity?: number;
  weight_grams?: number;
}

export interface InvoiceCustomOrderComponentDetail {
  name: string;
  material?: string | null;
  quantity: number;
  weight_grams: number;
  unit_price: number;
  rate_per_gram: number;
  total: number;
}

export interface InvoiceChargeDetail {
  label: string;
  amount: number;
}

export interface InvoiceCustomOrderDetails {
  referenceNumber: string;
  orderDate?: string | null;
  expectedDeliveryDate?: string | null;
  gstMode?: 'exclusive' | 'inclusive';
  gstPercentage?: number;
  notes?: string | null;
  orderItems: InvoiceCustomOrderItemDetail[];
  customerMaterials: InvoiceCustomerMaterialDetail[];
  components: InvoiceCustomOrderComponentDetail[];
  charges: InvoiceChargeDetail[];
}

export interface BusinessSettings {
  id: string;
  business_name: string;
  gst_number: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  invoice_prefix: string;
  default_gst: number;
  gold_rate_per_gram: number;
  silver_rate_per_gram: number;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled';

export interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  subtotal: number;
  discount_amount: number;
  gst_amount: number;
  grand_total: number;
  payment_status: string;
  payment_mode: string | null;
  notes: string | null;
  created_at: string;
  client_id: string | null;
  clients?: { name: string; phone: string | null; address?: string | null; gst_number?: string | null } | null;
  status: InvoiceStatus;
  sent_at: string | null;
  paid_at: string | null;
  advance_paid?: number;
  store_credits_used?: number;
  payment_mode_1?: string | null;
  payment_amount_1?: number;
  payment_mode_2?: string | null;
  payment_amount_2?: number;
  total_paid?: number;
  balance_due?: number;
  combined_payment_label?: string | null;
}

export type DiscountType = 'fixed' | 'percentage';

export interface InvoiceItem {
  product_id: string;
  sku: string;
  product_name: string;
  category: string;
  weight_grams: number;
  quantity: number;
  rate_per_gram: number;
  base_price: number;
  making_charges: number;
  making_charges_per_gram: number;
  discount: number;
  discount_type: DiscountType;
  discount_value: number; // the raw input value (fixed amount or percentage)
  discounted_making: number;
  line_total: number;
  gst_percentage: number;
  pricing_mode: PricingMode;
  selling_price?: number; // used for flat_price mode
  mrp: number; // display-only, from product
  description?: string; // optional per-item description / instructions

}

export interface InvoiceTotals {
  subtotal: number;
  discountAmount: number;
  gstAmount: number;
  grandTotal: number;
}

export interface InvoiceFormData {
  clientId: string;
  clientName: string;
  clientPhone: string;
  paymentMode: string;
  notes: string;
  items: InvoiceItem[];
}
