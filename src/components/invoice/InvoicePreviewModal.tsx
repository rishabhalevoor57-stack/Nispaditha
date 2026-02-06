import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileText } from 'lucide-react';
import type { BusinessSettings, InvoiceItem, InvoiceTotals } from '@/types/invoice';

interface InvoicePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNumber: string;
  invoiceDate: string;
  clientName: string;
  clientPhone: string;
  paymentMode: string;
  items: InvoiceItem[];
  totals: InvoiceTotals;
  businessSettings: BusinessSettings | null;
  notes?: string;
  showMakingCharges?: boolean;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatPaymentMode = (mode: string): string => {
  const modes: Record<string, string> = {
    cash: 'Cash',
    upi: 'UPI',
    card: 'Card',
    bank_transfer: 'Bank Transfer',
    pay_later: 'Pay Later',
  };
  return modes[mode] || mode.toUpperCase();
};

export function InvoicePreviewModal({
  open,
  onOpenChange,
  invoiceNumber,
  invoiceDate,
  clientName,
  clientPhone,
  paymentMode,
  items,
  totals,
  businessSettings,
  notes,
  showMakingCharges = true,
}: InvoicePreviewModalProps) {
  const [logoLoaded, setLogoLoaded] = useState(false);

  useEffect(() => {
    // Preload logo
    const img = new Image();
    img.onload = () => setLogoLoaded(true);
    img.onerror = () => setLogoLoaded(false);
    img.src = '/images/nispaditha-logo.png';
  }, []);

  if (!businessSettings) return null;

  const dateStr = new Date(invoiceDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Invoice Preview
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-80px)]">
          {/* Invoice Preview - Mimics PDF Layout */}
          <div className="p-8 bg-white text-black" id="invoice-preview">
            {/* Logo */}
            {logoLoaded && (
              <div className="flex justify-center mb-4">
                <img 
                  src="/images/nispaditha-logo.png" 
                  alt="Logo" 
                  className="h-16 object-contain"
                />
              </div>
            )}

            {/* Header */}
            <div className="text-center mb-4">
              <h1 className="text-xl font-bold">{businessSettings.business_name}</h1>
              {businessSettings.address && (
                <p className="text-sm text-gray-600">{businessSettings.address}</p>
              )}
              {businessSettings.phone && (
                <p className="text-sm text-gray-600">Phone: {businessSettings.phone}</p>
              )}
              {businessSettings.gst_number && (
                <p className="text-sm text-gray-600">GSTIN: {businessSettings.gst_number}</p>
              )}
            </div>

            <Separator className="my-4 bg-gray-400" />

            {/* TAX INVOICE Title */}
            <h2 className="text-center text-lg font-bold mb-4">TAX INVOICE</h2>

            {/* Invoice Info Row */}
            <div className="grid grid-cols-3 text-sm mb-4">
              <div>Invoice No: {invoiceNumber}</div>
              <div>Date: {dateStr}</div>
              <div>Payment: {formatPaymentMode(paymentMode)}</div>
            </div>

            <Separator className="my-3 bg-gray-300" />

            {/* Bill To */}
            <div className="mb-4">
              <p className="font-bold text-sm">Bill To:</p>
              <p className="text-sm">{clientName || 'Walk-in Customer'}</p>
              {clientPhone && <p className="text-sm">Phone: {clientPhone}</p>}
            </div>

            {/* Items Table */}
            <div className="border border-gray-300 rounded overflow-hidden mb-4">
              <table className="w-full text-xs">
                <thead className="bg-gray-800 text-white">
                  <tr>
                    <th className="px-2 py-2 text-center w-[5%]">Sr</th>
                    <th className="px-2 py-2 text-left w-[22%]">Description</th>
                    <th className="px-2 py-2 text-left w-[10%]">SKU</th>
                     <th className="px-2 py-2 text-right w-[8%]">Wt(G)</th>
                     <th className="px-2 py-2 text-center w-[5%]">Qty</th>
                    <th className="px-2 py-2 text-right w-[10%]">Rate/g</th>
                    {showMakingCharges && (
                      <>
                        <th className="px-2 py-2 text-right w-[10%]">MC</th>
                        <th className="px-2 py-2 text-right w-[8%]">MC/g</th>
                        <th className="px-2 py-2 text-right w-[5%]">Disc</th>
                      </>
                    )}
                    <th className="px-2 py-2 text-right w-[15%]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const isFlat = item.pricing_mode === 'flat_price';
                    return (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-2 py-2 text-center border-t border-gray-200">{index + 1}</td>
                        <td className="px-2 py-2 text-left border-t border-gray-200">{item.product_name}</td>
                        <td className="px-2 py-2 text-left border-t border-gray-200 font-mono">{item.sku}</td>
                        <td className="px-2 py-2 text-right border-t border-gray-200">{isFlat ? '-' : item.weight_grams.toFixed(2)}</td>
                        <td className="px-2 py-2 text-center border-t border-gray-200">{item.quantity}</td>
                        <td className="px-2 py-2 text-right border-t border-gray-200">{isFlat ? '-' : formatCurrency(item.rate_per_gram)}</td>
                        {showMakingCharges && (
                          <>
                            <td className="px-2 py-2 text-right border-t border-gray-200">{isFlat ? '-' : formatCurrency(item.making_charges)}</td>
                            <td className="px-2 py-2 text-right border-t border-gray-200 text-gray-500">
                              {isFlat ? '-' : `${formatCurrency(item.making_charges_per_gram)}/g`}
                            </td>
                            <td className="px-2 py-2 text-right border-t border-gray-200">
                              {isFlat ? '-' : (item.discount > 0 ? formatCurrency(item.discount) : '-')}
                            </td>
                          </>
                        )}
                        <td className="px-2 py-2 text-right border-t border-gray-200 font-medium">{formatCurrency(item.line_total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-4">
              <div className="w-64 text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                {totals.discountAmount > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>Total Discount:</span>
                    <span>-{formatCurrency(totals.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>GST (3%):</span>
                  <span>{formatCurrency(totals.gstAmount)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-bold text-base">
                  <span>Grand Total:</span>
                  <span>{formatCurrency(totals.grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {notes && (
              <div className="text-sm italic text-gray-600 mb-6">
                Note: {notes}
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-between items-end mt-8 pt-4 border-t border-gray-300">
              <div>
                <div className="w-32 border-t border-gray-400 mt-8"></div>
                <p className="text-xs">Authorized Signature</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-sm">Thank you for your business!</p>
                <p className="text-xs text-gray-500">This is a computer generated invoice.</p>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
