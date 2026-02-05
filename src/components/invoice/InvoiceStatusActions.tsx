import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Send, CheckCircle, Clock, CircleDot } from 'lucide-react';

type InvoiceStatus = 'draft' | 'sent' | 'paid';

interface InvoiceStatusActionsProps {
  invoiceId: string;
  currentStatus: InvoiceStatus;
  onStatusChange: () => void;
}

export function InvoiceStatusActions({
  invoiceId,
  currentStatus,
  onStatusChange,
}: InvoiceStatusActionsProps) {
  const { toast } = useToast();

  const handleMarkAsSent = async () => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

      if (error) throw error;

      toast({ title: 'Invoice marked as sent' });
      onStatusChange();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update status';
      toast({ variant: 'destructive', title: 'Error', description: message });
    }
  };

  const handleMarkAsPaid = async () => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_status: 'paid',
        })
        .eq('id', invoiceId);

      if (error) throw error;

      toast({ title: 'Invoice marked as paid' });
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
          onClick={handleMarkAsPaid}
          className="text-green-600 hover:text-green-700 hover:bg-green-50"
        >
          <CheckCircle className="w-4 h-4 mr-1" />
          Mark as Paid
        </Button>
      )}
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
