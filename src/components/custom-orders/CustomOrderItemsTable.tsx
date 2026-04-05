import { useState, useEffect } from 'react';
import { Plus, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CustomOrderItem } from '@/types/customOrder';
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

interface CustomOrderItemsTableProps {
  items: CustomOrderItem[];
  onChange: (items: CustomOrderItem[]) => void;
  silverRate: number;
  readOnly?: boolean;
  orderId?: string;
}

export const CustomOrderItemsTable = ({ items, onChange, silverRate, readOnly, orderId }: CustomOrderItemsTableProps) => {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [searchTerms, setSearchTerms] = useState<Record<number, string>>({});
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from('products')
        .select('*, categories(name)')
        .is('deleted_at', null)
        .gt('quantity', 0)
        .order('name');
      setProducts((data || []) as unknown as InventoryProduct[]);
    };
    fetchProducts();
  }, []);

  const isBeadsCategory = (category?: string | null) => {
    return category?.toLowerCase() === 'beads';
  };

  const recalculate = (item: CustomOrderItem): CustomOrderItem => {
    const isBeads = isBeadsCategory(item.category);

    if (item.pricing_mode === 'flat_price' || isBeads) {
      const grossPrice = isBeads
        ? item.rate_per_gram * item.quantity
        : item.flat_price * item.quantity;
      
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

    // Weight-based (Normal mode)
    const basePrice = item.expected_weight * item.rate_per_gram * item.quantity;
    const grossMc = item.expected_weight * item.mc_per_gram * item.quantity;
    const mcDiscount = grossMc * (item.discount_on_mc / 100);
    const mcAmount = grossMc - mcDiscount;
    const subtotal = basePrice + mcAmount;
    
    const discount = item.discount_type === 'percentage'
      ? subtotal * (item.discount_value / 100)
      : item.discount_value;
    
    return {
      ...item,
      base_price: basePrice,
      mc_amount: mcAmount,
      discount: Math.min(subtotal, discount),
      item_total: Math.max(0, subtotal - Math.min(subtotal, discount)),
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
        flat_price: pricingMode === 'flat_price' && !isBeads ? product.selling_price : 0,
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
        flat_price: 0,
        mc_per_gram: 0,
        discount_on_mc: 0,
        rate_per_gram: silverRate,
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
      let newItem = { ...item, [field]: value };
      
      if (field === 'pricing_mode') {
        if (value === 'flat_price') {
          newItem.mc_per_gram = 0;
          newItem.mc_amount = 0;
          newItem.discount_on_mc = 0;
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
        const alreadyAdded = items.some(item => item.product_id === p.id);
        const isLocked = p.locked_by_custom_order_id && p.locked_by_custom_order_id !== orderId;
        return !alreadyAdded && !isLocked && (
          p.sku.toLowerCase().includes(t) ||
          p.name.toLowerCase().includes(t)
        );
      })
      .slice(0, 10);
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
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="min-w-[180px]">SKU / Product</TableHead>
              <TableHead className="w-[100px]">Mode</TableHead>
              <TableHead className="w-[80px] text-center">Qty</TableHead>
              <TableHead className="w-[90px]">Weight(g)</TableHead>
              <TableHead className="w-[100px]">Rate</TableHead>
              <TableHead className="w-[90px]">MC/g</TableHead>
              <TableHead className="w-[80px]">MC Disc%</TableHead>
              <TableHead className="w-[100px]">Flat ₹</TableHead>
              <TableHead className="w-[120px]">Discount</TableHead>
              <TableHead className="w-[110px] text-right">Total</TableHead>
              <TableHead className="w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
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
                  <TableRow key={index} className="align-top">
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

                    {/* Flat ₹ */}
                    <TableCell className="py-3">
                      <Input
                        type="number"
                        min="0"
                        value={item.flat_price || ''}
                        onChange={(e) => updateItem(index, 'flat_price', parseFloat(e.target.value) || 0)}
                        disabled={!isFlat || isBeads}
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
