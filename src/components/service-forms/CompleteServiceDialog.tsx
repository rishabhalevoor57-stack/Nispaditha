import { useEffect, useRef, useState } from 'react';
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
import { calculateServiceInvoiceSettlement } from '@/lib/serviceInvoiceSettlement';

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
  const [paymentMode, setPaymentMode] = useState<string>('pay_later');
  const [paymentReceived, setPaymentReceived] = useState('0');
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!open || !serviceForm) return;
    setCharge(Number(serviceForm.final_cost) || Number(serviceForm.estimated_cost) || 0);
    setPaymentMode('pay_later');
    setPaymentReceived('0');
  }, [open, serviceForm?.id]);

  if (!serviceForm) return null;

  const gstPercent = Number(serviceForm.gst_percentage ?? 3);
  const baseAmount = Number((charge / (1 + gstPercent / 100)).toFixed(2));
  const gstAmount = Number((charge - baseAmount).toFixed(2));
  const cgst = Number((gstAmount / 2).toFixed(2));
  const sgst = Number((gstAmount / 2).toFixed(2));
  const enteredPayment = paymentMode === 'pay_later' ? 0 : Number(paymentReceived) || 0;
  const settlement = calculateServiceInvoiceSettlement(charge, enteredPayment);

  const resolveClientId = async (): Promise<string | null> => {
    if (serviceForm.client_id) return serviceForm.client_id;
    const phone = (serviceForm.client_phone || '').trim();
    const name = (serviceForm.client_name || '').trim() || 'Walk-in Customer';
    if (phone) {
      const { data: existing } = await supabase.from('clients').select('id').eq('phone', phone).maybeSingle();
      if (existing?.id) return existing.id;
    }
    const { data: created } = await supabase
      .from('clients')
      .insert({ name, phone: phone || null } as never)
      .select('id')
      .single();
    return (created as { id: string } | null)?.id || null;
  };

  const handleComplete = async () => {
    if (submittingRef.current) return;
    if (serviceForm.completed_invoice_id) {
      toast({ variant: 'destructive', title: 'Already billed', description: 'This Service Form already has a GST Invoice.' });
      return;
    }
    if (!Number.isFinite(charge) || charge <= 0) {
      toast({ variant: 'destructive', title: 'Invalid charge', description: 'Enter a final charge greater than zero.' });
      return;
    }
    if (paymentMode !== 'pay_later' && (!Number.isFinite(Number(paymentReceived)) || Number(paymentReceived) < 0 || Number(paymentReceived) > charge)) {
      toast({ variant: 'destructive', title: 'Invalid payment amount', description: 'Payment received cannot be more than the final charge.' });
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    try {
      const { data: latestService, error: latestServiceError } = await (supabase
        .from('service_forms' as any)
        .select('completed_invoice_id')
        .eq('id', serviceForm.id)
        .maybeSingle() as any);
      if (latestServiceError) throw latestServiceError;
      if (latestService?.completed_invoice_id) {
        throw new Error('This Service Form already has a GST Invoice.');
      }

      // Generate invoice number
      const { data: invNum, error: invNumErr } = await supabase.rpc('generate_invoice_number');
      if (invNumErr) throw invNumErr;
      if (!invNum) throw new Error('Could not generate an invoice number.');

      const clientId = await resolveClientId();

      const services = [...(serviceForm.service_types || [])];
      if (serviceForm.other_service_text) services.push(serviceForm.other_service_text);
      const description = `Service: ${services.join(', ')} — ${serviceForm.item_description}`;
      const completedAt = new Date();

      // Create invoice
      const { data: invoice, error: invErr } = await supabase.from('invoices').insert({
        invoice_number: invNum as string,
        client_id: clientId,
        invoice_date: (serviceForm.service_date as string) || format(new Date(), 'yyyy-MM-dd'),

        subtotal: baseAmount,
        discount_amount: 0,
        gst_percentage: gstPercent,
        gst_amount: gstAmount,
        grand_total: charge,
        round_off: 0,
        status: settlement.invoiceStatus,
        payment_status: settlement.paymentStatus,
        payment_mode: settlement.amountPaid > 0 ? paymentMode : 'pay_later',
        payment_mode_1: settlement.amountPaid > 0 ? paymentMode : null,
        payment_amount_1: settlement.amountPaid,
        payment_mode_2: null,
        payment_amount_2: 0,
        amount_paid_via_mode: settlement.amountPaid,
        total_paid: settlement.amountPaid,
        balance_due: settlement.balanceDue,
        amount_after_credits: charge,
        store_credits_used: 0,
        advance_paid: settlement.amountPaid,
        notes: `Generated from Service Receipt ${serviceForm.receipt_number}`,
        created_by: user?.id || null,
        paid_at: settlement.paymentStatus === 'paid' ? completedAt.toISOString() : null,
        sent_at: completedAt.toISOString(),
      } as any).select().single();
      if (invErr) throw invErr;

      // Invoice line item
      const { error: itemError } = await supabase.from('invoice_items').insert({
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
      if (itemError) throw itemError;

      // Record only the amount actually received here; the remaining balance stays due.
      if (settlement.amountPaid > 0) {
        const { data: receiptNum, error: receiptError } = await supabase.rpc('generate_receipt_number');
        if (receiptError) throw receiptError;
        const { error: paymentError } = await supabase.from('invoice_payments').insert({
          invoice_id: invoice.id,
          receipt_number: (receiptNum as string) || `RCP-${Date.now()}`,
          amount: settlement.amountPaid,
          payment_mode: paymentMode,
          payment_date: format(completedAt, 'yyyy-MM-dd'),
          notes: settlement.balanceDue > 0 ? 'Advance received at service completion' : 'Payment received in full at service completion',
          created_by: user?.id || null,
        } as any);
        if (paymentError) throw paymentError;
      }

      // Mark service form completed
      const { error: serviceUpdateError } = await (supabase.from('service_forms' as any).update({
        status: 'completed',
        completed_invoice_id: invoice.id,
        completed_at: completedAt.toISOString(),
        final_cost: charge,
      }).eq('id', serviceForm.id) as any);
      if (serviceUpdateError) throw serviceUpdateError;

      toast({
        title: 'Service completed & GST invoice generated',
        description: settlement.balanceDue > 0
          ? `${invoice.invoice_number} · Balance due ₹${settlement.balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
          : invoice.invoice_number,
      });
      qc.invalidateQueries({ queryKey: ['service-forms'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      onCompleted?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Failed to complete service', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      submittingRef.current = false;
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
            <div>CGST ({(gstPercent / 2).toFixed(2)}%): ₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            <div>SGST ({(gstPercent / 2).toFixed(2)}%): ₹{sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            <div className="font-semibold pt-1 border-t">Total: ₹{charge.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            <div>Balance Due: ₹{settlement.balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="space-y-2">
            <Label>Payment Received / Advance (₹)</Label>
            <Input
              type="number"
              min={0}
              max={charge}
              step="0.01"
              value={paymentReceived}
              onChange={(e) => setPaymentReceived(e.target.value)}
              disabled={paymentMode === 'pay_later'}
            />
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
                <SelectItem value="pay_later">Pay Later</SelectItem>
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
