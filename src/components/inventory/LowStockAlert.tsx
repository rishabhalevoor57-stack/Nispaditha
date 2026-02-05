import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import type { Product } from '@/types/inventory';

interface LowStockAlertProps {
  products: Product[];
}

export function LowStockAlert({ products }: LowStockAlertProps) {
  if (products.length === 0) return null;

  return (
    <Alert variant="destructive" className="mb-6">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Low Stock Alert</AlertTitle>
      <AlertDescription>
        <div className="flex flex-wrap gap-2 mt-2">
          {products.slice(0, 5).map((p) => (
            <Badge key={p.id} variant="outline" className="bg-destructive/10">
              {p.name} ({p.quantity} left)
            </Badge>
          ))}
          {products.length > 5 && (
            <Badge variant="outline">+{products.length - 5} more</Badge>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
