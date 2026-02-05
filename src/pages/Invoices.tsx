import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Eye, Trash2, Download, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { CreateInvoiceDialog } from '@/components/invoice/CreateInvoiceDialog';
import { ViewInvoiceDialog } from '@/components/invoice/ViewInvoiceDialog';
import { InvoiceFilters, type InvoiceStatusFilter } from '@/components/invoice/InvoiceFilters';
import { InvoiceStatusBadge, InvoiceStatusActions } from '@/components/invoice/InvoiceStatusActions';
import { downloadInvoicePdf } from '@/utils/invoicePdf';
import type { Invoice, BusinessSettings, InvoiceItem, InvoiceTotals, InvoiceStatus } from '@/types/invoice';

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchInvoices();
    fetchBusinessSettings();
  }, []);

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, clients(name, phone)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Map the data to ensure status has a default value
      const mappedData = (data || []).map((inv: Record<string, unknown>) => ({
        ...inv,
        status: (inv.status as InvoiceStatus) || 'draft',
        sent_at: inv.sent_at as string | null,
        paid_at: inv.paid_at as string | null,
      })) as Invoice[];
      
      setInvoices(mappedData);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setIsLoading(false);
    }
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

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;

    try {
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Invoice deleted' });
      fetchInvoices();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: message });
    }
  };

  const handleQuickDownload = async (invoice: Invoice) => {
    if (!businessSettings) {
      toast({ variant: 'destructive', title: 'Error', description: 'Business settings not loaded' });
      return;
    }

    const { data: itemsData } = await supabase
      .from('invoice_items')
      .select('*, products(sku)')
      .eq('invoice_id', invoice.id);

    if (!itemsData) return;

    const invoiceItems: InvoiceItem[] = itemsData.map((item: {
      products: { sku: string } | null;
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
    }) => ({
      product_id: '',
      sku: item.products?.sku || 'N/A',
      product_name: item.product_name,
      category: item.category || '',
      weight_grams: Number(item.weight_grams),
      quantity: item.quantity,
      rate_per_gram: Number(item.rate_per_gram),
      base_price: Number(item.gold_value),
      making_charges: Number(item.making_charges),
      discount: Number(item.discount),
      discounted_making: Number(item.discounted_making),
      line_total: Number(item.subtotal),
      gst_percentage: Number(item.gst_percentage),
    }));

    const totals: InvoiceTotals = {
      subtotal: Number(invoice.subtotal),
      discountAmount: Number(invoice.discount_amount),
      gstAmount: Number(invoice.gst_amount),
      grandTotal: Number(invoice.grand_total),
    };

    downloadInvoicePdf({
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      clientName: invoice.clients?.name || 'Walk-in Customer',
      clientPhone: invoice.clients?.phone || '',
      paymentMode: invoice.payment_mode || 'cash',
      items: invoiceItems,
      totals,
      businessSettings,
      notes: invoice.notes || undefined,
    }, true);
  };

  // Calculate counts for each status
  const statusCounts = {
    all: invoices.length,
    draft: invoices.filter(inv => inv.status === 'draft').length,
    sent: invoices.filter(inv => inv.status === 'sent').length,
    paid: invoices.filter(inv => inv.status === 'paid').length,
  };

  // Filter invoices by search term and status
  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch = 
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.clients?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const columns = [
    { key: 'invoice_number', header: 'Invoice #' },
    { 
      key: 'client', 
      header: 'Client',
      cell: (item: Invoice) => (
        <div>
          <p>{item.clients?.name || 'Walk-in'}</p>
          {item.clients?.phone && (
            <p className="text-xs text-muted-foreground">{item.clients.phone}</p>
          )}
        </div>
      )
    },
    { 
      key: 'invoice_date', 
      header: 'Date',
      cell: (item: Invoice) => format(new Date(item.invoice_date), 'dd MMM yyyy')
    },
    { 
      key: 'grand_total', 
      header: 'Amount',
      cell: (item: Invoice) => (
        <span className="font-medium">{formatCurrency(Number(item.grand_total))}</span>
      )
    },
    { 
      key: 'status', 
      header: 'Status',
      cell: (item: Invoice) => (
        <div className="flex items-center gap-2">
          <InvoiceStatusBadge status={item.status} />
        </div>
      )
    },
    { 
      key: 'status_actions', 
      header: 'Update Status',
      cell: (item: Invoice) => (
        <InvoiceStatusActions
          invoiceId={item.id}
          currentStatus={item.status}
          onStatusChange={fetchInvoices}
        />
      )
    },
    { 
      key: 'payment_mode', 
      header: 'Payment',
      cell: (item: Invoice) => (
        <span className="capitalize">{item.payment_mode || '-'}</span>
      )
    },
    { 
      key: 'actions', 
      header: 'Actions',
      cell: (item: Invoice) => (
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={(e) => { e.stopPropagation(); setViewInvoiceId(item.id); }}
            title="View Invoice"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={(e) => { e.stopPropagation(); handleQuickDownload(item); }}
            title="Download PDF"
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
            className="text-destructive hover:text-destructive"
            title="Delete Invoice"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )
    },
  ];

  return (
    <AppLayout>
      <PageHeader 
        title="Invoices" 
        description="Create and manage GST invoices for jewellery sales"
        actions={
          <Button className="btn-gold" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Invoice
          </Button>
        }
      />

      {/* Filters */}
      <InvoiceFilters
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        counts={statusCounts}
      />

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by invoice number or client..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 max-w-md"
        />
      </div>

      <DataTable
        data={filteredInvoices}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No invoices found. Create your first invoice to get started."
      />

      <CreateInvoiceDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onInvoiceCreated={() => {
          fetchInvoices();
        }}
      />

      <ViewInvoiceDialog
        invoiceId={viewInvoiceId}
        open={!!viewInvoiceId}
        onOpenChange={(open) => !open && setViewInvoiceId(null)}
        onStatusChange={fetchInvoices}
      />
    </AppLayout>
  );
}
