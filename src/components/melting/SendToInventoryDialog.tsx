import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultName: string;
  recoveredWeight: number;
  onSubmit: (name: string, pricePerGram: number, makingCharges: number) => Promise<void>;
}

export function SendToInventoryDialog({ open, onOpenChange, defaultName, recoveredWeight, onSubmit }: Props) {
  const [name, setName] = useState(defaultName);
  const [ppg, setPpg] = useState(0);
  const [mc, setMc] = useState(0);
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Send to Inventory</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Product Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Recovered Weight (g)</Label>
              <Input value={recoveredWeight.toFixed(3)} disabled />
            </div>
            <div>
              <Label>Price / gram (₹)</Label>
              <Input type="number" value={ppg} onChange={(e) => setPpg(Number(e.target.value))} />
            </div>
            <div>
              <Label>Making Charges (₹)</Label>
              <Input type="number" value={mc} onChange={(e) => setMc(Number(e.target.value))} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">A new SKU like <span className="font-mono">MLTSIL001</span> will be created with this weight.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={async () => { setBusy(true); await onSubmit(name, ppg, mc); setBusy(false); onOpenChange(false); }}
            disabled={busy || !name}
          >Create SKU & Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
