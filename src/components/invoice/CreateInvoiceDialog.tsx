import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Calculator, Download, Printer } from 'lucide-react';
import { InvoiceItemsTable } from './InvoiceItemsTable';
import { InvoiceTotalsSection } from './InvoiceTotalsSection';
import { useInvoiceCalculations } from '@/hooks/useInvoiceCalculations';
import { downloadInvoicePdf, printInvoice } from '@/utils/invoicePdf';
import type { Product, Client, BusinessSettings, InvoiceItem } from '@/types/invoice';

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvoiceCreated: () => void;
}

export function CreateInvoiceDialog({
  open,
  onOpenChange,
  onInvoiceCreated,
}: CreateInvoiceDialogProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [notes, setNotes] = useState('');
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const { totals } = useInvoiceCalculations(invoiceItems);

  // Get the default silver rate from settings
  const defaultRate = businessSettings?.silver_rate_per_gram || 95;

  useEffect(() => {
    if (open) {
      fetchProducts();
      fetchClients();
      fetchBusinessSettings();
    }
  }, [open]);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*, categories(name)')
      .gt('quantity', 0)
      .order('name');
    setProducts((data as Product[]) || []);
  };

  const fetchClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, name, phone, address, gst_number')
      .order('name');
    setClients((data as Client[]) || []);
  };

  const fetchBusinessSettings = async () => {
    const { data } = await supabase
      .from('business_settings')
      .select('*')
      .maybeSingle();
    if (data) {
      setBusinessSettings(data as BusinessSettings);
    }
  };

  const handleClientChange = (clientId: string) => {
    setSelectedClient(clientId);
    if (clientId && clientId !== 'walk-in') {
      const client = clients.find(c => c.id === clientId);
      if (client) {
        setClientName(client.name);
        setClientPhone(client.phone || '');
      }
    } else {
      setClientName('');
      setClientPhone('');
    }
  };

  const resetForm = () => {
    setSelectedClient('');
    setClientName('');
    setClientPhone('');
    setInvoiceItems([]);
    setPaymentMode('cash');
    setNotes('');
  };

  const handleCreateInvoice = async () => {
    if (invoiceItems.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please add at least one product' });
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate invoice number
      const { data: invoiceNum } = await supabase.rpc('generate_invoice_number');

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
          invoice_number: invoiceNum,
          client_id: selectedClient && selectedClient !== 'walk-in' ? selectedClient : null,
          subtotal: totals.subtotal,
          discount_amount: totals.discountAmount,
          gst_amount: totals.gstAmount,
          grand_total: totals.grandTotal,
          payment_status: paymentMode === 'pay_later' ? 'pending' : 'paid',
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
        gold_value: item.base_price,
        making_charges: item.making_charges,
        discount: item.discount,
        discounted_making: item.discounted_making,
        subtotal: item.line_total,
        gst_percentage: item.gst_percentage,
        gst_amount: item.line_total * (item.gst_percentage / 100),
        total: item.line_total + (item.line_total * (item.gst_percentage / 100)),
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Stock reduction is handled automatically by database trigger

      // Generate PDF for download
      if (businessSettings) {
        downloadInvoicePdf({
          invoiceNumber: invoiceNum,
          invoiceDate: new Date().toISOString(),
          clientName: clientName || 'Walk-in Customer',
          clientPhone,
          paymentMode,
          items: invoiceItems,
          totals,
          businessSettings,
          notes,
        }, true); // Always admin view since all users are admin
      }

      toast({ title: 'Invoice created and downloaded!' });
      onOpenChange(false);
      resetForm();
      onInvoiceCreated();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast({ variant: 'destructive', title: 'Error', description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintPreview = () => {
    if (!businessSettings || invoiceItems.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please add products first' });
      return;
    }

    printInvoice({
      invoiceNumber: 'PREVIEW',
      invoiceDate: new Date().toISOString(),
      clientName: clientName || 'Walk-in Customer',
      clientPhone,
      paymentMode,
      items: invoiceItems,
      totals,
      businessSettings,
      notes,
    }, true); // Always admin view
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            Create New Invoice
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Business GST Display */}
          {businessSettings?.gst_number && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <span className="text-muted-foreground">Shop GSTIN: </span>
              <span className="font-mono font-medium">{businessSettings.gst_number}</span>
            </div>
          )}

          {/* Client & Invoice Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Select Client</Label>
              <Select value={selectedClient} onValueChange={handleClientChange}>
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
              <Label>Client Name</Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Enter client name"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="Enter phone number"
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="pay_later">Pay Later</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Product Items Table */}
          <InvoiceItemsTable
            items={invoiceItems}
            products={products}
            defaultRate={defaultRate}
            onItemsChange={setInvoiceItems}
          />

          {/* Totals */}
          {invoiceItems.length > 0 && (
            <InvoiceTotalsSection totals={totals} isAdmin={true} />
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
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant="outline"
              onClick={handlePrintPreview}
              disabled={invoiceItems.length === 0}
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Preview
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="btn-gold"
              onClick={handleCreateInvoice}
              disabled={invoiceItems.length === 0 || isSubmitting}
            >
              <Download className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Creating...' : 'Create & Download'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
