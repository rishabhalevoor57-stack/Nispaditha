import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Calculator, Download, Printer, Eye, CalendarIcon } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { InvoiceItemsTable } from './InvoiceItemsTable';

import { InvoicePreviewModal } from './InvoicePreviewModal';
import { MetalRateToggle, type MetalRateOption } from './MetalRateToggle';
import { useInvoiceCalculations } from '@/hooks/useInvoiceCalculations';
import { useActivityLogger } from '@/hooks/useActivityLog';
import { downloadInvoicePdf, printInvoice } from '@/utils/invoicePdf';
import { adjustWallet, getWalletBalance } from '@/hooks/useStoreWallet';
import { Wallet } from 'lucide-react';
import type { Product, Client, BusinessSettings, InvoiceItem } from '@/types/invoice';


export interface InvoicePrefillData {
  clientName?: string;
  clientPhone?: string;
  notes?: string;
  advancePaid?: number;
  paymentMode?: string;
  sourceLabel?: string; // e.g. "Order Note ON-000123"
}

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvoiceCreated: () => void;
  prefill?: InvoicePrefillData | null;
}

export function CreateInvoiceDialog({
  open,
  onOpenChange,
  onInvoiceCreated,
  prefill,
}: CreateInvoiceDialogProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [notes, setNotes] = useState('');
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState<Date>(new Date());
  const [metalRate, setMetalRate] = useState<MetalRateOption>('silver');
  const [gstPct, setGstPct] = useState<number>(3);
  const [roundOff, setRoundOff] = useState<number>(0);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [storeCreditsUsed, setStoreCreditsUsed] = useState<number>(0);
  const [payments, setPayments] = useState<{ mode: string; amount: string }[]>([]);
  const [clientSource, setClientSource] = useState<string>('walk_in');

  const { toast } = useToast();
  const { user } = useAuth();
  const { totals } = useInvoiceCalculations(invoiceItems, gstPct);
  const { logActivity } = useActivityLogger();

  const grandTotalWithRound = (totals.grandTotal || 0) + (Number(roundOff) || 0);
  const cappedCredits = Math.min(Math.max(0, Number(storeCreditsUsed) || 0), walletBalance, grandTotalWithRound);
  const grandTotalAfterCredits = Math.max(0, grandTotalWithRound - cappedCredits);
  const remainingAfterCredits = grandTotalAfterCredits;
  const validPayments = payments
    .map((p) => ({ mode: p.mode, amount: parseFloat(p.amount) || 0 }))
    .filter((p) => p.amount > 0);
  const effectivePaymentBreakdown = validPayments.reduce<{ mode: string; amount: number }[]>((acc, payment) => {
    const used = acc.reduce((sum, item) => sum + item.amount, 0);
    const remaining = Math.max(0, remainingAfterCredits - used);
    if (remaining <= 0) return acc;
    acc.push({ ...payment, amount: Math.min(payment.amount, remaining) });
    return acc;
  }, []);
  const effectiveAdvance = effectivePaymentBreakdown.reduce((sum, item) => sum + item.amount, 0);
  const totalAccounted = cappedCredits + effectiveAdvance;
  const balanceDue = Math.max(0, grandTotalWithRound - totalAccounted);
  const fullyPaidByCredits = cappedCredits >= grandTotalWithRound && grandTotalWithRound > 0;
  const isFullyPaid = grandTotalWithRound > 0 && balanceDue <= 0.001 && totalAccounted > 0;
  const paymentStatusUI: 'PAID' | 'PARTIAL' | 'PENDING' =
    isFullyPaid ? 'PAID' : totalAccounted > 0 ? 'PARTIAL' : 'PENDING';
  const combinedPaymentLabel = [
    ...(cappedCredits > 0 ? ['Store Wallet'] : []),
    ...effectivePaymentBreakdown.map((entry) => entry.mode.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())),
  ].join(' + ') || 'Pay Later';
  const creditsError =
    (Number(storeCreditsUsed) || 0) > walletBalance ? 'Exceeds available credits'
    : (Number(storeCreditsUsed) || 0) > grandTotalWithRound ? 'Exceeds grand total'
    : '';
  const cgst = (totals.gstAmount || 0) / 2;
  const sgst = (totals.gstAmount || 0) / 2;

  // Resolve the active rate based on metal toggle
  const goldRate = businessSettings?.gold_rate_per_gram || 0;
  const silverRate = businessSettings?.silver_rate_per_gram || 95;
  const defaultRate = (() => {
    if (metalRate === 'gold_22k') return goldRate;
    if (metalRate === 'gold_18k') return goldRate * (18 / 22);
    if (metalRate === 'silver') return silverRate;
    return 0;
  })();


  useEffect(() => {
    if (open) {
      fetchProducts();
      fetchClients();
      fetchBusinessSettings();
    }
  }, [open]);

  // Apply prefill data when dialog opens (e.g. from Service Order conversion)
  useEffect(() => {
    if (open && prefill) {
      if (prefill.clientName) setClientName(prefill.clientName);
      if (prefill.clientPhone) setClientPhone(prefill.clientPhone);
      if (prefill.notes) setNotes(prefill.notes);
      if (prefill.paymentMode) setPaymentMode(prefill.paymentMode);
      setSelectedClient('walk-in');
      const adv = Number(prefill.advancePaid) || 0;
      if (adv > 0) {
        setPayments([{ mode: prefill.paymentMode || 'cash', amount: String(adv) }]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefill]);

  const fetchProducts = async () => {
    // Paginated fetch — show ALL products in invoice search regardless of stock level
    const PAGE = 1000;
    let from = 0;
    const all: any[] = [];
    while (from < 50000) {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name)')
        .is('deleted_at', null)
        .is('locked_by_custom_order_id' as any, null)
        .order('name')
        .range(from, from + PAGE - 1);
      if (error) break;
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    const mapped = all.map(p => ({
      ...p,
      pricing_mode: (p.pricing_mode || 'weight_based') as 'weight_based' | 'flat_price',
      mrp: Number(p.mrp) || 0,
    }));
    setProducts(mapped as Product[]);
  };

  const fetchClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, name, phone, address, gst_number')
      .order('name');
    setClients((data as Client[]) || []);
  };

  const fetchBusinessSettings = async () => {
    const { data } = await supabase
      .from('business_settings')
      .select('*')
      .maybeSingle();
    if (data) {
      setBusinessSettings(data as BusinessSettings);
    }
  };

  const handleClientChange = (clientId: string) => {
    setSelectedClient(clientId);
    setStoreCreditsUsed(0);
    if (clientId && clientId !== 'walk-in') {
      const client = clients.find(c => c.id === clientId);
      if (client) {
        setClientName(client.name);
        setClientPhone(client.phone || '');
      }
      getWalletBalance(clientId).then(setWalletBalance).catch(() => setWalletBalance(0));
    } else {
      setClientName('');
      setClientPhone('');
      setWalletBalance(0);
    }
  };

  const resetForm = () => {
    setSelectedClient('');
    setClientName('');
    setClientPhone('');
    setInvoiceItems([]);
    setPaymentMode('cash');
    setNotes('');
    setInvoiceDate(new Date());
    setMetalRate('silver');
    setGstPct(3);
    setRoundOff(0);
    setWalletBalance(0);
    setStoreCreditsUsed(0);
    setPayments([]);
    setClientSource('walk_in');
  };


  const handleCreateInvoice = async () => {
    if (invoiceItems.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please add at least one product' });
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate invoice number
      const { data: invoiceNum } = await supabase.rpc('generate_invoice_number');

      // Auto-create or update client if phone number is provided
      let finalClientId = selectedClient && selectedClient !== 'walk-in' ? selectedClient : null;
      
      if (clientPhone && clientPhone.trim()) {
        // Use the upsert function to create or update client
        const { data: clientId, error: clientError } = await supabase.rpc('upsert_client_on_invoice', {
          p_phone: clientPhone.trim(),
          p_name: clientName || 'Walk-in Customer',
          p_amount: totals.grandTotal,
        });
        
        if (clientError) {
          console.error('Error upserting client:', clientError);
        } else if (clientId) {
          finalClientId = clientId;
        }
      } else if (finalClientId) {
        // Update existing selected client's purchase history using raw update
        const { data: currentClient } = await supabase
          .from('clients')
          .select('total_purchases')
          .eq('id', finalClientId)
          .single();

        await supabase
          .from('clients')
          .update({
            last_invoice_date: new Date().toISOString(),
            total_purchases: (currentClient?.total_purchases || 0) + totals.grandTotal,
          })
          .eq('id', finalClientId);
      }

      const paymentOne = effectivePaymentBreakdown[0];
      const paymentTwo = effectivePaymentBreakdown[1];
      const finalGrandTotal = grandTotalWithRound; // store FULL grand total; credits tracked separately
      const computedPaymentStatus =
        paymentStatusUI === 'PAID' ? 'paid' : paymentStatusUI === 'PARTIAL' ? 'partial' : 'pending';
      const primaryPayMode = combinedPaymentLabel;

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
          invoice_number: invoiceNum,
          client_id: finalClientId,
          invoice_date: format(invoiceDate, 'yyyy-MM-dd'),
          subtotal: totals.subtotal,
          discount_amount: totals.discountAmount,
          gst_amount: totals.gstAmount,
          grand_total: finalGrandTotal,
          advance_paid: effectiveAdvance,
          store_credits_used: cappedCredits,
          payment_status: computedPaymentStatus,
          payment_mode: primaryPayMode,
          payment_mode_1: paymentOne?.mode || null,
          payment_amount_1: paymentOne?.amount || 0,
          payment_mode_2: paymentTwo?.mode || null,
          payment_amount_2: paymentTwo?.amount || 0,
          total_paid: totalAccounted,
          balance_due: balanceDue,
          combined_payment_label: combinedPaymentLabel,
          amount_after_credits: remainingAfterCredits,
          amount_paid_via_mode: effectiveAdvance,
          notes: notes || null,
          created_by: user?.id,
          status: computedPaymentStatus === 'paid' ? 'paid' : 'sent',
          client_source: clientSource,
        } as never])
        .select()
        .single();


      if (invoiceError) throw invoiceError;

      // Debit store wallet for credits used
      if (cappedCredits > 0 && finalClientId) {
        try {
          await adjustWallet(
            finalClientId,
            -cappedCredits,
            'invoice',
            invoice.id,
            invoiceNum,
            'Credits applied to invoice',
          );
        } catch (e) {
          console.error('Wallet debit failed', e);
        }
      }

      // Record each payment entry in invoice_payments (for receipt history)
      for (const p of effectivePaymentBreakdown) {
        const { data: receiptNum } = await supabase.rpc('generate_receipt_number');
        await supabase.from('invoice_payments').insert([{
          invoice_id: invoice.id,
          receipt_number: receiptNum,
          amount: p.amount,
          payment_mode: p.mode,
          payment_date: format(invoiceDate, 'yyyy-MM-dd'),
          notes: isFullyPaid ? 'Payment received in full at invoice creation' : 'Payment received at invoice creation',
          created_by: user?.id,
        }]);
      }

      // Create invoice items
      const itemsToInsert = invoiceItems.map(item => ({
        invoice_id: invoice.id,
        product_id: item.product_id,
        product_name: item.product_name,
        category: item.category,
        weight_grams: item.pricing_mode === 'flat_price' ? 0 : item.weight_grams,
        quantity: item.quantity,
        rate_per_gram: item.pricing_mode === 'flat_price' ? 0 : item.rate_per_gram,
        gold_value: item.base_price,
        making_charges: item.pricing_mode === 'flat_price' ? 0 : item.making_charges,
        discount: item.discount,
        discounted_making: item.pricing_mode === 'flat_price' ? 0 : item.discounted_making,
        subtotal: item.line_total,
        gst_percentage: item.gst_percentage,
        gst_amount: item.line_total * (item.gst_percentage / 100),
        total: item.line_total + (item.line_total * (item.gst_percentage / 100)),
        mrp: item.mrp || 0,
        description: item.description || null,
      }));


      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Stock reduction is handled automatically by database trigger

      // Generate PDF for download
      if (businessSettings) {
        downloadInvoicePdf({
          invoiceNumber: invoiceNum,
          invoiceDate: invoiceDate.toISOString(),
          clientName: clientName || 'Walk-in Customer',
          clientPhone,
          paymentMode,
          items: invoiceItems,
          totals,
          businessSettings,
          notes,
          gstPercentage: gstPct,
          roundOff,
          advancePaid: effectiveAdvance,
          storeCreditsUsed: cappedCredits,
        }, true);
      }


      logActivity({
        module: 'invoice',
        action: 'create',
        recordId: invoice.id,
        recordLabel: invoiceNum,
        newValue: { invoice_number: invoiceNum, client: clientName || 'Walk-in', grand_total: totals.grandTotal, items_count: invoiceItems.length },
      });

      toast({ title: 'Invoice created and downloaded!' });
      onOpenChange(false);
      resetForm();
      onInvoiceCreated();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAsDraft = async () => {
    if (invoiceItems.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please add at least one product' });
      return;
    }
    setIsSubmitting(true);
    try {
      // Resolve client (do NOT modify client balances for drafts)
      let finalClientId = selectedClient && selectedClient !== 'walk-in' ? selectedClient : null;
      if (!finalClientId && clientPhone && clientPhone.trim()) {
        const { data: existing } = await supabase
          .from('clients')
          .select('id')
          .eq('phone', clientPhone.trim())
          .maybeSingle();
        finalClientId = existing?.id || null;
      }

      const draftNumber = 'DRAFT-' + Date.now().toString(36).toUpperCase();
      const paymentOne = effectivePaymentBreakdown[0];
      const paymentTwo = effectivePaymentBreakdown[1];
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
          invoice_number: draftNumber,
          client_id: finalClientId,
          invoice_date: format(invoiceDate, 'yyyy-MM-dd'),
          subtotal: totals.subtotal,
          discount_amount: totals.discountAmount,
          gst_amount: totals.gstAmount,
          grand_total: grandTotalWithRound,
          advance_paid: effectiveAdvance,
          store_credits_used: cappedCredits,
          payment_status: paymentStatusUI === 'PAID' ? 'paid' : paymentStatusUI === 'PARTIAL' ? 'partial' : 'pending',
          payment_mode: combinedPaymentLabel,
          payment_mode_1: paymentOne?.mode || null,
          payment_amount_1: paymentOne?.amount || 0,
          payment_mode_2: paymentTwo?.mode || null,
          payment_amount_2: paymentTwo?.amount || 0,
          total_paid: totalAccounted,
          balance_due: balanceDue,
          combined_payment_label: combinedPaymentLabel,
          amount_after_credits: remainingAfterCredits,
          amount_paid_via_mode: effectiveAdvance,
          notes: notes || null,
          created_by: user?.id,
          status: 'draft',
          client_source: clientSource,
        } as never])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Insert items — trigger now skips stock deduction for drafts
      const itemsToInsert = invoiceItems.map(item => ({
        invoice_id: invoice.id,
        product_id: item.product_id,
        product_name: item.product_name,
        category: item.category,
        weight_grams: item.pricing_mode === 'flat_price' ? 0 : item.weight_grams,
        quantity: item.quantity,
        rate_per_gram: item.pricing_mode === 'flat_price' ? 0 : item.rate_per_gram,
        gold_value: item.base_price,
        making_charges: item.pricing_mode === 'flat_price' ? 0 : item.making_charges,
        discount: item.discount,
        discounted_making: item.pricing_mode === 'flat_price' ? 0 : item.discounted_making,
        subtotal: item.line_total,
        gst_percentage: item.gst_percentage,
        gst_amount: item.line_total * (item.gst_percentage / 100),
        total: item.line_total + (item.line_total * (item.gst_percentage / 100)),
        mrp: item.mrp || 0,
        description: item.description || null,
      }));
      const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      logActivity({
        module: 'invoice',
        action: 'create',
        recordId: invoice.id,
        recordLabel: draftNumber,
        newValue: { status: 'draft', items_count: invoiceItems.length },
      });

      toast({ title: 'Invoice saved as draft' });
      onOpenChange(false);
      resetForm();
      onInvoiceCreated();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save draft';
      toast({ variant: 'destructive', title: 'Error', description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintPreview = () => {
    if (!businessSettings || invoiceItems.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please add products first' });
      return;
    }

      printInvoice({
      invoiceNumber: 'PREVIEW',
      invoiceDate: invoiceDate.toISOString(),
      clientName: clientName || 'Walk-in Customer',
      clientPhone,
        paymentMode: combinedPaymentLabel,
      items: invoiceItems,
      totals,
      businessSettings,
      notes,
      gstPercentage: gstPct,
      roundOff,
      advancePaid: effectiveAdvance,
        storeCreditsUsed: cappedCredits,
        paymentBreakdown: effectivePaymentBreakdown,
    }, true);
  };


  return (
    <>
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            Create New Invoice
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {prefill?.sourceLabel && (
            <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              Pre-filled from <span className="font-semibold">{prefill.sourceLabel}</span>. Review and add product line items before saving.
            </div>
          )}

          {/* Business GST Display */}
          {businessSettings?.gst_number && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <span className="text-muted-foreground">Shop GSTIN: </span>
              <span className="font-mono font-medium">{businessSettings.gst_number}</span>
            </div>
          )}

          {/* Client & Invoice Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Select Client</Label>
              <Select value={selectedClient} onValueChange={handleClientChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="walk-in">
                    <span className="text-muted-foreground">New / Walk-in Customer</span>
                  </SelectItem>
                  {clients.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
                        Old Customers
                      </div>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          <div className="flex flex-col">
                            <span>{client.name}</span>
                            {client.phone && (
                              <span className="text-xs text-muted-foreground">{client.phone}</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Client Type / Source</Label>
              <Select value={clientSource} onValueChange={setClientSource}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="walk_in">New / Walk-in Customer</SelectItem>
                  <SelectItem value="existing">Existing Client</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="social_media">Social Media</SelectItem>
                  <SelectItem value="events">Events</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="exhibition">Exhibition</SelectItem>
                  <SelectItem value="wholesale">Wholesale / Bulk</SelectItem>
                  <SelectItem value="corporate">Corporate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Client Name</Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Enter client name"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="Enter phone number"
              />
            </div>
            <div className="space-y-2">
              <Label>Invoice Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !invoiceDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {invoiceDate ? format(invoiceDate, 'dd MMM yyyy') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={invoiceDate}
                    onSelect={(d) => d && setInvoiceDate(d)}
                    initialFocus
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="store_wallet">Store Wallet</SelectItem>
                  <SelectItem value="pay_later">Pay Later</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Metal Rate Toggle (form-only, NOT printed) */}
          <MetalRateToggle
            value={metalRate}
            onChange={setMetalRate}
            goldRate={goldRate}
            silverRate={silverRate}
          />


          {/* Product Items Table */}
          <InvoiceItemsTable
            items={invoiceItems}
            products={products}
            defaultRate={defaultRate}
            onItemsChange={setInvoiceItems}
          />

          {/* GST + Round Off + Live Totals */}
          {invoiceItems.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gst-pct">GST %</Label>
                  <Input
                    id="gst-pct"
                    type="number"
                    step="0.01"
                    min={0}
                    value={gstPct}
                    onChange={(e) => setGstPct(Math.max(0, parseFloat(e.target.value) || 0))}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Split equally as CGST @ {(gstPct / 2).toFixed(2)}% + SGST @ {(gstPct / 2).toFixed(2)}%
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="round-off">Round Off</Label>
                  <Input
                    id="round-off"
                    type="number"
                    step="0.01"
                    value={roundOff}
                    onChange={(e) => setRoundOff(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 0.50 or -0.30"
                  />
                </div>
              </div>

              {/* Live Totals Summary */}
              <div className="text-sm space-y-1 pt-2 border-t">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">₹ {totals.subtotal.toFixed(2)}</span>
                </div>
                {totals.discountAmount > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>Total Discount</span>
                    <span className="tabular-nums">- ₹ {totals.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CGST @ {(gstPct / 2).toFixed(2)}%</span>
                  <span className="tabular-nums">₹ {cgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SGST @ {(gstPct / 2).toFixed(2)}%</span>
                  <span className="tabular-nums">₹ {sgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground italic">
                  <span>Round Off</span>
                  <span className="tabular-nums">
                    {roundOff >= 0 ? '+' : '-'} ₹ {Math.abs(roundOff).toFixed(2)}
                  </span>
                </div>

                {/* Store Wallet Credits */}
                {selectedClient && selectedClient !== 'walk-in' && walletBalance > 0 && (
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-3 mt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold">Store Wallet</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      <div className="flex justify-between sm:block">
                        <span className="text-muted-foreground">Available</span>
                        <div className="font-semibold text-primary tabular-nums">₹ {walletBalance.toFixed(2)}</div>
                      </div>
                      <div>
                        <Label htmlFor="credits-used" className="text-xs text-muted-foreground">Credits to Use</Label>
                        <Input
                          id="credits-used"
                          type="number"
                          step="0.01"
                          min={0}
                          max={Math.min(walletBalance, grandTotalWithRound)}
                          value={storeCreditsUsed}
                          onChange={(e) => setStoreCreditsUsed(parseFloat(e.target.value) || 0)}
                          className="h-8 mt-1 text-right"
                        />
                        {creditsError && (
                          <p className="text-[11px] text-destructive mt-1">{creditsError}</p>
                        )}
                      </div>
                      <div className="flex justify-between sm:block">
                        <span className="text-muted-foreground text-xs">Remaining</span>
                        <div className="font-semibold tabular-nums">₹ {(walletBalance - cappedCredits).toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                )}
                {cappedCredits > 0 && (
                  <div className="flex justify-between text-primary">
                    <span>Less: Store Credits Used</span>
                    <span className="tabular-nums">- ₹ {cappedCredits.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-base font-bold pt-2 border-t">
                  <span>{cappedCredits > 0 ? 'Remaining to Pay' : 'Grand Total'}</span>
                  <span className="text-primary tabular-nums">₹ {grandTotalAfterCredits.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Section */}
              {remainingAfterCredits <= 0.001 && cappedCredits > 0 ? (
                <div className="rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm font-semibold text-green-700 dark:text-green-400">
                  ✓ Paid in Full via Store Credits
                </div>
              ) : remainingAfterCredits > 0 ? (
                <div className="pt-3 border-t space-y-3">
                  <Label className="text-sm font-semibold">Pay Remaining Amount</Label>
                  {payments.length === 0 && (
                    <div className="flex flex-wrap gap-2">
                      {(['cash','upi','card','bank_transfer'] as const).map(m => (
                        <Button
                          key={m}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setPayments([{ mode: m, amount: String(remainingAfterCredits.toFixed(2)) }])}
                          className="capitalize"
                        >
                          {m.replace('_',' ')}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPayments([{ mode: 'pay_later', amount: '0' }])}
                      >
                        Pay Later
                      </Button>
                    </div>
                  )}

                  {payments.map((p, idx) => {
                    const remainingForThis = Math.max(0, remainingAfterCredits - payments.reduce((s, pp, i) => i === idx ? s : s + (parseFloat(pp.amount)||0), 0));
                    return (
                      <div key={idx} className="rounded-md border p-3 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {(['cash','upi','card','bank_transfer'] as const).map(m => (
                            <Button
                              key={m}
                              type="button"
                              variant={p.mode === m ? 'default' : 'outline'}
                              size="sm"
                              className="capitalize"
                              onClick={() => {
                                const next = [...payments];
                                next[idx] = { ...next[idx], mode: m };
                                setPayments(next);
                              }}
                            >
                              {m.replace('_',' ')}
                            </Button>
                          ))}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="ml-auto text-destructive"
                            onClick={() => setPayments(payments.filter((_, i) => i !== idx))}
                          >
                            Remove
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                          <div>
                            <Label className="text-xs">Amount Paying via {p.mode.replace('_',' ')}</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              value={p.amount}
                              onChange={(e) => {
                                const next = [...payments];
                                next[idx] = { ...next[idx], amount: e.target.value };
                                setPayments(next);
                              }}
                              className="mt-1"
                            />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Suggested: ₹ {remainingForThis.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {payments.length > 0 && balanceDue > 0 && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="px-0"
                      onClick={() => setPayments([...payments, { mode: 'cash', amount: String(balanceDue.toFixed(2)) }])}
                    >
                      + Add another payment method
                    </Button>
                  )}

                  {payments.length > 0 && (
                    <div className="text-sm space-y-1 pt-2 border-t">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Remaining to Pay</span>
                        <span className="tabular-nums">₹ {remainingAfterCredits.toFixed(2)}</span>
                      </div>
                      {payments.map((p, i) => (
                        <div key={i} className="flex justify-between text-muted-foreground">
                          <span className="capitalize">Paying via {p.mode.replace('_',' ')}</span>
                          <span className="tabular-nums">- ₹ {(parseFloat(p.amount)||0).toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-semibold pt-1 border-t">
                        <span>Balance Due</span>
                        <span className="tabular-nums text-primary">₹ {balanceDue.toFixed(2)}</span>
                      </div>
                      {isFullyPaid ? (
                        <div className="mt-2 rounded-md border border-green-500/40 bg-green-500/10 px-3 py-1.5 text-xs font-semibold text-green-700 dark:text-green-400 inline-block">
                          ✓ Paid in Full
                        </div>
                      ) : effectiveAdvance > 0 ? (
                        <div className="mt-2 rounded-md border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold text-orange-700 dark:text-orange-400 inline-block">
                          Partial Payment
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}

              {/* Final Payment Summary */}
              {invoiceItems.length > 0 && (
                <div className="rounded-md border border-primary/30 bg-muted/40 p-3 mt-3 text-sm space-y-1">
                  <div className="font-semibold mb-1">Payment Summary</div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Grand Total</span>
                    <span className="tabular-nums">₹ {grandTotalWithRound.toFixed(2)}</span>
                  </div>
                  {cappedCredits > 0 && (
                    <div className="flex justify-between text-primary">
                      <span>Store Credits Used</span>
                      <span className="tabular-nums">- ₹ {cappedCredits.toFixed(2)}</span>
                    </div>
                  )}
                  {payments.filter(p => (parseFloat(p.amount)||0) > 0).map((p, i) => (
                    <div key={i} className="flex justify-between text-muted-foreground">
                      <span className="capitalize">Paid via {p.mode.replace('_',' ')}</span>
                      <span className="tabular-nums">- ₹ {(parseFloat(p.amount)||0).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-semibold pt-1 border-t">
                    <span>Balance Due</span>
                    <span className="tabular-nums text-primary">₹ {balanceDue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Status</span>
                    <span className={cn(
                      'font-semibold',
                      paymentStatusUI === 'PAID' && 'text-green-600',
                      paymentStatusUI === 'PARTIAL' && 'text-orange-600',
                      paymentStatusUI === 'PENDING' && 'text-destructive',
                    )}>{paymentStatusUI}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes for this invoice..."
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowPreview(true)}
              disabled={invoiceItems.length === 0}
            >
              <Eye className="w-4 h-4 mr-2" />
              Preview Invoice
            </Button>
            <Button
              variant="outline"
              onClick={handlePrintPreview}
              disabled={invoiceItems.length === 0}
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={handleSaveAsDraft}
              disabled={invoiceItems.length === 0 || isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save as Draft'}
            </Button>
            <Button
              className="btn-gold"
              onClick={handleCreateInvoice}
              disabled={invoiceItems.length === 0 || isSubmitting}
            >
              <Download className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Creating...' : 'Create & Download'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Invoice Preview Modal */}
    {businessSettings && (
      <InvoicePreviewModal
        open={showPreview}
        onOpenChange={setShowPreview}
        invoiceNumber="PREVIEW"
        invoiceDate={invoiceDate.toISOString()}
        clientName={clientName || 'Walk-in Customer'}
        clientPhone={clientPhone}
        paymentMode={combinedPaymentLabel}
        items={invoiceItems}
        totals={totals}
        businessSettings={businessSettings}
        notes={notes}
        showMakingCharges={true}
        gstPercentage={gstPct}
        roundOff={roundOff}
        advancePaid={effectiveAdvance}
        storeCreditsUsed={cappedCredits}
        paymentBreakdown={effectivePaymentBreakdown}
      />
    )}
  </>
  );
}
