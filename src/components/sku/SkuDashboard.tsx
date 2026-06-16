import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Barcode, CheckCircle2, Circle, ShoppingBag, Archive, Trash2, Clock } from 'lucide-react';
import { STATUS_COLORS, STATUS_LABELS } from '@/utils/skuCodes';
import type { SkuRegistryRow } from '@/hooks/useSkuRegistry';
import { format } from 'date-fns';

interface Stats {
  total: number;
  assigned: number;
  available: number;
  sold: number;
  archived: number;
  deleted: number;
  recent: SkuRegistryRow[];
}

export function SkuDashboard({ stats }: { stats: Stats }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard title="Total Generated" value={stats.total} icon={Barcode} />
        <StatCard title="Assigned" value={stats.assigned} icon={CheckCircle2} />
        <StatCard title="Available" value={stats.available} icon={Circle} />
        <StatCard title="Sold" value={stats.sold} icon={ShoppingBag} />
        <StatCard title="Archived" value={stats.archived} icon={Archive} />
        <StatCard title="Deleted Product" value={stats.deleted} icon={Trash2} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-base">Recently Generated</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No SKUs generated yet.</p>
          ) : (
            <div className="divide-y">
              {stats.recent.map((r) => (
                <div key={r.sku} className="flex items-center justify-between py-2 text-sm">
                  <div className="font-mono font-semibold">{r.sku}</div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="hidden md:inline">{r.vendor_name || '—'} · {r.category_name || '—'}</span>
                    <Badge variant="outline" className={STATUS_COLORS[r.status]}>
                      {STATUS_LABELS[r.status] || r.status}
                    </Badge>
                    <span>{format(new Date(r.created_at), 'dd MMM, HH:mm')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
