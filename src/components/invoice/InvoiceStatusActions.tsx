import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Send, CheckCircle, CircleDot } from 'lucide-react';
import { RecordPaymentDialog } from './RecordPaymentDialog';

type InvoiceStatus = 'draft' | 'sent' | 'paid';

interface InvoiceStatusActionsProps {
  invoiceId: string;
  invoiceNumber?: string;
  grandTotal?: number;
  advancePaid?: number;
  currentStatus: InvoiceStatus;
  onStatusChange: () => void;
}

export function InvoiceStatusActions({
  invoiceId,
  invoiceNumber = '',
  grandTotal = 0,
  advancePaid = 0,
  currentStatus,
  onStatusChange,
}: InvoiceStatusActionsProps) {
  const { toast } = useToast();
  const [showPayment, setShowPayment] = useState(false);

  const handleMarkAsSent = async () => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', invoiceId);
      if (error) throw error;
      toast({ title: 'Invoice marked as sent' });
      onStatusChange();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update status';
      toast({ variant: 'destructive', title: 'Error', description: message });
    }
  };

  return (
    <div className="flex items-center gap-2">
      {currentStatus === 'draft' && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleMarkAsSent}
          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
        >
          <Send className="w-4 h-4 mr-1" />
          Mark as Sent
        </Button>
      )}
      {currentStatus === 'sent' && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowPayment(true)}
          className="text-green-600 hover:text-green-700 hover:bg-green-50"
        >
          <CheckCircle className="w-4 h-4 mr-1" />
          Mark as Paid
        </Button>
      )}

      <RecordPaymentDialog
        open={showPayment}
        onOpenChange={setShowPayment}
        invoiceId={invoiceId}
        invoiceNumber={invoiceNumber}
        grandTotal={grandTotal}
        alreadyPaid={advancePaid}
        onRecorded={onStatusChange}
      />
    </div>
  );
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const config = {
    draft: {
      label: 'Draft',
      icon: CircleDot,
      className: 'bg-muted text-muted-foreground border-muted-foreground/20',
    },
    sent: {
      label: 'Sent',
      icon: Send,
      className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    },
    paid: {
      label: 'Paid',
      icon: CheckCircle,
      className: 'bg-green-500/10 text-green-600 border-green-500/20',
    },
  };

  const { label, icon: Icon, className } = config[status] || config.draft;

  return (
    <Badge variant="outline" className={className}>
      <Icon className="w-3 h-3 mr-1" />
      {label}
    </Badge>
  );
}
