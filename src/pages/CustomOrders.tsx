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
import { CustomOrder, CustomOrderItem, CustomOrderStatus, CUSTOM_ORDER_STATUS_LABELS } from '@/types/customOrder';
import { useActivityLogger } from '@/hooks/useActivityLog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

const CustomOrders = () => {
  const { customOrders, isLoading, updateStatus, deleteOrder, getOrderWithItems } = useCustomOrders();
  const { logActivity } = useActivityLogger();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<CustomOrder | null>(null);

  const filtered = useMemo(() => {
    return customOrders.filter((o) => {
      const matchesSearch = !searchQuery ||
        o.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.phone_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.reference_number.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [customOrders, searchQuery, statusFilter]);

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

  const handleConvertToInvoice = async (order: CustomOrder, items: CustomOrderItem[]) => {
    try {
      // Generate invoice number
      const { data: invoiceNumber, error: numError } = await supabase.rpc('generate_invoice_number');
      if (numError) throw numError;

      // Create invoice
      const { data: invoice, error: invError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invoiceNumber,
          invoice_date: new Date().toISOString().split('T')[0],
          status: 'draft',
          payment_status: 'pending',
          subtotal: order.total_amount,
          gst_amount: 0,
          discount_amount: 0,
          grand_total: order.total_amount,
          notes: `Converted from Custom Order ${order.reference_number}`,
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (invError) throw invError;

      // Create invoice items from custom order items
      if (items.length > 0) {
        const invoiceItems = items.map(item => ({
          invoice_id: invoice.id,
          product_name: item.item_description,
          quantity: item.quantity,
          weight_grams: item.expected_weight || 0,
          rate_per_gram: item.rate_per_gram || 0,
          gold_value: item.base_price || 0,
          making_charges: item.mc_amount || 0,
          discount: item.discount_on_mc || 0,
          discounted_making: item.mc_amount || 0,
          subtotal: item.item_total,
          gst_percentage: 0,
          gst_amount: 0,
          total: item.item_total,
          mrp: item.pricing_mode === 'flat_price' ? item.flat_price : 0,
          category: 'Custom Order',
        }));

        await supabase.from('invoice_items').insert(invoiceItems);
      }

      // Update custom order with invoice reference
      await supabase
        .from('custom_orders')
        .update({ converted_to_invoice_id: invoice.id })
        .eq('id', order.id);

      queryClient.invalidateQueries({ queryKey: ['custom-orders'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });

      logActivity({
        module: 'Custom Orders',
        action: 'Convert to Invoice',
        recordId: order.id,
        recordLabel: order.reference_number,
        newValue: { invoice_number: invoiceNumber },
      });

      toast({ title: 'Converted to invoice', description: `Invoice ${invoiceNumber} created successfully.` });
      setViewOpen(false);
      navigate('/invoices');
    } catch (error: any) {
      toast({ title: 'Conversion failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleNew = () => { setSelected(null); setFormOpen(true); };

  const pendingOrders = customOrders.filter(o => ['order_noted', 'design_approved', 'in_production'].includes(o.status)).length;
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
              />
            )}
          </CardContent>
        </Card>
      </div>

      <CustomOrderFormDialog open={formOpen} onOpenChange={setFormOpen} order={selected} />
      <ViewCustomOrderDialog open={viewOpen} onOpenChange={setViewOpen} order={selected} onConvertToInvoice={handleConvertToInvoice} />

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
