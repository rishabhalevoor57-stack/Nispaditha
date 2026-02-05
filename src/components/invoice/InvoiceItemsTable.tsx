import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X } from 'lucide-react';
import type { InvoiceItem, Product } from '@/types/invoice';
import { useInvoiceCalculations } from '@/hooks/useInvoiceCalculations';

interface InvoiceItemsTableProps {
  items: InvoiceItem[];
  products: Product[];
  isAdmin: boolean;
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
  isAdmin,
  onItemsChange,
}: InvoiceItemsTableProps) {
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [customRate, setCustomRate] = useState<string>('');
  const { createInvoiceItem, updateItemDiscount, updateItemQuantity, updateItemRate } = useInvoiceCalculations(items);

  const handleAddProduct = () => {
    if (!selectedProduct) return;
    
    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    // Calculate rate per gram from selling price
    const ratePerGram = customRate 
      ? parseFloat(customRate) 
      : product.selling_price / product.weight_grams;
    
    const newItem = createInvoiceItem(product, ratePerGram);
    onItemsChange([...items, newItem]);
    setSelectedProduct('');
    setCustomRate('');
  };

  const handleDiscountChange = (index: number, discount: number) => {
    const updatedItems = [...items];
    updatedItems[index] = updateItemDiscount(updatedItems[index], discount);
    onItemsChange(updatedItems);
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    if (quantity < 1) return;
    const updatedItems = [...items];
    updatedItems[index] = updateItemQuantity(updatedItems[index], quantity);
    onItemsChange(updatedItems);
  };

  const handleRateChange = (index: number, rate: number) => {
    if (rate < 0) return;
    const updatedItems = [...items];
    updatedItems[index] = updateItemRate(updatedItems[index], rate);
    onItemsChange(updatedItems);
  };

  const handleRemoveItem = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {/* Add Product Section */}
      <div className="flex gap-3 items-end">
        <div className="flex-1 space-y-2">
          <Label>Add Product</Label>
          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
            <SelectTrigger>
              <SelectValue placeholder="Select product to add" />
            </SelectTrigger>
            <SelectContent>
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.sku} - {product.name} ({product.weight_grams}g) - Stock: {product.quantity}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-36 space-y-2">
          <Label>Rate/gram (optional)</Label>
          <Input
            type="number"
            placeholder="Auto"
            value={customRate}
            onChange={(e) => setCustomRate(e.target.value)}
          />
        </div>
        <Button 
          type="button" 
          onClick={handleAddProduct}
          disabled={!selectedProduct}
          className="btn-gold"
        >
          Add
        </Button>
      </div>

      {/* Items Table */}
      {items.length > 0 && (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-3 text-left font-medium">SKU</th>
                <th className="px-3 py-3 text-left font-medium">Description</th>
                <th className="px-3 py-3 text-right font-medium">Weight (g)</th>
                <th className="px-3 py-3 text-center font-medium">Qty</th>
                <th className="px-3 py-3 text-right font-medium">Rate/g</th>
                <th className="px-3 py-3 text-right font-medium">Base Price</th>
                {isAdmin && (
                  <>
                    <th className="px-3 py-3 text-right font-medium">Making</th>
                    <th className="px-3 py-3 text-right font-medium">Discount</th>
                  </>
                )}
                <th className="px-3 py-3 text-right font-medium">Line Total</th>
                <th className="px-3 py-3 text-center font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index} className="border-t">
                  <td className="px-3 py-3 font-mono text-xs">{item.sku}</td>
                  <td className="px-3 py-3">
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">{item.category}</p>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">{item.weight_grams.toFixed(2)}</td>
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
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.rate_per_gram}
                      onChange={(e) => handleRateChange(index, parseFloat(e.target.value) || 0)}
                      className="w-24 h-8 text-right"
                    />
                  </td>
                  <td className="px-3 py-3 text-right">{formatCurrency(item.base_price)}</td>
                  {isAdmin && (
                    <>
                      <td className="px-3 py-3 text-right">{formatCurrency(item.making_charges)}</td>
                      <td className="px-3 py-3 text-right">
                        <Input
                          type="number"
                          min="0"
                          max={item.making_charges}
                          value={item.discount}
                          onChange={(e) => handleDiscountChange(index, parseFloat(e.target.value) || 0)}
                          className="w-24 h-8 text-right"
                        />
                      </td>
                    </>
                  )}
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      {items.length === 0 && (
        <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground">
          No products added yet. Select a product above to add to invoice.
        </div>
      )}
    </div>
  );
}
