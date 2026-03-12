import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Plus, FileSpreadsheet, Download } from 'lucide-react';
import { exportToExcel, exportToPDF } from '@/utils/reportExport';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useInventory } from '@/hooks/useInventory';
import { InventoryFilters } from '@/components/inventory/InventoryFilters';
import { InventoryTable } from '@/components/inventory/InventoryTable';
import { InventoryPagination } from '@/components/inventory/InventoryPagination';
import { LowStockAlert } from '@/components/inventory/LowStockAlert';
import { ProductFormDialog } from '@/components/inventory/ProductFormDialog';
import { ProductDetailDialog } from '@/components/inventory/ProductDetailDialog';
import { BulkImportDialog } from '@/components/inventory/BulkImportDialog';
import type { Product, ProductFormData } from '@/types/inventory';

export default function Inventory() {
  const {
    products,
    allProducts,
    categories,
    suppliers,
    isLoading,
    filters,
    setFilters,
    currentPage,
    setCurrentPage,
    totalPages,
    itemsPerPage,
    lowStockProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    bulkImport,
  } = useInventory();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const handleCreate = () => {
    setSelectedProduct(null);
    setIsFormOpen(true);
  };

  const handleView = (product: Product) => {
    setSelectedProduct(product);
    setIsDetailOpen(true);
  };

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setIsDetailOpen(false);
    setIsFormOpen(true);
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Are you sure you want to delete "${product.name}"?`)) return;
    await deleteProduct(product.id);
    setIsDetailOpen(false);
  };

  const handleFormSubmit = async (data: ProductFormData, imageFile?: File) => {
    if (selectedProduct) {
      return await updateProduct(selectedProduct.id, data, imageFile);
    }
    return await createProduct(data, imageFile);
  };

  return (
    <AppLayout>
      <PageHeader
        title="Inventory"
        description="Manage your products and stock levels"
        actions={
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => {
                  const data = allProducts.map((p: any) => ({
                    SKU: p.sku,
                    Name: p.name,
                    Category: p.categories?.name || '',
                    'Type of Work': p.type_of_work || '',
                    'Weight (g)': p.weight_grams,
                    Quantity: p.quantity,
                    'Purchase Price': p.purchase_price,
                    'Selling Price': p.selling_price,
                    'Making Charges': p.making_charges,
                    Status: p.status,
                    Vendor: p.suppliers?.name || '',
                  }));
                  exportToExcel(data, 'Inventory_Export');
                }}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export to Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  exportToPDF('Inventory Report', [
                    { header: 'SKU', key: 'SKU' },
                    { header: 'Name', key: 'Name' },
                    { header: 'Category', key: 'Category' },
                    { header: 'Weight (g)', key: 'Weight' },
                    { header: 'Qty', key: 'Qty' },
                    { header: 'Selling Price', key: 'Price' },
                    { header: 'Status', key: 'Status' },
                  ], allProducts.map((p: any) => ({
                    SKU: p.sku,
                    Name: p.name,
                    Category: p.categories?.name || '',
                    Weight: `${p.weight_grams}g`,
                    Qty: p.quantity,
                    Price: `₹${p.selling_price}`,
                    Status: p.status,
                  })), 'Inventory_Report');
                }}>
                  <Download className="w-4 h-4 mr-2" />
                  Export to PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={() => setIsBulkImportOpen(true)}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Bulk Import
            </Button>
            <Button className="btn-gold" onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </div>
        }
      />

      <LowStockAlert products={lowStockProducts} />

      <InventoryFilters
        filters={filters}
        onFiltersChange={setFilters}
        categories={categories}
      />

      <InventoryTable
        products={products}
        isLoading={isLoading}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <InventoryPagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={allProducts.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />

      <ProductFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        product={selectedProduct}
        categories={categories}
        suppliers={suppliers}
        onSubmit={handleFormSubmit}
      />

      <ProductDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        product={selectedProduct}
        onEdit={() => handleEdit(selectedProduct!)}
        onDelete={() => handleDelete(selectedProduct!)}
      />

      <BulkImportDialog
        open={isBulkImportOpen}
        onOpenChange={setIsBulkImportOpen}
        onImport={bulkImport}
      />
    </AppLayout>
  );
}
