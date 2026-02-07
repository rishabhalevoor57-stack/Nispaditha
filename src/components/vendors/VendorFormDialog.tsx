import { useState, useEffect } from 'react';
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
import type { Vendor, VendorFormData } from '@/hooks/useVendors';
import { initialVendorForm } from '@/hooks/useVendors';

interface VendorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor?: Vendor | null;
  onSubmit: (data: VendorFormData) => Promise<boolean>;
}

export function VendorFormDialog({ open, onOpenChange, vendor, onSubmit }: VendorFormDialogProps) {
  const [formData, setFormData] = useState<VendorFormData>(initialVendorForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (vendor) {
      setFormData({
        vendor_code: vendor.vendor_code || '',
        name: vendor.name,
        phone: vendor.phone || '',
        address: vendor.address || '',
        notes: vendor.notes || '',
      });
    } else {
      setFormData(initialVendorForm);
    }
  }, [vendor, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const success = await onSubmit(formData);
    setIsSubmitting(false);
    if (success) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{vendor ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendor-code">Vendor Code</Label>
              <Input
                id="vendor-code"
                value={formData.vendor_code}
                onChange={(e) => setFormData({ ...formData, vendor_code: e.target.value })}
                placeholder="Auto-generated if empty"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-name">Vendor Name *</Label>
              <Input
                id="vendor-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor-phone">Phone</Label>
            <Input
              id="vendor-phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor-address">Address</Label>
            <Textarea
              id="vendor-address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor-notes">Notes</Label>
            <Textarea
              id="vendor-notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Any additional notes..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="btn-gold" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : vendor ? 'Update Vendor' : 'Add Vendor'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
