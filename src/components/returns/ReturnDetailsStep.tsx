import { useState } from 'react';
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
import { Loader2, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useActivityLogger } from '@/hooks/useActivityLog';
import { generateReturnPdf } from '@/utils/returnPdf';
import type { ReturnItemSelection } from '@/types/returnExchange';

interface InvoiceData {
  id: string;
  invoice_number: string;
  client_name: string;
  client_phone: string;
}

interface ReturnDetailsStepProps {
  invoiceData: InvoiceData;
  selectedItems: ReturnItemSelection[];
  onBack: () => void;
  onComplete: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);

export function ReturnDetailsStep({
  invoiceData,
  selectedItems,
  onBack,
  onComplete,
}: ReturnDetailsStepProps) {
  const [paymentMode, setPaymentMode] = useState('cash');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { logActivity } = useActivityLogger();

  // Calculate refund amount based on return quantity proportional to original
  const refundAmount = selectedItems.reduce((sum, item) => {
    const ratio = item.return_quantity / item.quantity;
    return sum + item.total * ratio;
  }, 0);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Generate reference number
      const { data: refNum, error: refError } = await supabase.rpc(
        'generate_return_exchange_reference',
        { p_type: 'return' }
      );
      if (refError) throw refError;

      // Create return record
      const { data: returnRecord, error: returnError } = await supabase
        .from('return_exchanges')
        .insert([
          {
            reference_number: refNum,
            type: 'return',
            original_invoice_id: invoiceData.id,
            original_invoice_number: invoiceData.invoice_number,
            client_name: invoiceData.client_name,
            client_phone: invoiceData.client_phone,
            refund_amount: refundAmount,
            additional_charge: 0,
            payment_mode: paymentMode,
            reason: selectedItems.map((i) => i.reason).filter(Boolean).join('; ') || null,
            notes: notes || null,
            created_by: user?.id,
          },
        ])
        .select()
        .single();

      if (returnError) throw returnError;

      // Create return items
      const itemsToInsert = selectedItems.map((item) => {
        const ratio = item.return_quantity / item.quantity;
        return {
          return_exchange_id: returnRecord.id,
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

      const { error: itemsError } = await supabase
        .from('return_exchange_items')
        .insert(itemsToInsert);
      if (itemsError) throw itemsError;

      // Add returned quantity back to inventory
      for (const item of selectedItems) {
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

            // Log stock history
            await supabase.from('stock_history').insert([
              {
                product_id: item.product_id,
                quantity_change: item.return_quantity,
                type: 'in',
                reason: `Return - ${refNum}`,
                reference_id: returnRecord.id,
                created_by: user?.id,
              },
            ]);
          }
        }
      }

      // Log activity
      logActivity({
        module: 'return',
        action: 'create',
        recordId: returnRecord.id,
        recordLabel: refNum,
        newValue: {
          reference_number: refNum,
          original_invoice: invoiceData.invoice_number,
          client: invoiceData.client_name,
          refund_amount: refundAmount,
          items_count: selectedItems.length,
        },
      });

      // Generate and download PDF
      try {
        const { data: settingsData } = await supabase
          .from('business_settings')
          .select('*')
          .maybeSingle();

        if (settingsData) {
          generateReturnPdf({
            referenceNumber: refNum,
            type: 'return',
            date: new Date().toISOString(),
            originalInvoiceNumber: invoiceData.invoice_number,
            clientName: invoiceData.client_name,
            clientPhone: invoiceData.client_phone,
            items: itemsToInsert,
            refundAmount,
            additionalCharge: 0,
            paymentMode,
            notes,
            businessSettings: settingsData,
          });
        }
      } catch (pdfError) {
        console.error('PDF generation failed:', pdfError);
      }

      toast({ title: `Return ${refNum} created successfully!` });
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
      {/* Returned items summary */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-3 text-left font-medium">Item</th>
              <th className="px-3 py-3 text-left font-medium">SKU</th>
              <th className="px-3 py-3 text-center font-medium">Return Qty</th>
              <th className="px-3 py-3 text-right font-medium">Refund Value</th>
              <th className="px-3 py-3 text-left font-medium">Reason</th>
            </tr>
          </thead>
          <tbody>
            {selectedItems.map((item) => {
              const ratio = item.return_quantity / item.quantity;
              return (
                <tr key={item.invoice_item_id} className="border-t">
                  <td className="px-3 py-3 font-medium">{item.product_name}</td>
                  <td className="px-3 py-3 font-mono text-xs">{item.sku}</td>
                  <td className="px-3 py-3 text-center">{item.return_quantity}</td>
                  <td className="px-3 py-3 text-right">{formatCurrency(item.total * ratio)}</td>
                  <td className="px-3 py-3 text-muted-foreground">{item.reason || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Refund summary */}
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
        <div className="flex justify-between items-center text-lg font-bold">
          <span>Total Refund Amount</span>
          <span className="text-destructive">{formatCurrency(refundAmount)}</span>
        </div>
      </div>

      {/* Payment mode & notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Refund Mode</Label>
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
          variant="destructive"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          {isSubmitting ? 'Processing...' : 'Confirm Return & Download Receipt'}
        </Button>
      </div>
    </div>
  );
}
