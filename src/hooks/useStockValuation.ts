import { useInventorySnapshot } from '@/hooks/useInventorySnapshot';

export interface CategoryStockData {
  categoryId: string;
  categoryName: string;
  totalItems: number;
  totalQuantity: number;
  totalWeight: number;
  stockValue: number;
  purchaseValue: number;
}

export interface ProductForValuation {
  id: string;
  name: string;
  sku: string;
  weight_grams: number;
  quantity: number;
  purchase_price: number | null;
  selling_price: number | null;
  pricing_mode: string | null;
  category_id: string | null;
  categories: { name: string } | null;
}

export const useStockValuation = () => {
  const snapshot = useInventorySnapshot();
  const products = snapshot.inStockProducts;
  const getProductsByCategory = (categoryId: string): ProductForValuation[] =>
    products.filter(p => (p.category_id || 'uncategorized') === categoryId);
  return {
    categoryData: snapshot.categoryData, totals: snapshot.totals,
    silverRate: snapshot.silverRate, products,
    isLoading: snapshot.isLoading, getProductsByCategory,
  };
};
