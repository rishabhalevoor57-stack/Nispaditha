import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { FileText, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CustomOrderItemsTable } from './CustomOrderItemsTable';
import { CustomOrder, CustomOrderItem, CUSTOM_ORDER_STATUS_LABELS, CUSTOM_ORDER_STATUS_COLORS } from '@/types/customOrder';
import { useCustomOrders } from '@/hooks/useCustomOrders';

interface ViewCustomOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: CustomOrder | null;
  onConvertToInvoice?: (order: CustomOrder, items: CustomOrderItem[]) => void;
  onSendToInvoicePage?: (order: CustomOrder, items: CustomOrderItem[]) => void;
}

export const ViewCustomOrderDialog = ({ open, onOpenChange, order, onConvertToInvoice, onSendToInvoicePage }: ViewCustomOrderDialogProps) => {
  const { getOrderWithItems, silverRate } = useCustomOrders();
  const [items, setItems] = useState<CustomOrderItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (open && order) {
        setLoading(true);
        try {
          const full = await getOrderWithItems(order.id);
          setItems(full.items || []);
        } finally {
          setLoading(false);
        }
      }
    };
    load();
  }, [open, order]);

  if (!order) return null;

  const itemsTotal = items.reduce((sum, i) => sum + i.item_total, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-xl">{order.reference_number}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">Created on {format(new Date(order.created_at), 'PPP')}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={CUSTOM_ORDER_STATUS_COLORS[order.status]}>
                {CUSTOM_ORDER_STATUS_LABELS[order.status]}
              </Badge>
              {!order.converted_to_invoice_id && (
                <>
                  {onConvertToInvoice && (
                    <Button variant="default" size="sm" onClick={() => onConvertToInvoice(order, items)}>
                      <FileText className="h-4 w-4 mr-1.5" />
                      Generate Invoice
                    </Button>
                  )}
                  {onSendToInvoicePage && (
                    <Button variant="outline" size="sm" onClick={() => onSendToInvoicePage(order, items)}>
                      <Send className="h-4 w-4 mr-1.5" />
                      Send to Invoice Page
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Order Date</p>
              <p className="font-medium">{format(new Date(order.order_date), 'dd/MM/yyyy')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Delivery Date</p>
              <p className="font-medium">{order.expected_delivery_date ? format(new Date(order.expected_delivery_date), 'dd/MM/yyyy') : '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Client</p>
              <p className="font-medium">{order.client_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{order.phone_number || '-'}</p>
            </div>
          </div>

          <Separator />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground text-center py-4">Loading...</p>
              ) : (
                <CustomOrderItemsTable items={items} onChange={() => {}} silverRate={silverRate} readOnly />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Charges Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Items Total</span><span>₹{itemsTotal.toLocaleString('en-IN')}</span></div>
              {order.design_charges > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Design Charges</span><span>₹{order.design_charges.toLocaleString('en-IN')}</span></div>
              )}
              {order.additional_charge > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">{order.additional_charge_label}</span><span>₹{order.additional_charge.toLocaleString('en-IN')}</span></div>
              )}
              {order.flat_discount > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Flat Discount</span><span className="text-destructive">-₹{order.flat_discount.toLocaleString('en-IN')}</span></div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold"><span>Grand Total</span><span>₹{order.total_amount.toLocaleString('en-IN')}</span></div>
            </CardContent>
          </Card>

          {order.converted_to_invoice_id && (
            <div className="p-3 rounded-lg bg-primary/10 text-sm">
              ✅ Converted to Invoice
            </div>
          )}

          {order.notes && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Notes</CardTitle></CardHeader>
              <CardContent><p className="whitespace-pre-wrap text-sm">{order.notes}</p></CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
