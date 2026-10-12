import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useInventorySnapshot } from '@/hooks/useInventorySnapshot';
import { supabase } from '@/integrations/supabase/client';
import { fetchPendingInvoices, aggregateOutstanding } from '@/lib/pendingBalances';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, format, subMonths, parseISO } from 'date-fns';

export type DatePreset = 'today' | 'this_month' | 'this_year' | 'custom';

export interface ReportFilters {
  datePreset: DatePreset;
  dateFrom: Date;
  dateTo: Date;
  storeId: string | 'all';
}

const getPresetDates = (preset: DatePreset): { from: Date; to: Date } => {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'this_month':
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'this_year':
      return { from: startOfYear(now), to: endOfYear(now) };
    default:
      return { from: startOfMonth(now), to: endOfMonth(now) };
  }
};

export const useReports = () => {
  const [filters, setFilters] = useState<ReportFilters>({
    datePreset: 'this_month',
    dateFrom: startOfMonth(new Date()),
    dateTo: endOfMonth(new Date()),
    storeId: 'all',
  });

  const setPreset = (preset: DatePreset) => {
    const dates = getPresetDates(preset);
    setFilters(prev => ({ ...prev, datePreset: preset, dateFrom: dates.from, dateTo: dates.to }));
  };

  const setCustomDates = (from: Date, to: Date) => {
    setFilters(prev => ({ ...prev, datePreset: 'custom', dateFrom: from, dateTo: to }));
  };

  const setStoreId = (storeId: string) => {
    setFilters(prev => ({ ...prev, storeId }));
  };

  const fromISO = filters.dateFrom.toISOString();
  const toISO = filters.dateTo.toISOString();

  // Stores
  const { data: stores = [] } = useQuery({
    queryKey: ['report-stores'],
    queryFn: async () => {
      const { data, error } = await supabase.from('stores').select('id, store_name').eq('is_active', true);
      if (error) throw error;
      return data;
    },
  });

  // Invoices with items
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['report-invoices', fromISO, toISO, filters.storeId],
    queryFn: async () => {
      let query = supabase
        .from('invoices')
        .select('*, clients(name, phone), invoice_items(*)')
        .gte('created_at', fromISO)
        .lte('created_at', toISO);
      if (filters.storeId !== 'all') query = query.eq('store_id', filters.storeId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: pendingPayments = [], isLoading: pendingPaymentsLoading } = useQuery({
    queryKey: ['report-pending-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, invoice_date, grand_total, advance_paid, payment_status, clients(name, phone)')
        .in('payment_status', ['partial', 'pending'])
        .order('invoice_date', { ascending: true });
      if (error) throw error;
      return (data || []).map((invoice: any) => ({
        ...invoice,
        customer: invoice.clients?.name || 'Walk-in',
        phone: invoice.clients?.phone || null,
        balance: Math.max(0, Number(invoice.grand_total || 0) - Number(invoice.advance_paid || 0)),
      }));
    },
  });

  const snapshot = useInventorySnapshot();
  const { products, inventoryStats, settings, isLoading: productsLoading } = snapshot;

  // Clients
  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['report-clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  // Custom Orders
  // Pending payments ledger (shared with the Pending Payments page)
  const { data: pendingInvoices = [] } = useQuery({
    queryKey: ['pending-payments-invoices'],
    queryFn: fetchPendingInvoices,
  });

  const { data: customOrders = [], isLoading: customOrdersLoading } = useQuery({
    queryKey: ['report-custom-orders', fromISO, toISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_orders')
        .select('*')
        .gte('created_at', fromISO)
        .lte('created_at', toISO);
      if (error) throw error;
      return data || [];
    },
  });

  // Sales stats
  const salesStats = useMemo(() => {
    const totalSales = invoices.reduce((s: number, i: any) => s + Number(i.grand_total), 0);
    const totalInvoices = invoices.length;
    const allItems = invoices.flatMap((i: any) => i.invoice_items || []);
    const itemsSold = allItems.reduce((s: number, it: any) => s + (it.quantity || 0), 0);
    const weightSold = allItems.reduce((s: number, it: any) => s + Number(it.weight_grams || 0) * (it.quantity || 1), 0);
    return { totalSales, totalInvoices, itemsSold, weightSold };
  }, [invoices]);

  // Daily sales chart data
  const dailySalesData = useMemo(() => {
    const map: Record<string, number> = {};
    invoices.forEach((inv: any) => {
      const day = format(new Date(inv.created_at), 'dd MMM');
      map[day] = (map[day] || 0) + Number(inv.grand_total);
    });
    return Object.entries(map).map(([date, amount]) => ({ date, amount }));
  }, [invoices]);

  // Monthly sales chart data
  const monthlySalesData = useMemo(() => {
    const map: Record<string, number> = {};
    invoices.forEach((inv: any) => {
      const month = format(new Date(inv.created_at), 'MMM yyyy');
      map[month] = (map[month] || 0) + Number(inv.grand_total);
    });
    return Object.entries(map).map(([month, amount]) => ({ month, amount }));
  }, [invoices]);

  // Category-wise sales
  const categorySalesData = useMemo(() => {
    const map: Record<string, { sales: number; qty: number }> = {};
    invoices.forEach((inv: any) => {
      (inv.invoice_items || []).forEach((item: any) => {
        const cat = item.category || 'Uncategorized';
        if (!map[cat]) map[cat] = { sales: 0, qty: 0 };
        map[cat].sales += Number(item.total || 0);
        map[cat].qty += item.quantity || 0;
      });
    });
    return Object.entries(map).map(([category, data]) => ({ category, ...data }));
  }, [invoices]);

  const categoryStockData = snapshot.categoryData.map(category => ({
    category: category.categoryName, items: category.totalItems,
    qty: category.totalQuantity, weight: category.totalWeight, value: category.stockValue,
  }));

  // Top selling products
  const topSellingProducts = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};
    invoices.forEach((inv: any) => {
      (inv.invoice_items || []).forEach((item: any) => {
        const key = item.product_id || item.product_name;
        if (!map[key]) map[key] = { name: item.product_name, qty: 0, revenue: 0 };
        map[key].qty += item.quantity || 0;
        map[key].revenue += Number(item.total || 0);
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [invoices]);

  // Low selling products
  const lowSellingProducts = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};
    invoices.forEach((inv: any) => {
      (inv.invoice_items || []).forEach((item: any) => {
        const key = item.product_id || item.product_name;
        if (!map[key]) map[key] = { name: item.product_name, qty: 0, revenue: 0 };
        map[key].qty += item.quantity || 0;
        map[key].revenue += Number(item.total || 0);
      });
    });
    return Object.values(map).sort((a, b) => a.revenue - b.revenue).slice(0, 10);
  }, [invoices]);

  // Top customers
  const topCustomers = useMemo(() => {
    const map: Record<string, { name: string; invoices: number; total: number }> = {};
    invoices.forEach((inv: any) => {
      const name = inv.clients?.name || 'Walk-in';
      const key = inv.client_id || 'walkin';
      if (!map[key]) map[key] = { name, invoices: 0, total: 0 };
      map[key].invoices += 1;
      map[key].total += Number(inv.grand_total);
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [invoices]);

  // Repeat customers (2+ invoices)
  const repeatCustomers = useMemo(() => {
    const map: Record<string, { name: string; count: number; total: number }> = {};
    invoices.forEach((inv: any) => {
      if (!inv.client_id) return;
      const name = inv.clients?.name || 'Unknown';
      if (!map[inv.client_id]) map[inv.client_id] = { name, count: 0, total: 0 };
      map[inv.client_id].count += 1;
      map[inv.client_id].total += Number(inv.grand_total);
    });
    return Object.values(map).filter(c => c.count >= 2).sort((a, b) => b.count - a.count);
  }, [invoices]);

  // Outstanding balances — single source of truth: the Pending Payments ledger
  const outstandingClients = useMemo(
    () => aggregateOutstanding(pendingInvoices),
    [pendingInvoices]
  );

  const lowStockItems = snapshot.lowStockProducts.map(p => ({
    name: p.name, sku: p.sku, quantity: p.quantity, alert: p.low_stock_alert,
    category: p.categories?.name ?? null,
  }));
  const outOfStockItems = snapshot.outOfStockProducts.map(p => ({
    id: p.id, name: p.name, sku: p.sku, category: p.categories?.name ?? null,
    weight: Number(p.weight_grams || 0), lastUpdated: p.updated_at,
  })).sort((a, b) => (b.lastUpdated || '').localeCompare(a.lastUpdated || ''));
  const totalStockValue = snapshot.totals.totalStockValue;

  // Custom order reports
  const customOrderStats = useMemo(() => {
    const inProduction = customOrders.filter((o: any) => o.status === 'in_production').length;
    const delivered = customOrders.filter((o: any) => o.status === 'delivered').length;
    const pending = customOrders.filter((o: any) => ['draft', 'confirmed'].includes(o.status)).length;
    const ready = customOrders.filter((o: any) => o.status === 'ready').length;
    const totalValue = customOrders.reduce((s: number, o: any) => s + Number(o.total_amount), 0);
    return { inProduction, delivered, pending, ready, total: customOrders.length, totalValue };
  }, [customOrders]);

  const customOrdersByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    customOrders.forEach((o: any) => {
      map[o.status] = (map[o.status] || 0) + 1;
    });
    return Object.entries(map).map(([status, count]) => ({ status, count }));
  }, [customOrders]);

  const isLoading = invoicesLoading || pendingPaymentsLoading || productsLoading || clientsLoading || customOrdersLoading;

  return {
    filters,
    setPreset,
    setCustomDates,
    setStoreId,
    stores,
    isLoading,
    salesStats,
    dailySalesData,
    monthlySalesData,
    categorySalesData,
    categoryStockData,
    topSellingProducts,
    lowSellingProducts,
    topCustomers,
    repeatCustomers,
    outstandingClients,
    pendingPayments,
    lowStockItems,
    outOfStockItems,
    totalStockValue,
    inventoryStats,

    products,
    customOrderStats,
    customOrdersByStatus,
    customOrders,
    invoices,
    settings,
  };
};
