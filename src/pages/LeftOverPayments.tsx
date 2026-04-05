import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Search, IndianRupee } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { supabase } from '@/integrations/supabase/client';
import { ORDER_NOTE_STATUS_LABELS, ORDER_NOTE_STATUS_COLORS, OrderNoteStatus } from '@/types/orderNote';

interface PendingPayment {
  id: string;
  order_reference: string;
  customer_name: string;
  phone_number: string | null;
  quoted_estimate: number;
  advance_received: number;
  balance: number;
  order_date: string;
  expected_delivery_date: string | null;
  status: OrderNoteStatus;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);

export default function LeftOverPayments() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['pending-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_notes')
        .select('id, order_reference, customer_name, phone_number, quoted_estimate, advance_received, balance, order_date, expected_delivery_date, status')
        .gt('balance', 0)
        .order('order_date', { ascending: true });

      if (error) throw error;
      return (data || []) as PendingPayment[];
    },
  });

  const filtered = useMemo(() => {
    if (!searchTerm) return records;
    const q = searchTerm.toLowerCase();
    return records.filter(r =>
      r.customer_name.toLowerCase().includes(q) ||
      r.order_reference.toLowerCase().includes(q) ||
      r.phone_number?.toLowerCase().includes(q)
    );
  }, [records, searchTerm]);

  const totalPending = filtered.reduce((sum, r) => sum + (r.balance || 0), 0);
  const totalEstimate = filtered.reduce((sum, r) => sum + (r.quoted_estimate || 0), 0);
  const totalReceived = filtered.reduce((sum, r) => sum + (r.advance_received || 0), 0);

  const columns = [
    { key: 'order_reference', header: 'Ref #' },
    { key: 'customer_name', header: 'Customer' },
    {
      key: 'phone_number',
      header: 'Phone',
      cell: (item: PendingPayment) => item.phone_number || '-',
    },
    {
      key: 'order_date',
      header: 'Order Date',
      cell: (item: PendingPayment) => format(new Date(item.order_date), 'dd MMM yyyy'),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (item: PendingPayment) => (
        <Badge className={ORDER_NOTE_STATUS_COLORS[item.status]}>
          {ORDER_NOTE_STATUS_LABELS[item.status] || item.status}
        </Badge>
      ),
    },
    {
      key: 'quoted_estimate',
      header: 'Total Amount',
      cell: (item: PendingPayment) => formatCurrency(item.quoted_estimate || 0),
    },
    {
      key: 'advance_received',
      header: 'Paid',
      cell: (item: PendingPayment) => (
        <span className="text-primary font-medium">{formatCurrency(item.advance_received || 0)}</span>
      ),
    },
    {
      key: 'balance',
      header: 'Balance Due',
      cell: (item: PendingPayment) => (
        <span className="text-amber-600 font-semibold">{formatCurrency(item.balance || 0)}</span>
      ),
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Left Over Payments"
          description="Track pending balances from order notes — oldest first"
        />

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Orders with Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filtered.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Estimate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalEstimate)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Received</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{formatCurrency(totalReceived)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{formatCurrency(totalPending)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer name, reference, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 max-w-md"
          />
        </div>

        <DataTable
          data={filtered}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No pending payments found. All balances are cleared! 🎉"
        />
      </div>
    </AppLayout>
  );
}
