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

// NOTE: Components are currently MANUAL-ENTRY only.
// Inventory integration (SKU picker, stock deduction, availability checks) is
// intentionally disabled until the full Components / Beads & Pearls inventory
// database has been populated. The backend schema (product_id, sku, category,
// unit, quantity_used, strings_used) and the send_custom_order_to_inventory_v2
// RPC remain in place so integration can be re-enabled with a simple toggle
// later — see plan.md.

// Cost = (unit qty × unit price) + optional weight × rate/g surcharge.
// Weight is now an optional field on every component (not a distinct unit).
const calcTotal = (c: CustomOrderComponent): number => {
  const weightCost = (c.weight_grams || 0) * (c.rate_per_gram || 0);
  let unitCost = 0;
  if (c.unit === 'quantity') {
    unitCost = (c.quantity_used || 0) * (c.unit_price || 0);
  } else if (c.unit === 'strings') {
    unitCost = (c.strings_used || 0) * (c.unit_price || 0);
  }
  return Number((unitCost + weightCost).toFixed(2));
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
        // manual entry — no product link
        product_id: null,
        sku: null,
        category: null,
        component_name: '',
        material: '',
        unit: 'quantity',
        weight_grams: 0,
        quantity: 1,
        quantity_used: 0,
        strings_used: 0,
        unit_price: 0,
        rate_per_gram: silverRate || 0,
        total: 0,
      },
    ]);
  };

  const removeRow = (idx: number) => onChange(components.filter((_, i) => i !== idx));

  const totalWeight = components.reduce((s, c) => s + (Number(c.weight_grams) || 0), 0);
  const totalQty = components.reduce((s, c) => c.unit === 'quantity' ? s + (Number(c.quantity_used) || 0) : s, 0);
  const totalStrings = components.reduce((s, c) => c.unit === 'strings' ? s + (Number(c.strings_used) || 0) : s, 0);
  const totalCost = components.reduce((s, c) => s + (Number(c.total) || 0), 0);

  return (
    <div className="space-y-3">
      {components.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          No components added. Click "Add Component" to enter one manually.
        </p>
      )}

      {components.map((c, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-end border rounded-md p-3 bg-muted/30">
          {/* Component Name (manual) */}
          <div className="col-span-12 md:col-span-3 space-y-1">
            <Label className="text-xs">Component Name</Label>
            <Input
              placeholder="e.g. Silver Hook, Jump Ring, Pearl Beads"
              value={c.component_name}
              onChange={(e) => updateRow(idx, { component_name: e.target.value })}
              className="h-9 text-sm"
            />
          </div>

          {/* Unit — Qty or Strings only. Weight is a separate optional field. */}
          <div className="col-span-6 md:col-span-1 space-y-1">
            <Label className="text-xs">Unit</Label>
            <Select
              value={c.unit === 'strings' ? 'strings' : 'quantity'}
              onValueChange={(v) => updateRow(idx, { unit: v as ComponentUnit })}
            >
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="quantity">Qty</SelectItem>
                <SelectItem value="strings">Strings</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Weight (optional, always editable) */}
          <div className="col-span-6 md:col-span-2 space-y-1">
            <Label className="text-xs">Weight (g) <span className="text-muted-foreground">(optional)</span></Label>
            <Input type="number" min="0" step="0.001" value={c.weight_grams || ''}
              onChange={(e) => updateRow(idx, { weight_grams: parseFloat(e.target.value) || 0 })}
              className="h-9" />
          </div>

          {/* Qty Used */}
          <div className="col-span-6 md:col-span-1 space-y-1">
            <Label className="text-xs">Qty Used</Label>
            <Input type="number" min="0" step="1" value={c.quantity_used || ''}
              disabled={c.unit !== 'quantity'}
              onChange={(e) => updateRow(idx, { quantity_used: parseInt(e.target.value) || 0 })}
              className="h-9" />
          </div>

          {/* Strings */}
          <div className="col-span-6 md:col-span-1 space-y-1">
            <Label className="text-xs">Strings</Label>
            <Input type="number" min="0" step="0.01" value={c.strings_used || ''}
              disabled={c.unit !== 'strings'}
              onChange={(e) => updateRow(idx, { strings_used: parseFloat(e.target.value) || 0 })}
              className="h-9" />
          </div>

          {/* Buying Price per unit + optional Rate/g */}
          <div className="col-span-6 md:col-span-2 space-y-1">
            <Label className="text-xs">Buying Price</Label>
            <Input type="number" min="0" step="0.01"
              value={c.unit_price || ''}
              onChange={(e) => updateRow(idx, { unit_price: parseFloat(e.target.value) || 0 })}
              className="h-9" />
          </div>

          {/* Buying cost */}
          <div className="col-span-8 md:col-span-1 space-y-1">
            <Label className="text-xs">Cost</Label>
            <div className="h-9 px-2 flex items-center text-sm font-medium border rounded-md bg-background">
              ₹{Number(c.total || 0).toFixed(2)}
            </div>
          </div>

          {/* Remove */}
          <div className="col-span-4 md:col-span-1 flex justify-end">
            <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(idx)} className="text-destructive h-9 w-9">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" onClick={addRow}
        className="w-full border-dashed border-purple-400 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950">
        <Plus className="h-4 w-4 mr-2" /> Add Component
      </Button>

      {components.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 text-sm border-t mt-2">
          <div><span className="text-muted-foreground">Total Weight: </span><span className="font-semibold">{totalWeight.toFixed(3)} g</span></div>
          <div><span className="text-muted-foreground">Total Qty: </span><span className="font-semibold">{totalQty}</span></div>
          <div><span className="text-muted-foreground">Total Strings: </span><span className="font-semibold">{totalStrings.toFixed(2)}</span></div>
          <div className="text-right"><span className="text-muted-foreground">Total Cost: </span><span className="font-semibold">₹{totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
        </div>
      )}
    </div>
  );
};
