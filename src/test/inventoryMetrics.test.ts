import { describe, expect, it } from 'vitest';
import { calculateInventoryMetrics, productStockValues, InventoryMetricProduct } from '@/lib/inventoryMetrics';

const product = (overrides: Partial<InventoryMetricProduct> = {}): InventoryMetricProduct => ({
  id: '1', sku: 'SILVER1', quantity: 3, weight_grams: 10, purchase_price: 200,
  pricing_mode: 'weight_based', low_stock_alert: 2, category_id: 'silver',
  categories: { name: 'Silver' }, ...overrides,
});

describe('authoritative inventory reporting', () => {
  it('values weight-based stock at available weight times configured rate', () => {
    expect(productStockValues(product(), 260)).toEqual({ quantity: 3, weight: 30, metalValue: 7800, purchaseValue: 600 });
  });
  it('sums stored flat purchase values once and excludes them from metal valuation', () => {
    expect(productStockValues(product({ pricing_mode: 'flat_price', quantity: 20 }), 260))
      .toEqual({ quantity: 20, weight: 0, metalValue: 0, purchaseValue: 200 });
  });
  it('excludes sold-out and soft-deleted products from available quantity and weight', () => {
    const result = calculateInventoryMetrics([
      product(), product({ id: '2', sku: 'SOLD', quantity: 0 }),
      product({ id: '3', sku: 'DELETED', deleted_at: '2026-10-01' }),
    ], 260);
    expect(result.inventoryStats).toEqual({ currentProducts: 1, outOfStockCount: 1, lifetimeSkus: 3, totalQuantity: 3, totalWeight: 30 });
  });
  it('uses positive configured quantity thresholds rather than classifying every item as low stock', () => {
    const result = calculateInventoryMetrics([
      product(), product({ id: '2', sku: 'LOW', quantity: 2 }),
      product({ id: '3', sku: 'DISABLED', quantity: 1, low_stock_alert: 0 }),
      product({ id: '4', sku: 'OUT', quantity: 0 }),
    ], 260);
    expect(result.lowStockProducts.map(p => p.sku)).toEqual(['LOW']);
  });
  it('counts historical SKUs once including deleted and registry-only records', () => {
    const result = calculateInventoryMetrics([product()], 260, ['SILVER1', 'SOLD', 'DELETED', 'REGISTRY', 'SILVER1']);
    expect(result.inventoryStats.lifetimeSkus).toBe(4);
  });
  it('recomputes consistently after stock deduction and restoration', () => {
    const before = calculateInventoryMetrics([product()], 260);
    const deducted = calculateInventoryMetrics([product({ quantity: 0 })], 260);
    const restored = calculateInventoryMetrics([product()], 260);
    expect(before.totals.totalStockValue).toBe(7800);
    expect(deducted.inventoryStats.currentProducts).toBe(0);
    expect(deducted.totals.totalStockValue).toBe(0);
    expect(restored.totals).toEqual(before.totals);
  });
});