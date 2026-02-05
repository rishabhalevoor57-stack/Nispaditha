import { useState, useMemo } from 'react';
import { Plus, FileText, Download } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { OrderNoteFilters } from '@/components/order-notes/OrderNoteFilters';
import { OrderNoteTable } from '@/components/order-notes/OrderNoteTable';
import { OrderNoteFormDialog } from '@/components/order-notes/OrderNoteFormDialog';
import { ViewOrderNoteDialog } from '@/components/order-notes/ViewOrderNoteDialog';
import { useOrderNotes } from '@/hooks/useOrderNotes';
import { OrderNote, OrderNoteStatus } from '@/types/orderNote';
import { printOrderNote, downloadOrderNotePdf } from '@/utils/orderNotePdf';
import { Skeleton } from '@/components/ui/skeleton';

const OrderNotes = () => {
  const { orderNotes, isLoading, updateStatus, deleteOrderNote, getOrderNoteWithItems } = useOrderNotes();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<OrderNote | null>(null);

  const filteredNotes = useMemo(() => {
    return orderNotes.filter((note) => {
      const matchesSearch =
        !searchQuery ||
        note.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.phone_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.order_reference.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || note.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orderNotes, searchQuery, statusFilter]);

  const handleView = (note: OrderNote) => {
    setSelectedNote(note);
    setViewOpen(true);
  };

  const handleEdit = (note: OrderNote) => {
    setSelectedNote(note);
    setFormOpen(true);
  };

  const handleDelete = (note: OrderNote) => {
    setSelectedNote(note);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (selectedNote) {
      await deleteOrderNote.mutateAsync(selectedNote.id);
      setDeleteOpen(false);
      setSelectedNote(null);
    }
  };

  const handlePrint = async (note: OrderNote) => {
    const fullNote = await getOrderNoteWithItems(note.id);
    const handlerName = note.handler?.full_name || note.handler?.email || 'Not assigned';
    await printOrderNote(fullNote, fullNote.items || [], handlerName);
  };

  const handleStatusChange = (id: string, status: OrderNoteStatus) => {
    updateStatus.mutate({ id, status });
  };

  const handleNewOrder = () => {
    setSelectedNote(null);
    setFormOpen(true);
  };

  // Stats
  const pendingOrders = orderNotes.filter(n => ['order_noted', 'design_approved', 'in_production'].includes(n.status)).length;
  const readyOrders = orderNotes.filter(n => n.status === 'ready').length;
  const totalBalance = orderNotes.reduce((sum, n) => sum + (n.balance || 0), 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader 
          title="Order Notes" 
          description="Internal order tracking - does not affect inventory or accounting"
          actions={
            <Button onClick={handleNewOrder}>
              <Plus className="h-4 w-4 mr-2" />
              New Order Note
            </Button>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{orderNotes.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{pendingOrders}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ready for Pickup</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{readyOrders}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Balance Due</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{totalBalance.toLocaleString('en-IN')}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Order Notes
              </CardTitle>
              <OrderNoteFilters
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <OrderNoteTable
                orderNotes={filteredNotes}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onPrint={handlePrint}
                onStatusChange={handleStatusChange}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Form Dialog */}
      <OrderNoteFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        orderNote={selectedNote}
      />

      {/* View Dialog */}
      <ViewOrderNoteDialog
        open={viewOpen}
        onOpenChange={setViewOpen}
        orderNote={selectedNote}
        onPrint={handlePrint}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete order note "{selectedNote?.order_reference}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default OrderNotes;
