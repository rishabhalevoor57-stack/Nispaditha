export type TypeOfWork = string;
export type ProductStatus = 'sold' | 'in_stock' | 'for_repair';
export type ProductCategory = 'Ring' | 'Chain' | 'Necklace' | 'Bangle' | 'Earring' | 'Bracelet' | 'Pendant' | 'Coin' | 'Others';
export type PricingMode = 'weight_based' | 'flat_price';

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category_id: string | null;
  metal_type: string | null;
  purity: string | null;
  weight_grams: number;
  quantity: number;
  purchase_price: number;
  selling_price: number;
  making_charges: number;
  gst_percentage: number;
  low_stock_alert: number;
  image_url: string | null;
  supplier_id: string | null;
  type_of_work: TypeOfWork;
  bangle_size: string | null;
  date_ordered: string | null;
  price_per_gram: number;
  status: ProductStatus;
  mrp: number;
  purchase_price_per_gram: number;
  purchase_making_charges: number;
  pricing_mode: PricingMode;
  created_at: string;
  updated_at: string;
  categories?: { name: string } | null;
  suppliers?: { name: string } | null;
}

export interface ProductFormData {
  sku: string;
  name: string;
  description: string;
  category_id: string;
  metal_type: string;
  purity: string;
  weight_grams: number;
  quantity: number;
  purchase_price: number;
  selling_price: number;
  making_charges: number;
  gst_percentage: number;
  low_stock_alert: number;
  supplier_id: string;
  type_of_work: TypeOfWork;
  bangle_size: string;
  date_ordered: string;
  price_per_gram: number;
  status: ProductStatus;
  mrp: number;
  purchase_price_per_gram: number;
  purchase_making_charges: number;
  pricing_mode: PricingMode;
}

// TYPE_OF_WORK_OPTIONS is now fetched from the database via useTypesOfWork hook
export const TYPE_OF_WORK_OPTIONS: TypeOfWork[] = [];
export const STATUS_OPTIONS: { value: ProductStatus; label: string }[] = [
  { value: 'in_stock', label: 'In Stock' },
  { value: 'sold', label: 'Sold' },
  { value: 'for_repair', label: 'For Repair' },
];
export const CATEGORY_OPTIONS: ProductCategory[] = ['Ring', 'Chain', 'Necklace', 'Bangle', 'Earring', 'Bracelet', 'Pendant', 'Coin', 'Others'];
export const PRICING_MODE_OPTIONS: { value: PricingMode; label: string }[] = [
  { value: 'weight_based', label: 'Weight Based' },
  { value: 'flat_price', label: 'Flat Price' },
];

export const initialProductForm: ProductFormData = {
  sku: '',
  name: '',
  description: '',
  category_id: '',
  metal_type: '',
  purity: '',
  weight_grams: 0,
  quantity: 0,
  purchase_price: 0,
  selling_price: 0,
  making_charges: 0,
  gst_percentage: 3,
  low_stock_alert: 5,
  supplier_id: '',
  type_of_work: 'Others',
  bangle_size: '',
  date_ordered: new Date().toISOString().split('T')[0],
  price_per_gram: 0,
  status: 'in_stock',
  mrp: 0,
  purchase_price_per_gram: 0,
  purchase_making_charges: 0,
  pricing_mode: 'weight_based',
};
