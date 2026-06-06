import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Download, Printer, FileText, Eye, Calendar as CalendarBadgeIcon, Clock, CalendarIcon, Pencil, Save, XCircle } from 'lucide-react';
import { downloadInvoicePdf, printInvoice } from '@/utils/invoicePdf';
import { InvoicePreviewModal } from './InvoicePreviewModal';
import { InvoiceStatusBadge, InvoiceStatusActions } from './InvoiceStatusActions';
import { InvoiceItemsTable } from './InvoiceItemsTable';
import { InvoicePaymentHistory } from './InvoicePaymentHistory';
import { InvoiceTotalsSection } from './InvoiceTotalsSection';
import { MetalRateToggle, type MetalRateOption } from './MetalRateToggle';
import { useInvoiceCalculations } from '@/hooks/useInvoiceCalculations';
import { useActivityLogger } from '@/hooks/useActivityLog';
import { adjustWallet } from '@/hooks/useStoreWallet';
import { cn } from '@/lib/utils';
import type { BusinessSettings, InvoiceItem, InvoiceTotals, InvoiceStatus, Product } from '@/types/invoice';
import { format } from 'date-fns';

interface ViewInvoiceDialogProps {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange?: () => void;
}

interface InvoiceDetails {
  id: string;
  invoice_number: string;
  invoice_date: string;
  subtotal: number;
  discount_amount: number;
  gst_amount: number;
  grand_total: number;
  advance_paid: number;
  round_off: number;
  payment_mode: string | null;
  payment_status: string;
  notes: string | null;
  status: InvoiceStatus;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  client_id: string | null;
  clients: { name: string; phone: string | null } | null;
}

interface InvoiceItemRow {
  id: string;
  product_id: string | null;
  product_name: string;
  category: string | null;
  weight_grams: number;
  quantity: number;
  rate_per_gram: number;
  gold_value: number;
  making_charges: number;
  discount: number;
  discounted_making: number;
  subtotal: number;
  gst_percentage: number;
  gst_amount: number;
  total: number;
  mrp: number;
  description: string | null;
  products: { sku: string } | null;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
};

