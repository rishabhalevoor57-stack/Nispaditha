import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Download, FileText } from 'lucide-react';
import { generateReturnPdf } from '@/utils/returnPdf';
import { format } from 'date-fns';
import type { ReturnExchange, ReturnExchangeItem } from '@/types/returnExchange';

interface ViewReturnExchangeDialogProps {
  recordId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);

export function ViewReturnExchangeDialog({
  recordId,
  open,
  onOpenChange,
}: ViewReturnExchangeDialogProps) {
  const [record, setRecord] = useState<ReturnExchange | null>(null);
  const [items, setItems] = useState<ReturnExchangeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (open && recordId) {
      fetchDetails();
    }
  }, [open, recordId]);

  const fetchDetails = async () => {
    if (!recordId) return;
    setIsLoading(true);

    const [recordResult, itemsResult] = await Promise.all([
      supabase.from('return_exchanges').select('*').eq('id', recordId).single(),
      supabase
        .from('return_exchange_items')
        .select('*')
        .eq('return_exchange_id', recordId)
        .order('created_at'),
    ]);

    if (recordResult.data) setRecord(recordResult.data as ReturnExchange);
    if (itemsResult.data) setItems(itemsResult.data as ReturnExchangeItem[]);
    setIsLoading(false);
  };

  const handleDownloadPdf = async () => {
    if (!record) return;
    const { data: settingsData } = await supabase
      .from('business_settings')
      .select('*')
      .maybeSingle();

    if (settingsData) {
      generateReturnPdf({
        referenceNumber: record.reference_number,
        type: record.type as 'return' | 'exchange',
        date: record.created_at,
        originalInvoiceNumber: record.original_invoice_number,
        clientName: record.client_name || 'Walk-in Customer',
        clientPhone: record.client_phone || '',
        items: items.map((i) => ({
          direction: i.direction as 'returned' | 'new',
          product_name: i.product_name,
          sku: i.sku,
          category: i.category,
          quantity: i.quantity,
          weight_grams: i.weight_grams,
          total: i.total,
        })),
        refundAmount: record.refund_amount,
        additionalCharge: record.additional_charge,
        paymentMode: record.payment_mode || 'cash',
        notes: record.notes || '',
        businessSettings: settingsData,
      });
    }
  };

  const returnedItems = items.filter((i) => i.direction === 'returned');
  const newItems = items.filter((i) => i.direction === 'new');

  if (isLoading || !record) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {record.reference_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Info */}
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Type</p>
                <Badge variant={record.type === 'return' ? 'destructive' : 'default'}>
                  {record.type === 'return' ? 'Return' : 'Exchange'}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Date</p>
                <p className="font-medium">{format(new Date(record.created_at), 'dd MMM yyyy, HH:mm')}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Original Invoice</p>
                <p className="font-medium">{record.original_invoice_number}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Client</p>
                <p className="font-medium">{record.client_name || 'Walk-in'}</p>
              </div>
            </div>
          </div>

          {/* Returned Items */}
          {returnedItems.length > 0 && (
            <div>
              <p className="font-semibold text-sm mb-2">Returned Items</p>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-destructive/10">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Item</th>
                      <th className="px-3 py-2 text-left font-medium">SKU</th>
                      <th className="px-3 py-2 text-center font-medium">Qty</th>
                      <th className="px-3 py-2 text-right font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnedItems.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="px-3 py-2">{item.product_name}</td>
                        <td className="px-3 py-2 font-mono text-xs">{item.sku || '-'}</td>
                        <td className="px-3 py-2 text-center">{item.quantity}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* New Items (exchange) */}
          {newItems.length > 0 && (
            <div>
              <p className="font-semibold text-sm mb-2">New Items</p>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-primary/10">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Item</th>
                      <th className="px-3 py-2 text-left font-medium">SKU</th>
                      <th className="px-3 py-2 text-center font-medium">Qty</th>
                      <th className="px-3 py-2 text-right font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {newItems.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="px-3 py-2">{item.product_name}</td>
                        <td className="px-3 py-2 font-mono text-xs">{item.sku || '-'}</td>
                        <td className="px-3 py-2 text-center">{item.quantity}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Financial Summary */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-2">
            {record.refund_amount > 0 && (
              <div className="flex justify-between text-destructive font-medium">
                <span>Refund Amount</span>
                <span>{formatCurrency(record.refund_amount)}</span>
              </div>
            )}
            {record.additional_charge > 0 && (
              <div className="flex justify-between text-primary font-medium">
                <span>Additional Charge</span>
                <span>{formatCurrency(record.additional_charge)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Payment Mode</span>
              <span className="capitalize">{record.payment_mode || '-'}</span>
            </div>
          </div>

          {record.notes && (
            <div className="text-sm">
              <p className="text-muted-foreground">Notes:</p>
              <p className="italic">{record.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button className="btn-gold" onClick={handleDownloadPdf}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
