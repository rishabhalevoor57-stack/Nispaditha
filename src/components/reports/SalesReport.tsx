import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { IndianRupee, FileText, ShoppingBag, Weight, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { formatCurrency, exportToExcel, exportToPDF } from '@/utils/reportExport';

interface SalesReportProps {
  salesStats: { totalSales: number; totalInvoices: number; itemsSold: number; weightSold: number };
  dailySalesData: { date: string; amount: number }[];
  monthlySalesData: { month: string; amount: number }[];
  invoices: any[];
}

export const SalesReport = ({ salesStats, dailySalesData, monthlySalesData, invoices }: SalesReportProps) => {
  const handleExportExcel = () => {
    const data = invoices.map((inv: any) => ({
      'Invoice #': inv.invoice_number,
      'Client': inv.clients?.name || 'Walk-in',
      'Date': new Date(inv.created_at).toLocaleDateString('en-IN'),
      'Subtotal': Number(inv.subtotal),
      'GST': Number(inv.gst_amount),
      'Total': Number(inv.grand_total),
      'Status': inv.payment_status,
    }));
    exportToExcel(data, 'Sales_Report');
  };

  const handleExportPDF = () => {
    const cols = [
      { header: 'Invoice #', key: 'invoice_number' },
      { header: 'Client', key: 'client' },
      { header: 'Date', key: 'date' },
      { header: 'Total', key: 'total' },
      { header: 'Status', key: 'status' },
    ];
    const data = invoices.map((inv: any) => ({
      invoice_number: inv.invoice_number,
      client: inv.clients?.name || 'Walk-in',
      date: new Date(inv.created_at).toLocaleDateString('en-IN'),
      total: formatCurrency(Number(inv.grand_total)),
      status: inv.payment_status,
    }));
    exportToPDF('Sales Report', cols, data, 'Sales_Report');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Sales Overview</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleExportExcel} className="gap-1">
            <Download className="w-4 h-4" /> Excel
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportPDF} className="gap-1">
            <Download className="w-4 h-4" /> PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Sales" value={formatCurrency(salesStats.totalSales)} icon={IndianRupee} variant="gold" />
        <StatCard title="Total Invoices" value={salesStats.totalInvoices} icon={FileText} variant="default" />
        <StatCard title="Items Sold" value={salesStats.itemsSold} icon={ShoppingBag} variant="success" />
        <StatCard title="Weight Sold" value={`${salesStats.weightSold.toFixed(1)}g`} icon={Weight} variant="default" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Daily Sales</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailySalesData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Monthly Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlySalesData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                <Line type="monotone" dataKey="amount" stroke="hsl(var(--success))" strokeWidth={2} dot={{ fill: 'hsl(var(--success))' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
