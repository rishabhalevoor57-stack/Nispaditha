import { useState, useEffect, useMemo } from 'react';
import { Plus, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CustomOrderComponent, ComponentUnit } from '@/types/customOrder';
import { supabase } from '@/integrations/supabase/client';

interface InventoryLite {
  id: string;
  sku: string;
  name: string;
  weight_grams: number;
  quantity: number;
  strings_count: number | null;
  purchase_price: number;
  selling_price: number;
  price_per_gram: number;
  purchase_price_per_gram: number;
  categories?: { name: string } | null;
}

interface Props {
  components: CustomOrderComponent[];
  onChange: (next: CustomOrderComponent[]) => void;
  silverRate?: number;
}

const inferUnit = (categoryName: string | null | undefined): ComponentUnit => {
  const n = (categoryName || '').toLowerCase();
  if (n.includes('bead') || n.includes('pearl')) return 'strings';
  return 'weight_based';
};

const calcTotal = (c: CustomOrderComponent): number => {
  if (c.unit === 'quantity') {
    return Number(((c.quantity_used || 0) * (c.unit_price || 0)).toFixed(2));
  }
  if (c.unit === 'strings') {
    return Number(((c.strings_used || 0) * (c.unit_price || 0)).toFixed(2));
  }
  // weight_based
  const w = (c.weight_grams || 0) * (c.quantity || 1);
  if (c.rate_per_gram > 0) return Number((w * c.rate_per_gram).toFixed(2));
  return Number(((c.unit_price || 0) * (c.quantity || 1)).toFixed(2));
};

