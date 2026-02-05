import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrderNoteItemsTable } from './OrderNoteItemsTable';
import {
  OrderNote,
  OrderNoteItem,
  OrderNoteStatus,
  ORDER_NOTE_STATUS_LABELS,
  PAYMENT_MODES,
  TIME_SLOTS,
} from '@/types/orderNote';
import { useOrderNotes } from '@/hooks/useOrderNotes';
import { useAuth } from '@/contexts/AuthContext';

interface OrderNoteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNote?: OrderNote | null;
}

export const OrderNoteFormDialog = ({
  open,
  onOpenChange,
  orderNote,
}: OrderNoteFormDialogProps) => {
  const { user } = useAuth();
  const { profiles, generateOrderReference, getOrderNoteWithItems, createOrderNote, updateOrderNote } = useOrderNotes();

  const [loading, setLoading] = useState(false);
  const [orderReference, setOrderReference] = useState('');
  const [orderDate, setOrderDate] = useState<Date>(new Date());
  const [handledBy, setHandledBy] = useState<string>('');

  // Customer Details
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');

  // Order Items
  const [items, setItems] = useState<OrderNoteItem[]>([]);

  // Payment Notes
  const [quotedEstimate, setQuotedEstimate] = useState<number>(0);
  const [advanceReceived, setAdvanceReceived] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState('');

  // Delivery
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'home_delivery'>('pickup');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<Date | undefined>();
  const [timeSlot, setTimeSlot] = useState('');

  // Special Instructions
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Status
  const [status, setStatus] = useState<OrderNoteStatus>('order_noted');

  const balance = quotedEstimate - advanceReceived;
  const isEditing = !!orderNote;

  useEffect(() => {
    const loadData = async () => {
      if (open) {
        if (orderNote) {
          // Load existing order note with items
          const fullNote = await getOrderNoteWithItems(orderNote.id);
          setOrderReference(fullNote.order_reference);
          setOrderDate(new Date(fullNote.order_date));
          setHandledBy(fullNote.handled_by || '');
          setCustomerName(fullNote.customer_name);
          setPhoneNumber(fullNote.phone_number || '');
          setAddress(fullNote.address || '');
          setItems(fullNote.items || []);
          setQuotedEstimate(fullNote.quoted_estimate || 0);
          setAdvanceReceived(fullNote.advance_received || 0);
          setPaymentMode(fullNote.payment_mode || '');
          setDeliveryType(fullNote.delivery_type);
          setExpectedDeliveryDate(fullNote.expected_delivery_date ? new Date(fullNote.expected_delivery_date) : undefined);
          setTimeSlot(fullNote.time_slot || '');
          setSpecialInstructions(fullNote.special_instructions || '');
          setStatus(fullNote.status);
        } else {
          // New order note
          const ref = await generateOrderReference();
          setOrderReference(ref);
          setOrderDate(new Date());
          setHandledBy(user?.id || '');
          setCustomerName('');
          setPhoneNumber('');
          setAddress('');
          setItems([]);
          setQuotedEstimate(0);
          setAdvanceReceived(0);
          setPaymentMode('');
          setDeliveryType('pickup');
          setExpectedDeliveryDate(undefined);
          setTimeSlot('');
          setSpecialInstructions('');
          setStatus('order_noted');
        }
      }
    };
    loadData();
  }, [open, orderNote]);

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      return;
    }

    setLoading(true);
    try {
      const noteData = {
        order_reference: orderReference,
        order_date: format(orderDate, 'yyyy-MM-dd'),
        handled_by: handledBy || null,
        customer_name: customerName,
        phone_number: phoneNumber || null,
        address: address || null,
        quoted_estimate: quotedEstimate,
        advance_received: advanceReceived,
        payment_mode: paymentMode || null,
        delivery_type: deliveryType,
        expected_delivery_date: expectedDeliveryDate ? format(expectedDeliveryDate, 'yyyy-MM-dd') : null,
        time_slot: timeSlot || null,
        special_instructions: specialInstructions || null,
        status,
        created_by: user?.id || null,
      };

      const itemsData = items.map(item => ({
        item_description: item.item_description,
        customization_notes: item.customization_notes || null,
        quantity: item.quantity,
        expected_price: item.expected_price,
      }));

      if (isEditing) {
        await updateOrderNote.mutateAsync({
          id: orderNote.id,
          note: noteData,
          items: itemsData,
        });
      } else {
        await createOrderNote.mutateAsync({
          note: noteData as any,
          items: itemsData,
        });
      }

      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Order Note' : 'New Order Note'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Auto Fields */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Order Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Order Reference</Label>
                <Input value={orderReference} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(orderDate, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={orderDate} onSelect={(d) => d && setOrderDate(d)} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Handled By</Label>
                <Select value={handledBy} onValueChange={setHandledBy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.user_id} value={profile.user_id}>
                        {profile.full_name || profile.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Customer Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Customer Name *</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Enter phone number"
                />
              </div>
              <div className="space-y-2">
                <Label>Address / Area</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter address"
                />
              </div>
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Order Details</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderNoteItemsTable items={items} onChange={setItems} />
            </CardContent>
          </Card>

          {/* Payment Notes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Payment Notes (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Quoted Estimate</Label>
                <Input
                  type="number"
                  min="0"
                  value={quotedEstimate}
                  onChange={(e) => setQuotedEstimate(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Advance Received</Label>
                <Input
                  type="number"
                  min="0"
                  value={advanceReceived}
                  onChange={(e) => setAdvanceReceived(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Balance</Label>
                <Input value={`₹${balance.toLocaleString('en-IN')}`} readOnly className="bg-muted font-medium" />
              </div>
              <div className="space-y-2">
                <Label>Payment Mode</Label>
                <Select value={paymentMode} onValueChange={setPaymentMode}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Delivery / Pickup */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Delivery / Pickup</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={deliveryType} onValueChange={(v) => setDeliveryType(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pickup">Pickup</SelectItem>
                    <SelectItem value="home_delivery">Home Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Expected Delivery Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !expectedDeliveryDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {expectedDeliveryDate ? format(expectedDeliveryDate, 'PPP') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={expectedDeliveryDate} onSelect={setExpectedDeliveryDate} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Time Slot</Label>
                <Select value={timeSlot} onValueChange={setTimeSlot}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map((slot) => (
                      <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Special Instructions & Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Special Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="Any special instructions..."
                  className="min-h-[100px]"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={status} onValueChange={(v) => setStatus(v as OrderNoteStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ORDER_NOTE_STATUS_LABELS) as OrderNoteStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{ORDER_NOTE_STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading || !customerName.trim()}>
              {loading ? 'Saving...' : isEditing ? 'Update Order Note' : 'Create Order Note'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
