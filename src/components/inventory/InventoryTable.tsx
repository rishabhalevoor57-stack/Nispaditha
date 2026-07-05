import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Edit, Trash2, Eye, Package, Coins, Wrench, Truck } from 'lucide-react';
import { BranchTransferDialog } from './BranchTransferDialog';
import { Product, STATUS_OPTIONS } from '@/types/inventory';
import { supabase } from '@/integrations/supabase/client';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogger } from '@/hooks/useActivityLog';

interface InventoryTableProps {
  products: Product[];
  isLoading: boolean;
  onView: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

export function InventoryTable({
  products,
  isLoading,
  onView,
  onEdit,
  onDelete,
}: InventoryTableProps) {
  const isAdmin = useIsAdmin();
  const { user } = useAuth();
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const [silverRate, setSilverRate] = useState<number>(0);
  const [repairProduct, setRepairProduct] = useState<Product | null>(null);
  const [repairQty, setRepairQty] = useState<number>(1);
  const [repairNotes, setRepairNotes] = useState<string>('');
  const [repairSubmitting, setRepairSubmitting] = useState(false);
  const [transferProduct, setTransferProduct] = useState<Product | null>(null);

  const openRepair = (p: Product) => {
    setRepairProduct(p);
    setRepairQty(1);
    setRepairNotes('');
  };

  const submitRepair = async () => {
    if (!repairProduct) return;
    const qty = Math.max(1, Math.floor(Number(repairQty) || 0));
    if (qty > (repairProduct.quantity || 0)) {
      toast({ variant: 'destructive', title: 'Invalid quantity', description: `Only ${repairProduct.quantity} in stock.` });
      return;
    }
    setRepairSubmitting(true);
    try {
      const { error: insErr } = await supabase.from('repair_items').insert([{
        product_id: repairProduct.id,
        sku: repairProduct.sku,
        product_name: repairProduct.name,
        weight_grams: repairProduct.weight_grams,
        quantity: qty,
        source: 'inventory',
        source_type: 'inventory',
        source_ref_id: repairProduct.id,
        status: 'in_repair',
        date_sent: new Date().toISOString(),
        notes: repairNotes || null,
        created_by: user?.id,
      }]);
      if (insErr) throw insErr;

      const newQty = Math.max(0, (repairProduct.quantity || 0) - qty);
      const { error: updErr } = await supabase
        .from('products')
        .update({ quantity: newQty })
        .eq('id', repairProduct.id);
      if (updErr) throw updErr;

      await supabase.from('stock_history').insert([{
        product_id: repairProduct.id,
        quantity_change: -qty,
        type: 'out',
        reason: `Sent to repair (${repairProduct.sku})${repairNotes ? ` — ${repairNotes}` : ''}`,
        reference_id: repairProduct.id,
        created_by: user?.id,
      }]);

      logActivity({
        module: 'inventory',
        action: 'update',
        recordId: repairProduct.id,
        recordLabel: repairProduct.sku || repairProduct.name,
        newValue: { action: 'sent_to_repair', qty, notes: repairNotes },
      });

      toast({ title: 'Sent to Repair', description: `${qty} × ${repairProduct.name} moved to Repair.` });
      setRepairProduct(null);
      // refresh list
      window.dispatchEvent(new Event('inventory:refresh'));
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'Failed', description: e instanceof Error ? e.message : 'Error' });
    } finally {
      setRepairSubmitting(false);
    }
  };

  useEffect(() => {
    fetchSilverRate();
  }, []);

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string, quantity: number, lowStockAlert: number) => {
    const opt = STATUS_OPTIONS.find(o => o.value === status);
    
    if (status === 'in_stock' && quantity <= lowStockAlert) {
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
          Low Stock
        </Badge>
      );
    }
    
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-12 text-xs font-semibold uppercase">SL</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Image</TableHead>
              <TableHead className="text-xs font-semibold uppercase">SKU</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Description</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Type</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Category</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-right">Weight</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-right">Qty</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-center">Mode</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-right">Selling Price</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Status</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Vendor</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="h-32 text-center text-muted-foreground">
                  No products found. Add your first product to get started.
                </TableCell>
              </TableRow>
            ) : (
              products.map((product, index) => (
                <TableRow 
                  key={product.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onView(product)}
                >
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        className="w-10 h-10 object-cover rounded"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                        <Package className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      {product.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {product.type_of_work}
                    </Badge>
                  </TableCell>
                  <TableCell>{product.categories?.name || '-'}</TableCell>
                  <TableCell className="text-right">{product.weight_grams}g</TableCell>
                  <TableCell className="text-right font-medium">
                    {product.quantity}
                    {(() => {
                      const catName = product.categories?.name?.toLowerCase() || '';
                      if (catName.includes('bangle')) return <span className="text-muted-foreground text-xs ml-1">, Pair</span>;
                      if (catName.includes('bead')) return <span className="text-muted-foreground text-xs ml-1">, Strings</span>;
                      return null;
                    })()}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={product.pricing_mode === 'flat_price' ? 'secondary' : 'outline'} className="text-xs">
                      {product.pricing_mode === 'flat_price' ? 'Flat' : 'Weight'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="space-y-1">
                      <p className="font-medium">{formatCurrency(product.selling_price)}</p>
                      {product.pricing_mode === 'weight_based' && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 text-xs text-primary cursor-help">
                                <Coins className="w-3 h-3" />
                                {formatCurrency(silverRate)}/g
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Current Silver Rate Applied</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(product.status, product.quantity, product.low_stock_alert)}
                  </TableCell>
                  <TableCell className="text-sm">{product.suppliers?.name || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); onView(product); }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); onEdit(product); }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      {product.quantity > 0 && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); openRepair(product); }}
                                className="text-warning hover:text-warning"
                              >
                                <Wrench className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Send to Repair</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {product.quantity > 0 && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); setTransferProduct(product); }}
                                className="text-primary hover:text-primary"
                              >
                                <Truck className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Send to Branch</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {isAdmin && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); onDelete(product); }}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!repairProduct} onOpenChange={(o) => !o && setRepairProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send to Repair</DialogTitle>
            <DialogDescription>
              Move stock from inventory to the Repair queue. Stock will be deducted and can be returned via the Repair page.
            </DialogDescription>
          </DialogHeader>
          {repairProduct && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="font-medium">{repairProduct.name}</div>
                <div className="text-xs text-muted-foreground font-mono">{repairProduct.sku}</div>
                <div className="text-xs text-muted-foreground mt-1">In stock: {repairProduct.quantity}</div>
              </div>
              <div className="space-y-2">
                <Label>Quantity to send</Label>
                <Input
                  type="number"
                  min={1}
                  max={repairProduct.quantity}
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
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepairProduct(null)} disabled={repairSubmitting}>Cancel</Button>
            <Button onClick={submitRepair} disabled={repairSubmitting}>
              <Wrench className="w-4 h-4 mr-2" />
              {repairSubmitting ? 'Sending...' : 'Send to Repair'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BranchTransferDialog
        open={!!transferProduct}
        onOpenChange={(o) => !o && setTransferProduct(null)}
        product={transferProduct}
        onTransferred={() => setTransferProduct(null)}
      />
    </div>
  );
}
