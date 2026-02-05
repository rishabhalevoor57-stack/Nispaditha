import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Edit, Trash2, Eye, Package } from 'lucide-react';
import { Product, STATUS_OPTIONS } from '@/types/inventory';

interface InventoryTableProps {
  products: Product[];
  isLoading: boolean;
  onView: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

export function InventoryTable({
  products,
  isLoading,
  onView,
  onEdit,
  onDelete,
}: InventoryTableProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string, quantity: number, lowStockAlert: number) => {
    const opt = STATUS_OPTIONS.find(o => o.value === status);
    
    if (status === 'in_stock' && quantity <= lowStockAlert) {
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
          Low Stock
        </Badge>
      );
    }
    
    const variants: Record<string, string> = {
      in_stock: 'bg-success/10 text-success border-success/20',
      sold: 'bg-muted text-muted-foreground',
      for_repair: 'bg-warning/10 text-warning border-warning/20',
    };
    
    return (
      <Badge variant="outline" className={variants[status] || ''}>
        {opt?.label || status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-12 text-xs font-semibold uppercase">SL</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Image</TableHead>
              <TableHead className="text-xs font-semibold uppercase">SKU</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Description</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Type</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Category</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-right">Weight</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-right">Qty</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-right">Selling Price</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Status</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Vendor</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="h-32 text-center text-muted-foreground">
                  No products found. Add your first product to get started.
                </TableCell>
              </TableRow>
            ) : (
              products.map((product, index) => (
                <TableRow 
                  key={product.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onView(product)}
                >
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        className="w-10 h-10 object-cover rounded"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                        <Package className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      {product.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {product.type_of_work}
                    </Badge>
                  </TableCell>
                  <TableCell>{product.categories?.name || '-'}</TableCell>
                  <TableCell className="text-right">{product.weight_grams}g</TableCell>
                  <TableCell className="text-right font-medium">{product.quantity}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(product.selling_price)}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(product.status, product.quantity, product.low_stock_alert)}
                  </TableCell>
                  <TableCell className="text-sm">{product.suppliers?.name || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); onView(product); }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); onEdit(product); }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); onDelete(product); }}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
