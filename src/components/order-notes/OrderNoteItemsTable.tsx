import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { OrderNoteItem } from '@/types/orderNote';

interface OrderNoteItemsTableProps {
  items: OrderNoteItem[];
  onChange: (items: OrderNoteItem[]) => void;
  readOnly?: boolean;
}

export const OrderNoteItemsTable = ({ items, onChange, readOnly }: OrderNoteItemsTableProps) => {
  const addItem = () => {
    onChange([
      ...items,
      { item_description: '', customization_notes: '', quantity: 1, expected_price: 0 },
    ]);
  };

  const updateItem = (index: number, field: keyof OrderNoteItem, value: string | number) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    onChange(updated);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const totalExpected = items.reduce((sum, item) => sum + (item.expected_price * item.quantity), 0);

  if (readOnly) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item / Description</TableHead>
              <TableHead>Customization Notes</TableHead>
              <TableHead className="text-center">Qty</TableHead>
              <TableHead className="text-right">Expected Price</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No items
                </TableCell>
              </TableRow>
            ) : (
              <>
                {items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.item_description}</TableCell>
                    <TableCell>{item.customization_notes || '-'}</TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right">₹{item.expected_price.toLocaleString('en-IN')}</TableCell>
                    <TableCell className="text-right">
                      ₹{(item.expected_price * item.quantity).toLocaleString('en-IN')}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell colSpan={4} className="text-right">Total Expected:</TableCell>
                  <TableCell className="text-right">₹{totalExpected.toLocaleString('en-IN')}</TableCell>
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
              <TableHead className="min-w-[200px]">Item / Description</TableHead>
              <TableHead className="min-w-[150px]">Customization Notes</TableHead>
              <TableHead className="w-[80px]">Qty</TableHead>
              <TableHead className="w-[120px]">Expected Price</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
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
                      className="min-h-[60px]"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      value={item.expected_price}
                      onChange={(e) => updateItem(index, 'expected_price', parseFloat(e.target.value) || 0)}
                    />
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
          Total Expected: ₹{totalExpected.toLocaleString('en-IN')}
        </div>
      )}
    </div>
  );
};
