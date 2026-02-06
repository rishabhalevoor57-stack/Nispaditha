export type PricingMode = 'weight_based' | 'flat_price';

export interface Product {
  id: string;
  sku: string;
  name: string;
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

export type InvoiceStatus = 'draft' | 'sent' | 'paid';

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
  clients?: { name: string; phone: string | null } | null;
  status: InvoiceStatus;
  sent_at: string | null;
  paid_at: string | null;
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
