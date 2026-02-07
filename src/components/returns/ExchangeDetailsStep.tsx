import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Download, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useActivityLogger } from '@/hooks/useActivityLog';
import { generateReturnPdf } from '@/utils/returnPdf';
import { ProductSearchInput } from '@/components/invoice/ProductSearchInput';
import type { ReturnItemSelection } from '@/types/returnExchange';
import type { Product } from '@/types/invoice';

interface InvoiceData {
  id: string;
  invoice_number: string;
  client_name: string;
  client_phone: string;
}

interface NewExchangeItem {
  product_id: string;
  product_name: string;
  sku: string;
  category: string;
  weight_grams: number;
  quantity: number;
  rate_per_gram: number;
  making_charges: number;
  line_total: number;
  gst_percentage: number;
  gst_amount: number;
  total: number;
}

interface ExchangeDetailsStepProps {
  invoiceData: InvoiceData;
  returnedItems: ReturnItemSelection[];
  onBack: () => void;
  onComplete: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);

export function ExchangeDetailsStep({
  invoiceData,
  returnedItems,
  onBack,
  onComplete,
}: ExchangeDetailsStepProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [newItems, setNewItems] = useState<NewExchangeItem[]>([]);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [silverRate, setSilverRate] = useState(95);
  const { toast } = useToast();
  const { user } = useAuth();
  const { logActivity } = useActivityLogger();

  useEffect(() => {
    fetchProducts();
    fetchSettings();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*, categories(name)')
      .gt('quantity', 0)
      .order('name');
    const mapped = (data || []).map((p) => ({
      ...p,
      pricing_mode: (p.pricing_mode || 'weight_based') as 'weight_based' | 'flat_price',
      mrp: Number(p.mrp) || 0,
    }));
    setProducts(mapped as Product[]);
  };

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('business_settings')
      .select('silver_rate_per_gram')
      .maybeSingle();
    if (data) setSilverRate(Number(data.silver_rate_per_gram));
  };

  const addNewItem = (product: Product) => {
    const isFlat = product.pricing_mode === 'flat_price';
    const rate = isFlat ? 0 : silverRate;
    const basePrice = isFlat
      ? product.selling_price
      : product.weight_grams * rate * 1;
    const mc = isFlat ? 0 : product.making_charges;
    const lineTotal = basePrice + mc;
    const gstAmt = lineTotal * (product.gst_percentage / 100);

    setNewItems((prev) => [
      ...prev,
      {
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        category: product.categories?.name || '',
        weight_grams: product.weight_grams,
        quantity: 1,
        rate_per_gram: rate,
        making_charges: mc,
        line_total: lineTotal,
        gst_percentage: product.gst_percentage,
        gst_amount: gstAmt,
        total: lineTotal + gstAmt,
      },
    ]);
  };

  const removeNewItem = (index: number) => {
    setNewItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculate totals
  const oldTotal = returnedItems.reduce((sum, item) => {
    const ratio = item.return_quantity / item.quantity;
    return sum + item.total * ratio;
  }, 0);

  const newTotal = newItems.reduce((sum, item) => sum + item.total, 0);
  const difference = newTotal - oldTotal;

  const handleSubmit = async () => {
    if (newItems.length === 0) {
      toast({ variant: 'destructive', title: 'Please add at least one new item for exchange' });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: refNum, error: refError } = await supabase.rpc(
        'generate_return_exchange_reference',
        { p_type: 'exchange' }
      );
      if (refError) throw refError;

      // Create exchange record
      const { data: exchangeRecord, error: exchangeError } = await supabase
        .from('return_exchanges')
        .insert([
          {
            reference_number: refNum,
            type: 'exchange',
            original_invoice_id: invoiceData.id,
            original_invoice_number: invoiceData.invoice_number,
            client_name: invoiceData.client_name,
            client_phone: invoiceData.client_phone,
            refund_amount: difference < 0 ? Math.abs(difference) : 0,
            additional_charge: difference > 0 ? difference : 0,
            payment_mode: paymentMode,
            notes: notes || null,
            created_by: user?.id,
          },
        ])
        .select()
        .single();

      if (exchangeError) throw exchangeError;

      // Insert returned items
      const returnedItemsToInsert = returnedItems.map((item) => {
        const ratio = item.return_quantity / item.quantity;
        return {
          return_exchange_id: exchangeRecord.id,
          direction: 'returned' as const,
          product_id: item.product_id,
          product_name: item.product_name,
          sku: item.sku,
          category: item.category,
          quantity: item.return_quantity,
          weight_grams: item.weight_grams * ratio,
          rate_per_gram: item.rate_per_gram,
          making_charges: item.making_charges * ratio,
          discount: item.discount * ratio,
          line_total: item.line_total * ratio,
          gst_percentage: item.gst_percentage,
          gst_amount: item.gst_amount * ratio,
          total: item.total * ratio,
        };
      });

      const newItemsToInsert = newItems.map((item) => ({
        return_exchange_id: exchangeRecord.id,
        direction: 'new' as const,
        product_id: item.product_id,
        product_name: item.product_name,
        sku: item.sku,
        category: item.category,
        quantity: item.quantity,
        weight_grams: item.weight_grams,
        rate_per_gram: item.rate_per_gram,
        making_charges: item.making_charges,
        discount: 0,
        line_total: item.line_total,
        gst_percentage: item.gst_percentage,
        gst_amount: item.gst_amount,
        total: item.total,
      }));

      const { error: itemsError } = await supabase
        .from('return_exchange_items')
        .insert([...returnedItemsToInsert, ...newItemsToInsert]);
      if (itemsError) throw itemsError;

      // Stock adjustments: add back old items, reduce new items
      for (const item of returnedItems) {
        if (item.product_id) {
          const { data: product } = await supabase
            .from('products')
            .select('quantity')
            .eq('id', item.product_id)
            .single();

          if (product) {
            await supabase
              .from('products')
              .update({ quantity: product.quantity + item.return_quantity })
              .eq('id', item.product_id);

            await supabase.from('stock_history').insert([
              {
                product_id: item.product_id,
                quantity_change: item.return_quantity,
                type: 'in',
                reason: `Exchange return - ${refNum}`,
                reference_id: exchangeRecord.id,
                created_by: user?.id,
              },
            ]);
          }
        }
      }

      for (const item of newItems) {
        if (item.product_id) {
          const { data: product } = await supabase
            .from('products')
            .select('quantity')
            .eq('id', item.product_id)
            .single();

          if (product) {
            await supabase
              .from('products')
              .update({ quantity: product.quantity - item.quantity })
              .eq('id', item.product_id);

            await supabase.from('stock_history').insert([
              {
                product_id: item.product_id,
                quantity_change: -item.quantity,
                type: 'out',
                reason: `Exchange new item - ${refNum}`,
                reference_id: exchangeRecord.id,
                created_by: user?.id,
              },
            ]);
          }
        }
      }

      // Log activity
      logActivity({
        module: 'exchange',
        action: 'create',
        recordId: exchangeRecord.id,
        recordLabel: refNum,
        newValue: {
          reference_number: refNum,
          original_invoice: invoiceData.invoice_number,
          client: invoiceData.client_name,
          old_total: oldTotal,
          new_total: newTotal,
          difference,
          returned_items: returnedItems.length,
          new_items: newItems.length,
        },
      });

      // Generate PDF
      try {
        const { data: settingsData } = await supabase
          .from('business_settings')
          .select('*')
          .maybeSingle();

        if (settingsData) {
          generateReturnPdf({
            referenceNumber: refNum,
            type: 'exchange',
            date: new Date().toISOString(),
            originalInvoiceNumber: invoiceData.invoice_number,
            clientName: invoiceData.client_name,
            clientPhone: invoiceData.client_phone,
            items: [...returnedItemsToInsert, ...newItemsToInsert],
            refundAmount: difference < 0 ? Math.abs(difference) : 0,
            additionalCharge: difference > 0 ? difference : 0,
            paymentMode,
            notes,
            businessSettings: settingsData,
          });
        }
      } catch (pdfError) {
        console.error('PDF generation failed:', pdfError);
      }

      toast({ title: `Exchange ${refNum} created successfully!` });
      onComplete();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Old items being returned */}
      <div>
        <Label className="text-base font-semibold">Items Being Returned</Label>
        <div className="border rounded-lg overflow-x-auto mt-2">
          <table className="w-full text-sm">
            <thead className="bg-destructive/10">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Item</th>
                <th className="px-3 py-2 text-left font-medium">SKU</th>
                <th className="px-3 py-2 text-center font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {returnedItems.map((item) => {
                const ratio = item.return_quantity / item.quantity;
                return (
                  <tr key={item.invoice_item_id} className="border-t">
                    <td className="px-3 py-2">{item.product_name}</td>
                    <td className="px-3 py-2 font-mono text-xs">{item.sku}</td>
                    <td className="px-3 py-2 text-center">{item.return_quantity}</td>
                    <td className="px-3 py-2 text-right text-destructive">
                      -{formatCurrency(item.total * ratio)}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t bg-muted/30 font-medium">
                <td colSpan={3} className="px-3 py-2 text-right">Old Total:</td>
                <td className="px-3 py-2 text-right text-destructive">
                  -{formatCurrency(oldTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* New items for exchange */}
      <div>
        <Label className="text-base font-semibold">New Items</Label>
        <div className="mt-2 mb-2">
          <ProductSearchInput
            products={products}
            onSelect={addNewItem}
            placeholder="Search and add new product..."
          />
        </div>
        {newItems.length > 0 && (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-primary/10">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Item</th>
                  <th className="px-3 py-2 text-left font-medium">SKU</th>
                  <th className="px-3 py-2 text-right font-medium">Wt(G)</th>
                  <th className="px-3 py-2 text-center font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {newItems.map((item, index) => (
                  <tr key={index} className="border-t">
                    <td className="px-3 py-2">{item.product_name}</td>
                    <td className="px-3 py-2 font-mono text-xs">{item.sku}</td>
                    <td className="px-3 py-2 text-right">
                      {item.weight_grams > 0 ? item.weight_grams.toFixed(2) : '-'}
                    </td>
                    <td className="px-3 py-2 text-center">{item.quantity}</td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatCurrency(item.total)}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeNewItem(index)}
                        className="text-destructive h-7 w-7"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
                <tr className="border-t bg-muted/30 font-medium">
                  <td colSpan={4} className="px-3 py-2 text-right">New Total:</td>
                  <td className="px-3 py-2 text-right text-primary">
                    {formatCurrency(newTotal)}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Difference summary */}
      <div
        className={`rounded-lg p-4 border ${
          difference > 0
            ? 'bg-primary/10 border-primary/20'
            : difference < 0
            ? 'bg-destructive/10 border-destructive/20'
            : 'bg-muted/30 border-border'
        }`}
      >
        <div className="flex justify-between items-center text-lg font-bold">
          <span>
            {difference > 0
              ? 'Customer Pays'
              : difference < 0
              ? 'Refund to Customer'
              : 'No Difference'}
          </span>
          <span className={difference > 0 ? 'text-primary' : difference < 0 ? 'text-destructive' : ''}>
            {formatCurrency(Math.abs(difference))}
          </span>
        </div>
      </div>

      {/* Payment mode & notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Payment Mode</Label>
          <Select value={paymentMode} onValueChange={setPaymentMode}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="upi">UPI</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="wallet">Store Wallet</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Notes (Optional)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes..."
            rows={2}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between gap-3">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          className="btn-gold"
          onClick={handleSubmit}
          disabled={isSubmitting || newItems.length === 0}
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          {isSubmitting ? 'Processing...' : 'Confirm Exchange & Download'}
        </Button>
      </div>
    </div>
  );
}
