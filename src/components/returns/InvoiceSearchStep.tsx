import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ReturnItemSelection } from '@/types/returnExchange';

interface InvoiceData {
  id: string;
  invoice_number: string;
  client_name: string;
  client_phone: string;
}

interface InvoiceSearchStepProps {
  onInvoiceLoaded: (data: InvoiceData, items: ReturnItemSelection[]) => void;
  preselectedInvoiceId?: string | null;
}

export function InvoiceSearchStep({ onInvoiceLoaded, preselectedInvoiceId }: InvoiceSearchStepProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (preselectedInvoiceId) {
      loadInvoiceById(preselectedInvoiceId);
    }
  }, [preselectedInvoiceId]);

  const loadInvoiceById = async (invoiceId: string) => {
    setIsLoading(true);
    try {
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

      if (invoiceResult.error || !invoiceResult.data) {
        toast({ variant: 'destructive', title: 'Invoice not found' });
        return;
      }

      const inv = invoiceResult.data as Record<string, unknown>;
      const clients = inv.clients as { name: string; phone: string | null } | null;

      if (inv.status === 'cancelled') {
        toast({ variant: 'destructive', title: 'Cancelled invoice', description: 'Cancelled invoices cannot be returned or exchanged.' });
        return;
      }

      const invoiceData: InvoiceData = {
        id: inv.id as string,
        invoice_number: inv.invoice_number as string,
        client_name: clients?.name || 'Walk-in Customer',
        client_phone: clients?.phone || '',
      };

      // Quantities already returned/exchanged against this invoice
      const { data: prevRecs } = await supabase
        .from('return_exchanges')
        .select('id, return_exchange_items(product_id, product_name, quantity, direction)')
        .eq('original_invoice_id', invoiceId);
      const used: { product_id: string | null; product_name: string; quantity: number }[] = [];
      for (const r of (prevRecs || []) as unknown as Array<{ return_exchange_items: Array<{ product_id: string | null; product_name: string; quantity: number; direction: string }> }>) {
        for (const it of r.return_exchange_items || []) {
          if (it.direction === 'returned') used.push({ product_id: it.product_id, product_name: it.product_name, quantity: Number(it.quantity) || 0 });
        }
      }

      const rawItems = (itemsResult.data || []) as Array<Record<string, unknown>>;
      // Exact amount paid on the original invoice, split by each line's saved value
      // (keeps original GST, discounts and round-off — never today's rates).
      const grandTotal = Number(inv.grand_total) || 0;
      const sumSub = rawItems.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);

      const items: ReturnItemSelection[] = rawItems.map((item) => {
        const products = item.products as { sku: string } | null;
        const qty = Number(item.quantity) || 0;
        const paidValue = sumSub > 0
          ? Math.round(grandTotal * ((Number(item.subtotal) || 0) / sumSub) * 100) / 100
          : Number(item.total) || 0;
        let alreadyUsed = 0;
        for (const u of used) {
          if (u.quantity <= 0 || alreadyUsed >= qty) continue;
          const match = item.product_id ? u.product_id === item.product_id : u.product_name === item.product_name;
          if (!match) continue;
          const take = Math.min(u.quantity, qty - alreadyUsed);
          alreadyUsed += take;
          u.quantity -= take;
        }
        const remaining = Math.max(0, qty - alreadyUsed);
        return {
          invoice_item_id: item.id as string,
          product_id: (item.product_id as string) || null,
          product_name: item.product_name as string,
          sku: products?.sku || 'N/A',
          category: (item.category as string) || '',
          weight_grams: Number(item.weight_grams),
          quantity: qty,
          max_quantity: remaining,
          rate_per_gram: Number(item.rate_per_gram),
          making_charges: Number(item.making_charges),
          discount: Number(item.discount),
          line_total: Number(item.subtotal),
          gst_percentage: Number(item.gst_percentage),
          gst_amount: Number(item.gst_amount),
          total: paidValue,
          selected: false,
          return_quantity: remaining,
          reason: '',
        };
      });

      if (items.length > 0 && items.every((i) => i.max_quantity <= 0)) {
        toast({ variant: 'destructive', title: 'Nothing left to return', description: 'All items on this invoice have already been returned or exchanged.' });
        return;
      }

      onInvoiceLoaded(invoiceData, items);
    } catch (error) {
      console.error('Error loading invoice:', error);
      toast({ variant: 'destructive', title: 'Error loading invoice' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast({ variant: 'destructive', title: 'Please enter an invoice number' });
      return;
    }

    setIsLoading(true);
    try {
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('id')
        .ilike('invoice_number', `%${searchTerm.trim()}%`)
        .limit(1);

      if (error) throw error;

      if (!invoices || invoices.length === 0) {
        toast({ variant: 'destructive', title: 'Invoice not found', description: 'No invoice matches the search term.' });
        setIsLoading(false);
        return;
      }

      await loadInvoiceById(invoices[0].id);
    } catch (error) {
      console.error('Error searching invoice:', error);
      toast({ variant: 'destructive', title: 'Error searching invoice' });
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Invoice Number</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Enter invoice number (e.g. INV-000001)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
        <p>Search for the original invoice to begin a return or exchange.</p>
        <p className="mt-1">The system will load all items from the invoice for selection.</p>
      </div>
    </div>
  );
}
