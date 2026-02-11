import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { Download, Package, AlertTriangle, IndianRupee } from 'lucide-react';
import { formatCurrency, exportToExcel, exportToPDF } from '@/utils/reportExport';
import { DataTable } from '@/components/ui/data-table';

interface InventoryReportProps {
  products: any[];
  lowStockItems: { name: string; sku: string; quantity: number; alert: number; category: string | null }[];
  totalStockValue: number;
}

export const InventoryReport = ({ products, lowStockItems, totalStockValue }: InventoryReportProps) => {
  const stockColumns = [
    { key: 'sku', header: 'SKU' },
    { key: 'name', header: 'Product' },
    { key: 'category', header: 'Category', cell: (r: any) => r.categories?.name || '–' },
    { key: 'quantity', header: 'Qty' },
    { key: 'weight_grams', header: 'Weight (g)', cell: (r: any) => Number(r.weight_grams).toFixed(1) },
  ];

  const lowStockCols = [
    { key: 'sku', header: 'SKU' },
    { key: 'name', header: 'Product' },
    { key: 'category', header: 'Category', cell: (r: any) => r.category || '–' },
    { key: 'quantity', header: 'Stock', cell: (r: any) => <span className="text-destructive font-medium">{r.quantity}</span> },
    { key: 'alert', header: 'Alert Level' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Inventory Reports</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => {
            const data = products.map((p: any) => ({
              SKU: p.sku, Name: p.name, Category: p.categories?.name || '',
              Quantity: p.quantity, 'Weight (g)': p.weight_grams, Status: p.status,
            }));
            exportToExcel(data, 'Inventory_Report');
          }} className="gap-1">
            <Download className="w-4 h-4" /> Excel
          </Button>
          <Button size="sm" variant="outline" onClick={() => {
            exportToPDF('Inventory Report', [
              { header: 'SKU', key: 'SKU' }, { header: 'Name', key: 'Name' },
              { header: 'Qty', key: 'Quantity' }, { header: 'Weight', key: 'Weight' },
            ], products.map((p: any) => ({
              SKU: p.sku, Name: p.name, Quantity: p.quantity, Weight: `${p.weight_grams}g`,
            })), 'Inventory_Report');
          }} className="gap-1">
            <Download className="w-4 h-4" /> PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Products" value={products.length} icon={Package} variant="default" />
        <StatCard title="Low Stock Items" value={lowStockItems.length} icon={AlertTriangle} variant={lowStockItems.length > 0 ? 'warning' : 'default'} />
        <StatCard title="Total Stock Value" value={formatCurrency(totalStockValue)} icon={IndianRupee} variant="gold" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Current Stock</CardTitle></CardHeader>
          <CardContent><DataTable data={products} columns={stockColumns} emptyMessage="No products" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Low Stock Alerts</CardTitle></CardHeader>
          <CardContent><DataTable data={lowStockItems} columns={lowStockCols} emptyMessage="All stocked!" /></CardContent>
        </Card>
      </div>
    </div>
  );
};
