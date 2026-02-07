import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { ReturnItemSelection, ReturnExchangeType } from '@/types/returnExchange';

interface InvoiceData {
  id: string;
  invoice_number: string;
  client_name: string;
  client_phone: string;
}

interface ItemSelectionStepProps {
  invoiceData: InvoiceData;
  items: ReturnItemSelection[];
  onBack: () => void;
  onConfirm: (selectedItems: ReturnItemSelection[], type: ReturnExchangeType) => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);

export function ItemSelectionStep({ invoiceData, items, onBack, onConfirm }: ItemSelectionStepProps) {
  const [localItems, setLocalItems] = useState<ReturnItemSelection[]>(items);
  const { toast } = useToast();

  const toggleItem = (index: number) => {
    setLocalItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const updateQuantity = (index: number, qty: number) => {
    setLocalItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, return_quantity: Math.min(Math.max(1, qty), item.max_quantity) }
          : item
      )
    );
  };

  const updateReason = (index: number, reason: string) => {
    setLocalItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, reason } : item))
    );
  };

  const selectedItems = localItems.filter((i) => i.selected);
  const selectedTotal = selectedItems.reduce((sum, item) => {
    const ratio = item.return_quantity / item.quantity;
    return sum + item.total * ratio;
  }, 0);

  const handleConfirm = (type: ReturnExchangeType) => {
    if (selectedItems.length === 0) {
      toast({ variant: 'destructive', title: 'Please select at least one item' });
      return;
    }
    onConfirm(localItems, type);
  };

  return (
    <div className="space-y-4">
      {/* Invoice info */}
      <div className="bg-muted/50 rounded-lg p-3 text-sm">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <div>
            <span className="text-muted-foreground">Invoice: </span>
            <span className="font-medium">{invoiceData.invoice_number}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Client: </span>
            <span className="font-medium">{invoiceData.client_name}</span>
          </div>
          {invoiceData.client_phone && (
            <div>
              <span className="text-muted-foreground">Phone: </span>
              <span className="font-medium">{invoiceData.client_phone}</span>
            </div>
          )}
        </div>
      </div>

      {/* Items table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-3 text-left w-10"></th>
              <th className="px-3 py-3 text-left font-medium">Item</th>
              <th className="px-3 py-3 text-left font-medium">SKU</th>
              <th className="px-3 py-3 text-right font-medium">Wt(G)</th>
              <th className="px-3 py-3 text-center font-medium">Qty</th>
              <th className="px-3 py-3 text-right font-medium">Total</th>
              <th className="px-3 py-3 text-center font-medium">Return Qty</th>
              <th className="px-3 py-3 text-left font-medium">Reason</th>
            </tr>
          </thead>
          <tbody>
            {localItems.map((item, index) => (
              <tr key={item.invoice_item_id} className="border-t">
                <td className="px-3 py-3">
                  <Checkbox
                    checked={item.selected}
                    onCheckedChange={() => toggleItem(index)}
                  />
                </td>
                <td className="px-3 py-3">
                  <div>
                    <p className="font-medium">{item.product_name}</p>
                    {item.category && (
                      <p className="text-xs text-muted-foreground">{item.category}</p>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 font-mono text-xs">{item.sku}</td>
                <td className="px-3 py-3 text-right">
                  {item.weight_grams > 0 ? item.weight_grams.toFixed(2) : '-'}
                </td>
                <td className="px-3 py-3 text-center">{item.quantity}</td>
                <td className="px-3 py-3 text-right font-medium">
                  {formatCurrency(item.total)}
                </td>
                <td className="px-3 py-3">
                  <Input
                    type="number"
                    min={1}
                    max={item.max_quantity}
                    value={item.return_quantity}
                    onChange={(e) => updateQuantity(index, parseInt(e.target.value) || 1)}
                    disabled={!item.selected}
                    className="w-16 text-center mx-auto"
                  />
                </td>
                <td className="px-3 py-3">
                  <Input
                    placeholder="Optional"
                    value={item.reason}
                    onChange={(e) => updateReason(index, e.target.value)}
                    disabled={!item.selected}
                    className="w-32"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      {selectedItems.length > 0 && (
        <div className="bg-muted/30 rounded-lg p-4 text-sm">
          <p>
            <span className="text-muted-foreground">Selected Items: </span>
            <span className="font-medium">{selectedItems.length}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Estimated Value: </span>
            <span className="font-medium">{formatCurrency(selectedTotal)}</span>
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between gap-3">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <div className="flex gap-2">
          <Button
            variant="destructive"
            onClick={() => handleConfirm('return')}
            disabled={selectedItems.length === 0}
          >
            Process Return
          </Button>
          <Button
            className="btn-gold"
            onClick={() => handleConfirm('exchange')}
            disabled={selectedItems.length === 0}
          >
            Process Exchange
          </Button>
        </div>
      </div>
    </div>
  );
}
