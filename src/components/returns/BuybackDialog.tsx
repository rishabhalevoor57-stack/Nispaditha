import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Search, Coins } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useActivityLogger } from '@/hooks/useActivityLog';
import { adjustWallet } from '@/hooks/useStoreWallet';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

interface InvoiceLite {
  id: string;
  invoice_number: string;
  client_id: string | null;
  invoice_date: string;
  clients?: { name: string; phone: string | null } | null;
}

interface InvoiceItemLite {
  id: string;
  product_id: string | null;
  product_name: string;
  category: string | null;
  weight_grams: number;
  quantity: number;
}

interface BuybackRow extends InvoiceItemLite {
  selected: boolean;
  bb_weight: number;
  bb_quantity: number;
}

const fmtINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

export function BuybackDialog({ open, onOpenChange, onComplete }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { logActivity } = useActivityLogger();

  const [step, setStep] = useState<'lookup' | 'items' | 'confirm'>('lookup');
  const [invoiceNum, setInvoiceNum] = useState('');
  const [invoice, setInvoice] = useState<InvoiceLite | null>(null);
  const [rows, setRows] = useState<BuybackRow[]>([]);
  const [silverRate, setSilverRate] = useState(0);
  const [rateError, setRateError] = useState<string | null>(null);
  const [roundOff, setRoundOff] = useState(0);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [disposition, setDisposition] = useState<'repair' | 'inventory'>('inventory');
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);

  const reset = () => {
    setStep('lookup');
    setInvoiceNum('');
    setInvoice(null);
    setRows([]);
    setRoundOff(0);
    setReason('');
    setNotes('');
    setDisposition('inventory');
  };

  useEffect(() => {
    if (!open) reset();
    if (open) {
      supabase.from('business_settings').select('silver_rate_per_gram').maybeSingle().then(({ data, error }) => {
        if (error || !data) {
          setRateError('Silver rate unavailable. Enter manually.');
          setSilverRate(0);
        } else {
          setSilverRate(Number(data.silver_rate_per_gram) || 0);
          setRateError(null);
        }
      });
    }
  }, [open]);

  const lookup = async () => {
    if (!invoiceNum.trim()) return;
    setSearching(true);
    try {
      const { data: inv, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, client_id, invoice_date, clients(name, phone)')
        .eq('invoice_number', invoiceNum.trim())
        .maybeSingle();
      if (error || !inv) {
        toast({ variant: 'destructive', title: 'Invoice not found' });
        return;
      }
      const { data: items } = await supabase
        .from('invoice_items')
        .select('id, product_id, product_name, category, weight_grams, quantity')
        .eq('invoice_id', inv.id);
      setInvoice(inv as InvoiceLite);
      setRows(
        (items || []).map((it) => ({
          ...it,
          weight_grams: Number(it.weight_grams) || 0,
          quantity: Number(it.quantity) || 1,
          selected: false,
          bb_weight: Number(it.weight_grams) || 0,
          bb_quantity: Number(it.quantity) || 1,
        })),
      );
      setStep('items');
    } finally {
      setSearching(false);
    }
  };

  const selected = rows.filter((r) => r.selected);
  const totalWeight = selected.reduce((s, r) => s + (Number(r.bb_weight) * Number(r.bb_quantity)), 0);
  const baseAmount = totalWeight * silverRate;
  const refund = Math.max(0, baseAmount + roundOff);

  const submit = async () => {
    if (!invoice || !invoice.client_id) {
      toast({ variant: 'destructive', title: 'Buyback requires a registered client on the invoice' });
      return;
    }
    if (selected.length === 0) {
      toast({ variant: 'destructive', title: 'Select at least one item' });
      return;
    }
    if (silverRate <= 0) {
      toast({ variant: 'destructive', title: 'Set a silver rate first' });
      return;
    }
    setBusy(true);
    try {
      const { data: refNum, error: refErr } = await supabase.rpc(
        'generate_return_exchange_reference',
        { p_type: 'return' },
      );
      if (refErr) throw refErr;

      const clientName = invoice.clients?.name || null;
      const clientPhone = invoice.clients?.phone || null;

      const { data: rec, error: recErr } = await supabase
        .from('return_exchanges')
        .insert([{
          reference_number: refNum,
          type: 'return',
          subtype: 'buyback',
          original_invoice_id: invoice.id,
          original_invoice_number: invoice.invoice_number,
          client_name: clientName,
          client_phone: clientPhone,
          client_id: invoice.client_id,
          refund_amount: refund,
          additional_charge: 0,
          payment_mode: 'wallet',
          refund_method: 'store_credit',
          disposition,
          live_rate_used: silverRate,
          round_off: roundOff,
          total_weight: totalWeight,
          reason: reason || 'Buyback',
          notes,
          created_by: user?.id,
        }] as never)
        .select()
        .single();
      if (recErr) throw recErr;

      const itemsToInsert = selected.map((r) => ({
        return_exchange_id: rec.id,
        direction: 'returned' as const,
        product_id: r.product_id,
        product_name: r.product_name,
        sku: null,
        category: r.category,
        quantity: r.bb_quantity,
        weight_grams: r.bb_weight * r.bb_quantity,
        rate_per_gram: silverRate,
        making_charges: 0,
        discount: 0,
        line_total: r.bb_weight * r.bb_quantity * silverRate,
        gst_percentage: 0,
        gst_amount: 0,
        total: r.bb_weight * r.bb_quantity * silverRate,
      }));
      await supabase.from('return_exchange_items').insert(itemsToInsert);

      // Disposition handling
      if (disposition === 'inventory') {
        for (const r of selected) {
          if (r.product_id) {
            const { data: p } = await supabase.from('products').select('quantity').eq('id', r.product_id).maybeSingle();
            if (p) {
              await supabase.from('products')
                .update({ quantity: (p.quantity || 0) + r.bb_quantity })
                .eq('id', r.product_id);
              await supabase.from('stock_history').insert([{
                product_id: r.product_id,
                quantity_change: r.bb_quantity,
                type: 'in',
                reason: `Buyback ${refNum}`,
                reference_id: rec.id,
                created_by: user?.id,
              }]);
            }
          }
        }
      } else {
        await supabase.from('repair_items').insert(
          selected.map((r) => ({
            product_id: r.product_id,
            sku: null,
            product_name: r.product_name,
            weight_grams: r.bb_weight,
            quantity: r.bb_quantity,
            original_invoice_id: invoice.id,
            original_invoice_number: invoice.invoice_number,
            client_name: clientName,
            client_phone: clientPhone,
            source: 'buyback',
            source_reference_id: rec.id,
            created_by: user?.id,
          })),
        );
      }

      // Credit wallet
      await adjustWallet(invoice.client_id, refund, 'buyback', rec.id, refNum, `Buyback against ${invoice.invoice_number}`);

      logActivity({
        module: 'return',
        action: 'create',
        recordId: rec.id,
        recordLabel: refNum,
        newValue: { type: 'buyback', invoice: invoice.invoice_number, weight: totalWeight, rate: silverRate, refund },
      });

      toast({ title: `Buyback ${refNum} processed — ₹${refund.toFixed(2)} credited to wallet` });
      onComplete();
      onOpenChange(false);
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'Failed', description: e instanceof Error ? e.message : 'Error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" />
            Buyback — Customer Sells Back Jewellery
          </DialogTitle>
        </DialogHeader>

        {step === 'lookup' && (
          <div className="space-y-4">
            <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
              Enter the original invoice number. Buyback amount = today's silver rate × weight.
              Refund is always issued as Store Credits. No GST applies.
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. INV-2526-000001"
                value={invoiceNum}
                onChange={(e) => setInvoiceNum(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && lookup()}
              />
              <Button onClick={lookup} disabled={searching || !invoiceNum.trim()}>
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span className="ml-2">Find</span>
              </Button>
            </div>
          </div>
        )}

        {step === 'items' && invoice && (
          <div className="space-y-4">
            <div className="rounded-md border p-3 grid grid-cols-3 gap-3 text-sm">
              <div><div className="text-xs text-muted-foreground">Invoice</div><div className="font-mono">{invoice.invoice_number}</div></div>
              <div><div className="text-xs text-muted-foreground">Client</div><div>{invoice.clients?.name || 'Walk-in'}</div></div>
              <div><div className="text-xs text-muted-foreground">Phone</div><div>{invoice.clients?.phone || '-'}</div></div>
            </div>

            {!invoice.client_id && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive p-3 text-sm">
                This invoice has no registered client. Buyback credits cannot be issued.
              </div>
            )}

            <div className="rounded-md border p-3 space-y-2 bg-muted/30">
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <Label>Today's Silver Rate (₹/g)</Label>
                  <Input
                    type="number"
                    value={silverRate || ''}
                    onChange={(e) => { setSilverRate(parseFloat(e.target.value) || 0); setRateError(null); }}
                  />
                  {rateError && <p className="text-xs text-destructive mt-1">{rateError}</p>}
                </div>
                <div>
                  <Label>Round Off</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={roundOff}
                    onChange={(e) => setRoundOff(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. -0.50"
                  />
                </div>
              </div>
            </div>

            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2"></th>
                    <th className="p-2 text-left">Product</th>
                    <th className="p-2 text-right">Wt/unit (g)</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2 text-right">Total Wt</th>
                    <th className="p-2 text-right">Buyback Value</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={6} className="p-3 text-center text-muted-foreground">No items on this invoice</td></tr>
                  ) : rows.map((r, idx) => {
                    const lineWt = (Number(r.bb_weight) || 0) * (Number(r.bb_quantity) || 0);
                    const lineVal = lineWt * silverRate;
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="p-2 align-top">
                          <Checkbox
                            checked={r.selected}
                            onCheckedChange={(v) => {
                              const copy = [...rows];
                              copy[idx].selected = !!v;
                              setRows(copy);
                            }}
                          />
                        </td>
                        <td className="p-2">{r.product_name}</td>
                        <td className="p-2 text-right">
                          <Input
                            type="number"
                            step="0.001"
                            className="h-8 w-24 text-right ml-auto"
                            value={r.bb_weight}
                            onChange={(e) => {
                              const c = [...rows];
                              c[idx].bb_weight = parseFloat(e.target.value) || 0;
                              setRows(c);
                            }}
                          />
                        </td>
                        <td className="p-2 text-right">
                          <Input
                            type="number"
                            min={1}
                            max={r.quantity}
                            className="h-8 w-16 text-right ml-auto"
                            value={r.bb_quantity}
                            onChange={(e) => {
                              const c = [...rows];
                              c[idx].bb_quantity = parseInt(e.target.value) || 1;
                              setRows(c);
                            }}
                          />
                        </td>
                        <td className="p-2 text-right tabular-nums">{lineWt.toFixed(3)} g</td>
                        <td className="p-2 text-right tabular-nums font-medium">{fmtINR(lineVal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="rounded-md bg-primary/10 border border-primary/20 p-4 text-sm">
              <div className="flex justify-between"><span>Total Weight</span><span className="tabular-nums">{totalWeight.toFixed(3)} g</span></div>
              <div className="flex justify-between"><span>Rate × Weight</span><span className="tabular-nums">{fmtINR(baseAmount)}</span></div>
              <div className="flex justify-between"><span>Round Off</span><span className="tabular-nums">{fmtINR(roundOff)}</span></div>
              <div className="flex justify-between font-bold text-base pt-1 border-t mt-1"><span>Credits to Issue</span><span className="text-primary tabular-nums">{fmtINR(refund)}</span></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Reason</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Customer wants to sell back" />
              </div>
              <div>
                <Label>After Buyback — Send Item To</Label>
                <RadioGroup value={disposition} onValueChange={(v) => setDisposition(v as 'repair' | 'inventory')} className="grid grid-cols-2 gap-2 mt-1">
                  <label className="flex items-center gap-2 rounded-md border p-2 cursor-pointer">
                    <RadioGroupItem value="inventory" /><span className="text-sm">Inventory</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-md border p-2 cursor-pointer">
                    <RadioGroupItem value="repair" /><span className="text-sm">Repair</span>
                  </label>
                </RadioGroup>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('lookup')}>Back</Button>
              <Button className="btn-gold" onClick={submit} disabled={busy || !invoice.client_id || selected.length === 0 || silverRate <= 0}>
                {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Coins className="w-4 h-4 mr-2" />}
                Process Buyback & Credit Wallet
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
