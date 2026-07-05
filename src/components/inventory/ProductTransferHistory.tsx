import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ArrowRight, Truck } from 'lucide-react';

interface Row {
  id: string;
  transfer_date: string;
  quantity: number;
  remarks: string | null;
  from_branch: { name: string } | null;
  to_branch: { name: string } | null;
  transferred_by: string | null;
}

export function ProductTransferHistory({ sku, productId }: { sku: string; productId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('branch_stock_transfers' as any)
        .select('id, transfer_date, quantity, remarks, transferred_by, from_branch:branches!branch_stock_transfers_from_branch_id_fkey(name), to_branch:branches!branch_stock_transfers_to_branch_id_fkey(name)')
        .or(`sku.eq.${sku},product_id.eq.${productId},destination_product_id.eq.${productId}`)
        .order('transfer_date', { ascending: false })
        .limit(20);
      if (!cancelled) {
        setRows((data as any) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sku, productId]);

  if (loading) return <p className="text-xs text-muted-foreground">Loading transfer history…</p>;
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">No branch transfers for this item.</p>;

  return (
    <div className="rounded-lg border divide-y max-h-56 overflow-y-auto">
      {rows.map((r) => (
        <div key={r.id} className="flex items-start gap-3 p-2 text-xs">
          <Truck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium flex items-center gap-1">
                {r.from_branch?.name || 'Unknown'}
                <ArrowRight className="w-3 h-3" />
                {r.to_branch?.name || 'Unknown'}
              </span>
              <span className="text-muted-foreground">{format(new Date(r.transfer_date), 'dd MMM yyyy')}</span>
            </div>
            <p className="text-muted-foreground">Qty: <span className="font-medium">{r.quantity}</span>{r.remarks ? ` — ${r.remarks}` : ''}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
