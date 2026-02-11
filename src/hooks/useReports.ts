import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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

  // Products with categories
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['report-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name)');
      if (error) throw error;
      return data || [];
    },
  });

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

  // Business settings for rates
  const { data: settings } = useQuery({
    queryKey: ['report-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('business_settings').select('*').limit(1).single();
      if (error) throw error;
      return data;
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

  // Category-wise stock value
  const categoryStockData = useMemo(() => {
    const silverRate = settings?.silver_rate_per_gram || 0;
    const map: Record<string, { items: number; qty: number; weight: number; value: number }> = {};
    products.forEach((p: any) => {
      const cat = p.categories?.name || 'Uncategorized';
      if (!map[cat]) map[cat] = { items: 0, qty: 0, weight: 0, value: 0 };
      map[cat].items += 1;
      map[cat].qty += p.quantity || 0;
      map[cat].weight += Number(p.weight_grams || 0) * (p.quantity || 0);
      map[cat].value += Number(p.weight_grams || 0) * (p.quantity || 0) * silverRate;
    });
    return Object.entries(map).map(([category, data]) => ({ category, ...data }));
  }, [products, settings]);

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

  // Outstanding balances
  const outstandingClients = useMemo(() => {
    return clients
      .filter((c: any) => Number(c.outstanding_balance) > 0)
      .map((c: any) => ({ name: c.name, phone: c.phone, balance: Number(c.outstanding_balance) }))
      .sort((a, b) => b.balance - a.balance);
  }, [clients]);

  // Inventory reports
  const lowStockItems = useMemo(() => {
    return products
      .filter((p: any) => p.quantity <= p.low_stock_alert)
      .map((p: any) => ({ name: p.name, sku: p.sku, quantity: p.quantity, alert: p.low_stock_alert, category: p.categories?.name }));
  }, [products]);

  const totalStockValue = useMemo(() => {
    const silverRate = settings?.silver_rate_per_gram || 0;
    return products.reduce((s: number, p: any) => s + Number(p.weight_grams || 0) * (p.quantity || 0) * silverRate, 0);
  }, [products, settings]);

  // Custom order reports
  const customOrderStats = useMemo(() => {
    const inProduction = customOrders.filter((o: any) => o.status === 'in_production').length;
    const delivered = customOrders.filter((o: any) => o.status === 'delivered').length;
    const pending = customOrders.filter((o: any) => ['order_noted', 'design_approved'].includes(o.status)).length;
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

  const isLoading = invoicesLoading || productsLoading || clientsLoading || customOrdersLoading;

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
    lowStockItems,
    totalStockValue,
    products,
    customOrderStats,
    customOrdersByStatus,
    customOrders,
    invoices,
    settings,
  };
};
