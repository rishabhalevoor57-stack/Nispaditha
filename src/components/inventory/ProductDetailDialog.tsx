import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Edit, Trash2, Package, Coins } from 'lucide-react';
import { Product, STATUS_OPTIONS } from '@/types/inventory';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface ProductDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onEdit: () => void;
  onDelete: () => void;
}

export function ProductDetailDialog({
  open,
  onOpenChange,
  product,
  onEdit,
  onDelete,
}: ProductDetailDialogProps) {
  const [silverRate, setSilverRate] = useState<number>(0);

  useEffect(() => {
    if (open) {
      fetchSilverRate();
    }
  }, [open]);

  const fetchSilverRate = async () => {
    const { data } = await supabase
      .from('business_settings')
      .select('silver_rate_per_gram')
      .limit(1)
      .single();
    
    if (data) {
      setSilverRate(data.silver_rate_per_gram);
    }
  };

  if (!product) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const opt = STATUS_OPTIONS.find(o => o.value === status);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Package className="w-5 h-5" />
            Product Details
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 mt-4">
          {/* Image & Basic Info */}
          <div className="flex gap-6">
            {product.image_url ? (
              <img 
                src={product.image_url} 
                alt={product.name}
                className="w-32 h-32 object-cover rounded-lg border"
              />
            ) : (
              <div className="w-32 h-32 bg-muted rounded-lg flex items-center justify-center">
                <Package className="w-12 h-12 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold">{product.name}</h3>
                  <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
                </div>
                {getStatusBadge(product.status)}
              </div>
              {product.description && (
                <p className="text-sm text-muted-foreground mt-2">{product.description}</p>
              )}
              <div className="flex items-center gap-4 mt-3">
                <Badge variant="outline">{product.type_of_work}</Badge>
                {product.categories?.name && (
                  <Badge variant="secondary">{product.categories.name}</Badge>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <DetailItem label="Metal Type" value="Silver" />
            <DetailItem label="Purity" value={product.purity || '-'} />
            <DetailItem label="Weight" value={`${product.weight_grams}g`} />
            <DetailItem label="Quantity" value={product.quantity.toString()} />
            <DetailItem label="Low Stock Alert" value={product.low_stock_alert.toString()} />
            {product.bangle_size && (
              <DetailItem label="Bangle Size" value={product.bangle_size} />
            )}
            <DetailItem 
              label="Date Ordered" 
              value={product.date_ordered ? format(new Date(product.date_ordered), 'dd MMM yyyy') : '-'} 
            />
            <DetailItem label="Vendor" value={product.suppliers?.name || '-'} />
          </div>

          <Separator />

          {/* Current Rate Applied */}
          <Alert className="border-primary/20 bg-primary/5">
            <Coins className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              <span className="font-medium">Current Silver Rate Applied: </span>
              {formatCurrency(silverRate)} per gram
            </AlertDescription>
          </Alert>

          {/* Pricing */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DetailItem label="Price Per Gram" value={formatCurrency(product.price_per_gram)} />
            <DetailItem label="Making Charges" value={formatCurrency(product.making_charges)} />
            <DetailItem label="MRP" value={formatCurrency(product.mrp)} />
            <DetailItem label="Selling Price" value={formatCurrency(product.selling_price)} highlight />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <DetailItem label="Purchase Price" value={formatCurrency(product.purchase_price)} />
            <DetailItem label="GST" value={`${product.gst_percentage}%`} />
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onDelete} className="text-destructive">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
            <Button onClick={onEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Product
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${highlight ? 'text-primary' : ''}`}>{value}</p>
    </div>
  );
}
