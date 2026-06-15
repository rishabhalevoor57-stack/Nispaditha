import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Edit, Trash2, Package, Coins, Wrench, History, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { Product, STATUS_OPTIONS } from '@/types/inventory';
import { supabase } from '@/integrations/supabase/client';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/useActivityLog';
import { format } from 'date-fns';

interface ProductDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onEdit: () => void;
  onDelete: () => void;
}

export function ProductDetailDialog({
  open,
  onOpenChange,
  product,
  onEdit,
  onDelete,
}: ProductDetailDialogProps) {
  const isAdmin = useIsAdmin();
  const { user } = useAuth();
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const [silverRate, setSilverRate] = useState<number>(0);
  const [history, setHistory] = useState<Array<{ id: string; created_at: string; quantity_change: number; type: string; reason: string | null }>>([]);
  const [repairOpen, setRepairOpen] = useState(false);
  const [repairQty, setRepairQty] = useState<number>(1);
  const [repairNotes, setRepairNotes] = useState('');
  const [repairSubmitting, setRepairSubmitting] = useState(false);

  useEffect(() => {
    if (open && product) {
      fetchSilverRate();
      fetchHistory(product.id);
    }
  }, [open, product?.id]);

  const fetchSilverRate = async () => {
    const { data } = await supabase
      .from('business_settings')
      .select('silver_rate_per_gram')
      .limit(1)
      .single();
    
    if (data) {
      setSilverRate(data.silver_rate_per_gram);
    }
  };

  const fetchHistory = async (productId: string) => {
    const { data } = await supabase
      .from('stock_history')
      .select('id, created_at, quantity_change, type, reason')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(15);
    setHistory(data || []);
  };

  const submitRepair = async () => {
    if (!product) return;
    const qty = Math.max(1, Math.floor(Number(repairQty) || 0));
    if (qty > (product.quantity || 0)) {
      toast({ variant: 'destructive', title: 'Invalid quantity', description: `Only ${product.quantity} in stock.` });
      return;
    }
    setRepairSubmitting(true);
    try {
      const { error: insErr } = await supabase.from('repair_items').insert([{
        product_id: product.id,
        sku: product.sku,
        product_name: product.name,
        weight_grams: product.weight_grams,
        quantity: qty,
        source: 'inventory',
        source_type: 'inventory',
        source_ref_id: product.id,
        status: 'in_repair',
        date_sent: new Date().toISOString(),
        notes: repairNotes || null,
        created_by: user?.id,
      }]);
      if (insErr) throw insErr;
      const newQty = Math.max(0, (product.quantity || 0) - qty);
      const { error: updErr } = await supabase.from('products').update({ quantity: newQty }).eq('id', product.id);
      if (updErr) throw updErr;
      await supabase.from('stock_history').insert([{
        product_id: product.id,
        quantity_change: -qty,
        type: 'out',
        reason: `Sent to repair${repairNotes ? ` — ${repairNotes}` : ''}`,
        reference_id: product.id,
        created_by: user?.id,
      }]);
      logActivity({
        module: 'inventory',
        action: 'update',
        recordId: product.id,
        recordLabel: product.sku || product.name,
        newValue: { action: 'sent_to_repair', qty, notes: repairNotes },
      });
      toast({ title: 'Sent to Repair', description: `${qty} × ${product.name} moved to Repair.` });
      setRepairOpen(false);
      setRepairQty(1);
      setRepairNotes('');
      window.dispatchEvent(new Event('inventory:refresh'));
      onOpenChange(false);
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'Failed', description: e instanceof Error ? e.message : 'Error' });
    } finally {
      setRepairSubmitting(false);
    }
  };

  if (!product) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const opt = STATUS_OPTIONS.find(o => o.value === status);
    const variants: Record<string, string> = {
      in_stock: 'bg-success/10 text-success border-success/20',
      sold: 'bg-muted text-muted-foreground',
      for_repair: 'bg-warning/10 text-warning border-warning/20',
    };
    return (
      <Badge variant="outline" className={variants[status] || ''}>
        {opt?.label || status}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Package className="w-5 h-5" />
            Product Details
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 mt-4">
          {/* Image & Basic Info */}
          <div className="flex gap-6">
            {product.image_url ? (
              <img 
                src={product.image_url} 
                alt={product.name}
                className="w-32 h-32 object-cover rounded-lg border"
              />
            ) : (
              <div className="w-32 h-32 bg-muted rounded-lg flex items-center justify-center">
                <Package className="w-12 h-12 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold">{product.name}</h3>
                  <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
                </div>
                {getStatusBadge(product.status)}
              </div>
              {product.description && (
                <p className="text-sm text-muted-foreground mt-2">{product.description}</p>
              )}
              <div className="flex items-center gap-4 mt-3">
                <Badge variant="outline">{product.type_of_work}</Badge>
                {product.categories?.name && (
                  <Badge variant="secondary">{product.categories.name}</Badge>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <DetailItem label="Pricing Mode" value={product.pricing_mode === 'flat_price' ? 'Flat Price' : 'Weight Based'} />
            {product.pricing_mode === 'weight_based' && (
              <>
                <DetailItem label="Metal Type" value="Silver" />
                <DetailItem label="Purity" value={product.purity || '-'} />
                <DetailItem label="Weight" value={`${product.weight_grams}g`} />
              </>
            )}
            <DetailItem label="Quantity" value={product.quantity.toString()} />
            <DetailItem label="Low Stock Alert" value={product.low_stock_alert.toString()} />
            {product.bangle_size && (
              <DetailItem label="Bangle Size" value={product.bangle_size} />
            )}
            <DetailItem 
              label="Date Ordered" 
              value={product.date_ordered ? format(new Date(product.date_ordered), 'dd MMM yyyy') : '-'} 
            />
            <DetailItem label="Vendor" value={product.suppliers?.name || '-'} />
          </div>

          <Separator />

          {/* Current Rate Applied - only for weight based */}
          {product.pricing_mode === 'weight_based' && (
            <Alert className="border-primary/20 bg-primary/5">
              <Coins className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm">
                <span className="font-medium">Current Silver Rate Applied: </span>
                {formatCurrency(silverRate)} per gram
              </AlertDescription>
            </Alert>
          )}

          {/* Pricing */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {product.pricing_mode === 'weight_based' && (
              <>
                <DetailItem label="Price Per Gram" value={formatCurrency(product.price_per_gram)} />
                <DetailItem label="MC Per Gram" value={`${formatCurrency(product.making_charges)}/g`} />
              </>
            )}
            <DetailItem label="MRP" value={formatCurrency(product.mrp)} />
            <DetailItem label="Selling Price" value={formatCurrency(product.selling_price)} highlight />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <DetailItem label="Purchase Price" value={formatCurrency(product.purchase_price)} />
            <DetailItem label="GST" value={`${product.gst_percentage}%`} />
          </div>

          <Separator />

          {/* Stock movement history */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <History className="w-4 h-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">Recent Stock Movements</h4>
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground">No movements recorded for this item.</p>
            ) : (
              <div className="rounded-lg border divide-y max-h-56 overflow-y-auto">
                {history.map((h) => (
                  <div key={h.id} className="flex items-start gap-3 p-2 text-xs">
                    {h.quantity_change >= 0 ? (
                      <ArrowUpCircle className="w-4 h-4 text-success mt-0.5 shrink-0" />
                    ) : (
                      <ArrowDownCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-medium ${h.quantity_change >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {h.quantity_change > 0 ? '+' : ''}{h.quantity_change}
                        </span>
                        <span className="text-muted-foreground">{format(new Date(h.created_at), 'dd MMM yyyy, HH:mm')}</span>
                      </div>
                      <p className="text-muted-foreground truncate">{h.reason || h.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setRepairOpen(true)}
              disabled={!product.quantity || product.quantity <= 0}
              className="text-warning border-warning/40 hover:bg-warning/10"
            >
              <Wrench className="w-4 h-4 mr-2" />
              Send to Repair
            </Button>
            {isAdmin && (
              <Button variant="outline" onClick={onDelete} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
            <Button onClick={onEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Product
            </Button>
          </div>
        </div>
      </DialogContent>

      <Dialog open={repairOpen} onOpenChange={setRepairOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send to Repair</DialogTitle>
            <DialogDescription>
              Move stock from inventory to the Repair queue. Stock will be deducted and can be returned later from the Repair page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="font-medium">{product.name}</div>
              <div className="text-xs text-muted-foreground font-mono">{product.sku}</div>
              <div className="text-xs text-muted-foreground mt-1">In stock: {product.quantity}</div>
            </div>
            <div className="space-y-2">
              <Label>Quantity to send</Label>
              <Input
                type="number"
                min={1}
                max={product.quantity}
                value={repairQty}
                onChange={(e) => setRepairQty(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Reason for repair / damage details..."
                value={repairNotes}
                onChange={(e) => setRepairNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepairOpen(false)} disabled={repairSubmitting}>Cancel</Button>
            <Button onClick={submitRepair} disabled={repairSubmitting}>
              <Wrench className="w-4 h-4 mr-2" />
              {repairSubmitting ? 'Sending...' : 'Send to Repair'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function DetailItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${highlight ? 'text-primary' : ''}`}>{value}</p>
    </div>
  );
}
