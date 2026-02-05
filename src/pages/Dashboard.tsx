import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { LiveMetalRatesCard } from '@/components/dashboard/LiveMetalRatesCard';
import { CalendarWidget } from '@/components/dashboard/CalendarWidget';
import { supabase } from '@/integrations/supabase/client';
import { 
  IndianRupee, 
  TrendingUp, 
  Package, 
  AlertTriangle,
  FileText,
  Users
} from 'lucide-react';
import { format } from 'date-fns';

interface DashboardStats {
  todaySales: number;
  monthlySales: number;
  totalExpenses: number;
  lowStockCount: number;
  totalClients: number;
  totalProducts: number;
}

interface RecentInvoice {
  id: string;
  invoice_number: string;
  grand_total: number;
  payment_status: string;
  created_at: string;
  clients?: { name: string } | null;
}

interface LowStockProduct {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  low_stock_alert: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    monthlySales: 0,
    totalExpenses: 0,
    lowStockCount: 0,
    totalClients: 0,
    totalProducts: 0,
  });
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const startOfToday = new Date(today.setHours(0, 0, 0, 0));

      // Fetch today's sales
      const { data: todayInvoices } = await supabase
        .from('invoices')
        .select('grand_total')
        .gte('created_at', startOfToday.toISOString());

      // Fetch monthly sales
      const { data: monthlyInvoices } = await supabase
        .from('invoices')
        .select('grand_total')
        .gte('created_at', startOfMonth.toISOString());

      // Fetch monthly expenses
      const { data: monthlyExpenses } = await supabase
        .from('expenses')
        .select('amount')
        .gte('expense_date', startOfMonth.toISOString().split('T')[0]);

      // Fetch all products and filter for low stock
      const { data: allProducts } = await supabase
        .from('products')
        .select('id, name, sku, quantity, low_stock_alert');

      const lowStockFiltered = allProducts?.filter(p => p.quantity <= p.low_stock_alert) || [];

      // Fetch counts
      const { count: clientCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true });

      const { count: productCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      // Fetch recent invoices
      const { data: recent } = await supabase
        .from('invoices')
        .select('id, invoice_number, grand_total, payment_status, created_at, clients(name)')
        .order('created_at', { ascending: false })
        .limit(5);

      setStats({
        todaySales: todayInvoices?.reduce((sum, inv) => sum + Number(inv.grand_total), 0) || 0,
        monthlySales: monthlyInvoices?.reduce((sum, inv) => sum + Number(inv.grand_total), 0) || 0,
        totalExpenses: monthlyExpenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0,
        lowStockCount: lowStockFiltered.length,
        totalClients: clientCount || 0,
        totalProducts: productCount || 0,
      });

      setLowStockProducts(lowStockFiltered.slice(0, 5));
      setRecentInvoices(recent || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const invoiceColumns = [
    { key: 'invoice_number', header: 'Invoice #' },
    { 
      key: 'client', 
      header: 'Client',
      cell: (item: RecentInvoice) => item.clients?.name || 'Walk-in'
    },
    { 
      key: 'grand_total', 
      header: 'Amount',
      cell: (item: RecentInvoice) => formatCurrency(Number(item.grand_total))
    },
    { 
      key: 'payment_status', 
      header: 'Status',
      cell: (item: RecentInvoice) => (
        <Badge variant={item.payment_status === 'paid' ? 'default' : 'secondary'} className={
          item.payment_status === 'paid' 
            ? 'bg-success/10 text-success border-success/20' 
            : item.payment_status === 'partial'
            ? 'bg-warning/10 text-warning border-warning/20'
            : 'bg-muted text-muted-foreground'
        }>
          {item.payment_status}
        </Badge>
      )
    },
    { 
      key: 'created_at', 
      header: 'Date',
      cell: (item: RecentInvoice) => format(new Date(item.created_at), 'dd MMM yyyy')
    },
  ];

  const lowStockColumns = [
    { key: 'sku', header: 'SKU' },
    { key: 'name', header: 'Product' },
    { 
      key: 'quantity', 
      header: 'Stock',
      cell: (item: LowStockProduct) => (
        <span className="text-destructive font-medium">{item.quantity}</span>
      )
    },
    { 
      key: 'low_stock_alert', 
      header: 'Alert Level',
      cell: (item: LowStockProduct) => item.low_stock_alert
    },
  ];

  return (
    <AppLayout>
      <PageHeader 
        title="Dashboard" 
        description="Welcome back! Here's your business overview."
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Today's Sales"
          value={formatCurrency(stats.todaySales)}
          icon={IndianRupee}
          variant="gold"
        />
        <StatCard
          title="Monthly Sales"
          value={formatCurrency(stats.monthlySales)}
          icon={TrendingUp}
          variant="success"
        />
        <StatCard
          title="Monthly Expenses"
          value={formatCurrency(stats.totalExpenses)}
          icon={IndianRupee}
          variant="default"
        />
        <StatCard
          title="Profit (Est.)"
          value={formatCurrency(stats.monthlySales - stats.totalExpenses)}
          icon={TrendingUp}
          variant={stats.monthlySales - stats.totalExpenses >= 0 ? 'success' : 'danger'}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <LiveMetalRatesCard />
        <StatCard
          title="Low Stock Alerts"
          value={stats.lowStockCount}
          icon={AlertTriangle}
          variant={stats.lowStockCount > 0 ? 'warning' : 'default'}
        />
        <StatCard
          title="Total Clients"
          value={stats.totalClients}
          icon={Users}
          variant="default"
        />
        <StatCard
          title="Total Products"
          value={stats.totalProducts}
          icon={Package}
          variant="default"
        />
      </div>

      {/* Calendar Widget */}
      <div className="mb-8">
        <CalendarWidget />
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Recent Invoices</h2>
          </div>
          <DataTable 
            data={recentInvoices} 
            columns={invoiceColumns}
            isLoading={isLoading}
            emptyMessage="No invoices yet"
          />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <h2 className="text-lg font-semibold">Low Stock Alerts</h2>
          </div>
          <DataTable 
            data={lowStockProducts} 
            columns={lowStockColumns}
            isLoading={isLoading}
            emptyMessage="All products are well stocked!"
          />
        </div>
      </div>
    </AppLayout>
  );
}
