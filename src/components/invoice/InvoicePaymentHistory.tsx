import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Download, Receipt } from 'lucide-react';
import { downloadPaymentReceipt } from '@/utils/paymentReceiptPdf';
import type { BusinessSettings } from '@/types/invoice';

interface PaymentRow {
  id: string;
  receipt_number: string;
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
  businessSettings: BusinessSettings | null;
}

export function InvoicePaymentHistory({ invoiceId, invoiceNumber, grandTotal, customerName, customerPhone, businessSettings }: Props) {
  const [rows, setRows] = useState<PaymentRow[]>([]);

  useEffect(() => {
    if (!invoiceId) return;
    supabase
      .from('invoice_payments')
      .select('id, receipt_number, amount, payment_mode, payment_date, notes')
      .eq('invoice_id', invoiceId)
      .order('payment_date', { ascending: true })
      .then(({ data }) => setRows((data || []) as PaymentRow[]));
  }, [invoiceId]);

  if (rows.length === 0) return null;

  const totalPaid = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const rawBalance = Math.round((grandTotal - totalPaid) * 100) / 100;
  const balance = Math.abs(rawBalance) <= 0.05 ? 0 : Math.max(0, rawBalance);
  const isFullyPaid = balance === 0 && totalPaid > 0;

  const downloadReceipt = (idx: number) => {
    if (!businessSettings) return;
    const r = rows[idx];
    // Running total INCLUDING this receipt
    const runningPaid = rows.slice(0, idx + 1).reduce((s, x) => s + Number(x.amount || 0), 0);
    downloadPaymentReceipt({
      receiptNumber: r.receipt_number,
      invoiceNumber,
      paymentDate: r.payment_date,
      amount: Number(r.amount),
      paymentMode: r.payment_mode,
      customerName,
      customerPhone,
      grandTotal,
      totalPaid: runningPaid,
      notes: r.notes || undefined,
      businessSettings,
    });
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Receipt className="w-4 h-4 text-primary" />
        <h3 className="font-semibold">Payment History</h3>
      </div>
      <div className="space-y-2 text-sm">
        {rows.map((r, idx) => (
          <div key={r.id} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
            <div>
              <p className="font-medium">
                {r.receipt_number} · ₹ {Number(r.amount).toFixed(2)} · {r.payment_mode.toUpperCase()}
              </p>
              <p className="text-xs text-muted-foreground">{format(new Date(r.payment_date), 'dd MMM yyyy')}{r.notes ? ` · ${r.notes}` : ''}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => downloadReceipt(idx)}>
              <Download className="w-4 h-4 mr-1" /> Receipt
            </Button>
          </div>
        ))}
      </div>
      <div className="flex justify-between border-t pt-3 text-sm">
        <span>Total Paid: <span className="font-semibold text-primary">₹ {totalPaid.toFixed(2)}</span></span>
        <span>Balance: <span className="font-semibold text-amber-600">₹ {balance.toFixed(2)}</span></span>
      </div>
    </div>
  );
}
