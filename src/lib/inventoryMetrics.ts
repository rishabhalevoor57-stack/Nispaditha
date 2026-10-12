export interface InventoryMetricProduct {
  id: string;
  sku: string;
  quantity: number;
  weight_grams: number;
  purchase_price: number | null;
  pricing_mode: string | null;
  low_stock_alert: number;
  deleted_at?: string | null;
  category_id: string | null;
  categories?: { name: string } | null;
}

export interface CategoryStockData {
  categoryId: string;
  categoryName: string;
  totalItems: number;
  totalQuantity: number;
  totalWeight: number;
  stockValue: number;
  purchaseValue: number;
}

export const inventoryNumber = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

export function productStockValues(product: Pick<InventoryMetricProduct, 'quantity' | 'weight_grams' | 'purchase_price' | 'pricing_mode'>, silverRate: number) {
  const quantity = Math.max(0, inventoryNumber(product.quantity));
  const flat = product.pricing_mode === 'flat_price';
  const weight = flat ? 0 : Math.max(0, inventoryNumber(product.weight_grams)) * quantity;
  const purchaseValue = quantity === 0 ? 0 : inventoryNumber(product.purchase_price) * (flat ? 1 : quantity);
  return { quantity, weight, metalValue: weight * inventoryNumber(silverRate), purchaseValue };
}

export function calculateInventoryMetrics<T extends InventoryMetricProduct>(records: T[], silverRate: number, historicalSkus: string[] = records.map(p => p.sku)) {
  const products = records.filter(p => !p.deleted_at);
  const inStockProducts = products.filter(p => inventoryNumber(p.quantity) > 0);
  const outOfStockProducts = products.filter(p => inventoryNumber(p.quantity) <= 0);
  const lowStockProducts = inStockProducts.filter(p => inventoryNumber(p.low_stock_alert) > 0 && inventoryNumber(p.quantity) <= inventoryNumber(p.low_stock_alert));
  const countSkus = (items: T[]) => new Set(items.map(p => p.sku)).size;
  const categories = new Map<string, CategoryStockData>();
  for (const product of inStockProducts) {
    const categoryId = product.category_id || 'uncategorized';
    const category = categories.get(categoryId) ?? {
      categoryId, categoryName: product.categories?.name || 'Uncategorized',
      totalItems: 0, totalQuantity: 0, totalWeight: 0, stockValue: 0, purchaseValue: 0,
    };
    const values = productStockValues(product, silverRate);
    category.totalItems += 1;
    category.totalQuantity += values.quantity;
    category.totalWeight += values.weight;
    category.stockValue += values.metalValue;
    category.purchaseValue += values.purchaseValue;
    categories.set(categoryId, category);
  }
  const categoryData = [...categories.values()].sort((a, b) => b.stockValue - a.stockValue);
  const totals = categoryData.reduce((sum, cat) => ({
    totalItems: sum.totalItems + cat.totalItems,
    totalQuantity: sum.totalQuantity + cat.totalQuantity,
    totalWeight: sum.totalWeight + cat.totalWeight,
    totalStockValue: sum.totalStockValue + cat.stockValue,
    totalPurchaseValue: sum.totalPurchaseValue + cat.purchaseValue,
  }), { totalItems: 0, totalQuantity: 0, totalWeight: 0, totalStockValue: 0, totalPurchaseValue: 0 });
  return {
    products, inStockProducts, outOfStockProducts, lowStockProducts, categoryData, totals,
    inventoryStats: {
      currentProducts: countSkus(inStockProducts), outOfStockCount: countSkus(outOfStockProducts),
      lifetimeSkus: new Set(historicalSkus).size,
      totalQuantity: totals.totalQuantity, totalWeight: totals.totalWeight,
    },
  };
}