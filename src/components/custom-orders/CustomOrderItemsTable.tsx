import { Plus, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CustomOrderItem } from '@/types/customOrder';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface CustomOrderItemsTableProps {
  items: CustomOrderItem[];
  onChange: (items: CustomOrderItem[]) => void;
  silverRate: number;
  readOnly?: boolean;
}

export const CustomOrderItemsTable = ({ items, onChange, silverRate, readOnly }: CustomOrderItemsTableProps) => {
  const addItem = () => {
    onChange([
      ...items,
      {
        item_description: '',
        customization_notes: '',
        reference_image_url: '',
        quantity: 1,
        expected_weight: 0,
        pricing_mode: 'weight_based',
        flat_price: 0,
        mc_per_gram: 0,
        discount_on_mc: 0,
        rate_per_gram: silverRate,
        base_price: 0,
        mc_amount: 0,
        item_total: 0,
      },
    ]);
  };

  const recalculate = (item: CustomOrderItem): CustomOrderItem => {
    if (item.pricing_mode === 'flat_price') {
      return { ...item, base_price: 0, mc_amount: 0, item_total: item.flat_price * item.quantity };
    }
    const basePrice = item.expected_weight * item.rate_per_gram * item.quantity;
    const grossMc = item.expected_weight * item.mc_per_gram * item.quantity;
    const mcAmount = grossMc - (grossMc * item.discount_on_mc / 100);
    const itemTotal = basePrice + mcAmount;
    return { ...item, base_price: basePrice, mc_amount: mcAmount, item_total: itemTotal };
  };

  const updateItem = (index: number, field: keyof CustomOrderItem, value: string | number) => {
    const updated = items.map((item, i) => {
      if (i !== index) return item;
      const newItem = { ...item, [field]: value };
      return recalculate(newItem);
    });
    onChange(updated);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleImageUpload = async (index: number, file: File) => {
    const ext = file.name.split('.').pop();
    const path = `custom-orders/${Date.now()}-${index}.${ext}`;
    const { error } = await supabase.storage.from('product-images').upload(path, file);
    if (error) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);
    updateItem(index, 'reference_image_url', publicUrl);
  };

  const grandTotal = items.reduce((sum, item) => sum + item.item_total, 0);

  if (readOnly) {
    return (
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead className="text-center">Qty</TableHead>
              <TableHead className="text-right">Weight</TableHead>
              <TableHead className="text-right">Rate/g</TableHead>
              <TableHead className="text-right">MC/g</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">No items</TableCell>
              </TableRow>
            ) : (
              <>
                {items.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div>{item.item_description}</div>
                      {item.customization_notes && (
                        <div className="text-xs text-muted-foreground mt-1">{item.customization_notes}</div>
                      )}
                      {item.reference_image_url && (
                        <img src={item.reference_image_url} alt="Reference" className="w-12 h-12 object-cover rounded mt-1" />
                      )}
                    </TableCell>
                    <TableCell className="capitalize">{item.pricing_mode.replace('_', ' ')}</TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right">{item.pricing_mode === 'weight_based' ? `${item.expected_weight}g` : '-'}</TableCell>
                    <TableCell className="text-right">{item.pricing_mode === 'weight_based' ? `₹${item.rate_per_gram}` : '-'}</TableCell>
                    <TableCell className="text-right">
                      {item.pricing_mode === 'weight_based' ? (
                        <div>
                          <div>₹{item.mc_per_gram}</div>
                          {item.discount_on_mc > 0 && <div className="text-xs text-muted-foreground">-{item.discount_on_mc}%</div>}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">₹{item.item_total.toLocaleString('en-IN')}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell colSpan={6} className="text-right">Items Total:</TableCell>
                  <TableCell className="text-right">₹{grandTotal.toLocaleString('en-IN')}</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">Item Description</TableHead>
              <TableHead className="min-w-[120px]">Notes</TableHead>
              <TableHead className="w-[90px]">Image</TableHead>
              <TableHead className="w-[100px]">Mode</TableHead>
              <TableHead className="w-[70px]">Qty</TableHead>
              <TableHead className="w-[90px]">Weight(g)</TableHead>
              <TableHead className="w-[90px]">Rate/g</TableHead>
              <TableHead className="w-[90px]">MC/g</TableHead>
              <TableHead className="w-[80px]">MC Disc%</TableHead>
              <TableHead className="w-[90px]">Flat ₹</TableHead>
              <TableHead className="w-[100px] text-right">Total</TableHead>
              <TableHead className="w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground">
                  No items added. Click "Add Item" to start.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Input
                      placeholder="Item description"
                      value={item.item_description}
                      onChange={(e) => updateItem(index, 'item_description', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Textarea
                      placeholder="Notes..."
                      value={item.customization_notes || ''}
                      onChange={(e) => updateItem(index, 'customization_notes', e.target.value)}
                      className="min-h-[50px]"
                    />
                  </TableCell>
                  <TableCell>
                    {item.reference_image_url ? (
                      <img src={item.reference_image_url} alt="Ref" className="w-10 h-10 object-cover rounded cursor-pointer" />
                    ) : (
                      <label className="cursor-pointer">
                        <Upload className="h-4 w-4 text-muted-foreground" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(index, file);
                          }}
                        />
                      </label>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={item.pricing_mode}
                      onValueChange={(v) => updateItem(index, 'pricing_mode', v)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weight_based">Weight</SelectItem>
                        <SelectItem value="flat_price">Flat</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number" min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number" min="0" step="0.01"
                      value={item.expected_weight}
                      onChange={(e) => updateItem(index, 'expected_weight', parseFloat(e.target.value) || 0)}
                      disabled={item.pricing_mode === 'flat_price'}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number" min="0" step="0.01"
                      value={item.rate_per_gram}
                      onChange={(e) => updateItem(index, 'rate_per_gram', parseFloat(e.target.value) || 0)}
                      disabled={item.pricing_mode === 'flat_price'}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number" min="0" step="0.01"
                      value={item.mc_per_gram}
                      onChange={(e) => updateItem(index, 'mc_per_gram', parseFloat(e.target.value) || 0)}
                      disabled={item.pricing_mode === 'flat_price'}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number" min="0" max="100"
                      value={item.discount_on_mc}
                      onChange={(e) => updateItem(index, 'discount_on_mc', parseFloat(e.target.value) || 0)}
                      disabled={item.pricing_mode === 'flat_price'}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number" min="0"
                      value={item.flat_price}
                      onChange={(e) => updateItem(index, 'flat_price', parseFloat(e.target.value) || 0)}
                      disabled={item.pricing_mode === 'weight_based'}
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ₹{item.item_total.toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => removeItem(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addItem}>
        <Plus className="h-4 w-4 mr-2" />
        Add Item
      </Button>
      {items.length > 0 && (
        <div className="text-right font-medium">
          Items Total: ₹{grandTotal.toLocaleString('en-IN')}
        </div>
      )}
    </div>
  );
};
