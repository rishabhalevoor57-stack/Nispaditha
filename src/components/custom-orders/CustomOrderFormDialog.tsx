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

import { CustomOrderComponentsTable } from './CustomOrderComponentsTable';
import { CustomOrderItemsTable } from './CustomOrderItemsTable';
import { CustomOrder, CustomOrderItem, CustomOrderComponent, CustomOrderStatus, CUSTOM_ORDER_STATUS_LABELS, CustomerSuppliedMaterial, ExtraCharge } from '@/types/customOrder';
import { Plus, X } from 'lucide-react';
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
  const [components, setComponents] = useState<CustomOrderComponent[]>([]);
  const [gstPercentage, setGstPercentage] = useState<number>(3);
  const [gstMode, setGstMode] = useState<'exclusive' | 'inclusive'>('exclusive');
  const [makingCharges, setMakingCharges] = useState(0);
  const [labourCharges, setLabourCharges] = useState(0);
  const [polishingCharges, setPolishingCharges] = useState(0);
  const [repairCharges, setRepairCharges] = useState(0);
  const [extraCharges, setExtraCharges] = useState<ExtraCharge[]>([]);
  const [customerMaterials, setCustomerMaterials] = useState<CustomerSuppliedMaterial[]>([]);

  // Client search
  const [clientSearch, setClientSearch] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const isEditing = !!order;

  const itemsTotal = items.reduce((sum, item) => sum + item.item_total, 0);
  const componentsTotal = components.reduce((sum, c) => sum + (Number(c.total) || 0), 0);
  const componentsWeight = components.reduce((sum, c) => sum + (Number(c.weight_grams) || 0) * (Number(c.quantity) || 0), 0);
  const extraChargesTotal = extraCharges.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const allChargesTotal = (Number(makingCharges) || 0) + (Number(labourCharges) || 0)
    + (Number(polishingCharges) || 0) + (Number(repairCharges) || 0)
    + (Number(designCharges) || 0) + (Number(additionalCharge) || 0) + extraChargesTotal;
  const subTotal = itemsTotal + componentsTotal + allChargesTotal - flatDiscount;
  const taxableBase = Math.max(0, subTotal);
  let gstAmount: number;
  let totalAmount: number;
  if (gstMode === 'inclusive') {
    const divisor = 1 + (gstPercentage / 100);
    const taxable = divisor > 0 ? taxableBase / divisor : taxableBase;
    gstAmount = Math.max(0, taxableBase - taxable);
    totalAmount = taxableBase;
  } else {
    gstAmount = taxableBase * (gstPercentage / 100);
    totalAmount = taxableBase + gstAmount;
  }
  const cgst = gstAmount / 2;
  const sgst = gstAmount / 2;

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
        setGstPercentage(Number((full as any).gst_percentage) || 3);
        setGstMode(((full as any).gst_mode === 'inclusive' ? 'inclusive' : 'exclusive'));
        setMakingCharges(Number((full as any).making_charges) || 0);
        setLabourCharges(Number((full as any).labour_charges) || 0);
        setPolishingCharges(Number((full as any).polishing_charges) || 0);
        setRepairCharges(Number((full as any).repair_charges) || 0);
        setExtraCharges(Array.isArray((full as any).extra_charges) ? (full as any).extra_charges : []);
        setCustomerMaterials(Array.isArray((full as any).customer_materials) ? (full as any).customer_materials : []);
        setNotes(full.notes || '');
        setItems(full.items || []);
        setComponents((full as any).components || []);
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
        setGstPercentage(3);
        setGstMode('exclusive');
        setMakingCharges(0);
        setLabourCharges(0);
        setPolishingCharges(0);
        setRepairCharges(0);
        setExtraCharges([]);
        setCustomerMaterials([]);
        setNotes('');
        setItems([]);
        setComponents([]);
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
        gst_percentage: gstPercentage,
        gst_mode: gstMode,
        making_charges: makingCharges,
        labour_charges: labourCharges,
        polishing_charges: polishingCharges,
        repair_charges: repairCharges,
        extra_charges: extraCharges.filter(c => c.label.trim() && Number(c.amount) > 0),
        customer_materials: customerMaterials.filter(m => m.name.trim()),
        components_total: componentsTotal,
        components_weight: componentsWeight,
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

      const componentsData = components
        .filter(c => c.component_name.trim())
        .map(c => ({
          component_name: c.component_name,
          material: c.material || null,
          weight_grams: c.weight_grams || 0,
          quantity: c.quantity || 1,
          unit_price: c.unit_price || 0,
          rate_per_gram: c.rate_per_gram || 0,
          total: c.total || 0,
        }));

      if (isEditing) {
        await updateOrder.mutateAsync({ id: order.id, order: orderData, items: itemsData, components: componentsData });
      } else {
        await createOrder.mutateAsync({ order: orderData as any, items: itemsData, components: componentsData });
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

          {/* Customer Items Supplied */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Customer Items Supplied</CardTitle>
              <p className="text-xs text-muted-foreground">Materials brought by the customer (pearls, beads, old chain, stones, thread). Descriptive only — does not affect inventory or totals.</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {customerMaterials.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">No customer items added yet.</p>
              )}
              {customerMaterials.map((m, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end border rounded-md p-2 bg-muted/20">
                  <div className="col-span-12 md:col-span-4 space-y-1">
                    <Label className="text-xs">Item *</Label>
                    <Input className="h-9" placeholder="Pearls, Beads, Old Chain..." value={m.name} onChange={(e) => {
                      const next = [...customerMaterials]; next[idx] = { ...m, name: e.target.value }; setCustomerMaterials(next);
                    }} />
                  </div>
                  <div className="col-span-6 md:col-span-2 space-y-1">
                    <Label className="text-xs">Qty</Label>
                    <Input className="h-9" type="number" min="0" value={m.quantity || ''} onChange={(e) => {
                      const next = [...customerMaterials]; next[idx] = { ...m, quantity: parseFloat(e.target.value) || 0 }; setCustomerMaterials(next);
                    }} />
                  </div>
                  <div className="col-span-6 md:col-span-2 space-y-1">
                    <Label className="text-xs">Wt (g)</Label>
                    <Input className="h-9" type="number" min="0" step="0.001" value={m.weight_grams || ''} onChange={(e) => {
                      const next = [...customerMaterials]; next[idx] = { ...m, weight_grams: parseFloat(e.target.value) || 0 }; setCustomerMaterials(next);
                    }} />
                  </div>
                  <div className="col-span-10 md:col-span-3 space-y-1">
                    <Label className="text-xs">Notes</Label>
                    <Input className="h-9" placeholder="Optional" value={m.description || ''} onChange={(e) => {
                      const next = [...customerMaterials]; next[idx] = { ...m, description: e.target.value }; setCustomerMaterials(next);
                    }} />
                  </div>
                  <div className="col-span-2 md:col-span-1 flex justify-end">
                    <Button type="button" variant="ghost" size="icon" className="text-destructive h-9 w-9" onClick={() => setCustomerMaterials(customerMaterials.filter((_, i) => i !== idx))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" className="w-full border-dashed" onClick={() => setCustomerMaterials([...customerMaterials, { name: '', quantity: 1, weight_grams: 0 }])}>
                <Plus className="h-4 w-4 mr-2" /> Add Customer Item
              </Button>
            </CardContent>
          </Card>

          {/* Nispaditha Components */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Nispaditha Components</CardTitle>
              <p className="text-xs text-muted-foreground">Items added by your business (pendant, hooks, lock, spacers, chain extension, findings, silver parts). These appear as priced lines on the invoice.</p>
            </CardHeader>
            <CardContent>
              <CustomOrderComponentsTable components={components} onChange={setComponents} />
            </CardContent>
          </Card>


          {/* Charges & Totals */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Charges, Discount & GST</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="space-y-1"><Label className="text-xs">Making Charges</Label>
                  <Input type="number" min="0" value={makingCharges || ''} onChange={(e) => setMakingCharges(parseFloat(e.target.value) || 0)} placeholder="0" /></div>
                <div className="space-y-1"><Label className="text-xs">Design Charges</Label>
                  <Input type="number" min="0" value={designCharges || ''} onChange={(e) => setDesignCharges(parseFloat(e.target.value) || 0)} placeholder="0" /></div>
                <div className="space-y-1"><Label className="text-xs">Labour Charges</Label>
                  <Input type="number" min="0" value={labourCharges || ''} onChange={(e) => setLabourCharges(parseFloat(e.target.value) || 0)} placeholder="0" /></div>
                <div className="space-y-1"><Label className="text-xs">Polishing Charges</Label>
                  <Input type="number" min="0" value={polishingCharges || ''} onChange={(e) => setPolishingCharges(parseFloat(e.target.value) || 0)} placeholder="0" /></div>
                <div className="space-y-1"><Label className="text-xs">Repair Charges</Label>
                  <Input type="number" min="0" value={repairCharges || ''} onChange={(e) => setRepairCharges(parseFloat(e.target.value) || 0)} placeholder="0" /></div>
                <div className="space-y-1"><Label className="text-xs">{additionalChargeLabel}</Label>
                  <Input type="number" min="0" value={additionalCharge || ''} onChange={(e) => setAdditionalCharge(parseFloat(e.target.value) || 0)} placeholder="0" /></div>
                <div className="space-y-1"><Label className="text-xs">Custom Label</Label>
                  <Input value={additionalChargeLabel} onChange={(e) => setAdditionalChargeLabel(e.target.value)} placeholder="Additional Charge" /></div>
                <div className="space-y-1"><Label className="text-xs">Flat Discount</Label>
                  <Input type="number" min="0" value={flatDiscount || ''} onChange={(e) => setFlatDiscount(parseFloat(e.target.value) || 0)} placeholder="0" /></div>
              </div>

              {/* Other / Custom labelled charges */}
              <div className="space-y-2 mb-4">
                <Label className="text-xs">Other Charges (custom labels)</Label>
                {extraCharges.map((c, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                    <Input className="col-span-7 h-9" placeholder="Label (e.g. Stone Setting)" value={c.label} onChange={(e) => {
                      const next = [...extraCharges]; next[idx] = { ...c, label: e.target.value }; setExtraCharges(next);
                    }} />
                    <Input className="col-span-4 h-9" type="number" min="0" placeholder="Amount" value={c.amount || ''} onChange={(e) => {
                      const next = [...extraCharges]; next[idx] = { ...c, amount: parseFloat(e.target.value) || 0 }; setExtraCharges(next);
                    }} />
                    <Button type="button" variant="ghost" size="icon" className="col-span-1 text-destructive h-9 w-9" onClick={() => setExtraCharges(extraCharges.filter((_, i) => i !== idx))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="border-dashed" onClick={() => setExtraCharges([...extraCharges, { label: '', amount: 0 }])}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Other Charge
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-2">
                <div className="space-y-1">
                  <Label className="text-xs">GST %</Label>
                  <Input type="number" min="0" max="100" step="0.01" value={gstPercentage} onChange={(e) => setGstPercentage(parseFloat(e.target.value) || 0)} placeholder="3" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">GST Mode</Label>
                  <Select value={gstMode} onValueChange={(v) => setGstMode(v as 'exclusive' | 'inclusive')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exclusive">Exclusive (added on top)</SelectItem>
                      <SelectItem value="inclusive">Inclusive (already in price)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Separator className="my-4" />
              <div className="space-y-1.5 text-right">
                <div className="text-sm text-muted-foreground">Items Total: ₹{itemsTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                {componentsTotal > 0 && <div className="text-sm text-muted-foreground">Components Cost: ₹{componentsTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>}
                {makingCharges > 0 && <div className="text-sm text-muted-foreground">Making Charges: ₹{makingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>}
                {designCharges > 0 && <div className="text-sm text-muted-foreground">Design Charges: ₹{designCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>}
                {labourCharges > 0 && <div className="text-sm text-muted-foreground">Labour Charges: ₹{labourCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>}
                {polishingCharges > 0 && <div className="text-sm text-muted-foreground">Polishing Charges: ₹{polishingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>}
                {repairCharges > 0 && <div className="text-sm text-muted-foreground">Repair Charges: ₹{repairCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>}
                {additionalCharge > 0 && <div className="text-sm text-muted-foreground">{additionalChargeLabel}: ₹{additionalCharge.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>}
                {extraCharges.filter(c => c.label.trim() && Number(c.amount) > 0).map((c, i) => (
                  <div key={i} className="text-sm text-muted-foreground">{c.label}: ₹{Number(c.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                ))}
                {flatDiscount > 0 && (
                  <div className="text-sm text-destructive">Flat Discount: -₹{flatDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                )}
                <div className="text-sm text-muted-foreground border-t pt-1 mt-1">Subtotal {gstMode === 'inclusive' ? '(GST incl.)' : ''}: ₹{Math.max(0, subTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                {gstPercentage > 0 && (
                  <>
                    <div className="text-sm text-muted-foreground">CGST ({(gstPercentage / 2).toFixed(2)}%): ₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    <div className="text-sm text-muted-foreground">SGST ({(gstPercentage / 2).toFixed(2)}%): ₹{sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  </>
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