export const CustomOrderComponentsTable = ({ components, onChange, silverRate = 0 }: Props) => {
  const [inventory, setInventory] = useState<InventoryLite[]>([]);
  const [searchTerms, setSearchTerms] = useState<Record<number, string>>({});
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('products')
        .select('id, sku, name, weight_grams, quantity, strings_count, purchase_price, selling_price, price_per_gram, purchase_price_per_gram, categories(name)')
        .is('deleted_at', null)
        .order('name');
      setInventory((data || []) as unknown as InventoryLite[]);
    })();
  }, []);

  const inventoryById = useMemo(() => new Map(inventory.map(p => [p.id, p])), [inventory]);

  const updateRow = (idx: number, patch: Partial<CustomOrderComponent>) => {
    const next = components.map((c, i) => {
      if (i !== idx) return c;
      const merged = { ...c, ...patch } as CustomOrderComponent;
      merged.total = calcTotal(merged);
      return merged;
    });
    onChange(next);
  };

  const linkProduct = (idx: number, p: InventoryLite) => {
    const catName = p.categories?.name || null;
    const unit = inferUnit(catName);
    updateRow(idx, {
      product_id: p.id,
      sku: p.sku,
      category: catName,
      component_name: p.name,
      unit,
      weight_grams: unit === 'weight_based' ? (p.weight_grams || 0) : 0,
      quantity: 1,
      quantity_used: unit === 'quantity' ? 1 : 0,
      strings_used: unit === 'strings' ? 1 : 0,
      unit_price: p.purchase_price || 0,
      rate_per_gram: unit === 'weight_based' ? (p.purchase_price_per_gram || silverRate || 0) : 0,
    });
    setSearchTerms(prev => ({ ...prev, [idx]: '' }));
    setOpenDropdown(null);
  };

  const addRow = () => {
    onChange([
      ...components,
      {
        component_name: '',
        material: '',
        unit: 'weight_based',
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

  const filteredFor = (term: string) => {
    const t = (term || '').toLowerCase().trim();
    if (!t) return [];
    return inventory.filter(p => p.sku.toLowerCase().includes(t) || p.name.toLowerCase().includes(t)).slice(0, 12);
  };

  const totalWeight = components.reduce((s, c) => c.unit === 'weight_based' ? s + (Number(c.weight_grams) || 0) * (Number(c.quantity) || 1) : s, 0);
  const totalQty = components.reduce((s, c) => c.unit === 'quantity' ? s + (Number(c.quantity_used) || 0) : s, 0);
  const totalStrings = components.reduce((s, c) => c.unit === 'strings' ? s + (Number(c.strings_used) || 0) : s, 0);
  const totalCost = components.reduce((s, c) => s + (Number(c.total) || 0), 0);

  return (
    <div className="space-y-3">
      {components.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          No components added. Click "Add Component" to pick from inventory.
        </p>
      )}

      {components.map((c, idx) => {
        const linked = c.product_id ? inventoryById.get(c.product_id) : null;
        const availableStock = linked
          ? c.unit === 'weight_based' ? `${(linked.weight_grams || 0).toFixed(3)} g`
            : c.unit === 'quantity' ? `${linked.quantity} pcs`
            : `${(linked.strings_count || 0).toFixed(2)} strings`
          : '—';
        const usedValue = c.unit === 'weight_based' ? (c.weight_grams || 0) * (c.quantity || 1)
          : c.unit === 'quantity' ? (c.quantity_used || 0)
          : (c.strings_used || 0);
        const availableNum = linked
          ? c.unit === 'weight_based' ? linked.weight_grams || 0
            : c.unit === 'quantity' ? linked.quantity
            : linked.strings_count || 0
          : Infinity;
        const insufficient = linked && usedValue > availableNum;

        return (
          <div key={idx} className={`grid grid-cols-12 gap-2 items-end border rounded-md p-3 bg-muted/30 ${insufficient ? 'border-destructive' : ''}`}>
            {/* SKU / Component picker */}
            <div className="col-span-12 md:col-span-3 space-y-1 relative">
              <Label className="text-xs">SKU / Component</Label>
              {c.product_id ? (
                <div className="space-y-0.5">
                  <div className="font-mono text-xs text-primary font-semibold">{c.sku}</div>
                  <div className="text-sm font-medium leading-tight">{c.component_name}</div>
                  {c.category && <div className="text-[10px] text-muted-foreground">{c.category}</div>}
                  <button type="button" className="text-[10px] text-muted-foreground hover:text-primary underline"
                    onClick={() => updateRow(idx, { product_id: null, sku: null, category: null })}>
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search SKU or name"
                      value={searchTerms[idx] || ''}
                      onChange={(e) => { setSearchTerms(p => ({ ...p, [idx]: e.target.value })); setOpenDropdown(idx); }}
                      onFocus={() => setOpenDropdown(idx)}
                      onBlur={() => setTimeout(() => setOpenDropdown(null), 200)}
                      className="pl-8 h-9 text-sm"
                    />
                  </div>
                  {openDropdown === idx && filteredFor(searchTerms[idx] || '').length > 0 && (
                    <div className="absolute z-50 mt-1 w-72 bg-popover border rounded-md shadow-lg max-h-52 overflow-y-auto">
                      {filteredFor(searchTerms[idx] || '').map((p) => (
                        <button key={p.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => linkProduct(idx, p)}
                          className="w-full px-3 py-2 text-left hover:bg-accent border-b last:border-0">
                          <span className="font-mono text-xs text-primary font-semibold">{p.sku}</span>
                          <p className="text-sm font-medium">{p.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {p.categories?.name || '—'} • {p.weight_grams}g • Stock: {p.quantity} • Strings: {p.strings_count ?? 0}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                  <Input placeholder="Or free-text name" value={c.component_name}
                    onChange={(e) => updateRow(idx, { component_name: e.target.value })} className="h-9 text-sm" />
                </>
              )}
            </div>

            {/* Unit */}
            <div className="col-span-6 md:col-span-1 space-y-1">
              <Label className="text-xs">Unit</Label>
              <Select value={c.unit || 'weight_based'} onValueChange={(v) => updateRow(idx, { unit: v as ComponentUnit })}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weight_based">Weight</SelectItem>
                  <SelectItem value="quantity">Qty</SelectItem>
                  <SelectItem value="strings">Strings</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Available stock */}
            <div className="col-span-6 md:col-span-1 space-y-1">
              <Label className="text-xs">Available</Label>
              <div className="h-9 px-2 flex items-center text-xs border rounded-md bg-background">{availableStock}</div>
            </div>

            {/* Weight fields */}
            <div className="col-span-6 md:col-span-1 space-y-1">
              <Label className="text-xs">Wt (g)</Label>
              <Input type="number" min="0" step="0.001" value={c.weight_grams || ''} disabled={c.unit !== 'weight_based'}
                onChange={(e) => updateRow(idx, { weight_grams: parseFloat(e.target.value) || 0 })} className="h-9" />
            </div>

            {/* Qty Used */}
            <div className="col-span-6 md:col-span-1 space-y-1">
              <Label className="text-xs">Qty Used</Label>
              <Input type="number" min="0" step="1" value={c.quantity_used || ''} disabled={c.unit !== 'quantity'}
                onChange={(e) => updateRow(idx, { quantity_used: parseInt(e.target.value) || 0 })} className="h-9" />
            </div>

            {/* Strings Used */}
            <div className="col-span-6 md:col-span-1 space-y-1">
              <Label className="text-xs">Strings</Label>
              <Input type="number" min="0" step="0.01" value={c.strings_used || ''} disabled={c.unit !== 'strings'}
                onChange={(e) => updateRow(idx, { strings_used: parseFloat(e.target.value) || 0 })} className="h-9" />
            </div>

            {/* Rate / Unit price */}
            <div className="col-span-6 md:col-span-1 space-y-1">
              <Label className="text-xs">{c.unit === 'weight_based' ? 'Rate/g' : 'Buying'}</Label>
              <Input type="number" min="0" step="0.01"
                value={c.unit === 'weight_based' ? (c.rate_per_gram || '') : (c.unit_price || '')}
                onChange={(e) => updateRow(idx,
                  c.unit === 'weight_based'
                    ? { rate_per_gram: parseFloat(e.target.value) || 0 }
                    : { unit_price: parseFloat(e.target.value) || 0 }
                )} className="h-9" />
            </div>

            {/* Buying cost */}
            <div className="col-span-8 md:col-span-2 space-y-1">
              <Label className="text-xs">Buying Cost</Label>
              <div className="h-9 px-2 flex items-center text-sm font-medium border rounded-md bg-background">
                ₹{Number(c.total || 0).toFixed(2)}
              </div>
              {insufficient && <span className="text-[10px] text-destructive">Exceeds stock</span>}
            </div>

            {/* Remove */}
            <div className="col-span-4 md:col-span-1 flex justify-end">
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
