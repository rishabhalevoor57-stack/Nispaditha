import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wallet, Pencil, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { useStoreWallet, adjustWallet } from '@/hooks/useStoreWallet';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useToast } from '@/hooks/use-toast';

interface Props {
  clientId: string;
  clientName?: string;
}

const fmtINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d: string) =>
  new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function StoreWalletCard({ clientId, clientName }: Props) {
  const { balance, transactions, loading, refresh } = useStoreWallet(clientId);
  const isAdmin = useIsAdmin();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'credit' | 'debit'>('credit');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) {
      toast({ variant: 'destructive', title: 'Enter a positive amount' });
      return;
    }
    setBusy(true);
    try {
      await adjustWallet(
        clientId,
        direction === 'credit' ? n : -n,
        'manual',
        null,
        clientName || null,
        note || 'Manual adjustment',
      );
      toast({ title: `Wallet ${direction === 'credit' ? 'credited' : 'debited'} ₹${n.toLocaleString('en-IN')}` });
      setAmount('');
      setNote('');
      setEditing(false);
      refresh();
    } catch (e: unknown) {
      toast({
        variant: 'destructive',
        title: 'Failed',
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Store Wallet</h3>
        </div>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>
            <Pencil className="w-3 h-3 mr-1" /> Adjust
          </Button>
        )}
      </div>

      <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
        <div className="text-xs text-muted-foreground">Available Balance</div>
        <div className="text-3xl font-bold text-primary tabular-nums">{fmtINR(balance)}</div>
        <div className="text-[11px] text-muted-foreground mt-1">1 credit = ₹1</div>
      </div>

      {editing && isAdmin && (
        <div className="rounded-md border p-3 space-y-2 bg-muted/30">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={direction === 'credit' ? 'default' : 'outline'}
              onClick={() => setDirection('credit')}
            >
              + Credit
            </Button>
            <Button
              type="button"
              size="sm"
              variant={direction === 'debit' ? 'default' : 'outline'}
              onClick={() => setDirection('debit')}
            >
              − Debit
            </Button>
          </div>
          <div>
            <Label className="text-xs">Amount (₹)</Label>
            <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason..." />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" className="btn-gold" onClick={submit} disabled={busy}>Save</Button>
          </div>
        </div>
      )}

      <div>
        <div className="text-xs font-medium text-muted-foreground mb-2">Transaction History</div>
        <div className="border rounded-md max-h-64 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
          ) : transactions.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No transactions yet</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Source</th>
                  <th className="text-right p-2">Amount</th>
                  <th className="text-right p-2">Balance</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="p-2">{fmtDate(t.created_at)}</td>
                    <td className="p-2 capitalize">
                      {t.source.replace('_', ' ')}
                      {t.reference_label && (
                        <span className="text-muted-foreground"> · {t.reference_label}</span>
                      )}
                    </td>
                    <td className={`p-2 text-right font-medium ${t.type === 'credit' ? 'text-green-600' : 'text-destructive'}`}>
                      <span className="inline-flex items-center gap-1">
                        {t.type === 'credit' ? <ArrowUpCircle className="w-3 h-3" /> : <ArrowDownCircle className="w-3 h-3" />}
                        {t.type === 'credit' ? '+' : '−'}{fmtINR(t.amount)}
                      </span>
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {t.balance_after != null ? fmtINR(Number(t.balance_after)) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Card>
  );
}
