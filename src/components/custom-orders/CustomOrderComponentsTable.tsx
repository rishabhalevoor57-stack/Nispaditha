import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomOrderComponent } from '@/types/customOrder';

interface Props {
  components: CustomOrderComponent[];
  onChange: (next: CustomOrderComponent[]) => void;
}

const calcTotal = (c: CustomOrderComponent): number => {
  // Prefer qty x unit_price when unit_price > 0; else weight x rate_per_gram
  if (c.unit_price > 0) return Number(((c.quantity || 0) * c.unit_price).toFixed(2));
  return Number(((c.weight_grams || 0) * (c.rate_per_gram || 0)).toFixed(2));
};

export const CustomOrderComponentsTable = ({ components, onChange }: Props) => {
  const updateRow = (idx: number, patch: Partial<CustomOrderComponent>) => {
    const next = components.map((c, i) => {
      if (i !== idx) return c;
      const merged = { ...c, ...patch };
      merged.total = calcTotal(merged);
      return merged;
    });
    onChange(next);
  };

  const addRow = () => {
    onChange([
      ...components,
      {
        component_name: '',
        material: '',
        weight_grams: 0,
        quantity: 1,
        unit_price: 0,
        rate_per_gram: 0,
        total: 0,
      },
    ]);
  };

  const removeRow = (idx: number) => {
    onChange(components.filter((_, i) => i !== idx));
  };

  const totalWeight = components.reduce((s, c) => s + (Number(c.weight_grams) || 0) * (Number(c.quantity) || 0), 0);
  const totalCost = components.reduce((s, c) => s + (Number(c.total) || 0), 0);

  return (
    <div className="space-y-3">
      {components.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          No components added. Add hooks, clasps, stones, beads, etc.
        </p>
      )}

      {components.map((c, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-end border rounded-md p-3 bg-muted/30">
          <div className="col-span-12 md:col-span-2 space-y-1">
            <Label className="text-xs">Component</Label>
            <Input
              placeholder="Hook, Clasp..."
              value={c.component_name}
              onChange={(e) => updateRow(idx, { component_name: e.target.value })}
              className="h-9"
            />
          </div>
          <div className="col-span-6 md:col-span-2 space-y-1">
            <Label className="text-xs">Type / Material</Label>
            <Input
              placeholder="Gold, Silver..."
              value={c.material || ''}
              onChange={(e) => updateRow(idx, { material: e.target.value })}
              className="h-9"
            />
          </div>
          <div className="col-span-6 md:col-span-1 space-y-1">
            <Label className="text-xs">Wt (g)</Label>
            <Input
              type="number"
              min="0"
              step="0.001"
              value={c.weight_grams || ''}
              onChange={(e) => updateRow(idx, { weight_grams: parseFloat(e.target.value) || 0 })}
              className="h-9"
            />
          </div>
          <div className="col-span-6 md:col-span-1 space-y-1">
            <Label className="text-xs">Qty</Label>
            <Input
              type="number"
              min="1"
              value={c.quantity || ''}
              onChange={(e) => updateRow(idx, { quantity: parseInt(e.target.value) || 1 })}
              className="h-9"
            />
          </div>
          <div className="col-span-6 md:col-span-2 space-y-1">
            <Label className="text-xs">Rate/g (₹)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={c.rate_per_gram || ''}
              onChange={(e) => updateRow(idx, { rate_per_gram: parseFloat(e.target.value) || 0 })}
              className="h-9"
              disabled={c.unit_price > 0}
            />
          </div>
          <div className="col-span-6 md:col-span-2 space-y-1">
            <Label className="text-xs">Unit Price (₹)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={c.unit_price || ''}
              onChange={(e) => updateRow(idx, { unit_price: parseFloat(e.target.value) || 0 })}
              className="h-9"
            />
          </div>
          <div className="col-span-10 md:col-span-1 space-y-1">
            <Label className="text-xs">Total</Label>
            <div className="h-9 px-2 flex items-center text-sm font-medium border rounded-md bg-background">
              ₹{c.total.toFixed(2)}
            </div>
          </div>
          <div className="col-span-2 md:col-span-1 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeRow(idx)}
              className="text-destructive h-9 w-9"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addRow}
        className="w-full border-dashed border-purple-400 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Component
      </Button>

      {components.length > 0 && (
        <div className="flex justify-end gap-6 pt-2 text-sm border-t mt-2">
          <div>
            <span className="text-muted-foreground">Total Component Weight: </span>
            <span className="font-semibold">{totalWeight.toFixed(3)} g</span>
          </div>
          <div>
            <span className="text-muted-foreground">Total Component Cost: </span>
            <span className="font-semibold">₹{totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      )}
    </div>
  );
};
