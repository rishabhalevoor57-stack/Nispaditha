import { useState, useRef, Fragment } from 'react';
import { Input } from '@/components/ui/input';
import { BlankZeroInput } from '@/components/ui/blank-zero-input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
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
  const {
    createInvoiceItem,
    updateItemDiscount,
    updateItemQuantity,
    updateItemRate,
    updateItemWeight,
    updateItemMakingCharges,
    updateItemMrp,
  } = useInvoiceCalculations(items);

  const searchWrapperRef = useRef<HTMLDivElement | null>(null);

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

  const handleAddProduct = (product: Product) => {
    const existingIndex = items.findIndex(item => item.product_id === product.id);
    if (existingIndex >= 0) {
      handleQuantityChange(existingIndex, items[existingIndex].quantity + 1);
      return;
    }
    const newItem = createInvoiceItem(product, defaultRate);
    onItemsChange([...items, newItem]);
  };

  const focusProductSearch = () => {
    const input = searchWrapperRef.current?.querySelector('input');
    if (input) (input as HTMLInputElement).focus();
  };

  const handleDiscountChange = (index: number, value: number, type?: DiscountType) => {
    const item = items[index];
    const discountType = type || item.discount_type;
    let clampedValue = Math.max(0, value);
    if (item.pricing_mode === 'flat_price') {
      const grossTotal = (item.selling_price || item.base_price) * item.quantity;
      if (discountType === 'percentage') clampedValue = Math.min(100, clampedValue);
      else clampedValue = Math.min(grossTotal, clampedValue);
    } else {
      if (discountType === 'percentage') clampedValue = Math.min(100, clampedValue);
      else clampedValue = Math.min(item.making_charges, clampedValue);
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

  const handleWeightChange = (index: number, weight: number) => {
    const updatedItems = [...items];
    updatedItems[index] = updateItemWeight(updatedItems[index], weight);
    onItemsChange(updatedItems);
  };

  const handleMcPerGramChange = (index: number, mcg: number) => {
    const updatedItems = [...items];
    updatedItems[index] = updateItemMakingCharges(updatedItems[index], mcg);
    onItemsChange(updatedItems);
  };

  const handleMrpChange = (index: number, mrp: number) => {
    const updatedItems = [...items];
    updatedItems[index] = updateItemMrp(updatedItems[index], mrp);
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

  const handleDescriptionChange = (index: number, description: string) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], description };
    onItemsChange(updatedItems);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2" ref={searchWrapperRef}>
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
                <th className="px-3 py-3 text-left font-medium">Product Name</th>
                <th className="px-3 py-3 text-center font-medium">Mode</th>
                <th className="px-3 py-3 text-right font-medium">Wt(G)</th>
                <th className="px-3 py-3 text-center font-medium">Qty</th>
                <th className="px-3 py-3 text-right font-medium">MRP</th>
                <th className="px-3 py-3 text-right font-medium min-w-[200px]">Discount</th>
                <th className="px-3 py-3 text-right font-medium">Rate/g</th>
                <th className="px-3 py-3 text-right font-medium">Metal Price</th>
                <th className="px-3 py-3 text-right font-medium">MC</th>
                <th className="px-3 py-3 text-right font-medium">MC/g</th>
                
                <th className="px-3 py-3 text-right font-medium">Total</th>
                <th className="px-3 py-3 text-center font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const isFlat = item.pricing_mode === 'flat_price';
                return (
                  <Fragment key={index}>
                    <tr className="border-t group">
                      <td className="px-3 py-3 font-mono text-xs align-middle">{item.sku}</td>
                      <td className="px-3 py-3 align-middle">
                        <div>
                          <p className="font-medium">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">{item.category}</p>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center align-middle">
                        <Badge variant={isFlat ? 'secondary' : 'outline'} className="text-xs">
                          {isFlat ? 'Flat' : 'Wt'}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-right align-middle">
                        {isFlat ? '-' : (
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.weight_grams}
                            onChange={(e) => handleWeightChange(index, parseFloat(e.target.value) || 0)}
                            className="w-20 h-8 text-right"
                          />
                        )}
                      </td>
                      <td className="px-3 py-3 text-center align-middle">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 1)}
                          className="w-16 h-8 text-center"
                        />
                      </td>
                      <td className="px-3 py-3 text-right align-middle">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.mrp}
                          onChange={(e) => handleMrpChange(index, parseFloat(e.target.value) || 0)}
                          className="w-28 h-8 text-right"
                        />
                      </td>
                      <td className="px-3 py-3 text-right align-middle">
                        <div className="flex items-center gap-1 justify-end">
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
                            max={isFlat
                              ? (item.discount_type === 'percentage' ? 100 : (item.selling_price || item.base_price) * item.quantity)
                              : (item.discount_type === 'percentage' ? 100 : item.making_charges)
                            }
                            value={item.discount_value}
                            onChange={(e) => handleDiscountChange(index, parseFloat(e.target.value) || 0)}
                            className="w-28 h-8 text-right"
                            title={isFlat ? "Discount on total amount" : "Discount applies only on MC"}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right align-middle">
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
                      <td className="px-3 py-3 text-right align-middle">
                        {isFlat ? formatCurrency(item.selling_price || item.base_price) : formatCurrency(item.base_price)}
                      </td>
                      <td className="px-3 py-3 text-right align-middle">
                        {isFlat ? '-' : formatCurrency(item.making_charges)}
                      </td>
                      <td className="px-3 py-3 text-right align-middle">
                        {isFlat ? '-' : (
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.making_charges_per_gram}
                            onChange={(e) => handleMcPerGramChange(index, parseFloat(e.target.value) || 0)}
                            className="w-20 h-8 text-right"
                            title="MC per gram"
                          />
                        )}
                      </td>
                      
                      <td className="px-3 py-3 text-right font-medium align-middle">{formatCurrency(item.line_total)}</td>
                      <td className="px-3 py-3 text-center align-middle">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => handleRemoveItem(index)}
                          title="Remove row"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                    <tr className="border-t border-dashed border-border/40">
                      <td colSpan={13} className="px-3 py-2 bg-muted/10">
                        <Input
                          type="text"
                          value={item.description || ''}
                          onChange={(e) => handleDescriptionChange(index, e.target.value)}
                          placeholder="Description (optional) — custom notes or instructions for this item"
                          className="h-8 text-xs bg-background/50"
                        />
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Product Row button */}
      <button
        type="button"
        onClick={focusProductSearch}
        className="w-full py-3 px-4 rounded-lg border-2 border-dashed text-sm font-medium transition-colors flex items-center justify-center gap-2"
        style={{ borderColor: '#4a2060', color: '#4a2060' }}
      >
        <Plus className="w-4 h-4" />
        Add Product Row
      </button>

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
