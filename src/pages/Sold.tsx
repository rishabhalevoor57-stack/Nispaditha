import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Trash2, ShoppingBag, EyeOff } from 'lucide-react';
import { useIsAdmin } from '@/hooks/useIsAdmin';

type Source = 'invoice' | 'custom_order' | 'manual';

interface SoldRow {
  id: string;
  date: string;
  product_name: string;
  sku: string | null;
  qty: number;
  weight: number;
  total: number;
  client_name: string | null;
  source: Source;
  source_ref?: string | null;
  manual_id?: string;
  entry_key: string; // for hidden_sold_entries
  source_key: Source;
}

interface ProductLite {
  id: string;
  sku: string;
  name: string;
  weight_grams: number;
  selling_price: number;
  quantity: number;
}

const sourceLabel: Record<Source, string> = {
  invoice: 'Invoice',
  custom_order: 'Custom Order',
  manual: 'Manual',
};

const sourceColor: Record<Source, string> = {
  invoice: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  custom_order: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
  manual: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
};

export default function Sold() {
  const [rows, setRows] = useState<SoldRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selected, setSelected] = useState<ProductLite | null>(null);
  const [form, setForm] = useState({
    sold_date: new Date().toISOString().slice(0, 10),
    product_name: '',
    sku: '',
    quantity: 1,
    weight_grams: 0,
    total: 0,
    client_name: '',
    notes: '',
  });
  const isAdmin = useIsAdmin();
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    const all: SoldRow[] = [];

    // 1. Completed invoices (paid status)
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, invoice_date, payment_status, status, client_id, clients(name)')
      .in('payment_status', ['paid', 'partial'])
      .order('invoice_date', { ascending: false });

    const invoiceIds = (invoices || []).map((i: any) => i.id);
    if (invoiceIds.length > 0) {
      const { data: items } = await supabase
        .from('invoice_items')
        .select('id, invoice_id, product_name, weight_grams, quantity, total')
        .in('invoice_id', invoiceIds);

      const skuMap: Record<string, string> = {};
      const itemsWithProduct = await supabase
        .from('invoice_items')
        .select('id, product_id')
        .in('invoice_id', invoiceIds);
      const productIds = (itemsWithProduct.data || []).map((i: any) => i.product_id).filter(Boolean);
      if (productIds.length) {
        const { data: prods } = await supabase
          .from('products')
          .select('id, sku')
          .in('id', productIds);
        (prods || []).forEach((p: any) => { skuMap[p.id] = p.sku; });
      }
      const itemPid: Record<string, string> = {};
      (itemsWithProduct.data || []).forEach((i: any) => { if (i.product_id) itemPid[i.id] = i.product_id; });

      (items || []).forEach((it: any) => {
        const inv = (invoices || []).find((i: any) => i.id === it.invoice_id);
        all.push({
          id: `inv-${it.id}`,
          date: inv?.invoice_date || '',
          product_name: it.product_name,
          sku: itemPid[it.id] ? skuMap[itemPid[it.id]] || null : null,
          qty: it.quantity,
          weight: Number(it.weight_grams) || 0,
          total: Number(it.total) || 0,
          client_name: inv?.clients?.name || null,
          source: 'invoice',
          source_ref: inv?.invoice_number,
        });
      });
    }

    // 2. Completed custom orders (delivered or released)
    const { data: cOrders } = await supabase
      .from('custom_orders')
      .select('id, reference_number, order_date, status, client_name')
      .in('status', ['delivered', 'released'])
      .order('order_date', { ascending: false });
    const cIds = (cOrders || []).map((c: any) => c.id);
    if (cIds.length) {
      const { data: cItems } = await supabase
        .from('custom_order_items')
        .select('id, custom_order_id, item_description, sku, quantity, expected_weight, item_total')
        .in('custom_order_id', cIds);
      (cItems || []).forEach((it: any) => {
        const co = (cOrders || []).find((c: any) => c.id === it.custom_order_id);
        all.push({
          id: `co-${it.id}`,
          date: co?.order_date || '',
          product_name: it.item_description,
          sku: it.sku,
          qty: it.quantity,
          weight: Number(it.expected_weight) || 0,
          total: Number(it.item_total) || 0,
          client_name: co?.client_name || null,
          source: 'custom_order',
          source_ref: co?.reference_number,
        });
      });
    }

    // 3. Manual sold items
    const { data: manual } = await supabase
      .from('manual_sold_items' as any)
      .select('*')
      .order('sold_date', { ascending: false });
    (manual || []).forEach((m: any) => {
      all.push({
        id: `man-${m.id}`,
        manual_id: m.id,
        date: m.sold_date,
        product_name: m.product_name,
        sku: m.sku,
        qty: m.quantity,
        weight: Number(m.weight_grams) || 0,
        total: Number(m.total) || 0,
        client_name: m.client_name,
        source: 'manual',
      });
    });

    all.sort((a, b) => (a.date < b.date ? 1 : -1));
    setRows(all);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!dialogOpen) return;
    (async () => {
      const { data } = await supabase
        .from('products')
        .select('id, sku, name, weight_grams, selling_price, quantity')
        .is('deleted_at', null)
        .order('name')
        .limit(200);
      setProducts((data || []) as ProductLite[]);
    })();
  }, [dialogOpen]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    const q = productSearch.toLowerCase();
    return products
      .filter((p) => p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
      .slice(0, 12);
  }, [productSearch, products]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.product_name.toLowerCase().includes(q) ||
        (r.sku || '').toLowerCase().includes(q) ||
        (r.client_name || '').toLowerCase().includes(q) ||
        (r.source_ref || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.qty += r.qty;
        acc.weight += r.weight;
        acc.total += r.total;
        return acc;
      },
      { qty: 0, weight: 0, total: 0 }
    );
  }, [filtered]);

  const resetForm = () => {
    setSelected(null);
    setProductSearch('');
    setForm({
      sold_date: new Date().toISOString().slice(0, 10),
      product_name: '',
      sku: '',
      quantity: 1,
      weight_grams: 0,
      total: 0,
      client_name: '',
      notes: '',
    });
  };

  const pickProduct = (p: ProductLite) => {
    setSelected(p);
    setProductSearch('');
    setForm((f) => ({
      ...f,
      product_name: p.name,
      sku: p.sku,
      weight_grams: p.weight_grams || 0,
      total: p.selling_price || 0,
    }));
  };

  const handleAdd = async () => {
    if (!form.product_name.trim()) {
      toast({ title: 'Product name required', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('manual_sold_items' as any).insert({
      sold_date: form.sold_date,
      product_id: selected?.id || null,
      product_name: form.product_name,
      sku: form.sku || null,
      quantity: form.quantity,
      weight_grams: form.weight_grams,
      total: form.total,
      client_name: form.client_name || null,
      notes: form.notes || null,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Sold entry added', description: selected ? 'Inventory stock reduced' : undefined });
    setDialogOpen(false);
    resetForm();
    fetchData();
  };

  const handleDelete = async (manualId: string) => {
    if (!isAdmin) {
      toast({ title: 'Admin only', variant: 'destructive' });
      return;
    }
    if (!confirm('Delete this sold entry? This will NOT affect inventory or financials.')) return;
    const { error } = await supabase.from('manual_sold_items' as any).delete().eq('id', manualId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Sold entry removed' });
    fetchData();
  };

  return (
    <AppLayout>
      <PageHeader
        title="Sold"
        description="Live ledger of every sold item across invoices, custom orders, and manual entries"
        actions={
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" /> Add Sold Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Sold Item</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Search Inventory (optional)</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      placeholder="Search SKU or name..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                    />
                  </div>
                  {filteredProducts.length > 0 && (
                    <div className="border rounded-md mt-1 max-h-48 overflow-auto">
                      {filteredProducts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => pickProduct(p)}
                          className="w-full text-left px-3 py-2 hover:bg-accent border-b last:border-0"
                        >
                          <div className="font-mono text-xs text-primary">{p.sku}</div>
                          <div className="text-sm">{p.name}</div>
                          <div className="text-xs text-muted-foreground">Stock: {p.quantity} • ₹{p.selling_price}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {selected && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Linked to <span className="font-mono">{selected.sku}</span> — stock will reduce on save
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Date</Label>
                    <Input type="date" value={form.sold_date} onChange={(e) => setForm({ ...form, sold_date: e.target.value })} />
                  </div>
                  <div>
                    <Label>SKU</Label>
                    <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
                  </div>
                </div>

                <div>
                  <Label>Product Name *</Label>
                  <Input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Qty</Label>
                    <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })} />
                  </div>
                  <div>
                    <Label>Weight (g)</Label>
                    <Input type="number" step="0.01" value={form.weight_grams} onChange={(e) => setForm({ ...form, weight_grams: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label>Total ₹</Label>
                    <Input type="number" step="0.01" value={form.total} onChange={(e) => setForm({ ...form, total: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>

                <div>
                  <Label>Client Name</Label>
                  <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAdd}>Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border p-4 bg-card shadow-card">
          <div className="text-xs text-muted-foreground uppercase">Total Items Sold</div>
          <div className="text-2xl font-bold mt-1">{totals.qty}</div>
        </div>
        <div className="rounded-xl border p-4 bg-card shadow-card">
          <div className="text-xs text-muted-foreground uppercase">Total Weight</div>
          <div className="text-2xl font-bold mt-1">{totals.weight.toFixed(2)} g</div>
        </div>
        <div className="rounded-xl border p-4 bg-card shadow-card">
          <div className="text-xs text-muted-foreground uppercase">Total Value</div>
          <div className="text-2xl font-bold mt-1">₹{totals.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search product, SKU, client, ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Date</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">Loading...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    <ShoppingBag className="w-6 h-6 mx-auto mb-1 opacity-50" />
                    No sold items yet
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{r.date}</TableCell>
                    <TableCell className="font-medium">{r.product_name}</TableCell>
                    <TableCell className="font-mono text-xs text-primary">{r.sku || '-'}</TableCell>
                    <TableCell className="text-center">{r.qty}</TableCell>
                    <TableCell className="text-right">{r.weight ? `${r.weight}g` : '-'}</TableCell>
                    <TableCell className="text-right font-semibold">₹{r.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>{r.client_name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={sourceColor[r.source]}>
                        {sourceLabel[r.source]}
                        {r.source_ref && <span className="ml-1 opacity-70">· {r.source_ref}</span>}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.source === 'manual' && isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(r.manual_id!)}
                          className="h-8 w-8"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
