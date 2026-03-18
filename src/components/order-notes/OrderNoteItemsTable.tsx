import { useRef } from 'react';
import { Plus, Trash2, ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { OrderNoteItem, SERVICE_TYPES, SERVICE_TYPE_LABELS } from '@/types/orderNote';
import { toast } from '@/hooks/use-toast';

interface OrderNoteItemsTableProps {
  items: OrderNoteItem[];
  onChange: (items: OrderNoteItem[]) => void;
  readOnly?: boolean;
}

const MIN_FILE_SIZE = 100 * 1024; // 0.1 MB
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

const parseServices = (serviceType?: string): string[] => {
  if (!serviceType) return ['new_order'];
  return serviceType.split(',').filter(Boolean);
};

const formatServices = (services: string[]): string => {
  return services.join(',');
};

const getServiceLabels = (serviceType?: string): string => {
  const services = parseServices(serviceType);
  return services.map(s => SERVICE_TYPE_LABELS[s] || s).join(', ');
};

export const OrderNoteItemsTable = ({ items, onChange, readOnly }: OrderNoteItemsTableProps) => {
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const addItem = () => {
    onChange([
      ...items,
      { item_description: '', customization_notes: '', quantity: 1, expected_price: 0, service_type: 'new_order', image_url: null, _imageFile: null },
    ]);
  };

  const updateItem = (index: number, field: keyof OrderNoteItem, value: string | number) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    onChange(updated);
  };

  const toggleService = (index: number, serviceValue: string) => {
    const item = items[index];
    const currentServices = parseServices(item.service_type);
    let newServices: string[];
    
    if (currentServices.includes(serviceValue)) {
      newServices = currentServices.filter(s => s !== serviceValue);
      if (newServices.length === 0) newServices = ['new_order']; // must have at least one
    } else {
      newServices = [...currentServices, serviceValue];
    }
    
    updateItem(index, 'service_type', formatServices(newServices));
  };

  const handleFileSelect = (index: number, file: File | null) => {
    if (!file) return;

    if (file.size < MIN_FILE_SIZE) {
      toast({ title: 'File too small', description: 'Minimum file size is 0.1 MB', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: 'File too large', description: 'Maximum file size is 100 MB', variant: 'destructive' });
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
    if (!validTypes.includes(file.type)) {
      toast({ title: 'Invalid file type', description: 'Only JPG, PNG, WebP, GIF images are allowed', variant: 'destructive' });
      return;
    }

    const updated = items.map((item, i) =>
      i === index ? { ...item, _imageFile: file, image_url: URL.createObjectURL(file) } : item
    );
    onChange(updated);
  };

  const removeImage = (index: number) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, _imageFile: null, image_url: null } : item
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
              <TableHead>Image</TableHead>
              <TableHead>Item / Description</TableHead>
              <TableHead>Services</TableHead>
              <TableHead>Customization Notes</TableHead>
              <TableHead className="text-center">Qty</TableHead>
              <TableHead className="text-right">Expected Price</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No items
                </TableCell>
              </TableRow>
            ) : (
              <>
                {items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {item.image_url ? (
                        <a href={item.image_url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={item.image_url}
                            alt={item.item_description}
                            className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80"
                          />
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-xs">No image</span>
                      )}
                    </TableCell>
                    <TableCell>{item.item_description}</TableCell>
                    <TableCell>
                      <span className="text-sm">{getServiceLabels(item.service_type)}</span>
                    </TableCell>
                    <TableCell>{item.customization_notes || '-'}</TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right">₹{item.expected_price.toLocaleString('en-IN')}</TableCell>
                    <TableCell className="text-right">
                      ₹{(item.expected_price * item.quantity).toLocaleString('en-IN')}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell colSpan={6} className="text-right">Total Expected:</TableCell>
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
              <TableHead className="w-[100px]">Image</TableHead>
              <TableHead className="min-w-[200px]">Item / Description</TableHead>
              <TableHead className="min-w-[160px]">Services</TableHead>
              <TableHead className="min-w-[150px]">Customization Notes</TableHead>
              <TableHead className="w-[80px]">Qty</TableHead>
              <TableHead className="w-[120px]">Expected Price</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No items added. Click "Add Item" to start.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => {
                const selectedServices = parseServices(item.service_type);
                return (
                  <TableRow key={index}>
                    <TableCell>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={(el) => { fileInputRefs.current[index] = el; }}
                        onChange={(e) => handleFileSelect(index, e.target.files?.[0] || null)}
                      />
                      {item.image_url ? (
                        <div className="relative group w-14 h-14">
                          <img
                            src={item.image_url}
                            alt="Item"
                            className="w-14 h-14 object-cover rounded border"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-14 w-14 p-0"
                          onClick={() => fileInputRefs.current[index]?.click()}
                        >
                          <ImagePlus className="h-5 w-5 text-muted-foreground" />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Item description"
                        value={item.item_description}
                        onChange={(e) => updateItem(index, 'item_description', e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 max-h-[120px] overflow-y-auto">
                        {SERVICE_TYPES.map((st) => (
                          <div key={st.value} className="flex items-center gap-1.5">
                            <Checkbox
                              id={`service-${index}-${st.value}`}
                              checked={selectedServices.includes(st.value)}
                              onCheckedChange={() => toggleService(index, st.value)}
                            />
                            <Label
                              htmlFor={`service-${index}-${st.value}`}
                              className="text-xs font-normal cursor-pointer"
                            >
                              {st.label}
                            </Label>
                          </div>
                        ))}
                      </div>
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
                );
              })
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
