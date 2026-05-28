import { useMemo, useState } from 'react';
import { Plus, Wrench } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useServiceForms } from '@/hooks/useServiceForms';
import { ServiceFormDialog } from '@/components/service-forms/ServiceFormDialog';
import { ServiceFormTable } from '@/components/service-forms/ServiceFormTable';
import { CompleteServiceDialog } from '@/components/service-forms/CompleteServiceDialog';
import { ServiceForm } from '@/types/serviceForm';
import { printServiceReceipt } from '@/utils/serviceReceiptPdf';

const ServiceForms = () => {
  const { serviceForms, isLoading, updateStatus, deleteServiceForm } = useServiceForms();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<ServiceForm | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return serviceForms;
    return serviceForms.filter(sf =>
      sf.receipt_number.toLowerCase().includes(q) ||
      sf.client_name.toLowerCase().includes(q) ||
      (sf.client_phone || '').toLowerCase().includes(q) ||
      sf.item_description.toLowerCase().includes(q)
    );
  }, [serviceForms, search]);

  const counts = {
    received: serviceForms.filter(s => s.status === 'received').length,
    in_progress: serviceForms.filter(s => s.status === 'in_progress').length,
    ready: serviceForms.filter(s => s.status === 'ready').length,
    completed: serviceForms.filter(s => s.status === 'completed').length,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Service Forms"
          description="Drop-off service receipts — polish, repair, resize, etc. Generates GST invoice on completion."
          actions={
            <Button onClick={() => { setSelected(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />New Service Form
            </Button>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Received</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-yellow-600">{counts.received}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">In Progress</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-blue-600">{counts.in_progress}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Ready</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{counts.ready}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Completed</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{counts.completed}</div></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" />Service Forms</CardTitle>
              <Input
                placeholder="Search by receipt, client, phone or item..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <ServiceFormTable
                serviceForms={filtered}
                onEdit={(sf) => { setSelected(sf); setFormOpen(true); }}
                onDelete={(sf) => { setSelected(sf); setDeleteOpen(true); }}
                onPrint={printServiceReceipt}
                onComplete={(sf) => { setSelected(sf); setCompleteOpen(true); }}
                onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <ServiceFormDialog open={formOpen} onOpenChange={setFormOpen} serviceForm={selected} />
      <CompleteServiceDialog open={completeOpen} onOpenChange={setCompleteOpen} serviceForm={selected} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete service form?</AlertDialogTitle>
            <AlertDialogDescription>This will delete {selected?.receipt_number}. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => selected && deleteServiceForm.mutate(selected.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default ServiceForms;
