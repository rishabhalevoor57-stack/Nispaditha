import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Edit, Trash2, Phone, Eye, Download } from 'lucide-react';
import { useVendors } from '@/hooks/useVendors';
import type { Vendor, VendorFormData } from '@/hooks/useVendors';
import { VendorFormDialog } from '@/components/vendors/VendorFormDialog';
import { VendorProfileDialog } from '@/components/vendors/VendorProfileDialog';
import { VendorPaymentDialog } from '@/components/vendors/VendorPaymentDialog';
import { useToast } from '@/hooks/use-toast';

export default function Vendors() {
  const {
    vendors,
    isLoading,
    searchTerm,
    setSearchTerm,
    createVendor,
    updateVendor,
    deleteVendor,
    fetchVendorPayments,
    addVendorPayment,
    fetchVendorProducts,
  } = useVendors();
  const { toast } = useToast();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  const handleCreate = () => {
    setSelectedVendor(null);
    setIsFormOpen(true);
  };

  const handleView = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsProfileOpen(true);
  };

  const handleEdit = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsProfileOpen(false);
    setIsFormOpen(true);
  };

  const handleDelete = async (vendor: Vendor) => {
    if (!confirm(`Are you sure you want to delete "${vendor.name}"?`)) return;
    await deleteVendor(vendor.id);
    setIsProfileOpen(false);
  };

  const handleFormSubmit = async (data: VendorFormData) => {
    if (selectedVendor) {
      return await updateVendor(selectedVendor.id, data);
    }
    return await createVendor(data);
  };

  const handleAddPayment = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsProfileOpen(false);
    setIsPaymentOpen(true);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const downloadCSV = () => {
    const headers = ['Name', 'Contact Person', 'Phone', 'Email', 'GST Number', 'Total Purchases', 'Total Paid', 'Outstanding', 'Last Purchase'];
    const rows = vendors.map((v) => [
      v.name,
      v.contact_person || '',
      v.phone || '',
      v.email || '',
      v.gst_number || '',
      v.total_purchases.toString(),
      v.total_paid.toString(),
      v.outstanding_balance.toString(),
      v.last_purchase_date ? new Date(v.last_purchase_date).toLocaleDateString('en-IN') : '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `vendors_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast({ title: 'Vendors exported successfully' });
  };

  const columns = [
    { key: 'name', header: 'Vendor Name' },
    {
      key: 'phone',
      header: 'Phone',
      cell: (v: Vendor) =>
        v.phone ? (
          <div className="flex items-center gap-2">
            <Phone className="w-3 h-3 text-muted-foreground" />
            {v.phone}
          </div>
        ) : (
          '-'
        ),
    },
    {
      key: 'email',
      header: 'Email',
      cell: (v: Vendor) => <span className="text-muted-foreground">{v.email || '-'}</span>,
    },
    {
      key: 'outstanding_balance',
      header: 'Outstanding',
      cell: (v: Vendor) => (
        <span className={v.outstanding_balance > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}>
          {formatCurrency(v.outstanding_balance)}
        </span>
      ),
    },
    {
      key: 'last_purchase_date',
      header: 'Last Purchase',
      cell: (v: Vendor) => (
        <span className="text-muted-foreground text-sm">{formatDate(v.last_purchase_date)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (v: Vendor) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleView(v); }}>
            <Eye className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(v); }}>
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); handleDelete(v); }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Vendors"
        description="Manage your suppliers and track payments"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button className="btn-gold" onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Add Vendor
            </Button>
          </div>
        }
      />

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, or contact person..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 max-w-md"
        />
      </div>

      <DataTable
        data={vendors}
        columns={columns}
        isLoading={isLoading}
        onRowClick={handleView}
        emptyMessage="No vendors found. Add your first vendor to get started."
      />

      <VendorFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        vendor={selectedVendor}
        onSubmit={handleFormSubmit}
      />

      <VendorProfileDialog
        open={isProfileOpen}
        onOpenChange={setIsProfileOpen}
        vendor={selectedVendor}
        onEdit={() => handleEdit(selectedVendor!)}
        onDelete={() => handleDelete(selectedVendor!)}
        onAddPayment={() => handleAddPayment(selectedVendor!)}
        fetchProducts={fetchVendorProducts}
        fetchPayments={fetchVendorPayments}
      />

      <VendorPaymentDialog
        open={isPaymentOpen}
        onOpenChange={setIsPaymentOpen}
        vendor={selectedVendor}
        onSubmit={addVendorPayment}
      />
    </AppLayout>
  );
}
