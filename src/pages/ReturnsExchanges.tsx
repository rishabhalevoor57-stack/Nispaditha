import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Eye, ArrowLeftRight } from 'lucide-react';
import { format } from 'date-fns';
import { useReturnsExchanges } from '@/hooks/useReturnsExchanges';
import { ReturnExchangeDialog } from '@/components/returns/ReturnExchangeDialog';
import { ViewReturnExchangeDialog } from '@/components/returns/ViewReturnExchangeDialog';
import type { ReturnExchange } from '@/types/returnExchange';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);

export default function ReturnsExchanges() {
  const {
    records,
    isLoading,
    typeFilter,
    setTypeFilter,
    searchTerm,
    setSearchTerm,
    counts,
    refresh,
  } = useReturnsExchanges();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [viewRecordId, setViewRecordId] = useState<string | null>(null);

  const filterButtons: { key: 'all' | 'return' | 'exchange'; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'return', label: 'Returns' },
    { key: 'exchange', label: 'Exchanges' },
  ];

  const columns = [
    { key: 'reference_number', header: 'Ref #' },
    {
      key: 'type',
      header: 'Type',
      cell: (item: ReturnExchange) => (
        <Badge variant={item.type === 'return' ? 'destructive' : 'default'}>
          {item.type === 'return' ? 'Return' : 'Exchange'}
        </Badge>
      ),
    },
    { key: 'original_invoice_number', header: 'Original Invoice' },
    {
      key: 'client_name',
      header: 'Client',
      cell: (item: ReturnExchange) => item.client_name || 'Walk-in',
    },
    {
      key: 'created_at',
      header: 'Date',
      cell: (item: ReturnExchange) => format(new Date(item.created_at), 'dd MMM yyyy'),
    },
    {
      key: 'amount',
      header: 'Amount',
      cell: (item: ReturnExchange) => {
        if (item.refund_amount > 0) {
          return <span className="text-destructive font-medium">-{formatCurrency(item.refund_amount)}</span>;
        }
        if (item.additional_charge > 0) {
          return <span className="text-primary font-medium">+{formatCurrency(item.additional_charge)}</span>;
        }
        return <span className="text-muted-foreground">₹0.00</span>;
      },
    },
    {
      key: 'payment_mode',
      header: 'Payment',
      cell: (item: ReturnExchange) => (
        <span className="capitalize">{item.payment_mode || '-'}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (item: ReturnExchange) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            setViewRecordId(item.id);
          }}
          title="View Details"
        >
          <Eye className="w-4 h-4" />
        </Button>
      ),
    },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Returns & Exchanges"
        description="Process returns and exchanges against existing invoices"
        actions={
          <Button className="btn-gold" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Return / Exchange
          </Button>
        }
      />

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {filterButtons.map((btn) => (
          <Button
            key={btn.key}
            variant={typeFilter === btn.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTypeFilter(btn.key)}
          >
            {btn.label}
            <span className="ml-1.5 text-xs opacity-70">({counts[btn.key]})</span>
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by reference, invoice number, or client..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 max-w-md"
        />
      </div>

      <DataTable
        data={records}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No returns or exchanges found."
      />

      <ReturnExchangeDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onComplete={refresh}
      />

      <ViewReturnExchangeDialog
        recordId={viewRecordId}
        open={!!viewRecordId}
        onOpenChange={(open) => !open && setViewRecordId(null)}
      />
    </AppLayout>
  );
}