export function ViewInvoiceDialog({
  invoiceId,
  open,
  onOpenChange,
  onStatusChange,
}: ViewInvoiceDialogProps) {
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [items, setItems] = useState<InvoiceItemRow[]>([]);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editClientName, setEditClientName] = useState('');
  const [editClientPhone, setEditClientPhone] = useState('');
  const [editPaymentMode, setEditPaymentMode] = useState('cash');
  const [editInvoiceDate, setEditInvoiceDate] = useState<Date>(new Date());
  const [editNotes, setEditNotes] = useState('');
  const [editItems, setEditItems] = useState<InvoiceItem[]>([]);
  const [editMetalRate, setEditMetalRate] = useState<MetalRateOption>('silver');
  const [editRoundOff, setEditRoundOff] = useState<number>(0);

  const { toast } = useToast();
  const { user, userRole } = useAuth();
  const isAdmin = userRole === 'admin';
  const { logActivity } = useActivityLogger();
  const { totals: editTotals } = useInvoiceCalculations(editItems);

  const goldRate = businessSettings?.gold_rate_per_gram || 0;
  const silverRate = businessSettings?.silver_rate_per_gram || 95;
  const editDefaultRate = (() => {
    if (editMetalRate === 'gold_22k') return goldRate;
    if (editMetalRate === 'gold_18k') return goldRate * (18 / 22);
    if (editMetalRate === 'silver') return silverRate;
    return 0;
  })();

  useEffect(() => {
    if (open && invoiceId) {
      setIsEditing(false);
      fetchInvoiceDetails();
      fetchBusinessSettings();
      fetchProducts();
    }
  }, [open, invoiceId]);

  const fetchInvoiceDetails = async () => {
    if (!invoiceId) return;
    setIsLoading(true);

    const [invoiceResult, itemsResult] = await Promise.all([
      supabase
        .from('invoices')
        .select('*, clients(name, phone)')
        .eq('id', invoiceId)
        .single(),
      supabase
        .from('invoice_items')
        .select('*, products(sku)')
        .eq('invoice_id', invoiceId)
        .order('created_at'),
    ]);

    if (invoiceResult.data) {
      const data = invoiceResult.data as Record<string, unknown>;
      const subtotal = Number(data.subtotal) || 0;
      const gst = Number(data.gst_amount) || 0;
      const roundOffVal = Number(data.round_off) || 0;
      // subtotal stored in DB is already NET of discount (sum of line_totals).
      // So grand total = subtotal + GST + round_off. Do NOT subtract discount again.
      const computedGrand = Math.round((subtotal + gst + roundOffVal) * 100) / 100;
      const storedGrand = Number(data.grand_total) || 0;
      // Auto-heal stored grand_total only if it's meaningfully off (legacy bugs).
      if (Math.abs(computedGrand - storedGrand) > 0.05) {
        data.grand_total = computedGrand;
        supabase
          .from('invoices')
          .update({ grand_total: computedGrand } as never)
          .eq('id', invoiceId)
          .then(() => {});
      }
      setInvoice({
        ...data,
        status: (data.status as InvoiceStatus) || 'draft',
        sent_at: data.sent_at as string | null,
        paid_at: data.paid_at as string | null,
      } as InvoiceDetails);
    }
    if (itemsResult.data) {
      setItems(itemsResult.data as unknown as InvoiceItemRow[]);
    }

    setIsLoading(false);
  };

  const fetchBusinessSettings = async () => {
    const { data } = await supabase
      .from('business_settings')
      .select('*')
      .maybeSingle();
    if (data) setBusinessSettings(data as BusinessSettings);
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*, categories(name)')
      .is('deleted_at', null)
      .order('name');
    const mapped = (data || []).map((p: Record<string, unknown>) => ({
      ...p,
      pricing_mode: (p.pricing_mode as string || 'weight_based') as 'weight_based' | 'flat_price',
      mrp: Number(p.mrp) || 0,
    }));
    setProducts(mapped as unknown as Product[]);
  };

  const enterEditMode = () => {
    if (!invoice) return;
    setEditClientName(invoice.clients?.name || '');
    setEditClientPhone(invoice.clients?.phone || '');
    setEditPaymentMode(invoice.payment_mode || 'cash');
    // Parse as local date to avoid UTC shift (yyyy-MM-dd -> midnight local)
    const [y, m, d] = (invoice.invoice_date || '').split('-').map(Number);
    setEditInvoiceDate(y && m && d ? new Date(y, m - 1, d) : new Date(invoice.invoice_date));
    setEditNotes(invoice.notes || '');
    setEditItems(getInvoiceItems());
    setEditRoundOff(Number(invoice.round_off) || 0);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!invoice || editItems.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Add at least one product' });
      return;
    }

    setIsSaving(true);
    try {
      const isDraft = invoice.status === 'draft';

      // 1) Delete existing items — DB trigger will restore stock automatically
      //    (trigger skips restore for drafts, which is what we want)
      const { error: delErr } = await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', invoice.id);
      if (delErr) throw delErr;

      // 2) Update invoice header — preserve advance_paid / store_credits_used
      const newRoundOff = Number(editRoundOff) || 0;
      const newGrandTotal = (editTotals.grandTotal || 0) + newRoundOff;

      // Recompute payment_status from REAL payments vs new grand_total
      // (Discount/Adjusted amounts must NOT influence status.)
      let computedStatus: string;
      if (isDraft) {
        computedStatus = 'pending';
      } else {
        const { data: payRows } = await supabase
          .from('invoice_payments')
          .select('amount')
          .eq('invoice_id', invoice.id);
        const credits = Number((invoice as unknown as { store_credits_used?: number }).store_credits_used) || 0;
        const paidSum = (payRows || []).reduce((s, r: any) => s + Number(r.amount || 0), 0) + credits;
        const diff = Math.round((newGrandTotal - paidSum) * 100) / 100;
        if (paidSum <= 0) computedStatus = 'pending';
        else if (diff <= 0.05) computedStatus = 'paid';
        else computedStatus = 'partial';
      }

      const { error: updErr } = await supabase
        .from('invoices')
        .update({
          invoice_date: format(editInvoiceDate, 'yyyy-MM-dd'),
          payment_mode: editPaymentMode,
          payment_status: computedStatus,
          notes: editNotes || null,
          subtotal: editTotals.subtotal,
          discount_amount: editTotals.discountAmount,
          gst_amount: editTotals.gstAmount,
          round_off: newRoundOff,
          grand_total: newGrandTotal,
        } as never)
        .eq('id', invoice.id);
      if (updErr) throw updErr;

      // 3) Resolve & link client by priority: existing client_id → phone → exact name → walk-in
      let linkedClientId = invoice.client_id;
      const trimmedPhone = (editClientPhone || '').trim();
      const trimmedName = (editClientName || '').trim();

      if (trimmedPhone) {
        // Upsert by phone
        const { data: upsertedId, error: cliErr } = await supabase.rpc('upsert_client_on_invoice', {
          p_phone: trimmedPhone,
          p_name: trimmedName || 'Walk-in Customer',
          p_amount: 0,
        });
        if (!cliErr && upsertedId) {
          linkedClientId = upsertedId as string;
          await supabase
            .from('clients')
            .update({ name: trimmedName || 'Walk-in Customer', phone: trimmedPhone } as never)
            .eq('id', linkedClientId);
        }
      } else if (linkedClientId && trimmedName) {
        // Have an existing client — update its name (phone may legitimately be blank)
        await supabase
          .from('clients')
          .update({ name: trimmedName } as never)
          .eq('id', linkedClientId);
      } else if (!linkedClientId && trimmedName) {
        // No client linked yet, no phone — match by exact name, else create
        const { data: existing } = await supabase
          .from('clients')
          .select('id')
          .ilike('name', trimmedName)
          .maybeSingle();
        if (existing?.id) {
          linkedClientId = existing.id;
        } else {
          const { data: created } = await supabase
            .from('clients')
            .insert({ name: trimmedName } as never)
            .select('id')
            .single();
          linkedClientId = (created as any)?.id || null;
        }
      }

      if (linkedClientId && linkedClientId !== invoice.client_id) {
        await supabase.from('invoices').update({ client_id: linkedClientId } as never).eq('id', invoice.id);
      }

      // 4) Insert new invoice items (trigger reduces stock for non-draft invoices)
      const itemsToInsert = editItems.map((item) => ({
        invoice_id: invoice.id,
        product_id: item.product_id || null,
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

      const { error: insertErr } = await supabase.from('invoice_items').insert(itemsToInsert);
      if (insertErr) throw insertErr;

      logActivity({
        module: 'invoice',
        action: 'update',
        recordId: invoice.id,
        recordLabel: invoice.invoice_number,
        newValue: { grand_total: editTotals.grandTotal, items_count: editItems.length },
      });

      toast({ title: 'Invoice updated successfully' });
      setIsEditing(false);
      await fetchInvoiceDetails();
      onStatusChange?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Update failed';
      console.error('Invoice update failed:', error);
      toast({ variant: 'destructive', title: 'Error', description: message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDraft = async () => {
    if (!invoice || invoice.status !== 'draft') return;
    if (!confirm(`Finalize draft ${invoice.invoice_number}? This will assign an invoice number, deduct stock and apply any store credits.`)) return;

    setIsSaving(true);
    try {
      // SAFEGUARD: re-fetch latest status to prevent double-finalize race (would double-deduct stock)
      const { data: latest, error: chkErr } = await supabase
        .from('invoices')
        .select('status')
        .eq('id', invoice.id)
        .single();
      if (chkErr) throw chkErr;
      if (!latest || (latest as { status: string }).status !== 'draft') {
        toast({ variant: 'destructive', title: 'Already finalized', description: 'This invoice is no longer a draft.' });
        await fetchInvoiceDetails();
        return;
      }

      // Assign a real invoice number
      const { data: newNum, error: numErr } = await supabase.rpc('generate_invoice_number');
      if (numErr) throw numErr;

      const credits = Number((invoice as unknown as { store_credits_used?: number }).store_credits_used) || 0;
      const advance = Number(invoice.advance_paid) || 0;
      const total = Number(invoice.grand_total) || 0;
      const status =
        credits + advance >= total - 0.001 ? 'paid'
        : advance > 0 ? 'partial' : 'pending';

      // Flip status FIRST (only if still draft) so subsequent reduction we perform manually.
      // The .eq('status','draft') is a concurrency guard — if another tab already flipped it, this updates 0 rows.
      const { data: flipped, error: flipErr } = await supabase
        .from('invoices')
        .update({
          invoice_number: newNum,
          status,
          payment_status: status,
          paid_at: status === 'paid' ? new Date().toISOString() : null,
        } as never)
        .eq('id', invoice.id)
        .eq('status', 'draft')
        .select('id');
      if (flipErr) throw flipErr;
      if (!flipped || flipped.length === 0) {
        toast({ variant: 'destructive', title: 'Already finalized', description: 'This draft was finalized elsewhere.' });
        await fetchInvoiceDetails();
        return;
      }


      // Manually reduce stock for each item (trigger had skipped because invoice was draft at insert time)
      for (const it of items) {
        if (!it.product_id) continue;
        const { data: prod } = await supabase.from('products').select('quantity').eq('id', it.product_id).single();
        const currentQty = Number(prod?.quantity) || 0;
        await supabase.from('products')
          .update({ quantity: Math.max(0, currentQty - Number(it.quantity)) })
          .eq('id', it.product_id);
        await supabase.from('stock_history').insert([{
          product_id: it.product_id,
          quantity_change: -Number(it.quantity),
          type: 'out',
          reason: `Invoice ${newNum} finalized from draft`,
          reference_id: invoice.id,
          created_by: user?.id || null,
        }]);
      }

      // Debit wallet for credits
      if (credits > 0 && invoice.client_id) {
        try {
          await adjustWallet(invoice.client_id, -credits, 'invoice', invoice.id, newNum as string, 'Credits applied on draft finalize');
        } catch (e) { console.error('Wallet debit failed', e); }
      }

      // Record advance as invoice_payment
      if (advance > 0) {
        const { data: rcpt } = await supabase.rpc('generate_receipt_number');
        await supabase.from('invoice_payments').insert([{
          invoice_id: invoice.id,
          receipt_number: rcpt,
          amount: advance,
          payment_mode: invoice.payment_mode || 'cash',
          payment_date: invoice.invoice_date,
          notes: 'Payment received at draft finalize',
          created_by: user?.id,
        }]);
      }

      logActivity({
        module: 'invoice',
        action: 'update',
        recordId: invoice.id,
        recordLabel: newNum as string,
        newValue: { status, finalized_from_draft: true },
      });

      toast({ title: `Draft finalized as ${newNum}` });
      await fetchInvoiceDetails();
      onStatusChange?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to finalize draft';
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: message });
    } finally {
      setIsSaving(false);
    }
  };

  const getInvoiceItems = (): InvoiceItem[] => {
    return items.map((item) => {
      const isFlat = Number(item.rate_per_gram) === 0 && Number(item.making_charges) === 0;
      const weightGrams = Number(item.weight_grams);
      const makingCharges = Number(item.making_charges);
      const makingChargesPerGram = weightGrams > 0 ? makingCharges / weightGrams : 0;
      return {
        product_id: item.product_id || '',
        sku: item.products?.sku || 'N/A',
        product_name: item.product_name,
        category: item.category || '',
        weight_grams: weightGrams,
        quantity: item.quantity,
        rate_per_gram: Number(item.rate_per_gram),
        base_price: Number(item.gold_value),
        making_charges: makingCharges,
        making_charges_per_gram: makingChargesPerGram,
        discount: Number(item.discount),
        discount_type: 'fixed' as const,
        discount_value: Number(item.discount),
        discounted_making: Number(item.discounted_making),
        line_total: Number(item.subtotal),
        gst_percentage: Number(item.gst_percentage),
        pricing_mode: isFlat ? ('flat_price' as const) : ('weight_based' as const),
        mrp: Number(item.mrp) || 0,
        description: item.description || '',
      };
    });
  };

  const getTotals = (): InvoiceTotals => {
    if (!invoice) return { subtotal: 0, discountAmount: 0, gstAmount: 0, grandTotal: 0 };
    return {
      subtotal: Number(invoice.subtotal),
      discountAmount: Number(invoice.discount_amount),
      gstAmount: Number(invoice.gst_amount),
      grandTotal: Number(invoice.grand_total),
    };
  };

  const buildMetalRateLabel = () => {
    const silver = Number(businessSettings?.silver_rate_per_gram) || 0;
    const gold = Number(businessSettings?.gold_rate_per_gram) || 0;
    const fmt = (r: number) =>
      new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(r || 0);
    // Infer which metal(s) this invoice used by comparing item rate_per_gram to settings
    const items = getInvoiceItems();
    const rates = items
      .filter((i) => i.pricing_mode !== 'flat_price' && Number(i.rate_per_gram) > 0)
      .map((i) => Number(i.rate_per_gram));
    const labels: string[] = [];
    const hasGold = rates.some((r) => gold > 0 && r >= gold * 0.7);
    const hasSilver = rates.some((r) => silver > 0 && r < (gold || Infinity) * 0.7);
    if (hasGold && gold > 0) labels.push(`Gold Rate: ₹ ${fmt(gold)}/g`);
    if (hasSilver && silver > 0) labels.push(`Silver Rate: ₹ ${fmt(silver)}/g`);
    if (labels.length === 0) {
      if (silver > 0) labels.push(`Silver Rate: ₹ ${fmt(silver)}/g`);
      if (gold > 0) labels.push(`Gold Rate: ₹ ${fmt(gold)}/g`);
    }
    return labels.length ? labels.join('  ·  ') : undefined;
  };

  const handleDownload = () => {
    if (!invoice || !businessSettings) return;
    const inv = invoice as unknown as { cancellation_reason?: string | null };
    downloadInvoicePdf({
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      clientName: invoice.clients?.name || 'Walk-in Customer',
      clientPhone: invoice.clients?.phone || '',
      paymentMode: invoice.payment_mode || 'cash',
      items: getInvoiceItems(),
      totals: getTotals(),
      businessSettings,
      notes: invoice.notes || undefined,
      advancePaid: Number(invoice.advance_paid) || 0,
      storeCreditsUsed: Number((invoice as unknown as { store_credits_used?: number }).store_credits_used) || 0,
      paymentReceivedDate: invoice.paid_at || null,
      cancelled: invoice.status === 'cancelled',
      cancellationReason: inv.cancellation_reason || null,
      roundOff: Number(invoice.round_off) || 0,
      metalRateLabel: buildMetalRateLabel(),
    }, isAdmin);
  };

  const handlePrint = () => {
    if (!invoice || !businessSettings) return;
    const inv = invoice as unknown as { cancellation_reason?: string | null };
    printInvoice({
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      clientName: invoice.clients?.name || 'Walk-in Customer',
      clientPhone: invoice.clients?.phone || '',
      paymentMode: invoice.payment_mode || 'cash',
      items: getInvoiceItems(),
      totals: getTotals(),
      businessSettings,
      notes: invoice.notes || undefined,
      advancePaid: Number(invoice.advance_paid) || 0,
      storeCreditsUsed: Number((invoice as unknown as { store_credits_used?: number }).store_credits_used) || 0,
      paymentReceivedDate: invoice.paid_at || null,
      cancelled: invoice.status === 'cancelled',
      cancellationReason: inv.cancellation_reason || null,
      roundOff: Number(invoice.round_off) || 0,
      metalRateLabel: buildMetalRateLabel(),
    }, isAdmin);
  };

  const handleStatusChange = () => {
    fetchInvoiceDetails();
    onStatusChange?.();
  };

  const handleCancelInvoice = async () => {
    if (!invoice) return;
    const reason = window.prompt('Reason for cancelling this invoice?');
    if (!reason || !reason.trim()) {
      toast({ variant: 'destructive', title: 'Cancellation reason required' });
      return;
    }
    if (!confirm(`Cancel invoice ${invoice.invoice_number}? Stock will be restored and any wallet credits used will be refunded.`)) return;
    try {
      // Restore stock for each item with product_id
      for (const it of items) {
        if (!it.product_id) continue;
        const { data: prod } = await supabase.from('products').select('quantity').eq('id', it.product_id).single();
        const currentQty = Number(prod?.quantity) || 0;
        await supabase.from('products').update({ quantity: currentQty + Number(it.quantity) }).eq('id', it.product_id);
        await supabase.from('stock_history').insert([{
          product_id: it.product_id,
          quantity_change: Number(it.quantity),
          type: 'in',
          reason: `Invoice ${invoice.invoice_number} cancelled`,
          reference_id: invoice.id,
          created_by: user?.id || null,
        }]);
      }

      // Refund any wallet credits used back to client
      const credits = Number((invoice as unknown as { store_credits_used?: number }).store_credits_used) || 0;
      if (credits > 0 && invoice.client_id) {
        try {
          await adjustWallet(invoice.client_id, credits, 'cancel_refund', invoice.id, invoice.invoice_number, 'Invoice cancelled — credits refunded');
        } catch (e) {
          console.error('Wallet refund on cancel failed', e);
        }
      }

      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: user?.id || null,
          cancellation_reason: reason.trim(),
        } as never)
        .eq('id', invoice.id);
      if (error) throw error;

      logActivity({
        module: 'invoice',
        action: 'update',
        recordId: invoice.id,
        recordLabel: invoice.invoice_number,
        newValue: { status: 'cancelled', reason: reason.trim() },
      });

      toast({ title: 'Invoice cancelled', description: 'Stock restored.' });
      await fetchInvoiceDetails();
      onStatusChange?.();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to cancel invoice';
      toast({ variant: 'destructive', title: 'Error', description: message });
    }
  };

  if (isLoading || !invoice) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="!max-w-[95vw] w-[95vw] !max-h-[95vh] h-[95vh] xl:min-w-[1600px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Invoice {invoice.invoice_number}
              {isEditing && <span className="text-xs font-normal text-muted-foreground ml-2">(Editing)</span>}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Status and Actions Bar */}
            {!isEditing && (
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <InvoiceStatusBadge status={invoice.status} />
                    <InvoiceStatusActions
                      invoiceId={invoice.id}
                      invoiceNumber={invoice.invoice_number}
                      grandTotal={Number(invoice.grand_total) || 0}
                      advancePaid={Number(invoice.advance_paid) || 0}
                      currentStatus={invoice.status}
                      onStatusChange={handleStatusChange}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {invoice.status === 'draft' && (
                      <Button
                        size="sm"
                        className="btn-gold"
                        onClick={handleConfirmDraft}
                        disabled={isSaving}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {isSaving ? 'Finalizing...' : 'Confirm & Finalize'}
                      </Button>
                    )}
                    {isAdmin && invoice.status !== 'cancelled' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelInvoice}
                        className="text-destructive hover:text-destructive"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Cancel Invoice
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={enterEditMode} disabled={invoice.status === 'cancelled'}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Edit Invoice
                    </Button>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border/50">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <CalendarBadgeIcon className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Created</p>
                        <p className="font-medium">{format(new Date(invoice.created_at), 'dd MMM yyyy, HH:mm')}</p>
                      </div>
                    </div>
                    {invoice.sent_at && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-500" />
                        <div>
                          <p className="text-muted-foreground">Sent</p>
                          <p className="font-medium">{format(new Date(invoice.sent_at), 'dd MMM yyyy, HH:mm')}</p>
                        </div>
                      </div>
                    )}
                    {invoice.paid_at && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-green-500" />
                        <div>
                          <p className="text-muted-foreground">Paid</p>
                          <p className="font-medium">{format(new Date(invoice.paid_at), 'dd MMM yyyy, HH:mm')}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!isEditing ? (
              <>
                {/* Invoice Header (read-only) */}
                <div className="bg-muted/30 rounded-lg p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Invoice Number</p>
                      <p className="font-medium">{invoice.invoice_number}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Date</p>
                      <p className="font-medium">{new Date(invoice.invoice_date).toLocaleDateString('en-IN')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Client</p>
                      <p className="font-medium">{invoice.clients?.name || 'Walk-in Customer'}</p>
                      {invoice.clients?.phone && (
                        <p className="text-xs text-muted-foreground">{invoice.clients.phone}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground">Payment Mode</p>
                      <p className="font-medium capitalize">{invoice.payment_mode || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Client Type</p>
                      <p className="font-medium capitalize">
                        {((invoice as unknown as { client_source?: string }).client_source || 'walk_in')
                          .replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Items Table (read-only) */}
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-3 text-left font-medium">SKU</th>
                        <th className="px-3 py-3 text-left font-medium">Description</th>
                        <th className="px-3 py-3 text-right font-medium">Wt(G)</th>
                        <th className="px-3 py-3 text-center font-medium">Qty</th>
                        <th className="px-3 py-3 text-right font-medium">Rate/g</th>
                        {isAdmin && (
                          <>
                            <th className="px-3 py-3 text-right font-medium">MC</th>
                            <th className="px-3 py-3 text-right font-medium">MRP</th>
                            <th className="px-3 py-3 text-right font-medium">MC/g</th>
                            <th className="px-3 py-3 text-right font-medium">Discount</th>
                          </>
                        )}
                        
                        <th className="px-3 py-3 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const isFlat = Number(item.rate_per_gram) === 0 && Number(item.making_charges) === 0;
                        return (
                          <tr key={item.id} className="border-t">
                            <td className="px-3 py-3 font-mono text-xs">{item.products?.sku || 'N/A'}</td>
                            <td className="px-3 py-3">
                              <div>
                                <p className="font-medium">{item.product_name}</p>
                                {item.category && <p className="text-xs text-muted-foreground">{item.category}</p>}
                                {item.description && <p className="text-xs text-muted-foreground italic">{item.description}</p>}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-right">{isFlat ? '-' : Number(item.weight_grams).toFixed(2)}</td>
                            <td className="px-3 py-3 text-center">{item.quantity}</td>
                            <td className="px-3 py-3 text-right">{isFlat ? '-' : formatCurrency(Number(item.rate_per_gram))}</td>
                            {isAdmin && (
                              <>
                                <td className="px-3 py-3 text-right">{isFlat ? '-' : formatCurrency(Number(item.making_charges))}</td>
                                <td className="px-3 py-3 text-right">{formatCurrency(Number(item.mrp) || 0)}</td>
                                <td className="px-3 py-3 text-right text-xs text-muted-foreground">
                                  {isFlat ? '-' : (Number(item.weight_grams) > 0 ? formatCurrency(Number(item.making_charges) / Number(item.weight_grams)) + '/g' : '-')}
                                </td>
                                <td className="px-3 py-3 text-right text-destructive">
                                  {Number(item.discount) > 0 ? `-${formatCurrency(Number(item.discount))}` : '-'}
                                </td>
                              </>
                            )}
                            
                            <td className="px-3 py-3 text-right font-medium">{formatCurrency(Number(item.subtotal))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Totals — MRP-based (discount applied once) */}
                {(() => {
                  const sub = Number(invoice.subtotal) || 0;
                  const disc = Number(invoice.discount_amount) || 0;
                  const gst = Number(invoice.gst_amount) || 0;
                  const ro = Number(invoice.round_off) || 0;
                  const mrpTotal = sub + disc;
                  const cgstV = gst / 2;
                  const sgstV = gst / 2;
                  const gstPctView = sub > 0 ? (gst / sub) * 100 : 3;
                  const grand = sub + gst + ro;
                  return (
                    <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-base font-bold">
                        <span>MRP (Total)</span>
                        <span className="tabular-nums">{formatCurrency(mrpTotal)}</span>
                      </div>
                      {isAdmin && disc > 0 && (
                        <div className="flex justify-between text-destructive">
                          <span>− Discount</span>
                          <span className="tabular-nums">−{formatCurrency(disc)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">CGST @ {(gstPctView / 2).toFixed(2)}%</span>
                        <span className="tabular-nums">{formatCurrency(cgstV)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">SGST @ {(gstPctView / 2).toFixed(2)}%</span>
                        <span className="tabular-nums">{formatCurrency(sgstV)}</span>
                      </div>
                      {ro !== 0 && (
                        <div className="flex justify-between text-muted-foreground italic">
                          <span>{ro >= 0 ? 'Round Off' : '− Round Off'}</span>
                          <span className="tabular-nums">{formatCurrency(Math.abs(ro))}</span>
                        </div>
                      )}
                      <div
                        className="flex items-center justify-between mt-2 px-3 py-2 rounded-md text-white font-bold"
                        style={{ background: '#4a2060' }}
                      >
                        <span className="uppercase tracking-wider text-sm">Grand Total</span>
                        <span className="tabular-nums text-lg">{formatCurrency(grand)}</span>
                      </div>
                    </div>
                  );
                })()}

                <InvoicePaymentHistory
                  invoiceId={invoice.id}
                  invoiceNumber={invoice.invoice_number}
                  grandTotal={Number(invoice.grand_total) || 0}
                  customerName={invoice.clients?.name || 'Walk-in Customer'}
                  customerPhone={invoice.clients?.phone || ''}
                  businessSettings={businessSettings}
                />

                {/* Notes */}
                {invoice.notes && (
                  <div className="text-sm">
                    <p className="text-muted-foreground">Notes:</p>
                    <p className="italic">{invoice.notes}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-background border-t flex flex-wrap justify-end gap-3 z-10">
                  <Button variant="outline" onClick={() => setShowPreview(true)}>
                    <Eye className="w-4 h-4 mr-2" />
                    Preview Invoice
                  </Button>
                  <Button variant="outline" onClick={handlePrint}>
                    <Printer className="w-4 h-4 mr-2" />
                    Print
                  </Button>
                  <Button className="btn-gold" onClick={handleDownload}>
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* EDIT MODE */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label>Client Name</Label>
                    <Input value={editClientName} onChange={(e) => setEditClientName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input value={editClientPhone} onChange={(e) => setEditClientPhone(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Invoice Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn('w-full justify-start text-left font-normal', !editInvoiceDate && 'text-muted-foreground')}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {editInvoiceDate ? format(editInvoiceDate, 'dd MMM yyyy') : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={editInvoiceDate}
                          onSelect={(d) => d && setEditInvoiceDate(d)}
                          initialFocus
                          className={cn('p-3 pointer-events-auto')}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Mode</Label>
                    <Select value={editPaymentMode} onValueChange={setEditPaymentMode}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="pay_later">Pay Later</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Invoice Number</Label>
                    <Input value={invoice.invoice_number} disabled />
                  </div>
                </div>

                <MetalRateToggle
                  value={editMetalRate}
                  onChange={setEditMetalRate}
                  goldRate={goldRate}
                  silverRate={silverRate}
                />

                <InvoiceItemsTable
                  items={editItems}
                  products={products}
                  defaultRate={editDefaultRate}
                  onItemsChange={setEditItems}
                />

                {editItems.length > 0 && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-round-off">Round Off</Label>
                        <Input
                          id="edit-round-off"
                          type="number"
                          step="0.01"
                          value={editRoundOff}
                          onChange={(e) => setEditRoundOff(parseFloat(e.target.value) || 0)}
                          placeholder="e.g. -0.53"
                        />
                        <p className="text-xs text-muted-foreground">
                          Adjusts Grand Total. Use a negative value (e.g. -0.53) to round down.
                        </p>
                      </div>
                      <div className="md:col-span-2 flex items-end">
                        <div className="w-full bg-muted/40 rounded-md p-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Taxable + CGST + SGST</span>
                            <span>{formatCurrency(editTotals.grandTotal)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Round Off</span>
                            <span>{(editRoundOff >= 0 ? '+ ' : '- ')}{formatCurrency(Math.abs(editRoundOff))}</span>
                          </div>
                          <div className="flex justify-between font-bold pt-2 border-t mt-2">
                            <span>New Grand Total</span>
                            <span className="text-primary">{formatCurrency((editTotals.grandTotal || 0) + (Number(editRoundOff) || 0))}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <InvoiceTotalsSection totals={editTotals} isAdmin={true} roundOff={editRoundOff} />
                  </>
                )}

                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} />
                </div>

                <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-background border-t flex flex-wrap justify-end gap-3 z-10">
                  <Button variant="outline" onClick={cancelEdit} disabled={isSaving}>
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button className="btn-gold" onClick={handleSaveEdit} disabled={isSaving || editItems.length === 0}>
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice Preview Modal */}
      {businessSettings && (
        <InvoicePreviewModal
          open={showPreview}
          onOpenChange={setShowPreview}
          invoiceNumber={invoice.invoice_number}
          invoiceDate={invoice.invoice_date}
          clientName={invoice.clients?.name || 'Walk-in Customer'}
          clientPhone={invoice.clients?.phone || ''}
          paymentMode={invoice.payment_mode || 'cash'}
          items={getInvoiceItems()}
          totals={getTotals()}
          businessSettings={businessSettings}
          notes={invoice.notes || undefined}
          advancePaid={Number(invoice.advance_paid) || 0}
          storeCreditsUsed={Number((invoice as unknown as { store_credits_used?: number }).store_credits_used) || 0}
          roundOff={Number(invoice.round_off) || 0}
          showMakingCharges={isAdmin}
          metalRateLabel={buildMetalRateLabel()}
        />
      )}
    </>
  );
}
