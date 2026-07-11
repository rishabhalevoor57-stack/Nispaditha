import { useState, useEffect } from 'react';
import { Plus, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CustomOrderItem, MetalType, METAL_TYPE_LABELS } from '@/types/customOrder';
import { supabase } from '@/integrations/supabase/client';

interface InventoryProduct {
  id: string;
  sku: string;
  name: string;
  weight_grams: number;
  quantity: number;
  selling_price: number;
  making_charges: number;
  price_per_gram: number;
  pricing_mode: string;
  mrp: number;
  categories?: { name: string } | null;
  locked_by_custom_order_id?: string | null;
}

interface MetalRates {
  silver: number;
  gold_22k: number;
  gold_18k: number;
  gold_24k: number;
}

interface CustomOrderItemsTableProps {
  items: CustomOrderItem[];
  onChange: (items: CustomOrderItem[]) => void;
  silverRate: number;
  metalRates?: MetalRates;
  readOnly?: boolean;
  orderId?: string;
}

export const CustomOrderItemsTable = ({ items, onChange, silverRate, metalRates, readOnly, orderId }: CustomOrderItemsTableProps) => {
  const rates: MetalRates = metalRates || { silver: silverRate, gold_22k: 0, gold_18k: 0, gold_24k: 0 };
  const rateForMetal = (m?: MetalType): number => {
    switch (m) {
      case 'gold_18k': return rates.gold_18k;
      case 'gold_22k': return rates.gold_22k;
      case 'gold_24k': return rates.gold_24k;
      default: return rates.silver;
    }
  };
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [searchTerms, setSearchTerms] = useState<Record<number, string>>({});
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from('products')
        .select('id, sku, name, description, weight_grams, quantity, selling_price, making_charges, price_per_gram, pricing_mode, mrp, locked_by_custom_order_id, categories(name)')
        .is('deleted_at', null)
        .order('name');
      setProducts((data || []) as unknown as InventoryProduct[]);
    };
    fetchProducts();
  }, []);


  const isBeadsCategory = (category?: string | null) => {
    const n = (category || '').toLowerCase();
    return n.includes('bead') || n.includes('pearl');
  };

  const recalculate = (item: CustomOrderItem): CustomOrderItem => {
    const isBeads = isBeadsCategory(item.category);

    // Beads/pearls: strings × rate/g (kept as-is, this is the domain convention)
    if (isBeads) {
      const grossPrice = item.rate_per_gram * item.quantity;
      const discount = item.discount_type === 'percentage'
        ? grossPrice * (item.discount_value / 100)
        : item.discount_value;
      return {
        ...item,
        base_price: grossPrice,
        mc_per_gram: 0,
        mc_amount: 0,
        discount_on_mc: 0,
        discount: Math.min(grossPrice, discount),
        item_total: Math.max(0, grossPrice - Math.min(grossPrice, discount)),
      };
    }

    // For BOTH weight-based and flat modes, the line total is now:
    //   Unit Price × Qty − Discount
    // Weight, Rate/g and MC/g remain on the row as informational reference
    // fields (visible on the order bill / invoice) but do NOT drive the total.
    // This matches the "weight is reference only" rule for Custom Orders.
    const unitPrice = Number(item.flat_price) || 0;
    const qty = Number(item.quantity) || 1;
    const grossPrice = unitPrice * qty;

    const discount = item.discount_type === 'percentage'
      ? grossPrice * (item.discount_value / 100)
      : item.discount_value;

    // Keep base_price / mc_amount populated for reference/reporting compatibility
    const referenceGold = (Number(item.expected_weight) || 0) * (Number(item.rate_per_gram) || 0) * qty;
    const referenceMc = (Number(item.expected_weight) || 0) * (Number(item.mc_per_gram) || 0) * qty;

    return {
      ...item,
      base_price: referenceGold,
      mc_amount: referenceMc,
      discount: Math.min(grossPrice, discount),
      item_total: Math.max(0, grossPrice - Math.min(grossPrice, discount)),
    };
  };

  const handleSelectProduct = (index: number, product: InventoryProduct) => {
    const category = product.categories?.name || '';
    const isBeads = isBeadsCategory(category);
    const pricingMode = (product.pricing_mode === 'flat_price' || isBeads) ? 'flat_price' : 'weight_based';

    const updated = items.map((item, i) => {
      if (i !== index) return item;
      const newItem: CustomOrderItem = {
        ...item,
        product_id: product.id,
        sku: product.sku,
        item_description: product.name,
        category,
        expected_weight: product.weight_grams || 0,
        pricing_mode: isBeads ? 'flat_price' : (pricingMode as 'weight_based' | 'flat_price'),
        rate_per_gram: pricingMode === 'weight_based' ? (product.price_per_gram || silverRate) : (isBeads ? product.selling_price : 0),
        mc_per_gram: (pricingMode === 'weight_based' && !isBeads) ? product.making_charges : 0,
        // Unit Price drives the total for both modes now. Seed from the product's
        // selling_price/mrp (or weight × price_per_gram as a fallback) so the row
        // starts with a sensible number that the user can override.
        flat_price: isBeads
          ? 0
          : (product.selling_price
              || product.mrp
              || ((product.weight_grams || 0) * (product.price_per_gram || silverRate))
              || 0),
        quantity: 1,
        discount_on_mc: 0,
        discount: 0,
        discount_type: 'fixed',
        discount_value: 0,
      };
      return recalculate(newItem);
    });
    onChange(updated);
    setSearchTerms(prev => ({ ...prev, [index]: '' }));
    setOpenDropdown(null);
  };

  const addItem = () => {
    onChange([
      ...items,
      {
        item_description: '',
        product_id: null,
        sku: null,
        category: null,
        customization_notes: '',
        quantity: 1,
        expected_weight: 0,
        pricing_mode: 'weight_based',
        metal_type: 'silver',
        flat_price: 0,
        mc_per_gram: 0,
        discount_on_mc: 0,
        rate_per_gram: rates.silver,
        base_price: 0,
        mc_amount: 0,
        discount: 0,
        discount_type: 'fixed',
        discount_value: 0,
        item_total: 0,
      },
    ]);
  };

  const updateItem = (index: number, field: keyof CustomOrderItem, value: string | number) => {
    const updated = items.map((item, i) => {
      if (i !== index) return item;
      let newItem: CustomOrderItem = { ...item, [field]: value } as CustomOrderItem;

      if (field === 'pricing_mode') {
        if (value === 'flat_price') {
          newItem.mc_per_gram = 0;
          newItem.mc_amount = 0;
          newItem.discount_on_mc = 0;
        }
      }

      // When metal changes, refresh rate_per_gram (only if we're weight-based & not a linked inventory SKU)
      if (field === 'metal_type') {
        const r = rateForMetal(value as MetalType);
        if (!item.product_id) {
          newItem.rate_per_gram = r;
        }
      }

      return recalculate(newItem);
    });
    onChange(updated);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const getFilteredProducts = (term: string) => {
    if (!term || term.length < 1) return [];
    const t = term.toLowerCase().trim();
    return products
      .filter(p => {
        const isLocked = p.locked_by_custom_order_id && p.locked_by_custom_order_id !== orderId;
        if (isLocked) return false;
        const catName = (p.categories?.name || '').toLowerCase();
        const desc = ((p as any).description || '').toLowerCase();
        return (
          p.sku.toLowerCase().includes(t) ||
          p.name.toLowerCase().includes(t) ||
          desc.includes(t) ||
          catName.includes(t)
        );
      })
      .slice(0, 50);
  };


  const grandTotal = items.reduce((sum, item) => sum + item.item_total, 0);

  if (readOnly) {
    return (
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">SKU</TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="w-[80px]">Mode</TableHead>
              <TableHead className="w-[60px] text-center">Qty</TableHead>
              <TableHead className="w-[80px] text-right">Weight</TableHead>
              <TableHead className="w-[90px] text-right">Rate</TableHead>
              <TableHead className="w-[80px] text-right">MC/g</TableHead>
              <TableHead className="w-[90px] text-right">Discount</TableHead>
              <TableHead className="w-[100px] text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-6">No items</TableCell>
              </TableRow>
            ) : (
              <>
                {items.map((item, i) => {
                  const isBeads = isBeadsCategory(item.category);
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs text-primary">{item.sku || '-'}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{item.item_description}</div>
                        {item.category && <div className="text-xs text-muted-foreground">{item.category}</div>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {isBeads ? 'Beads' : item.pricing_mode === 'flat_price' ? 'Flat' : 'Normal'}
                      </TableCell>
                      <TableCell className="text-center">{item.quantity}{isBeads ? ' str' : ''}</TableCell>
                      <TableCell className="text-right">
                        {item.pricing_mode === 'weight_based' && !isBeads ? `${item.expected_weight}g` : '-'}
                      </TableCell>
                      <TableCell className="text-right">₹{item.rate_per_gram.toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-right">
                        {item.pricing_mode === 'weight_based' && !isBeads ? `₹${item.mc_per_gram}` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.discount > 0 ? `₹${item.discount.toLocaleString('en-IN')}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold">₹{item.item_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell colSpan={8} className="text-right">Items Total:</TableCell>
                  <TableCell className="text-right">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-[1280px]">
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="min-w-[200px]">SKU / Product</TableHead>
              <TableHead className="min-w-[110px]">Metal</TableHead>
              <TableHead className="min-w-[110px]">Mode</TableHead>
              <TableHead className="min-w-[90px] text-center">Qty</TableHead>
              <TableHead className="min-w-[100px]" title="Reference only — does not affect price">Weight(g) *</TableHead>
              <TableHead className="min-w-[110px]" title="Reference only — does not affect price">Rate *</TableHead>
              <TableHead className="min-w-[100px]" title="Reference only — does not affect price">MC/g *</TableHead>
              <TableHead className="min-w-[90px]" title="Reference only">MC Disc% *</TableHead>
              <TableHead className="min-w-[110px]">Unit Price ₹</TableHead>
              <TableHead className="min-w-[140px]">Discount</TableHead>
              <TableHead className="min-w-[120px] text-right">Total</TableHead>
              <TableHead className="w-[44px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                  No items added. Click "Add Item" to start.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => {
                const isBeads = isBeadsCategory(item.category);
                const isFlat = item.pricing_mode === 'flat_price' || isBeads;
                const searchTerm = searchTerms[index] || '';
                const filtered = getFilteredProducts(searchTerm);

                return (
                  <><TableRow key={index} className="align-top">
                    {/* SKU / Product */}
                    <TableCell className="py-3">
                      <div className="relative">
                        {item.product_id ? (
                          <div className="space-y-0.5">
                            <div className="font-mono text-xs text-primary font-semibold">{item.sku}</div>
                            <div className="text-sm font-medium leading-tight">{item.item_description}</div>
                            {item.category && <div className="text-xs text-muted-foreground">{item.category}</div>}
                            <Button
                              variant="link"
                              size="sm"
                              className="h-5 px-0 text-xs text-muted-foreground hover:text-primary"
                              onClick={() => {
                                const updated = [...items];
                                updated[index] = {
                                  ...updated[index],
                                  product_id: null,
                                  sku: null,
                                  item_description: '',
                                  category: null,
                                  expected_weight: 0,
                                  rate_per_gram: silverRate,
                                  mc_per_gram: 0,
                                  flat_price: 0,
                                };
                                onChange(updated.map(it => recalculate(it)));
                              }}
                            >
                              Change SKU
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="relative">
                              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                              <Input
                                placeholder="Search SKU..."
                                value={searchTerm}
                                onChange={(e) => {
                                  setSearchTerms(prev => ({ ...prev, [index]: e.target.value }));
                                  setOpenDropdown(index);
                                }}
                                onFocus={() => searchTerm && setOpenDropdown(index)}
                                onBlur={() => setTimeout(() => setOpenDropdown(null), 200)}
                                className="pl-8 h-9 text-sm"
                              />
                            </div>
                            {openDropdown === index && filtered.length > 0 && (
                              <div className="absolute z-50 mt-1 w-72 bg-popover border rounded-md shadow-lg max-h-52 overflow-y-auto">
                                {filtered.map((p) => (
                                  <button
                                    key={p.id}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => handleSelectProduct(index, p)}
                                    className="w-full px-3 py-2 text-left hover:bg-accent transition-colors border-b last:border-0"
                                  >
                                    <span className="font-mono text-xs text-primary font-semibold">{p.sku}</span>
                                    <p className="text-sm font-medium">{p.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {p.weight_grams}g • {p.categories?.name || '-'} • Stock: {p.quantity}
                                    </p>
                                  </button>
                                ))}
                              </div>
                            )}
                            <Input
                              placeholder="Or type name"
                              value={item.item_description}
                              onChange={(e) => updateItem(index, 'item_description', e.target.value)}
                              className="h-9 text-sm"
                            />
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Metal */}
                    <TableCell className="py-3">
                      <Select
                        value={(item.metal_type as MetalType) || 'silver'}
                        onValueChange={(v) => updateItem(index, 'metal_type' as any, v)}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(METAL_TYPE_LABELS) as MetalType[]).map(m => (
                            <SelectItem key={m} value={m}>{METAL_TYPE_LABELS[m]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        ₹{rateForMetal((item.metal_type as MetalType) || 'silver').toLocaleString('en-IN')}/g
                      </div>
                    </TableCell>

                    {/* Mode */}
                    <TableCell className="py-3">
                      {isBeads ? (
                        <span className="text-xs font-medium px-2 py-1 rounded bg-accent text-accent-foreground">Beads</span>
                      ) : (
                        <Select
                          value={item.pricing_mode}
                          onValueChange={(v) => updateItem(index, 'pricing_mode', v)}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="weight_based">Normal</SelectItem>
                            <SelectItem value="flat_price">Flat</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>

                    {/* Quantity */}
                    <TableCell className="py-3">
                      <div className="space-y-0.5">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                          className="h-9 text-sm text-center w-full"
                        />
                        {isBeads && <span className="text-[10px] text-muted-foreground block text-center">strings</span>}
                      </div>
                    </TableCell>

                    {/* Weight */}
                    <TableCell className="py-3">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.expected_weight || ''}
                        onChange={(e) => updateItem(index, 'expected_weight', parseFloat(e.target.value) || 0)}
                        className="h-9 text-sm"
                        placeholder="0"
                      />
                    </TableCell>

                    {/* Rate */}
                    <TableCell className="py-3">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.rate_per_gram || ''}
                        onChange={(e) => updateItem(index, 'rate_per_gram', parseFloat(e.target.value) || 0)}
                        className="h-9 text-sm"
                        placeholder="0"
                      />
                    </TableCell>

                    {/* MC/g */}
                    <TableCell className="py-3">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.mc_per_gram || ''}
                        onChange={(e) => updateItem(index, 'mc_per_gram', parseFloat(e.target.value) || 0)}
                        disabled={isFlat}
                        className="h-9 text-sm disabled:opacity-40"
                        placeholder="0"
                      />
                    </TableCell>

                    {/* MC Disc% */}
                    <TableCell className="py-3">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={item.discount_on_mc || ''}
                        onChange={(e) => updateItem(index, 'discount_on_mc', parseFloat(e.target.value) || 0)}
                        disabled={isFlat}
                        className="h-9 text-sm disabled:opacity-40"
                        placeholder="0"
                      />
                    </TableCell>

                    {/* Unit Price (drives the total in both Normal and Flat modes) */}
                    <TableCell className="py-3">
                      <Input
                        type="number"
                        min="0"
                        value={item.flat_price || ''}
                        onChange={(e) => updateItem(index, 'flat_price', parseFloat(e.target.value) || 0)}
                        disabled={isBeads}
                        className="h-9 text-sm disabled:opacity-40"
                        placeholder="0"
                      />
                    </TableCell>

                    {/* Discount */}
                    <TableCell className="py-3">
                      <div className="flex gap-1 items-center">
                        <Input
                          type="number"
                          min="0"
                          value={item.discount_value || ''}
                          onChange={(e) => updateItem(index, 'discount_value', parseFloat(e.target.value) || 0)}
                          className="h-9 text-sm flex-1 min-w-[50px]"
                          placeholder="0"
                        />
                        <Select
                          value={item.discount_type}
                          onValueChange={(v) => updateItem(index, 'discount_type', v)}
                        >
                          <SelectTrigger className="h-9 w-14 text-xs px-1.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">₹</SelectItem>
                            <SelectItem value="percentage">%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>

                    {/* Total */}
                    <TableCell className="text-right font-semibold py-3 text-sm">
                      ₹{item.item_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>

                    {/* Delete */}
                    <TableCell className="py-3">
                      <Button variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-8 w-8">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  <TableRow key={`${index}-desc`} className="border-t-0">
                    <TableCell colSpan={12} className="py-2 pl-4">
                      <Input
                        placeholder="Description (optional) — notes, customisation, instructions..."
                        value={item.customization_notes || ''}
                        onChange={(e) => updateItem(index, 'customization_notes', e.target.value)}
                        className="h-8 text-xs bg-muted/30"
                      />
                    </TableCell>
                  </TableRow>
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>
        {items.length > 0 && (
          <div className="text-right font-semibold text-base">
            Items Total: ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        )}
      </div>
    </div>
  );
};
