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

      const invoiceData: InvoiceData = {
        id: inv.id as string,
        invoice_number: inv.invoice_number as string,
        client_name: clients?.name || 'Walk-in Customer',
        client_phone: clients?.phone || '',
      };

      const items: ReturnItemSelection[] = (itemsResult.data || []).map(
        (item: Record<string, unknown>) => {
          const products = item.products as { sku: string } | null;
          return {
            invoice_item_id: item.id as string,
            product_id: (item.product_id as string) || null,
            product_name: item.product_name as string,
            sku: products?.sku || 'N/A',
            category: (item.category as string) || '',
            weight_grams: Number(item.weight_grams),
            quantity: Number(item.quantity),
            max_quantity: Number(item.quantity),
            rate_per_gram: Number(item.rate_per_gram),
            making_charges: Number(item.making_charges),
            discount: Number(item.discount),
            line_total: Number(item.subtotal),
            gst_percentage: Number(item.gst_percentage),
            gst_amount: Number(item.gst_amount),
            total: Number(item.total),
            selected: false,
            return_quantity: Number(item.quantity),
            reason: '',
          };
        }
      );

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
