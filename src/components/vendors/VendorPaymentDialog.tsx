import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Vendor, VendorPaymentFormData } from '@/hooks/useVendors';

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'];

interface VendorPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor: Vendor | null;
  onSubmit: (vendorId: string, data: VendorPaymentFormData) => Promise<boolean>;
}

export function VendorPaymentDialog({ open, onOpenChange, vendor, onSubmit }: VendorPaymentDialogProps) {
  const [formData, setFormData] = useState<VendorPaymentFormData>({
    amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'Cash',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendor || formData.amount <= 0) return;
    setIsSubmitting(true);
    const success = await onSubmit(vendor.id, formData);
    setIsSubmitting(false);
    if (success) {
      setFormData({
        amount: 0,
        payment_date: new Date().toISOString().split('T')[0],
        payment_mode: 'Cash',
        notes: '',
      });
      onOpenChange(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment — {vendor?.name}</DialogTitle>
        </DialogHeader>

        {vendor && (
          <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-muted/50 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Total Purchases</p>
              <p className="font-medium">{formatCurrency(vendor.total_purchases)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Total Paid</p>
              <p className="font-medium">{formatCurrency(vendor.total_paid)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Outstanding</p>
              <p className="font-medium text-destructive">{formatCurrency(vendor.outstanding_balance)}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pay-amount">Amount (₹) *</Label>
              <Input
                id="pay-amount"
                type="number"
                min={1}
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-date">Date *</Label>
              <Input
                id="pay-date"
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Payment Mode</Label>
            <Select value={formData.payment_mode} onValueChange={(v) => setFormData({ ...formData, payment_mode: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_MODES.map((mode) => (
                  <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pay-notes">Notes</Label>
            <Textarea
              id="pay-notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Payment reference, receipt no, etc."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="btn-gold" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Record Payment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
