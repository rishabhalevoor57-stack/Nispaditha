import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Flame } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useMelting } from '@/hooks/useMelting';
import { useAuth } from '@/contexts/AuthContext';

interface RepairItemLite {
  id: string;
  product_id: string | null;
  sku: string | null;
  product_name: string;
  weight_grams: number;
  quantity: number;
  client_id?: string | null;
  client_name: string | null;
  client_phone: string | null;
  original_invoice_number: string | null;
  notes: string | null;
  metal_type?: string | null;
  repair_outcome?: string | null;
  melting_status?: string | null;
  melting_purity?: number | null;
  melting_loss_percent?: number | null;
  recovered_weight?: number | null;
  melting_description?: string | null;
  melting_remarks?: string | null;
  add_to_inventory?: boolean | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item: RepairItemLite | null;
  onSaved: () => void;
}

const OUTCOMES = [
  { value: 'repaired_successfully', label: 'Repaired Successfully' },
  { value: 'returned_without_repair', label: 'Returned Without Repair' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'sent_for_melting', label: 'Sent For Melting' },
];

export function RepairMeltingDialog({ open, onOpenChange, item, onSaved }: Props) {
  const { toast } = useToast();
  const { create } = useMelting();
  const { user } = useAuth();

  const [outcome, setOutcome] = useState('repaired_successfully');
  const [gross, setGross] = useState(0);
  const [purity, setPurity] = useState(92.5);
  const [loss, setLoss] = useState(0);
  const [description, setDescription] = useState('');
  const [remarks, setRemarks] = useState('');
  const [addToInventory, setAddToInventory] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) return;
    setOutcome(item.repair_outcome || 'repaired_successfully');
    setGross(Number(item.weight_grams) || 0);
    setPurity(item.melting_purity != null ? Number(item.melting_purity) : 92.5);
    setLoss(item.melting_loss_percent != null ? Number(item.melting_loss_percent) : 0);
    setDescription(item.melting_description || `${item.product_name}${item.sku ? ` (${item.sku})` : ''}`);
    setRemarks(item.melting_remarks || item.notes || '');
    setAddToInventory(!!item.add_to_inventory);
  }, [item]);

  const fineWeight = useMemo(() => (gross * purity) / 100, [gross, purity]);
  const recovered = useMemo(() => Math.max(0, fineWeight * (1 - loss / 100)), [fineWeight, loss]);

  if (!item) return null;
  const isMelting = outcome === 'sent_for_melting';

  const handleSave = async () => {
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {
        repair_outcome: outcome,
        add_to_inventory: addToInventory,
      };
      if (isMelting) {
        patch.melting_purity = purity;
        patch.melting_loss_percent = loss;
        patch.recovered_weight = recovered;
        patch.melting_description = description;
        patch.melting_remarks = remarks;
        patch.melting_status = 'sent_to_melting';
      }
      const { error } = await supabase.from('repair_items').update(patch).eq('id', item.id);
      if (error) throw error;

      if (isMelting) {
        // Create Melting entry
        const entry = await create(
          {
            entry_date: new Date().toISOString().split('T')[0],
            customer_name: item.client_name,
            client_id: item.client_id || null,
            source_type: 'repair',
            source_reference_id: item.id,
            source_reference_label: item.sku || item.product_name,
            description,
            metal_type: (item.metal_type || 'silver') as string,
            gross_weight: gross,
            avg_purity: purity,
            fine_weight: fineWeight,
            melting_loss_percent: loss,
            recovered_weight: recovered,
            status: 'pending',
            notes: remarks,
          },
          [{
            description,
            quantity: item.quantity || 1,
            gross_weight: gross,
            purity,
            remarks,
          }],
        );
        if (entry?.id) {
          await supabase.from('repair_items')
            .update({ melting_entry_id: entry.id })
            .eq('id', item.id);
        }
      } else if (outcome !== 'sent_for_melting') {
        // resolve repair if not melting (other outcomes)
        await supabase.from('repair_items')
          .update({ date_resolved: new Date().toISOString() })
          .eq('id', item.id);
      }

      toast({ title: 'Repair updated', description: isMelting ? 'Sent to Melting module' : 'Outcome saved' });
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Failed', description: e instanceof Error ? e.message : 'Error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Flame className="w-4 h-4" /> Repair Outcome & Melting Details</DialogTitle>
          <DialogDescription>
            {item.product_name} {item.sku ? `(${item.sku})` : ''} — {item.client_name || 'Walk-in'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Repair Outcome</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OUTCOMES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isMelting && (
            <div className="rounded-md border p-4 space-y-3 bg-muted/30">
              <div className="font-medium flex items-center gap-2"><Flame className="w-4 h-4 text-orange-500" /> Melting Details</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Gross Weight (g)</Label>
                  <Input type="number" step="0.01" value={gross} onChange={(e) => setGross(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Purity %</Label>
                  <Input type="number" step="0.01" value={purity} onChange={(e) => setPurity(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Melting Loss %</Label>
                  <Input type="number" step="0.01" value={loss} onChange={(e) => setLoss(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Fine Weight (g)</Label>
                  <Input value={fineWeight.toFixed(2)} disabled />
                </div>
                <div className="col-span-2">
                  <Label>Recovered Weight (g)</Label>
                  <Input value={recovered.toFixed(2)} disabled className="font-semibold" />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div>
                <Label>Remarks</Label>
                <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={addToInventory} onCheckedChange={(v) => setAddToInventory(!!v)} />
                <span className="text-sm">Add Recovered Metal To Inventory (after melting completed)</span>
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || (isMelting && gross <= 0)}>
            {isMelting ? 'Save & Send to Melting' : 'Save Outcome'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
