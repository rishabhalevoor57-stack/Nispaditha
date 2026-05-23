import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Search, Coins } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useActivityLogger } from '@/hooks/useActivityLog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  preselectedInvoiceNumber?: string | null;
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

interface ClientLite {
  id: string;
  name: string;
  phone: string | null;
}

interface BuybackProcessResult {
  buyback_id?: string;
  reference_number?: string;
}

const fmtINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

export function BuybackDialog({ open, onOpenChange, onComplete, preselectedInvoiceNumber }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { logActivity } = useActivityLogger();

  const [tab, setTab] = useState<'jewellery' | 'metal'>('jewellery');

  // -------- Jewellery state --------
  const [step, setStep] = useState<'lookup' | 'items'>('lookup');
  const [invoiceNum, setInvoiceNum] = useState('');
  const [invoice, setInvoice] = useState<InvoiceLite | null>(null);
  const [rows, setRows] = useState<BuybackRow[]>([]);
  const [silverRate, setSilverRate] = useState(0);
  const [goldRate, setGoldRate] = useState(0);
  const [rateError, setRateError] = useState<string | null>(null);
  const [roundOff, setRoundOff] = useState(0);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [searching, setSearching] = useState(false);

  // -------- Metal state --------
  const [metalType, setMetalType] = useState<'silver' | 'gold' | 'brass' | 'other'>('silver');
  const [metalOther, setMetalOther] = useState('');
  const [mWeight, setMWeight] = useState<number>(0);
  const [mRate, setMRate] = useState<number>(0);
  const [mRound, setMRound] = useState<number>(0);
  const [mNotes, setMNotes] = useState('');
  const [mClientId, setMClientId] = useState<string>('');
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [clientQuery, setClientQuery] = useState('');

  const [busy, setBusy] = useState(false);

  const reset = () => {
    setTab('jewellery');
    setStep('lookup');
    setInvoiceNum('');
    setInvoice(null);
    setRows([]);
    setRoundOff(0);
    setReason('');
    setNotes('');
    setMetalType('silver');
    setMetalOther('');
    setMWeight(0);
    setMRound(0);
    setMNotes('');
    setMClientId('');
    setClientQuery('');
  };

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    // Load rates
    supabase.from('business_settings')
      .select('silver_rate_per_gram, gold_rate_per_gram')
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setRateError('Rates unavailable. Enter manually.');
        } else {
          setSilverRate(Number(data.silver_rate_per_gram) || 0);
          setGoldRate(Number(data.gold_rate_per_gram) || 0);
          setMRate(Number(data.silver_rate_per_gram) || 0);
          setRateError(null);
        }
      });
    // Load clients for metal-buyback
    supabase.from('clients').select('id, name, phone').order('name').limit(500)
      .then(({ data }) => setClients((data as ClientLite[]) || []));

    // Auto-prefill invoice number if provided
    if (preselectedInvoiceNumber) {
      setTab('jewellery');
      setInvoiceNum(preselectedInvoiceNumber);
      // delay to next tick so state is set
      setTimeout(() => lookup(preselectedInvoiceNumber), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Update metal default rate when metal type changes
  useEffect(() => {
    if (metalType === 'silver') setMRate(silverRate);
    else if (metalType === 'gold') setMRate(goldRate);
  }, [metalType, silverRate, goldRate]);

  const lookup = async (numOverride?: string) => {
    const num = (numOverride ?? invoiceNum).trim();
    if (!num) return;
    setSearching(true);
    try {
      const { data: inv, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, client_id, invoice_date, clients(name, phone)')
        .eq('invoice_number', num)
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

  // ----- Jewellery calculations -----
  const selected = rows.filter((r) => r.selected);
  const totalWeight = selected.reduce((s, r) => s + (Number(r.bb_weight) * Number(r.bb_quantity)), 0);
  const baseAmount = totalWeight * silverRate;
  const refund = Math.max(0, baseAmount + roundOff);

  // ----- Metal calculations -----
  const mAmount = Math.max(0, mWeight * mRate + mRound);
  const filteredClients = clients.filter((c) => {
    if (!clientQuery) return true;
    const q = clientQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.phone || '').includes(q);
  }).slice(0, 100);

  // ===== JEWELLERY SUBMIT =====
  const submitJewellery = async () => {
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
      const clientName = invoice.clients?.name || null;
      const clientPhone = invoice.clients?.phone || null;

      const payload = selected.map((r) => ({
        product_id: r.product_id,
        product_name: r.product_name,
        sku: null,
        category: r.category,
        quantity: r.bb_quantity,
        weight_grams: r.bb_weight * r.bb_quantity,
        rate_per_gram: silverRate,
        total: r.bb_weight * r.bb_quantity * silverRate,
      }));

      const { data, error: processErr } = await supabase.rpc('process_buyback', {
        p_client_id: invoice.client_id,
        p_invoice_id: invoice.id,
        p_invoice_number: invoice.invoice_number,
        p_kind: 'jewellery',
        p_metal_type: 'silver',
        p_weight: totalWeight,
        p_rate_used: silverRate,
        p_round_off: roundOff,
        p_total_credits_added: refund,
        p_reason: reason || 'Jewellery Buyback',
        p_notes: notes || null,
        p_destination: 'repair',
        p_items: payload,
      });
      if (processErr) throw processErr;

      const result = (data ?? null) as BuybackProcessResult | null;
      const refNum = result?.reference_number || 'BUYBACK';
      const recId = result?.buyback_id || crypto.randomUUID();

      logActivity({
        module: 'return',
        action: 'create',
        recordId: recId,
        recordLabel: refNum,
        newValue: { type: 'buyback', kind: 'jewellery', invoice: invoice.invoice_number, weight: totalWeight, rate: silverRate, refund },
      });

      toast({ title: `Buyback ${refNum} processed — ${fmtINR(refund)} credits added to ${clientName || 'client'}'s wallet` });
      onComplete();
      onOpenChange(false);
    } catch (e: unknown) {
      const err = e as { message?: string; details?: string; hint?: string; code?: string };
      const desc = [err?.message, err?.details, err?.hint, err?.code ? `(${err.code})` : null].filter(Boolean).join(' — ') || 'Unknown error';
      console.error('Buyback failed:', e);
      toast({ variant: 'destructive', title: 'Buyback failed', description: desc });
    } finally {
      setBusy(false);
    }
  };

  // ===== METAL SUBMIT =====
  const submitMetal = async () => {
    if (!mClientId) {
      toast({ variant: 'destructive', title: 'Select a client to credit' });
      return;
    }
    if (mWeight <= 0 || mRate <= 0) {
      toast({ variant: 'destructive', title: 'Enter weight and rate' });
      return;
    }
    setBusy(true);
    try {
      const client = clients.find((c) => c.id === mClientId);
      const metalLabel = metalType === 'other' ? (metalOther || 'Other') : metalType;

      const { data, error: processErr } = await supabase.rpc('process_buyback', {
        p_client_id: mClientId,
        p_invoice_id: null,
        p_invoice_number: null,
        p_kind: 'metal',
        p_metal_type: metalLabel,
        p_weight: mWeight,
        p_rate_used: mRate,
        p_round_off: mRound,
        p_total_credits_added: mAmount,
        p_reason: 'Metal Buyback',
        p_notes: mNotes || null,
        p_destination: 'repair',
        p_items: [{
          product_id: null,
          product_name: `${metalLabel} ${mWeight}g`,
          sku: null,
          category: 'metal',
          quantity: 1,
          weight_grams: mWeight,
          rate_per_gram: mRate,
          total: mAmount,
        }],
      });
      if (processErr) throw processErr;

      const result = (data ?? null) as BuybackProcessResult | null;
      const refNum = result?.reference_number || 'BUYBACK';
      const recId = result?.buyback_id || crypto.randomUUID();

      logActivity({
        module: 'return',
        action: 'create',
        recordId: recId,
        recordLabel: refNum,
        newValue: { type: 'buyback', kind: 'metal', metal: metalLabel, weight: mWeight, rate: mRate, refund: mAmount },
      });

      toast({ title: `Metal Buyback ${refNum} — ${fmtINR(mAmount)} credits added to ${client?.name || 'client'}'s wallet` });
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
            Buyback
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'jewellery' | 'metal')}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="jewellery">Jewellery Buyback</TabsTrigger>
            <TabsTrigger value="metal">Metal Buyback</TabsTrigger>
          </TabsList>

          {/* ============ JEWELLERY TAB ============ */}
          <TabsContent value="jewellery" className="space-y-4 mt-4">
            <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              Enter the original invoice number. Refund = today's silver rate × weight (editable). Refund issued as Store Credits only. No GST. Items go to Repair automatically.
            </div>

            {step === 'lookup' && (
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. INV-2526-000001"
                  value={invoiceNum}
                  onChange={(e) => setInvoiceNum(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && lookup()}
                />
                <Button onClick={() => lookup()} disabled={searching || !invoiceNum.trim()}>
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span className="ml-2">Find</span>
                </Button>
              </div>
            )}

            {step === 'items' && invoice && (
              <>
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

                <div className="rounded-md border p-3 grid grid-cols-2 gap-3 bg-muted/30">
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
                                  const c = [...rows];
                                  c[idx].selected = !!v;
                                  setRows(c);
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
                  <div className="flex justify-between font-bold text-base pt-1 border-t mt-1">
                    <span>Store Credits to be added</span>
                    <span className="text-primary tabular-nums">{fmtINR(refund)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Reason</Label>
                    <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Customer wants to sell back" />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={1} />
                  </div>
                </div>

                <div className="text-xs text-muted-foreground rounded-md bg-amber-50 border border-amber-200 p-2">
                  Item will be sent to <span className="font-semibold">Repair</span> automatically. From there, it can be moved to inventory after assessment.
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep('lookup')}>Back</Button>
                  <Button className="btn-gold" onClick={submitJewellery} disabled={busy || !invoice.client_id || selected.length === 0 || silverRate <= 0}>
                    {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Coins className="w-4 h-4 mr-2" />}
                    Process Buyback & Credit Wallet
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* ============ METAL TAB ============ */}
          <TabsContent value="metal" className="space-y-4 mt-4">
            <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              For raw metal: silver coins, bars, nuggets, gold, brass, etc. No invoice required. Refund issued as Store Credits only. Item goes to Repair automatically.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Metal Type</Label>
                <Select value={metalType} onValueChange={(v) => setMetalType(v as typeof metalType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="silver">Silver</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="brass">Brass</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {metalType === 'other' && (
                <div>
                  <Label>Specify Metal</Label>
                  <Input value={metalOther} onChange={(e) => setMetalOther(e.target.value)} placeholder="e.g. Copper" />
                </div>
              )}

              <div>
                <Label>Weight (grams)</Label>
                <Input type="number" step="0.001" value={mWeight || ''} onChange={(e) => setMWeight(parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Today's Rate (₹/g)</Label>
                <Input type="number" step="0.01" value={mRate || ''} onChange={(e) => setMRate(parseFloat(e.target.value) || 0)} />
                {rateError && <p className="text-xs text-destructive mt-1">{rateError}</p>}
              </div>
              <div>
                <Label>Round Off</Label>
                <Input type="number" step="0.01" value={mRound} onChange={(e) => setMRound(parseFloat(e.target.value) || 0)} />
              </div>
            </div>

            <div>
              <Label>Client (to credit)</Label>
              <Input
                placeholder="Search client by name or phone..."
                value={clientQuery}
                onChange={(e) => setClientQuery(e.target.value)}
                className="mb-2"
              />
              <Select value={mClientId} onValueChange={setMClientId}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {filteredClients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.phone ? ` — ${c.phone}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea value={mNotes} onChange={(e) => setMNotes(e.target.value)} rows={2} />
            </div>

            <div className="rounded-md bg-primary/10 border border-primary/20 p-4 text-sm">
              <div className="flex justify-between"><span>Weight × Rate</span><span className="tabular-nums">{fmtINR(mWeight * mRate)}</span></div>
              <div className="flex justify-between"><span>Round Off</span><span className="tabular-nums">{fmtINR(mRound)}</span></div>
              <div className="flex justify-between font-bold text-base pt-1 border-t mt-1">
                <span>Store Credits to be added</span>
                <span className="text-primary tabular-nums">{fmtINR(mAmount)}</span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground rounded-md bg-amber-50 border border-amber-200 p-2">
              Raw metal will be sent to <span className="font-semibold">Repair</span> automatically.
            </div>

            <div className="flex justify-end">
              <Button className="btn-gold" onClick={submitMetal} disabled={busy || !mClientId || mWeight <= 0 || mRate <= 0}>
                {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Coins className="w-4 h-4 mr-2" />}
                Process Metal Buyback & Credit Wallet
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
