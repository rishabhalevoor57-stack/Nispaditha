import { useState } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ServiceForm } from '@/types/serviceForm';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  serviceForm: ServiceForm | null;
  onCompleted?: () => void;
}

export const CompleteServiceDialog = ({ open, onOpenChange, serviceForm, onCompleted }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [charge, setCharge] = useState<number>(serviceForm?.estimated_cost || 0);
  const [paymentMode, setPaymentMode] = useState<string>('cash');
  const [loading, setLoading] = useState(false);

  if (!serviceForm) return null;

  const gstPercent = 5;
  const baseAmount = Number((charge / (1 + gstPercent / 100)).toFixed(2));
  const gstAmount = Number((charge - baseAmount).toFixed(2));
  const cgst = Number((gstAmount / 2).toFixed(2));
  const sgst = Number((gstAmount / 2).toFixed(2));

  const handleComplete = async () => {
    setLoading(true);
    try {
      // Generate invoice number
      const { data: invNum, error: invNumErr } = await supabase.rpc('generate_invoice_number');
      if (invNumErr) throw invNumErr;

      const services = [...(serviceForm.service_types || [])];
      if (serviceForm.other_service_text) services.push(serviceForm.other_service_text);
      const description = `Service: ${services.join(', ')} — ${serviceForm.item_description}`;

      // Create invoice
      const { data: invoice, error: invErr } = await supabase.from('invoices').insert({
        invoice_number: invNum as string,
        client_id: serviceForm.client_id,
        invoice_date: format(new Date(), 'yyyy-MM-dd'),
        subtotal: baseAmount,
        discount_amount: 0,
        gst_percentage: gstPercent,
        gst_amount: gstAmount,
        grand_total: charge,
        round_off: 0,
        status: 'sent',
        payment_status: 'paid',
        payment_mode: paymentMode,
        amount_paid_via_mode: charge,
        total_paid: charge,
        balance_due: 0,
        amount_after_credits: charge,
        store_credits_used: 0,
        advance_paid: 0,
        payment_amount_1: 0,
        payment_amount_2: 0,
        notes: `Generated from Service Receipt ${serviceForm.receipt_number}`,
        created_by: user?.id || null,
        paid_at: new Date().toISOString(),
        sent_at: new Date().toISOString(),
      } as any).select().single();
      if (invErr) throw invErr;

      // Invoice line item
      await supabase.from('invoice_items').insert({
        invoice_id: invoice.id,
        product_name: description,
        description: serviceForm.service_notes || null,
        quantity: 1,
        weight_grams: serviceForm.weight_grams || 0,
        rate_per_gram: 0,
        gold_value: 0,
        making_charges: baseAmount,
        discounted_making: baseAmount,
        discount: 0,
        subtotal: baseAmount,
        gst_percentage: gstPercent,
        gst_amount: gstAmount,
        mrp: charge,
        total: charge,
      } as any);

      // Payment record
      const { data: receiptNum } = await supabase.rpc('generate_receipt_number');
      await supabase.from('invoice_payments').insert({
        invoice_id: invoice.id,
        receipt_number: (receiptNum as string) || `RCP-${Date.now()}`,
        amount: charge,
        payment_mode: paymentMode,
        payment_date: format(new Date(), 'yyyy-MM-dd'),
        created_by: user?.id || null,
      } as any);

      // Mark service form completed
      await (supabase.from('service_forms' as any).update({
        status: 'completed',
        completed_invoice_id: invoice.id,
        completed_at: new Date().toISOString(),
        final_cost: charge,
      }).eq('id', serviceForm.id) as any);

      toast({ title: 'Service completed & GST invoice generated', description: invoice.invoice_number });
      qc.invalidateQueries({ queryKey: ['service-forms'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      onCompleted?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Failed to complete service', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Complete & Bill — {serviceForm.receipt_number}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="text-sm">
            <div><span className="text-muted-foreground">Client: </span>{serviceForm.client_name}</div>
            <div><span className="text-muted-foreground">Item: </span>{serviceForm.item_description}</div>
            <div><span className="text-muted-foreground">Services: </span>{(serviceForm.service_types || []).join(', ')}</div>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label>Final Charge (inclusive of GST) ₹</Label>
            <Input type="number" value={charge || ''} onChange={(e) => setCharge(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="text-sm space-y-1 bg-muted p-3 rounded-md">
            <div>Base Amount: ₹{baseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            <div>CGST (2.5%): ₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            <div>SGST (2.5%): ₹{sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            <div className="font-semibold pt-1 border-t">Total: ₹{charge.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="space-y-2">
            <Label>Payment Mode</Label>
            <Select value={paymentMode} onValueChange={setPaymentMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="store_wallet">Store Wallet</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleComplete} disabled={loading || charge <= 0}>{loading ? 'Generating...' : 'Generate GST Invoice'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
