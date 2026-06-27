import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useVendors } from '@/hooks/useVendors';
import type { MeltingEntry, MeltingItem } from '@/hooks/useMelting';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (entry: Partial<MeltingEntry>, items: MeltingItem[]) => Promise<void>;
  prefill?: Partial<MeltingEntry> & { items?: MeltingItem[] };
}

const SOURCE_TYPES = ['repair', 'buyback', 'exchange', 'inventory_scrap', 'customer_scrap', 'other'];
const METALS = ['silver', 'gold', 'other'];

const emptyItem = (): MeltingItem => ({
  description: '', quantity: 1, gross_weight: 0, purity: 92.5, remarks: '',
});

export function MeltingFormDialog({ open, onOpenChange, onSubmit, prefill }: Props) {
  const { vendors } = useVendors();
  const [entry, setEntry] = useState<Partial<MeltingEntry>>({
    entry_date: new Date().toISOString().split('T')[0],
    source_type: 'other',
    metal_type: 'silver',
    melting_loss_percent: 0,
    status: 'pending',
  });
  const [items, setItems] = useState<MeltingItem[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && prefill) {
      setEntry((e) => ({ ...e, ...prefill }));
      if (prefill.items?.length) setItems(prefill.items);
    } else if (open && !prefill) {
      setEntry({
        entry_date: new Date().toISOString().split('T')[0],
        source_type: 'other',
        metal_type: 'silver',
        melting_loss_percent: 0,
        status: 'pending',
      });
      setItems([emptyItem()]);
    }
  }, [open, prefill]);

  const totals = useMemo(() => {
    const gross = items.reduce((s, i) => s + Number(i.gross_weight || 0), 0);
    const fine = items.reduce((s, i) => s + (Number(i.gross_weight || 0) * Number(i.purity || 0)) / 100, 0);
    const avgPurity = gross > 0 ? (fine / gross) * 100 : 0;
    const loss = (fine * Number(entry.melting_loss_percent || 0)) / 100;
    const recovered = fine - loss;
    return { gross, fine, avgPurity, loss, recovered };
  }, [items, entry.melting_loss_percent]);

  const updateItem = (idx: number, patch: Partial<MeltingItem>) => {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const submit = async () => {
    setSaving(true);
    await onSubmit(
      {
        ...entry,
        gross_weight: totals.gross,
        avg_purity: totals.avgPurity,
        fine_weight: totals.fine,
        recovered_weight: totals.recovered,
      },
      items.filter((i) => i.description && i.gross_weight > 0),
    );
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Melting Entry</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <Label>Date</Label>
            <Input type="date" value={entry.entry_date || ''} onChange={(e) => setEntry({ ...entry, entry_date: e.target.value })} />
          </div>
          <div>
            <Label>Source</Label>
            <Select value={entry.source_type} onValueChange={(v) => setEntry({ ...entry, source_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOURCE_TYPES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Metal</Label>
            <Select value={entry.metal_type} onValueChange={(v) => setEntry({ ...entry, metal_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {METALS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Vendor / Refiner</Label>
            <Select
              value={entry.vendor_id || 'none'}
              onValueChange={(v) => {
                const found = vendors.find((x) => x.id === v);
                setEntry({ ...entry, vendor_id: v === 'none' ? null : v, vendor_name: found?.name || null });
              }}
            >
              <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Customer Name (optional)</Label>
            <Input value={entry.customer_name || ''} onChange={(e) => setEntry({ ...entry, customer_name: e.target.value })} />
          </div>
          <div>
            <Label>Melting Loss %</Label>
            <Input
              type="number" step="0.01"
              value={entry.melting_loss_percent ?? 0}
              onChange={(e) => setEntry({ ...entry, melting_loss_percent: Number(e.target.value) })}
            />
          </div>
        </div>

        <div>
          <Label>Description</Label>
          <Textarea value={entry.description || ''} onChange={(e) => setEntry({ ...entry, description: e.target.value })} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Material Details</Label>
            <Button size="sm" variant="outline" onClick={() => setItems((a) => [...a, emptyItem()])}>
              <Plus className="w-3 h-3 mr-1" /> Add Row
            </Button>
          </div>
          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2">Description</th>
                  <th className="text-left p-2 w-20">Qty</th>
                  <th className="text-left p-2 w-28">Gross (g)</th>
                  <th className="text-left p-2 w-24">Purity %</th>
                  <th className="text-left p-2 w-28">Fine (g)</th>
                  <th className="text-left p-2">Remarks</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const fine = (Number(it.gross_weight || 0) * Number(it.purity || 0)) / 100;
                  return (
                    <tr key={idx} className="border-t">
                      <td className="p-1"><Input value={it.description} onChange={(e) => updateItem(idx, { description: e.target.value })} placeholder="Broken chain..." /></td>
                      <td className="p-1"><Input type="number" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} /></td>
                      <td className="p-1"><Input type="number" step="0.001" value={it.gross_weight} onChange={(e) => updateItem(idx, { gross_weight: Number(e.target.value) })} /></td>
                      <td className="p-1"><Input type="number" step="0.01" value={it.purity} onChange={(e) => updateItem(idx, { purity: Number(e.target.value) })} /></td>
                      <td className="p-2 text-muted-foreground">{fine.toFixed(3)}</td>
                      <td className="p-1"><Input value={it.remarks || ''} onChange={(e) => updateItem(idx, { remarks: e.target.value })} /></td>
                      <td className="p-1">
                        <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => setItems((a) => a.filter((_, i) => i !== idx))}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-muted/40 rounded-md">
          <Stat label="Gross Weight" value={`${totals.gross.toFixed(3)} g`} />
          <Stat label="Avg Purity" value={`${totals.avgPurity.toFixed(2)} %`} />
          <Stat label="Fine Metal" value={`${totals.fine.toFixed(3)} g`} />
          <Stat label="Melting Loss" value={`${totals.loss.toFixed(3)} g`} />
          <Stat label="Recovered" value={`${totals.recovered.toFixed(3)} g`} highlight />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || totals.gross <= 0}>Save Entry</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-semibold ${highlight ? 'text-primary text-lg' : ''}`}>{value}</div>
    </div>
  );
}
