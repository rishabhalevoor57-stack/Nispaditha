import { useState } from 'react';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrderNotePayments } from '@/hooks/useOrderNotePayments';
import { PAYMENT_MODES } from '@/types/orderNote';

interface Props {
  orderNoteId: string;
  quotedEstimate: number;
}

export const OrderNotePaymentHistory = ({ orderNoteId, quotedEstimate }: Props) => {
  const { payments, totalPaid, addPayment } = useOrderNotePayments(orderNoteId);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('Cash');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const balance = Math.max(0, quotedEstimate - totalPaid);

  const handleAdd = async () => {
    if (!amount || Number(amount) <= 0) return;
    await addPayment.mutateAsync({
      order_note_id: orderNoteId,
      amount: Number(amount),
      payment_mode: mode,
      payment_date: date,
      notes: notes || undefined,
    });
    setAmount('');
    setNotes('');
    setShowForm(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Payment History</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-3 w-3 mr-1" /> Add Payment
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-muted/50">
          <div>
            <p className="text-xs text-muted-foreground">Total Estimate</p>
            <p className="font-semibold">₹{quotedEstimate.toLocaleString('en-IN')}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Paid</p>
            <p className="font-semibold text-primary">₹{totalPaid.toLocaleString('en-IN')}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Balance</p>
            <p className={`font-semibold ${balance > 0 ? 'text-amber-600' : 'text-primary'}`}>
              ₹{balance.toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        {/* Add Payment Form */}
        {showForm && (
          <div className="border rounded-lg p-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Amount</label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="₹0" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Payment Mode</label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Date</label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Notes</label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAdd} disabled={addPayment.isPending}>
                {addPayment.isPending ? 'Saving...' : 'Record Payment'}
              </Button>
            </div>
          </div>
        )}

        {/* Payment List */}
        {payments.length > 0 ? (
          <div className="space-y-2">
            {payments.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/30 text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">#{i + 1}</span>
                  <span className="font-medium">₹{Number(p.amount).toLocaleString('en-IN')}</span>
                  <span className="text-muted-foreground">{p.payment_mode}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  {p.notes && <span className="text-xs">{p.notes}</span>}
                  <span>{format(new Date(p.payment_date), 'dd MMM yyyy')}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">No payments recorded yet</p>
        )}
      </CardContent>
    </Card>
  );
};
