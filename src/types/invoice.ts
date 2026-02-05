export interface Product {
  id: string;
  sku: string;
  name: string;
  weight_grams: number;
  quantity: number;
  selling_price: number;
  making_charges: number;
  gst_percentage: number;
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
}

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
  discount: number;
  discounted_making: number;
  line_total: number;
  gst_percentage: number;
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
