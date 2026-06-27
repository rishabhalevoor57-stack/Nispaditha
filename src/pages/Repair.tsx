import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Wrench, Search, ArrowRightCircle, Trash2, Flame } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAuth } from '@/contexts/AuthContext';
import { useActivityLogger } from '@/hooks/useActivityLog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface RepairItem {
  id: string;
  product_id: string | null;
  sku: string | null;
  product_name: string;
  weight_grams: number;
  quantity: number;
  original_invoice_id: string | null;
  original_invoice_number: string | null;
  client_name: string | null;
  client_phone: string | null;
  source: string;
  source_reference_id: string | null;
  status: 'in_repair' | 'sent_to_inventory';
  date_sent: string;
  date_resolved: string | null;
  notes: string | null;
}

export default function Repair() {
  const [items, setItems] = useState<RepairItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_repair' | 'sent_to_inventory'>('in_repair');
  const [confirmSend, setConfirmSend] = useState<RepairItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<RepairItem | null>(null);
  const isAdmin = useIsAdmin();
  const { user } = useAuth();
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('repair_items')
      .select('*')
      .order('date_sent', { ascending: false });
    if (error) toast({ variant: 'destructive', title: 'Error', description: error.message });
    setItems((data as RepairItem[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const sendToInventory = async (item: RepairItem) => {
    try {
      const qty = item.quantity || 1;
      if (item.product_id) {
        const { data: p } = await supabase
          .from('products')
          .select('quantity')
          .eq('id', item.product_id)
          .maybeSingle();
        if (p) {
          await supabase
            .from('products')
            .update({ quantity: (p.quantity || 0) + qty })
            .eq('id', item.product_id);
          await supabase.from('stock_history').insert([{
            product_id: item.product_id,
            quantity_change: qty,
            type: 'in',
            reason: `Returned from repair (${item.sku || item.product_name})`,
            reference_id: item.id,
            created_by: user?.id,
          }]);
        }
      } else if (item.sku) {
        // try matching by SKU
        const { data: p } = await supabase
          .from('products')
          .select('id, quantity')
          .eq('sku', item.sku)
          .is('deleted_at', null)
          .maybeSingle();
        if (p) {
          await supabase
            .from('products')
            .update({ quantity: (p.quantity || 0) + qty })
            .eq('id', p.id);
          await supabase.from('stock_history').insert([{
            product_id: p.id,
            quantity_change: qty,
            type: 'in',
            reason: `Returned from repair (${item.sku})`,
            reference_id: item.id,
            created_by: user?.id,
          }]);
        }
      }
      await supabase
        .from('repair_items')
        .update({ status: 'sent_to_inventory', date_resolved: new Date().toISOString() })
        .eq('id', item.id);
      logActivity({
        module: 'inventory',
        action: 'update',
        recordId: item.id,
        recordLabel: item.sku || item.product_name,
        newValue: { from: 'repair', action: 'sent_to_inventory', qty },
      });
      toast({ title: 'Item returned to inventory' });
      load();
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'Failed', description: e instanceof Error ? e.message : 'Error' });
    } finally {
      setConfirmSend(null);
    }
  };

  const deleteItem = async (item: RepairItem) => {
    await supabase.from('repair_items').delete().eq('id', item.id);
    toast({ title: 'Repair entry removed' });
    setConfirmDelete(null);
    load();
  };

  const filtered = items.filter((i) => {
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      (i.product_name || '').toLowerCase().includes(q) ||
      (i.sku || '').toLowerCase().includes(q) ||
      (i.original_invoice_number || '').toLowerCase().includes(q) ||
      (i.client_name || '').toLowerCase().includes(q)
    );
  });

  const counts = {
    all: items.length,
    in_repair: items.filter((i) => i.status === 'in_repair').length,
    sent_to_inventory: items.filter((i) => i.status === 'sent_to_inventory').length,
  };

  const columns = [
    {
      key: 'date_sent',
      header: 'Date Sent',
      cell: (i: RepairItem) => format(new Date(i.date_sent), 'dd MMM yyyy'),
    },
    { key: 'product_name', header: 'Product' },
    {
      key: 'sku',
      header: 'SKU',
      cell: (i: RepairItem) => <span className="font-mono text-xs">{i.sku || '-'}</span>,
    },
    {
      key: 'weight_grams',
      header: 'Weight (g)',
      cell: (i: RepairItem) => Number(i.weight_grams).toFixed(3),
    },
    {
      key: 'quantity',
      header: 'Qty',
      cell: (i: RepairItem) => i.quantity,
    },
    {
      key: 'original_invoice_number',
      header: 'Invoice #',
      cell: (i: RepairItem) => i.original_invoice_number || '-',
    },
    {
      key: 'client_name',
      header: 'Client',
      cell: (i: RepairItem) => i.client_name || 'Walk-in',
    },
    {
      key: 'source',
      header: 'Source',
      cell: (i: RepairItem) => <Badge variant="outline" className="capitalize">{i.source}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (i: RepairItem) =>
        i.status === 'in_repair' ? (
          <Badge variant="secondary">In Repair</Badge>
        ) : (
          <Badge variant="default">Sent to Inventory</Badge>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (i: RepairItem) => (
        <div className="flex gap-1">
          {i.status === 'in_repair' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmSend(i)}
              title="Send to Inventory"
            >
              <ArrowRightCircle className="w-3 h-3 mr-1" />
              To Inventory
            </Button>
          )}
          {isAdmin && (
            <Button
              size="icon"
              variant="ghost"
              className="text-destructive"
              onClick={() => setConfirmDelete(i)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Repair"
        description="Items sent to repair from Returns, Exchanges, or Buybacks"
      />

      <div className="flex gap-2 mb-4">
        {(['in_repair', 'sent_to_inventory', 'all'] as const).map((k) => (
          <Button
            key={k}
            size="sm"
            variant={statusFilter === k ? 'default' : 'outline'}
            onClick={() => setStatusFilter(k)}
          >
            {k === 'in_repair' ? 'In Repair' : k === 'sent_to_inventory' ? 'Completed' : 'All'}
            <span className="ml-1.5 text-xs opacity-70">({counts[k]})</span>
          </Button>
        ))}
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by product, SKU, invoice, or client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 max-w-md"
        />
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        isLoading={loading}
        emptyMessage="No repair items."
      />

      <AlertDialog open={!!confirmSend} onOpenChange={(o) => !o && setConfirmSend(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send to inventory?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium">{confirmSend?.product_name}</span> ({confirmSend?.sku || 'no SKU'}) — qty {confirmSend?.quantity} —
              will be added back to inventory stock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmSend && sendToInventory(confirmSend)}>
              <Wrench className="w-4 h-4 mr-2" /> Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete repair entry?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. Inventory will not be touched.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && deleteItem(confirmDelete)}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
