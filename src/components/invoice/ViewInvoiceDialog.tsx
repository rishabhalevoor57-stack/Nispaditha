import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Download, Printer, FileText } from 'lucide-react';
import { downloadInvoicePdf, printInvoice } from '@/utils/invoicePdf';
import type { BusinessSettings, InvoiceItem, InvoiceTotals } from '@/types/invoice';

interface ViewInvoiceDialogProps {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface InvoiceDetails {
  id: string;
  invoice_number: string;
  invoice_date: string;
  subtotal: number;
  discount_amount: number;
  gst_amount: number;
  grand_total: number;
  payment_mode: string | null;
  payment_status: string;
  notes: string | null;
  clients: { name: string; phone: string | null } | null;
}

interface InvoiceItemRow {
  id: string;
  product_name: string;
  category: string | null;
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
  products: { sku: string } | null;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
};

export function ViewInvoiceDialog({
  invoiceId,
  open,
  onOpenChange,
}: ViewInvoiceDialogProps) {
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [items, setItems] = useState<InvoiceItemRow[]>([]);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { userRole } = useAuth();
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    if (open && invoiceId) {
      fetchInvoiceDetails();
      fetchBusinessSettings();
    }
  }, [open, invoiceId]);

  const fetchInvoiceDetails = async () => {
    if (!invoiceId) return;
    
    setIsLoading(true);
    
    const [invoiceResult, itemsResult] = await Promise.all([
      supabase
        .from('invoices')
        .select('*, clients(name, phone)')
        .eq('id', invoiceId)
        .single(),
      supabase
        .from('invoice_items')
        .select('*, products(sku)')
        .eq('invoice_id', invoiceId)
        .order('created_at'),
    ]);

    if (invoiceResult.data) {
      setInvoice(invoiceResult.data as InvoiceDetails);
    }
    if (itemsResult.data) {
      setItems(itemsResult.data as InvoiceItemRow[]);
    }
    
    setIsLoading(false);
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

  const getPdfData = () => {
    if (!invoice || !businessSettings) return null;

    const invoiceItems: InvoiceItem[] = items.map(item => ({
      product_id: '',
      sku: item.products?.sku || 'N/A',
      product_name: item.product_name,
      category: item.category || '',
      weight_grams: Number(item.weight_grams),
      quantity: item.quantity,
      rate_per_gram: Number(item.rate_per_gram),
      base_price: Number(item.gold_value),
      making_charges: Number(item.making_charges),
      discount: Number(item.discount),
      discounted_making: Number(item.discounted_making),
      line_total: Number(item.subtotal),
      gst_percentage: Number(item.gst_percentage),
    }));

    const totals: InvoiceTotals = {
      subtotal: Number(invoice.subtotal),
      discountAmount: Number(invoice.discount_amount),
      gstAmount: Number(invoice.gst_amount),
      grandTotal: Number(invoice.grand_total),
    };

    return {
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      clientName: invoice.clients?.name || 'Walk-in Customer',
      clientPhone: invoice.clients?.phone || '',
      paymentMode: invoice.payment_mode || 'cash',
      items: invoiceItems,
      totals,
      businessSettings,
      notes: invoice.notes || undefined,
    };
  };

  const handleDownload = () => {
    const pdfData = getPdfData();
    if (pdfData) {
      downloadInvoicePdf(pdfData, isAdmin);
    }
  };

  const handlePrint = () => {
    const pdfData = getPdfData();
    if (pdfData) {
      printInvoice(pdfData, isAdmin);
    }
  };

  if (isLoading || !invoice) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Invoice {invoice.invoice_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Invoice Header */}
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Invoice Number</p>
                <p className="font-medium">{invoice.invoice_number}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date</p>
                <p className="font-medium">{new Date(invoice.invoice_date).toLocaleDateString('en-IN')}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Client</p>
                <p className="font-medium">{invoice.clients?.name || 'Walk-in Customer'}</p>
                {invoice.clients?.phone && (
                  <p className="text-xs text-muted-foreground">{invoice.clients.phone}</p>
                )}
              </div>
              <div>
                <p className="text-muted-foreground">Payment Mode</p>
                <p className="font-medium capitalize">{invoice.payment_mode || '-'}</p>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-3 text-left font-medium">SKU</th>
                  <th className="px-3 py-3 text-left font-medium">Description</th>
                  <th className="px-3 py-3 text-right font-medium">Weight (g)</th>
                  <th className="px-3 py-3 text-center font-medium">Qty</th>
                  <th className="px-3 py-3 text-right font-medium">Rate/g</th>
                  {isAdmin && (
                    <>
                      <th className="px-3 py-3 text-right font-medium">Making</th>
                      <th className="px-3 py-3 text-right font-medium">Discount</th>
                    </>
                  )}
                  <th className="px-3 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-3 py-3 font-mono text-xs">{item.products?.sku || 'N/A'}</td>
                    <td className="px-3 py-3">
                      <div>
                        <p className="font-medium">{item.product_name}</p>
                        {item.category && <p className="text-xs text-muted-foreground">{item.category}</p>}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">{Number(item.weight_grams).toFixed(2)}</td>
                    <td className="px-3 py-3 text-center">{item.quantity}</td>
                    <td className="px-3 py-3 text-right">{formatCurrency(Number(item.rate_per_gram))}</td>
                    {isAdmin && (
                      <>
                        <td className="px-3 py-3 text-right">{formatCurrency(Number(item.making_charges))}</td>
                        <td className="px-3 py-3 text-right text-destructive">
                          {Number(item.discount) > 0 ? `-${formatCurrency(Number(item.discount))}` : '-'}
                        </td>
                      </>
                    )}
                    <td className="px-3 py-3 text-right font-medium">{formatCurrency(Number(item.subtotal))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(Number(invoice.subtotal))}</span>
            </div>
            {isAdmin && Number(invoice.discount_amount) > 0 && (
              <div className="flex justify-between text-destructive">
                <span>Total Discount</span>
                <span>-{formatCurrency(Number(invoice.discount_amount))}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">GST (3%)</span>
              <span>{formatCurrency(Number(invoice.gst_amount))}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Grand Total</span>
              <span className="text-primary">{formatCurrency(Number(invoice.grand_total))}</span>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="text-sm">
              <p className="text-muted-foreground">Notes:</p>
              <p className="italic">{invoice.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button className="btn-gold" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
