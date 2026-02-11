import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency, exportToExcel } from '@/utils/reportExport';
import { DataTable } from '@/components/ui/data-table';

interface ProductReportProps {
  topSellingProducts: { name: string; qty: number; revenue: number }[];
  lowSellingProducts: { name: string; qty: number; revenue: number }[];
}

export const ProductReport = ({ topSellingProducts, lowSellingProducts }: ProductReportProps) => {
  const columns = [
    { key: 'name', header: 'Product' },
    { key: 'qty', header: 'Qty Sold' },
    { key: 'revenue', header: 'Revenue', cell: (r: any) => formatCurrency(r.revenue) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Product Reports</h3>
        <Button size="sm" variant="outline" onClick={() => exportToExcel(topSellingProducts, 'Top_Products')} className="gap-1">
          <Download className="w-4 h-4" /> Excel
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Top 10 Selling Products</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={topSellingProducts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" width={150} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
              <Bar dataKey="revenue" fill="hsl(var(--success))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Top Sellers</CardTitle></CardHeader>
          <CardContent><DataTable data={topSellingProducts} columns={columns} emptyMessage="No data" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Low Sellers</CardTitle></CardHeader>
          <CardContent><DataTable data={lowSellingProducts} columns={columns} emptyMessage="No data" /></CardContent>
        </Card>
      </div>
    </div>
  );
};
