import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { Download, Package, AlertTriangle, IndianRupee, PackageX } from 'lucide-react';
import { formatCurrency, exportToExcel, exportToPDF } from '@/utils/reportExport';
import { DataTable } from '@/components/ui/data-table';

interface OutOfStockItem {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  weight: number;
  lastUpdated: string | null;
}

interface InventoryStats {
  currentProducts: number;
  outOfStockCount: number;
  lifetimeSkus: number;
  totalQuantity: number;
  totalWeight: number;
}

interface InventoryReportProps {
  products: any[];
  inventoryStats?: InventoryStats;
  lowStockItems: { name: string; sku: string; quantity: number; alert: number; category: string | null }[];
  outOfStockItems?: OutOfStockItem[];
  totalStockValue: number;
}

export const InventoryReport = ({ products, inventoryStats, lowStockItems, outOfStockItems = [], totalStockValue }: InventoryReportProps) => {
  const inStockProducts = products.filter((p: any) => (p.quantity || 0) > 0);
  const stats: InventoryStats = inventoryStats ?? {
    currentProducts: inStockProducts.length,
    outOfStockCount: products.length - inStockProducts.length,
    lifetimeSkus: products.length,
    totalQuantity: inStockProducts.reduce((s: number, p: any) => s + (p.quantity || 0), 0),
    totalWeight: inStockProducts.reduce((s: number, p: any) => s + Number(p.weight_grams || 0) * (p.quantity || 0), 0),
  };

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

  const outOfStockCols = [
    { key: 'sku', header: 'SKU' },
    { key: 'name', header: 'Product' },
    { key: 'category', header: 'Category', cell: (r: OutOfStockItem) => r.category || '–' },
    { key: 'weight', header: 'Weight (g)', cell: (r: OutOfStockItem) => Number(r.weight).toFixed(1) },
    {
      key: 'lastUpdated',
      header: 'Last Movement',
      cell: (r: OutOfStockItem) => (r.lastUpdated ? new Date(r.lastUpdated).toLocaleDateString('en-IN') : '–'),
    },
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

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard title="Products In Stock" value={stats.currentProducts} icon={Package} variant="default" />
        <StatCard title="Low Stock Items" value={lowStockItems.length} icon={AlertTriangle} variant={lowStockItems.length > 0 ? 'warning' : 'default'} />
        <StatCard title="Out of Stock" value={outOfStockItems.length} icon={PackageX} variant={outOfStockItems.length > 0 ? 'warning' : 'default'} />
        <StatCard title="Total Stock Value" value={formatCurrency(totalStockValue)} icon={IndianRupee} variant="gold" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Quantity" value={stats.totalQuantity} icon={Package} variant="default" />
        <StatCard title="Total Weight (g)" value={stats.totalWeight.toFixed(2)} icon={Package} variant="default" />
        <StatCard title="Total SKUs Ever Created" value={stats.lifetimeSkus} icon={Package} variant="default" />
        <StatCard title="Out of Stock SKUs" value={stats.outOfStockCount} icon={PackageX} variant="default" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Current Stock ({inStockProducts.length})</CardTitle></CardHeader>
          <CardContent><DataTable data={inStockProducts} columns={stockColumns} emptyMessage="No products" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Low Stock Alerts</CardTitle></CardHeader>
          <CardContent><DataTable data={lowStockItems} columns={lowStockCols} emptyMessage="All stocked!" /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Out of Stock Report ({outOfStockItems.length})</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1" onClick={() => {
              exportToExcel(outOfStockItems.map((p) => ({
                SKU: p.sku, Name: p.name, Category: p.category || '',
                'Weight (g)': Number(p.weight).toFixed(2),
                'Last Movement': p.lastUpdated ? new Date(p.lastUpdated).toLocaleDateString('en-IN') : '',
              })), 'Out_Of_Stock_Report');
            }}>
              <Download className="w-4 h-4" /> Excel
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => {
              exportToPDF('Out of Stock Report', [
                { header: 'SKU', key: 'SKU' }, { header: 'Name', key: 'Name' },
                { header: 'Category', key: 'Category' }, { header: 'Weight', key: 'Weight' },
                { header: 'Last Movement', key: 'Last' },
              ], outOfStockItems.map((p) => ({
                SKU: p.sku, Name: p.name, Category: p.category || '-',
                Weight: `${Number(p.weight).toFixed(1)}g`,
                Last: p.lastUpdated ? new Date(p.lastUpdated).toLocaleDateString('en-IN') : '-',
              })), 'Out_Of_Stock_Report');
            }}>
              <Download className="w-4 h-4" /> PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable data={outOfStockItems} columns={outOfStockCols} emptyMessage="Nothing is out of stock" />
        </CardContent>
      </Card>
    </div>
  );
};
