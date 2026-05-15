import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Loader2, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useActivityLogger } from '@/hooks/useActivityLog';
import { generateReturnPdf } from '@/utils/returnPdf';
import { adjustWallet } from '@/hooks/useStoreWallet';
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
  const [asStoreCredits, setAsStoreCredits] = useState(true);
  const [cashMode, setCashMode] = useState<'cash' | 'upi' | 'card' | 'bank_transfer'>('cash');
  const [sendTo, setSendTo] = useState<'inventory' | 'repair'>('inventory');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { logActivity } = useActivityLogger();

  const refundAmount = returnedItems.reduce((sum, item) => {
    const ratio = item.return_quantity / item.quantity;
    return sum + item.total * ratio;
  }, 0);

  const handleSubmit = async () => {
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

      const paymentMode = asStoreCredits ? 'store_credit' : cashMode;

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
          additional_charge: 0,
          payment_mode: paymentMode,
          refund_method: asStoreCredits ? 'store_credit' : 'cash',
          disposition: sendTo,
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

      if (sendTo === 'inventory') {
        for (const item of returnedItems) {
          if (!item.product_id) continue;
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
            await supabase.from('stock_history').insert([{
              product_id: item.product_id,
              quantity_change: item.return_quantity,
              type: 'in',
              reason: `Exchange return - ${refNum}`,
              reference_id: rec.id,
              created_by: user?.id,
            }]);
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

      if (asStoreCredits && clientId && refundAmount > 0) {
        await adjustWallet(clientId, refundAmount, 'exchange', rec.id, refNum, `Exchange credit for ${invoiceData.invoice_number}`);
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
            additionalCharge: 0,
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

      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
        <div className="flex justify-between items-center text-lg font-bold">
          <span>Credits to Issue (No GST)</span>
          <span className="text-primary">{formatCurrency(refundAmount)}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {asStoreCredits ? '1 credit = ₹1. Will be added to client wallet automatically.' : `Refund will be issued via ${cashMode.toUpperCase()}.`}
        </div>
      </div>

      <div className="rounded-lg border p-3 flex items-center justify-between">
        <div>
          <Label>Refund as Store Credits</Label>
          <p className="text-xs text-muted-foreground">Default. Toggle off only for cash exception.</p>
        </div>
        <Switch checked={asStoreCredits} onCheckedChange={setAsStoreCredits} />
      </div>

      {!asStoreCredits && (
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
