import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useBranch } from '@/contexts/BranchContext';
import { Send } from 'lucide-react';
import type { Product } from '@/types/inventory';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onTransferred?: () => void;
}

export function BranchTransferDialog({ open, onOpenChange, product, onTransferred }: Props) {
  const { toast } = useToast();
  const { branches, defaultBranch } = useBranch();
  const [toBranchId, setToBranchId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [transferDate, setTransferDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const sourceBranchId = product?.branch_id || defaultBranch?.id || null;
  const eligibleBranches = branches.filter(
    (b) => b.status === 'active' && b.id !== sourceBranchId
  );

  useEffect(() => {
    if (open) {
      setToBranchId('');
      setQuantity(1);
      setTransferDate(new Date().toISOString().slice(0, 10));
      setRemarks('');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!product || !toBranchId) {
      toast({ variant: 'destructive', title: 'Missing information', description: 'Please choose a destination branch.' });
      return;
    }
    if (quantity < 1 || quantity > product.quantity) {
      toast({ variant: 'destructive', title: 'Invalid quantity', description: `Available: ${product.quantity}` });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('transfer_product_to_branch' as any, {
        p_product_id: product.id,
        p_to_branch_id: toBranchId,
        p_quantity: quantity,
        p_transfer_date: new Date(transferDate).toISOString(),
        p_remarks: remarks || null,
      });
      if (error) throw error;
      toast({ title: 'Stock transferred', description: `${quantity} × ${product.name} moved to destination branch.` });
      onOpenChange(false);
      onTransferred?.();
      window.dispatchEvent(new Event('inventory:refresh'));
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Transfer failed', description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send to Branch</DialogTitle>
          <DialogDescription>
            Transfer stock to another branch. If the SKU already exists at the destination its quantity is topped up; otherwise a matching product is created.
          </DialogDescription>
        </DialogHeader>
        {product && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="font-medium">{product.name}</div>
              <div className="text-xs text-muted-foreground font-mono">{product.sku}</div>
              <div className="text-xs text-muted-foreground mt-1">Available at source: {product.quantity}</div>
            </div>

            <div className="space-y-2">
              <Label>Destination Branch *</Label>
              <Select value={toBranchId} onValueChange={setToBranchId}>
                <SelectTrigger><SelectValue placeholder="Choose a branch..." /></SelectTrigger>
                <SelectContent>
                  {eligibleBranches.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No other active branches</div>
                  )}
                  {eligibleBranches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Transfer Quantity *</Label>
                <Input
                  type="number"
                  min={1}
                  max={product.quantity}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Transfer Date</Label>
                <Input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                placeholder="Reason for transfer, courier, batch notes..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !toBranchId}>
            <Send className="w-4 h-4 mr-2" />
            {submitting ? 'Transferring...' : 'Confirm Transfer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
