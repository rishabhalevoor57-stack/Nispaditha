import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CustomOrderItemsTable } from './CustomOrderItemsTable';
import { CustomOrder, CustomOrderItem, CustomOrderStatus, CUSTOM_ORDER_STATUS_LABELS } from '@/types/customOrder';
import { useCustomOrders } from '@/hooks/useCustomOrders';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Client {
  id: string;
  name: string;
  phone: string | null;
}

interface CustomOrderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order?: CustomOrder | null;
}

export const CustomOrderFormDialog = ({ open, onOpenChange, order }: CustomOrderFormDialogProps) => {
  const { user } = useAuth();
  const { generateReference, getOrderWithItems, createOrder, updateOrder, silverRate } = useCustomOrders();

  const [loading, setLoading] = useState(false);
  const [reference, setReference] = useState('');
  const [clientName, setClientName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [orderDate, setOrderDate] = useState<Date>(new Date());
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<Date | undefined>();
  const [status, setStatus] = useState<CustomOrderStatus>('draft');
  const [designCharges, setDesignCharges] = useState(0);
  const [additionalCharge, setAdditionalCharge] = useState(0);
  const [additionalChargeLabel, setAdditionalChargeLabel] = useState('Additional Charge');
  const [flatDiscount, setFlatDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<CustomOrderItem[]>([]);

  // Client search
  const [clientSearch, setClientSearch] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const isEditing = !!order;

  const itemsTotal = items.reduce((sum, item) => sum + item.item_total, 0);
  const totalAmount = itemsTotal + designCharges + additionalCharge - flatDiscount;

  // Fetch clients for search
  useEffect(() => {
    if (!open) return;
    const fetchClients = async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, name, phone')
        .order('name');
      setClients((data || []) as Client[]);
    };
    fetchClients();
  }, [open]);

  const filteredClients = clientSearch.length > 0
    ? clients.filter(c =>
        c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
        c.phone?.toLowerCase().includes(clientSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  const handleSelectClient = (client: Client) => {
    setClientName(client.name);
    setPhoneNumber(client.phone || '');
    setClientSearch('');
    setShowClientDropdown(false);
  };

  useEffect(() => {
    const load = async () => {
      if (!open) return;
      if (order) {
        const full = await getOrderWithItems(order.id);
        setReference(full.reference_number);
        setClientName(full.client_name);
        setPhoneNumber(full.phone_number || '');
        setOrderDate(new Date(full.order_date));
        setExpectedDeliveryDate(full.expected_delivery_date ? new Date(full.expected_delivery_date) : undefined);
        setStatus(full.status);
        setDesignCharges(full.design_charges);
        setAdditionalCharge(full.additional_charge);
        setAdditionalChargeLabel(full.additional_charge_label || 'Additional Charge');
        setFlatDiscount(full.flat_discount || 0);
        setNotes(full.notes || '');
        setItems(full.items || []);
      } else {
        const ref = await generateReference();
        setReference(ref);
        setClientName('');
        setPhoneNumber('');
        setOrderDate(new Date());
        setExpectedDeliveryDate(undefined);
        setStatus('draft');
        setDesignCharges(0);
        setAdditionalCharge(0);
        setAdditionalChargeLabel('Additional Charge');
        setFlatDiscount(0);
        setNotes('');
        setItems([]);
      }
    };
    load();
  }, [open, order]);

  const handleSubmit = async () => {
    if (!clientName.trim()) return;
    setLoading(true);
    try {
      const orderData = {
        reference_number: reference,
        client_name: clientName,
        phone_number: phoneNumber || null,
        order_date: format(orderDate, 'yyyy-MM-dd'),
        expected_delivery_date: expectedDeliveryDate ? format(expectedDeliveryDate, 'yyyy-MM-dd') : null,
        status,
        design_charges: designCharges,
        additional_charge: additionalCharge,
        additional_charge_label: additionalChargeLabel,
        flat_discount: flatDiscount,
        total_amount: Math.max(0, totalAmount),
        notes: notes || null,
        converted_to_invoice_id: order?.converted_to_invoice_id || null,
        created_by: user?.id || null,
      };

      const itemsData = items.map(item => ({
        product_id: item.product_id || null,
        sku: item.sku || null,
        item_description: item.item_description,
        category: item.category || null,
        customization_notes: item.customization_notes || null,
        reference_image_url: item.reference_image_url || null,
        quantity: item.quantity,
        expected_weight: item.expected_weight,
        pricing_mode: item.pricing_mode,
        flat_price: item.flat_price,
        mc_per_gram: item.mc_per_gram,
        discount_on_mc: item.discount_on_mc,
        rate_per_gram: item.rate_per_gram,
        base_price: item.base_price,
        mc_amount: item.mc_amount,
        discount: item.discount,
        discount_type: item.discount_type,
        discount_value: item.discount_value,
        item_total: item.item_total,
      }));

      if (isEditing) {
        await updateOrder.mutateAsync({ id: order.id, order: orderData, items: itemsData });
      } else {
        await createOrder.mutateAsync({ order: orderData as any, items: itemsData });
      }
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Custom Order' : 'New Custom Order (Job Work)'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Reference & Date */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Order Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Reference #</Label>
                <Input value={reference} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Order Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(orderDate, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={orderDate} onSelect={(d) => d && setOrderDate(d)} /></PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Expected Delivery</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !expectedDeliveryDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {expectedDeliveryDate ? format(expectedDeliveryDate, 'PPP') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={expectedDeliveryDate} onSelect={setExpectedDeliveryDate} /></PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as CustomOrderStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CUSTOM_ORDER_STATUS_LABELS) as CustomOrderStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{CUSTOM_ORDER_STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Customer - with client search */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Customer Details</CardTitle>
              <p className="text-xs text-muted-foreground">Search from existing clients or enter new details</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Client search */}
                <div className="space-y-2 relative">
                  <Label>Search Client</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or phone..."
                      value={clientSearch}
                      onChange={(e) => {
                        setClientSearch(e.target.value);
                        setShowClientDropdown(true);
                      }}
                      onFocus={() => clientSearch && setShowClientDropdown(true)}
                      onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                      className="pl-8"
                    />
                  </div>
                  {showClientDropdown && filteredClients.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {filteredClients.map((c) => (
                        <button
                          key={c.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSelectClient(c)}
                          className="w-full px-3 py-2 text-left hover:bg-accent transition-colors border-b last:border-0"
                        >
                          <p className="text-sm font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.phone || 'No phone'}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Client Name *</Label>
                  <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Enter client name" />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Enter phone number" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Order Items</CardTitle>
              <p className="text-xs text-muted-foreground">Live Silver Rate: ₹{silverRate}/g • Search by SKU to auto-fill from inventory</p>
            </CardHeader>
            <CardContent>
              <CustomOrderItemsTable items={items} onChange={setItems} silverRate={silverRate} orderId={order?.id} />
            </CardContent>
          </Card>

          {/* Charges & Totals */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Additional Charges & Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="space-y-2">
                  <Label>Design Charges</Label>
                  <Input type="number" min="0" value={designCharges || ''} onChange={(e) => setDesignCharges(parseFloat(e.target.value) || 0)} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>{additionalChargeLabel}</Label>
                  <Input type="number" min="0" value={additionalCharge || ''} onChange={(e) => setAdditionalCharge(parseFloat(e.target.value) || 0)} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>Flat Discount</Label>
                  <Input type="number" min="0" value={flatDiscount || ''} onChange={(e) => setFlatDiscount(parseFloat(e.target.value) || 0)} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>Custom Label</Label>
                  <Input value={additionalChargeLabel} onChange={(e) => setAdditionalChargeLabel(e.target.value)} placeholder="Additional Charge" />
                </div>
              </div>
              <Separator className="my-4" />
              <div className="space-y-1.5 text-right">
                <div className="text-sm text-muted-foreground">Items Total: ₹{itemsTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                {designCharges > 0 && <div className="text-sm text-muted-foreground">Design Charges: ₹{designCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>}
                {additionalCharge > 0 && <div className="text-sm text-muted-foreground">{additionalChargeLabel}: ₹{additionalCharge.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>}
                {flatDiscount > 0 && (
                  <div className="text-sm text-destructive">Flat Discount: -₹{flatDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                )}
                <div className="text-xl font-bold pt-1">Grand Total: ₹{Math.max(0, totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional notes..." className="min-h-[80px]" />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button variant="secondary" onClick={() => { setStatus('draft'); handleSubmit(); }} disabled={loading || !clientName.trim()}>
              Save as Draft
            </Button>
            <Button onClick={handleSubmit} disabled={loading || !clientName.trim()}>
              {loading ? 'Saving...' : isEditing ? 'Update Order' : 'Create Order'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
