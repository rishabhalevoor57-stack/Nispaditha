import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Phone, Plus, Sparkles, Download, Trash2 } from 'lucide-react';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { StoreWalletCard } from './StoreWalletCard';
import { downloadClientReportPdf } from '@/utils/clientReportPdf';

interface ClientLite {
  id: string;
  name: string;
  phone: string | null;
  total_purchases: number;
  last_invoice_date: string | null;
  polish_used: number;
  polish_total_allowed: number;
}

interface PurchaseRow {
  date: string;
  productName: string;
  sku: string;
  qty: number;
  weight: number;
  ratePerGram: number;
  total: number;
  type: 'Invoice' | 'Custom' | 'Service';
}

interface Scheme {
  id: string;
  name: string;
  monthly_amount: number;
  duration_months: number;
  amount_paid: number;
  status: string;
}

interface Props {
  client: ClientLite | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

const fmtINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

export function ClientProfileDialog({ client, open, onOpenChange, onUpdate }: Props) {
  const { toast } = useToast();
  const [history, setHistory] = useState<PurchaseRow[]>([]);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [polishUsed, setPolishUsed] = useState(0);
  const [polishAllowed, setPolishAllowed] = useState(3);
  const [loading, setLoading] = useState(false);
  const [showAddScheme, setShowAddScheme] = useState(false);
  const [newScheme, setNewScheme] = useState({ name: '', monthly_amount: '', duration_months: '12', amount_paid: '0' });

  const loadAll = useCallback(async () => {
    if (!client?.phone) {
      setHistory([]);
      setSchemes([]);
      return;
    }
    setLoading(true);
    try {
      const phone = client.phone;
      // Invoices by client_id (most reliable)
      const [invRes, coRes, onRes, schRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('id, invoice_date, invoice_items(product_name, weight_grams, quantity, rate_per_gram, total, products(sku))')
          .eq('client_id', client.id),
        supabase
          .from('custom_orders')
          .select('id, order_date, custom_order_items(item_description, sku, quantity, expected_weight, rate_per_gram, item_total)')
          .eq('phone_number', phone),
        supabase
          .from('order_notes')
          .select('id, order_date, quoted_estimate, order_note_items(item_description, quantity, expected_price)')
          .eq('phone_number', phone),
        supabase.from('client_schemes').select('*').eq('client_id', client.id).order('created_at', { ascending: false }),
      ]);

      const rows: PurchaseRow[] = [];
      (invRes.data || []).forEach((inv: any) => {
        (inv.invoice_items || []).forEach((it: any) => {
          rows.push({
            date: inv.invoice_date,
            productName: it.product_name,
            sku: it.products?.sku || '-',
            qty: it.quantity,
            weight: Number(it.weight_grams) || 0,
            ratePerGram: Number(it.rate_per_gram) || 0,
            total: Number(it.total) || 0,
            type: 'Invoice',
          });
        });
      });
      (coRes.data || []).forEach((co: any) => {
        (co.custom_order_items || []).forEach((it: any) => {
          rows.push({
            date: co.order_date,
            productName: it.item_description,
            sku: it.sku || '-',
            qty: it.quantity,
            weight: Number(it.expected_weight) || 0,
            ratePerGram: Number(it.rate_per_gram) || 0,
            total: Number(it.item_total) || 0,
            type: 'Custom',
          });
        });
      });
      (onRes.data || []).forEach((on: any) => {
        (on.order_note_items || []).forEach((it: any) => {
          rows.push({
            date: on.order_date,
            productName: it.item_description,
            sku: '-',
            qty: it.quantity,
            weight: 0,
            ratePerGram: 0,
            total: Number(it.expected_price) || 0,
            type: 'Service',
          });
        });
      });
      rows.sort((a, b) => (a.date < b.date ? 1 : -1));
      setHistory(rows);
      setSchemes((schRes.data as Scheme[]) || []);
      setPolishUsed(client.polish_used || 0);
      setPolishAllowed(client.polish_total_allowed || 3);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (open && client) loadAll();
  }, [open, client, loadAll]);

  const updatePolish = async (used: number, allowed: number) => {
    if (!client) return;
    const { error } = await supabase
      .from('clients')
      .update({ polish_used: used, polish_total_allowed: allowed })
      .eq('id', client.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    setPolishUsed(used);
    setPolishAllowed(allowed);
    onUpdate?.();
  };

  const usePolish = () => {
    if (polishUsed >= polishAllowed) {
      toast({ variant: 'destructive', title: 'No polishes remaining' });
      return;
    }
    updatePolish(polishUsed + 1, polishAllowed);
    toast({ title: 'Polish used' });
  };

  const addScheme = async () => {
    if (!client || !newScheme.name || !newScheme.monthly_amount) {
      toast({ variant: 'destructive', title: 'Name and monthly amount required' });
      return;
    }
    const monthly = parseFloat(newScheme.monthly_amount);
    const duration = parseInt(newScheme.duration_months) || 1;
    const paid = parseFloat(newScheme.amount_paid) || 0;
    const total = monthly * duration;
    const status = paid >= total ? 'completed' : 'active';
    const { error } = await supabase.from('client_schemes').insert([{
      client_id: client.id,
      name: newScheme.name,
      monthly_amount: monthly,
      duration_months: duration,
      amount_paid: paid,
      status,
    }]);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    toast({ title: 'Scheme added' });
    setNewScheme({ name: '', monthly_amount: '', duration_months: '12', amount_paid: '0' });
    setShowAddScheme(false);
    loadAll();
  };

  const updateSchemePaid = async (s: Scheme, newPaid: number) => {
    const total = s.monthly_amount * s.duration_months;
    const status = newPaid >= total ? 'completed' : 'active';
    const { error } = await supabase
      .from('client_schemes')
      .update({ amount_paid: newPaid, status })
      .eq('id', s.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    loadAll();
  };

  if (!client) return null;
  const remaining = polishAllowed - polishUsed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Client Profile</DialogTitle>
            <Button size="sm" variant="outline" onClick={() => downloadClientReportPdf(client)}>
              <Download className="w-4 h-4 mr-1" /> Download Report
            </Button>
          </div>
        </DialogHeader>

        {/* Profile card */}
        <Card className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Name</div>
            <div className="font-semibold text-lg">{client.name}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Phone</div>
            <div className="font-medium flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {client.phone || '-'}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total Spent</div>
            <div className="font-semibold text-primary">{fmtINR(client.total_purchases)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Last Purchase</div>
            <div className="font-medium">{fmtDate(client.last_invoice_date)}</div>
          </div>
        </Card>

        <Tabs defaultValue="history" className="mt-4">
          <TabsList>
            <TabsTrigger value="history">Purchase History</TabsTrigger>
            <TabsTrigger value="wallet">Store Wallet</TabsTrigger>
            <TabsTrigger value="polish">Polish Tracking</TabsTrigger>
            <TabsTrigger value="schemes">Schemes</TabsTrigger>
          </TabsList>

          <TabsContent value="wallet">
            <StoreWalletCard clientId={client.id} clientName={client.name} />
          </TabsContent>

          {/* Purchase History */}
          <TabsContent value="history">
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Product</th>
                    <th className="text-left p-2">SKU</th>
                    <th className="text-right p-2">Qty</th>
                    <th className="text-right p-2">Wt(g)</th>
                    <th className="text-right p-2">Rate/g</th>
                    <th className="text-right p-2">Total</th>
                    <th className="text-left p-2">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Loading...</td></tr>
                  ) : history.length === 0 ? (
                    <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">No purchases yet</td></tr>
                  ) : (
                    history.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{fmtDate(r.date)}</td>
                        <td className="p-2">{r.productName}</td>
                        <td className="p-2 text-muted-foreground">{r.sku}</td>
                        <td className="p-2 text-right">{r.qty}</td>
                        <td className="p-2 text-right">{r.weight.toFixed(3)}</td>
                        <td className="p-2 text-right">{r.ratePerGram ? fmtINR(r.ratePerGram) : '-'}</td>
                        <td className="p-2 text-right font-medium">{fmtINR(r.total)}</td>
                        <td className="p-2">
                          <Badge variant={r.type === 'Invoice' ? 'default' : r.type === 'Custom' ? 'secondary' : 'outline'}>
                            {r.type}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Polish */}
          <TabsContent value="polish">
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Polish Tracking</h3>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Total Allowed</Label>
                  <Input
                    type="number"
                    value={polishAllowed}
                    onChange={(e) => setPolishAllowed(parseInt(e.target.value) || 0)}
                    onBlur={() => updatePolish(polishUsed, polishAllowed)}
                  />
                </div>
                <div>
                  <Label>Used</Label>
                  <div className="text-2xl font-bold mt-1">{polishUsed}</div>
                </div>
                <div>
                  <Label>Remaining</Label>
                  <div className={`text-2xl font-bold mt-1 ${remaining > 0 ? 'text-primary' : 'text-destructive'}`}>{remaining}</div>
                </div>
              </div>
              <Button className="btn-gold" onClick={usePolish} disabled={remaining <= 0}>
                <Sparkles className="w-4 h-4 mr-2" />
                Use Polish
              </Button>
            </Card>
          </TabsContent>

          {/* Schemes */}
          <TabsContent value="schemes">
            <div className="flex justify-end mb-3">
              <Button size="sm" onClick={() => setShowAddScheme((v) => !v)}>
                <Plus className="w-4 h-4 mr-1" /> Add New Scheme
              </Button>
            </div>
            {showAddScheme && (
              <Card className="p-4 mb-4 grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                <div className="col-span-2">
                  <Label>Scheme Name</Label>
                  <Input value={newScheme.name} onChange={(e) => setNewScheme({ ...newScheme, name: e.target.value })} />
                </div>
                <div>
                  <Label>Monthly (₹)</Label>
                  <Input type="number" value={newScheme.monthly_amount} onChange={(e) => setNewScheme({ ...newScheme, monthly_amount: e.target.value })} />
                </div>
                <div>
                  <Label>Duration (months)</Label>
                  <Input type="number" value={newScheme.duration_months} onChange={(e) => setNewScheme({ ...newScheme, duration_months: e.target.value })} />
                </div>
                <div>
                  <Label>Paid (₹)</Label>
                  <Input type="number" value={newScheme.amount_paid} onChange={(e) => setNewScheme({ ...newScheme, amount_paid: e.target.value })} />
                </div>
                <div className="col-span-full flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowAddScheme(false)}>Cancel</Button>
                  <Button size="sm" className="btn-gold" onClick={addScheme}>Save</Button>
                </div>
              </Card>
            )}
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">Scheme</th>
                    <th className="text-right p-2">Monthly</th>
                    <th className="text-right p-2">Duration</th>
                    <th className="text-right p-2">Paid</th>
                    <th className="text-right p-2">Remaining</th>
                    <th className="text-left p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {schemes.length === 0 ? (
                    <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No schemes</td></tr>
                  ) : (
                    schemes.map((s) => {
                      const total = s.monthly_amount * s.duration_months;
                      const rem = Math.max(0, total - s.amount_paid);
                      return (
                        <tr key={s.id} className="border-t">
                          <td className="p-2 font-medium">{s.name}</td>
                          <td className="p-2 text-right">{fmtINR(s.monthly_amount)}</td>
                          <td className="p-2 text-right">{s.duration_months} mo</td>
                          <td className="p-2 text-right">
                            <Input
                              type="number"
                              defaultValue={s.amount_paid}
                              className="h-8 text-right w-28 ml-auto"
                              onBlur={(e) => {
                                const v = parseFloat(e.target.value) || 0;
                                if (v !== s.amount_paid) updateSchemePaid(s, v);
                              }}
                            />
                          </td>
                          <td className="p-2 text-right font-medium">{fmtINR(rem)}</td>
                          <td className="p-2">
                            <Badge variant={rem === 0 ? 'default' : 'secondary'}>
                              {rem === 0 ? 'Completed' : 'Active'}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
