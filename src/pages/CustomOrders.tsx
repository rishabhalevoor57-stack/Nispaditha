import { useState, useMemo } from 'react';
import { Plus, Hammer, Download } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { exportRowsExcel, exportRowsPDF, type ExportColumn } from '@/utils/tableExport';

const customOrderExportColumns: ExportColumn[] = [
  { header: 'Reference', key: 'reference_number' },
  { header: 'Type', key: 'order_type', format: (o) => o.order_type === 'in_house' ? 'In-House' : 'Customer' },
  { header: 'Client', key: 'client_name' },
  { header: 'Phone', key: 'phone_number', format: (o) => o.phone_number || '' },
  { header: 'Product', key: 'product_title', format: (o) => o.product_title || '' },
  { header: 'SKU', key: 'product_sku', format: (o) => o.product_sku || '' },
  { header: 'Status', key: 'status' },
  { header: 'Total', key: 'total_amount' },
  { header: 'Created', key: 'created_at', format: (o) => o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN') : '' },
];

import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
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
  const handleEdit = (order: CustomOrder) => {
    if (order.status === 'cancelled') {
      toast({ variant: 'destructive', title: 'Cancelled', description: 'This order is cancelled and is read-only.' });
      return;
    }
    setSelected(order); setFormOpen(true);
  };
  const handleDelete = (order: CustomOrder) => { setSelected(order); setDeleteOpen(true); };
  const handleCancel = (order: CustomOrder) => { setSelected(order); setCancelReason(''); setCancelOpen(true); };

  const confirmCancel = async () => {
    if (!selected) return;
    const reasonNote = cancelReason.trim()
      ? `[CANCELLED: ${cancelReason.trim()}]`
      : '[CANCELLED]';
    const newNotes = [selected.notes || '', reasonNote].filter(Boolean).join('\n');
    const { error } = await supabase
      .from('custom_orders')
      .update({ status: 'cancelled', notes: newNotes } as any)
      .eq('id', selected.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Cancel failed', description: error.message });
      return;
    }
    // Unlock any locked SKUs
    await (supabase.from('products').update({ locked_by_custom_order_id: null } as any).eq('locked_by_custom_order_id', selected.id) as any);
    logActivity({
      module: 'Custom Orders',
      action: 'Cancel',
      recordId: selected.id,
      recordLabel: selected.reference_number,
      newValue: { reason: cancelReason.trim() || null },
    });
    queryClient.invalidateQueries({ queryKey: ['custom-orders'] });
    toast({ title: 'Order cancelled', description: `${selected.reference_number} has been cancelled. Reference is permanently reserved.` });
    setCancelOpen(false);
    setSelected(null);
  };


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

  const handleGenerateInvoice = async (order: CustomOrder, items: CustomOrderItem[], components: CustomOrderComponent[]) => {
    if (order.converted_to_invoice_id) {
      toast({ title: 'Already invoiced', description: 'This order already has a GST invoice.', variant: 'destructive' });
      return;
    }
    try {
      const result = await convertCustomOrderToInvoice(order, items, components, {
        finalize: true,
        createdBy: user?.id || null,
      });
      // Mark the custom order as Invoiced
      await supabase.from('custom_orders').update({ status: 'invoiced' } as any).eq('id', order.id);
      queryClient.invalidateQueries({ queryKey: ['custom-orders'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      logActivity({
        module: 'Custom Orders',
        action: 'Generate GST Invoice',
        recordId: order.id,
        recordLabel: order.reference_number,
        newValue: { invoice_number: result.invoiceNumber },
      });
      toast({ title: 'GST Invoice created', description: `Invoice ${result.invoiceNumber} generated.` });
      setViewOpen(false);
      navigate('/invoices', { state: { editDraftId: result.invoiceId } });
    } catch (error: any) {
      toast({ title: 'Invoice generation failed', description: error.message, variant: 'destructive' });
    }
  };



  const handleNew = () => { setSelected(null); setFormOpen(true); };

  const handleSendToInventory = async (order: CustomOrder) => {
    if (!isMainBranch) {
      toast({ variant: 'destructive', title: 'Main Branch only', description: 'In-house orders can only be stocked from the Main Branch.' });
      return;
    }
    try {
      const { data, error } = await supabase.rpc('send_custom_order_to_inventory_v2' as any, {
        p_custom_order_id: order.id,
        p_final_quantity: 1,
        p_total_weight: null,
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
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportRowsExcel(filtered, customOrderExportColumns, `custom_orders_${new Date().toISOString().split('T')[0]}`, 'Custom Orders')}>
                    Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportRowsPDF(filtered, customOrderExportColumns, 'Custom Orders', `custom_orders_${new Date().toISOString().split('T')[0]}`)}>
                    PDF (.pdf)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={handleNew}>
                <Plus className="h-4 w-4 mr-2" />
                New Custom Order
              </Button>
            </div>
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
                  placeholder="Search SKU, product, vendor, name, phone, ref..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="md:w-[280px]"
                />
                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
                  <SelectTrigger className="md:w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Orders</SelectItem>
                    <SelectItem value="customer">Customer Orders</SelectItem>
                    <SelectItem value="in_house">In-House Orders</SelectItem>
                  </SelectContent>
                </Select>
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
                onCancel={handleCancel}
                onStatusChange={handleStatusChange}
                onSendToInventory={handleSendToInventory}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <CustomOrderFormDialog open={formOpen} onOpenChange={setFormOpen} order={selected} />
      <ViewCustomOrderDialog open={viewOpen} onOpenChange={setViewOpen} order={selected} onGenerateInvoice={handleGenerateInvoice} />

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

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Order {selected?.reference_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This order will be cancelled and cannot be restored. The reference number stays permanently reserved and will never be reused.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Reason (optional)</Label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Why is this order being cancelled?"
              className="min-h-[70px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Order</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} className="bg-orange-600 hover:bg-orange-700 text-white">
              Cancel Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default CustomOrders;

