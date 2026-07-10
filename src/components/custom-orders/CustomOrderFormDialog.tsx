import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Search, Factory, User, Plus, X, Upload } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';

import { CustomOrderComponentsTable } from './CustomOrderComponentsTable';
import { CustomOrderItemsTable } from './CustomOrderItemsTable';
import {
  CustomOrder, CustomOrderItem, CustomOrderComponent, CustomOrderStatus, CustomOrderType,
  CUSTOM_ORDER_STATUS_LABELS, CustomerSuppliedMaterial, ExtraCharge,
} from '@/types/customOrder';
import { useCustomOrders } from '@/hooks/useCustomOrders';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Client { id: string; name: string; phone: string | null; }
interface Vendor { id: string; name: string; }
interface Category { id: string; name: string; }

interface CustomOrderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order?: CustomOrder | null;
}

export const CustomOrderFormDialog = ({ open, onOpenChange, order }: CustomOrderFormDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { currentBranch, defaultBranch } = useBranch();
  const isMainBranch = !!currentBranch && !!defaultBranch && currentBranch.id === defaultBranch.id;
  const { generateReference, getOrderWithItems, createOrder, updateOrder, silverRate, metalRates } = useCustomOrders();

  const [loading, setLoading] = useState(false);
  const [reference, setReference] = useState('');
  const [orderType, setOrderType] = useState<CustomOrderType>('customer');

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

  // In-house product state
  const [productSku, setProductSku] = useState('');
  const [productTitle, setProductTitle] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productDateOfMaking, setProductDateOfMaking] = useState<Date>(new Date());
  const [productVendorId, setProductVendorId] = useState<string>('');
  const [productCategoryId, setProductCategoryId] = useState<string>('');
  const [productBuyingPrice, setProductBuyingPrice] = useState(0);
  const [productSellingPrice, setProductSellingPrice] = useState(0);
  const [productSellingManual, setProductSellingManual] = useState(false);
  const [productImageUrls, setProductImageUrls] = useState<string[]>([]);
  const [inventoryProductId, setInventoryProductId] = useState<string | null>(null);

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Client search
  const [clientSearch, setClientSearch] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const isEditing = !!order;
  const isInHouse = orderType === 'in_house';
  const alreadyStocked = !!inventoryProductId;

  const itemsTotal = items.reduce((sum, item) => sum + item.item_total, 0);
  const componentsTotal = components.reduce((sum, c) => sum + (Number(c.total) || 0), 0);
  const componentsWeight = components.reduce((sum, c) => {
    return sum + (Number(c.weight_grams) || 0) * (Number(c.quantity) || 1);
  }, 0);

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

  // Grand Total EXCLUDING GST (rule 5 / 8): drives in-house selling price
  const grandTotalExGst = useMemo(() => {
    if (gstMode === 'inclusive') {
      const divisor = 1 + (gstPercentage / 100);
      return divisor > 0 ? taxableBase / divisor : taxableBase;
    }
    return taxableBase;
  }, [taxableBase, gstMode, gstPercentage]);

  // Auto-sync selling price for in-house orders (unless user manually overrode)
  useEffect(() => {
    if (isInHouse && !productSellingManual) {
      setProductSellingPrice(Math.round(grandTotalExGst * 100) / 100);
    }
  }, [grandTotalExGst, isInHouse, productSellingManual]);

  // Fetch clients / vendors / categories
  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: cData }, { data: vData }, { data: catData }] = await Promise.all([
        supabase.from('clients').select('id, name, phone').order('name'),
        supabase.from('suppliers').select('id, name').order('name'),
        supabase.from('categories').select('id, name').order('name'),
      ]);
      setClients((cData || []) as Client[]);
      setVendors((vData || []) as Vendor[]);
      setCategories((catData || []) as Category[]);
    })();
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
        const full: any = await getOrderWithItems(order.id);
        setReference(full.reference_number);
        setOrderType((full.order_type as CustomOrderType) || 'customer');
        setClientName(full.client_name || '');
        setPhoneNumber(full.phone_number || '');
        setOrderDate(new Date(full.order_date));
        setExpectedDeliveryDate(full.expected_delivery_date ? new Date(full.expected_delivery_date) : undefined);
        setStatus(full.status);
        setDesignCharges(full.design_charges);
        setAdditionalCharge(full.additional_charge);
        setAdditionalChargeLabel(full.additional_charge_label || 'Additional Charge');
        setFlatDiscount(full.flat_discount || 0);
        setGstPercentage(Number(full.gst_percentage) || 3);
        setGstMode((full.gst_mode === 'inclusive' ? 'inclusive' : 'exclusive'));
        setMakingCharges(Number(full.making_charges) || 0);
        setLabourCharges(Number(full.labour_charges) || 0);
        setPolishingCharges(Number(full.polishing_charges) || 0);
        setRepairCharges(Number(full.repair_charges) || 0);
        setExtraCharges(Array.isArray(full.extra_charges) ? full.extra_charges : []);
        setCustomerMaterials(Array.isArray(full.customer_materials) ? full.customer_materials : []);
        setNotes(full.notes || '');
        setItems(full.items || []);
        setComponents(full.components || []);
        // in-house fields
        setProductSku(full.product_sku || '');
        setProductTitle(full.product_title || '');
        setProductDescription(full.product_description || '');
        setProductDateOfMaking(full.product_date_of_making ? new Date(full.product_date_of_making) : new Date());
        setProductVendorId(full.product_vendor_id || '');
        setProductCategoryId(full.product_category_id || '');
        setProductBuyingPrice(Number(full.product_buying_price) || 0);
        setProductSellingPrice(Number(full.product_selling_price) || 0);
        setProductSellingManual(!!full.product_selling_price_manual);
        setProductImageUrls(Array.isArray(full.product_image_urls) ? full.product_image_urls : []);
        setInventoryProductId(full.inventory_product_id || null);
      } else {
        const ref = await generateReference();
        setReference(ref);
        setOrderType('customer');
        setClientName(''); setPhoneNumber('');
        setOrderDate(new Date()); setExpectedDeliveryDate(undefined);
        setStatus('draft');
        setDesignCharges(0); setAdditionalCharge(0);
        setAdditionalChargeLabel('Additional Charge');
        setFlatDiscount(0); setGstPercentage(3); setGstMode('exclusive');
        setMakingCharges(0); setLabourCharges(0); setPolishingCharges(0); setRepairCharges(0);
        setExtraCharges([]); setCustomerMaterials([]);
        setNotes(''); setItems([]); setComponents([]);
        setProductSku(''); setProductTitle(''); setProductDescription('');
        setProductDateOfMaking(new Date()); setProductVendorId(''); setProductCategoryId('');
        setProductBuyingPrice(0); setProductSellingPrice(0); setProductSellingManual(false);
        setProductImageUrls([]); setInventoryProductId(null);
      }
    };
    load();
  }, [open, order]);

  const canSubmit = isInHouse ? productTitle.trim().length > 0 : clientName.trim().length > 0;
  const inHouseBlocked = isInHouse && !isMainBranch && !isEditing;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (inHouseBlocked) {
      toast({
        variant: 'destructive',
        title: 'Main Branch only',
        description: 'In-house orders can only be created from the Main Branch. Switch branches to continue.',
      });
      return;
    }
    setLoading(true);
    try {
      const orderData: any = {
        reference_number: reference,
        order_type: orderType,
        client_name: isInHouse ? (productTitle || 'In-House') : clientName,
        phone_number: isInHouse ? null : (phoneNumber || null),
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
        customer_materials: isInHouse ? [] : customerMaterials.filter(m => m.name.trim()),
        components_total: componentsTotal,
        components_weight: componentsWeight,
        total_amount: Math.max(0, totalAmount),
        notes: notes || null,
        converted_to_invoice_id: order?.converted_to_invoice_id || null,
        created_by: user?.id || null,
        product_sku: isInHouse ? (productSku || null) : null,
        product_title: isInHouse ? productTitle : null,
        product_description: isInHouse ? (productDescription || null) : null,
        product_date_of_making: isInHouse ? format(productDateOfMaking, 'yyyy-MM-dd') : null,
        product_vendor_id: isInHouse ? (productVendorId || null) : null,
        product_category_id: isInHouse ? (productCategoryId || null) : null,
        product_buying_price: isInHouse ? productBuyingPrice : 0,
        product_selling_price: isInHouse ? productSellingPrice : 0,
        product_selling_price_manual: isInHouse ? productSellingManual : false,
        product_image_urls: isInHouse ? productImageUrls : [],
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
        strings_used: (item as any).strings_used ?? null,
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
        await createOrder.mutateAsync({ order: orderData, items: itemsData, components: componentsData });
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
          {/* Order Type toggle */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Order Type</CardTitle>
              <p className="text-xs text-muted-foreground">Customer Order = billed to a client. In-House = manufactured for stock — turns into a finished list-price product.</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={isEditing}
                  onClick={() => setOrderType('customer')}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-colors',
                    orderType === 'customer' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/40',
                    isEditing && 'opacity-70 cursor-not-allowed'
                  )}
                >
                  <User className={cn('h-5 w-5', orderType === 'customer' ? 'text-primary' : 'text-muted-foreground')} />
                  <div>
                    <div className="font-medium text-sm">Customer Order</div>
                    <div className="text-xs text-muted-foreground">Billed to a customer</div>
                  </div>
                </button>
                <button
                  type="button"
                  disabled={isEditing}
                  onClick={() => setOrderType('in_house')}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-colors',
                    orderType === 'in_house' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/40',
                    isEditing && 'opacity-70 cursor-not-allowed'
                  )}
                >
                  <Factory className={cn('h-5 w-5', orderType === 'in_house' ? 'text-primary' : 'text-muted-foreground')} />
                  <div>
                    <div className="font-medium text-sm">In-House Order</div>
                    <div className="text-xs text-muted-foreground">Manufactured for stock</div>
                  </div>
                </button>
              </div>
              {inHouseBlocked && (
                <Alert variant="destructive" className="mt-3">
                  <AlertDescription className="text-xs">
                    In-house orders can only be created from the Main Branch. Switch to Main Branch to continue.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Order Information */}
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

          {/* Product Details (in-house only) */}
          {isInHouse && (
            <Card className="border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Factory className="h-4 w-4 text-primary" />
                  Product Details
                </CardTitle>
                <p className="text-xs text-muted-foreground">These fields carry over when the finished item is sent to inventory as a list-price product.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>SKU</Label>
                    <Input placeholder="Auto if left blank" value={productSku} onChange={(e) => setProductSku(e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Title *</Label>
                    <Input placeholder="e.g. Green Moissanite Necklace" value={productTitle} onChange={(e) => setProductTitle(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea rows={3} placeholder="Full product description for the inventory listing..." value={productDescription} onChange={(e) => setProductDescription(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Date of Making</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(productDateOfMaking, 'PPP')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={productDateOfMaking} onSelect={(d) => d && setProductDateOfMaking(d)} /></PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Vendor</Label>
                    <Select value={productVendorId || 'none'} onValueChange={(v) => setProductVendorId(v === 'none' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— None —</SelectItem>
                        {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={productCategoryId || 'none'} onValueChange={(v) => setProductCategoryId(v === 'none' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— None —</SelectItem>
                        {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Buying Price (₹)</Label>
                    <Input type="number" min="0" step="0.01" value={productBuyingPrice || ''} onChange={(e) => setProductBuyingPrice(parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center justify-between">
                      Selling Price (₹) — auto = Grand Total ex-GST
                      {productSellingManual && (
                        <button type="button" onClick={() => setProductSellingManual(false)} className="text-xs text-primary hover:underline">Reset to auto</button>
                      )}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={productSellingPrice || ''}
                      onChange={(e) => {
                        setProductSellingManual(true);
                        setProductSellingPrice(parseFloat(e.target.value) || 0);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Auto value: ₹{grandTotalExGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}. Once sent to inventory this becomes a fixed list price — future silver rate changes will not re-calculate it.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Product Images</Label>
                    <div className="flex flex-wrap gap-2">
                      {productImageUrls.map((url, i) => (
                        <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <button type="button"
                            onClick={() => setProductImageUrls(productImageUrls.filter((_, j) => j !== i))}
                            className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl p-0.5">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <label className="w-20 h-20 border-2 border-dashed rounded-md flex flex-col items-center justify-center cursor-pointer hover:border-primary text-muted-foreground">
                        <Upload className="h-5 w-5" />
                        <span className="text-[10px] mt-1">Upload</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length === 0) return;
                            const uploaded: string[] = [];
                            for (const file of files) {
                              const ext = file.name.split('.').pop();
                              const fileName = `custom-order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
                              const { error: upErr } = await supabase.storage.from('product-images').upload(fileName, file);
                              if (upErr) { toast({ variant: 'destructive', title: 'Upload failed', description: upErr.message }); continue; }
                              const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName);
                              uploaded.push(publicUrl);
                            }
                            setProductImageUrls([...productImageUrls, ...uploaded]);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Multiple images allowed. The first image becomes the inventory thumbnail.</p>
                  </div>
                </div>
                {alreadyStocked && (
                  <Alert>
                    <AlertDescription className="text-xs">
                      This order has already been sent to inventory as a list-price product. Edits here will not update the inventory item.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Customer Details — only for customer orders */}
          {!isInHouse && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Customer Details</CardTitle>
                <p className="text-xs text-muted-foreground">Search from existing clients or enter new details</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 relative">
                    <Label>Search Client</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search by name or phone..."
                        value={clientSearch}
                        onChange={(e) => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
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
          )}

          {/* Order Items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Order Items</CardTitle>
              <p className="text-xs text-muted-foreground">Finished pieces being made for this order.</p>
            </CardHeader>
            <CardContent>
              <CustomOrderItemsTable items={items} onChange={setItems} silverRate={silverRate} orderId={order?.id} />
            </CardContent>
          </Card>

          {/* Customer Items Supplied — hidden for in-house */}
          {!isInHouse && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Customer Items Supplied</CardTitle>
                <p className="text-xs text-muted-foreground">Materials brought by the customer. Descriptive only — does not affect inventory or totals.</p>
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
          )}

          {/* Nispaditha Components */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>Nispaditha Components</span>
                {isInHouse && (
                  <span className="text-xs font-normal">
                    Total Finished Weight: <span className="font-semibold text-primary">{componentsWeight.toFixed(3)} g</span>
                  </span>
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground">Weight-based components use today's silver rate. Beads / pearls counted separately by strings or pieces.</p>
            </CardHeader>
            <CardContent>
              <CustomOrderComponentsTable components={components} onChange={setComponents} silverRate={silverRate} />
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

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional notes..." className="min-h-[80px]" />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button variant="secondary" onClick={() => { setStatus('draft'); handleSubmit(); }} disabled={loading || !canSubmit || inHouseBlocked}>
              Save as Draft
            </Button>
            <Button onClick={handleSubmit} disabled={loading || !canSubmit || inHouseBlocked}>
              {loading ? 'Saving...' : isEditing ? 'Update Order' : 'Create Order'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
