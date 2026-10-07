import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { logStockMove } from '@/utils/stockMovement';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useActivityLogger } from '@/hooks/useActivityLog';
import { generateReturnPdf } from '@/utils/returnPdf';
import { settleWalletForReference } from '@/hooks/useStoreWallet';
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

export function ReturnDetailsStep({ invoiceData, selectedItems, onBack, onComplete }: ReturnDetailsStepProps) {
  // Default refund to store credits; toggle off => cash exception
  const [method, setMethod] = useState<'store_credit' | 'cash' | null>(null);
  const asStoreCredits = method === 'store_credit';
  const submitLock = useRef(false);
  const [cashMode, setCashMode] = useState<'cash' | 'upi' | 'card' | 'bank_transfer'>('cash');
  const [sendTo, setSendTo] = useState<'inventory' | 'repair'>('inventory');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { logActivity } = useActivityLogger();

  const eligibleAmount = Math.round(selectedItems.reduce((sum, item) => {
    const ratio = item.return_quantity / item.quantity;
    return sum + item.total * ratio;
  }, 0) * 100) / 100;
  const [valueInput, setValueInput] = useState<string>(eligibleAmount.toFixed(2));
  const refundAmount = Math.round((Number(valueInput) || 0) * 100) / 100;

  const handleSubmit = async () => {
    if (submitLock.current) return;
    if (!method) {
      toast({ variant: 'destructive', title: 'Choose Store Credit or Cash Refund' });
      return;
    }
    if (!(refundAmount >= 0) || valueInput.trim() === '') {
      toast({ variant: 'destructive', title: 'Enter a valid return value' });
      return;
    }
    submitLock.current = true;
    setIsSubmitting(true);
    try {
      const { data: refNum, error: refError } = await supabase.rpc(
        'generate_return_exchange_reference',
        { p_type: 'return' },
      );
      if (refError) throw refError;

      // Get client_id for wallet credit
      const { data: invRow } = await supabase
        .from('invoices')
        .select('client_id')
        .eq('id', invoiceData.id)
        .maybeSingle();
      const clientId = invRow?.client_id || null;

      const paymentMode = asStoreCredits ? 'store_credit' : cashMode;

      const { data: returnRecord, error: returnError } = await supabase
        .from('return_exchanges')
        .insert([{
          reference_number: refNum,
          type: 'return',
          original_invoice_id: invoiceData.id,
          original_invoice_number: invoiceData.invoice_number,
          client_id: clientId,
          client_name: invoiceData.client_name,
          client_phone: invoiceData.client_phone,
          refund_amount: refundAmount,
          additional_charge: 0,
          payment_mode: paymentMode,
          refund_method: asStoreCredits ? 'store_credit' : 'cash',
          disposition: sendTo,
          reason: selectedItems.map((i) => i.reason).filter(Boolean).join('; ') || null,
          notes: notes || null,
          created_by: user?.id,
        }] as never)
        .select()
        .single();
      if (returnError) throw returnError;

      // Insert items
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
          gst_percentage: 0,
          gst_amount: 0,
          total: item.total * ratio,
        };
      });
      const { error: itemsError } = await supabase
        .from('return_exchange_items')
        .insert(itemsToInsert);
      if (itemsError) throw itemsError;

      // Disposition: inventory or repair
      if (sendTo === 'inventory') {
        for (const item of selectedItems) {
          if (!item.product_id) continue;
          const { data: product } = await supabase
            .from('products')
            .select('quantity')
            .eq('id', item.product_id)
            .single();
          if (product) {
            await logStockMove({
              productId: item.product_id,
              qtyDelta: item.return_quantity,
              module: 'returns',
              action: 'Return Processed',
              referenceId: returnRecord.id,
              referenceLabel: refNum,
              reason: `Return Processed ${refNum}`,
            });
          }
        }
      } else {
        await supabase.from('repair_items').insert(
          selectedItems.map((item) => ({
            product_id: item.product_id,
            sku: item.sku || null,
            product_name: item.product_name,
            weight_grams: item.weight_grams,
            quantity: item.return_quantity,
            original_invoice_id: invoiceData.id,
            original_invoice_number: invoiceData.invoice_number,
            client_name: invoiceData.client_name,
            client_phone: invoiceData.client_phone,
            source: 'return',
            source_reference_id: returnRecord.id,
            created_by: user?.id,
          })),
        );
      }

      // Credit wallet if store credit refund
      if (asStoreCredits && !clientId && refundAmount > 0) {
        toast({ variant: 'destructive', title: 'No client linked', description: 'Store credit could not be added — this invoice has no client.' });
      }
      if (asStoreCredits && clientId && refundAmount > 0) {
        await settleWalletForReference({ clientId, referenceId: returnRecord.id, targetNet: refundAmount, source: 'return', relatedSources: ['return'], referenceLabel: refNum, notes: `Return refund for ${invoiceData.invoice_number}` });
        toast({ title: `${formatCurrency(refundAmount)} credits added to ${invoiceData.client_name || 'client'}'s wallet` });
      }

      logActivity({
        module: 'return',
        action: 'create',
        recordId: returnRecord.id,
        recordLabel: refNum,
        newValue: { reference_number: refNum, original_invoice: invoiceData.invoice_number, refund_amount: refundAmount, refund_method: asStoreCredits ? 'store_credit' : 'cash', send_to: sendTo },
      });

      // PDF
      try {
        const { data: settingsData } = await supabase.from('business_settings').select('*').maybeSingle();
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
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Failed' });
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
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

      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Original eligible value (as billed)</span>
          <span>{formatCurrency(eligibleAmount)}</span>
        </div>
        <div className="flex justify-between items-center gap-2 text-lg font-bold mt-2">
          <span>Return Value (editable)</span>
          <Input type="number" min={0} step="0.01" value={valueInput} onChange={(e) => setValueInput(e.target.value)} className="w-40 h-9 text-right font-bold" />
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {method === 'store_credit' ? `${formatCurrency(refundAmount)} will be added to the client's store credit.` : method === 'cash' ? `${formatCurrency(refundAmount)} will be paid out via ${cashMode.toUpperCase()}.` : 'Choose how the customer receives this amount.'}
        </div>
      </div>

      <div>
        <Label>Customer Receives *</Label>
        <RadioGroup value={method ?? ''} onValueChange={(v) => setMethod(v as 'store_credit' | 'cash')} className="grid grid-cols-2 gap-2 mt-1">
          <label className="flex items-center gap-2 rounded-md border p-2 cursor-pointer">
            <RadioGroupItem value="store_credit" /><span className="text-sm">Store Credit</span>
          </label>
          <label className="flex items-center gap-2 rounded-md border p-2 cursor-pointer">
            <RadioGroupItem value="cash" /><span className="text-sm">Cash Refund</span>
          </label>
        </RadioGroup>
      </div>

      {method === 'cash' && (
        <div>
          <Label>Cash Refund Mode</Label>
          <RadioGroup value={cashMode} onValueChange={(v) => setCashMode(v as typeof cashMode)} className="grid grid-cols-4 gap-2 mt-1">
            {(['cash', 'upi', 'card', 'bank_transfer'] as const).map((m) => (
              <label key={m} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer">
                <RadioGroupItem value={m} /><span className="text-sm capitalize">{m.replace('_', ' ')}</span>
              </label>
            ))}
          </RadioGroup>
        </div>
      )}

      <div>
        <Label>After Return — Send Item To</Label>
        <RadioGroup value={sendTo} onValueChange={(v) => setSendTo(v as 'inventory' | 'repair')} className="grid grid-cols-2 gap-2 mt-1">
          <label className="flex items-center gap-2 rounded-md border p-2 cursor-pointer">
            <RadioGroupItem value="inventory" /><span className="text-sm">Inventory (stock +1)</span>
          </label>
          <label className="flex items-center gap-2 rounded-md border p-2 cursor-pointer">
            <RadioGroupItem value="repair" /><span className="text-sm">Repair (stock unchanged)</span>
          </label>
        </RadioGroup>
      </div>

      <div>
        <Label>Notes (Optional)</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." rows={2} />
      </div>

      <div className="flex justify-between gap-3">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button className="btn-gold" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          {isSubmitting ? 'Processing...' : 'Confirm Return'}
        </Button>
      </div>
    </div>
  );
}
