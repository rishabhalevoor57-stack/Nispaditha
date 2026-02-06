import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Edit, Trash2, Phone, Mail, Download } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  outstanding_balance: number;
  total_purchases: number;
  last_invoice_date: string | null;
  comments: string | null;
  created_at: string;
}

const initialClient = {
  name: '',
  phone: '',
  email: '',
  address: '',
  outstanding_balance: '',
  comments: '',
};

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState(initialClient);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const dataToSubmit = {
        name: formData.name,
        phone: formData.phone || null,
        email: formData.email || null,
        address: formData.address || null,
        outstanding_balance: parseFloat(formData.outstanding_balance) || 0,
        comments: formData.comments || null,
      };

      if (editingClient) {
        const { error } = await supabase
          .from('clients')
          .update(dataToSubmit)
          .eq('id', editingClient.id);
        
        if (error) throw error;
        toast({ title: 'Client updated successfully' });
      } else {
        const { error } = await supabase
          .from('clients')
          .insert([dataToSubmit]);
        
        if (error) throw error;
        toast({ title: 'Client added successfully' });
      }

      setIsDialogOpen(false);
      setEditingClient(null);
      setFormData(initialClient);
      fetchClients();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: message });
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      phone: client.phone || '',
      email: client.email || '',
      address: client.address || '',
      outstanding_balance: client.outstanding_balance.toString(),
      comments: client.comments || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client?')) return;

    try {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Client deleted' });
      fetchClients();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: message });
    }
  };

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.phone?.includes(searchTerm) ||
    client.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const downloadClientsCSV = () => {
    const headers = ['Name', 'Phone', 'Email', 'Address', 'Total Purchases', 'Last Invoice', 'Outstanding Balance', 'Comments'];
    const rows = filteredClients.map(client => [
      client.name,
      client.phone || '',
      client.email || '',
      client.address?.replace(/,/g, ';') || '',
      client.total_purchases.toString(),
      client.last_invoice_date ? new Date(client.last_invoice_date).toLocaleDateString('en-IN') : '',
      client.outstanding_balance.toString(),
      client.comments?.replace(/,/g, ';') || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `clients_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    
    toast({ title: 'Clients exported successfully' });
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const columns = [
    { key: 'name', header: 'Name' },
    { 
      key: 'phone', 
      header: 'Phone',
      cell: (item: Client) => item.phone ? (
        <div className="flex items-center gap-2">
          <Phone className="w-3 h-3 text-muted-foreground" />
          {item.phone}
        </div>
      ) : '-'
    },
    { 
      key: 'total_purchases', 
      header: 'Total Purchases',
      cell: (item: Client) => (
        <span className="font-medium text-primary">
          {formatCurrency(item.total_purchases)}
        </span>
      )
    },
    { 
      key: 'last_invoice_date', 
      header: 'Last Invoice',
      cell: (item: Client) => (
        <span className="text-muted-foreground text-sm">
          {formatDate(item.last_invoice_date)}
        </span>
      )
    },
    { 
      key: 'outstanding_balance', 
      header: 'Outstanding',
      cell: (item: Client) => (
        <span className={item.outstanding_balance > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}>
          {formatCurrency(item.outstanding_balance)}
        </span>
      )
    },
    { 
      key: 'comments', 
      header: 'Comments',
      cell: (item: Client) => (
        <span className="truncate max-w-[150px] block text-muted-foreground">
          {item.comments || '-'}
        </span>
      )
    },
    { 
      key: 'actions', 
      header: 'Actions',
      cell: (item: Client) => (
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={(e) => { e.stopPropagation(); handleEdit(item); }}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
            className="text-destructive hover:text-destructive"
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
        title="Clients" 
        description="Manage your customer database"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadClientsCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setEditingClient(null);
                setFormData(initialClient);
              }
            }}>
              <DialogTrigger asChild>
                <Button className="btn-gold">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Client
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingClient ? 'Edit Client' : 'Add New Client'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="outstanding_balance">Outstanding Balance (₹)</Label>
                  <Input
                    id="outstanding_balance"
                    type="number"
                    value={formData.outstanding_balance}
                    onChange={(e) => setFormData({ ...formData, outstanding_balance: e.target.value })}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comments">Comments</Label>
                  <Textarea
                    id="comments"
                    value={formData.comments}
                    onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                    placeholder="Add notes about this client..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="btn-gold">
                    {editingClient ? 'Update Client' : 'Add Client'}
                  </Button>
                </div>
              </form>
            </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 max-w-md"
        />
      </div>

      <DataTable
        data={filteredClients}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No clients found. Add your first client to get started."
      />
    </AppLayout>
  );
}
