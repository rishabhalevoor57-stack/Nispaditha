import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useCustomOrderPayments, type PaymentMode } from '@/hooks/useCustomOrderPayments';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  customOrderId: string;
  orderReference: string;
  balanceRemaining: number;
}

const MODES: { value: PaymentMode; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'store_credit', label: 'Store Credits' },
  { value: 'multiple', label: 'Multiple Modes' },
];

export const CustomOrderPaymentDialog = ({ open, onOpenChange, customOrderId, orderReference, balanceRemaining }: Props) => {
  const [amount, setAmount] = useState<number>(0);
  const [mode, setMode] = useState<PaymentMode>('cash');
  const [date, setDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState('');
  const { addPayment } = useCustomOrderPayments(customOrderId);

  const handleSave = async () => {
    if (!amount || amount <= 0) return;
    await addPayment.mutateAsync({
      custom_order_id: customOrderId,
      amount,
      payment_mode: mode,
      payment_date: format(date, 'yyyy-MM-dd'),
      notes: notes || null,
    });
    setAmount(0); setMode('cash'); setDate(new Date()); setNotes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Advance Payment — {orderReference}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md bg-muted px-3 py-2 text-sm">
            Balance Remaining: <span className="font-semibold">₹{balanceRemaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Advance Amount</Label>
            <div className="relative">
              <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="number" min="0" step="0.01" className="pl-8" value={amount || ''} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} placeholder="0.00" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Payment Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as PaymentMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Payment Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" /> {format(date, 'dd/MM/yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Paid during booking" className="min-h-[70px]" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!amount || amount <= 0 || addPayment.isPending}>
            {addPayment.isPending ? 'Saving...' : 'Save Advance'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
