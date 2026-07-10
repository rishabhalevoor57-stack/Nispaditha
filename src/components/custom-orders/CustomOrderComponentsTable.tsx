import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CustomOrderComponent, ComponentUnit } from '@/types/customOrder';

interface Props {
  components: CustomOrderComponent[];
  onChange: (next: CustomOrderComponent[]) => void;
  silverRate?: number;
}

// Manual Components entry.
// Units allowed: Qty | Strings (informational).
// Weight (g) is always available as an optional reference field — not used for
// stock deduction and does not affect inventory. It's for manufacturing notes.
// Total = (units × unit price) + (weight × rate/g)  — weight portion is 0 if either is blank.
const calcTotal = (c: CustomOrderComponent): number => {
  const unit: ComponentUnit = (c.unit as ComponentUnit) === 'strings' ? 'strings' : 'quantity';
  const unitPrice = Number(c.unit_price) || 0;
  const units = unit === 'strings'
    ? (Number(c.strings_used) || 0)
    : (Number(c.quantity_used) || 0);
  const weightTotal = (Number(c.weight_grams) || 0) * (Number(c.rate_per_gram) || 0);
  return Number((units * unitPrice + weightTotal).toFixed(2));
};

export const CustomOrderComponentsTable = ({ components, onChange, silverRate = 0 }: Props) => {
  const updateRow = (idx: number, patch: Partial<CustomOrderComponent>) => {
    const next = components.map((c, i) => {
      if (i !== idx) return c;
      const merged = { ...c, ...patch } as CustomOrderComponent;
      merged.total = calcTotal(merged);
      return merged;
    });
    onChange(next);
  };

  const addRow = () => {
    onChange([
      ...components,
      {
        product_id: null,
        sku: null,
        category: null,
        component_name: '',
        material: '',
        unit: 'quantity',
        weight_grams: 0,
        quantity: 1,
        quantity_used: 1,
        strings_used: 0,
        unit_price: 0,
        rate_per_gram: silverRate || 0,
        total: 0,
      },
    ]);
  };

  const removeRow = (idx: number) => onChange(components.filter((_, i) => i !== idx));

  const totalCost = components.reduce((s, c) => s + (Number(c.total) || 0), 0);

  return (
    <div className="space-y-3">
      {components.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          No components added. Click "Add Component" to enter one manually.
        </p>
      )}

      {components.map((c, idx) => {
        const rawUnit = (c.unit as any);
        const unit: ComponentUnit = rawUnit === 'strings' ? 'strings' : 'quantity';
        return (
          <div key={idx} className="grid grid-cols-12 gap-2 items-end border rounded-md p-3 bg-muted/30">
            <div className="col-span-12 md:col-span-3 space-y-1">
              <Label className="text-xs">Component Name</Label>
              <Input
                placeholder="e.g. Silver Hook, Jump Ring, Pearl Beads"
                value={c.component_name}
                onChange={(e) => updateRow(idx, { component_name: e.target.value })}
                className="h-9 text-sm"
              />
            </div>

            <div className="col-span-6 md:col-span-2 space-y-1">
              <Label className="text-xs">Material</Label>
              <Input
                placeholder="Silver / Pearl / Stone..."
                value={c.material || ''}
                onChange={(e) => updateRow(idx, { material: e.target.value })}
                className="h-9 text-sm"
              />
            </div>

            <div className="col-span-6 md:col-span-1 space-y-1">
              <Label className="text-xs">Unit</Label>
              <Select value={unit} onValueChange={(v) => updateRow(idx, { unit: v as ComponentUnit })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quantity">Qty</SelectItem>
                  <SelectItem value="strings">Strings</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {unit === 'quantity' ? (
              <div className="col-span-6 md:col-span-1 space-y-1">
                <Label className="text-xs">Qty</Label>
                <Input type="number" min="0" step="1" value={c.quantity_used ?? ''}
                  onChange={(e) => updateRow(idx, { quantity_used: parseInt(e.target.value) || 0 })}
                  className="h-9" />
              </div>
            ) : (
              <div className="col-span-6 md:col-span-1 space-y-1">
                <Label className="text-xs">Strings</Label>
                <Input type="number" min="0" step="0.01" value={c.strings_used ?? ''}
                  onChange={(e) => updateRow(idx, { strings_used: parseFloat(e.target.value) || 0 })}
                  className="h-9" />
              </div>
            )}

            <div className="col-span-6 md:col-span-1 space-y-1">
              <Label className="text-xs" title="Optional. For reference only — does not affect stock.">
                Wt (g) <span className="text-muted-foreground">*</span>
              </Label>
              <Input type="number" min="0" step="0.001" value={c.weight_grams || ''}
                onChange={(e) => updateRow(idx, { weight_grams: parseFloat(e.target.value) || 0 })}
                className="h-9"
                placeholder="opt" />
            </div>

            <div className="col-span-6 md:col-span-1 space-y-1">
              <Label className="text-xs">Rate/g</Label>
              <Input type="number" min="0" step="0.01" value={c.rate_per_gram || ''}
                onChange={(e) => updateRow(idx, { rate_per_gram: parseFloat(e.target.value) || 0 })}
                className="h-9"
                placeholder="opt" />
            </div>

            <div className="col-span-6 md:col-span-1 space-y-1">
              <Label className="text-xs">Unit Price</Label>
              <Input type="number" min="0" step="0.01" value={c.unit_price || ''}
                onChange={(e) => updateRow(idx, { unit_price: parseFloat(e.target.value) || 0 })}
                className="h-9" />
            </div>

            <div className="col-span-4 md:col-span-1 space-y-1">
              <Label className="text-xs">Total</Label>
              <div className="h-9 px-2 flex items-center text-sm font-medium border rounded-md bg-background">
                ₹{Number(c.total || 0).toFixed(2)}
              </div>
            </div>

            <div className="col-span-2 md:col-span-1 flex justify-end">
              <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(idx)} className="text-destructive h-9 w-9">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}

      <Button type="button" variant="outline" onClick={addRow}
        className="w-full border-dashed border-purple-400 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950">
        <Plus className="h-4 w-4 mr-2" /> Add Component
      </Button>

      {components.length > 0 && (
        <div className="flex justify-between items-center pt-3 text-xs border-t mt-2">
          <span className="text-muted-foreground italic">* Weight is optional and for reference only — it does not deduct inventory.</span>
          <div className="text-sm">
            <span className="text-muted-foreground mr-2">Components Total:</span>
            <span className="font-semibold">₹{totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      )}
    </div>
  );
};
