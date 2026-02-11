import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { formatCurrency, exportToExcel, exportToPDF } from '@/utils/reportExport';
import { DataTable } from '@/components/ui/data-table';

const COLORS = [
  'hsl(43, 74%, 53%)', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)',
  'hsl(0, 84%, 60%)', 'hsl(215, 25%, 27%)', 'hsl(280, 60%, 55%)',
  'hsl(190, 70%, 45%)', 'hsl(320, 60%, 50%)',
];

interface CategoryReportProps {
  categorySalesData: { category: string; sales: number; qty: number }[];
  categoryStockData: { category: string; items: number; qty: number; weight: number; value: number }[];
}

export const CategoryReport = ({ categorySalesData, categoryStockData }: CategoryReportProps) => {
  const salesColumns = [
    { key: 'category', header: 'Category' },
    { key: 'qty', header: 'Items Sold', cell: (r: any) => r.qty },
    { key: 'sales', header: 'Sales', cell: (r: any) => formatCurrency(r.sales) },
  ];

  const stockColumns = [
    { key: 'category', header: 'Category' },
    { key: 'items', header: 'Products' },
    { key: 'qty', header: 'Qty' },
    { key: 'weight', header: 'Weight (g)', cell: (r: any) => r.weight.toFixed(1) },
    { key: 'value', header: 'Stock Value', cell: (r: any) => formatCurrency(r.value) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Category Reports</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportToExcel(categorySalesData, 'Category_Sales')} className="gap-1">
            <Download className="w-4 h-4" /> Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Category-wise Sales</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={categorySalesData} dataKey="sales" nameKey="category" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {categorySalesData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Category-wise Stock Value</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryStockData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="category" width={100} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Sales by Category</CardTitle></CardHeader>
          <CardContent><DataTable data={categorySalesData} columns={salesColumns} emptyMessage="No sales data" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Stock by Category</CardTitle></CardHeader>
          <CardContent><DataTable data={categoryStockData} columns={stockColumns} emptyMessage="No stock data" /></CardContent>
        </Card>
      </div>
    </div>
  );
};
