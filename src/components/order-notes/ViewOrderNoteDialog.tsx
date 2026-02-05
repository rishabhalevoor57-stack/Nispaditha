import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { OrderNoteItemsTable } from './OrderNoteItemsTable';
import {
  OrderNote,
  OrderNoteItem,
  ORDER_NOTE_STATUS_LABELS,
  ORDER_NOTE_STATUS_COLORS,
} from '@/types/orderNote';
import { useOrderNotes } from '@/hooks/useOrderNotes';

interface ViewOrderNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNote: OrderNote | null;
  onPrint: (orderNote: OrderNote) => void;
}

export const ViewOrderNoteDialog = ({
  open,
  onOpenChange,
  orderNote,
  onPrint,
}: ViewOrderNoteDialogProps) => {
  const { getOrderNoteWithItems } = useOrderNotes();
  const [items, setItems] = useState<OrderNoteItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (open && orderNote) {
        setLoading(true);
        try {
          const fullNote = await getOrderNoteWithItems(orderNote.id);
          setItems(fullNote.items || []);
        } finally {
          setLoading(false);
        }
      }
    };
    load();
  }, [open, orderNote]);

  if (!orderNote) return null;

  const handlerName = orderNote.handler?.full_name || orderNote.handler?.email || 'Not assigned';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-xl">{orderNote.order_reference}</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Created on {format(new Date(orderNote.created_at), 'PPP')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={ORDER_NOTE_STATUS_COLORS[orderNote.status]}>
              {ORDER_NOTE_STATUS_LABELS[orderNote.status]}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => onPrint(orderNote)}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Order Info */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Order Date</p>
              <p className="font-medium">{format(new Date(orderNote.order_date), 'dd/MM/yyyy')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Handled By</p>
              <p className="font-medium">{handlerName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Delivery Type</p>
              <p className="font-medium capitalize">{orderNote.delivery_type.replace('_', ' ')}</p>
            </div>
          </div>

          <Separator />

          {/* Customer Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{orderNote.customer_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{orderNote.phone_number || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="font-medium">{orderNote.address || '-'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground text-center py-4">Loading...</p>
              ) : (
                <OrderNoteItemsTable items={items} onChange={() => {}} readOnly />
              )}
            </CardContent>
          </Card>

          {/* Payment Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Payment Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Quoted Estimate</p>
                <p className="font-medium">₹{orderNote.quoted_estimate?.toLocaleString('en-IN') || '0'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Advance Received</p>
                <p className="font-medium text-primary">₹{orderNote.advance_received?.toLocaleString('en-IN') || '0'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Balance</p>
                <p className={`font-medium ${orderNote.balance > 0 ? 'text-amber-600' : ''}`}>
                  ₹{orderNote.balance?.toLocaleString('en-IN') || '0'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Payment Mode</p>
                <p className="font-medium">{orderNote.payment_mode || '-'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Delivery Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Expected Delivery</p>
                <p className="font-medium">
                  {orderNote.expected_delivery_date
                    ? format(new Date(orderNote.expected_delivery_date), 'dd/MM/yyyy')
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Time Slot</p>
                <p className="font-medium">{orderNote.time_slot || '-'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Special Instructions */}
          {orderNote.special_instructions && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Special Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{orderNote.special_instructions}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
