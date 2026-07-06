import { useState, useMemo } from 'react';
import { Plus, Hammer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CustomOrderTable } from '@/components/custom-orders/CustomOrderTable';
import { CustomOrderFormDialog } from '@/components/custom-orders/CustomOrderFormDialog';
import { ViewCustomOrderDialog } from '@/components/custom-orders/ViewCustomOrderDialog';
import { useCustomOrders } from '@/hooks/useCustomOrders';
import { CustomOrder, CustomOrderItem, CustomOrderComponent, CustomOrderStatus, CUSTOM_ORDER_STATUS_LABELS } from '@/types/customOrder';
import { useActivityLogger } from '@/hooks/useActivityLog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { useQueryClient } from '@tanstack/react-query';
import { convertCustomOrderToInvoice } from '@/utils/customOrderToInvoice';
import { supabase } from '@/integrations/supabase/client';

const CustomOrders = () => {
  const { customOrders, isLoading, updateStatus, deleteOrder, getOrderWithItems } = useCustomOrders();
  const { logActivity } = useActivityLogger();
  const { user } = useAuth();
  const { currentBranch, defaultBranch } = useBranch();
  const isMainBranch = !!currentBranch && !!defaultBranch && currentBranch.id === defaultBranch.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'customer' | 'in_house'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<CustomOrder | null>(null);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return customOrders.filter((o) => {
      const matchesSearch = !q ||
        o.client_name.toLowerCase().includes(q) ||
        o.phone_number?.toLowerCase().includes(q) ||
        o.reference_number.toLowerCase().includes(q) ||
        o.product_sku?.toLowerCase().includes(q) ||
        o.product_title?.toLowerCase().includes(q) ||
        o.product_description?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
      const matchesType = typeFilter === 'all' || (o.order_type || 'customer') === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [customOrders, searchQuery, statusFilter, typeFilter]);

  const handleView = (order: CustomOrder) => { setSelected(order); setViewOpen(true); };
  const handleEdit = (order: CustomOrder) => { setSelected(order); setFormOpen(true); };
  const handleDelete = (order: CustomOrder) => { setSelected(order); setDeleteOpen(true); };

  const confirmDelete = async () => {
    if (selected) {
      await deleteOrder.mutateAsync(selected.id);
      logActivity({
        module: 'Custom Orders',
        action: 'Delete',
        recordId: selected.id,
        recordLabel: selected.reference_number,
        oldValue: { client: selected.client_name, total: selected.total_amount },
      });
      setDeleteOpen(false);
      setSelected(null);
    }
  };

  const handleStatusChange = (id: string, status: CustomOrderStatus) => {
    updateStatus.mutate({ id, status });
    logActivity({
      module: 'Custom Orders',
      action: 'Status Change',
      recordId: id,
      recordLabel: customOrders.find(o => o.id === id)?.reference_number,
      newValue: { status },
    });
  };

  const handleConvertToInvoice = async (order: CustomOrder, items: CustomOrderItem[], components: CustomOrderComponent[]) => {
    try {
      const result = await convertCustomOrderToInvoice(order, items, components, {
        finalize: false,
        createdBy: user?.id || null,
      });
      queryClient.invalidateQueries({ queryKey: ['custom-orders'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      logActivity({
        module: 'Custom Orders',
        action: 'Convert to Invoice',
        recordId: order.id,
        recordLabel: order.reference_number,
        newValue: { invoice_number: result.invoiceNumber },
      });
      toast({ title: 'Invoice created', description: `Draft invoice ${result.invoiceNumber} ready for review.` });
      setViewOpen(false);
      navigate('/invoices');
    } catch (error: any) {
      toast({ title: 'Conversion failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleSendToInvoicePage = async (order: CustomOrder, items: CustomOrderItem[], components: CustomOrderComponent[]) => {
    try {
      const result = await convertCustomOrderToInvoice(order, items, components, {
        finalize: false,
        createdBy: user?.id || null,
      });
      queryClient.invalidateQueries({ queryKey: ['custom-orders'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setViewOpen(false);
      toast({ title: 'Sent to Invoice Page', description: `Opening draft ${result.invoiceNumber} for editing.` });
      navigate('/invoices', { state: { editDraftId: result.invoiceId } });
    } catch (error: any) {
      toast({ title: 'Send failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleBillNow = async (order: CustomOrder, items: CustomOrderItem[], components: CustomOrderComponent[]) => {
    try {
      const result = await convertCustomOrderToInvoice(order, items, components, {
        finalize: true,
        createdBy: user?.id || null,
      });
      queryClient.invalidateQueries({ queryKey: ['custom-orders'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      logActivity({
        module: 'Custom Orders',
        action: 'Bill Now',
        recordId: order.id,
        recordLabel: order.reference_number,
        newValue: { invoice_number: result.invoiceNumber },
      });
      toast({ title: 'Invoice billed', description: `Invoice ${result.invoiceNumber} created — collect payment from Invoices.` });
      setViewOpen(false);
    } catch (error: any) {
      toast({ title: 'Bill failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleNew = () => { setSelected(null); setFormOpen(true); };

  const handleSendToInventory = async (order: CustomOrder) => {
    if (!isMainBranch) {
      toast({ variant: 'destructive', title: 'Main Branch only', description: 'In-house orders can only be stocked from the Main Branch.' });
      return;
    }
    try {
      const { data, error } = await supabase.rpc('send_custom_order_to_inventory' as any, {
        p_custom_order_id: order.id,
        p_final_quantity: 1,
      });
      if (error) throw error;
      logActivity({
        module: 'Custom Orders',
        action: 'Send to Inventory',
        recordId: order.id,
        recordLabel: order.reference_number,
        newValue: { inventory_product_id: data },
      });
      queryClient.invalidateQueries({ queryKey: ['custom-orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Sent to Inventory', description: `${order.product_title || order.reference_number} is now a list-price product.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed', description: e.message });
    }
  };

  const pendingOrders = customOrders.filter(o => ['draft', 'confirmed', 'in_production'].includes(o.status)).length;
  const readyOrders = customOrders.filter(o => o.status === 'ready').length;
  const totalValue = customOrders.reduce((sum, o) => sum + o.total_amount, 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Custom Orders (Job Work)"
          description="Track client-specific jewellery requirements — does not affect inventory until converted to invoice"
          actions={
            <Button onClick={handleNew}>
              <Plus className="h-4 w-4 mr-2" />
              New Custom Order
            </Button>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{customOrders.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-warning">{pendingOrders}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Ready</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-primary">{readyOrders}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Value</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">₹{totalValue.toLocaleString('en-IN')}</div></CardContent>
          </Card>
        </div>

        {/* Filters & Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Hammer className="h-5 w-5" />
                Custom Orders
              </CardTitle>
              <div className="flex flex-col md:flex-row gap-3">
                <Input
                  placeholder="Search by name, phone, reference..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="md:w-[250px]"
                />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="md:w-[160px]">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {(Object.keys(CUSTOM_ORDER_STATUS_LABELS) as CustomOrderStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{CUSTOM_ORDER_STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <CustomOrderTable
                orders={filtered}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
                onSendToInventory={handleSendToInventory}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <CustomOrderFormDialog open={formOpen} onOpenChange={setFormOpen} order={selected} />
      <ViewCustomOrderDialog open={viewOpen} onOpenChange={setViewOpen} order={selected} onConvertToInvoice={handleConvertToInvoice} onSendToInvoicePage={handleSendToInvoicePage} onBillNow={handleBillNow} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Custom Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selected?.reference_number}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default CustomOrders;
