import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, IndianRupee } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  grandTotal: number;
  alreadyPaid: number;
  onRecorded: () => void;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  grandTotal,
  alreadyPaid,
  onRecorded,
}: RecordPaymentDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const balance = Math.max(0, grandTotal - alreadyPaid);
  const [amount, setAmount] = useState<number>(balance);
  const [mode, setMode] = useState<string>('cash');
  const [date, setDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(balance);
      setMode('cash');
      setDate(new Date());
      setNotes('');
    }
  }, [open, balance]);

  const handleConfirm = async () => {
    if (amount <= 0) {
      toast({ variant: 'destructive', title: 'Enter a valid amount' });
      return;
    }
    setSaving(true);
    try {
      const { data: receiptNum } = await supabase.rpc('generate_receipt_number');

      const { error: payErr } = await supabase.from('invoice_payments').insert([{
        invoice_id: invoiceId,
        receipt_number: receiptNum,
        amount,
        payment_mode: mode,
        payment_date: format(date, 'yyyy-MM-dd'),
        notes: notes || null,
        created_by: user?.id,
      }]);
      if (payErr) throw payErr;

      const newTotalPaid = alreadyPaid + amount;
      const isFullyPaid = newTotalPaid >= grandTotal;

      const updates: Record<string, unknown> = {
        advance_paid: newTotalPaid,
        payment_status: isFullyPaid ? 'paid' : 'partial',
      };
      if (isFullyPaid) {
        updates.status = 'paid';
        updates.paid_at = date.toISOString();
        updates.payment_mode = mode;
      }

      const { error: invErr } = await supabase.from('invoices').update(updates).eq('id', invoiceId);
      if (invErr) throw invErr;

      toast({
        title: isFullyPaid ? 'Payment recorded — invoice marked as PAID IN FULL' : 'Payment recorded',
        description: `Receipt ${receiptNum} created`,
      });
      onOpenChange(false);
      onRecorded();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to record payment';
      toast({ variant: 'destructive', title: 'Error', description: message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IndianRupee className="w-5 h-5 text-primary" />
            Record Payment — {invoiceNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground text-xs">Grand Total</p>
              <p className="font-semibold">₹ {grandTotal.toFixed(2)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground text-xs">Balance Due</p>
              <p className="font-semibold text-amber-600">₹ {balance.toFixed(2)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Payment Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(date, 'dd MMM yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Amount Received (₹)</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-2">
            <Label>Payment Mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button className="btn-gold" onClick={handleConfirm} disabled={saving}>
            {saving ? 'Saving...' : 'Confirm Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
