import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReportFiltersBar } from '@/components/reports/ReportFilters';
import { SalesReport } from '@/components/reports/SalesReport';
import { CategoryReport } from '@/components/reports/CategoryReport';
import { ProductReport } from '@/components/reports/ProductReport';
import { CustomerReport } from '@/components/reports/CustomerReport';
import { InventoryReport } from '@/components/reports/InventoryReport';
import { CustomOrderReport } from '@/components/reports/CustomOrderReport';
import { useReports } from '@/hooks/useReports';

export default function Reports() {
  const {
    filters, setPreset, setCustomDates, setStoreId, stores, isLoading,
    salesStats, dailySalesData, monthlySalesData,
    categorySalesData, categoryStockData,
    topSellingProducts, lowSellingProducts,
    topCustomers, repeatCustomers, outstandingClients,
    lowStockItems, totalStockValue, products,
    customOrderStats, customOrdersByStatus, customOrders,
    invoices,
  } = useReports();

  return (
    <AppLayout>
      <PageHeader
        title="Reports & Analytics"
        description="Comprehensive business insights and analytics."
      />

      <div className="mb-6">
        <ReportFiltersBar
          filters={filters}
          stores={stores}
          onPresetChange={setPreset}
          onCustomDates={setCustomDates}
          onStoreChange={setStoreId}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      ) : (
        <Tabs defaultValue="sales" className="space-y-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="category">Category</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="custom-orders">Custom Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="sales">
            <SalesReport salesStats={salesStats} dailySalesData={dailySalesData} monthlySalesData={monthlySalesData} invoices={invoices} />
          </TabsContent>

          <TabsContent value="category">
            <CategoryReport categorySalesData={categorySalesData} categoryStockData={categoryStockData} />
          </TabsContent>

          <TabsContent value="products">
            <ProductReport topSellingProducts={topSellingProducts} lowSellingProducts={lowSellingProducts} />
          </TabsContent>

          <TabsContent value="customers">
            <CustomerReport topCustomers={topCustomers} repeatCustomers={repeatCustomers} outstandingClients={outstandingClients} />
          </TabsContent>

          <TabsContent value="inventory">
            <InventoryReport products={products} lowStockItems={lowStockItems} totalStockValue={totalStockValue} />
          </TabsContent>

          <TabsContent value="custom-orders">
            <CustomOrderReport customOrderStats={customOrderStats} customOrdersByStatus={customOrdersByStatus} customOrders={customOrders} />
          </TabsContent>
        </Tabs>
      )}
    </AppLayout>
  );
}
