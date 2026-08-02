import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { runModuleVerification, logVerificationRun, type VerificationRow } from '@/utils/moduleVerification';
import { recalcClientPurchaseHistory } from '@/utils/clientTotals';
import { useToast } from '@/hooks/use-toast';

export function DataVerification() {
  const [rows, setRows] = useState<VerificationRow[]>([]);
  const [running, setRunning] = useState(false);
  const [recalcing, setRecalcing] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const { toast } = useToast();

  const run = async () => {
    setRunning(true);
    try {
      const result = await runModuleVerification();
      setRows(result);
      setLastRun(new Date().toLocaleString('en-IN'));
      await logVerificationRun(result);
      const bad = result.filter((r) => r.status === 'mismatch').length;
      toast({
        title: bad ? `${bad} mismatch(es) found` : 'All modules in sync',
        description: `${result.length} checks logged to the activity log.`,
        variant: bad ? 'destructive' : undefined,
      });
    } catch (e: unknown) {
      toast({ title: 'Verification failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  const recalc = async () => {
    setRecalcing(true);
    try {
      const res = await recalcClientPurchaseHistory();
      toast({
        title: 'Client history recalculated',
        description: `${res.updated} of ${res.scanned} clients updated${res.errors.length ? `, ${res.errors.length} failed` : ''}.`,
        variant: res.errors.length ? 'destructive' : undefined,
      });
      window.dispatchEvent(new Event('inventory:refresh'));
      if (rows.length) await run();
    } catch (e: unknown) {
      toast({ title: 'Recalculation failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setRecalcing(false);
    }
  };

  const mismatches = rows.filter((r) => r.status === 'mismatch').length;

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          Module Verification
        </CardTitle>
        <CardDescription>
          Cross-checks Inventory, Invoices, Clients, Sold and Custom Orders against the same source of truth. Every run is written to the activity log.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={run} disabled={running}>
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
            Run verification
          </Button>
          <Button variant="outline" onClick={recalc} disabled={recalcing}>
            {recalcing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Recalculate client history
          </Button>
          {lastRun && (
            <span className="text-sm text-muted-foreground">
              Last run {lastRun} · {mismatches ? `${mismatches} mismatch(es)` : 'all clear'}
            </span>
          )}
        </div>

        {rows.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Module</TableHead>
                  <TableHead>Check</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.module}</TableCell>
                    <TableCell>
                      {r.metric}
                      {r.note && <span className="block text-xs text-muted-foreground">{r.note}</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono">{r.value}</TableCell>
                    <TableCell>
                      {r.status === 'mismatch' ? (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                          <AlertTriangle className="w-3 h-3 mr-1" /> Mismatch
                        </Badge>
                      ) : r.status === 'ok' ? (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> OK
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Info</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
