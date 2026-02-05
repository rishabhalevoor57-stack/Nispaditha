import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Search, Eye, Trash2, Download, X, Calculator } from 'lucide-react';
import { format } from 'date-fns';

interface Product {
  id: string;
  sku: string;
  name: string;
  weight_grams: number;
  quantity: number;
  selling_price: number;
  making_charges: number;
  gst_percentage: number;
  categories?: { name: string } | null;
}

interface Client {
  id: string;
  name: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  subtotal: number;
  discount_amount: number;
  gst_amount: number;
  grand_total: number;
  payment_status: string;
  payment_mode: string | null;
  notes: string | null;
  created_at: string;
  clients?: { name: string } | null;
}

interface InvoiceItem {
  product_id: string;
  product_name: string;
  category: string;
  weight_grams: number;
  quantity: number;
  rate_per_gram: number;
  gold_value: number;
  making_charges: number;
  discount: number;
  discounted_making: number;
  subtotal: number;
  gst_percentage: number;
  gst_amount: number;
  total: number;
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  // Invoice form state
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchInvoices();
    fetchProducts();
    fetchClients();
  }, []);

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, clients(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*, categories(name)')
      .gt('quantity', 0)
      .order('name');
    setProducts(data || []);
  };

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, name').order('name');
    setClients(data || []);
  };

  const addProductToInvoice = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    // Calculate values based on jewellery billing logic
    const ratePerGram = product.selling_price / product.weight_grams;
    const goldValue = product.weight_grams * ratePerGram;
    const makingCharges = product.making_charges;
    const discount = 0; // Can be adjusted by user
    const discountedMaking = makingCharges - discount;
    const subtotal = goldValue + discountedMaking;
    const gstAmount = subtotal * (product.gst_percentage / 100);
    const total = subtotal + gstAmount;

    const newItem: InvoiceItem = {
      product_id: product.id,
      product_name: product.name,
      category: product.categories?.name || '',
      weight_grams: product.weight_grams,
      quantity: 1,
      rate_per_gram: ratePerGram,
      gold_value: goldValue,
      making_charges: makingCharges,
      discount: discount,
      discounted_making: discountedMaking,
      subtotal: subtotal,
      gst_percentage: product.gst_percentage,
      gst_amount: gstAmount,
      total: total,
    };

    setInvoiceItems([...invoiceItems, newItem]);
  };

  const updateItemDiscount = (index: number, discount: number) => {
    const items = [...invoiceItems];
    const item = items[index];
    
    item.discount = discount;
    item.discounted_making = item.making_charges - discount;
    item.subtotal = item.gold_value + item.discounted_making;
    item.gst_amount = item.subtotal * (item.gst_percentage / 100);
    item.total = item.subtotal + item.gst_amount;
    
    setInvoiceItems(items);
  };

  const removeItem = (index: number) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const subtotal = invoiceItems.reduce((sum, item) => sum + item.subtotal, 0);
    const discountAmount = invoiceItems.reduce((sum, item) => sum + item.discount, 0);
    const gstAmount = invoiceItems.reduce((sum, item) => sum + item.gst_amount, 0);
    const grandTotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);

    return { subtotal, discountAmount, gstAmount, grandTotal };
  };

  const handleCreateInvoice = async () => {
    if (invoiceItems.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please add at least one product' });
      return;
    }

    try {
      // Generate invoice number
      const { data: invoiceNum } = await supabase.rpc('generate_invoice_number');
      
      const totals = calculateTotals();

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
          invoice_number: invoiceNum,
          client_id: selectedClient || null,
          subtotal: totals.subtotal,
          discount_amount: totals.discountAmount,
          gst_amount: totals.gstAmount,
          grand_total: totals.grandTotal,
          payment_status: 'paid',
          payment_mode: paymentMode,
          notes: notes || null,
          created_by: user?.id,
        }])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice items
      const itemsToInsert = invoiceItems.map(item => ({
        invoice_id: invoice.id,
        product_id: item.product_id,
        product_name: item.product_name,
        category: item.category,
        weight_grams: item.weight_grams,
        quantity: item.quantity,
        rate_per_gram: item.rate_per_gram,
        gold_value: item.gold_value,
        making_charges: item.making_charges,
        discount: item.discount,
        discounted_making: item.discounted_making,
        subtotal: item.subtotal,
        gst_percentage: item.gst_percentage,
        gst_amount: item.gst_amount,
        total: item.total,
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast({ title: 'Invoice created successfully!' });
      setIsDialogOpen(false);
      resetForm();
      fetchInvoices();
      fetchProducts(); // Refresh product quantities
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: message });
    }
  };

  const resetForm = () => {
    setSelectedClient('');
    setInvoiceItems([]);
    setPaymentMode('cash');
    setNotes('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;

    try {
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Invoice deleted' });
      fetchInvoices();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: message });
    }
  };

  const filteredInvoices = invoices.filter((invoice) =>
    invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.clients?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const totals = calculateTotals();

  const columns = [
    { key: 'invoice_number', header: 'Invoice #' },
    { 
      key: 'client', 
      header: 'Client',
      cell: (item: Invoice) => item.clients?.name || 'Walk-in'
    },
    { 
      key: 'invoice_date', 
      header: 'Date',
      cell: (item: Invoice) => format(new Date(item.invoice_date), 'dd MMM yyyy')
    },
    { 
      key: 'grand_total', 
      header: 'Amount',
      cell: (item: Invoice) => formatCurrency(Number(item.grand_total))
    },
    { 
      key: 'payment_status', 
      header: 'Status',
      cell: (item: Invoice) => (
        <Badge 
          variant="outline"
          className={
            item.payment_status === 'paid' 
              ? 'bg-success/10 text-success border-success/20' 
              : item.payment_status === 'partial'
              ? 'bg-warning/10 text-warning border-warning/20'
              : 'bg-muted text-muted-foreground'
          }
        >
          {item.payment_status}
        </Badge>
      )
    },
    { 
      key: 'payment_mode', 
      header: 'Payment Mode',
      cell: (item: Invoice) => item.payment_mode || '-'
    },
    { 
      key: 'actions', 
      header: 'Actions',
      cell: (item: Invoice) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Eye className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Download className="w-4 h-4" />
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
        title="Invoices" 
        description="Create and manage GST invoices"
        actions={
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="btn-gold">
                <Plus className="w-4 h-4 mr-2" />
                Create Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-primary" />
                  Create New Invoice
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6 mt-4">
                {/* Client Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Select Client</Label>
                    <Select value={selectedClient} onValueChange={setSelectedClient}>
                      <SelectTrigger>
                        <SelectValue placeholder="Walk-in Customer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="walk-in">Walk-in Customer</SelectItem>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Mode</Label>
                    <Select value={paymentMode} onValueChange={setPaymentMode}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Add Products */}
                <div className="space-y-2">
                  <Label>Add Product</Label>
                  <Select onValueChange={addProductToInvoice}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select product to add" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} - {product.weight_grams}g - {formatCurrency(product.selling_price)} (Stock: {product.quantity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Invoice Items */}
                {invoiceItems.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">Product</th>
                          <th className="px-4 py-3 text-right font-medium">Weight</th>
                          <th className="px-4 py-3 text-right font-medium">Gold Value</th>
                          <th className="px-4 py-3 text-right font-medium">Making</th>
                          <th className="px-4 py-3 text-right font-medium">Discount</th>
                          <th className="px-4 py-3 text-right font-medium">GST (3%)</th>
                          <th className="px-4 py-3 text-right font-medium">Total</th>
                          <th className="px-4 py-3 text-center font-medium w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoiceItems.map((item, index) => (
                          <tr key={index} className="border-t">
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium">{item.product_name}</p>
                                <p className="text-xs text-muted-foreground">{item.category}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">{item.weight_grams}g</td>
                            <td className="px-4 py-3 text-right">{formatCurrency(item.gold_value)}</td>
                            <td className="px-4 py-3 text-right">{formatCurrency(item.making_charges)}</td>
                            <td className="px-4 py-3 text-right">
                              <Input
                                type="number"
                                value={item.discount}
                                onChange={(e) => updateItemDiscount(index, parseFloat(e.target.value) || 0)}
                                className="w-24 h-8 text-right"
                              />
                            </td>
                            <td className="px-4 py-3 text-right">{formatCurrency(item.gst_amount)}</td>
                            <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.total)}</td>
                            <td className="px-4 py-3 text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => removeItem(index)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Totals */}
                {invoiceItems.length > 0 && (
                  <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatCurrency(totals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-destructive">
                      <span>Total Discount (on Making Charges)</span>
                      <span>-{formatCurrency(totals.discountAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">GST (3%)</span>
                      <span>{formatCurrency(totals.gstAmount)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold pt-2 border-t">
                      <span>Grand Total</span>
                      <span className="text-primary">{formatCurrency(totals.grandTotal)}</span>
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any notes for this invoice..."
                    rows={2}
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    className="btn-gold"
                    onClick={handleCreateInvoice}
                    disabled={invoiceItems.length === 0}
                  >
                    Create Invoice
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by invoice number or client..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 max-w-md"
        />
      </div>

      <DataTable
        data={filteredInvoices}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No invoices found. Create your first invoice to get started."
      />
    </AppLayout>
  );
}
