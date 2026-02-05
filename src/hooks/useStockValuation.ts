import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CategoryStockData {
  categoryId: string;
  categoryName: string;
  totalItems: number;
  totalQuantity: number;
  totalWeight: number;
  stockValue: number;
}

export interface ProductForValuation {
  id: string;
  name: string;
  sku: string;
  weight_grams: number;
  quantity: number;
  category_id: string | null;
  categories: { name: string } | null;
}

export const useStockValuation = () => {
  // Fetch live silver rate
  const { data: silverRate = 95, isLoading: rateLoading } = useQuery({
    queryKey: ['silver-rate'],
    queryFn: async () => {
      const { data } = await supabase
        .from('business_settings')
        .select('silver_rate_per_gram')
        .maybeSingle();
      return data?.silver_rate_per_gram || 95;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch all products with categories
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products-for-valuation'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, weight_grams, quantity, category_id, categories(name)')
        .gt('quantity', 0);

      if (error) throw error;
      return data as ProductForValuation[];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Calculate category-wise stock valuation
  const categoryData: CategoryStockData[] = (() => {
    const categoryMap = new Map<string, CategoryStockData>();

    products.forEach((product) => {
      const categoryId = product.category_id || 'uncategorized';
      const categoryName = product.categories?.name || 'Uncategorized';

      if (!categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, {
          categoryId,
          categoryName,
          totalItems: 0,
          totalQuantity: 0,
          totalWeight: 0,
          stockValue: 0,
        });
      }

      const category = categoryMap.get(categoryId)!;
      const itemWeight = product.weight_grams * product.quantity;
      const itemValue = itemWeight * silverRate;

      category.totalItems += 1;
      category.totalQuantity += product.quantity;
      category.totalWeight += itemWeight;
      category.stockValue += itemValue;
    });

    return Array.from(categoryMap.values()).sort((a, b) => b.stockValue - a.stockValue);
  })();

  // Calculate totals
  const totals = categoryData.reduce(
    (acc, cat) => ({
      totalItems: acc.totalItems + cat.totalItems,
      totalQuantity: acc.totalQuantity + cat.totalQuantity,
      totalWeight: acc.totalWeight + cat.totalWeight,
      totalStockValue: acc.totalStockValue + cat.stockValue,
    }),
    { totalItems: 0, totalQuantity: 0, totalWeight: 0, totalStockValue: 0 }
  );

  // Get products by category
  const getProductsByCategory = (categoryId: string): ProductForValuation[] => {
    if (categoryId === 'uncategorized') {
      return products.filter((p) => !p.category_id);
    }
    return products.filter((p) => p.category_id === categoryId);
  };

  return {
    categoryData,
    totals,
    silverRate,
    products,
    isLoading: rateLoading || productsLoading,
    getProductsByCategory,
  };
};
