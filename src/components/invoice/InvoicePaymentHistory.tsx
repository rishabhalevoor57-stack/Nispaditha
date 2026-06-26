import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Receipt } from 'lucide-react';

interface PaymentRow {
  id: string;
  amount: number;
  payment_mode: string;
  payment_date: string;
  notes: string | null;
}

interface Props {
  invoiceId: string;
  invoiceNumber: string;
  grandTotal: number;
  customerName: string;
  customerPhone?: string;
  businessSettings: unknown;
}

export function InvoicePaymentHistory({ invoiceId, grandTotal }: Props) {
  const [rows, setRows] = useState<PaymentRow[]>([]);

  useEffect(() => {
    if (!invoiceId) return;
    supabase
      .from('invoice_payments')
      .select('id, amount, payment_mode, payment_date, notes')
      .eq('invoice_id', invoiceId)
      .order('payment_date', { ascending: true })
      .then(({ data }) => setRows((data || []) as PaymentRow[]));
  }, [invoiceId]);

  if (rows.length === 0) return null;

  const totalPaid = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const rawBalance = Math.round((grandTotal - totalPaid) * 100) / 100;
  const balance = Math.abs(rawBalance) <= 0.05 ? 0 : Math.max(0, rawBalance);
  const excess = rawBalance < -0.05 ? Math.abs(rawBalance) : 0;
  const isFullyPaid = balance === 0 && totalPaid > 0;

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Receipt className="w-4 h-4 text-primary" />
        <h3 className="font-semibold">Payment History</h3>
      </div>
      <div className="space-y-2 text-sm">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
            <div>
              <p className="font-medium">
                ₹ {Number(r.amount).toFixed(2)} · {r.payment_mode.toUpperCase()}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(r.payment_date), 'dd MMM yyyy')}{r.notes ? ` · ${r.notes}` : ''}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between border-t pt-3 text-sm items-center flex-wrap gap-2">
        <span>Total Paid: <span className="font-semibold text-green-600">₹ {totalPaid.toFixed(2)}</span></span>
        {isFullyPaid ? (
          <span className="px-2 py-1 rounded-md bg-green-100 text-green-700 font-semibold">✓ PAID IN FULL</span>
        ) : (
          <span>Balance: <span className="font-semibold text-destructive">₹ {balance.toFixed(2)}</span></span>
        )}
        {excess > 0 && (
          <span className="px-2 py-1 rounded-md bg-blue-100 text-blue-700 font-semibold">Excess: ₹ {excess.toFixed(2)}</span>
        )}
      </div>
    </div>
  );
}
