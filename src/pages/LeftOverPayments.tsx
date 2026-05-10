import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Search, Eye, IndianRupee } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { supabase } from '@/integrations/supabase/client';
import { RecordPaymentDialog } from '@/components/invoice/RecordPaymentDialog';
import { ViewInvoiceDialog } from '@/components/invoice/ViewInvoiceDialog';

interface PendingInvoiceRow {
  id: string;
  invoice_number: string;
  invoice_date: string;
  grand_total: number;
  advance_paid: number;
  payment_status: string;
  clients: { name: string | null; phone: string | null } | null;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

export default function LeftOverPayments() {
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentTarget, setPaymentTarget] = useState<PendingInvoiceRow | null>(null);
  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null);

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['pending-payments-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, invoice_date, grand_total, advance_paid, payment_status, clients(name, phone)')
        .in('payment_status', ['partial', 'pending'])
        .order('invoice_date', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as PendingInvoiceRow[];
    },
  });

  const filtered = useMemo(() => {
    if (!searchTerm) return rows;
    const q = searchTerm.toLowerCase();
    return rows.filter(r =>
      r.invoice_number.toLowerCase().includes(q) ||
      r.clients?.name?.toLowerCase().includes(q) ||
      r.clients?.phone?.toLowerCase().includes(q)
    );
  }, [rows, searchTerm]);

  const totalEstimate = filtered.reduce((s, r) => s + Number(r.grand_total || 0), 0);
  const totalReceived = filtered.reduce((s, r) => s + Number(r.advance_paid || 0), 0);
  const totalPending = filtered.reduce((s, r) => s + Math.max(0, Number(r.grand_total || 0) - Number(r.advance_paid || 0)), 0);

  const columns = [
    { key: 'invoice_number', header: 'Ref #' },
    {
      key: 'customer',
      header: 'Customer',
      cell: (r: PendingInvoiceRow) => r.clients?.name || 'Walk-in',
    },
    {
      key: 'phone',
      header: 'Phone',
      cell: (r: PendingInvoiceRow) => r.clients?.phone || '-',
    },
    {
      key: 'invoice_date',
      header: 'Order Date',
      cell: (r: PendingInvoiceRow) => format(new Date(r.invoice_date), 'dd MMM yyyy'),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r: PendingInvoiceRow) => (
        r.payment_status === 'partial' ? (
          <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 border">PARTIAL</Badge>
        ) : (
          <Badge className="bg-red-500/10 text-red-600 border-red-500/20 border">PENDING</Badge>
        )
      ),
    },
    {
      key: 'grand_total',
      header: 'Total Amount',
      cell: (r: PendingInvoiceRow) => formatCurrency(Number(r.grand_total)),
    },
    {
      key: 'advance_paid',
      header: 'Paid',
      cell: (r: PendingInvoiceRow) => (
        <span className="text-primary font-medium">{formatCurrency(Number(r.advance_paid))}</span>
      ),
    },
    {
      key: 'balance',
      header: 'Balance Due',
      cell: (r: PendingInvoiceRow) => (
        <span className="text-amber-600 font-semibold">
          {formatCurrency(Math.max(0, Number(r.grand_total) - Number(r.advance_paid)))}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (r: PendingInvoiceRow) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => setPaymentTarget(r)}>
            <IndianRupee className="w-4 h-4 mr-1" /> Record Payment
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setViewInvoiceId(r.id)} title="View Invoice">
            <Eye className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Pending Payments"
          description="All invoices with partial or pending balances — record payments here"
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Orders with Balance</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{filtered.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Estimate</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(totalEstimate)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Received</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-primary">{formatCurrency(totalReceived)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Pending</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-amber-600">{formatCurrency(totalPending)}</div></CardContent>
          </Card>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer name, phone, or invoice ref..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 max-w-md"
          />
        </div>

        <DataTable
          data={filtered}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No pending payments. All balances are cleared! 🎉"
        />
      </div>

      {paymentTarget && (
        <RecordPaymentDialog
          open={!!paymentTarget}
          onOpenChange={(open) => !open && setPaymentTarget(null)}
          invoiceId={paymentTarget.id}
          invoiceNumber={paymentTarget.invoice_number}
          grandTotal={Number(paymentTarget.grand_total) || 0}
          alreadyPaid={Number(paymentTarget.advance_paid) || 0}
          onRecorded={() => { setPaymentTarget(null); refetch(); }}
        />
      )}

      <ViewInvoiceDialog
        invoiceId={viewInvoiceId}
        open={!!viewInvoiceId}
        onOpenChange={(open) => !open && setViewInvoiceId(null)}
        onStatusChange={refetch}
      />
    </AppLayout>
  );
}
