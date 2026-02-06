import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { InvoiceItem, Product, DiscountType } from '@/types/invoice';
import { useInvoiceCalculations } from '@/hooks/useInvoiceCalculations';
import { ProductSearchInput } from './ProductSearchInput';
import { RateEditConfirmDialog } from './RateEditConfirmDialog';

interface InvoiceItemsTableProps {
  items: InvoiceItem[];
  products: Product[];
  defaultRate: number;
  onItemsChange: (items: InvoiceItem[]) => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
};

export function InvoiceItemsTable({
  items,
  products,
  defaultRate,
  onItemsChange,
}: InvoiceItemsTableProps) {
  const { createInvoiceItem, updateItemDiscount, updateItemQuantity, updateItemRate } = useInvoiceCalculations(items);
  
  const [rateConfirmDialog, setRateConfirmDialog] = useState<{
    open: boolean;
    index: number;
    originalRate: number;
    newRate: number;
    productName: string;
  }>({
    open: false,
    index: -1,
    originalRate: 0,
    newRate: 0,
    productName: '',
  });

  const hasWeightBasedItems = items.some(item => item.pricing_mode !== 'flat_price');
  const hasFlatPriceItems = items.some(item => item.pricing_mode === 'flat_price');

  const handleAddProduct = (product: Product) => {
    const existingIndex = items.findIndex(item => item.product_id === product.id);
    if (existingIndex >= 0) {
      handleQuantityChange(existingIndex, items[existingIndex].quantity + 1);
      return;
    }
    const newItem = createInvoiceItem(product, defaultRate);
    onItemsChange([...items, newItem]);
  };

  const handleDiscountChange = (index: number, value: number, type?: DiscountType) => {
    const item = items[index];
    if (item.pricing_mode === 'flat_price') return; // No discount on flat price
    const discountType = type || item.discount_type;
    let clampedValue = Math.max(0, value);
    if (discountType === 'percentage') {
      clampedValue = Math.min(100, clampedValue);
    } else {
      clampedValue = Math.min(item.making_charges, clampedValue);
    }
    const updatedItems = [...items];
    updatedItems[index] = updateItemDiscount(updatedItems[index], clampedValue, discountType);
    onItemsChange(updatedItems);
  };

  const handleDiscountTypeChange = (index: number, type: DiscountType) => {
    const item = items[index];
    handleDiscountChange(index, item.discount_value, type);
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    if (quantity < 1) return;
    const updatedItems = [...items];
    updatedItems[index] = updateItemQuantity(updatedItems[index], quantity);
    onItemsChange(updatedItems);
  };

  const handleRateInputChange = (index: number, rate: number) => {
    const item = items[index];
    if (item.pricing_mode === 'flat_price') return;
    if (rate < 0) return;
    if (rate !== item.rate_per_gram && rate !== defaultRate) {
      setRateConfirmDialog({
        open: true,
        index,
        originalRate: item.rate_per_gram,
        newRate: rate,
        productName: item.product_name,
      });
    } else {
      applyRateChange(index, rate);
    }
  };

  const applyRateChange = (index: number, rate: number) => {
    const updatedItems = [...items];
    updatedItems[index] = updateItemRate(updatedItems[index], rate);
    onItemsChange(updatedItems);
  };

  const confirmRateChange = () => {
    applyRateChange(rateConfirmDialog.index, rateConfirmDialog.newRate);
    setRateConfirmDialog({ ...rateConfirmDialog, open: false });
  };

  const handleRemoveItem = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Add Product</label>
        <ProductSearchInput
          products={products.filter(p => p.quantity > 0)}
          onSelect={handleAddProduct}
        />
        <p className="text-xs text-muted-foreground">
          Live Rate: {formatCurrency(defaultRate)}/gram
        </p>
      </div>

      {items.length > 0 && (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-3 text-left font-medium">SKU</th>
                <th className="px-3 py-3 text-left font-medium">Description</th>
                <th className="px-3 py-3 text-center font-medium">Mode</th>
                <th className="px-3 py-3 text-right font-medium">Wt(G)</th>
                <th className="px-3 py-3 text-center font-medium">Qty</th>
                <th className="px-3 py-3 text-right font-medium">Rate/g</th>
                <th className="px-3 py-3 text-right font-medium">Metal Price</th>
                <th className="px-3 py-3 text-right font-medium">MC</th>
                <th className="px-3 py-3 text-right font-medium">MC/g</th>
                <th className="px-3 py-3 text-right font-medium">Discount</th>
                <th className="px-3 py-3 text-right font-medium">Total</th>
                <th className="px-3 py-3 text-center font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const isFlat = item.pricing_mode === 'flat_price';
                return (
                  <tr key={index} className="border-t">
                    <td className="px-3 py-3 font-mono text-xs">{item.sku}</td>
                    <td className="px-3 py-3">
                      <div>
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground">{item.category}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Badge variant={isFlat ? 'secondary' : 'outline'} className="text-xs">
                        {isFlat ? 'Flat' : 'Wt'}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {isFlat ? '-' : item.weight_grams.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 1)}
                        className="w-16 h-8 text-center"
                      />
                    </td>
                    <td className="px-3 py-3 text-right">
                      {isFlat ? '-' : (
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.rate_per_gram}
                          onChange={(e) => handleRateInputChange(index, parseFloat(e.target.value) || 0)}
                          className="w-24 h-8 text-right"
                        />
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {isFlat ? formatCurrency(item.selling_price || item.base_price) : formatCurrency(item.base_price)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {isFlat ? '-' : formatCurrency(item.making_charges)}
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-muted-foreground">
                      {isFlat ? '-' : `${formatCurrency(item.making_charges_per_gram)}/g`}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {isFlat ? '-' : (
                        <div className="flex items-center gap-1">
                          <Select
                            value={item.discount_type}
                            onValueChange={(val) => handleDiscountTypeChange(index, val as DiscountType)}
                          >
                            <SelectTrigger className="w-14 h-8 text-xs px-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fixed">₹</SelectItem>
                              <SelectItem value="percentage">%</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            min="0"
                            max={item.discount_type === 'percentage' ? 100 : item.making_charges}
                            value={item.discount_value}
                            onChange={(e) => handleDiscountChange(index, parseFloat(e.target.value) || 0)}
                            className="w-20 h-8 text-right"
                            title="Discount applies only on MC"
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-medium">{formatCurrency(item.line_total)}</td>
                    <td className="px-3 py-3 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleRemoveItem(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {items.length === 0 && (
        <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground">
          No products added yet. Search for a product above to add to invoice.
        </div>
      )}

      <RateEditConfirmDialog
        open={rateConfirmDialog.open}
        onOpenChange={(open) => setRateConfirmDialog({ ...rateConfirmDialog, open })}
        originalRate={rateConfirmDialog.originalRate}
        newRate={rateConfirmDialog.newRate}
        productName={rateConfirmDialog.productName}
        onConfirm={confirmRateChange}
      />
    </div>
  );
}
