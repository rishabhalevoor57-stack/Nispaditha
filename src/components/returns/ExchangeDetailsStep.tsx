import { useState, useRef } from 'react';
import { logStockMove } from '@/utils/stockMovement';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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

interface ExchangeDetailsStepProps {
  invoiceData: InvoiceData;
  returnedItems: ReturnItemSelection[];
  onBack: () => void;
  onComplete: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);

/**
 * Exchange now mirrors Return: customer brings item back, gets store credits
 * equal to the proportional total of the returned items. No new item picker.
 */
export function ExchangeDetailsStep({ invoiceData, returnedItems, onBack, onComplete }: ExchangeDetailsStepProps) {
  const [method, setMethod] = useState<'store_credit' | 'cash' | null>(null);
  const asStoreCredits = method === 'store_credit';
  const submitLock = useRef(false);
  const [cashMode, setCashMode] = useState<'cash' | 'upi' | 'card' | 'bank_transfer'>('cash');
  const [sendTo, setSendTo] = useState<'inventory' | 'repair'>('inventory');
  const [notes, setNotes] = useState('');
  const [newItemValue, setNewItemValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { logActivity } = useActivityLogger();

  const eligibleAmount = Math.round(returnedItems.reduce((sum, item) => {
    const ratio = item.return_quantity / item.quantity;
    return sum + item.total * ratio;
  }, 0) * 100) / 100;
  const [valueInput, setValueInput] = useState<string>(eligibleAmount.toFixed(2));
  const exchangeValue = Math.round((Number(valueInput) || 0) * 100) / 100;

  const originalValue = returnedItems.reduce((s, i) => s + i.total, 0);
  const newValue = Number(newItemValue) || 0;
  const difference = Math.round((newValue - exchangeValue) * 100) / 100;
  // Customer pays only the extra; any leftover goes back as credit/refund.
  const additionalCharge = difference > 0 ? difference : 0;
  const refundAmount = difference < 0 ? Math.abs(difference) : 0;

  const handleSubmit = async () => {
    if (submitLock.current) return;
    if (valueInput.trim() === '' || !(exchangeValue >= 0)) {
      toast({ variant: 'destructive', title: 'Enter a valid exchange value' });
      return;
    }
    if (refundAmount > 0 && !method) {
      toast({ variant: 'destructive', title: 'Choose Store Credit or Cash Refund for the leftover amount' });
      return;
    }
    submitLock.current = true;
    setIsSubmitting(true);
    try {
      const { data: refNum, error: refError } = await supabase.rpc(
        'generate_return_exchange_reference',
        { p_type: 'exchange' },
      );
      if (refError) throw refError;

      const { data: invRow } = await supabase
        .from('invoices')
        .select('client_id')
        .eq('id', invoiceData.id)
        .maybeSingle();
      const clientId = invRow?.client_id || null;

      const paymentMode = refundAmount > 0 ? (asStoreCredits ? 'store_credit' : cashMode) : (additionalCharge > 0 ? cashMode : null);

      const { data: rec, error: recErr } = await supabase
        .from('return_exchanges')
        .insert([{
          reference_number: refNum,
          type: 'exchange',
          original_invoice_id: invoiceData.id,
          original_invoice_number: invoiceData.invoice_number,
          client_id: clientId,
          client_name: invoiceData.client_name,
          client_phone: invoiceData.client_phone,
          refund_amount: refundAmount,
          additional_charge: additionalCharge,
          payment_mode: paymentMode,
          refund_method: refundAmount > 0 && asStoreCredits ? 'store_credit' : 'cash',
          disposition: sendTo,
          reason: `Exchange value ${exchangeValue.toFixed(2)} vs new item ${newValue.toFixed(2)}`,
          notes: notes || null,
          created_by: user?.id,
        }] as never)
        .select()
        .single();
      if (recErr) throw recErr;

      const itemsToInsert = returnedItems.map((item) => {
        const ratio = item.return_quantity / item.quantity;
        return {
          return_exchange_id: rec.id,
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
      const { error: itemsErr } = await supabase.from('return_exchange_items').insert(itemsToInsert);
      if (itemsErr) throw itemsErr;

      // Mark the original invoice as EXCHANGED (kept for history; previous status remembered)
      const { data: invStatus } = await supabase
        .from('invoices')
        .select('status, status_before_exchange')
        .eq('id', invoiceData.id)
        .maybeSingle();
      const st = invStatus as { status: string; status_before_exchange: string | null } | null;
      if (st && st.status !== 'exchanged') {
        await supabase
          .from('invoices')
          .update({ status: 'exchanged', status_before_exchange: st.status } as never)
          .eq('id', invoiceData.id);
      }

      if (sendTo === 'inventory') {
        for (const item of returnedItems) {
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
              action: 'Exchange Return',
              referenceId: rec.id,
              referenceLabel: refNum,
              reason: `Exchange Return ${refNum}`,
            });
          }
        }
      } else {
        await supabase.from('repair_items').insert(
          returnedItems.map((item) => ({
            product_id: item.product_id,
            sku: item.sku || null,
            product_name: item.product_name,
            weight_grams: item.weight_grams,
            quantity: item.return_quantity,
            original_invoice_id: invoiceData.id,
            original_invoice_number: invoiceData.invoice_number,
            client_name: invoiceData.client_name,
            client_phone: invoiceData.client_phone,
            source: 'exchange',
            source_reference_id: rec.id,
            created_by: user?.id,
          })),
        );
      }

      if (asStoreCredits && !clientId && refundAmount > 0) {
        toast({ variant: 'destructive', title: 'No client linked', description: 'Store credit could not be added — this invoice has no client.' });
      }
      if (asStoreCredits && clientId && refundAmount > 0) {
        await settleWalletForReference({ clientId, referenceId: rec.id, targetNet: refundAmount, source: 'exchange', relatedSources: ['exchange'], referenceLabel: refNum, notes: `Exchange credit for ${invoiceData.invoice_number}` });
        toast({ title: `${formatCurrency(refundAmount)} credits added to ${invoiceData.client_name || 'client'}'s wallet` });
      }

      logActivity({
        module: 'exchange',
        action: 'create',
        recordId: rec.id,
        recordLabel: refNum,
        newValue: { reference_number: refNum, original_invoice: invoiceData.invoice_number, refund_amount: refundAmount, refund_method: asStoreCredits ? 'store_credit' : 'cash', send_to: sendTo },
      });

      try {
        const { data: settingsData } = await supabase.from('business_settings').select('*').maybeSingle();
        if (settingsData) {
          generateReturnPdf({
            referenceNumber: refNum,
            type: 'exchange',
            date: new Date().toISOString(),
            originalInvoiceNumber: invoiceData.invoice_number,
            clientName: invoiceData.client_name,
            clientPhone: invoiceData.client_phone,
            items: itemsToInsert,
            refundAmount,
            additionalCharge,
            paymentMode,
            notes,
            businessSettings: settingsData,
          });
        }
      } catch (pdfError) {
        console.error('PDF generation failed:', pdfError);
      }

      toast({ title: `Exchange ${refNum} processed successfully!` });
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
      <div>
        <Label className="text-base font-semibold">Items Being Exchanged</Label>
        <div className="border rounded-lg overflow-x-auto mt-2">
          <table className="w-full text-sm">
            <thead className="bg-primary/10">
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
                    <td className="px-3 py-2 text-right">{formatCurrency(item.total * ratio)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-2 text-sm">
        <Label className="text-base font-semibold">Exchange Calculation</Label>
        <div className="flex justify-between"><span className="text-muted-foreground">Original Item Value (as billed)</span><span>{formatCurrency(originalValue)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Eligible value (returned qty)</span><span>{formatCurrency(eligibleAmount)}</span></div>
        <div className="flex justify-between items-center gap-2">
          <span className="text-muted-foreground">Exchange Value (editable)</span>
          <Input type="number" min={0} step="0.01" value={valueInput} onChange={(e) => setValueInput(e.target.value)} className="w-32 h-8 text-right font-medium" />
        </div>
        <div className="flex justify-between items-center gap-2">
          <span className="text-muted-foreground">New Item Value</span>
          <Input type="number" min={0} value={newItemValue} onChange={(e) => setNewItemValue(e.target.value)} placeholder="0.00" className="w-32 h-8 text-right" />
        </div>
        {newValue > 0 && (
          <div className={`flex justify-between font-semibold border-t pt-2 ${difference >= 0 ? 'text-primary' : 'text-destructive'}`}>
            <span>{difference >= 0 ? 'Difference Payable by Customer' : 'Difference Refundable to Customer'}</span>
            <span>{formatCurrency(Math.abs(difference))}</span>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Old item value uses the exact amount paid on the original invoice — not today's rate. If the new item costs more, the customer pays only the difference; if less, the leftover is given as Store Credit or Cash Refund.</p>
      </div>

      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
        <div className="flex justify-between items-center text-lg font-bold">
          <span>{additionalCharge > 0 ? 'Customer Pays' : 'Customer Receives'}</span>
          <span className="text-primary">{formatCurrency(additionalCharge > 0 ? additionalCharge : refundAmount)}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {additionalCharge > 0 ? `Collect the difference via ${cashMode.toUpperCase()}.` : refundAmount === 0 ? 'Even exchange — nothing to pay or refund.' : method === 'store_credit' ? 'Will be added to the client\'s store credit.' : method === 'cash' ? `Will be paid out via ${cashMode.toUpperCase()}.` : 'Choose how the customer receives the leftover amount.'}
        </div>
      </div>

      {refundAmount > 0 && (
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
      )}

      {((refundAmount > 0 && method === 'cash') || additionalCharge > 0) && (
        <div>
          <Label>{additionalCharge > 0 ? 'Difference Payment Mode' : 'Cash Refund Mode'}</Label>
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
        <Label>After Exchange — Send Item To</Label>
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
          {isSubmitting ? 'Processing...' : 'Confirm Exchange'}
        </Button>
      </div>
    </div>
  );
}
